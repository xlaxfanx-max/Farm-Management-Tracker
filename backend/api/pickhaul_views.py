"""Pick & haul views: the machine sync endpoint and the accountant's API.

Access model:
* ``/api/pickhaul/sync/`` accepts ONLY machine tokens (MachineTokenAuthentication
  is its sole authentication class) — a human's JWT cookie cannot push, and the
  machine token works nowhere else.
* Everything else stacks the standard company tenancy with the pick & haul
  permission codenames: ``view_pick_haul`` to read, ``manage_pick_haul`` to
  write. This module is the first real wiring of the HasPermission class.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Max, Q, Sum
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .machine_auth import HasMachineScope, MachineTokenAuthentication
from .models import (
    LegalEntity,
    PickHaulCheckResult, PickHaulDirectCharge, PickHaulInvoice,
    PickHaulInvoiceReceipt, PickHaulManualPick, PickHaulPull, PickHaulReceipt,
    PickHaulSyncBatch,
)
from .permissions import HasPermission, HasCompanyAccess, IsAuthenticated
from .pickhaul_serializers import (
    PickHaulCheckResultSerializer, PickHaulDirectChargeSerializer,
    PickHaulInvoiceSerializer, PickHaulManualPickSerializer,
    PickHaulReceiptSerializer, PickHaulSyncBatchSerializer,
)
from .services.pickhaul import BundleRejected, apply_bundle, run_post_change
from .services.pickhaul.config import AGING_DAYS
from .view_helpers import CompanyFilteredViewSet, get_user_company

MAX_BUNDLE_BYTES = 5 * 1024 * 1024
STALE_AFTER_HOURS = 48


def _season_param(request, company):
    """The requested season, defaulting to the latest season with data."""
    raw = request.query_params.get('season')
    if raw:
        try:
            return int(raw)
        except ValueError:
            return None
    latest = PickHaulReceipt.objects.filter(company=company).aggregate(m=Max('season'))['m']
    if latest is None:
        latest = PickHaulInvoice.objects.filter(company=company).aggregate(m=Max('season'))['m']
    if latest is None:
        latest = PickHaulManualPick.objects.filter(company=company).aggregate(m=Max('season'))['m']
    return latest or date.today().year


# ------------------------------------------------------------------- sync ----

class PickHaulSyncView(APIView):
    """POST /api/pickhaul/sync/ — the local pipeline's push target."""

    authentication_classes = [MachineTokenAuthentication]
    permission_classes = [HasMachineScope]
    required_scope = 'pickhaul:push'

    def post(self, request):
        content_length = int(request.META.get('CONTENT_LENGTH') or 0)
        if content_length > MAX_BUNDLE_BYTES:
            return Response(
                {'detail': f'Bundle exceeds {MAX_BUNDLE_BYTES // (1024 * 1024)} MB.'},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        token = request.auth
        try:
            result = apply_bundle(token.company, request.data, token=token)
        except BundleRejected as exc:
            return Response(
                {'detail': exc.reason,
                 'batch_id': exc.batch.pk if exc.batch else None},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        code = status.HTTP_200_OK if result.get('duplicate') else status.HTTP_201_CREATED
        return Response(result, status=code)


# --------------------------------------------------------------- viewsets ----

class _PickHaulReadOnlyViewSet(CompanyFilteredViewSet):
    """Company-scoped, view_pick_haul-gated, GET-only."""

    http_method_names = ['get', 'head', 'options']
    permission_classes = [IsAuthenticated, HasCompanyAccess, HasPermission]
    required_permission = 'view_pick_haul'


class _PickHaulCrudViewSet(CompanyFilteredViewSet):
    """Company-scoped CRUD: read with view_pick_haul, write with manage_pick_haul."""

    permission_classes = [IsAuthenticated, HasCompanyAccess, HasPermission]
    permission_map = {
        'list': 'view_pick_haul',
        'retrieve': 'view_pick_haul',
        'create': 'manage_pick_haul',
        'update': 'manage_pick_haul',
        'partial_update': 'manage_pick_haul',
        'destroy': 'manage_pick_haul',
    }


class PickHaulInvoiceViewSet(_PickHaulCrudViewSet):
    model = PickHaulInvoice
    serializer_class = PickHaulInvoiceSerializer
    select_related_fields = ('packinghouse', 'entity')
    prefetch_related_fields = ('charge_matches__charge', 'receipt_links__receipt')
    default_ordering = ('-date_from', '-id')

    def filter_queryset_by_params(self, qs):
        p = self.request.query_params
        if p.get('season'):
            qs = qs.filter(season=p['season'])
        if p.get('house'):
            qs = qs.filter(packinghouse_id=p['house'])
        if p.get('entity'):
            qs = qs.filter(entity_id=p['entity'])
        if p.get('kind'):
            qs = qs.filter(kind=p['kind'])
        if p.get('outstanding') in ('1', 'true'):
            qs = qs.filter(date_emailed__isnull=False, charge_posted__isnull=True)
        if p.get('matched') in ('1', 'true'):
            qs = qs.exclude(match_method__in=('', 'unmatched'))
        elif p.get('matched') in ('0', 'false'):
            qs = qs.filter(match_method__in=('', 'unmatched'))
        if p.get('search'):
            qs = qs.filter(
                Q(contractor__icontains=p['search'])
                | Q(invoice_no__icontains=p['search'])
                | Q(block_raw__icontains=p['search'])
                | Q(ap_reference__icontains=p['search'])
            )
        return qs

    def _post_change(self, season):
        company = get_user_company(self.request.user)
        run_post_change(company, season)

    def perform_create(self, serializer):
        instance = super().perform_create(serializer)
        saved = serializer.instance
        self._post_change(saved.season)
        # Refresh so the response carries the derived fields reconciliation just wrote.
        saved.refresh_from_db()
        return instance

    def perform_update(self, serializer):
        instance = serializer.save()
        self._post_change(instance.season)
        instance.refresh_from_db()

    def perform_destroy(self, instance):
        season = instance.season
        super().perform_destroy(instance)
        self._post_change(season)

    @action(detail=False, methods=['get'])
    def contractors(self, request):
        """Distinct contractor names for the entry form's autocomplete."""
        company = get_user_company(request.user)
        names = (
            PickHaulInvoice.objects.filter(company=company)
            .exclude(contractor__isnull=True).exclude(contractor='')
            .values_list('contractor', flat=True).distinct().order_by('contractor')
        )
        return Response(list(names))

    @action(detail=True, methods=['post'], url_path='links')
    def add_link(self, request, pk=None):
        """Manually attach a receipt (assigned='manual')."""
        invoice = self.get_object()
        receipt_id = request.data.get('receipt')
        company = get_user_company(request.user)
        try:
            receipt = PickHaulReceipt.objects.get(pk=receipt_id, company=company)
        except PickHaulReceipt.DoesNotExist:
            return Response({'detail': 'No such receipt.'}, status=status.HTTP_400_BAD_REQUEST)
        PickHaulInvoiceReceipt.objects.get_or_create(
            invoice=invoice, receipt=receipt, defaults={'assigned': 'manual'},
        )
        self._post_change(invoice.season)
        return Response({'status': 'linked'}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path='links/(?P<receipt_id>[0-9]+)')
    def remove_link(self, request, pk=None, receipt_id=None):
        invoice = self.get_object()
        deleted, _ = PickHaulInvoiceReceipt.objects.filter(
            invoice=invoice, receipt_id=receipt_id,
        ).delete()
        if not deleted:
            return Response({'detail': 'No such link.'}, status=status.HTTP_404_NOT_FOUND)
        self._post_change(invoice.season)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PickHaulManualPickViewSet(_PickHaulCrudViewSet):
    model = PickHaulManualPick
    serializer_class = PickHaulManualPickSerializer
    select_related_fields = ('packinghouse', 'entity')
    default_ordering = ('sheet', 'row_no', 'id')

    def filter_queryset_by_params(self, qs):
        p = self.request.query_params
        if p.get('season'):
            qs = qs.filter(season=p['season'])
        if p.get('house'):
            qs = qs.filter(packinghouse_id=p['house'])
        if p.get('sheet'):
            qs = qs.filter(sheet=p['sheet'])
        if p.get('search'):
            qs = qs.filter(
                Q(ranch__icontains=p['search']) | Q(block__icontains=p['search'])
                | Q(harvester__icontains=p['search']) | Q(invoice_no__icontains=p['search'])
            )
        return qs

    @action(detail=False, methods=['get'])
    def source_sheets(self, request):
        """The known sheet labels, so spelling lives in one place."""
        company = get_user_company(request.user)
        used = (
            PickHaulManualPick.objects.filter(company=company)
            .exclude(sheet='').values_list('sheet', flat=True).distinct()
        )
        return Response(sorted(set(used)))


class PickHaulReceiptViewSet(_PickHaulReadOnlyViewSet):
    model = PickHaulReceipt
    serializer_class = PickHaulReceiptSerializer
    select_related_fields = ('packinghouse', 'entity')
    default_ordering = ('-pick_date', 'receipt_no')

    def filter_queryset_by_params(self, qs):
        p = self.request.query_params
        if p.get('season'):
            qs = qs.filter(season=p['season'])
        if p.get('house'):
            qs = qs.filter(packinghouse_id=p['house'])
        if p.get('entity'):
            qs = qs.filter(entity_id=p['entity'])
        if p.get('block'):
            qs = qs.filter(block_raw__icontains=p['block'])
        if p.get('active') in ('1', 'true'):
            qs = qs.filter(is_active=True)
        elif p.get('active') in ('0', 'false'):
            qs = qs.filter(is_active=False)
        if p.get('covered') in ('0', 'false'):
            qs = qs.exclude(invoice_links__invoice__kind='PICK')
        if p.get('search'):
            qs = qs.filter(
                Q(receipt_no__icontains=p['search']) | Q(block_raw__icontains=p['search'])
            )
        return qs

    @action(detail=False, methods=['get'])
    def blocks(self, request):
        """Distinct raw block strings, for the entry form's autocomplete."""
        company = get_user_company(request.user)
        qs = PickHaulReceipt.objects.filter(company=company).exclude(block_raw='')
        if request.query_params.get('house'):
            qs = qs.filter(packinghouse_id=request.query_params['house'])
        if request.query_params.get('season'):
            qs = qs.filter(season=request.query_params['season'])
        return Response(sorted(set(qs.values_list('block_raw', flat=True))))


class PickHaulDirectChargeViewSet(_PickHaulReadOnlyViewSet):
    model = PickHaulDirectCharge
    serializer_class = PickHaulDirectChargeSerializer
    select_related_fields = ('packinghouse', 'entity', 'match')
    default_ordering = ('-charge_date', '-id')

    def filter_queryset_by_params(self, qs):
        p = self.request.query_params
        if p.get('season'):
            qs = qs.filter(season=p['season'])
        if p.get('house'):
            qs = qs.filter(packinghouse_id=p['house'])
        if p.get('kind'):
            qs = qs.filter(kind=p['kind'])
        if p.get('matched') in ('1', 'true'):
            qs = qs.filter(match__isnull=False)
        elif p.get('matched') in ('0', 'false'):
            qs = qs.filter(match__isnull=True)
        if p.get('search'):
            qs = qs.filter(
                Q(ap_reference__icontains=p['search']) | Q(block_raw__icontains=p['search'])
            )
        return qs


class PickHaulCheckResultViewSet(_PickHaulReadOnlyViewSet):
    model = PickHaulCheckResult
    serializer_class = PickHaulCheckResultSerializer
    select_related_fields = ('packinghouse', 'entity')
    default_ordering = ('gate', '-run_at')

    def filter_queryset_by_params(self, qs):
        p = self.request.query_params
        if p.get('season'):
            qs = qs.filter(season=p['season'])
        if p.get('severity'):
            qs = qs.filter(severity=p['severity'])
        if p.get('gate'):
            qs = qs.filter(gate=p['gate'])
        if p.get('origin'):
            qs = qs.filter(origin=p['origin'])
        return qs


class PickHaulSyncBatchViewSet(_PickHaulReadOnlyViewSet):
    model = PickHaulSyncBatch
    serializer_class = PickHaulSyncBatchSerializer
    default_ordering = ('-received_at',)

    def filter_queryset_by_params(self, qs):
        p = self.request.query_params
        if p.get('season'):
            qs = qs.filter(season=p['season'])
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        return qs


class PickHaulEntitiesView(APIView):
    """GET /api/pickhaul/entities/ — the company's legal entities, for the
    entry forms' dropdowns. (No general LegalEntity endpoint exists yet.)"""

    permission_classes = [IsAuthenticated, HasCompanyAccess, HasPermission]
    required_permission = 'view_pick_haul'

    def get(self, request):
        company = get_user_company(request.user)
        return Response([
            {'id': e.pk, 'name': e.name, 'short_code': e.short_code}
            for e in LegalEntity.objects.filter(company=company).order_by('short_code')
        ])


# ------------------------------------------------------------- summaries -----

def _bucket_key(days):
    if days <= 30:
        return '0_30'
    if days <= 60:
        return '31_60'
    if days <= 90:
        return '61_90'
    return '90_plus'


class PickHaulSummaryView(APIView):
    """GET /api/pickhaul/summary/aging/ — the owed-by-houses money view."""

    permission_classes = [IsAuthenticated, HasCompanyAccess, HasPermission]
    required_permission = 'view_pick_haul'

    def get(self, request):
        company = get_user_company(request.user)
        season = _season_param(request, company)
        today = date.today()

        outstanding = PickHaulInvoice.objects.filter(
            company=company, season=season,
            date_emailed__isnull=False, charge_posted__isnull=True,
        ).select_related('packinghouse', 'entity').order_by('date_emailed')

        empty = lambda: {'amount': Decimal('0'), 'count': 0}  # noqa: E731
        buckets = {k: empty() for k in ('0_30', '31_60', '61_90', '90_plus')}
        houses = {}
        total = Decimal('0')

        for inv in outstanding:
            days = (today - inv.date_emailed).days
            key = _bucket_key(days)
            amount = inv.amount or Decimal('0')
            total += amount
            buckets[key]['amount'] += amount
            buckets[key]['count'] += 1

            hkey = (inv.packinghouse_id, inv.entity_id)
            h = houses.setdefault(hkey, {
                'house': inv.packinghouse_id,
                'house_name': inv.packinghouse.name,
                'house_code': inv.packinghouse.short_code,
                'entity': inv.entity_id,
                'entity_code': inv.entity.short_code,
                'owed_amount': Decimal('0'), 'outstanding_count': 0,
                'oldest_days': 0,
                'buckets': {k: empty() for k in buckets},
            })
            h['owed_amount'] += amount
            h['outstanding_count'] += 1
            h['oldest_days'] = max(h['oldest_days'], days)
            h['buckets'][key]['amount'] += amount
            h['buckets'][key]['count'] += 1

        unmatched = PickHaulDirectCharge.objects.filter(
            company=company, season=season, kind__in=('PICK', 'HAUL'),
            debit__gt=0, match__isnull=True,
        ).aggregate(rows=Count('id'), total=Sum('debit'))

        return Response({
            'season': season,
            'total_owed': total,
            'outstanding_count': sum(b['count'] for b in buckets.values()),
            'aging_threshold_days': AGING_DAYS,
            'buckets': buckets,
            'houses': sorted(houses.values(), key=lambda h: -h['oldest_days']),
            'unmatched_charges': {
                'rows': unmatched['rows'] or 0,
                'total': unmatched['total'] or Decimal('0'),
            },
        })


class PickHaulSyncStatusView(APIView):
    """GET /api/pickhaul/sync-status/ — freshness and provenance."""

    permission_classes = [IsAuthenticated, HasCompanyAccess, HasPermission]
    required_permission = 'view_pick_haul'

    def get(self, request):
        from django.utils import timezone

        company = get_user_company(request.user)
        season = _season_param(request, company)

        last_applied = PickHaulSyncBatch.objects.filter(
            company=company, status='applied',
        ).order_by('-received_at').first()
        last_any = PickHaulSyncBatch.objects.filter(
            company=company,
        ).order_by('-received_at').first()

        now = timezone.now()
        stale = (
            last_applied is None
            or (now - last_applied.received_at) > timedelta(hours=STALE_AFTER_HOURS)
        )

        # Latest pull per account for the season.
        sources = []
        latest_ids = (
            PickHaulPull.objects.filter(company=company, season=season)
            .values('packinghouse_id', 'entity_id')
            .annotate(latest=Max('id'))
            .values_list('latest', flat=True)
        )
        for pull in (PickHaulPull.objects.filter(pk__in=list(latest_ids))
                     .select_related('packinghouse', 'entity')
                     .order_by('packinghouse__short_code', 'entity__short_code')):
            sources.append({
                'house_code': pull.packinghouse.short_code,
                'entity_code': pull.entity.short_code,
                'file_name': pull.file_name,
                'sha256': pull.sha256,
                'pulled_at': pull.pulled_at,
                'row_count': pull.row_count,
                'status': pull.status,
            })

        gate_counts = {
            row['severity']: row['n']
            for row in PickHaulCheckResult.objects.filter(company=company, season=season)
            .values('severity').annotate(n=Count('id'))
        }

        return Response({
            'season': season,
            'last_push_at': last_applied.received_at if last_applied else None,
            'last_contact_at': last_any.received_at if last_any else None,
            'last_batch': PickHaulSyncBatchSerializer(last_applied).data if last_applied else None,
            'stale': stale,
            'stale_after_hours': STALE_AFTER_HOURS,
            'sources': sources,
            'check_counts': {
                'error': gate_counts.get('error', 0),
                'warn': gate_counts.get('warn', 0),
                'info': gate_counts.get('info', 0),
            },
        })
