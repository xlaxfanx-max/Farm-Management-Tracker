"""
Packinghouse Pool Tracking Views
================================
ViewSets and API views for the packinghouse pool tracking module.
Handles deliveries, packout reports, settlements, and grower ledger entries.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Sum, Avg, Count, F, Q
from django.db.models.functions import Coalesce
from decimal import Decimal
import logging

from .models import (
    Packinghouse, Pool, PackinghouseDelivery,
    PackoutReport, PackoutGradeLine,
    PoolSettlement, SettlementGradeLine, SettlementDeduction,
    GrowerLedgerEntry, Field, PackinghouseStatement,
    Harvest, StatementBatchUpload, PackinghouseGrowerMapping, Farm
)
from .services.season_service import (
    SeasonService, get_citrus_season, parse_legacy_season,
    get_crop_category_for_commodity, parse_season_for_category
)

logger = logging.getLogger(__name__)
from .serializers import (
    PackinghouseListSerializer, PackinghouseSerializer,
    PoolListSerializer, PoolSerializer,
    PackinghouseDeliveryListSerializer, PackinghouseDeliverySerializer,
    PackoutReportListSerializer, PackoutReportSerializer, PackoutReportCreateSerializer,
    PackoutGradeLineSerializer,
    PoolSettlementListSerializer, PoolSettlementSerializer, PoolSettlementCreateSerializer,
    SettlementGradeLineSerializer, SettlementDeductionSerializer,
    GrowerLedgerEntryListSerializer, GrowerLedgerEntrySerializer,
    BlockPerformanceSerializer, PackoutTrendSerializer, SettlementComparisonSerializer,
    SizeDistributionGroupSerializer, SizePricingEntrySerializer,
    PackinghouseStatementListSerializer, PackinghouseStatementSerializer,
    PackinghouseStatementUploadSerializer,
    BatchUploadSerializer, BatchUploadResponseSerializer,
    BatchConfirmSerializer, BatchConfirmResponseSerializer,
    BatchStatusSerializer,
)
from .services import PDFExtractionService, StatementMatcher
import uuid
from django.utils import timezone


class PackinghouseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Packinghouse CRUD operations.

    list: GET /api/packinghouses/
    create: POST /api/packinghouses/
    retrieve: GET /api/packinghouses/{id}/
    update: PUT /api/packinghouses/{id}/
    partial_update: PATCH /api/packinghouses/{id}/
    destroy: DELETE /api/packinghouses/{id}/

    Custom actions:
    - pools: GET /api/packinghouses/{id}/pools/
    - ledger: GET /api/packinghouses/{id}/ledger/
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.current_company:
            return Packinghouse.objects.none()

        queryset = Packinghouse.objects.filter(
            company=user.current_company
        ).annotate(
            pool_count_annotated=Count('pools')
        )

        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        return queryset.order_by('name')

    def get_serializer_class(self):
        if self.action == 'list':
            return PackinghouseListSerializer
        return PackinghouseSerializer

    def perform_create(self, serializer):
        serializer.save(company=self.request.user.current_company)

    @action(detail=True, methods=['get'])
    def pools(self, request, pk=None):
        """Get all pools for a packinghouse."""
        packinghouse = self.get_object()
        pools = Pool.objects.filter(packinghouse=packinghouse)

        # Filter by status
        pool_status = request.query_params.get('status')
        if pool_status:
            pools = pools.filter(status=pool_status)

        # Filter by season
        season = request.query_params.get('season')
        if season:
            pools = pools.filter(season=season)

        serializer = PoolListSerializer(pools, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def ledger(self, request, pk=None):
        """Get ledger entries for a packinghouse."""
        packinghouse = self.get_object()
        entries = GrowerLedgerEntry.objects.filter(
            packinghouse=packinghouse
        ).order_by('-entry_date', '-created_at')

        # Date range filter
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            entries = entries.filter(entry_date__gte=start_date)
        if end_date:
            entries = entries.filter(entry_date__lte=end_date)

        serializer = GrowerLedgerEntryListSerializer(entries, many=True)
        return Response(serializer.data)


class PoolViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Pool CRUD operations.

    list: GET /api/pools/
    create: POST /api/pools/
    retrieve: GET /api/pools/{id}/
    update: PUT /api/pools/{id}/
    partial_update: PATCH /api/pools/{id}/
    destroy: DELETE /api/pools/{id}/

    Custom actions:
    - deliveries: GET /api/pools/{id}/deliveries/
    - packout_reports: GET /api/pools/{id}/packout-reports/
    - settlements: GET /api/pools/{id}/settlements/
    - summary: GET /api/pools/{id}/summary/
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.current_company:
            return Pool.objects.none()

        queryset = Pool.objects.filter(
            packinghouse__company=user.current_company
        ).select_related('packinghouse')

        # Filter by packinghouse
        packinghouse_id = self.request.query_params.get('packinghouse')
        if packinghouse_id:
            queryset = queryset.filter(packinghouse_id=packinghouse_id)

        # Filter by status
        pool_status = self.request.query_params.get('status')
        if pool_status:
            queryset = queryset.filter(status=pool_status)

        # Filter by season
        season = self.request.query_params.get('season')
        if season:
            queryset = queryset.filter(season=season)

        # Filter by commodity
        commodity = self.request.query_params.get('commodity')
        if commodity:
            queryset = queryset.filter(commodity__icontains=commodity)

        return queryset.order_by('-season', 'commodity', 'name')

    def get_serializer_class(self):
        if self.action == 'list':
            return PoolListSerializer
        return PoolSerializer

    @action(detail=True, methods=['get'])
    def deliveries(self, request, pk=None):
        """Get all deliveries for a pool."""
        pool = self.get_object()
        deliveries = PackinghouseDelivery.objects.filter(
            pool=pool
        ).select_related('field', 'harvest')

        # Filter by field
        field_id = request.query_params.get('field')
        if field_id:
            deliveries = deliveries.filter(field_id=field_id)

        # Date range filter
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            deliveries = deliveries.filter(delivery_date__gte=start_date)
        if end_date:
            deliveries = deliveries.filter(delivery_date__lte=end_date)

        serializer = PackinghouseDeliveryListSerializer(deliveries, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='packout-reports')
    def packout_reports(self, request, pk=None):
        """Get all packout reports for a pool."""
        pool = self.get_object()
        reports = PackoutReport.objects.filter(
            pool=pool
        ).select_related('field').prefetch_related('grade_lines')

        # Filter by field
        field_id = request.query_params.get('field')
        if field_id:
            reports = reports.filter(field_id=field_id)

        serializer = PackoutReportListSerializer(reports, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def settlements(self, request, pk=None):
        """Get all settlements for a pool."""
        pool = self.get_object()
        settlements = PoolSettlement.objects.filter(
            pool=pool
        ).select_related('field').prefetch_related('grade_lines', 'deductions')

        # Filter by field
        field_id = request.query_params.get('field')
        if field_id:
            settlements = settlements.filter(field_id=field_id)

        serializer = PoolSettlementListSerializer(settlements, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Get summary statistics for a pool."""
        pool = self.get_object()

        # Delivery totals
        delivery_stats = PackinghouseDelivery.objects.filter(
            pool=pool
        ).aggregate(
            total_deliveries=Count('id'),
            total_bins=Coalesce(Sum('bins'), Decimal('0')),
            total_weight_lbs=Coalesce(Sum('weight_lbs'), Decimal('0'))
        )

        # Field breakdown
        fields_breakdown = PackinghouseDelivery.objects.filter(
            pool=pool
        ).values(
            'field__id', 'field__name'
        ).annotate(
            bins=Sum('bins'),
            deliveries=Count('id')
        ).order_by('-bins')

        # Latest packout report stats
        latest_packout = PackoutReport.objects.filter(
            pool=pool
        ).order_by('-report_date').first()

        packout_stats = None
        if latest_packout:
            packout_stats = {
                'report_date': latest_packout.report_date,
                'total_packed_percent': latest_packout.total_packed_percent,
                'house_avg_packed_percent': latest_packout.house_avg_packed_percent,
                'juice_percent': latest_packout.juice_percent,
            }

        # Settlement totals if pool is settled
        settlement_stats = None
        settlement = PoolSettlement.objects.filter(
            pool=pool, field__isnull=True
        ).first()
        if settlement:
            settlement_stats = {
                'statement_date': settlement.statement_date,
                'net_return': settlement.net_return,
                'amount_due': settlement.amount_due,
                'net_per_bin': settlement.net_per_bin,
                'house_avg_per_bin': settlement.house_avg_per_bin,
            }

        return Response({
            'pool': PoolSerializer(pool).data,
            'delivery_stats': delivery_stats,
            'fields_breakdown': list(fields_breakdown),
            'packout_stats': packout_stats,
            'settlement_stats': settlement_stats,
        })


class PackinghouseDeliveryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for PackinghouseDelivery CRUD operations.

    list: GET /api/packinghouse-deliveries/
    create: POST /api/packinghouse-deliveries/
    retrieve: GET /api/packinghouse-deliveries/{id}/
    update: PUT /api/packinghouse-deliveries/{id}/
    partial_update: PATCH /api/packinghouse-deliveries/{id}/
    destroy: DELETE /api/packinghouse-deliveries/{id}/
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.current_company:
            return PackinghouseDelivery.objects.none()

        queryset = PackinghouseDelivery.objects.filter(
            pool__packinghouse__company=user.current_company
        ).select_related('pool', 'pool__packinghouse', 'field', 'field__farm', 'harvest')

        # Filter by pool
        pool_id = self.request.query_params.get('pool')
        if pool_id:
            queryset = queryset.filter(pool_id=pool_id)

        # Filter by field
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        # Filter by packinghouse
        packinghouse_id = self.request.query_params.get('packinghouse')
        if packinghouse_id:
            queryset = queryset.filter(pool__packinghouse_id=packinghouse_id)

        # Date range filter
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(delivery_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(delivery_date__lte=end_date)

        return queryset.order_by('-delivery_date', '-created_at')

    def get_serializer_class(self):
        if self.action == 'list':
            return PackinghouseDeliveryListSerializer
        return PackinghouseDeliverySerializer


class PackoutReportViewSet(viewsets.ModelViewSet):
    """
    ViewSet for PackoutReport CRUD operations.

    list: GET /api/packout-reports/
    create: POST /api/packout-reports/
    retrieve: GET /api/packout-reports/{id}/
    update: PUT /api/packout-reports/{id}/
    partial_update: PATCH /api/packout-reports/{id}/
    destroy: DELETE /api/packout-reports/{id}/

    Custom actions:
    - grade_lines: GET/POST /api/packout-reports/{id}/grade-lines/
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.current_company:
            return PackoutReport.objects.none()

        queryset = PackoutReport.objects.filter(
            pool__packinghouse__company=user.current_company
        ).select_related(
            'pool', 'pool__packinghouse', 'field', 'field__farm'
        ).prefetch_related('grade_lines')

        # Filter by pool
        pool_id = self.request.query_params.get('pool')
        if pool_id:
            queryset = queryset.filter(pool_id=pool_id)

        # Filter by field
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        # Filter by packinghouse
        packinghouse_id = self.request.query_params.get('packinghouse')
        if packinghouse_id:
            queryset = queryset.filter(pool__packinghouse_id=packinghouse_id)

        return queryset.order_by('-report_date')

    def get_serializer_class(self):
        if self.action == 'list':
            return PackoutReportListSerializer
        if self.action == 'create':
            return PackoutReportCreateSerializer
        return PackoutReportSerializer

    @action(detail=True, methods=['get', 'post'], url_path='grade-lines')
    def grade_lines(self, request, pk=None):
        """Get or add grade lines for a packout report."""
        report = self.get_object()

        if request.method == 'GET':
            lines = PackoutGradeLine.objects.filter(packout_report=report)
            serializer = PackoutGradeLineSerializer(lines, many=True)
            return Response(serializer.data)

        # POST - add grade lines
        serializer = PackoutGradeLineSerializer(data=request.data, many=True)
        if serializer.is_valid():
            for item in serializer.validated_data:
                PackoutGradeLine.objects.create(
                    packout_report=report,
                    **item
                )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PoolSettlementViewSet(viewsets.ModelViewSet):
    """
    ViewSet for PoolSettlement CRUD operations.

    list: GET /api/pool-settlements/
    create: POST /api/pool-settlements/
    retrieve: GET /api/pool-settlements/{id}/
    update: PUT /api/pool-settlements/{id}/
    partial_update: PATCH /api/pool-settlements/{id}/
    destroy: DELETE /api/pool-settlements/{id}/

    Custom actions:
    - grade_lines: GET/POST /api/pool-settlements/{id}/grade-lines/
    - deductions: GET/POST /api/pool-settlements/{id}/deductions/
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.current_company:
            return PoolSettlement.objects.none()

        queryset = PoolSettlement.objects.filter(
            pool__packinghouse__company=user.current_company
        ).select_related(
            'pool', 'pool__packinghouse', 'field', 'field__farm', 'source_statement'
        ).prefetch_related('grade_lines', 'deductions')

        # Filter by pool
        pool_id = self.request.query_params.get('pool')
        if pool_id:
            queryset = queryset.filter(pool_id=pool_id)

        # Filter by field
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        # Filter by packinghouse
        packinghouse_id = self.request.query_params.get('packinghouse')
        if packinghouse_id:
            queryset = queryset.filter(pool__packinghouse_id=packinghouse_id)

        return queryset.order_by('-statement_date')

    def get_serializer_class(self):
        if self.action == 'list':
            return PoolSettlementListSerializer
        if self.action == 'create':
            return PoolSettlementCreateSerializer
        return PoolSettlementSerializer

    @action(detail=True, methods=['get', 'post'], url_path='grade-lines')
    def grade_lines(self, request, pk=None):
        """Get or add grade lines for a settlement."""
        settlement = self.get_object()

        if request.method == 'GET':
            lines = SettlementGradeLine.objects.filter(settlement=settlement)
            serializer = SettlementGradeLineSerializer(lines, many=True)
            return Response(serializer.data)

        # POST - add grade lines
        serializer = SettlementGradeLineSerializer(data=request.data, many=True)
        if serializer.is_valid():
            for item in serializer.validated_data:
                SettlementGradeLine.objects.create(
                    settlement=settlement,
                    **item
                )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get', 'post'])
    def deductions(self, request, pk=None):
        """Get or add deductions for a settlement."""
        settlement = self.get_object()

        if request.method == 'GET':
            deductions = SettlementDeduction.objects.filter(settlement=settlement)
            serializer = SettlementDeductionSerializer(deductions, many=True)
            return Response(serializer.data)

        # POST - add deductions
        serializer = SettlementDeductionSerializer(data=request.data, many=True)
        if serializer.is_valid():
            for item in serializer.validated_data:
                SettlementDeduction.objects.create(
                    settlement=settlement,
                    **item
                )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GrowerLedgerEntryViewSet(viewsets.ModelViewSet):
    """
    ViewSet for GrowerLedgerEntry CRUD operations.

    list: GET /api/grower-ledger/
    create: POST /api/grower-ledger/
    retrieve: GET /api/grower-ledger/{id}/
    update: PUT /api/grower-ledger/{id}/
    partial_update: PATCH /api/grower-ledger/{id}/
    destroy: DELETE /api/grower-ledger/{id}/
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.current_company:
            return GrowerLedgerEntry.objects.none()

        queryset = GrowerLedgerEntry.objects.filter(
            packinghouse__company=user.current_company
        ).select_related('packinghouse', 'pool')

        # Filter by packinghouse
        packinghouse_id = self.request.query_params.get('packinghouse')
        if packinghouse_id:
            queryset = queryset.filter(packinghouse_id=packinghouse_id)

        # Filter by pool
        pool_id = self.request.query_params.get('pool')
        if pool_id:
            queryset = queryset.filter(pool_id=pool_id)

        # Filter by entry type
        entry_type = self.request.query_params.get('entry_type')
        if entry_type:
            queryset = queryset.filter(entry_type=entry_type)

        # Date range filter
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(entry_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(entry_date__lte=end_date)

        return queryset.order_by('-entry_date', '-created_at')

    def get_serializer_class(self):
        if self.action == 'list':
            return GrowerLedgerEntryListSerializer
        return GrowerLedgerEntrySerializer


# =============================================================================
# ANALYTICS VIEWS
# =============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profitability_analysis(request):
    """
    Profitability analysis from packinghouse settlements.

    Shows the breakdown of revenue and costs from packinghouse statements.
    Note: Pick & haul costs are already included in settlement deductions,
    so Net Settlement represents the grower's actual return after all
    packinghouse-related costs.

    Strategy: Since settlements may be at pool level (field=None), we allocate
    settlement returns to fields proportionally based on their delivery bins.

    Query params:
    - season: Filter by season (e.g., "2024-2025")
    - field_id: Filter by specific field
    - packinghouse: Filter by packinghouse ID

    Returns per-field breakdown:
    - gross_revenue: Total credits from packinghouse (fruit sales)
    - total_deductions: All packinghouse charges (packing, pick/haul, assessments, etc.)
    - net_settlement: Grower's actual return (gross - deductions)
    - net_per_bin: Return per bin delivered
    """
    from django.db.models import Sum, Avg, Count
    from django.db.models.functions import Coalesce
    from .models import HarvestLabor, Harvest, PoolSettlement, Field, PackinghouseDelivery
    from datetime import date
    from decimal import Decimal
    from collections import defaultdict

    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    company = user.current_company

    # Get available seasons (only those with settlement data)
    seasons_with_settlements = PoolSettlement.objects.filter(
        pool__packinghouse__company=company,
        field__isnull=True  # Grower summary settlements
    ).values_list('pool__season', flat=True).distinct()
    seasons_with_settlements = set(seasons_with_settlements)

    # Get all seasons from pools
    all_seasons = Pool.objects.filter(
        packinghouse__company=company
    ).values_list('season', flat=True).distinct().order_by('-season')
    available_seasons = list(all_seasons)

    # Get current/default season using SeasonService (citrus default for packinghouse)
    today = date.today()
    current_season = get_citrus_season(today)
    default_season = current_season.label

    selected_season = request.query_params.get('season') or ''

    # If no season specified or empty, prefer seasons with settlement data
    if not selected_season:
        # First, try to find a season with settlement data
        for season in available_seasons:
            if season in seasons_with_settlements:
                selected_season = season
                break
        # If none found, fall back to default
        if not selected_season:
            selected_season = default_season

    # If selected season not in available seasons and we have data, use the most recent with settlements
    if selected_season not in available_seasons and available_seasons:
        for season in available_seasons:
            if season in seasons_with_settlements:
                selected_season = season
                break
        if selected_season not in available_seasons:
            selected_season = available_seasons[0]

    # Calculate season date range for harvest filtering using SeasonService
    try:
        season_start, season_end = parse_legacy_season(selected_season)
    except (ValueError, IndexError):
        season_start = current_season.start_date
        season_end = current_season.end_date

    # Base filters
    packinghouse_id = request.query_params.get('packinghouse')
    field_id = request.query_params.get('field_id')

    # =========================================================================
    # STEP 1: Get all pools with settlements for this season
    # =========================================================================
    pool_filters = Q(
        packinghouse__company=company,
        season=selected_season
    )
    if packinghouse_id:
        pool_filters &= Q(packinghouse_id=packinghouse_id)

    pools = Pool.objects.filter(pool_filters).select_related('packinghouse')

    # Get pool-level settlements (grower summaries where field=None)
    pool_settlement_data = {}
    for pool in pools:
        settlement = PoolSettlement.objects.filter(
            pool=pool,
            field__isnull=True  # Grower summary level
        ).first()

        if settlement:
            pool_settlement_data[pool.id] = {
                'pool': pool,
                'total_bins': settlement.total_bins or Decimal('0'),
                'total_credits': settlement.total_credits or Decimal('0'),
                'total_deductions': settlement.total_deductions or Decimal('0'),
                'net_return': settlement.net_return or Decimal('0'),
                'net_per_bin': settlement.net_per_bin or Decimal('0'),
            }

    # =========================================================================
    # STEP 2: Get deliveries grouped by field and pool
    # =========================================================================
    delivery_filters = Q(
        pool__packinghouse__company=company,
        pool__season=selected_season
    )
    if packinghouse_id:
        delivery_filters &= Q(pool__packinghouse_id=packinghouse_id)
    if field_id:
        delivery_filters &= Q(field_id=field_id)

    deliveries = PackinghouseDelivery.objects.filter(
        delivery_filters
    ).select_related('field', 'field__farm', 'pool', 'pool__packinghouse')

    # Aggregate deliveries by field
    field_deliveries = defaultdict(lambda: {
        'field': None,
        'bins_delivered': Decimal('0'),
        'delivery_count': 0,
        'pools': set(),
        'pool_bins': defaultdict(lambda: Decimal('0')),  # bins per pool
    })

    for delivery in deliveries:
        if delivery.field:
            fd = field_deliveries[delivery.field_id]
            fd['field'] = delivery.field
            fd['bins_delivered'] += delivery.bins or Decimal('0')
            fd['delivery_count'] += 1
            fd['pools'].add(delivery.pool_id)
            fd['pool_bins'][delivery.pool_id] += delivery.bins or Decimal('0')

    # =========================================================================
    # STEP 3: Calculate profitability per field
    # =========================================================================
    results = []
    totals = {
        'total_bins': Decimal('0'),
        'gross_revenue': Decimal('0'),
        'total_deductions': Decimal('0'),
        'net_settlement': Decimal('0'),
    }

    for field_id_key, fd in field_deliveries.items():
        field = fd['field']
        if not field:
            continue

        bins_delivered = fd['bins_delivered']
        if bins_delivered <= 0:
            continue

        # Allocate settlement returns from each pool based on delivery proportion
        allocated_credits = Decimal('0')
        allocated_deductions = Decimal('0')
        allocated_net = Decimal('0')
        packinghouse_names = set()
        pool_names = set()

        for pool_id in fd['pools']:
            if pool_id in pool_settlement_data:
                psd = pool_settlement_data[pool_id]
                pool_total_bins = psd['total_bins']

                if pool_total_bins > 0:
                    # Calculate this field's share of the pool
                    field_pool_bins = fd['pool_bins'][pool_id]
                    share_ratio = field_pool_bins / pool_total_bins

                    allocated_credits += psd['total_credits'] * share_ratio
                    allocated_deductions += psd['total_deductions'] * share_ratio
                    allocated_net += psd['net_return'] * share_ratio

                packinghouse_names.add(psd['pool'].packinghouse.name)
                pool_names.add(psd['pool'].name)

        # Calculate per-bin metrics
        gross_per_bin = (allocated_credits / bins_delivered) if bins_delivered > 0 else Decimal('0')
        deductions_per_bin = (allocated_deductions / bins_delivered) if bins_delivered > 0 else Decimal('0')
        net_per_bin = (allocated_net / bins_delivered) if bins_delivered > 0 else Decimal('0')

        # Calculate margin (net as % of gross)
        margin_percent = round((float(allocated_net) / float(allocated_credits) * 100), 1) if allocated_credits > 0 else 0

        field_data = {
            'field_id': field.id,
            'field_name': field.name,
            'farm_id': field.farm.id if field.farm else None,
            'farm_name': field.farm.name if field.farm else '',
            'packinghouse_name': ', '.join(packinghouse_names) if packinghouse_names else '',
            'pool_name': ', '.join(pool_names) if pool_names else '',

            # Quantities
            'total_bins': float(bins_delivered),
            'bins_delivered': float(bins_delivered),
            'delivery_count': fd['delivery_count'],

            # Revenue breakdown (allocated from pool settlements)
            # Note: Deductions already include pick & haul, so net_settlement is the true return
            'gross_revenue': float(allocated_credits),
            'total_deductions': float(allocated_deductions),
            'net_settlement': float(allocated_net),

            # Per-bin metrics
            'gross_per_bin': round(float(gross_per_bin), 2),
            'deductions_per_bin': round(float(deductions_per_bin), 2),
            'net_per_bin': round(float(net_per_bin), 2),

            # Return metrics
            'return_margin': margin_percent,  # Net as % of gross
        }

        results.append(field_data)

        # Update totals
        totals['total_bins'] += bins_delivered
        totals['gross_revenue'] += allocated_credits
        totals['total_deductions'] += allocated_deductions
        totals['net_settlement'] += allocated_net

    # Sort by net settlement descending (highest returns first)
    results.sort(key=lambda x: x['net_settlement'], reverse=True)

    # =========================================================================
    # STEP 4: If no field-level results, show pool-level summary
    # =========================================================================
    pool_results = []
    if not results and pool_settlement_data:
        # No deliveries to allocate, show pool-level data
        for pool_id, psd in pool_settlement_data.items():
            pool = psd['pool']

            pool_bins = psd['total_bins']
            pool_gross = psd['total_credits']
            pool_deductions = psd['total_deductions']
            pool_net = psd['net_return']

            # Calculate margin (net as % of gross)
            margin_percent = round((float(pool_net) / float(pool_gross) * 100), 1) if pool_gross > 0 else 0

            pool_results.append({
                'pool_id': pool.id,
                'pool_name': pool.name,
                'packinghouse_name': pool.packinghouse.name,
                'commodity': pool.commodity,

                'total_bins': float(pool_bins),
                'gross_revenue': float(pool_gross),
                'total_deductions': float(pool_deductions),
                'net_settlement': float(pool_net),

                'gross_per_bin': round(float(pool_gross / pool_bins), 2) if pool_bins > 0 else 0,
                'deductions_per_bin': round(float(pool_deductions / pool_bins), 2) if pool_bins > 0 else 0,
                'net_per_bin': float(psd['net_per_bin']),
                'return_margin': margin_percent,
            })

            # Update totals
            totals['total_bins'] += pool_bins
            totals['gross_revenue'] += pool_gross
            totals['total_deductions'] += pool_deductions
            totals['net_settlement'] += pool_net

    # Calculate summary metrics
    # Note: net_settlement is the grower's return after all deductions (including pick & haul)
    return_margin = round((float(totals['net_settlement']) / float(totals['gross_revenue']) * 100), 1) if totals['gross_revenue'] > 0 else 0

    summary = {
        'total_fields': len(results),
        'total_pools': len(pool_results),
        'total_bins': float(totals['total_bins']),
        'gross_revenue': float(totals['gross_revenue']),
        'total_deductions': float(totals['total_deductions']),
        'net_settlement': float(totals['net_settlement']),
        'avg_net_per_bin': round(float(totals['net_settlement'] / totals['total_bins']), 2) if totals['total_bins'] > 0 else 0,
        'return_margin': return_margin,  # Net as % of gross
    }

    # Note if showing pool-level vs field-level
    data_level = 'field' if results else ('pool' if pool_results else 'none')

    return Response({
        'season': selected_season,
        'available_seasons': available_seasons,
        'data_level': data_level,
        'summary': summary,
        'by_field': results,
        'by_pool': pool_results,
        'message': 'Showing pool-level data. Add delivery records to see field-level profitability.' if data_level == 'pool' else None,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def deduction_breakdown(request):
    """
    Detailed breakdown of packinghouse deductions by category.

    Shows all charges grouped by category with per-bin rates
    to help identify cost drivers.

    Query params:
    - season: Filter by season (e.g., "2024-2025")
    - field_id: Filter by specific field
    - packinghouse: Filter by packinghouse ID
    """
    from .models import SettlementDeduction, PoolSettlement
    from datetime import date
    from decimal import Decimal
    from collections import defaultdict

    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    company = user.current_company

    # Get seasons with settlement data
    seasons_with_settlements = PoolSettlement.objects.filter(
        pool__packinghouse__company=company
    ).values_list('pool__season', flat=True).distinct()
    seasons_with_settlements = list(set(seasons_with_settlements))
    seasons_with_settlements.sort(reverse=True)

    # Get current/default season using SeasonService
    today = date.today()
    current_season = get_citrus_season(today)
    default_season = current_season.label

    selected_season = request.query_params.get('season') or ''

    # If no season specified, use the most recent with settlement data
    if not selected_season:
        if seasons_with_settlements:
            selected_season = seasons_with_settlements[0]
        else:
            selected_season = default_season

    packinghouse_id = request.query_params.get('packinghouse')
    field_id = request.query_params.get('field_id')

    # Build settlement filter
    settlement_filters = Q(
        pool__packinghouse__company=company,
        pool__season=selected_season
    )
    if packinghouse_id:
        settlement_filters &= Q(pool__packinghouse_id=packinghouse_id)
    if field_id:
        settlement_filters &= Q(field_id=field_id)

    settlements = PoolSettlement.objects.filter(settlement_filters)
    settlement_ids = settlements.values_list('id', flat=True)

    # Get total bins for percentage calculations
    total_bins = settlements.aggregate(
        total=Coalesce(Sum('total_bins'), Decimal('0'))
    )['total']

    # Get all deductions
    deductions = SettlementDeduction.objects.filter(
        settlement_id__in=settlement_ids
    )

    # Group by category
    category_totals = defaultdict(lambda: {
        'total_amount': Decimal('0'),
        'items': defaultdict(lambda: {'amount': Decimal('0'), 'count': 0})
    })

    for ded in deductions:
        category = ded.category
        description = ded.description
        amount = ded.amount or Decimal('0')

        category_totals[category]['total_amount'] += amount
        category_totals[category]['items'][description]['amount'] += amount
        category_totals[category]['items'][description]['count'] += 1

    # Format response
    by_category = []
    grand_total = Decimal('0')

    category_order = ['packing', 'assessment', 'pick_haul', 'capital', 'marketing', 'other']
    category_labels = {
        'packing': 'Packing Charges',
        'assessment': 'Assessments',
        'pick_haul': 'Pick & Haul',
        'capital': 'Capital Funds',
        'marketing': 'Marketing',
        'other': 'Other',
    }

    for category in category_order:
        if category in category_totals:
            cat_data = category_totals[category]
            cat_total = cat_data['total_amount']
            grand_total += cat_total

            items = []
            for desc, item_data in cat_data['items'].items():
                items.append({
                    'description': desc,
                    'amount': float(item_data['amount']),
                    'per_bin': round(float(item_data['amount'] / total_bins), 4) if total_bins > 0 else 0,
                    'count': item_data['count'],
                })

            # Sort items by amount descending
            items.sort(key=lambda x: x['amount'], reverse=True)

            by_category.append({
                'category': category,
                'label': category_labels.get(category, category),
                'total_amount': float(cat_total),
                'per_bin': round(float(cat_total / total_bins), 2) if total_bins > 0 else 0,
                'percent_of_total': round((float(cat_total) / float(grand_total) * 100), 1) if grand_total > 0 else 0,
                'items': items,
            })

    # Recalculate percent_of_total now that we have grand_total
    for cat in by_category:
        if grand_total > 0:
            cat['percent_of_total'] = round((cat['total_amount'] / float(grand_total) * 100), 1)

    return Response({
        'season': selected_season,
        'total_bins': float(total_bins),
        'grand_total': float(grand_total),
        'grand_total_per_bin': round(float(grand_total / total_bins), 2) if total_bins > 0 else 0,
        'by_category': by_category,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def season_comparison(request):
    """
    Year-over-year comparison of profitability metrics.

    Shows trends across seasons for revenue, deductions, and net returns.
    Note: Pick & haul costs are already included in settlement deductions,
    so Net Settlement represents the grower's actual return.

    Query params:
    - field_id: Filter by specific field (optional)
    - packinghouse: Filter by packinghouse ID (optional)
    """
    from .models import PoolSettlement
    from decimal import Decimal

    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    company = user.current_company

    packinghouse_id = request.query_params.get('packinghouse')
    field_id = request.query_params.get('field_id')

    # Get all available seasons
    available_seasons = Pool.objects.filter(
        packinghouse__company=company
    ).values_list('season', flat=True).distinct().order_by('-season')
    available_seasons = list(available_seasons)

    results = []

    for season in available_seasons:
        # Settlement filters
        settlement_filters = Q(
            pool__packinghouse__company=company,
            pool__season=season
        )
        if packinghouse_id:
            settlement_filters &= Q(pool__packinghouse_id=packinghouse_id)
        if field_id:
            settlement_filters &= Q(field_id=field_id)

        # Get settlement data
        settlements = PoolSettlement.objects.filter(settlement_filters)
        settlement_agg = settlements.aggregate(
            total_bins=Coalesce(Sum('total_bins'), Decimal('0')),
            gross_revenue=Coalesce(Sum('total_credits'), Decimal('0')),
            total_deductions=Coalesce(Sum('total_deductions'), Decimal('0')),
            net_settlement=Coalesce(Sum('net_return'), Decimal('0')),
        )

        # Calculate metrics
        total_bins = settlement_agg['total_bins'] or Decimal('0')
        gross_revenue = settlement_agg['gross_revenue'] or Decimal('0')
        total_deductions = settlement_agg['total_deductions'] or Decimal('0')
        net_settlement = settlement_agg['net_settlement'] or Decimal('0')

        if total_bins > 0:
            # Calculate return margin (net as % of gross)
            return_margin = round((float(net_settlement) / float(gross_revenue) * 100), 1) if gross_revenue > 0 else 0

            results.append({
                'season': season,
                'total_bins': float(total_bins),
                'gross_revenue': float(gross_revenue),
                'total_deductions': float(total_deductions),
                'net_settlement': float(net_settlement),

                # Per-bin metrics
                'gross_per_bin': round(float(gross_revenue / total_bins), 2),
                'deductions_per_bin': round(float(total_deductions / total_bins), 2),
                'net_per_bin': round(float(net_settlement / total_bins), 2),

                # Return margin (net as % of gross)
                'return_margin': return_margin,
            })

    # Calculate year-over-year changes
    for i in range(len(results) - 1):
        current = results[i]
        previous = results[i + 1]

        if previous['net_per_bin'] != 0:
            current['net_per_bin_change'] = round(
                ((current['net_per_bin'] - previous['net_per_bin']) / abs(previous['net_per_bin'])) * 100, 1
            )
        else:
            current['net_per_bin_change'] = None

        if previous['total_bins'] != 0:
            current['volume_change'] = round(
                ((current['total_bins'] - previous['total_bins']) / previous['total_bins']) * 100, 1
            )
        else:
            current['volume_change'] = None

    return Response({
        'seasons': results,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def block_performance(request):
    """
    Compare pack percentages and returns across blocks.

    Query params:
    - season: Filter by season (e.g., "2024-2025")
    - packinghouse: Filter by packinghouse ID
    - commodity: Filter by commodity
    """
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    # Base filter
    filters = Q(pool__packinghouse__company=user.current_company)

    # Apply filters
    season = request.query_params.get('season')
    if season:
        filters &= Q(pool__season=season)

    packinghouse_id = request.query_params.get('packinghouse')
    if packinghouse_id:
        filters &= Q(pool__packinghouse_id=packinghouse_id)

    commodity = request.query_params.get('commodity')
    if commodity:
        filters &= Q(pool__commodity__icontains=commodity)

    # Get latest packout report per field
    from django.db.models import Max
    latest_reports = PackoutReport.objects.filter(
        filters
    ).values('field').annotate(
        latest_date=Max('report_date')
    )

    results = []
    for item in latest_reports:
        report = PackoutReport.objects.filter(
            field_id=item['field'],
            report_date=item['latest_date']
        ).select_related('field', 'pool').first()

        if report:
            # Check for settlement
            settlement = PoolSettlement.objects.filter(
                pool=report.pool,
                field=report.field
            ).order_by('-statement_date').first()

            pack_variance = None
            if report.total_packed_percent and report.house_avg_packed_percent:
                pack_variance = float(report.total_packed_percent - report.house_avg_packed_percent)

            return_variance = None
            net_per_bin = None
            house_avg_per_bin = None
            if settlement:
                net_per_bin = settlement.net_per_bin
                house_avg_per_bin = settlement.house_avg_per_bin
                if net_per_bin and house_avg_per_bin:
                    return_variance = float(net_per_bin - house_avg_per_bin)

            results.append({
                'field_id': report.field.id,
                'field_name': report.field.name,
                'pool_name': report.pool.name,
                'total_bins': report.bins_cumulative,
                'pack_percent': report.total_packed_percent,
                'house_avg_pack_percent': report.house_avg_packed_percent,
                'pack_variance': pack_variance,
                'net_per_bin': net_per_bin,
                'house_avg_per_bin': house_avg_per_bin,
                'return_variance': return_variance,
            })

    serializer = BlockPerformanceSerializer(results, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def packout_trends(request):
    """
    Get packout percentage trends over time.

    Query params:
    - field: Filter by field ID
    - pool: Filter by pool ID
    - start_date: Start date for range
    - end_date: End date for range
    """
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    queryset = PackoutReport.objects.filter(
        pool__packinghouse__company=user.current_company
    ).select_related('field', 'pool')

    # Apply filters
    field_id = request.query_params.get('field')
    if field_id:
        queryset = queryset.filter(field_id=field_id)

    pool_id = request.query_params.get('pool')
    if pool_id:
        queryset = queryset.filter(pool_id=pool_id)

    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    if start_date:
        queryset = queryset.filter(report_date__gte=start_date)
    if end_date:
        queryset = queryset.filter(report_date__lte=end_date)

    queryset = queryset.order_by('report_date')

    results = []
    for report in queryset:
        results.append({
            'report_date': report.report_date,
            'field_name': report.field.name,
            'total_packed_percent': report.total_packed_percent,
            'house_avg_packed_percent': report.house_avg_packed_percent,
        })

    serializer = PackoutTrendSerializer(results, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def settlement_comparison(request):
    """
    Compare returns across packinghouses for the same commodity/season.

    Query params:
    - season: Filter by season (required)
    - commodity: Filter by commodity
    """
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    season = request.query_params.get('season')
    if not season:
        return Response({'error': 'Season parameter required'}, status=400)

    filters = Q(
        pool__packinghouse__company=user.current_company,
        pool__season=season,
        field__isnull=True  # Grower-level summaries only
    )

    commodity = request.query_params.get('commodity')
    if commodity:
        filters &= Q(pool__commodity__icontains=commodity)

    settlements = PoolSettlement.objects.filter(
        filters
    ).select_related('pool', 'pool__packinghouse')

    results = []
    for settlement in settlements:
        results.append({
            'packinghouse_id': settlement.pool.packinghouse.id,
            'packinghouse_name': settlement.pool.packinghouse.name,
            'season': settlement.pool.season,
            'commodity': settlement.pool.commodity,
            'total_bins': settlement.total_bins,
            'net_return': settlement.net_return,
            'net_per_bin': settlement.net_per_bin,
            'fresh_fruit_percent': settlement.fresh_fruit_percent,
        })

    serializer = SettlementComparisonSerializer(results, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def size_distribution(request):
    """
    Fruit size distribution across farms/fields from packout (wash) reports.

    Query params:
    - season: Filter by season (e.g., "2024-2025")
    - packinghouse: Filter by packinghouse ID
    - commodity: Filter by commodity
    - group_by: "farm" (default) or "field"
    """
    from django.db.models import Max
    from collections import defaultdict

    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    group_by = request.query_params.get('group_by', 'farm')

    # Base filter
    filters = Q(pool__packinghouse__company=user.current_company)

    season = request.query_params.get('season')
    if season:
        filters &= Q(pool__season=season)

    packinghouse_id = request.query_params.get('packinghouse')
    if packinghouse_id:
        filters &= Q(pool__packinghouse_id=packinghouse_id)

    commodity = request.query_params.get('commodity')
    if commodity:
        filters &= Q(pool__commodity__icontains=commodity)

    # Get latest packout report per field (including null field)
    # Reports with field assigned
    latest_with_field = PackoutReport.objects.filter(
        filters,
        field__isnull=False
    ).values('field').annotate(
        latest_date=Max('report_date')
    )

    # Reports without field — group by pool instead
    latest_without_field = PackoutReport.objects.filter(
        filters,
        field__isnull=True
    ).values('pool').annotate(
        latest_date=Max('report_date')
    )

    # Collect grade lines grouped by farm or field
    groups = defaultdict(lambda: {'total_quantity': Decimal('0'), 'sizes': defaultdict(lambda: {
        'quantity': Decimal('0'),
        'percent_sum': Decimal('0'),
        'house_avg_sum': Decimal('0'),
        'count': 0,
        'house_avg_count': 0,
    })})
    all_sizes = set()

    def process_report(report):
        grade_lines = PackoutGradeLine.objects.filter(
            packout_report=report
        ).exclude(size='')

        if not grade_lines.exists():
            return

        if report.field:
            if group_by == 'farm' and report.field.farm:
                gid = report.field.farm_id
                gname = report.field.farm.name
            else:
                gid = report.field.id
                gname = report.field.name
        else:
            # No field — use pool as the group
            gid = f'pool_{report.pool_id}'
            gname = report.pool.name if report.pool else 'Unassigned'

        for line in grade_lines:
            qty = line.quantity_cumulative if line.quantity_cumulative is not None else line.quantity_this_period
            pct = line.percent_cumulative if line.percent_cumulative is not None else line.percent_this_period

            all_sizes.add(line.size)
            size_data = groups[gid]['sizes'][line.size]
            size_data['quantity'] += qty
            size_data['percent_sum'] += pct
            size_data['count'] += 1
            if line.house_avg_percent is not None:
                size_data['house_avg_sum'] += line.house_avg_percent
                size_data['house_avg_count'] += 1

            groups[gid]['total_quantity'] += qty
            groups[gid]['group_id'] = gid if isinstance(gid, int) else 0
            groups[gid]['group_name'] = gname

    for item in latest_with_field:
        report = PackoutReport.objects.filter(
            field_id=item['field'],
            report_date=item['latest_date']
        ).select_related('field__farm', 'pool').first()
        if report:
            process_report(report)

    for item in latest_without_field:
        report = PackoutReport.objects.filter(
            pool_id=item['pool'],
            field__isnull=True,
            report_date=item['latest_date']
        ).select_related('pool').first()
        if report:
            process_report(report)

    # Build response
    results = []
    for group_key, group_data in groups.items():
        total_qty = group_data['total_quantity']
        sizes = []
        for size_code, size_data in sorted(group_data['sizes'].items(), key=lambda x: int(x[0]) if x[0].isdigit() else 999):
            pct = (size_data['quantity'] / total_qty * 100) if total_qty else Decimal('0')
            house_avg = None
            if size_data['house_avg_count'] > 0:
                house_avg = size_data['house_avg_sum'] / size_data['house_avg_count']
            sizes.append({
                'size': size_code,
                'quantity': size_data['quantity'],
                'percent': round(pct, 2),
                'house_avg_percent': round(house_avg, 2) if house_avg is not None else None,
            })
        results.append({
            'group_id': group_data['group_id'],
            'group_name': group_data['group_name'],
            'total_quantity': total_qty,
            'sizes': sizes,
        })

    results.sort(key=lambda x: x['group_name'])

    sorted_sizes = sorted(all_sizes, key=lambda x: int(x) if x.isdigit() else 999)

    return Response({
        'groups': SizeDistributionGroupSerializer(results, many=True).data,
        'all_sizes': sorted_sizes,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def size_pricing(request):
    """
    FOB pricing and revenue by fruit size from settlement grade lines.

    Query params:
    - season: Filter by season (e.g., "2024-2025")
    - packinghouse: Filter by packinghouse ID
    - commodity: Filter by commodity
    - group_by: "none" (default), "farm", or "field"
    """
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    group_by = request.query_params.get('group_by', 'none')

    # Base filter
    filters = Q(settlement__pool__packinghouse__company=user.current_company)

    season = request.query_params.get('season')
    if season:
        filters &= Q(settlement__pool__season=season)

    packinghouse_id = request.query_params.get('packinghouse')
    if packinghouse_id:
        filters &= Q(settlement__pool__packinghouse_id=packinghouse_id)

    commodity = request.query_params.get('commodity')
    if commodity:
        filters &= Q(settlement__pool__commodity__icontains=commodity)

    grade_lines = SettlementGradeLine.objects.filter(
        filters
    ).exclude(size='').select_related(
        'settlement__field__farm',
        'settlement__pool'
    )

    # Aggregate by size
    from collections import defaultdict

    size_totals = defaultdict(lambda: {
        'total_quantity': Decimal('0'),
        'total_revenue': Decimal('0'),
        'by_farm': defaultdict(lambda: {
            'farm_name': '',
            'quantity': Decimal('0'),
            'revenue': Decimal('0'),
        }),
    })

    grand_total_qty = Decimal('0')
    grand_total_rev = Decimal('0')

    for line in grade_lines:
        s = size_totals[line.size]
        s['total_quantity'] += line.quantity
        s['total_revenue'] += line.total_amount
        grand_total_qty += line.quantity
        grand_total_rev += line.total_amount

        if group_by in ('farm', 'field') and line.settlement.field:
            if group_by == 'farm':
                key = line.settlement.field.farm_id
                name = line.settlement.field.farm.name
            else:
                key = line.settlement.field.id
                name = line.settlement.field.name
            farm_data = s['by_farm'][key]
            farm_data['farm_name'] = name
            farm_data['quantity'] += line.quantity
            farm_data['revenue'] += line.total_amount

    # Build response
    results = []
    for size_code in sorted(size_totals.keys(), key=lambda x: int(x) if x.isdigit() else 999):
        s = size_totals[size_code]
        weighted_avg_fob = (s['total_revenue'] / s['total_quantity']) if s['total_quantity'] else None
        pct_qty = (s['total_quantity'] / grand_total_qty * 100) if grand_total_qty else Decimal('0')
        pct_rev = (s['total_revenue'] / grand_total_rev * 100) if grand_total_rev else Decimal('0')

        entry = {
            'size': size_code,
            'total_quantity': s['total_quantity'],
            'total_revenue': s['total_revenue'],
            'weighted_avg_fob': round(weighted_avg_fob, 2) if weighted_avg_fob else None,
            'percent_of_total_quantity': round(pct_qty, 1),
            'percent_of_total_revenue': round(pct_rev, 1),
        }

        if group_by in ('farm', 'field'):
            entry['by_farm'] = sorted([
                {
                    'farm_name': fd['farm_name'],
                    'quantity': fd['quantity'],
                    'revenue': fd['revenue'],
                    'avg_fob': round(fd['revenue'] / fd['quantity'], 2) if fd['quantity'] else None,
                }
                for fd in s['by_farm'].values()
            ], key=lambda x: x['farm_name'])

        results.append(entry)

    overall_avg_fob = (grand_total_rev / grand_total_qty) if grand_total_qty else None

    return Response({
        'sizes': SizePricingEntrySerializer(results, many=True).data,
        'totals': {
            'total_quantity': grand_total_qty,
            'total_revenue': grand_total_rev,
            'overall_avg_fob': round(overall_avg_fob, 2) if overall_avg_fob else None,
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def packinghouse_dashboard(request):
    """
    Get dashboard summary for packinghouse module.

    Query params:
    - season: Optional season filter (e.g., "2024-2025"). Defaults to current season.

    Returns:
    - Active pools count
    - Total bins delivered this season
    - Pending settlements count
    - Recent deliveries
    - Recent packout reports
    - Available seasons for dropdown
    """
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    company = user.current_company

    # Get available seasons from pools
    available_seasons = Pool.objects.filter(
        packinghouse__company=company
    ).values_list('season', flat=True).distinct().order_by('-season')
    available_seasons = list(available_seasons)

    # Get selected season from query params or default to current
    from datetime import date
    today = date.today()
    current_season = get_citrus_season(today)
    default_season = current_season.label

    selected_season = request.query_params.get('season', default_season)

    # If selected season not in available seasons and we have data, use the most recent
    if selected_season not in available_seasons and available_seasons:
        selected_season = available_seasons[0]

    # Active pools for selected season
    active_pools = Pool.objects.filter(
        packinghouse__company=company,
        status='active',
        season=selected_season
    ).count()

    # Total pools for selected season
    total_pools = Pool.objects.filter(
        packinghouse__company=company,
        season=selected_season
    ).count()

    # Total bins this season
    total_bins = PackinghouseDelivery.objects.filter(
        pool__packinghouse__company=company,
        pool__season=selected_season
    ).aggregate(total=Coalesce(Sum('bins'), Decimal('0')))['total']

    # Pools pending settlement for selected season
    pending_settlement = Pool.objects.filter(
        packinghouse__company=company,
        status='closed',
        season=selected_season
    ).exclude(
        settlements__isnull=False
    ).count()

    # Recent deliveries for selected season (last 5)
    recent_deliveries = PackinghouseDelivery.objects.filter(
        pool__packinghouse__company=company,
        pool__season=selected_season
    ).select_related('pool', 'field').order_by('-delivery_date', '-created_at')[:5]

    # Recent packout reports for selected season (last 5)
    recent_packouts = PackoutReport.objects.filter(
        pool__packinghouse__company=company,
        pool__season=selected_season
    ).select_related('pool', 'field').order_by('-report_date')[:5]

    # Packinghouse breakdown for selected season
    packinghouse_summary = Packinghouse.objects.filter(
        company=company,
        is_active=True
    ).annotate(
        active_pools=Count('pools', filter=Q(pools__status='active', pools__season=selected_season)),
        total_pools=Count('pools', filter=Q(pools__season=selected_season)),
        season_bins=Coalesce(
            Sum('pools__deliveries__bins', filter=Q(pools__season=selected_season)),
            Decimal('0')
        ),
        total_settlements=Coalesce(
            Sum('pools__settlements__net_return', filter=Q(pools__season=selected_season)),
            Decimal('0')
        )
    ).values('id', 'name', 'short_code', 'active_pools', 'total_pools', 'season_bins', 'total_settlements')

    return Response({
        'selected_season': selected_season,
        'available_seasons': available_seasons,
        'active_pools': active_pools,
        'total_pools': total_pools,
        'total_bins_this_season': total_bins,
        'pending_settlement': pending_settlement,
        'recent_deliveries': PackinghouseDeliveryListSerializer(recent_deliveries, many=True).data,
        'recent_packouts': PackoutReportListSerializer(recent_packouts, many=True).data,
        'packinghouse_summary': list(packinghouse_summary),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def harvest_packing_pipeline(request):
    """
    Get unified pipeline overview: Harvest → Delivery → Packout → Settlement.

    Query params:
    - commodity: Optional commodity filter (e.g., "LEMONS"). If omitted, returns
      all-commodities summary with per-commodity cards.
    - season: Optional season filter (e.g., "2024-2025"). Only used when commodity
      is specified. Defaults to the current season for that commodity's crop type.
    - breakdown: Optional breakdown type ('farm'). Only used when commodity is specified.

    Shows the complete flow of fruit from field to payment.
    """
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    company = user.current_company
    from datetime import date, timedelta
    today = date.today()

    selected_commodity = request.query_params.get('commodity', None)

    # =========================================================================
    # MODE A: ALL COMMODITIES OVERVIEW
    # Shows summary tiles + per-commodity cards, each with its own current season
    # =========================================================================
    if not selected_commodity:
        # Get all distinct commodities from this company's pools
        commodities = list(
            Pool.objects.filter(
                packinghouse__company=company
            ).values_list('commodity', flat=True).distinct().order_by('commodity')
        )

        # Batch query: packout stats by commodity + season
        packout_by_cs = PackoutReport.objects.filter(
            pool__packinghouse__company=company
        ).values('pool__commodity', 'pool__season').annotate(
            total_bins_packed=Coalesce(Sum('bins_this_period'), Decimal('0')),
            avg_pack_percent=Avg('total_packed_percent'),
            report_count=Count('id'),
        )

        # Batch query: settlement stats by commodity + season
        settlement_by_cs = PoolSettlement.objects.filter(
            pool__packinghouse__company=company
        ).values('pool__commodity', 'pool__season').annotate(
            total_bins_settled=Coalesce(Sum('total_bins'), Decimal('0')),
            total_revenue=Coalesce(Sum('net_return'), Decimal('0')),
            avg_per_bin=Avg('net_per_bin'),
            settlement_count=Count('id'),
        )

        # Batch query: pool status by commodity + season
        pool_status_by_cs = Pool.objects.filter(
            packinghouse__company=company
        ).values('commodity', 'season', 'status').annotate(count=Count('id'))

        # Build per-commodity cards
        commodity_cards = []
        total_revenue = Decimal('0')
        total_bins_packed = Decimal('0')
        total_bins_settled = Decimal('0')

        for commodity in commodities:
            if not commodity:
                continue

            # Determine current season for this commodity
            crop_category = get_crop_category_for_commodity(commodity)
            season_service = SeasonService(company_id=company.id)
            current = season_service.get_current_season(crop_category=crop_category, target_date=today)
            current_season_label = current.label

            # Filter batch data for this commodity + its current season
            bins_packed = Decimal('0')
            avg_pack = 0
            packout_count = 0
            for row in packout_by_cs:
                if row['pool__commodity'] == commodity and row['pool__season'] == current_season_label:
                    bins_packed = row['total_bins_packed']
                    avg_pack = round(float(row['avg_pack_percent'] or 0), 1)
                    packout_count = row['report_count']

            bins_settled = Decimal('0')
            revenue = Decimal('0')
            avg_per_bin = 0
            settlement_count = 0
            for row in settlement_by_cs:
                if row['pool__commodity'] == commodity and row['pool__season'] == current_season_label:
                    bins_settled = row['total_bins_settled']
                    revenue = row['total_revenue']
                    avg_per_bin = round(float(row['avg_per_bin'] or 0), 2)
                    settlement_count = row['settlement_count']

            pools = {}
            for row in pool_status_by_cs:
                if row['commodity'] == commodity and row['season'] == current_season_label:
                    pools[row['status']] = row['count']

            packed_f = float(bins_packed)
            settled_f = float(bins_settled)
            settlement_pct = round((settled_f / packed_f * 100), 1) if packed_f > 0 else 0

            commodity_cards.append({
                'commodity': commodity,
                'crop_category': crop_category,
                'current_season': current_season_label,
                'bins_packed': packed_f,
                'avg_pack_percent': avg_pack,
                'bins_settled': settled_f,
                'settlement_percent': settlement_pct,
                'revenue': float(revenue),
                'avg_per_bin': avg_per_bin,
                'packout_reports': packout_count,
                'settlements': settlement_count,
                'pools': {
                    'active': pools.get('active', 0),
                    'closed': pools.get('closed', 0),
                    'settled': pools.get('settled', 0),
                },
            })

            total_revenue += revenue
            total_bins_packed += bins_packed
            total_bins_settled += bins_settled

        # Sort by revenue descending
        commodity_cards.sort(key=lambda x: x['revenue'], reverse=True)

        total_packed_f = float(total_bins_packed)
        total_settled_f = float(total_bins_settled)

        return Response({
            'mode': 'all_commodities',
            'available_commodities': commodities,
            'summary': {
                'total_revenue': float(total_revenue),
                'total_bins_packed': total_packed_f,
                'total_bins_settled': total_settled_f,
                'settlement_percent': round((total_settled_f / total_packed_f * 100), 1) if total_packed_f > 0 else 0,
                'total_pools': Pool.objects.filter(packinghouse__company=company).count(),
            },
            'commodity_cards': commodity_cards,
        })

    # =========================================================================
    # MODE B: SPECIFIC COMMODITY
    # Shows season dropdown + pipeline flow filtered to one commodity
    # =========================================================================

    # Determine crop category and season config for this commodity
    crop_category = get_crop_category_for_commodity(selected_commodity)
    season_service = SeasonService(company_id=company.id)

    # Get available seasons from pools for this commodity only
    available_seasons = list(
        Pool.objects.filter(
            packinghouse__company=company,
            commodity__iexact=selected_commodity
        ).values_list('season', flat=True).distinct().order_by('-season')
    )

    # Determine default season using correct crop category
    current_season = season_service.get_current_season(crop_category=crop_category, target_date=today)
    default_season = current_season.label

    # Get selected season from query params
    selected_season = request.query_params.get('season', default_season)

    # If selected season not in available seasons and we have data, use the most recent
    if selected_season not in available_seasons and available_seasons:
        selected_season = available_seasons[0]

    # Calculate season date range using the correct crop category
    try:
        season_start, season_end = parse_season_for_category(selected_season, crop_category)
    except (ValueError, IndexError):
        season_start = current_season.start_date
        season_end = current_season.end_date

    # Base filters for this commodity
    pool_commodity_filter = Q(pool__commodity__iexact=selected_commodity)
    commodity_filter = Q(commodity__iexact=selected_commodity)

    # Pipeline Stage 1: Harvests (date-based, no commodity filter on Harvest model)
    harvest_stats = Harvest.objects.filter(
        field__farm__company=company,
        harvest_date__gte=season_start,
        harvest_date__lte=season_end
    ).aggregate(
        total_harvests=Count('id'),
        total_bins_harvested=Coalesce(Sum('total_bins'), 0),
        in_progress=Count('id', filter=Q(status='in_progress')),
        complete=Count('id', filter=Q(status='complete')),
        verified=Count('id', filter=Q(status='verified'))
    )

    # Pipeline Stage 2: Deliveries to Packinghouse
    delivery_stats = PackinghouseDelivery.objects.filter(
        pool_commodity_filter,
        pool__packinghouse__company=company,
        pool__season=selected_season
    ).aggregate(
        total_deliveries=Count('id'),
        total_bins_delivered=Coalesce(Sum('bins'), Decimal('0')),
        linked_to_harvest=Count('id', filter=Q(harvest__isnull=False)),
        unlinked=Count('id', filter=Q(harvest__isnull=True))
    )

    # Pipeline Stage 3: Packout Reports
    packout_stats = PackoutReport.objects.filter(
        pool_commodity_filter,
        pool__packinghouse__company=company,
        pool__season=selected_season
    ).aggregate(
        total_reports=Count('id'),
        total_bins_packed=Coalesce(Sum('bins_this_period'), Decimal('0')),
        avg_pack_percent=Avg('total_packed_percent'),
        avg_house_percent=Avg('house_avg_packed_percent')
    )

    # Pipeline Stage 4: Settlements
    settlement_stats = PoolSettlement.objects.filter(
        pool_commodity_filter,
        pool__packinghouse__company=company,
        pool__season=selected_season
    ).aggregate(
        total_settlements=Count('id'),
        total_revenue=Coalesce(Sum('net_return'), Decimal('0')),
        total_bins_settled=Coalesce(Sum('total_bins'), Decimal('0')),
        avg_per_bin=Avg('net_per_bin')
    )

    # Pool status breakdown
    pool_status = Pool.objects.filter(
        commodity_filter,
        packinghouse__company=company,
        season=selected_season
    ).values('status').annotate(count=Count('id'))
    pool_by_status = {item['status']: item['count'] for item in pool_status}

    # Recent activity
    recent_harvests = Harvest.objects.filter(
        field__farm__company=company,
        harvest_date__gte=season_start,
        harvest_date__lte=season_end
    ).select_related('field', 'field__farm').order_by('-harvest_date')[:5]

    recent_deliveries = PackinghouseDelivery.objects.filter(
        pool_commodity_filter,
        pool__packinghouse__company=company,
        pool__season=selected_season
    ).select_related('pool', 'pool__packinghouse', 'field', 'harvest').order_by('-delivery_date')[:5]

    recent_packouts = PackoutReport.objects.filter(
        pool_commodity_filter,
        pool__packinghouse__company=company,
        pool__season=selected_season
    ).select_related('pool', 'field').order_by('-report_date')[:5]

    recent_settlements = PoolSettlement.objects.filter(
        pool_commodity_filter,
        pool__packinghouse__company=company,
        pool__season=selected_season
    ).select_related('pool', 'field').order_by('-statement_date')[:5]

    # Calculate pipeline efficiency metrics
    bins_harvested = harvest_stats['total_bins_harvested'] or 0
    bins_delivered = float(delivery_stats['total_bins_delivered'] or 0)
    bins_packed = float(packout_stats['total_bins_packed'] or 0)
    bins_settled = float(settlement_stats['total_bins_settled'] or 0)

    pipeline_efficiency = {
        'harvest_to_delivery': round((bins_delivered / bins_harvested * 100), 1) if bins_harvested > 0 else 0,
        'delivery_to_packout': round((bins_packed / bins_delivered * 100), 1) if bins_delivered > 0 else 0,
        'packout_to_settlement': round((bins_settled / bins_packed * 100), 1) if bins_packed > 0 else 0,
        'overall': round((bins_settled / bins_harvested * 100), 1) if bins_harvested > 0 else 0,
    }

    # Format recent activity for response
    recent_activity = []

    for h in recent_harvests:
        recent_activity.append({
            'type': 'harvest',
            'date': h.harvest_date.isoformat(),
            'description': f"Harvested {h.total_bins} bins from {h.field.name}",
            'field': h.field.name,
            'farm': h.field.farm.name,
            'bins': h.total_bins,
            'status': h.status,
            'id': h.id
        })

    for d in recent_deliveries:
        recent_activity.append({
            'type': 'delivery',
            'date': d.delivery_date.isoformat(),
            'description': f"Delivered {d.bins} bins to {d.pool.packinghouse.name}",
            'packinghouse': d.pool.packinghouse.name,
            'pool': d.pool.name,
            'field': d.field.name if d.field else None,
            'bins': d.bins,
            'ticket': d.ticket_number,
            'linked_harvest': d.harvest_id,
            'id': d.id
        })

    for p in recent_packouts:
        recent_activity.append({
            'type': 'packout',
            'date': p.report_date.isoformat(),
            'description': f"Packout report: {p.total_packed_percent}% packed" if p.total_packed_percent else "Packout report received",
            'packinghouse': p.pool.packinghouse.name,
            'pool': p.pool.name,
            'field': p.field.name if p.field else 'Grower Summary',
            'pack_percent': float(p.total_packed_percent) if p.total_packed_percent else None,
            'house_avg': float(p.house_avg_packed_percent) if p.house_avg_packed_percent else None,
            'id': p.id
        })

    for s in recent_settlements:
        recent_activity.append({
            'type': 'settlement',
            'date': s.statement_date.isoformat(),
            'description': f"Settlement: ${s.net_return:,.2f}" if s.net_return else "Settlement received",
            'packinghouse': s.pool.packinghouse.name,
            'pool': s.pool.name,
            'field': s.field.name if s.field else 'Grower Summary',
            'net_return': float(s.net_return) if s.net_return else None,
            'per_bin': float(s.net_per_bin) if s.net_per_bin else None,
            'id': s.id
        })

    # Sort by date descending
    recent_activity.sort(key=lambda x: x['date'], reverse=True)

    # --- Pipeline Breakdown: Farm (optional) ---
    breakdown_param = request.query_params.get('breakdown', None)
    breakdowns = None

    if breakdown_param == 'farm':
        # Group by farm. Reports with field set use field.farm; reports without
        # a field are grouped by pool.packinghouse instead.
        group_map = {}

        # Packout reports WITH a field linked
        packout_with_field = PackoutReport.objects.filter(
            pool_commodity_filter,
            pool__packinghouse__company=company,
            pool__season=selected_season,
            field__isnull=False
        ).values('field__farm__id', 'field__farm__name').annotate(
            total_bins_packed=Coalesce(Sum('bins_this_period'), Decimal('0')),
            avg_pack_percent=Avg('total_packed_percent'),
            report_count=Count('id'),
        )
        for row in packout_with_field:
            fid = row['field__farm__id'] or 'unassigned'
            label = row['field__farm__name'] or 'Unassigned'
            group_map.setdefault(fid, {'farm_id': fid, 'label': label})
            group_map[fid]['bins_packed'] = group_map[fid].get('bins_packed', 0) + float(row['total_bins_packed'])
            group_map[fid]['avg_pack_percent'] = round(float(row['avg_pack_percent'] or 0), 1)
            group_map[fid]['packout_reports'] = group_map[fid].get('packout_reports', 0) + row['report_count']

        # Packout reports WITHOUT a field - group by packinghouse name
        packout_no_field = PackoutReport.objects.filter(
            pool_commodity_filter,
            pool__packinghouse__company=company,
            pool__season=selected_season,
            field__isnull=True
        ).values('pool__packinghouse__id', 'pool__packinghouse__name').annotate(
            total_bins_packed=Coalesce(Sum('bins_this_period'), Decimal('0')),
            avg_pack_percent=Avg('total_packed_percent'),
            report_count=Count('id'),
        )
        for row in packout_no_field:
            key = f"ph-{row['pool__packinghouse__id']}"
            label = row['pool__packinghouse__name'] or 'Unknown Packinghouse'
            group_map.setdefault(key, {'farm_id': key, 'label': label})
            group_map[key]['bins_packed'] = group_map[key].get('bins_packed', 0) + float(row['total_bins_packed'])
            group_map[key]['avg_pack_percent'] = round(float(row['avg_pack_percent'] or 0), 1)
            group_map[key]['packout_reports'] = group_map[key].get('packout_reports', 0) + row['report_count']

        # Settlement stats WITH a field linked
        settlement_with_field = PoolSettlement.objects.filter(
            pool_commodity_filter,
            pool__packinghouse__company=company,
            pool__season=selected_season,
            field__isnull=False
        ).values('field__farm__id', 'field__farm__name').annotate(
            total_bins_settled=Coalesce(Sum('total_bins'), Decimal('0')),
            total_revenue=Coalesce(Sum('net_return'), Decimal('0')),
            avg_per_bin=Avg('net_per_bin'),
            settlement_count=Count('id'),
        )
        for row in settlement_with_field:
            fid = row['field__farm__id'] or 'unassigned'
            label = row['field__farm__name'] or 'Unassigned'
            group_map.setdefault(fid, {'farm_id': fid, 'label': label})
            group_map[fid]['bins_settled'] = group_map[fid].get('bins_settled', 0) + float(row['total_bins_settled'])
            group_map[fid]['revenue'] = group_map[fid].get('revenue', 0) + float(row['total_revenue'])
            group_map[fid]['avg_per_bin'] = round(float(row['avg_per_bin'] or 0), 2)
            group_map[fid]['settlements'] = group_map[fid].get('settlements', 0) + row['settlement_count']

        # Settlement stats WITHOUT a field - group by packinghouse name
        settlement_no_field = PoolSettlement.objects.filter(
            pool_commodity_filter,
            pool__packinghouse__company=company,
            pool__season=selected_season,
            field__isnull=True
        ).values('pool__packinghouse__id', 'pool__packinghouse__name').annotate(
            total_bins_settled=Coalesce(Sum('total_bins'), Decimal('0')),
            total_revenue=Coalesce(Sum('net_return'), Decimal('0')),
            avg_per_bin=Avg('net_per_bin'),
            settlement_count=Count('id'),
        )
        for row in settlement_no_field:
            key = f"ph-{row['pool__packinghouse__id']}"
            label = row['pool__packinghouse__name'] or 'Unknown Packinghouse'
            group_map.setdefault(key, {'farm_id': key, 'label': label})
            group_map[key]['bins_settled'] = group_map[key].get('bins_settled', 0) + float(row['total_bins_settled'])
            group_map[key]['revenue'] = group_map[key].get('revenue', 0) + float(row['total_revenue'])
            group_map[key]['avg_per_bin'] = round(float(row['avg_per_bin'] or 0), 2)
            group_map[key]['settlements'] = group_map[key].get('settlements', 0) + row['settlement_count']

        for key, data in group_map.items():
            packed = data.get('bins_packed', 0)
            settled = data.get('bins_settled', 0)
            data['settlement_percent'] = round((settled / packed * 100), 1) if packed > 0 else 0
            data.setdefault('bins_packed', 0)
            data.setdefault('bins_settled', 0)
            data.setdefault('revenue', 0)
            data.setdefault('avg_per_bin', 0)
            data.setdefault('avg_pack_percent', 0)
            data.setdefault('packout_reports', 0)
            data.setdefault('settlements', 0)

        breakdowns = sorted(group_map.values(), key=lambda x: x.get('revenue', 0), reverse=True)

    return Response({
        'mode': 'specific_commodity',
        'selected_commodity': selected_commodity,
        'crop_category': crop_category,
        'current_season': selected_season,
        'selected_season': selected_season,
        'available_seasons': available_seasons,
        'pipeline_stages': {
            'harvest': {
                'label': 'Harvested',
                'total_count': harvest_stats['total_harvests'],
                'total_bins': bins_harvested,
                'breakdown': {
                    'in_progress': harvest_stats['in_progress'],
                    'complete': harvest_stats['complete'],
                    'verified': harvest_stats['verified']
                }
            },
            'delivery': {
                'label': 'Delivered',
                'total_count': delivery_stats['total_deliveries'],
                'total_bins': bins_delivered,
                'breakdown': {
                    'linked': delivery_stats['linked_to_harvest'],
                    'unlinked': delivery_stats['unlinked']
                }
            },
            'packout': {
                'label': 'Packed',
                'total_count': packout_stats['total_reports'],
                'total_bins': bins_packed,
                'avg_pack_percent': round(float(packout_stats['avg_pack_percent'] or 0), 1),
                'avg_house_percent': round(float(packout_stats['avg_house_percent'] or 0), 1)
            },
            'settlement': {
                'label': 'Settled',
                'total_count': settlement_stats['total_settlements'],
                'total_bins': bins_settled,
                'total_revenue': float(settlement_stats['total_revenue'] or 0),
                'avg_per_bin': round(float(settlement_stats['avg_per_bin'] or 0), 2)
            }
        },
        'pool_status': {
            'active': pool_by_status.get('active', 0),
            'closed': pool_by_status.get('closed', 0),
            'settled': pool_by_status.get('settled', 0)
        },
        'pipeline_efficiency': pipeline_efficiency,
        'recent_activity': recent_activity[:15],
        'breakdown_type': breakdown_param,
        'breakdowns': breakdowns,
    })


# =============================================================================
# PACKINGHOUSE STATEMENT UPLOAD & EXTRACTION
# =============================================================================

class PackinghouseStatementViewSet(viewsets.ModelViewSet):
    """
    ViewSet for PackinghouseStatement CRUD and PDF extraction operations.

    list: GET /api/packinghouse-statements/
    create: POST /api/packinghouse-statements/ (upload PDF)
    retrieve: GET /api/packinghouse-statements/{id}/
    destroy: DELETE /api/packinghouse-statements/{id}/

    Custom actions:
    - extracted_data: GET /api/packinghouse-statements/{id}/extracted-data/
    - confirm: POST /api/packinghouse-statements/{id}/confirm/
    - reprocess: POST /api/packinghouse-statements/{id}/reprocess/
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        if not user.current_company:
            return PackinghouseStatement.objects.none()

        queryset = PackinghouseStatement.objects.filter(
            packinghouse__company=user.current_company
        ).select_related('packinghouse', 'pool', 'field', 'uploaded_by')

        # Filter by packinghouse
        packinghouse_id = self.request.query_params.get('packinghouse')
        if packinghouse_id:
            queryset = queryset.filter(packinghouse_id=packinghouse_id)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by statement type
        statement_type = self.request.query_params.get('statement_type')
        if statement_type:
            queryset = queryset.filter(statement_type=statement_type)

        # Filter by pool
        pool_id = self.request.query_params.get('pool')
        if pool_id:
            queryset = queryset.filter(pool_id=pool_id)

        return queryset.order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'list':
            return PackinghouseStatementListSerializer
        if self.action == 'create':
            return PackinghouseStatementUploadSerializer
        return PackinghouseStatementSerializer

    def destroy(self, request, *args, **kwargs):
        """
        Delete a statement and all associated data (settlements, packout reports, grade lines, deductions).
        """
        statement = self.get_object()

        # Delete associated PoolSettlement and its related data
        try:
            settlement = PoolSettlement.objects.get(source_statement=statement)
            # Delete grade lines and deductions first (cascade should handle this, but be explicit)
            SettlementGradeLine.objects.filter(settlement=settlement).delete()
            SettlementDeduction.objects.filter(settlement=settlement).delete()
            settlement.delete()
            logger.info(f"Deleted settlement {settlement.id} for statement {statement.id}")
        except PoolSettlement.DoesNotExist:
            pass

        # Delete associated PackoutReport and its related data
        try:
            packout = PackoutReport.objects.get(source_statement=statement)
            # Delete grade lines first
            PackoutGradeLine.objects.filter(packout_report=packout).delete()
            packout.delete()
            logger.info(f"Deleted packout report {packout.id} for statement {statement.id}")
        except PackoutReport.DoesNotExist:
            pass

        # Delete the PDF file if it exists
        if statement.pdf_file:
            try:
                statement.pdf_file.delete(save=False)
            except Exception as e:
                logger.warning(f"Failed to delete PDF file for statement {statement.id}: {e}")

        # Delete the statement
        statement.delete()
        logger.info(f"Deleted statement {statement.id}")

        return Response(status=status.HTTP_204_NO_CONTENT)

    def create(self, request, *args, **kwargs):
        """
        Upload a PDF and extract data synchronously.

        Expected form data:
        - pdf_file: The PDF file
        - packinghouse: Packinghouse ID
        - packinghouse_format (optional): 'vpoa', 'sla', or 'generic'
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Get uploaded file info
        pdf_file = serializer.validated_data['pdf_file']
        packinghouse = serializer.validated_data['packinghouse']
        packinghouse_format = serializer.validated_data.get('packinghouse_format', '')

        # Auto-detect format from packinghouse short_code if not specified
        if not packinghouse_format:
            short_code = packinghouse.short_code.upper() if packinghouse.short_code else ''
            if 'VPOA' in short_code or 'VILLA' in packinghouse.name.upper():
                packinghouse_format = 'vpoa'
            elif 'SLA' in short_code or 'SATICOY' in packinghouse.name.upper():
                packinghouse_format = 'sla'
            else:
                packinghouse_format = 'generic'

        # Read PDF bytes before saving (works with any storage backend)
        pdf_file.seek(0)
        pdf_bytes = pdf_file.read()
        pdf_file.seek(0)  # Reset for Django to save

        # Create statement record
        statement = PackinghouseStatement.objects.create(
            packinghouse=packinghouse,
            pdf_file=pdf_file,
            original_filename=pdf_file.name,
            file_size_bytes=pdf_file.size,
            packinghouse_format=packinghouse_format,
            status='extracting',
            uploaded_by=request.user
        )

        # Run extraction synchronously using bytes (compatible with S3/R2 storage)
        try:
            extraction_service = PDFExtractionService()
            result = extraction_service.extract_from_pdf(
                pdf_bytes=pdf_bytes,
                packinghouse_format=packinghouse_format
            )

            if result.success:
                statement.status = 'extracted'
                statement.extracted_data = result.data
                statement.statement_type = result.statement_type
                statement.packinghouse_format = result.packinghouse_format
                statement.extraction_confidence = result.confidence
                statement.save()
            else:
                statement.status = 'failed'
                statement.extraction_error = result.error
                statement.save()

        except Exception as e:
            logger.exception(f"Error extracting PDF for statement {statement.id}")
            statement.status = 'failed'
            statement.extraction_error = str(e)
            statement.save()

        # Return the statement with extracted data
        response_serializer = PackinghouseStatementSerializer(statement)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='extracted-data')
    def extracted_data(self, request, pk=None):
        """Get extracted data for preview/editing."""
        statement = self.get_object()
        return Response({
            'id': statement.id,
            'status': statement.status,
            'statement_type': statement.statement_type,
            'packinghouse_format': statement.packinghouse_format,
            'extraction_confidence': statement.extraction_confidence,
            'extracted_data': statement.extracted_data,
            'extraction_error': statement.extraction_error,
        })

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """
        Confirm extracted data and create PackoutReport or PoolSettlement.
        Also supports updating already-completed statements.

        Expected data:
        - pool_id: Pool to associate with (optional - will auto-create from PDF data if not provided)
        - field_id: Field to associate with (optional for settlements)
        - edited_data: Optional edited version of extracted_data
        """
        statement = self.get_object()

        if statement.status not in ['extracted', 'review', 'completed']:
            return Response(
                {'error': 'Statement must be in extracted, review, or completed status to confirm/update'},
                status=status.HTTP_400_BAD_REQUEST
            )

        pool_id = request.data.get('pool_id')
        field_id = request.data.get('field_id')
        edited_data = request.data.get('edited_data')

        # Use edited data if provided, otherwise use original extracted data
        data_to_use = edited_data if edited_data else statement.extracted_data

        # Get or create pool
        pool = None
        if pool_id:
            # Use existing pool
            try:
                pool = Pool.objects.get(
                    id=pool_id,
                    packinghouse__company=request.user.current_company
                )
            except Pool.DoesNotExist:
                return Response(
                    {'error': 'Pool not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Auto-create pool from extracted data
            header = data_to_use.get('header', {})

            # Extract pool info from PDF data
            extracted_pool_id = header.get('pool_id') or ''
            pool_name = header.get('pool_name') or extracted_pool_id or 'Imported Pool'
            commodity = header.get('commodity', 'CITRUS')
            extracted_season = header.get('season', '')

            # ALWAYS derive season from report_date + commodity using SeasonService
            # This is more reliable than AI extraction because:
            # 1. Documents often don't have explicit season
            # 2. AI doesn't understand citrus marketing year conventions (Oct-Sep)
            # 3. SeasonService has correct logic for all commodity types
            from datetime import datetime, date as date_module

            # Map commodity to crop category for season calculation
            crop_category = get_crop_category_for_commodity(commodity)

            season_service = SeasonService(company_id=request.user.current_company_id)
            season = ''

            # Season derivation priority:
            # 1. For settlements/grower_statements: prefer extracted_season (often printed on document)
            # 2. Derive from period_end → period_start (fruit packing dates)
            # 3. Fall back to report_date only for wash reports/packouts
            # 4. Final fallback: current season

            logger.info(f"Season derivation - extracted_season: {extracted_season}, period_end: {header.get('period_end')}, period_start: {header.get('period_start')}, report_date: {header.get('report_date')}")

            # For settlements, the season is often explicitly printed - trust it first
            if statement.statement_type in ['settlement', 'grower_statement'] and extracted_season:
                season = extracted_season
                logger.info(f"Using extracted_season for settlement: {season}")
            else:
                # Derive from dates: period_end → period_start → report_date
                season_date_str = header.get('period_end') or header.get('period_start') or header.get('report_date')

                if season_date_str:
                    try:
                        season_date = datetime.strptime(season_date_str, '%Y-%m-%d').date()
                        season_period = season_service.get_current_season(
                            crop_category=crop_category,
                            target_date=season_date
                        )
                        season = season_period.label
                        logger.info(f"Season derived from date {season_date}: {season}")
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Failed to parse season date '{season_date_str}': {e}")

                # Fall back to extracted season if date derivation failed
                if not season and extracted_season:
                    season = extracted_season
                    logger.info(f"Using extracted_season as fallback: {season}")

            # Final fallback: use current season for this commodity
            if not season:
                current_season_period = season_service.get_current_season(crop_category=crop_category)
                season = current_season_period.label
                logger.info(f"Using current season as final fallback: {season}")

            # Check if a similar pool already exists for this season
            # First try by pool_id and season if we have one (most specific)
            existing_pool = None
            if extracted_pool_id:
                existing_pool = Pool.objects.filter(
                    packinghouse=statement.packinghouse,
                    pool_id=extracted_pool_id,
                    season=season
                ).first()

            # If not found by pool_id+season, try by commodity and season
            if not existing_pool:
                existing_pool = Pool.objects.filter(
                    packinghouse=statement.packinghouse,
                    commodity__iexact=commodity,
                    season=season
                ).first()

            if existing_pool:
                pool = existing_pool
                logger.info(f"Using existing pool {pool.id} for statement {statement.id}")
            else:
                # Generate a unique pool_id if not provided
                if not extracted_pool_id:
                    import uuid
                    extracted_pool_id = f"IMP-{uuid.uuid4().hex[:8].upper()}"

                # Create new pool
                pool = Pool.objects.create(
                    packinghouse=statement.packinghouse,
                    pool_id=extracted_pool_id,
                    name=pool_name,
                    commodity=commodity,
                    season=season,
                    status='active'
                )
                logger.info(f"Created new pool {pool.id} ({pool.name}) for statement {statement.id}")

        field = None
        if field_id:
            try:
                field = Field.objects.get(
                    id=field_id,
                    farm__company=request.user.current_company
                )
            except Field.DoesNotExist:
                return Response(
                    {'error': 'Field not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

        # Update statement with edited data if provided
        if edited_data:
            statement.extracted_data = edited_data
            statement.save()

        # Check if records were already created for this statement
        existing_packout = PackoutReport.objects.filter(source_statement=statement).first()
        existing_settlement = PoolSettlement.objects.filter(source_statement=statement).first()

        if existing_packout or existing_settlement:
            # Already processed - update existing records with edited data
            extraction_service = PDFExtractionService()

            statement.pool = pool
            statement.field = field
            statement.status = 'completed'
            statement.save()

            if existing_packout:
                # Update the packout report with edited data
                if edited_data:
                    report_data = extraction_service.create_packout_report_from_data(
                        data_to_use, pool, field
                    )
                    # Update fields on existing packout (exclude source_statement)
                    for key, value in report_data.items():
                        setattr(existing_packout, key, value)
                    existing_packout.save()

                    # Delete and recreate grade lines
                    PackoutGradeLine.objects.filter(packout_report=existing_packout).delete()
                    grade_lines_data = extraction_service.get_grade_lines_data(
                        data_to_use, for_settlement=False
                    )
                    for line_data in grade_lines_data:
                        PackoutGradeLine.objects.create(
                            packout_report=existing_packout,
                            **line_data
                        )

                    logger.info(f"Updated existing packout report {existing_packout.id} with edited data")

                return Response({
                    'success': True,
                    'message': 'Packout report updated successfully' if edited_data else 'Statement was already processed. Packout report exists.',
                    'packout_report_id': existing_packout.id,
                    'statement_id': statement.id
                })
            else:
                # Update the settlement with edited data
                if edited_data:
                    settlement_data = extraction_service.create_settlement_from_data(
                        data_to_use, pool, field
                    )
                    # Update fields on existing settlement (exclude source_statement)
                    for key, value in settlement_data.items():
                        setattr(existing_settlement, key, value)
                    existing_settlement.save()

                    # Delete and recreate grade lines and deductions
                    SettlementGradeLine.objects.filter(settlement=existing_settlement).delete()
                    SettlementDeduction.objects.filter(settlement=existing_settlement).delete()

                    grade_lines_data = extraction_service.get_grade_lines_data(
                        data_to_use, for_settlement=True
                    )
                    for line_data in grade_lines_data:
                        SettlementGradeLine.objects.create(
                            settlement=existing_settlement,
                            **line_data
                        )

                    deductions_data = extraction_service.get_deductions_data(data_to_use)
                    for deduction_data in deductions_data:
                        SettlementDeduction.objects.create(
                            settlement=existing_settlement,
                            **deduction_data
                        )

                    logger.info(f"Updated existing settlement {existing_settlement.id} with edited data")

                return Response({
                    'success': True,
                    'message': 'Settlement updated successfully' if edited_data else 'Statement was already processed. Settlement exists.',
                    'settlement_id': existing_settlement.id,
                    'statement_id': statement.id
                })

        # Create the appropriate record based on statement type
        extraction_service = PDFExtractionService()

        try:
            if statement.statement_type in ['packout', 'wash_report']:
                # Create PackoutReport (field is optional - packouts may aggregate multiple fields)
                report_data = extraction_service.create_packout_report_from_data(
                    data_to_use, pool, field
                )
                report_data['source_statement'] = statement

                packout_report = PackoutReport.objects.create(**report_data)

                # Create grade lines
                grade_lines_data = extraction_service.get_grade_lines_data(
                    data_to_use, for_settlement=False
                )
                for line_data in grade_lines_data:
                    PackoutGradeLine.objects.create(
                        packout_report=packout_report,
                        **line_data
                    )

                statement.pool = pool
                statement.field = field
                statement.status = 'completed'
                statement.save()

                return Response({
                    'success': True,
                    'message': 'Packout report created successfully',
                    'packout_report_id': packout_report.id,
                    'statement_id': statement.id
                })

            elif statement.statement_type in ['settlement', 'grower_statement']:
                # Create PoolSettlement
                settlement_data = extraction_service.create_settlement_from_data(
                    data_to_use, pool, field
                )
                settlement_data['source_statement'] = statement

                settlement = PoolSettlement.objects.create(**settlement_data)

                # Create grade lines
                grade_lines_data = extraction_service.get_grade_lines_data(
                    data_to_use, for_settlement=True
                )
                for line_data in grade_lines_data:
                    SettlementGradeLine.objects.create(
                        settlement=settlement,
                        **line_data
                    )

                # Create deductions
                deductions_data = extraction_service.get_deductions_data(data_to_use)
                for ded_data in deductions_data:
                    SettlementDeduction.objects.create(
                        settlement=settlement,
                        **ded_data
                    )

                statement.pool = pool
                statement.field = field
                statement.status = 'completed'
                statement.save()

                return Response({
                    'success': True,
                    'message': 'Pool settlement created successfully',
                    'settlement_id': settlement.id,
                    'statement_id': statement.id
                })

            else:
                return Response(
                    {'error': f'Unknown statement type: {statement.statement_type}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.exception(f"Error creating record from statement {statement.id}")
            return Response(
                {'error': f'Failed to create record: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def reprocess(self, request, pk=None):
        """
        Re-run extraction on the PDF.
        Useful if extraction failed or format was incorrect.
        """
        statement = self.get_object()

        if statement.is_processed:
            return Response(
                {'error': 'Cannot reprocess a statement that has already been processed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get optional format hint from request
        packinghouse_format = request.data.get(
            'packinghouse_format',
            statement.packinghouse_format
        )

        statement.status = 'extracting'
        statement.extraction_error = ''
        statement.save()

        try:
            # Read PDF bytes from storage (works with S3/R2 and local storage)
            statement.pdf_file.seek(0)
            pdf_bytes = statement.pdf_file.read()

            extraction_service = PDFExtractionService()
            result = extraction_service.extract_from_pdf(
                pdf_bytes=pdf_bytes,
                packinghouse_format=packinghouse_format
            )

            if result.success:
                statement.status = 'extracted'
                statement.extracted_data = result.data
                statement.statement_type = result.statement_type
                statement.packinghouse_format = result.packinghouse_format
                statement.extraction_confidence = result.confidence
                statement.extraction_error = ''
                statement.save()
            else:
                statement.status = 'failed'
                statement.extraction_error = result.error
                statement.save()

        except Exception as e:
            logger.exception(f"Error reprocessing statement {statement.id}")
            statement.status = 'failed'
            statement.extraction_error = str(e)
            statement.save()

        response_serializer = PackinghouseStatementSerializer(statement)
        return Response(response_serializer.data)

    @action(detail=True, methods=['get'], url_path='pdf')
    def serve_pdf(self, request, pk=None):
        """
        Serve the PDF file directly from the backend.
        This proxies the file from cloud storage (R2/S3) to avoid CORS issues.
        """
        from django.http import FileResponse, HttpResponse

        statement = self.get_object()
        logger.info(f"Serving PDF for statement {statement.id}: {statement.original_filename}")

        if not statement.pdf_file:
            return HttpResponse('No PDF file available', status=404)

        try:
            # Open the file from storage (works with both local and cloud storage)
            pdf_file = statement.pdf_file.open('rb')
            response = FileResponse(
                pdf_file,
                content_type='application/pdf',
                as_attachment=False,
                filename=statement.original_filename or 'statement.pdf'
            )
            # Allow the browser to cache the PDF for 1 hour
            response['Cache-Control'] = 'private, max-age=3600'
            return response
        except Exception as e:
            logger.exception(f"Error serving PDF for statement {statement.id}")
            return HttpResponse(f'Error loading PDF: {str(e)}', status=500)

    @action(detail=False, methods=['post'], url_path='batch-upload')
    def batch_upload(self, request):
        """
        Upload multiple PDFs at once with automatic extraction and farm/field matching.

        Expected form data:
        - files[]: PDF files (max 20)
        - packinghouse (optional): Packinghouse ID - if not provided, auto-detects from PDF
        - packinghouse_format (optional): 'vpoa', 'sla', or 'generic'

        Returns batch_id and list of statements with auto-match suggestions.
        Each statement may have a different auto-detected packinghouse.
        """
        from .services import PackinghouseLookupService

        # Validate request
        serializer = BatchUploadSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        # Packinghouse is now optional - can be None for auto-detection
        default_packinghouse = serializer.validated_data.get('packinghouse')
        packinghouse_format_hint = serializer.validated_data.get('packinghouse_format', '')

        # Get uploaded files
        files = request.FILES.getlist('files[]') or request.FILES.getlist('files')
        if not files:
            return Response(
                {'error': 'No files provided. Use files[] or files parameter.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(files) > 20:
            return Response(
                {'error': f'Too many files. Maximum is 20, got {len(files)}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(files) < 1:
            return Response(
                {'error': 'At least one file is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create batch record (packinghouse can be null for mixed uploads)
        batch_id = uuid.uuid4()
        batch = StatementBatchUpload.objects.create(
            batch_id=batch_id,
            packinghouse=default_packinghouse,  # May be None
            status='processing',
            total_files=len(files),
            uploaded_by=request.user
        )

        # Initialize services
        extraction_service = PDFExtractionService()
        packinghouse_lookup = PackinghouseLookupService(request.user.current_company)

        results = []
        success_count = 0
        failed_count = 0

        for pdf_file in files:
            # Validate file
            if not pdf_file.name.lower().endswith('.pdf'):
                results.append({
                    'id': None,
                    'filename': pdf_file.name,
                    'status': 'failed',
                    'statement_type': None,
                    'extraction_confidence': None,
                    'extraction_error': 'Only PDF files are allowed',
                    'auto_match': None,
                    'needs_review': True,
                    'detected_packinghouse': None
                })
                failed_count += 1
                continue

            # Check file size (50MB max)
            if pdf_file.size > 50 * 1024 * 1024:
                results.append({
                    'id': None,
                    'filename': pdf_file.name,
                    'status': 'failed',
                    'statement_type': None,
                    'extraction_confidence': None,
                    'extraction_error': 'File too large (max 50MB)',
                    'auto_match': None,
                    'needs_review': True,
                    'detected_packinghouse': None
                })
                failed_count += 1
                continue

            try:
                # Read PDF bytes before saving (works with any storage backend)
                pdf_file.seek(0)
                pdf_bytes = pdf_file.read()
                pdf_file.seek(0)  # Reset for Django to save

                # Run extraction FIRST to detect packinghouse
                try:
                    result = extraction_service.extract_from_pdf(
                        pdf_bytes=pdf_bytes,
                        packinghouse_format=packinghouse_format_hint or None
                    )

                    if result.success:
                        # Auto-detect packinghouse from extraction if not provided
                        if default_packinghouse:
                            statement_packinghouse = default_packinghouse
                            detected_packinghouse_info = None
                        else:
                            # Lookup packinghouse from extracted data
                            lookup_result = packinghouse_lookup.lookup_from_extraction(result.data)
                            if lookup_result.found:
                                statement_packinghouse = lookup_result.packinghouse
                                detected_packinghouse_info = {
                                    'id': lookup_result.packinghouse_id,
                                    'name': lookup_result.packinghouse.name,
                                    'short_code': lookup_result.packinghouse.short_code,
                                    'confidence': lookup_result.confidence,
                                    'match_reason': lookup_result.match_reason,
                                    'auto_detected': True
                                }
                            else:
                                # No packinghouse found - still save statement but flag for review
                                statement_packinghouse = None
                                detected_packinghouse_info = {
                                    'id': None,
                                    'name': result.data.get('packinghouse_name', 'Unknown'),
                                    'short_code': result.data.get('packinghouse_short_code'),
                                    'confidence': 0,
                                    'match_reason': lookup_result.match_reason,
                                    'auto_detected': True,
                                    'suggestions': lookup_result.suggestions
                                }

                        # Determine format from packinghouse or extraction
                        if statement_packinghouse and not packinghouse_format_hint:
                            short_code = statement_packinghouse.short_code.upper() if statement_packinghouse.short_code else ''
                            if 'VPOA' in short_code or 'VILLA' in statement_packinghouse.name.upper():
                                packinghouse_format = 'vpoa'
                            elif 'SLA' in short_code or 'SATICOY' in statement_packinghouse.name.upper():
                                packinghouse_format = 'sla'
                            else:
                                packinghouse_format = result.packinghouse_format or 'generic'
                        else:
                            packinghouse_format = result.packinghouse_format or packinghouse_format_hint or 'generic'

                        # Create statement record with detected packinghouse
                        statement = PackinghouseStatement.objects.create(
                            packinghouse=statement_packinghouse,
                            pdf_file=pdf_file,
                            original_filename=pdf_file.name,
                            file_size_bytes=pdf_file.size,
                            packinghouse_format=packinghouse_format,
                            status='extracted',
                            uploaded_by=request.user,
                            batch_upload=batch,
                            extracted_data=result.data,
                            statement_type=result.statement_type,
                            extraction_confidence=result.confidence
                        )

                        # Run auto-matching for farm/field (only if packinghouse known)
                        if statement_packinghouse:
                            matcher = StatementMatcher(request.user.current_company)
                            match_result = matcher.match_statement(
                                statement_packinghouse.id,
                                result.data
                            )
                            statement.auto_match_result = match_result.to_dict()
                            statement.save()
                            auto_match_dict = match_result.to_dict()
                            needs_review = match_result.needs_review
                        else:
                            auto_match_dict = None
                            needs_review = True  # No packinghouse = needs review

                        results.append({
                            'id': statement.id,
                            'filename': pdf_file.name,
                            'status': 'extracted',
                            'statement_type': statement.statement_type,
                            'extraction_confidence': float(statement.extraction_confidence) if statement.extraction_confidence else None,
                            'extraction_error': None,
                            'auto_match': auto_match_dict,
                            'needs_review': needs_review,
                            'extracted_data': result.data,
                            'pdf_url': f'/api/packinghouse-statements/{statement.id}/pdf/' if statement.pdf_file else None,
                            'detected_packinghouse': detected_packinghouse_info,
                            'packinghouse_id': statement_packinghouse.id if statement_packinghouse else None
                        })
                        success_count += 1
                    else:
                        # Extraction failed - still create statement for retry
                        statement = PackinghouseStatement.objects.create(
                            packinghouse=default_packinghouse,
                            pdf_file=pdf_file,
                            original_filename=pdf_file.name,
                            file_size_bytes=pdf_file.size,
                            packinghouse_format=packinghouse_format_hint or 'generic',
                            status='failed',
                            uploaded_by=request.user,
                            batch_upload=batch,
                            extraction_error=result.error
                        )

                        results.append({
                            'id': statement.id,
                            'filename': pdf_file.name,
                            'status': 'failed',
                            'statement_type': None,
                            'extraction_confidence': None,
                            'extraction_error': result.error,
                            'auto_match': None,
                            'needs_review': True,
                            'detected_packinghouse': None
                        })
                        failed_count += 1

                except Exception as e:
                    logger.exception(f"Error extracting PDF {pdf_file.name}")
                    # Create failed statement record
                    statement = PackinghouseStatement.objects.create(
                        packinghouse=default_packinghouse,
                        pdf_file=pdf_file,
                        original_filename=pdf_file.name,
                        file_size_bytes=pdf_file.size,
                        packinghouse_format=packinghouse_format_hint or 'generic',
                        status='failed',
                        uploaded_by=request.user,
                        batch_upload=batch,
                        extraction_error=str(e)
                    )

                    results.append({
                        'id': statement.id,
                        'filename': pdf_file.name,
                        'status': 'failed',
                        'statement_type': None,
                        'extraction_confidence': None,
                        'extraction_error': str(e),
                        'auto_match': None,
                        'needs_review': True,
                        'detected_packinghouse': None
                    })
                    failed_count += 1

            except Exception as e:
                logger.exception(f"Error creating statement for {pdf_file.name}")
                results.append({
                    'id': None,
                    'filename': pdf_file.name,
                    'status': 'failed',
                    'statement_type': None,
                    'extraction_confidence': None,
                    'extraction_error': str(e),
                    'auto_match': None,
                    'needs_review': True,
                    'detected_packinghouse': None
                })
                failed_count += 1

        # Update batch status
        batch.processed_count = len(files)
        batch.success_count = success_count
        batch.failed_count = failed_count
        batch.completed_at = timezone.now()

        if failed_count == 0:
            batch.status = 'completed'
        elif success_count == 0:
            batch.status = 'failed'
        else:
            batch.status = 'partial'
        batch.save()

        return Response({
            'batch_id': str(batch_id),
            'total': len(files),
            'success_count': success_count,
            'failed_count': failed_count,
            'statements': results
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='batch-confirm')
    def batch_confirm(self, request):
        """
        Confirm multiple statements at once, creating settlements/packout reports.

        Expected data:
        - statements: List of {id, farm_id?, field_id?, pool_id?, skip?}
        - save_mappings: Whether to save confirmed matches as learned mappings

        Returns confirmation results for each statement.
        """
        serializer = BatchConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        statements_data = serializer.validated_data['statements']
        save_mappings = serializer.validated_data.get('save_mappings', True)

        if not statements_data:
            return Response(
                {'error': 'No statements provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        extraction_service = PDFExtractionService()
        matcher = StatementMatcher(request.user.current_company)

        results = []
        confirmed_count = 0
        skipped_count = 0
        failed_count = 0
        mappings_created = 0

        for stmt_data in statements_data:
            statement_id = stmt_data['id']
            skip = stmt_data.get('skip', False)

            if skip:
                results.append({
                    'id': statement_id,
                    'filename': '',
                    'success': True,
                    'message': 'Skipped',
                    'settlement_id': None,
                    'packout_report_id': None,
                    'mapping_saved': False
                })
                skipped_count += 1
                continue

            try:
                # Get statement - packinghouse may be null for auto-detected uploads
                statement = PackinghouseStatement.objects.select_related(
                    'packinghouse'
                ).filter(
                    id=statement_id
                ).filter(
                    Q(packinghouse__company=request.user.current_company) |
                    Q(packinghouse__isnull=True, uploaded_by=request.user)
                ).first()

                if not statement:
                    raise PackinghouseStatement.DoesNotExist()

            except PackinghouseStatement.DoesNotExist:
                results.append({
                    'id': statement_id,
                    'filename': '',
                    'success': False,
                    'message': 'Statement not found',
                    'settlement_id': None,
                    'packout_report_id': None,
                    'mapping_saved': False
                })
                failed_count += 1
                continue

            if statement.status not in ['extracted', 'review', 'completed']:
                results.append({
                    'id': statement_id,
                    'filename': statement.original_filename,
                    'success': False,
                    'message': f'Invalid status: {statement.status}',
                    'settlement_id': None,
                    'packout_report_id': None,
                    'mapping_saved': False
                })
                failed_count += 1
                continue

            # Handle packinghouse override - required if not already set
            packinghouse_id = stmt_data.get('packinghouse_id')
            if packinghouse_id:
                try:
                    packinghouse = Packinghouse.objects.get(
                        id=packinghouse_id,
                        company=request.user.current_company
                    )
                    statement.packinghouse = packinghouse
                    statement.save(update_fields=['packinghouse'])
                except Packinghouse.DoesNotExist:
                    results.append({
                        'id': statement_id,
                        'filename': statement.original_filename,
                        'success': False,
                        'message': f'Packinghouse not found: {packinghouse_id}',
                        'settlement_id': None,
                        'packout_report_id': None,
                        'mapping_saved': False
                    })
                    failed_count += 1
                    continue

            # Validate that packinghouse is now set
            if not statement.packinghouse:
                results.append({
                    'id': statement_id,
                    'filename': statement.original_filename,
                    'success': False,
                    'message': 'Packinghouse is required. Please select a packinghouse for this statement.',
                    'settlement_id': None,
                    'packout_report_id': None,
                    'mapping_saved': False
                })
                failed_count += 1
                continue

            # Get farm/field/pool - use provided values or auto-matched
            farm_id = stmt_data.get('farm_id')
            field_id = stmt_data.get('field_id')
            pool_id = stmt_data.get('pool_id')

            # Fall back to auto-matched values
            auto_match = statement.auto_match_result or {}
            if not farm_id and auto_match.get('farm'):
                farm_id = auto_match['farm'].get('id')
            if not field_id and auto_match.get('field'):
                field_id = auto_match['field'].get('id')

            # Validate farm
            farm = None
            if farm_id:
                try:
                    farm = Farm.objects.get(
                        id=farm_id,
                        company=request.user.current_company
                    )
                except Farm.DoesNotExist:
                    results.append({
                        'id': statement_id,
                        'filename': statement.original_filename,
                        'success': False,
                        'message': f'Farm not found: {farm_id}',
                        'settlement_id': None,
                        'packout_report_id': None,
                        'mapping_saved': False
                    })
                    failed_count += 1
                    continue

            # Validate field
            field = None
            if field_id:
                try:
                    field = Field.objects.get(
                        id=field_id,
                        farm__company=request.user.current_company
                    )
                except Field.DoesNotExist:
                    results.append({
                        'id': statement_id,
                        'filename': statement.original_filename,
                        'success': False,
                        'message': f'Field not found: {field_id}',
                        'settlement_id': None,
                        'packout_report_id': None,
                        'mapping_saved': False
                    })
                    failed_count += 1
                    continue

            # Get or create pool
            pool = None
            if pool_id:
                try:
                    pool = Pool.objects.get(
                        id=pool_id,
                        packinghouse__company=request.user.current_company
                    )
                except Pool.DoesNotExist:
                    results.append({
                        'id': statement_id,
                        'filename': statement.original_filename,
                        'success': False,
                        'message': f'Pool not found: {pool_id}',
                        'settlement_id': None,
                        'packout_report_id': None,
                        'mapping_saved': False
                    })
                    failed_count += 1
                    continue
            else:
                # Auto-create pool from extracted data (same logic as single confirm)
                pool = self._get_or_create_pool_from_data(
                    statement, request.user
                )

            # Create the appropriate record
            try:
                settlement_id = None
                packout_report_id = None
                data_to_use = statement.extracted_data

                if statement.statement_type in ['settlement', 'grower_statement']:
                    settlement_data = extraction_service.create_settlement_from_data(
                        data_to_use, pool, field
                    )
                    settlement_data['source_statement'] = statement

                    settlement = PoolSettlement.objects.create(**settlement_data)

                    # Create grade lines
                    grade_lines_data = extraction_service.get_grade_lines_data(
                        data_to_use, for_settlement=True
                    )
                    for line_data in grade_lines_data:
                        SettlementGradeLine.objects.create(
                            settlement=settlement,
                            **line_data
                        )

                    # Create deductions
                    deductions_data = extraction_service.get_deductions_data(data_to_use)
                    for ded_data in deductions_data:
                        SettlementDeduction.objects.create(
                            settlement=settlement,
                            **ded_data
                        )

                    settlement_id = settlement.id

                elif statement.statement_type in ['packout', 'wash_report']:
                    # Field is optional - packouts may aggregate multiple fields
                    report_data = extraction_service.create_packout_report_from_data(
                        data_to_use, pool, field
                    )
                    report_data['source_statement'] = statement

                    packout_report = PackoutReport.objects.create(**report_data)

                    # Create grade lines
                    grade_lines_data = extraction_service.get_grade_lines_data(
                        data_to_use, for_settlement=False
                    )
                    for line_data in grade_lines_data:
                        PackoutGradeLine.objects.create(
                            packout_report=packout_report,
                            **line_data
                        )

                    packout_report_id = packout_report.id

                else:
                    results.append({
                        'id': statement_id,
                        'filename': statement.original_filename,
                        'success': False,
                        'message': f'Unknown statement type: {statement.statement_type}',
                        'settlement_id': None,
                        'packout_report_id': None,
                        'mapping_saved': False
                    })
                    failed_count += 1
                    continue

                # Update statement
                statement.pool = pool
                statement.field = field
                statement.status = 'completed'
                statement.save()

                # Save mapping if requested
                mapping_saved = False
                if save_mappings and farm:
                    try:
                        # Extract grower info for mapping
                        header = data_to_use.get('header', {})
                        grower_info = data_to_use.get('grower_info', {})

                        grower_name = (
                            grower_info.get('grower_name') or
                            header.get('grower_name') or
                            header.get('grower') or
                            ''
                        )
                        grower_id = (
                            grower_info.get('grower_id') or
                            header.get('grower_id') or
                            ''
                        )
                        block_name = (
                            header.get('ranch_name') or
                            header.get('block_name') or
                            grower_info.get('ranch') or
                            ''
                        )

                        if grower_name:
                            matcher.save_mapping(
                                packinghouse_id=statement.packinghouse_id,
                                grower_name=grower_name,
                                grower_id=grower_id,
                                farm_id=farm.id,
                                field_id=field.id if field else None,
                                block_name=block_name,
                                source_statement_id=statement.id,
                                user=request.user
                            )
                            mapping_saved = True
                            mappings_created += 1
                    except Exception as e:
                        logger.warning(f"Failed to save mapping: {e}")

                results.append({
                    'id': statement_id,
                    'filename': statement.original_filename,
                    'success': True,
                    'message': 'Confirmed',
                    'settlement_id': settlement_id,
                    'packout_report_id': packout_report_id,
                    'mapping_saved': mapping_saved
                })
                confirmed_count += 1

            except Exception as e:
                logger.exception(f"Error confirming statement {statement_id}")
                results.append({
                    'id': statement_id,
                    'filename': statement.original_filename,
                    'success': False,
                    'message': str(e),
                    'settlement_id': None,
                    'packout_report_id': None,
                    'mapping_saved': False
                })
                failed_count += 1

        return Response({
            'total': len(statements_data),
            'confirmed': confirmed_count,
            'skipped': skipped_count,
            'failed': failed_count,
            'mappings_created': mappings_created,
            'results': results
        })

    @action(detail=False, methods=['get'], url_path=r'batch-status/(?P<batch_id>[^/.]+)')
    def batch_status(self, request, batch_id=None):
        """
        Get the status of a batch upload.

        URL: GET /api/packinghouse-statements/batch-status/{batch_id}/
        """
        try:
            batch = StatementBatchUpload.objects.get(
                batch_id=batch_id,
                packinghouse__company=request.user.current_company
            )
        except StatementBatchUpload.DoesNotExist:
            return Response(
                {'error': 'Batch not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response({
            'batch_id': str(batch.batch_id),
            'status': batch.status,
            'total_files': batch.total_files,
            'processed_count': batch.processed_count,
            'success_count': batch.success_count,
            'failed_count': batch.failed_count,
            'progress_percent': batch.progress_percent,
            'is_complete': batch.is_complete,
            'created_at': batch.created_at,
            'completed_at': batch.completed_at
        })

    @action(detail=False, methods=['get'], url_path='grower-mappings')
    def grower_mappings(self, request):
        """
        List learned grower-to-farm mappings for a packinghouse.

        Query params:
        - packinghouse: Filter by packinghouse ID (required)
        """
        packinghouse_id = request.query_params.get('packinghouse')
        if not packinghouse_id:
            return Response(
                {'error': 'packinghouse parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        mappings = PackinghouseGrowerMapping.objects.filter(
            packinghouse_id=packinghouse_id,
            packinghouse__company=request.user.current_company
        ).select_related('farm', 'field').order_by('-use_count', '-last_used_at')

        data = [
            {
                'id': m.id,
                'grower_name_pattern': m.grower_name_pattern,
                'grower_id_pattern': m.grower_id_pattern,
                'block_name_pattern': m.block_name_pattern,
                'farm_id': m.farm_id,
                'farm_name': m.farm.name,
                'field_id': m.field_id,
                'field_name': m.field.name if m.field else None,
                'use_count': m.use_count,
                'last_used_at': m.last_used_at,
                'created_at': m.created_at
            }
            for m in mappings
        ]

        return Response(data)

    @action(detail=False, methods=['delete'], url_path=r'grower-mappings/(?P<mapping_id>\d+)')
    def delete_grower_mapping(self, request, mapping_id=None):
        """
        Delete a learned grower mapping.

        URL: DELETE /api/packinghouse-statements/grower-mappings/{mapping_id}/
        """
        try:
            mapping = PackinghouseGrowerMapping.objects.get(
                id=mapping_id,
                packinghouse__company=request.user.current_company
            )
            mapping.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except PackinghouseGrowerMapping.DoesNotExist:
            return Response(
                {'error': 'Mapping not found'},
                status=status.HTTP_404_NOT_FOUND
            )

    def _get_or_create_pool_from_data(self, statement, user):
        """
        Get or create a pool from extracted statement data.
        Shared logic for single and batch confirm.
        """
        data_to_use = statement.extracted_data
        header = data_to_use.get('header', {})

        extracted_pool_id = header.get('pool_id') or ''
        pool_name = header.get('pool_name') or extracted_pool_id or 'Imported Pool'
        commodity = header.get('commodity', 'CITRUS')
        extracted_season = header.get('season', '')

        # ALWAYS derive season from report_date + commodity using SeasonService
        # This is more reliable than AI extraction because:
        # 1. Documents often don't have explicit season
        # 2. AI doesn't understand citrus marketing year conventions (Oct-Sep)
        # 3. SeasonService has correct logic for all commodity types
        from datetime import datetime, date as date_module

        # Map commodity to crop category for season calculation
        crop_category = get_crop_category_for_commodity(commodity)

        season_service = SeasonService(company_id=user.current_company_id)
        season = ''

        # Season derivation priority:
        # 1. For settlements/grower_statements: prefer extracted_season (often printed on document)
        # 2. Derive from period_end → period_start (fruit packing dates)
        # 3. Fall back to report_date only for wash reports/packouts
        # 4. Final fallback: current season

        # For settlements, the season is often explicitly printed - trust it first
        if statement.statement_type in ['settlement', 'grower_statement'] and extracted_season:
            season = extracted_season
        else:
            # Derive from dates: period_end → period_start → report_date
            season_date_str = header.get('period_end') or header.get('period_start') or header.get('report_date')

            if season_date_str:
                try:
                    season_date = datetime.strptime(season_date_str, '%Y-%m-%d').date()
                    season_period = season_service.get_current_season(
                        crop_category=crop_category,
                        target_date=season_date
                    )
                    season = season_period.label
                except (ValueError, TypeError):
                    pass

            # Fall back to extracted season if date derivation failed
            if not season and extracted_season:
                season = extracted_season

        # Final fallback: use current season for this commodity
        if not season:
            current_season_period = season_service.get_current_season(crop_category=crop_category)
            season = current_season_period.label

        # Check for existing pool - include season in lookup
        existing_pool = None
        if extracted_pool_id:
            existing_pool = Pool.objects.filter(
                packinghouse=statement.packinghouse,
                pool_id=extracted_pool_id,
                season=season
            ).first()

        if not existing_pool:
            existing_pool = Pool.objects.filter(
                packinghouse=statement.packinghouse,
                commodity__iexact=commodity,
                season=season
            ).first()

        if existing_pool:
            return existing_pool

        # Create new pool
        if not extracted_pool_id:
            extracted_pool_id = f"IMP-{uuid.uuid4().hex[:8].upper()}"

        pool = Pool.objects.create(
            packinghouse=statement.packinghouse,
            pool_id=extracted_pool_id,
            name=pool_name,
            commodity=commodity,
            season=season,
            status='active'
        )
        return pool
