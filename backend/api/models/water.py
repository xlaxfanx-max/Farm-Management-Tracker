from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from decimal import Decimal

from .base import LocationMixin


# =============================================================================
# WATER MODULE
# Lines 2379-2891 from models_backup.py (first block)
# Lines 3733-5323 from models_backup.py (second block)
# =============================================================================


# -----------------------------------------------------------------------------
# FIRST BLOCK CONSTANTS (lines 2379-2409)
#
# GSA_CHOICES is defined ONCE, here. It previously had a second definition
# further down this file that omitted 'uwcd'; because that one came later it
# silently won, which made 9 of the 14 real Finch wells (the UWCD ones —
# FIN0002/0009/0010, UND0002/0004, Helicopter, both Rio Vista wells) impossible
# to select in the UI. The duplicate has been removed — do not reintroduce it.
# -----------------------------------------------------------------------------

GSA_CHOICES = [
    ('obgma', 'Ojai Basin Groundwater Management Agency (OBGMA)'),
    ('uwcd', 'United Water Conservation District (UWCD)'),
    ('fpbgsa', 'Fillmore and Piru Basins GSA'),
    ('uvrga', 'Upper Ventura River Groundwater Agency'),
    ('fcgma', 'Fox Canyon Groundwater Management Agency'),
    ('other', 'Other'),
    ('none', 'Not in GSA Jurisdiction'),
]

# Default fee rates by GSA (used to pre-populate when GSA is selected)
GSA_FEE_DEFAULTS = {
    'obgma': {
        'base_extraction_rate': Decimal('25.00'),
        'gsp_rate': Decimal('100.00'),
        'fixed_quarterly_fee': Decimal('70.00'),
        'domestic_rate': None,
    },
    'uwcd': {
        'base_extraction_rate': Decimal('192.34'),
        'gsp_rate': None,
        'fixed_quarterly_fee': None,
        'domestic_rate': Decimal('214.22'),
    },
    'fpbgsa': {
        'base_extraction_rate': None,
        'gsp_rate': None,
        'fixed_quarterly_fee': None,
        'domestic_rate': None,
    },
}

GROUNDWATER_BASIN_CHOICES = [
    ('ojai_valley', 'Ojai Valley (4-002)'),
    ('upper_ventura_river', 'Upper Ventura River (4-003.01)'),
    ('lower_ventura_river', 'Lower Ventura River (4-003.02)'),
    ('fillmore', 'Santa Clara River Valley - Fillmore (4-004.05)'),
    ('piru', 'Santa Clara River Valley - Piru (4-004.06)'),
    ('santa_paula', 'Santa Clara River Valley - Santa Paula (4-004.04)'),
    ('oxnard', 'Santa Clara River Valley - Oxnard (4-004.02)'),
    ('pleasant_valley', 'Pleasant Valley (4-006)'),
    ('las_posas', 'Las Posas Valley (4-008)'),
    ('arroyo_santa_rosa', 'Arroyo Santa Rosa Valley (4-007)'),
    ('mound', 'Mound (4-004.01)'),
    ('other', 'Other'),
]

BASIN_PRIORITY_CHOICES = [
    ('critical', 'Critically Overdrafted'),
    ('high', 'High Priority'),
    ('medium', 'Medium Priority'),
    ('low', 'Low Priority'),
    ('very_low', 'Very Low Priority'),
]

PUMP_TYPE_CHOICES = [
    ('submersible', 'Submersible'),
    ('turbine', 'Vertical Turbine'),
    ('jet', 'Jet Pump'),
    ('centrifugal', 'Centrifugal'),
    ('other', 'Other'),
]

POWER_SOURCE_CHOICES = [
    ('electric_utility', 'Electric - Utility'),
    ('electric_solar', 'Electric - Solar'),
    ('diesel', 'Diesel Engine'),
    ('natural_gas', 'Natural Gas Engine'),
    ('propane', 'Propane Engine'),
    ('other', 'Other'),
]

FLOWMETER_UNIT_CHOICES = [
    ('acre_feet', 'Acre-Feet'),
    ('gallons', 'Gallons'),
    ('hundred_gallons', 'Hundred Gallons'),
    ('thousand_gallons', 'Thousand Gallons'),
    ('cubic_feet', 'Cubic Feet'),
    ('hundred_cubic_feet', 'Hundred Cubic Feet (CCF)'),
]

WELL_STATUS_CHOICES = [
    ('active', 'Active'),
    ('inactive', 'Inactive'),
    ('standby', 'Standby/Emergency'),
    ('destroyed', 'Destroyed/Abandoned'),
    ('monitoring', 'Monitoring Only'),
]


class WaterSource(LocationMixin, models.Model):
    """
    Unified water source model combining WaterSource and Well.

    For wells (source_type='well'), SGMA compliance fields are populated.
    For other sources (municipal, surface, other), well-specific fields are null.

    Inherits GPS/PLSS fields from LocationMixin.
    """

    SOURCE_TYPE_CHOICES = [
        ('well', 'Groundwater Well'),
        ('municipal', 'Municipal/Public'),
        ('surface', 'Surface Water (pond, stream, etc.)'),
        ('recycled', 'Recycled Water'),
        ('other', 'Other'),
    ]

    # -------------------------------------------------------------------------
    # Base WaterSource Fields
    # -------------------------------------------------------------------------
    farm = models.ForeignKey('Farm', on_delete=models.PROTECT, related_name='water_sources')
    name = models.CharField(max_length=200, help_text="e.g., 'Well #1', 'North Pond'")
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES, default='well')

    # Location description (for non-GPS locations)
    location_description = models.TextField(blank=True, help_text="Physical location description")

    # Inherit location from farm option
    inherit_location_from_farm = models.BooleanField(
        default=True,
        help_text="If true, use farm's GPS/PLSS; if false, use this record's location"
    )

    # Usage flags
    used_for_irrigation = models.BooleanField(default=True)
    used_for_washing = models.BooleanField(default=False)
    used_for_pesticide_mixing = models.BooleanField(default=False)

    # Fields that use this water source
    fields_served = models.ManyToManyField('Field', blank=True, related_name='water_sources')

    # Testing requirements
    test_frequency_days = models.IntegerField(
        default=365,
        help_text="How often to test (365 = annually, 90 = quarterly)"
    )

    # Status
    active = models.BooleanField(default=True)

    # -------------------------------------------------------------------------
    # Well-Specific Fields (nullable for non-wells)
    # -------------------------------------------------------------------------

    # === WELL IDENTIFICATION ===
    well_name = models.CharField(max_length=100, blank=True, help_text="Common name for the well")
    state_well_number = models.CharField(max_length=50, blank=True, help_text="California DWR State Well Number")
    local_well_id = models.CharField(max_length=50, blank=True, help_text="County well permit number")
    gsa_well_id = models.CharField(max_length=50, blank=True, help_text="GSA-assigned well identifier")

    # === GSA / BASIN INFORMATION ===
    gsa = models.CharField(max_length=20, choices=GSA_CHOICES, blank=True, help_text="Groundwater Sustainability Agency")
    gsa_account_number = models.CharField(max_length=50, blank=True, help_text="Account number with the GSA")
    basin = models.CharField(max_length=30, choices=GROUNDWATER_BASIN_CHOICES, blank=True, help_text="DWR Bulletin 118 basin")
    basin_priority = models.CharField(max_length=20, choices=BASIN_PRIORITY_CHOICES, blank=True)

    # === WELL PHYSICAL CHARACTERISTICS ===
    well_depth_ft = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True, help_text="Total well depth in feet")
    casing_diameter_inches = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    screen_interval_top_ft = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    screen_interval_bottom_ft = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    static_water_level_ft = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    static_level_date = models.DateField(null=True, blank=True)
    aquifer_name = models.CharField(max_length=100, blank=True)

    # === WELL LOCATION (APN) ===
    parcel_apn = models.CharField(max_length=20, blank=True, help_text="Assessor's Parcel Number")
    quarter_quarter = models.CharField(max_length=10, blank=True, help_text="Quarter-quarter section (e.g., NE/SW)")

    # === PUMP INFORMATION ===
    pump_type = models.CharField(max_length=20, choices=PUMP_TYPE_CHOICES, blank=True)
    pump_horsepower = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    pump_flow_rate_gpm = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True, help_text="GPM")
    pump_efficiency = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    pump_installation_date = models.DateField(null=True, blank=True)
    pump_manufacturer = models.CharField(max_length=100, blank=True)
    pump_model = models.CharField(max_length=100, blank=True)

    # === POWER SOURCE ===
    power_source = models.CharField(max_length=20, choices=POWER_SOURCE_CHOICES, blank=True)
    utility_meter_number = models.CharField(max_length=50, blank=True)

    # === FLOWMETER INFORMATION ===
    has_flowmeter = models.BooleanField(default=False)
    flowmeter_make = models.CharField(max_length=100, blank=True)
    flowmeter_model = models.CharField(max_length=100, blank=True)
    flowmeter_serial_number = models.CharField(max_length=100, blank=True)
    flowmeter_size_inches = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    flowmeter_installation_date = models.DateField(null=True, blank=True)
    flowmeter_units = models.CharField(max_length=20, choices=FLOWMETER_UNIT_CHOICES, default='gallons')
    flowmeter_multiplier = models.DecimalField(max_digits=10, decimal_places=4, default=1.0)
    flowmeter_decimal_places = models.IntegerField(default=2)

    # === AMI (Automated Meter Infrastructure) ===
    has_ami = models.BooleanField(default=False)
    ami_vendor = models.CharField(max_length=100, blank=True)
    ami_device_id = models.CharField(max_length=100, blank=True)
    ami_installation_date = models.DateField(null=True, blank=True)

    # === WELL DATES & STATUS ===
    well_construction_date = models.DateField(null=True, blank=True)
    well_permit_date = models.DateField(null=True, blank=True)
    well_permit_number = models.CharField(max_length=50, blank=True)
    driller_name = models.CharField(max_length=100, blank=True)
    driller_license = models.CharField(max_length=50, blank=True)
    well_log_available = models.BooleanField(default=False)
    well_log_file = models.FileField(upload_to='well_logs/', null=True, blank=True)
    well_status = models.CharField(max_length=20, choices=WELL_STATUS_CHOICES, default='active')

    # === DE MINIMIS EXEMPTION ===
    is_de_minimis = models.BooleanField(default=False, help_text="Domestic well < 2 AF/year")

    # === GSA FEE CONFIGURATION ===
    base_extraction_rate = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Base extraction rate $/AF (e.g., OBGMA $25, UWCD $192.34)"
    )
    gsp_rate = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="GSP/SGMA fee rate $/AF (e.g., OBGMA $100)"
    )
    domestic_rate = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Domestic usage rate $/AF (e.g., UWCD $214.22)"
    )
    fixed_quarterly_fee = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Fixed quarterly fee (e.g., OBGMA $70)"
    )
    is_domestic_well = models.BooleanField(
        default=False,
        help_text="Well is primarily for domestic use (different rate applies)"
    )
    owner_code = models.CharField(
        max_length=20, blank=True,
        help_text="Owner identifier code (e.g., JPF, FF, RMLF)"
    )

    # === COMPLIANCE TRACKING ===
    registered_with_gsa = models.BooleanField(default=False)
    gsa_registration_date = models.DateField(null=True, blank=True)
    meter_calibration_current = models.BooleanField(default=False)
    next_calibration_due = models.DateField(null=True, blank=True)

    # === FSMA WATER ASSESSMENT FIELDS ===
    FSMA_WELLHEAD_CONDITION_CHOICES = [
        ('good', 'Good - No deficiencies'),
        ('fair', 'Fair - Minor issues'),
        ('poor', 'Poor - Significant deficiencies'),
        ('na', 'N/A - Not a well'),
    ]
    FSMA_DISTRIBUTION_TYPE_CHOICES = [
        ('closed', 'Closed (Piped)'),
        ('open', 'Open (Canal/Ditch)'),
        ('mixed', 'Mixed'),
    ]

    fsma_wellhead_condition = models.CharField(
        max_length=20,
        choices=FSMA_WELLHEAD_CONDITION_CHOICES,
        default='na',
        blank=True,
        help_text="Physical condition of wellhead for FSMA assessment"
    )
    fsma_well_cap_secure = models.BooleanField(
        null=True,
        blank=True,
        help_text="Is the well cap securely in place?"
    )
    fsma_well_casing_intact = models.BooleanField(
        null=True,
        blank=True,
        help_text="Is the well casing intact without cracks?"
    )
    fsma_backflow_prevention = models.BooleanField(
        null=True,
        blank=True,
        help_text="Is backflow prevention device installed?"
    )
    fsma_last_physical_inspection = models.DateField(
        null=True,
        blank=True,
        help_text="Date of last physical inspection"
    )
    fsma_distribution_type = models.CharField(
        max_length=20,
        choices=FSMA_DISTRIBUTION_TYPE_CHOICES,
        default='closed',
        blank=True,
        help_text="Type of water distribution system"
    )
    fsma_animal_access_possible = models.BooleanField(
        default=False,
        help_text="Can animals access the water source?"
    )
    fsma_debris_present = models.BooleanField(
        default=False,
        help_text="Is debris present at or near the water source?"
    )

    # === NOTES ===
    notes = models.TextField(blank=True)

    # === TIMESTAMPS ===
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['farm', 'name']
        verbose_name = "Water Source"
        verbose_name_plural = "Water Sources"

    def __str__(self):
        return f"{self.farm.name} - {self.name}"

    @property
    def is_well(self):
        """Check if this is a groundwater well."""
        return self.source_type == 'well'

    @property
    def effective_location(self):
        """Get effective GPS coordinates - from this record or inherited from farm."""
        if not self.inherit_location_from_farm and self.has_coordinates:
            return self.coordinates_tuple
        elif self.farm and self.farm.has_coordinates:
            return self.farm.coordinates_tuple
        return None

    @property
    def effective_plss(self):
        """Get effective PLSS data - from this record or inherited from farm."""
        if not self.inherit_location_from_farm and self.has_plss:
            return {
                'section': self.plss_section,
                'township': self.plss_township,
                'range': self.plss_range,
                'meridian': self.plss_meridian
            }
        elif self.farm and self.farm.has_plss:
            return {
                'section': self.farm.plss_section,
                'township': self.farm.plss_township,
                'range': self.farm.plss_range,
                'meridian': self.farm.plss_meridian
            }
        return None

    def next_test_due(self):
        """Calculate next test due date based on most recent test."""
        latest_test = self.water_tests.filter(test_date__isnull=False).order_by('-test_date').first()
        if latest_test:
            from datetime import timedelta
            return latest_test.test_date + timedelta(days=self.test_frequency_days)
        return None

    def is_test_overdue(self):
        """Check if test is overdue."""
        next_due = self.next_test_due()
        if next_due:
            from django.utils import timezone
            return timezone.now().date() > next_due
        return True

    def get_latest_reading(self):
        """Get the most recent meter reading (for wells)."""
        if not self.is_well:
            return None
        return self.readings.order_by('-reading_date', '-reading_time').first()

    def get_ytd_extraction_af(self):
        """Get year-to-date extraction in acre-feet for current water year."""
        if not self.is_well:
            return Decimal('0')
        from django.db.models import Sum
        from datetime import date
        today = date.today()
        if today.month >= 10:
            wy_start = date(today.year, 10, 1)
        else:
            wy_start = date(today.year - 1, 10, 1)
        # Billing rows only — see WellReading.is_billing_row. Interim quarterly
        # reads are already contained in the semi-annual billing row that
        # follows them, so summing every row double-counts the year.
        total = self.readings.filter(
            reading_date__gte=wy_start,
            is_billing_row=True,
        ).aggregate(Sum('extraction_acre_feet'))['extraction_acre_feet__sum']
        return total or Decimal('0')

    def get_allocation_for_year(self, water_year=None):
        """Get total allocation for a water year."""
        if not self.is_well:
            return Decimal('0')
        from django.db.models import Sum
        if not water_year:
            from datetime import date
            today = date.today()
            if today.month >= 10:
                water_year = f"{today.year}-{today.year + 1}"
            else:
                water_year = f"{today.year - 1}-{today.year}"
        total = self.allocations.filter(water_year=water_year).exclude(allocation_type='transferred_out').aggregate(Sum('allocated_acre_feet'))['allocated_acre_feet__sum']
        return total or Decimal('0')

    def is_calibration_due(self, days_warning=30):
        """Check if calibration is due or coming due soon."""
        if not self.is_well or not self.next_calibration_due:
            return True
        from datetime import date, timedelta
        warning_date = date.today() + timedelta(days=days_warning)
        return self.next_calibration_due <= warning_date

    def save(self, *args, **kwargs):
        """Clear well-specific fields if not a well."""
        if not self.is_well:
            self.gsa = ''
            self.basin = ''
            self.well_depth_ft = None
            self.has_flowmeter = False
            self.registered_with_gsa = False
            self.is_de_minimis = False
        super().save(*args, **kwargs)


class WaterTest(models.Model):
    """Water quality test results"""

    TEST_TYPE_CHOICES = [
        ('microbial', 'Microbial (E. coli/Coliform)'),
        ('chemical', 'Chemical Analysis'),
        ('both', 'Microbial & Chemical'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending Results'),
        ('pass', 'Pass'),
        ('fail', 'Fail - Action Required'),
    ]

    water_source = models.ForeignKey(WaterSource, on_delete=models.CASCADE, related_name='water_tests')

    # Test details
    test_date = models.DateField()
    test_type = models.CharField(max_length=20, choices=TEST_TYPE_CHOICES)
    lab_name = models.CharField(max_length=200, blank=True, help_text="Testing laboratory")
    lab_certification_number = models.CharField(max_length=100, blank=True)

    # Microbial results (CFU/100mL or MPN/100mL)
    ecoli_result = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="E. coli count (CFU or MPN per 100mL)"
    )
    total_coliform_result = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Total coliform count"
    )

    # FSMA Thresholds:
    # Agricultural water: Generic E. coli GM ≤ 126 CFU or MPN per 100 mL
    # and STV ≤ 410 CFU or MPN per 100 mL

    # Chemical results
    ph_level = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    nitrate_level = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="mg/L")

    # Overall status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    # Actions taken if failed
    corrective_actions = models.TextField(
        blank=True,
        help_text="Actions taken if test failed (e.g., stopped use, re-treatment, re-test)"
    )
    retest_date = models.DateField(null=True, blank=True)

    # Attachments
    lab_report_file = models.FileField(upload_to='water_tests/', null=True, blank=True)

    # Notes
    notes = models.TextField(blank=True)

    # Who recorded this
    recorded_by = models.CharField(max_length=200, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-test_date']
        indexes = [
            models.Index(fields=['water_source', '-test_date'], name='idx_watertest_source_date'),
        ]

    def __str__(self):
        return f"{self.water_source.name} - {self.test_date} - {self.status}"

    def auto_determine_status(self):
        """Auto-determine pass/fail based on FSMA thresholds"""
        if self.ecoli_result is not None:
            # FSMA threshold: E. coli should be ≤ 126 CFU/100mL (geometric mean)
            # For simplicity, we'll use single sample threshold of 235 CFU/100mL
            if self.ecoli_result > 235:
                return 'fail'
            elif self.ecoli_result <= 126:
                return 'pass'
        return 'pending'

# -----------------------------------------------------------------------------
# CHOICES
# -----------------------------------------------------------------------------


# -----------------------------------------------------------------------------
# SECOND BLOCK CONSTANTS (lines 3733-3868)
# GROUNDWATER_BASIN_CHOICES, BASIN_PRIORITY_CHOICES, PUMP_TYPE_CHOICES,
# POWER_SOURCE_CHOICES, FLOWMETER_UNIT_CHOICES, WELL_STATUS_CHOICES are
# redefined identically (overriding the first block definitions above).
#
# GSA_CHOICES is deliberately NOT redefined here — see the note at the top of
# this file. The old duplicate omitted 'uwcd' and shadowed the real list.
# -----------------------------------------------------------------------------

GROUNDWATER_BASIN_CHOICES = [
    ('ojai_valley', 'Ojai Valley (4-002)'),
    ('upper_ventura_river', 'Upper Ventura River (4-003.01)'),
    ('lower_ventura_river', 'Lower Ventura River (4-003.02)'),
    ('fillmore', 'Santa Clara River Valley - Fillmore (4-004.05)'),
    ('piru', 'Santa Clara River Valley - Piru (4-004.06)'),
    ('santa_paula', 'Santa Clara River Valley - Santa Paula (4-004.04)'),
    ('oxnard', 'Santa Clara River Valley - Oxnard (4-004.02)'),
    ('pleasant_valley', 'Pleasant Valley (4-006)'),
    ('las_posas', 'Las Posas Valley (4-008)'),
    ('arroyo_santa_rosa', 'Arroyo Santa Rosa Valley (4-007)'),
    ('mound', 'Mound (4-004.01)'),
    ('other', 'Other'),
]

BASIN_PRIORITY_CHOICES = [
    ('critical', 'Critically Overdrafted'),
    ('high', 'High Priority'),
    ('medium', 'Medium Priority'),
    ('low', 'Low Priority'),
    ('very_low', 'Very Low Priority'),
]

PUMP_TYPE_CHOICES = [
    ('submersible', 'Submersible'),
    ('turbine', 'Vertical Turbine'),
    ('jet', 'Jet Pump'),
    ('centrifugal', 'Centrifugal'),
    ('other', 'Other'),
]

POWER_SOURCE_CHOICES = [
    ('electric_utility', 'Electric - Utility'),
    ('electric_solar', 'Electric - Solar'),
    ('diesel', 'Diesel Engine'),
    ('natural_gas', 'Natural Gas Engine'),
    ('propane', 'Propane Engine'),
    ('other', 'Other'),
]

FLOWMETER_UNIT_CHOICES = [
    ('acre_feet', 'Acre-Feet'),
    ('gallons', 'Gallons'),
    ('hundred_gallons', 'Hundred Gallons'),
    ('thousand_gallons', 'Thousand Gallons'),
    ('cubic_feet', 'Cubic Feet'),
    ('hundred_cubic_feet', 'Hundred Cubic Feet (CCF)'),
]

WELL_STATUS_CHOICES = [
    ('active', 'Active'),
    ('inactive', 'Inactive'),
    ('standby', 'Standby/Emergency'),
    ('destroyed', 'Destroyed/Abandoned'),
    ('monitoring', 'Monitoring Only'),
]

READING_TYPE_CHOICES = [
    ('manual', 'Manual Reading'),
    ('ami_automatic', 'AMI Automatic'),
    ('estimated', 'Estimated'),
    ('initial', 'Initial Reading'),
    ('final', 'Final Reading'),
]

# Where a reading's extraction_acre_feet came from. This decides whether save()
# is allowed to recompute it from the meter delta.
#
# 'agency_billed' means the figure was printed by the water agency (UWCD, OBGMA)
# and is the number Finch was actually billed on. It is authoritative and must
# never be recalculated: the meter registers do not read in acre-feet directly
# (they run x0.001, x0.01, gallons, or cubic-feet x10 depending on the well),
# and the meters roll over at 1,000,000. Recomputing an agency figure with the
# wrong register scale silently replaces a real 59.14 AF with 18,386 AF.
AF_SOURCE_CHOICES = [
    ('agency_billed', 'Agency-billed (authoritative — never recomputed)'),
    ('meter_derived', 'Derived from meter delta'),
    ('estimated', 'Estimated'),
]

CALIBRATION_TYPE_CHOICES = [
    ('field', 'Field Calibration'),
    ('shop', 'Shop/Bench Calibration'),
    ('replacement', 'Meter Replacement'),
    ('initial', 'Initial Installation'),
]

ALLOCATION_TYPE_CHOICES = [
    ('base', 'Base Allocation'),
    ('historical', 'Historical Use Allocation'),
    ('supplemental', 'Supplemental Allocation'),
    ('carryover', 'Carryover from Previous Year'),
    ('purchased', 'Purchased (Water Market)'),
    ('transferred_in', 'Transferred In'),
    ('transferred_out', 'Transferred Out'),
]

ALLOCATION_SOURCE_CHOICES = [
    ('gsa', 'GSA Base Allocation'),
    ('water_market', 'Water Market Purchase'),
    ('transfer', 'Direct Transfer'),
    ('recharge_credit', 'Recharge Credit'),
]

REPORT_PERIOD_TYPE_CHOICES = [
    ('semi_annual_1', 'Semi-Annual Period 1 (Oct-Mar)'),
    ('semi_annual_2', 'Semi-Annual Period 2 (Apr-Sep)'),
    ('annual', 'Annual (Full Water Year)'),
    ('monthly', 'Monthly'),
    ('quarterly', 'Quarterly'),
]

REPORT_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('ready', 'Ready to Submit'),
    ('submitted', 'Submitted to GSA'),
    ('confirmed', 'Confirmed by GSA'),
    ('revision_needed', 'Revision Needed'),
]

REPORT_PAYMENT_STATUS_CHOICES = [
    ('not_due', 'Not Yet Due'),
    ('pending', 'Pending'),
    ('paid', 'Paid'),
    ('overdue', 'Overdue'),
]

IRRIGATION_METHOD_CHOICES = [
    ('drip', 'Drip'),
    ('micro_sprinkler', 'Micro-Sprinkler'),
    ('sprinkler', 'Sprinkler'),
    ('flood', 'Flood/Furrow'),
    ('pivot', 'Center Pivot'),
    ('hand_water', 'Hand Watering'),
    ('other', 'Other'),
]

MEASUREMENT_METHOD_CHOICES = [
    ('meter', 'Flowmeter Reading'),
    ('calculated', 'Calculated (flow rate × time)'),
    ('estimated', 'Estimated'),
]


# -----------------------------------------------------------------------------
# WELL READING MODEL (References WaterSource instead of Well)
# -----------------------------------------------------------------------------

class WellReading(models.Model):
    """
    Individual meter readings for tracking groundwater extraction.
    Now references WaterSource directly (merged Well model).
    """

    water_source = models.ForeignKey(
        WaterSource,
        on_delete=models.CASCADE,
        related_name='readings',
        limit_choices_to={'source_type': 'well'}
    )

    # === READING DETAILS ===
    reading_date = models.DateField()
    reading_time = models.TimeField(null=True, blank=True)

    meter_reading = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        help_text="Actual meter totalizer reading"
    )

    # === CALCULATED EXTRACTION ===
    previous_reading = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Previous meter reading (auto-populated)"
    )
    previous_reading_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date of previous reading"
    )
    extraction_native_units = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Extraction in meter's native units"
    )
    extraction_acre_feet = models.DecimalField(
        max_digits=20,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Extraction converted to acre-feet"
    )
    extraction_gallons = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Extraction converted to gallons"
    )

    # === READING TYPE ===
    reading_type = models.CharField(
        max_length=20,
        choices=READING_TYPE_CHOICES,
        default='manual'
    )

    # === PROVENANCE OF extraction_acre_feet ===
    af_source = models.CharField(
        max_length=20,
        choices=AF_SOURCE_CHOICES,
        default='meter_derived',
        db_index=True,
        help_text=(
            "Where extraction_acre_feet came from. 'agency_billed' figures are "
            "authoritative and are never recomputed from the meter delta."
        ),
    )

    # === BILLING PERIOD ===
    # UWCD bills semi-annually (June and December) but the meter is also read at
    # the end of Q1 and Q3. Those interim rows are NOT separate usage — the June
    # row spans December->June and already contains March; the December row spans
    # June->December and already contains September. Summing all four rows
    # double-counts the year (Saticoy FIN0002 2022: 59.46 AF summed vs 32.72 AF
    # actually billed). Only rows with is_billing_row=True may be summed.
    is_billing_row = models.BooleanField(
        default=True,
        db_index=True,
        help_text=(
            "True if this reading closes a billing period and its extraction may "
            "be summed into period totals. False for interim reads whose usage is "
            "already contained in a later billing row."
        ),
    )
    billing_period_start = models.DateField(
        null=True,
        blank=True,
        help_text="First day covered by this billing row (null if unknown)",
    )

    # === DOCUMENTATION ===
    meter_photo = models.ImageField(
        upload_to='meter_readings/',
        null=True,
        blank=True,
        help_text="Photo of meter face showing reading"
    )

    # === OPERATIONAL DATA ===
    pump_hours = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Pump runtime hours (if hour meter installed)"
    )
    water_level_ft = models.DecimalField(
        max_digits=7,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Water level at time of reading (ft below surface)"
    )

    # === METER ROLLOVER ===
    meter_rollover = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Meter rollover value if meter reset (e.g., 1000000)"
    )

    # === DOMESTIC/IRRIGATION SPLIT ===
    domestic_extraction_af = models.DecimalField(
        max_digits=20,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Domestic portion of extraction (acre-feet)"
    )
    irrigation_extraction_af = models.DecimalField(
        max_digits=20,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Irrigation portion of extraction (acre-feet)"
    )

    # === CALCULATED FEES ===
    base_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Calculated base extraction fee"
    )
    gsp_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Calculated GSP/SGMA fee"
    )
    domestic_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Calculated domestic fee"
    )
    fixed_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Fixed quarterly fee"
    )
    total_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Total fees due this period"
    )

    # === METADATA ===
    recorded_by = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-reading_date', '-reading_time']
        indexes = [
            models.Index(fields=['water_source', '-reading_date']),
        ]

    def __str__(self):
        return f"{self.water_source.name} - {self.reading_date}: {self.meter_reading}"

    def save(self, *args, **kwargs):
        """Auto-calculate extraction and fees on save.

        An agency-billed reading is NEVER recalculated from the meter delta.
        The agencies print acre-feet directly and that is the figure Finch was
        billed on; the meter registers behind those figures are not in acre-feet
        (they run x0.001, x0.01, gallons, or cubic-feet x10 depending on the
        well) and they roll over at 1,000,000. Recomputing one with the wrong
        register scale turns a real 59.14 AF into 18,386 AF and a plausible
        water bill into a seven-figure one.
        """
        self._backfill_previous_reading()

        if self.af_source != 'agency_billed':
            self._recompute_extraction()

        # Safe for both paths: these are pure functions of extraction_acre_feet
        # (which is now either authoritative or freshly derived) and the rate
        # configuration on the water source.
        self._calculate_usage_split()
        self._calculate_fees()

        super().save(*args, **kwargs)

    def _backfill_previous_reading(self):
        """Record which reading this one follows. Breadcrumb only — never used
        to overwrite an agency-billed extraction figure."""
        if self.previous_reading is not None:
            return
        prev = WellReading.objects.filter(
            water_source=self.water_source,
            reading_date__lt=self.reading_date,
        ).order_by('-reading_date', '-reading_time').first()
        if prev:
            self.previous_reading = prev.meter_reading
            self.previous_reading_date = prev.reading_date

    def _infer_meter_rollover(self):
        """Infer the register capacity when the meter has visibly wrapped.

        A totalizer that reads lower than it did last time has rolled past its
        capacity, which is a power of ten (these are 6-digit registers, so
        1,000,000). Returns None when the reading has not gone backwards.
        """
        if self.meter_reading is None or self.previous_reading is None:
            return None
        if self.meter_reading >= self.previous_reading:
            return None
        digits = len(str(int(abs(self.previous_reading))))
        return Decimal(10) ** digits

    def _recompute_extraction(self):
        """Derive extraction from the meter delta. Only ever called for readings
        that are not agency-billed."""
        if self.previous_reading is None or self.meter_reading is None:
            return

        multiplier = self.water_source.flowmeter_multiplier or Decimal('1.0')
        rollover = self.meter_rollover or self._infer_meter_rollover()

        if rollover:
            raw_extraction = ((rollover - self.previous_reading) + self.meter_reading) * multiplier
        else:
            raw_extraction = (self.meter_reading - self.previous_reading) * multiplier

        if raw_extraction < 0:
            # Went backwards and rollover did not explain it — the meter was
            # replaced or reset, or a reading is wrong. Record nothing rather
            # than a negative extraction; leave it for a human.
            self.extraction_native_units = None
            self.extraction_acre_feet = None
            self.extraction_gallons = None
            return

        self.extraction_native_units = raw_extraction
        self.extraction_acre_feet = self._convert_to_acre_feet(raw_extraction)
        if self.extraction_acre_feet:
            self.extraction_gallons = self.extraction_acre_feet * Decimal('325851')

    def _calculate_usage_split(self):
        """Split extraction into domestic and irrigation based on well type."""
        if self.extraction_acre_feet is None:
            return

        ws = self.water_source
        if ws.is_domestic_well:
            # All extraction is domestic for domestic wells
            self.domestic_extraction_af = self.extraction_acre_feet
            self.irrigation_extraction_af = Decimal('0')
        else:
            # All extraction is irrigation for non-domestic wells
            # (user can manually override domestic_extraction_af if needed)
            if self.domestic_extraction_af is None:
                self.domestic_extraction_af = Decimal('0')
            if self.irrigation_extraction_af is None:
                # Irrigation = total - domestic
                self.irrigation_extraction_af = self.extraction_acre_feet - (self.domestic_extraction_af or Decimal('0'))

    def _calculate_fees(self):
        """Auto-calculate fees based on water source rate configuration."""
        ws = self.water_source

        # Reset fees
        self.base_fee = Decimal('0')
        self.gsp_fee = Decimal('0')
        self.domestic_fee = Decimal('0')
        self.fixed_fee = Decimal('0')

        # Calculate base fee (irrigation extraction * base rate)
        irrigation_af = self.irrigation_extraction_af or Decimal('0')
        if ws.base_extraction_rate and irrigation_af > 0:
            self.base_fee = irrigation_af * ws.base_extraction_rate

        # Calculate GSP/SGMA fee (total extraction * gsp rate)
        total_af = self.extraction_acre_feet or Decimal('0')
        if ws.gsp_rate and total_af > 0:
            self.gsp_fee = total_af * ws.gsp_rate

        # Calculate domestic fee (domestic extraction * domestic rate)
        domestic_af = self.domestic_extraction_af or Decimal('0')
        if ws.domestic_rate and domestic_af > 0:
            self.domestic_fee = domestic_af * ws.domestic_rate

        # Fixed quarterly fee
        if ws.fixed_quarterly_fee:
            self.fixed_fee = ws.fixed_quarterly_fee

        # Total fees
        self.total_fee = (
            (self.base_fee or Decimal('0')) +
            (self.gsp_fee or Decimal('0')) +
            (self.domestic_fee or Decimal('0')) +
            (self.fixed_fee or Decimal('0'))
        )

    def _convert_to_acre_feet(self, value):
        """Convert native units to acre-feet."""
        unit = self.water_source.flowmeter_units
        if unit == 'acre_feet':
            return value
        elif unit == 'gallons':
            return value / Decimal('325851')
        elif unit == 'hundred_gallons':
            return (value * 100) / Decimal('325851')
        elif unit == 'thousand_gallons':
            return (value * 1000) / Decimal('325851')
        elif unit == 'cubic_feet':
            return value / Decimal('43560')
        elif unit == 'hundred_cubic_feet':
            return (value * 100) / Decimal('43560')
        return value


# -----------------------------------------------------------------------------
# METER CALIBRATION MODEL
# -----------------------------------------------------------------------------

class MeterCalibration(models.Model):
    """
    Flowmeter calibration records. Required every 3 years for most GSAs.
    Accuracy must be within +/- 5%.
    Now references WaterSource directly (merged Well model).
    """

    water_source = models.ForeignKey(
        WaterSource,
        on_delete=models.CASCADE,
        related_name='calibrations',
        limit_choices_to={'source_type': 'well'}
    )

    # === CALIBRATION DETAILS ===
    calibration_date = models.DateField()
    next_calibration_due = models.DateField(
        help_text="Typically 3 years from calibration date"
    )
    calibration_type = models.CharField(
        max_length=20,
        choices=CALIBRATION_TYPE_CHOICES,
        default='field'
    )

    # === CALIBRATION RESULTS ===
    pre_calibration_accuracy = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Accuracy percentage before calibration"
    )
    post_calibration_accuracy = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Accuracy percentage after calibration (must be within +/- 5%)"
    )
    passed = models.BooleanField(
        default=False,
        help_text="Did calibration meet required accuracy standards?"
    )

    # === METER STATUS ===
    meter_reading_before = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True
    )
    meter_reading_after = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True
    )
    meter_replaced = models.BooleanField(default=False)
    new_meter_serial = models.CharField(
        max_length=100,
        blank=True,
        help_text="If meter was replaced, new serial number"
    )
    new_meter_make = models.CharField(max_length=100, blank=True)
    new_meter_model = models.CharField(max_length=100, blank=True)

    # === SERVICE PROVIDER ===
    calibration_company = models.CharField(max_length=200, blank=True)
    technician_name = models.CharField(max_length=100, blank=True)
    technician_license = models.CharField(max_length=50, blank=True)
    technician_phone = models.CharField(max_length=20, blank=True)

    # === DOCUMENTATION ===
    calibration_report = models.FileField(
        upload_to='calibration_reports/',
        null=True,
        blank=True,
        help_text="Upload calibration test report PDF"
    )
    invoice = models.FileField(
        upload_to='calibration_invoices/',
        null=True,
        blank=True
    )

    # === COST TRACKING ===
    cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    # === METADATA ===
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-calibration_date']
        verbose_name = "Meter Calibration"
        verbose_name_plural = "Meter Calibrations"
        indexes = [
            models.Index(fields=['water_source', '-calibration_date'], name='idx_metercal_source_date'),
            models.Index(fields=['water_source', 'next_calibration_due'], name='idx_metercal_source_nextdue'),
        ]

    def __str__(self):
        status = "✓ Passed" if self.passed else "✗ Failed"
        return f"{self.water_source.name} - {self.calibration_date} - {status}"

    def save(self, *args, **kwargs):
        """Update water source's calibration status on save."""
        super().save(*args, **kwargs)

        if self.passed:
            self.water_source.meter_calibration_current = True
            self.water_source.next_calibration_due = self.next_calibration_due

            if self.meter_replaced and self.new_meter_serial:
                self.water_source.flowmeter_serial_number = self.new_meter_serial
                if self.new_meter_make:
                    self.water_source.flowmeter_make = self.new_meter_make
                if self.new_meter_model:
                    self.water_source.flowmeter_model = self.new_meter_model

            self.water_source.save()


# -----------------------------------------------------------------------------
# WATER ALLOCATION MODEL
# -----------------------------------------------------------------------------

class WaterAllocation(models.Model):
    """
    Water extraction allocations assigned by GSA.
    Tracks annual/seasonal limits and allocation sources.
    Now references WaterSource directly (merged Well model).
    """

    water_source = models.ForeignKey(
        WaterSource,
        on_delete=models.CASCADE,
        related_name='allocations',
        limit_choices_to={'source_type': 'well'}
    )

    # === ALLOCATION PERIOD ===
    water_year = models.CharField(
        max_length=9,
        help_text="Water year (e.g., '2024-2025' for Oct 2024 - Sep 2025)"
    )
    period_start = models.DateField()
    period_end = models.DateField()

    # === ALLOCATION AMOUNTS ===
    allocation_type = models.CharField(
        max_length=20,
        choices=ALLOCATION_TYPE_CHOICES,
        default='base'
    )
    allocated_acre_feet = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        help_text="Allocated extraction amount in acre-feet"
    )

    # === ALLOCATION SOURCE ===
    source = models.CharField(
        max_length=20,
        choices=ALLOCATION_SOURCE_CHOICES,
        default='gsa'
    )
    source_well_id = models.CharField(
        max_length=50,
        blank=True,
        help_text="Source well ID if transferred/purchased"
    )
    transfer_agreement_number = models.CharField(
        max_length=50,
        blank=True,
        help_text="GSA transfer/water market agreement number"
    )

    # === COST ===
    cost_per_acre_foot = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    total_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    # === DOCUMENTATION ===
    allocation_notice = models.FileField(
        upload_to='allocation_notices/',
        null=True,
        blank=True
    )

    # === METADATA ===
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-water_year', 'water_source']
        verbose_name = "Water Allocation"
        verbose_name_plural = "Water Allocations"

    def __str__(self):
        return f"{self.well} - {self.water_year}: {self.allocated_acre_feet} AF ({self.get_allocation_type_display()})"

    def save(self, *args, **kwargs):
        """Auto-calculate total cost if rate is provided."""
        if self.cost_per_acre_foot and not self.total_cost:
            self.total_cost = self.cost_per_acre_foot * self.allocated_acre_feet
        super().save(*args, **kwargs)


# -----------------------------------------------------------------------------
# EXTRACTION REPORT MODEL
# -----------------------------------------------------------------------------

class ExtractionReport(models.Model):
    """
    Extraction reports for GSA compliance.
    Aggregates well readings for reporting periods.
    Now references WaterSource directly (merged Well model).
    """

    water_source = models.ForeignKey(
        WaterSource,
        on_delete=models.CASCADE,
        related_name='extraction_reports',
        limit_choices_to={'source_type': 'well'}
    )

    # === REPORTING PERIOD ===
    period_type = models.CharField(
        max_length=20,
        choices=REPORT_PERIOD_TYPE_CHOICES,
        default='semi_annual_1'
    )
    reporting_period = models.CharField(
        max_length=20,
        help_text="Period identifier (e.g., '2024-1' for Oct 2023 - Mar 2024)"
    )
    period_start_date = models.DateField()
    period_end_date = models.DateField()

    # === METER READINGS ===
    beginning_meter_reading = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        help_text="Meter reading at start of period"
    )
    beginning_reading_date = models.DateField(
        null=True,
        blank=True
    )
    ending_meter_reading = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        help_text="Meter reading at end of period"
    )
    ending_reading_date = models.DateField(
        null=True,
        blank=True
    )

    # === EXTRACTION TOTALS ===
    total_extraction_native = models.DecimalField(
        max_digits=15,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Total extraction in meter's native units"
    )
    total_extraction_af = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Total extraction in acre-feet"
    )
    total_extraction_gallons = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True
    )

    # === ALLOCATION COMPARISON ===
    period_allocation_af = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Allocation for this period"
    )
    allocation_remaining_af = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True
    )
    over_allocation = models.BooleanField(
        default=False,
        help_text="Did extraction exceed allocation?"
    )
    over_allocation_af = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Amount over allocation"
    )

    # === FEES ===
    extraction_fee_rate = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Fee rate per acre-foot"
    )
    base_extraction_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    surcharge_rate = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Surcharge rate for over-allocation"
    )
    surcharge_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    administrative_fee = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Any additional administrative fees"
    )
    total_fees_due = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    # === REPORT STATUS ===
    status = models.CharField(
        max_length=20,
        choices=REPORT_STATUS_CHOICES,
        default='draft'
    )
    submitted_date = models.DateField(null=True, blank=True)
    gsa_confirmation_number = models.CharField(max_length=50, blank=True)
    gsa_confirmation_date = models.DateField(null=True, blank=True)

    # === PAYMENT ===
    payment_status = models.CharField(
        max_length=20,
        choices=REPORT_PAYMENT_STATUS_CHOICES,
        default='not_due'
    )
    payment_due_date = models.DateField(null=True, blank=True)
    payment_date = models.DateField(null=True, blank=True)
    payment_confirmation = models.CharField(max_length=100, blank=True)
    payment_method = models.CharField(
        max_length=50,
        blank=True,
        help_text="Check, ACH, credit card, etc."
    )

    # === DOCUMENTATION ===
    submitted_report = models.FileField(
        upload_to='extraction_reports/',
        null=True,
        blank=True
    )
    gsa_receipt = models.FileField(
        upload_to='extraction_receipts/',
        null=True,
        blank=True
    )

    # === METADATA ===
    prepared_by = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-period_start_date', 'water_source']
        unique_together = ['water_source', 'reporting_period']
        verbose_name = "Extraction Report"
        verbose_name_plural = "Extraction Reports"

    def __str__(self):
        return f"{self.water_source.name} - {self.reporting_period}: {self.total_extraction_af} AF"

    def calculate_extraction(self):
        """Calculate extraction from meter readings."""
        if self.beginning_meter_reading and self.ending_meter_reading:
            multiplier = self.water_source.flowmeter_multiplier or Decimal('1.0')
            raw = (self.ending_meter_reading - self.beginning_meter_reading) * multiplier
            self.total_extraction_native = raw

            # Convert based on meter units
            unit = self.water_source.flowmeter_units
            if unit == 'acre_feet':
                self.total_extraction_af = raw
            elif unit == 'gallons':
                self.total_extraction_af = raw / Decimal('325851')
            elif unit == 'hundred_gallons':
                self.total_extraction_af = (raw * 100) / Decimal('325851')
            elif unit == 'thousand_gallons':
                self.total_extraction_af = (raw * 1000) / Decimal('325851')
            elif unit == 'cubic_feet':
                self.total_extraction_af = raw / Decimal('43560')
            elif unit == 'hundred_cubic_feet':
                self.total_extraction_af = (raw * 100) / Decimal('43560')

            if self.total_extraction_af:
                self.total_extraction_gallons = self.total_extraction_af * Decimal('325851')

    def calculate_fees(self):
        """Calculate fees based on extraction and rates."""
        if self.total_extraction_af and self.extraction_fee_rate:
            self.base_extraction_fee = self.total_extraction_af * self.extraction_fee_rate

            # Calculate surcharge if over allocation
            if self.over_allocation and self.over_allocation_af and self.surcharge_rate:
                self.surcharge_amount = self.over_allocation_af * self.surcharge_rate

            # Total fees
            self.total_fees_due = (self.base_extraction_fee or Decimal('0')) + \
                                  (self.surcharge_amount or Decimal('0')) + \
                                  (self.administrative_fee or Decimal('0'))

    def save(self, *args, **kwargs):
        """Auto-calculate values on save."""
        self.calculate_extraction()

        # Check allocation
        if self.period_allocation_af and self.total_extraction_af:
            self.allocation_remaining_af = self.period_allocation_af - self.total_extraction_af
            if self.allocation_remaining_af < 0:
                self.over_allocation = True
                self.over_allocation_af = abs(self.allocation_remaining_af)
            else:
                self.over_allocation = False
                self.over_allocation_af = None

        self.calculate_fees()
        super().save(*args, **kwargs)


# -----------------------------------------------------------------------------
# IRRIGATION EVENT MODEL
# -----------------------------------------------------------------------------

class IrrigationEvent(models.Model):
    """
    Optional tracking of irrigation events to link water usage to specific fields.
    Useful for water budgeting and crop water use analysis.
    Uses the unified WaterSource model (which includes wells).
    """

    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='irrigation_events',
        null=True,
        blank=True,
        help_text="Field irrigated"
    )
    water_source = models.ForeignKey(
        WaterSource,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='irrigation_events',
        help_text="Water source used (well, municipal, surface, etc.)"
    )

    # === EVENT DETAILS ===
    irrigation_date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    duration_hours = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True
    )

    # === WATER APPLIED ===
    measurement_method = models.CharField(
        max_length=20,
        choices=MEASUREMENT_METHOD_CHOICES,
        default='calculated'
    )
    water_applied_af = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Water applied in acre-feet"
    )
    water_applied_gallons = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    acre_inches = models.DecimalField(
        max_digits=8,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Inches of water applied across field"
    )

    # === IRRIGATION METHOD ===
    irrigation_method = models.CharField(
        max_length=20,
        choices=IRRIGATION_METHOD_CHOICES,
        blank=True
    )

    # === ZONES ===
    zone_or_block = models.CharField(
        max_length=50,
        blank=True,
        help_text="Specific zone or block irrigated"
    )
    acres_irrigated = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Acres irrigated (may be less than total field acres)"
    )

    # === METADATA ===
    recorded_by = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-irrigation_date', '-start_time']
        verbose_name = "Irrigation Event"
        verbose_name_plural = "Irrigation Events"
        indexes = [
            models.Index(fields=['field', '-irrigation_date'], name='idx_irrig_field_date'),
        ]

    def __str__(self):
        return f"{self.field} - {self.irrigation_date}: {self.water_applied_af or 0} AF"

    def save(self, *args, **kwargs):
        """Auto-calculate duration and water conversions."""
        # Calculate duration from times
        if self.start_time and self.end_time and not self.duration_hours:
            from datetime import datetime, timedelta
            ref_date = self.irrigation_date
            if ref_date:
                start = datetime.combine(ref_date, self.start_time)
                end = datetime.combine(ref_date, self.end_time)
                if end < start:  # Crossed midnight
                    end += timedelta(days=1)
                delta = end - start
                self.duration_hours = Decimal(str(round(delta.total_seconds() / 3600, 2)))

        # Calculate water applied from flow rate and duration (for wells)
        if self.water_source and self.water_source.is_well and self.duration_hours and not self.water_applied_af:
            if self.water_source.pump_flow_rate_gpm:
                gallons = self.water_source.pump_flow_rate_gpm * self.duration_hours * 60
                self.water_applied_gallons = gallons
                self.water_applied_af = gallons / Decimal('325851')

        # Convert between AF and gallons if one is set
        if self.water_applied_af and not self.water_applied_gallons:
            self.water_applied_gallons = self.water_applied_af * Decimal('325851')
        elif self.water_applied_gallons and not self.water_applied_af:
            self.water_applied_af = self.water_applied_gallons / Decimal('325851')

        # Calculate acre-inches if acres known
        if self.water_applied_af and self.acres_irrigated:
            # 1 AF over 1 acre = 12 inches
            self.acre_inches = (self.water_applied_af / self.acres_irrigated) * 12

        super().save(*args, **kwargs)
