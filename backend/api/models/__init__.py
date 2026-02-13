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

# -- imagery / quarantine ----------------------------------------------------
from .imagery import (
    QuarantineStatus,
)

# -- tree detection (YOLO/DeepForest) ----------------------------------------
from .tree_detection import (
    TreeSurvey,
    DetectedTree,
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

# -- Primus GFS / GAP compliance ---------------------------------------------
from .primusgfs import (
    DOCUMENT_TYPE_CHOICES, DOCUMENT_STATUS_CHOICES, PRIMUS_MODULE_CHOICES,
    AUDIT_TYPE_CHOICES, AUDIT_STATUS_CHOICES, FINDING_SEVERITY_CHOICES,
    CORRECTIVE_ACTION_STATUS_CHOICES, LAND_USE_CHOICES, CONTAMINATION_RISK_CHOICES,
    ControlledDocument, DocumentRevisionHistory,
    InternalAudit, AuditFinding, CorrectiveAction,
    LandHistoryAssessment,
    SUPPLIER_STATUS_CHOICES, MATERIAL_TYPE_CHOICES,
    RECALL_STATUS_CHOICES, THREAT_LEVEL_CHOICES,
    ApprovedSupplier, IncomingMaterialVerification,
    MockRecall, FoodDefensePlan, FieldSanitationLog,
    CALIBRATION_STATUS_CHOICES, CALIBRATION_METHOD_CHOICES,
    EQUIPMENT_TYPE_CHOICES, PEST_TYPE_CHOICES,
    PEST_ACTIVITY_CHOICES, INSPECTION_STATUS_CHOICES,
    EquipmentCalibration, PestControlProgram, PestMonitoringLog,
    PreHarvestInspection,
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
    # imagery / quarantine
    'QuarantineStatus',
    # tree detection
    'TreeSurvey', 'DetectedTree',
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
    # primus gfs
    'DOCUMENT_TYPE_CHOICES', 'DOCUMENT_STATUS_CHOICES', 'PRIMUS_MODULE_CHOICES',
    'AUDIT_TYPE_CHOICES', 'AUDIT_STATUS_CHOICES', 'FINDING_SEVERITY_CHOICES',
    'CORRECTIVE_ACTION_STATUS_CHOICES', 'LAND_USE_CHOICES', 'CONTAMINATION_RISK_CHOICES',
    'ControlledDocument', 'DocumentRevisionHistory',
    'InternalAudit', 'AuditFinding', 'CorrectiveAction',
    'LandHistoryAssessment',
    'SUPPLIER_STATUS_CHOICES', 'MATERIAL_TYPE_CHOICES',
    'RECALL_STATUS_CHOICES', 'THREAT_LEVEL_CHOICES',
    'ApprovedSupplier', 'IncomingMaterialVerification',
    'MockRecall', 'FoodDefensePlan', 'FieldSanitationLog',
]
