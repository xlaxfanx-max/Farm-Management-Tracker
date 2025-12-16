from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FarmViewSet, FieldViewSet, PesticideProductViewSet, 
    PesticideApplicationViewSet, WaterSourceViewSet, WaterTestViewSet, 
    report_statistics,
    BuyerViewSet, LaborContractorViewSet, HarvestViewSet, 
    HarvestLoadViewSet, HarvestLaborViewSet,
    geocode_address, update_field_boundary, get_plss
)

router = DefaultRouter()
router.register(r'farms', FarmViewSet, basename='farm')
router.register(r'fields', FieldViewSet, basename='field')
router.register(r'products', PesticideProductViewSet, basename='product')
router.register(r'applications', PesticideApplicationViewSet, basename='application')
router.register(r'water-sources', WaterSourceViewSet, basename='watersource')
router.register(r'water-tests', WaterTestViewSet, basename='watertest')
router.register(r'buyers', BuyerViewSet, basename='buyer')
router.register(r'labor-contractors', LaborContractorViewSet, basename='laborcontractor')
router.register(r'harvests', HarvestViewSet, basename='harvest')
router.register(r'harvest-loads', HarvestLoadViewSet, basename='harvestload')
router.register(r'harvest-labor', HarvestLaborViewSet, basename='harvestlabor')

urlpatterns = [
    path('', include(router.urls)),
    path('reports/statistics/', report_statistics, name='report-statistics'),
    path('geocode/', geocode_address, name='geocode-address'),  
    path('fields/<int:field_id>/boundary/', update_field_boundary, name='update-field-boundary'), 
    path('plss/', get_plss, name='get-plss'),
]