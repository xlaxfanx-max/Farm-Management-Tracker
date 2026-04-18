from django.urls import path
from rest_framework.routers import DefaultRouter

from ..views import (
    BuyerViewSet, LaborContractorViewSet,
    HarvestViewSet, HarvestLoadViewSet, HarvestLaborViewSet,
)
from ..crop_report_views import crop_report_list, crop_report_detail

router = DefaultRouter()
router.register(r'buyers', BuyerViewSet, basename='buyer')
router.register(r'labor-contractors', LaborContractorViewSet, basename='laborcontractor')
router.register(r'harvests', HarvestViewSet, basename='harvest')
router.register(r'harvest-loads', HarvestLoadViewSet, basename='harvestload')
router.register(r'harvest-labor', HarvestLaborViewSet, basename='harvestlabor')

urlpatterns = router.urls + [
    path('crop-reports/', crop_report_list, name='crop-report-list'),
    path('crop-reports/detail/', crop_report_detail, name='crop-report-detail'),
]
