"""
api.models package — re-exports every public name so that existing imports
(``from api.models import X`` / ``from .models import X``) keep working.
"""

# -- helpers & mixins --------------------------------------------------------
from .base import (
    LocationMixin,
    default_deadline_reminder_days,
    default_license_reminder_days,
)

# -- auth / company ----------------------------------------------------------
from .auth import (
    UserManager,
    Company,
    User,
    Role,
    Permission,
    CompanyMembership,
    Invitation,
    PasswordResetToken,
    AuditLog,
)

# -- farm / field / crop / pesticide -----------------------------------------
from .farm import (
    Farm,
    FarmParcel,
    CropCategory,
    CropType,
    SeasonType,
    SeasonTemplate,
    Crop,
    Rootstock,
    Field,
    GrowingCycleStatus,
    GrowingCycle,
    PesticideProduct,
    PesticideApplication,
    CROP_VARIETY_CHOICES,
    DEFAULT_BIN_WEIGHTS,
)

# -- harvest / labor ---------------------------------------------------------
from .harvest import (
    BUYER_TYPE_CHOICES,
    GRADE_CHOICES,
    SIZE_GRADE_CHOICES,
    PRICE_UNIT_CHOICES,
    PAYMENT_STATUS_CHOICES,
    HARVEST_STATUS_CHOICES,
    PAY_TYPE_CHOICES,
    Buyer,
    LaborContractor,
    Harvest,
    HarvestLoad,
    HarvestLabor,
)

# -- water / irrigation / wells ----------------------------------------------
from .water import (
    GSA_CHOICES,
    GSA_FEE_DEFAULTS,
    GROUNDWATER_BASIN_CHOICES,
    BASIN_PRIORITY_CHOICES,
    PUMP_TYPE_CHOICES,
    POWER_SOURCE_CHOICES,
    FLOWMETER_UNIT_CHOICES,
    WELL_STATUS_CHOICES,
    READING_TYPE_CHOICES,
    CALIBRATION_TYPE_CHOICES,
    ALLOCATION_TYPE_CHOICES,
    ALLOCATION_SOURCE_CHOICES,
    REPORT_PERIOD_TYPE_CHOICES,
    REPORT_STATUS_CHOICES,
    REPORT_PAYMENT_STATUS_CHOICES,
    IRRIGATION_METHOD_CHOICES,
    MEASUREMENT_METHOD_CHOICES,
    WaterSource,
    WaterTest,
    WellReading,
    MeterCalibration,
    WaterAllocation,
    ExtractionReport,
    IrrigationEvent,
    IrrigationZone,
    CropCoefficientProfile,
    CIMISDataCache,
    IrrigationRecommendation,
    SoilMoistureReading,
)

# -- nutrients / fertilizer --------------------------------------------------
from .nutrients import (
    FERTILIZER_FORM_CHOICES,
    NUTRIENT_RATE_UNIT_CHOICES,
    NUTRIENT_APPLICATION_METHOD_CHOICES,
    FertilizerProduct,
    NutrientApplication,
    NutrientPlan,
    WeatherCache,
    get_common_fertilizers,
)

# -- imagery / satellite / trees / LiDAR -------------------------------------
from .imagery import (
    QuarantineStatus,
    SatelliteImage,
    TreeDetectionRun,
    DetectedTree,
    LiDARDataset,
    LiDARProcessingRun,
    LiDARDetectedTree,
    TerrainAnalysis,
    Tree,
    TreeObservation,
    TreeMatchingRun,
    TreeFeedback,
)

# -- compliance / notifications ----------------------------------------------
from .compliance import (
    ComplianceProfile,
    ComplianceDeadline,
    ComplianceAlert,
    License,
    WPSTrainingRecord,
    CentralPostingLocation,
    REIPostingRecord,
    ComplianceReport,
    IncidentReport,
    NotificationPreference,
    NotificationLog,
)

# -- disease / scouting ------------------------------------------------------
from .disease import (
    ExternalDetection,
    QuarantineZone,
    DiseaseAlertRule,
    DiseaseAnalysisRun,
    DiseaseAlert,
    ScoutingReport,
    ScoutingPhoto,
    TreeHealthRecord,
)

# -- packinghouse / pools / settlements --------------------------------------
from .packinghouse import (
    Packinghouse,
    Pool,
    PackinghouseDelivery,
    PackoutReport,
    PackoutGradeLine,
    PoolSettlement,
    SettlementGradeLine,
    SettlementDeduction,
    GrowerLedgerEntry,
    PackinghouseStatement,
    PackinghouseGrowerMapping,
    StatementBatchUpload,
)

# -- facility / safety / inventory -------------------------------------------
from .facility import (
    FACILITY_TYPE_CHOICES,
    CLEANING_FREQUENCY_CHOICES,
    VISITOR_TYPE_CHOICES,
    SAFETY_MEETING_TYPE_CHOICES,
    INVENTORY_TRANSACTION_TYPE_CHOICES,
    UserSignature,
    FacilityLocation,
    FacilityCleaningLog,
    VisitorLog,
    SafetyMeeting,
    SafetyMeetingAttendee,
    FertilizerInventory,
    FertilizerInventoryTransaction,
    MonthlyInventorySnapshot,
)

# -- FSMA / PHI / audit binder -----------------------------------------------
from .fsma import (
    PHI_STATUS_CHOICES,
    AUDIT_BINDER_STATUS_CHOICES,
    PHIComplianceCheck,
    AuditBinder,
    FSMAWaterAssessment,
    FSMASourceAssessment,
    FSMAFieldAssessment,
    FSMAEnvironmentalAssessment,
    FSMAMitigationAction,
)

# -- yield forecast / soil survey --------------------------------------------
from .yield_forecast import (
    ExternalDataSource,
    SoilSurveyData,
    YieldFeatureSnapshot,
    YieldForecast,
)

__all__ = [
    # base
    'LocationMixin',
    'default_deadline_reminder_days',
    'default_license_reminder_days',
    # auth
    'UserManager', 'Company', 'User', 'Role', 'Permission',
    'CompanyMembership', 'Invitation', 'PasswordResetToken', 'AuditLog',
    # farm
    'Farm', 'FarmParcel', 'CropCategory', 'CropType', 'SeasonType',
    'SeasonTemplate', 'Crop', 'Rootstock', 'Field', 'GrowingCycleStatus',
    'GrowingCycle', 'PesticideProduct', 'PesticideApplication',
    'CROP_VARIETY_CHOICES', 'DEFAULT_BIN_WEIGHTS',
    # harvest
    'BUYER_TYPE_CHOICES', 'GRADE_CHOICES', 'SIZE_GRADE_CHOICES',
    'PRICE_UNIT_CHOICES', 'PAYMENT_STATUS_CHOICES', 'HARVEST_STATUS_CHOICES',
    'PAY_TYPE_CHOICES', 'Buyer', 'LaborContractor', 'Harvest',
    'HarvestLoad', 'HarvestLabor',
    # water
    'GSA_CHOICES', 'GSA_FEE_DEFAULTS', 'GROUNDWATER_BASIN_CHOICES',
    'BASIN_PRIORITY_CHOICES', 'PUMP_TYPE_CHOICES', 'POWER_SOURCE_CHOICES',
    'FLOWMETER_UNIT_CHOICES', 'WELL_STATUS_CHOICES', 'READING_TYPE_CHOICES',
    'CALIBRATION_TYPE_CHOICES', 'ALLOCATION_TYPE_CHOICES',
    'ALLOCATION_SOURCE_CHOICES', 'REPORT_PERIOD_TYPE_CHOICES',
    'REPORT_STATUS_CHOICES', 'REPORT_PAYMENT_STATUS_CHOICES',
    'IRRIGATION_METHOD_CHOICES', 'MEASUREMENT_METHOD_CHOICES',
    'WaterSource', 'WaterTest', 'WellReading', 'MeterCalibration',
    'WaterAllocation', 'ExtractionReport', 'IrrigationEvent',
    'IrrigationZone', 'CropCoefficientProfile', 'CIMISDataCache',
    'IrrigationRecommendation', 'SoilMoistureReading',
    # nutrients
    'FERTILIZER_FORM_CHOICES', 'NUTRIENT_RATE_UNIT_CHOICES',
    'NUTRIENT_APPLICATION_METHOD_CHOICES', 'FertilizerProduct',
    'NutrientApplication', 'NutrientPlan', 'WeatherCache',
    'get_common_fertilizers',
    # imagery
    'QuarantineStatus', 'SatelliteImage', 'TreeDetectionRun',
    'DetectedTree', 'LiDARDataset', 'LiDARProcessingRun',
    'LiDARDetectedTree', 'TerrainAnalysis', 'Tree', 'TreeObservation',
    'TreeMatchingRun', 'TreeFeedback',
    # compliance
    'ComplianceProfile', 'ComplianceDeadline', 'ComplianceAlert',
    'License', 'WPSTrainingRecord', 'CentralPostingLocation',
    'REIPostingRecord', 'ComplianceReport', 'IncidentReport',
    'NotificationPreference', 'NotificationLog',
    # disease
    'ExternalDetection', 'QuarantineZone', 'DiseaseAlertRule',
    'DiseaseAnalysisRun', 'DiseaseAlert', 'ScoutingReport',
    'ScoutingPhoto', 'TreeHealthRecord',
    # packinghouse
    'Packinghouse', 'Pool', 'PackinghouseDelivery', 'PackoutReport',
    'PackoutGradeLine', 'PoolSettlement', 'SettlementGradeLine',
    'SettlementDeduction', 'GrowerLedgerEntry', 'PackinghouseStatement',
    'PackinghouseGrowerMapping', 'StatementBatchUpload',
    # facility
    'FACILITY_TYPE_CHOICES', 'CLEANING_FREQUENCY_CHOICES',
    'VISITOR_TYPE_CHOICES', 'SAFETY_MEETING_TYPE_CHOICES',
    'INVENTORY_TRANSACTION_TYPE_CHOICES', 'UserSignature',
    'FacilityLocation', 'FacilityCleaningLog', 'VisitorLog',
    'SafetyMeeting', 'SafetyMeetingAttendee', 'FertilizerInventory',
    'FertilizerInventoryTransaction', 'MonthlyInventorySnapshot',
    # fsma
    'PHI_STATUS_CHOICES', 'AUDIT_BINDER_STATUS_CHOICES',
    'PHIComplianceCheck', 'AuditBinder', 'FSMAWaterAssessment',
    'FSMASourceAssessment', 'FSMAFieldAssessment',
    'FSMAEnvironmentalAssessment', 'FSMAMitigationAction',
    # yield forecast
    'ExternalDataSource', 'SoilSurveyData', 'YieldFeatureSnapshot',
    'YieldForecast',
]
