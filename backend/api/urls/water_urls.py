from django.urls import path
from rest_framework.routers import DefaultRouter

from ..views import (
    WaterSourceViewSet, WaterTestViewSet,
    WellViewSet, WellReadingViewSet, MeterCalibrationViewSet,
    WaterAllocationViewSet, ExtractionReportViewSet, IrrigationEventViewSet,
    sgma_dashboard, load_water_data_api,
)

router = DefaultRouter()
router.register(r'water-sources', WaterSourceViewSet, basename='watersource')
router.register(r'water-tests', WaterTestViewSet, basename='watertest')
router.register(r'wells', WellViewSet, basename='well')
router.register(r'well-readings', WellReadingViewSet, basename='well-reading')
router.register(r'meter-calibrations', MeterCalibrationViewSet, basename='meter-calibration')
router.register(r'water-allocations', WaterAllocationViewSet, basename='water-allocation')
router.register(r'extraction-reports', ExtractionReportViewSet, basename='extraction-report')
router.register(r'irrigation-events', IrrigationEventViewSet, basename='irrigation-event')

urlpatterns = router.urls + [
    path('sgma/dashboard/', sgma_dashboard, name='sgma-dashboard'),
    path('sgma/load-water-data/', load_water_data_api, name='load-water-data'),
]
