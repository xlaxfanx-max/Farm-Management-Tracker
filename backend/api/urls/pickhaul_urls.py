from django.urls import path
from rest_framework.routers import DefaultRouter

from ..pickhaul_views import (
    PickHaulCheckResultViewSet,
    PickHaulDirectChargeViewSet,
    PickHaulEntitiesView,
    PickHaulHarvestActivityView,
    PickHaulInvoiceViewSet,
    PickHaulManualPickViewSet,
    PickHaulReceiptViewSet,
    PickHaulSummaryView,
    PickHaulSyncBatchViewSet,
    PickHaulSyncStatusView,
    PickHaulSyncView,
)

router = DefaultRouter()
router.register(r'pickhaul/invoices', PickHaulInvoiceViewSet, basename='pickhaul-invoice')
router.register(r'pickhaul/manual-picks', PickHaulManualPickViewSet, basename='pickhaul-manual-pick')
router.register(r'pickhaul/receipts', PickHaulReceiptViewSet, basename='pickhaul-receipt')
router.register(r'pickhaul/house-charges', PickHaulDirectChargeViewSet, basename='pickhaul-charge')
router.register(r'pickhaul/checks', PickHaulCheckResultViewSet, basename='pickhaul-check')
router.register(r'pickhaul/sync-batches', PickHaulSyncBatchViewSet, basename='pickhaul-sync-batch')

urlpatterns = router.urls + [
    path('pickhaul/sync/', PickHaulSyncView.as_view(), name='pickhaul-sync'),
    path('pickhaul/entities/', PickHaulEntitiesView.as_view(), name='pickhaul-entities'),
    path('pickhaul/harvest-activity/', PickHaulHarvestActivityView.as_view(), name='pickhaul-harvest-activity'),
    path('pickhaul/summary/aging/', PickHaulSummaryView.as_view(), name='pickhaul-summary-aging'),
    path('pickhaul/sync-status/', PickHaulSyncStatusView.as_view(), name='pickhaul-sync-status'),
]
