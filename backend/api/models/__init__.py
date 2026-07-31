"""
api.models package — re-exports every public name so that existing imports
(``from api.models import X`` / ``from .models import X``) keep working.
"""

# -- helpers & mixins --------------------------------------------------------
from .base import (
    TimestampedModel,
    OwnedModel,
    LocationMixin,
    default_deadline_reminder_days,
    default_license_reminder_days,
)

# -- auth / company ----------------------------------------------------------
from .auth import (
    UserManager,
    Company,
    LegalEntity,
    User,
    Role,
    Permission,
    CompanyMembership,
    Invitation,
    PasswordResetToken,
    AuditLog,
)

# -- shared acreage denominator ----------------------------------------------
from .acreage import (
    RanchCropAcreage,
    CROP_CODE_CHOICES,
    ACREAGE_SOURCE_CHOICES,
)

# -- block report card (imported from the scoring engine) --------------------
from .block_scoring import (
    BlockScoreSnapshot,
    ScoringUnit,
    BlockScorecard,
    BlockSeasonMetric,
    BlockScoreGate,
    BlockScoreBenchmark,
    BlockEvidenceRef,
)

# -- pick & haul (synced from the local pipeline; invoices entered here) -----
from .pickhaul import (
    MachineApiToken,
    PickHaulSyncBatch,
    PickHaulPull,
    PickHaulReceipt,
    PickHaulDirectCharge,
    PickHaulInvoice,
    PickHaulInvoiceReceipt,
    PickHaulChargeMatch,
    PickHaulManualPick,
    PickHaulCheckResult,
    PICKHAUL_KIND_CHOICES,
)

# -- on-ranch & off-ranch rentals (structurally outside every farming margin) -
from .rental import (
    LOCATION_TYPE_CHOICES,
    PNL_TREATMENT_CHOICES,
    PROPERTY_TYPE_CHOICES,
    LEDGER_GRAIN_CHOICES,
    CATEGORY_KIND_CHOICES,
    LEDGER_SOURCE_CHOICES,
    RentalProperty,
    RentalUnit,
    Lease,
    RentalCategory,
    RentalLedgerEntry,
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
)

# -- weather ------------------------------------------------------------------
from .weather import (
    WeatherCache,
)

# -- compliance / notifications / PHI ----------------------------------------
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
    NOISubmission,
    NotificationPreference,
    NotificationLog,
    PHI_STATUS_CHOICES,
    PHIComplianceCheck,
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

# -- PUR / tank mix / unified product ----------------------------------------
from .pur import (
    PRODUCT_TYPE_CHOICES,
    SIGNAL_WORD_CHOICES,
    APPLICATOR_TYPE_CHOICES,
    PUR_STATUS_CHOICES,
    APPLICATION_METHOD_CHOICES,
    AMOUNT_UNIT_CHOICES,
    RATE_UNIT_CHOICES,
    Product,
    Applicator,
    ApplicationEvent,
    TankMixItem,
    PURImportBatch,
)

__all__ = [
    # base
    'TimestampedModel', 'OwnedModel', 'LocationMixin',
    'default_deadline_reminder_days',
    'default_license_reminder_days',
    # auth
    'UserManager', 'Company', 'LegalEntity', 'User', 'Role', 'Permission',
    'RanchCropAcreage', 'CROP_CODE_CHOICES', 'ACREAGE_SOURCE_CHOICES',
    'BlockScoreSnapshot', 'ScoringUnit', 'BlockScorecard', 'BlockSeasonMetric',
    'BlockScoreGate', 'BlockScoreBenchmark', 'BlockEvidenceRef',
    # pick & haul
    'MachineApiToken', 'PickHaulSyncBatch', 'PickHaulPull', 'PickHaulReceipt',
    'PickHaulDirectCharge', 'PickHaulInvoice', 'PickHaulInvoiceReceipt',
    'PickHaulChargeMatch', 'PickHaulManualPick', 'PickHaulCheckResult',
    'PICKHAUL_KIND_CHOICES',
    # rentals
    'LOCATION_TYPE_CHOICES', 'PNL_TREATMENT_CHOICES', 'PROPERTY_TYPE_CHOICES',
    'LEDGER_GRAIN_CHOICES', 'CATEGORY_KIND_CHOICES', 'LEDGER_SOURCE_CHOICES',
    'RentalProperty', 'RentalUnit', 'Lease', 'RentalCategory',
    'RentalLedgerEntry',
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
    # weather
    'WeatherCache',
    # compliance
    'ComplianceProfile', 'ComplianceDeadline', 'ComplianceAlert',
    'License', 'WPSTrainingRecord', 'CentralPostingLocation',
    'REIPostingRecord', 'ComplianceReport', 'IncidentReport',
    'NOISubmission', 'NotificationPreference', 'NotificationLog',
    'PHI_STATUS_CHOICES', 'PHIComplianceCheck',
    # packinghouse
    'Packinghouse', 'Pool', 'PackinghouseDelivery', 'PackoutReport',
    'PackoutGradeLine', 'PoolSettlement', 'SettlementGradeLine',
    'SettlementDeduction', 'GrowerLedgerEntry', 'PackinghouseStatement',
    'PackinghouseGrowerMapping', 'StatementBatchUpload',
    # pur / tank mix
    'PRODUCT_TYPE_CHOICES', 'SIGNAL_WORD_CHOICES', 'APPLICATOR_TYPE_CHOICES',
    'PUR_STATUS_CHOICES', 'APPLICATION_METHOD_CHOICES',
    'AMOUNT_UNIT_CHOICES', 'RATE_UNIT_CHOICES',
    'Product', 'Applicator', 'ApplicationEvent', 'TankMixItem',
    'PURImportBatch',
]
