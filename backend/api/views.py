# =============================================================================
# Re-export hub for backward compatibility
# =============================================================================
# All views have been split into domain-specific files.
# urls.py imports from .views, so all exports must be preserved here.
#
# Domain files:
#   farm_views.py        - FarmViewSet, FieldViewSet, CropViewSet, RootstockViewSet, FarmParcelViewSet
#   pesticide_views.py   - PesticideProductViewSet, PesticideApplicationViewSet
#   water_views.py       - WaterSourceViewSet, WaterTestViewSet
#   report_views.py      - report_statistics
#   harvest_views.py     - BuyerViewSet, LaborContractorViewSet, HarvestViewSet, HarvestLoadViewSet, HarvestLaborViewSet
#   sgma_views.py        - WellViewSet, WellReadingViewSet, MeterCalibrationViewSet, WaterAllocationViewSet,
#                          ExtractionReportViewSet, IrrigationEventViewSet, sgma_dashboard,
#                          get_plss_from_coordinates, geocode_address, update_field_boundary, get_plss
#   nutrient_views.py    - FertilizerProductViewSet, NutrientApplicationViewSet, NutrientPlanViewSet,
#                          nitrogen_summary, nitrogen_export
#   quarantine_views.py  - check_quarantine_status, get_quarantine_boundaries
#   irrigation_views.py  - IrrigationZoneViewSet, IrrigationRecommendationViewSet,
#                          CropCoefficientProfileViewSet, SoilMoistureReadingViewSet,
#                          irrigation_dashboard, cimis_stations
#   water_data_views.py  - load_water_data_api
# =============================================================================

from .farm_views import *
from .pesticide_views import *
from .water_views import *
from .report_views import *
from .harvest_views import *
from .sgma_views import *
from .nutrient_views import *
from .quarantine_views import *
from .irrigation_views import *
from .water_data_views import *
