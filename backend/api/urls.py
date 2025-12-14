from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FarmViewSet, FieldViewSet, PesticideProductViewSet, 
    PesticideApplicationViewSet, WaterSourceViewSet, WaterTestViewSet, report_statistics
)

router = DefaultRouter()
router.register(r'farms', FarmViewSet, basename='farm')
router.register(r'fields', FieldViewSet, basename='field')
router.register(r'products', PesticideProductViewSet, basename='product')
router.register(r'applications', PesticideApplicationViewSet, basename='application')
router.register(r'water-sources', WaterSourceViewSet, basename='watersource')
router.register(r'water-tests', WaterTestViewSet, basename='watertest')

urlpatterns = [
    path('', include(router.urls)),
    path('reports/statistics/', report_statistics, name='report-statistics'),
]