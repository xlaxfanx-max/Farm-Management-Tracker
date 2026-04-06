from django.urls import path
from rest_framework.routers import DefaultRouter

from ..views import (
    FarmViewSet, FieldViewSet, FarmParcelViewSet,
    CropViewSet, RootstockViewSet,
    geocode_address, update_field_boundary, get_plss,
    PesticideProductViewSet, PesticideApplicationViewSet,
    report_statistics,
)

router = DefaultRouter()
router.register(r'farms', FarmViewSet, basename='farm')
router.register(r'fields', FieldViewSet, basename='field')
router.register(r'farm-parcels', FarmParcelViewSet, basename='farm-parcel')
router.register(r'crops', CropViewSet, basename='crop')
router.register(r'rootstocks', RootstockViewSet, basename='rootstock')
router.register(r'products', PesticideProductViewSet, basename='product')
router.register(r'applications', PesticideApplicationViewSet, basename='application')

urlpatterns = router.urls + [
    path('reports/statistics/', report_statistics, name='report-statistics'),
    path('geocode/', geocode_address, name='geocode-address'),
    path('fields/<int:field_id>/boundary/', update_field_boundary, name='update-field-boundary'),
    path('plss/', get_plss, name='get-plss'),
]
