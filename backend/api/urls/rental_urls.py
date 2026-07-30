from django.urls import path
from rest_framework.routers import DefaultRouter

from ..rental_views import (
    LeaseViewSet,
    PortfolioRentRollView,
    RanchRentalSummaryView,
    RentalCategoryViewSet,
    RentalLedgerEntryViewSet,
    RentalPropertyViewSet,
    RentalUnitViewSet,
)

router = DefaultRouter()
router.register(r'rentals/properties', RentalPropertyViewSet, basename='rental-property')
router.register(r'rentals/units', RentalUnitViewSet, basename='rental-unit')
router.register(r'rentals/leases', LeaseViewSet, basename='rental-lease')
router.register(r'rentals/categories', RentalCategoryViewSet, basename='rental-category')
router.register(r'rentals/ledger', RentalLedgerEntryViewSet, basename='rental-ledger')

urlpatterns = router.urls + [
    path(
        'rentals/rent-roll/',
        PortfolioRentRollView.as_view(),
        name='rental-rent-roll',
    ),
    # Hangs off the ranch, not off /rentals/, because it answers a question
    # about a ranch. It deliberately returns no acreage — see
    # RanchRentalSummarySerializer.
    path(
        'farms/<int:farm_id>/rental-summary/',
        RanchRentalSummaryView.as_view(),
        name='farm-rental-summary',
    ),
]
