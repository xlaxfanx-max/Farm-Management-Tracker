from django.urls import path
from rest_framework.routers import DefaultRouter

from ..views import (
    FertilizerProductViewSet, NutrientApplicationViewSet, NutrientPlanViewSet,
    nitrogen_summary, nitrogen_export,
    check_quarantine_status, get_quarantine_boundaries,
)

from ..season_views import (
    get_season_info,
    get_season_date_range,
    SeasonTemplateViewSet,
    GrowingCycleViewSet,
)

from ..tree_detection_views import TreeSurveyViewSet

from ..yield_views import (
    YieldForecastViewSet,
    YieldFeatureSnapshotViewSet,
    ExternalDataSourceViewSet,
    SoilSurveyDataViewSet,
    yield_forecast_dashboard,
    field_forecast_detail,
    forecast_season_comparison,
)

from ..pur_views import (
    ProductViewSet as UnifiedProductViewSet,
    ApplicatorViewSet,
    ApplicationEventViewSet,
    pur_import_upload,
    pur_import_confirm,
    pur_match_products,
    pur_match_farms,
    pur_import_batches,
    pur_import_batch_detail,
    pur_import_batch_pdf,
)

from ..analytics_views import (
    get_analytics_dashboard,
    get_analytics_summary,
    get_season_dashboard,
    get_multi_crop_season_dashboard,
)

from ..weather_views import (
    get_current_weather,
    get_weather_forecast,
    get_spray_conditions,
    get_spray_thresholds,
    get_all_farms_weather,
)

router = DefaultRouter()

# Nutrient Management
router.register(r'fertilizer-products', FertilizerProductViewSet, basename='fertilizer-product')
router.register(r'nutrient-applications', NutrientApplicationViewSet, basename='nutrient-application')
router.register(r'nutrient-plans', NutrientPlanViewSet, basename='nutrient-plan')

# Season Management
router.register(r'season-templates', SeasonTemplateViewSet, basename='season-template')
router.register(r'growing-cycles', GrowingCycleViewSet, basename='growing-cycle')

# Tree Detection
router.register(r'tree-surveys', TreeSurveyViewSet, basename='tree-survey')

# PUR / Tank Mix
router.register(r'unified-products', UnifiedProductViewSet, basename='unified-product')
router.register(r'applicators', ApplicatorViewSet, basename='applicator')
router.register(r'application-events', ApplicationEventViewSet, basename='application-event')

# Yield Forecast Module
router.register(r'yield-forecast/forecasts', YieldForecastViewSet, basename='yield-forecast')
router.register(r'yield-forecast/feature-snapshots', YieldFeatureSnapshotViewSet, basename='yield-feature-snapshot')
router.register(r'yield-forecast/external-sources', ExternalDataSourceViewSet, basename='external-data-source')
router.register(r'yield-forecast/soil-survey', SoilSurveyDataViewSet, basename='soil-survey')

urlpatterns = router.urls + [
    # Nutrient reports
    path('reports/nitrogen-summary/', nitrogen_summary, name='nitrogen-summary'),
    path('reports/nitrogen-export/', nitrogen_export, name='nitrogen-export'),

    # Quarantine status routes
    path('quarantine/check/', check_quarantine_status, name='quarantine-check'),
    path('quarantine/boundaries/', get_quarantine_boundaries, name='quarantine-boundaries'),

    # Season management routes
    path('seasons/info/', get_season_info, name='season-info'),
    path('seasons/date-range/', get_season_date_range, name='season-date-range'),

    # Analytics routes
    path('analytics/dashboard/', get_analytics_dashboard, name='analytics-dashboard'),
    path('analytics/summary/', get_analytics_summary, name='analytics-summary'),
    path('analytics/season-dashboard/', get_season_dashboard, name='analytics-season-dashboard'),
    path('analytics/multi-crop-seasons/', get_multi_crop_season_dashboard, name='analytics-multi-crop-seasons'),

    # Weather routes
    path('weather/current/<int:farm_id>/', get_current_weather, name='weather-current'),
    path('weather/forecast/<int:farm_id>/', get_weather_forecast, name='weather-forecast'),
    path('weather/spray-conditions/<int:farm_id>/', get_spray_conditions, name='weather-spray-conditions'),
    path('weather/thresholds/', get_spray_thresholds, name='weather-thresholds'),
    path('weather/farms/', get_all_farms_weather, name='weather-all-farms'),

    # PUR Import pipeline
    path('pur-import/upload/', pur_import_upload, name='pur-import-upload'),
    path('pur-import/confirm/', pur_import_confirm, name='pur-import-confirm'),
    path('pur-import/match-products/', pur_match_products, name='pur-match-products'),
    path('pur-import/match-farms/', pur_match_farms, name='pur-match-farms'),
    path('pur-import/batches/', pur_import_batches, name='pur-import-batches'),
    path('pur-import/batches/<str:batch_id>/', pur_import_batch_detail, name='pur-import-batch-detail'),
    path('pur-import/batches/<str:batch_id>/pdf/', pur_import_batch_pdf, name='pur-import-batch-pdf'),

    # Yield Forecast analytics routes
    path('yield-forecast/dashboard/', yield_forecast_dashboard, name='yield-forecast-dashboard'),
    path('yield-forecast/fields/<int:field_id>/detail/', field_forecast_detail, name='yield-forecast-field-detail'),
    path('yield-forecast/season-comparison/', forecast_season_comparison, name='yield-forecast-season-comparison'),
]
