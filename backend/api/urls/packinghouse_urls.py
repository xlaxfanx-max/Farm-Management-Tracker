from django.urls import path
from rest_framework.routers import DefaultRouter

from ..packinghouse_views import (
    PackinghouseViewSet,
    PoolViewSet,
    PackinghouseDeliveryViewSet,
    PackoutReportViewSet,
    PoolSettlementViewSet,
    GrowerLedgerEntryViewSet,
    PackinghouseStatementViewSet,
    block_performance,
    packout_trends,
    settlement_comparison,
    size_distribution,
    size_pricing,
    packinghouse_dashboard,
    harvest_packing_pipeline,
    profitability_analysis,
    deduction_breakdown,
    season_comparison,
    # Settlement Intelligence
    commodity_roi_ranking,
    deduction_creep_analysis,
    grade_size_price_trends,
    packinghouse_report_card,
    pack_percent_impact,
)

router = DefaultRouter()
router.register(r'packinghouses', PackinghouseViewSet, basename='packinghouse')
router.register(r'pools', PoolViewSet, basename='pool')
router.register(r'packinghouse-deliveries', PackinghouseDeliveryViewSet, basename='packinghouse-delivery')
router.register(r'packout-reports', PackoutReportViewSet, basename='packout-report')
router.register(r'pool-settlements', PoolSettlementViewSet, basename='pool-settlement')
router.register(r'grower-ledger', GrowerLedgerEntryViewSet, basename='grower-ledger')
router.register(r'packinghouse-statements', PackinghouseStatementViewSet, basename='packinghouse-statement')

urlpatterns = router.urls + [
    # Packinghouse Pool Tracking analytics routes
    path('packinghouse-analytics/block-performance/', block_performance, name='packinghouse-block-performance'),
    path('packinghouse-analytics/packout-trends/', packout_trends, name='packinghouse-packout-trends'),
    path('packinghouse-analytics/settlement-comparison/', settlement_comparison, name='packinghouse-settlement-comparison'),
    path('packinghouse-analytics/size-distribution/', size_distribution, name='packinghouse-size-distribution'),
    path('packinghouse-analytics/size-pricing/', size_pricing, name='packinghouse-size-pricing'),
    path('packinghouse-analytics/dashboard/', packinghouse_dashboard, name='packinghouse-dashboard'),
    path('harvest-packing/pipeline/', harvest_packing_pipeline, name='harvest-packing-pipeline'),

    # Settlement Intelligence analytics routes
    path('packinghouse-analytics/commodity-roi/', commodity_roi_ranking, name='packinghouse-commodity-roi'),
    path('packinghouse-analytics/deduction-creep/', deduction_creep_analysis, name='packinghouse-deduction-creep'),
    path('packinghouse-analytics/price-trends/', grade_size_price_trends, name='packinghouse-price-trends'),
    path('packinghouse-analytics/report-card/', packinghouse_report_card, name='packinghouse-report-card'),
    path('packinghouse-analytics/pack-impact/', pack_percent_impact, name='packinghouse-pack-impact'),

    # Profitability Analytics routes
    path('harvest-analytics/profitability/', profitability_analysis, name='harvest-profitability'),
    path('harvest-analytics/deductions/', deduction_breakdown, name='harvest-deductions'),
    path('harvest-analytics/seasons/', season_comparison, name='harvest-season-comparison'),
]
