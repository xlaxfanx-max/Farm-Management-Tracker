"""
Packinghouse Pool Tracking Views
================================
ViewSets and API views for the packinghouse pool tracking module.
Handles deliveries, packout reports, settlements, and grower ledger entries.
Supports commodity-aware units (bins for citrus, lbs for avocados).
"""

from rest_framework import status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .view_helpers import CompanyFilteredViewSet
from django.db.models import Sum, Avg, Count, F, Q, Subquery, OuterRef, DecimalField
from django.db.models.functions import Coalesce
from django.db import transaction
from decimal import Decimal
import logging
import re

from .models import (
    Packinghouse, Pool, PackinghouseDelivery,
    PackoutReport, PackoutGradeLine,
    PoolSettlement, SettlementGradeLine, SettlementDeduction,
    GrowerLedgerEntry, Field, PackinghouseStatement,
    Harvest, StatementBatchUpload, PackinghouseGrowerMapping, Farm
)
from .services.settlement_service import finalize_settlement as _finalize_settlement
from .services.season_service import (
    SeasonService, get_citrus_season, parse_legacy_season,
    get_crop_category_for_commodity, parse_season_for_category,
    normalize_commodity
)
from .services.packinghouse_analytics import PackinghouseAnalyticsService

logger = logging.getLogger(__name__)


def _annotate_pool_aggregates(queryset):
    """
    Annotate a Pool queryset with delivery_count, total_bins, and total_weight
    to eliminate N+1 queries when serializing pool lists.

    Logic mirrors the Pool model properties:
    - total_bins: packout_reports.bins_this_period if any, else deliveries.bins
    - total_weight: first settlement's total_weight_lbs if any, else deliveries.weight_lbs
    - delivery_count: count of deliveries
    """
    return queryset.annotate(
        _delivery_count=Count('deliveries', distinct=True),
        _packout_bins=Coalesce(
            Sum('packout_reports__bins_this_period'),
            Decimal('0'),
            output_field=DecimalField(),
        ),
        _delivery_bins=Coalesce(
            Sum('deliveries__bins'),
            Decimal('0'),
            output_field=DecimalField(),
        ),
        _settlement_weight=Subquery(
            PoolSettlement.objects.filter(
                pool=OuterRef('pk')
            ).order_by('-statement_date').values('total_weight_lbs')[:1],
            output_field=DecimalField(),
        ),
        _delivery_weight=Coalesce(
            Sum('deliveries__weight_lbs'),
            Decimal('0'),
            output_field=DecimalField(),
        ),
    )


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

class PackinghouseViewSet(CompanyFilteredViewSet):
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
    model = Packinghouse
    company_field = 'company'
    default_ordering = ('name',)

    def get_queryset(self):
        # Need to add pool_count annotation beyond standard filtering
        return super().get_queryset().annotate(
            pool_count_annotated=Count('pools')
        )

    def filter_queryset_by_params(self, queryset):
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return PackinghouseListSerializer
        return PackinghouseSerializer

    @action(detail=True, methods=['get'])
    def pools(self, request, pk=None):
        """Get all pools for a packinghouse."""
        packinghouse = self.get_object()
        pools = _annotate_pool_aggregates(
            Pool.objects.filter(
                packinghouse=packinghouse
            ).select_related('packinghouse')
        )

        # Filter by status
        pool_status = request.query_params.get('status')
        if pool_status:
            pools = pools.filter(status=pool_status)

        # Filter by season
        season = request.query_params.get('season')
        if season:
            pools = pools.filter(season=season)

        page = self.paginate_queryset(pools)
        if page is not None:
            serializer = PoolListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = PoolListSerializer(pools, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def ledger(self, request, pk=None):
        """Get ledger entries for a packinghouse."""
        packinghouse = self.get_object()
        entries = GrowerLedgerEntry.objects.filter(
            packinghouse=packinghouse
        ).select_related('packinghouse', 'pool').order_by('-entry_date', '-created_at')

        # Date range filter
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            entries = entries.filter(entry_date__gte=start_date)
        if end_date:
            entries = entries.filter(entry_date__lte=end_date)

        page = self.paginate_queryset(entries)
        if page is not None:
            serializer = GrowerLedgerEntryListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = GrowerLedgerEntryListSerializer(entries, many=True)
        return Response(serializer.data)


class PoolViewSet(CompanyFilteredViewSet):
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
    model = Pool
    company_field = 'packinghouse__company'
    select_related_fields = ('packinghouse',)
    default_ordering = ('-season', 'commodity', 'name')

    def get_queryset(self):
        # Need to add pool aggregate annotations beyond standard filtering
        return _annotate_pool_aggregates(super().get_queryset())

    def filter_queryset_by_params(self, queryset):
        packinghouse_id = self.request.query_params.get('packinghouse')
        if packinghouse_id:
            queryset = queryset.filter(packinghouse_id=packinghouse_id)

        pool_status = self.request.query_params.get('status')
        if pool_status:
            queryset = queryset.filter(status=pool_status)

        season = self.request.query_params.get('season')
        if season:
            queryset = queryset.filter(season=season)

        commodity = self.request.query_params.get('commodity')
        if commodity:
            queryset = queryset.filter(commodity__icontains=commodity)

        return queryset

    def perform_create(self, serializer):
        # Company is established through packinghouse FK (provided in request data)
        serializer.save()

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

        page = self.paginate_queryset(deliveries)
        if page is not None:
            serializer = PackinghouseDeliveryListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
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

        page = self.paginate_queryset(reports)
        if page is not None:
            serializer = PackoutReportListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
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

        page = self.paginate_queryset(settlements)
        if page is not None:
            serializer = PoolSettlementListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
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


class PackinghouseDeliveryViewSet(CompanyFilteredViewSet):
    """
    ViewSet for PackinghouseDelivery CRUD operations.

    list: GET /api/packinghouse-deliveries/
    create: POST /api/packinghouse-deliveries/
    retrieve: GET /api/packinghouse-deliveries/{id}/
    update: PUT /api/packinghouse-deliveries/{id}/
    partial_update: PATCH /api/packinghouse-deliveries/{id}/
    destroy: DELETE /api/packinghouse-deliveries/{id}/
    """
    model = PackinghouseDelivery
    company_field = 'pool__packinghouse__company'
    select_related_fields = ('pool', 'pool__packinghouse', 'field', 'field__farm', 'harvest')
    default_ordering = ('-delivery_date', '-created_at')

    def filter_queryset_by_params(self, queryset):
        pool_id = self.request.query_params.get('pool')
        if pool_id:
            queryset = queryset.filter(pool_id=pool_id)

        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        packinghouse_id = self.request.query_params.get('packinghouse')
        if packinghouse_id:
            queryset = queryset.filter(pool__packinghouse_id=packinghouse_id)

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(delivery_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(delivery_date__lte=end_date)

        return queryset

    def perform_create(self, serializer):
        # Company is established through pool FK (provided in request data)
        serializer.save()

    def get_serializer_class(self):
        if self.action == 'list':
            return PackinghouseDeliveryListSerializer
        return PackinghouseDeliverySerializer


class PackoutReportViewSet(CompanyFilteredViewSet):
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
    model = PackoutReport
    company_field = 'pool__packinghouse__company'
    select_related_fields = ('pool', 'pool__packinghouse', 'field', 'field__farm')
    prefetch_related_fields = ('grade_lines',)
    default_ordering = ('-report_date',)

    def filter_queryset_by_params(self, queryset):
        pool_id = self.request.query_params.get('pool')
        if pool_id:
            queryset = queryset.filter(pool_id=pool_id)

        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        packinghouse_id = self.request.query_params.get('packinghouse')
        if packinghouse_id:
            queryset = queryset.filter(pool__packinghouse_id=packinghouse_id)

        commodity = self.request.query_params.get('commodity')
        if commodity:
            queryset = queryset.filter(pool__commodity__iexact=commodity)

        season = self.request.query_params.get('season')
        if season:
            queryset = queryset.filter(pool__season=season)

        return queryset

    def perform_create(self, serializer):
        # Company is established through pool FK (provided in request data)
        serializer.save()

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


class PoolSettlementViewSet(CompanyFilteredViewSet):
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
    model = PoolSettlement
    company_field = 'pool__packinghouse__company'
    select_related_fields = ('pool', 'pool__packinghouse', 'field', 'field__farm', 'source_statement')
    prefetch_related_fields = ('grade_lines', 'deductions')
    default_ordering = ('-statement_date',)

    def filter_queryset_by_params(self, queryset):
        pool_id = self.request.query_params.get('pool')
        if pool_id:
            queryset = queryset.filter(pool_id=pool_id)

        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        packinghouse_id = self.request.query_params.get('packinghouse')
        if packinghouse_id:
            queryset = queryset.filter(pool__packinghouse_id=packinghouse_id)

        commodity = self.request.query_params.get('commodity')
        if commodity:
            queryset = queryset.filter(pool__commodity__iexact=commodity)

        season = self.request.query_params.get('season')
        if season:
            queryset = queryset.filter(pool__season=season)

        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return PoolSettlementListSerializer
        if self.action == 'create':
            return PoolSettlementCreateSerializer
        return PoolSettlementSerializer

    def perform_create(self, serializer):
        with transaction.atomic():
            settlement = serializer.save()
            self._settlement_warnings = _finalize_settlement(settlement)

    def perform_update(self, serializer):
        with transaction.atomic():
            settlement = serializer.save()
            self._settlement_warnings = _finalize_settlement(settlement)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        warnings = getattr(self, '_settlement_warnings', None)
        if warnings and isinstance(response.data, dict):
            response.data['warnings'] = warnings
        return response

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        warnings = getattr(self, '_settlement_warnings', None)
        if warnings and isinstance(response.data, dict):
            response.data['warnings'] = warnings
        return response

    def partial_update(self, request, *args, **kwargs):
        response = super().partial_update(request, *args, **kwargs)
        warnings = getattr(self, '_settlement_warnings', None)
        if warnings and isinstance(response.data, dict):
            response.data['warnings'] = warnings
        return response

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
            with transaction.atomic():
                for item in serializer.validated_data:
                    SettlementGradeLine.objects.create(
                        settlement=settlement,
                        **item
                    )
                warnings = _finalize_settlement(settlement)
            return Response({
                'grade_lines': serializer.data,
                'warnings': warnings,
            }, status=status.HTTP_201_CREATED)
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
            with transaction.atomic():
                for item in serializer.validated_data:
                    SettlementDeduction.objects.create(
                        settlement=settlement,
                        **item
                    )
                warnings = _finalize_settlement(settlement)
            return Response({
                'deductions': serializer.data,
                'warnings': warnings,
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GrowerLedgerEntryViewSet(CompanyFilteredViewSet):
    """
    ViewSet for GrowerLedgerEntry CRUD operations.

    list: GET /api/grower-ledger/
    create: POST /api/grower-ledger/
    retrieve: GET /api/grower-ledger/{id}/
    update: PUT /api/grower-ledger/{id}/
    partial_update: PATCH /api/grower-ledger/{id}/
    destroy: DELETE /api/grower-ledger/{id}/
    """
    model = GrowerLedgerEntry
    company_field = 'packinghouse__company'
    select_related_fields = ('packinghouse', 'pool')
    default_ordering = ('-entry_date', '-created_at')

    def filter_queryset_by_params(self, queryset):
        packinghouse_id = self.request.query_params.get('packinghouse')
        if packinghouse_id:
            queryset = queryset.filter(packinghouse_id=packinghouse_id)

        pool_id = self.request.query_params.get('pool')
        if pool_id:
            queryset = queryset.filter(pool_id=pool_id)

        entry_type = self.request.query_params.get('entry_type')
        if entry_type:
            queryset = queryset.filter(entry_type=entry_type)

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(entry_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(entry_date__lte=end_date)

        return queryset

    def perform_create(self, serializer):
        # Company is established through packinghouse FK (provided in request data)
        serializer.save()

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
    """Profitability analysis from packinghouse settlements."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    result = PackinghouseAnalyticsService.profitability_analysis(
        company=user.current_company,
        season_id=request.query_params.get('season'),
        field_id=request.query_params.get('field_id'),
        packinghouse_id=request.query_params.get('packinghouse'),
    )
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def deduction_breakdown(request):
    """Detailed breakdown of packinghouse deductions by category."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    result = PackinghouseAnalyticsService.deduction_breakdown(
        company=user.current_company,
        season_id=request.query_params.get('season'),
        field_id=request.query_params.get('field_id'),
        packinghouse_id=request.query_params.get('packinghouse'),
    )
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def season_comparison(request):
    """Year-over-year comparison of profitability metrics."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    result = PackinghouseAnalyticsService.season_comparison(
        company=user.current_company,
        field_id=request.query_params.get('field_id'),
        packinghouse_id=request.query_params.get('packinghouse'),
    )
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def block_performance(request):
    """Compare pack percentages and returns across blocks."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    results = PackinghouseAnalyticsService.block_performance(
        company=user.current_company,
        season=request.query_params.get('season'),
        packinghouse_id=request.query_params.get('packinghouse'),
        commodity=request.query_params.get('commodity'),
    )
    serializer = BlockPerformanceSerializer(results, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def packout_trends(request):
    """Get packout percentage trends over time."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    results = PackinghouseAnalyticsService.packout_trends(
        company=user.current_company,
        field_id=request.query_params.get('field'),
        pool_id=request.query_params.get('pool'),
        start_date=request.query_params.get('start_date'),
        end_date=request.query_params.get('end_date'),
    )
    serializer = PackoutTrendSerializer(results, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def settlement_comparison(request):
    """Compare returns across packinghouses for the same commodity/season."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    season = request.query_params.get('season')
    if not season:
        return Response({'error': 'Season parameter required'}, status=400)

    results = PackinghouseAnalyticsService.settlement_comparison(
        company=user.current_company,
        season=season,
        commodity=request.query_params.get('commodity'),
    )
    serializer = SettlementComparisonSerializer(results, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def size_distribution(request):
    """Fruit size distribution across farms/fields from packout reports."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    result = PackinghouseAnalyticsService.size_distribution(
        company=user.current_company,
        season=request.query_params.get('season'),
        packinghouse_id=request.query_params.get('packinghouse'),
        commodity=request.query_params.get('commodity'),
        group_by=request.query_params.get('group_by', 'farm'),
    )
    return Response({
        'groups': SizeDistributionGroupSerializer(result['groups'], many=True).data,
        'all_sizes': result['all_sizes'],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def size_pricing(request):
    """FOB pricing and revenue by fruit size from settlement grade lines."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    result = PackinghouseAnalyticsService.size_pricing(
        company=user.current_company,
        season=request.query_params.get('season'),
        packinghouse_id=request.query_params.get('packinghouse'),
        commodity=request.query_params.get('commodity'),
        group_by=request.query_params.get('group_by', 'none'),
    )
    return Response({
        'sizes': SizePricingEntrySerializer(result['sizes'], many=True).data,
        'totals': result['totals'],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def packinghouse_dashboard(request):
    """Get dashboard summary for packinghouse module."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    result = PackinghouseAnalyticsService.packinghouse_dashboard(
        company=user.current_company,
        season_id=request.query_params.get('season'),
    )
    # Serialize the queryset fields that the service returns as raw querysets
    result['recent_deliveries'] = PackinghouseDeliveryListSerializer(result['recent_deliveries'], many=True).data
    result['recent_packouts'] = PackoutReportListSerializer(result['recent_packouts'], many=True).data
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def harvest_packing_pipeline(request):
    """Get unified pipeline overview: Harvest -> Delivery -> Packout -> Settlement."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    result = PackinghouseAnalyticsService.harvest_packing_pipeline(
        company=user.current_company,
        selected_commodity=request.query_params.get('commodity'),
        season_id=request.query_params.get('season'),
        breakdown_param=request.query_params.get('breakdown'),
    )
    return Response(result)


# =============================================================================
# PACKINGHOUSE STATEMENT UPLOAD & EXTRACTION
# =============================================================================

class PackinghouseStatementViewSet(CompanyFilteredViewSet):
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
    model = PackinghouseStatement
    company_field = 'packinghouse__company'
    select_related_fields = ('packinghouse', 'pool', 'field', 'field__farm', 'uploaded_by')
    default_ordering = ('-created_at',)
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def filter_queryset_by_params(self, queryset):
        packinghouse_id = self.request.query_params.get('packinghouse')
        if packinghouse_id:
            queryset = queryset.filter(packinghouse_id=packinghouse_id)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        statement_type = self.request.query_params.get('statement_type')
        if statement_type:
            queryset = queryset.filter(statement_type=statement_type)

        pool_id = self.request.query_params.get('pool')
        if pool_id:
            queryset = queryset.filter(pool_id=pool_id)

        return queryset

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
        pdf_file_to_delete = statement.pdf_file if statement.pdf_file else None

        with transaction.atomic():
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

            # Delete the statement
            statement.delete()
            logger.info(f"Deleted statement {statement.id}")

        # Delete the PDF file AFTER transaction commits (filesystem I/O outside atomic)
        if pdf_file_to_delete:
            try:
                pdf_file_to_delete.delete(save=False)
            except Exception as e:
                logger.warning(f"Failed to delete PDF file for statement: {e}")

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
            statement.extraction_error = 'PDF extraction failed. Please try uploading again.'
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
        farm_id = request.data.get('farm_id')
        edited_data = request.data.get('edited_data')
        save_mappings = request.data.get('save_mappings', False)

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
            commodity = normalize_commodity(header.get('commodity', 'CITRUS'))
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
            # 1. Derive from period_end → period_start → report_date (most reliable)
            # 2. Use extracted_season, but validate/correct bare years for cross-year crops
            # 3. Final fallback: current season

            logger.info(f"Season derivation - extracted_season: {extracted_season}, period_end: {header.get('period_end')}, period_start: {header.get('period_start')}, report_date: {header.get('report_date')}")

            # Try date-based derivation first (most reliable for all statement types)
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

            # Fall back to extracted season, but validate bare years against commodity season format
            if not season and extracted_season:
                config = season_service._get_season_config(field_id=None, crop_category=crop_category)
                bare_year_match = re.match(r'^(\d{4})$', extracted_season.strip())
                if bare_year_match and config.get('crosses_calendar_year'):
                    harvest_year = int(bare_year_match.group(1))
                    mid_season_date = date_module(harvest_year, 6, 1)
                    season_period = season_service.get_current_season(
                        crop_category=crop_category,
                        target_date=mid_season_date
                    )
                    season = season_period.label
                    logger.info(f"Converted bare year '{extracted_season}' to cross-year season: {season}")
                else:
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

        farm = None
        if farm_id:
            try:
                farm = Farm.objects.get(
                    id=farm_id,
                    company=request.user.current_company
                )
            except Farm.DoesNotExist:
                pass  # Non-critical — farm is only used for mapping

        # Update statement with edited data if provided
        if edited_data:
            statement.extracted_data = edited_data
            statement.save()

        # Check if records were already created for this statement
        existing_packout = PackoutReport.objects.filter(source_statement=statement).first()
        existing_settlement = PoolSettlement.objects.filter(source_statement=statement).first()

        # Save grower-to-farm mapping and update auto_match_result
        def _save_grower_mapping():
            # Always update auto_match_result so farm/field persist on reopen
            if farm or field:
                match_data = statement.auto_match_result or {}
                if farm:
                    match_data['farm'] = {'id': farm.id, 'name': farm.name}
                if field:
                    match_data['field'] = {'id': field.id, 'name': field.name}
                statement.auto_match_result = match_data
                statement.save(update_fields=['auto_match_result'])

            if not save_mappings or not farm:
                return
            try:
                matcher = StatementMatcher(request.user.current_company)
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
            except Exception as e:
                logger.warning(f"Failed to save grower mapping: {e}")

        if existing_packout or existing_settlement:
            # Already processed - update existing records with edited data
            extraction_service = PDFExtractionService()

            if existing_packout:
                with transaction.atomic():
                    statement.pool = pool
                    statement.field = field
                    statement.status = 'completed'
                    statement.save()

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

                # Mapping save outside atomic block (non-critical)
                _save_grower_mapping()

                return Response({
                    'success': True,
                    'message': 'Packout report updated successfully' if edited_data else 'Statement was already processed. Packout report exists.',
                    'packout_report_id': existing_packout.id,
                    'statement_id': statement.id
                })
            else:
                # Update the settlement with edited data
                warnings = []
                with transaction.atomic():
                    statement.pool = pool
                    statement.field = field
                    statement.status = 'completed'
                    statement.save()

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

                        warnings = _finalize_settlement(existing_settlement)

                        logger.info(f"Updated existing settlement {existing_settlement.id} with edited data")

                # Mapping save outside atomic block (non-critical)
                _save_grower_mapping()

                response_data = {
                    'success': True,
                    'message': 'Settlement updated successfully' if edited_data else 'Statement was already processed. Settlement exists.',
                    'settlement_id': existing_settlement.id,
                    'statement_id': statement.id
                }
                if edited_data and warnings:
                    response_data['warnings'] = warnings

                return Response(response_data)

        # Create the appropriate record based on statement type
        extraction_service = PDFExtractionService()

        try:
            if statement.statement_type in ['packout', 'wash_report']:
                with transaction.atomic():
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

                # Mapping save outside atomic block (non-critical)
                _save_grower_mapping()

                return Response({
                    'success': True,
                    'message': 'Packout report created successfully',
                    'packout_report_id': packout_report.id,
                    'statement_id': statement.id
                })

            elif statement.statement_type in ['settlement', 'grower_statement']:
                with transaction.atomic():
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

                    warnings = _finalize_settlement(settlement)

                    statement.pool = pool
                    statement.field = field
                    statement.status = 'completed'
                    statement.save()

                # Mapping save outside atomic block (non-critical)
                _save_grower_mapping()

                response_data = {
                    'success': True,
                    'message': 'Pool settlement created successfully',
                    'settlement_id': settlement.id,
                    'statement_id': statement.id
                }
                if warnings:
                    response_data['warnings'] = warnings

                return Response(response_data)

            else:
                return Response(
                    {'error': f'Unknown statement type: {statement.statement_type}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.exception(f"Error creating record from statement {statement.id}")
            return Response(
                {'error': 'Failed to create record. Please check the extracted data and try again.'},
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
            return HttpResponse('Error loading PDF. The file may be unavailable.', status=500)

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
                        extraction_error='PDF extraction failed. Please try uploading again.'
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
                    'extraction_error': 'Failed to process PDF file.',
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
                settlement_warnings = []
                data_to_use = statement.extracted_data

                with transaction.atomic():
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

                        settlement_warnings = _finalize_settlement(settlement)

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

                    # Update statement (inside atomic)
                    statement.pool = pool
                    statement.field = field
                    statement.status = 'completed'
                    statement.save()

                # Save mapping if requested (outside atomic block, non-critical)
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

                result_item = {
                    'id': statement_id,
                    'filename': statement.original_filename,
                    'success': True,
                    'message': 'Confirmed',
                    'settlement_id': settlement_id,
                    'packout_report_id': packout_report_id,
                    'mapping_saved': mapping_saved
                }
                if settlement_warnings:
                    result_item['warnings'] = settlement_warnings
                results.append(result_item)
                confirmed_count += 1

            except Exception as e:
                logger.exception(f"Error confirming statement {statement_id}")
                results.append({
                    'id': statement_id,
                    'filename': statement.original_filename,
                    'success': False,
                    'message': 'Failed to confirm statement. Please try again.',
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
        commodity = normalize_commodity(header.get('commodity', 'CITRUS'))
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
        # 1. Derive from period_end → period_start → report_date (most reliable)
        # 2. Use extracted_season, but validate/correct bare years for cross-year crops
        # 3. Final fallback: current season

        # Try date-based derivation first (most reliable for all statement types)
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

        # Fall back to extracted season, but validate bare years against commodity season format
        if not season and extracted_season:
            config = season_service._get_season_config(field_id=None, crop_category=crop_category)
            bare_year_match = re.match(r'^(\d{4})$', extracted_season.strip())
            if bare_year_match and config.get('crosses_calendar_year'):
                # AI extracted a bare year like "2025" but this commodity uses cross-year
                # seasons (e.g., avocado "2024-2025"). Convert: a bare year typically refers
                # to the harvest year, so the season started the prior year.
                harvest_year = int(bare_year_match.group(1))
                start_month = config['start_month']
                # Use mid-season date in the harvest year to get the correct season label
                mid_season_date = date_module(harvest_year, 6, 1)
                season_period = season_service.get_current_season(
                    crop_category=crop_category,
                    target_date=mid_season_date
                )
                season = season_period.label
            else:
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


# =============================================================================
# SETTLEMENT INTELLIGENCE ANALYTICS
# =============================================================================


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def commodity_roi_ranking(request):
    """Rank commodities (or varieties) by net return per bin."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    result = PackinghouseAnalyticsService.commodity_roi_ranking(
        company=user.current_company,
        season_id=request.query_params.get('season'),
        packinghouse_id=request.query_params.get('packinghouse'),
        group_by=request.query_params.get('group_by', 'commodity'),
    )
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def deduction_creep_analysis(request):
    """Track deduction rates per bin across multiple seasons to reveal cost creep."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    result = PackinghouseAnalyticsService.deduction_creep_analysis(
        company=user.current_company,
        packinghouse_id=request.query_params.get('packinghouse'),
        commodity=request.query_params.get('commodity'),
    )
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def grade_size_price_trends(request):
    """Track FOB pricing trends by grade and size across multiple seasons."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    result = PackinghouseAnalyticsService.grade_size_price_trends(
        company=user.current_company,
        packinghouse_id=request.query_params.get('packinghouse'),
        commodity=request.query_params.get('commodity'),
        grade=request.query_params.get('grade'),
    )
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def packinghouse_report_card(request):
    """Side-by-side packinghouse comparison showing key performance metrics."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    result = PackinghouseAnalyticsService.packinghouse_report_card(
        company=user.current_company,
        season_id=request.query_params.get('season'),
        commodity=request.query_params.get('commodity'),
    )
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pack_percent_impact(request):
    """Correlate pack percentage with net return per bin to quantify impact."""
    user = request.user
    if not user.current_company:
        return Response({'error': 'No company selected'}, status=400)

    result = PackinghouseAnalyticsService.pack_percent_impact(
        company=user.current_company,
        packinghouse_id=request.query_params.get('packinghouse'),
        commodity=request.query_params.get('commodity'),
    )
    return Response(result)
