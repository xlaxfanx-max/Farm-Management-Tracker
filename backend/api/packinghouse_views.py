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
    GrowerLedgerEntry, Field, PackinghouseStatement
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
    PackinghouseStatementListSerializer, PackinghouseStatementSerializer,
    PackinghouseStatementUploadSerializer,
)
from .services import PDFExtractionService


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
            'pool', 'pool__packinghouse', 'field', 'field__farm'
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
def packinghouse_dashboard(request):
    """
    Get dashboard summary for packinghouse module.

    Returns:
    - Active pools count
    - Total bins delivered this season
    - Pending settlements count
    - Recent deliveries
    - Recent packout reports
    """
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    company = user.current_company

    # Active pools
    active_pools = Pool.objects.filter(
        packinghouse__company=company,
        status='active'
    ).count()

    # Get current season (assume format "2024-2025")
    from datetime import date
    today = date.today()
    if today.month >= 10:
        current_season = f"{today.year}-{today.year + 1}"
    else:
        current_season = f"{today.year - 1}-{today.year}"

    # Total bins this season
    total_bins = PackinghouseDelivery.objects.filter(
        pool__packinghouse__company=company,
        pool__season=current_season
    ).aggregate(total=Coalesce(Sum('bins'), Decimal('0')))['total']

    # Pools pending settlement
    pending_settlement = Pool.objects.filter(
        packinghouse__company=company,
        status='closed'
    ).exclude(
        settlements__isnull=False
    ).count()

    # Recent deliveries (last 5)
    recent_deliveries = PackinghouseDelivery.objects.filter(
        pool__packinghouse__company=company
    ).select_related('pool', 'field').order_by('-delivery_date', '-created_at')[:5]

    # Recent packout reports (last 5)
    recent_packouts = PackoutReport.objects.filter(
        pool__packinghouse__company=company
    ).select_related('pool', 'field').order_by('-report_date')[:5]

    # Packinghouse breakdown
    packinghouse_summary = Packinghouse.objects.filter(
        company=company,
        is_active=True
    ).annotate(
        active_pools=Count('pools', filter=Q(pools__status='active')),
        season_bins=Coalesce(
            Sum('pools__deliveries__bins', filter=Q(pools__season=current_season)),
            Decimal('0')
        )
    ).values('id', 'name', 'short_code', 'active_pools', 'season_bins')

    return Response({
        'current_season': current_season,
        'active_pools': active_pools,
        'total_bins_this_season': total_bins,
        'pending_settlement': pending_settlement,
        'recent_deliveries': PackinghouseDeliveryListSerializer(recent_deliveries, many=True).data,
        'recent_packouts': PackoutReportListSerializer(recent_packouts, many=True).data,
        'packinghouse_summary': list(packinghouse_summary),
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

        # Run extraction synchronously
        try:
            extraction_service = PDFExtractionService()
            result = extraction_service.extract_from_pdf(
                pdf_path=statement.pdf_file.path,
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

        Expected data:
        - pool_id: Pool to associate with
        - field_id: Field to associate with (optional for settlements)
        - edited_data: Optional edited version of extracted_data
        """
        statement = self.get_object()

        if statement.status not in ['extracted', 'review']:
            return Response(
                {'error': 'Statement must be in extracted or review status to confirm'},
                status=status.HTTP_400_BAD_REQUEST
            )

        pool_id = request.data.get('pool_id')
        field_id = request.data.get('field_id')
        edited_data = request.data.get('edited_data')

        if not pool_id:
            return Response(
                {'error': 'pool_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get pool and field
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

        # Use edited data if provided, otherwise use original extracted data
        data_to_use = edited_data if edited_data else statement.extracted_data

        # Update statement with edited data if provided
        if edited_data:
            statement.extracted_data = edited_data
            statement.save()

        # Create the appropriate record based on statement type
        extraction_service = PDFExtractionService()

        try:
            if statement.statement_type in ['packout', 'wash_report']:
                # Create PackoutReport
                if not field:
                    return Response(
                        {'error': 'field_id is required for packout reports'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

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
            extraction_service = PDFExtractionService()
            result = extraction_service.extract_from_pdf(
                pdf_path=statement.pdf_file.path,
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
