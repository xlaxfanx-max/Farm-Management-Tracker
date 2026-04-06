from rest_framework.routers import DefaultRouter

from ..views import (
    BuyerViewSet, LaborContractorViewSet,
    HarvestViewSet, HarvestLoadViewSet, HarvestLaborViewSet,
)

router = DefaultRouter()
router.register(r'buyers', BuyerViewSet, basename='buyer')
router.register(r'labor-contractors', LaborContractorViewSet, basename='laborcontractor')
router.register(r'harvests', HarvestViewSet, basename='harvest')
router.register(r'harvest-loads', HarvestLoadViewSet, basename='harvestload')
router.register(r'harvest-labor', HarvestLaborViewSet, basename='harvestlabor')

urlpatterns = router.urls
