from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal

class Farm(models.Model):
    """Farm/Ranch information"""
    name = models.CharField(max_length=200)
    farm_number = models.CharField(max_length=50, blank=True, help_text="Internal farm ID or permit number")
    
    # Owner/Operator information
    owner_name = models.CharField(max_length=200, blank=True)
    operator_name = models.CharField(max_length=200, blank=True)
    
    # Primary location
    address = models.TextField(blank=True)
    county = models.CharField(max_length=100)
    
    # Contact info
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    
    # Status
    active = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class Field(models.Model):
    """Farm field/block information"""
    name = models.CharField(max_length=200)
    farm = models.ForeignKey(Farm, on_delete=models.PROTECT, related_name='fields', null=True, blank=True)
    field_number = models.CharField(max_length=50)
    
    # Location data (required for PUR)
    county = models.CharField(max_length=100)
    section = models.CharField(max_length=50, blank=True)
    township = models.CharField(max_length=50, blank=True)
    range_value = models.CharField(max_length=50, blank=True)
    
    # GPS coordinates (optional)
    gps_lat = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    gps_long = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    
    # Field characteristics
    total_acres = models.DecimalField(max_digits=10, decimal_places=2)
    current_crop = models.CharField(max_length=100)
    planting_date = models.DateField(null=True, blank=True)
    
    # Status
    active = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.field_number})"


class PesticideProduct(models.Model):
    """
    Complete pesticide product database for California PUR compliance.
    Based on California DPR requirements and product label information.
    """
    
    # EXISTING FIELDS (keep these)
    epa_registration_number = models.CharField(
        max_length=50, 
        unique=True,
        help_text="EPA Registration Number (e.g., 12345-678)"
    )
    product_name = models.CharField(
        max_length=200,
        help_text="Product trade name"
    )
    manufacturer = models.CharField(
        max_length=200,
        blank=True,
        help_text="Manufacturer/registrant name"
    )
    active_ingredients = models.TextField(
        blank=True,
        help_text="Active ingredient(s) and percentages"
    )
    formulation_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="e.g., EC, WP, G, etc."
    )
    restricted_use = models.BooleanField(
        default=False,
        help_text="Restricted Use Pesticide (RUP)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # NEW FIELDS FOR ENHANCED PUR COMPLIANCE
    
    # Product Classification
    product_type = models.CharField(  # NEW
        max_length=50,
        blank=True,
        choices=[
            ('insecticide', 'Insecticide'),
            ('herbicide', 'Herbicide'),
            ('fungicide', 'Fungicide'),
            ('fumigant', 'Fumigant'),
            ('adjuvant', 'Adjuvant'),
            ('plant_growth_regulator', 'Plant Growth Regulator'),
            ('rodenticide', 'Rodenticide'),
            ('other', 'Other'),
        ],
        help_text="Primary product type"
    )
    
    is_fumigant = models.BooleanField(  # NEW
        default=False,
        help_text="Is this a fumigant product?"
    )
    
    # Signal Word (Toxicity)
    signal_word = models.CharField(  # NEW
        max_length=20,
        blank=True,
        choices=[
            ('DANGER', 'Danger'),
            ('WARNING', 'Warning'),
            ('CAUTION', 'Caution'),
            ('NONE', 'None'),
        ],
        help_text="Signal word from label"
    )
    
    # Re-Entry Interval (REI)
    rei_hours = models.DecimalField(  # NEW
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Re-Entry Interval in hours (e.g., 12, 24, 48)"
    )
    
    rei_days = models.IntegerField(  # NEW
        null=True,
        blank=True,
        help_text="Alternative REI in days (some products use days)"
    )
    
    # Pre-Harvest Interval (PHI)
    phi_days = models.IntegerField(  # NEW
        null=True,
        blank=True,
        help_text="Pre-Harvest Interval in days"
    )
    
    # Application Restrictions
    max_applications_per_season = models.IntegerField(  # NEW
        null=True,
        blank=True,
        help_text="Maximum number of applications per season"
    )
    
    max_rate_per_application = models.DecimalField(  # NEW
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum rate per application"
    )
    
    max_rate_unit = models.CharField(  # NEW
        max_length=20,
        blank=True,
        choices=[
            ('lbs/acre', 'lbs/acre'),
            ('gal/acre', 'gal/acre'),
            ('oz/acre', 'oz/acre'),
            ('fl oz/acre', 'fl oz/acre'),
            ('kg/ha', 'kg/ha'),
            ('L/ha', 'L/ha'),
        ],
        help_text="Unit for max rate"
    )
    
    # California Specific
    california_registration_number = models.CharField(  # NEW
        max_length=50,
        blank=True,
        help_text="California DPR registration number (if different from EPA)"
    )
    
    active_status_california = models.BooleanField(  # NEW
        default=True,
        help_text="Currently registered for use in California?"
    )
    
    # Product Details
    formulation_code = models.CharField(  # NEW
        max_length=10,
        blank=True,
        help_text="EPA formulation code (e.g., EC, WP, G)"
    )
    
    density_specific_gravity = models.DecimalField(  # NEW
        max_digits=6,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Specific gravity or density (for conversions)"
    )
    
    # Approved Crops/Sites
    approved_crops = models.TextField(  # NEW
        blank=True,
        help_text="Comma-separated list of approved crops/sites"
    )
    
    # Environmental/Safety Notes
    groundwater_advisory = models.BooleanField(  # NEW
        default=False,
        help_text="Has groundwater advisory?"
    )
    
    endangered_species_restrictions = models.BooleanField(  # NEW
        default=False,
        help_text="Has endangered species restrictions?"
    )
    
    buffer_zone_required = models.BooleanField(  # NEW
        default=False,
        help_text="Requires buffer zones?"
    )
    
    buffer_zone_feet = models.IntegerField(  # NEW
        null=True,
        blank=True,
        help_text="Buffer zone distance in feet"
    )
    
    # Product Availability
    product_status = models.CharField(  # NEW
        max_length=20,
        default='active',
        choices=[
            ('active', 'Active'),
            ('discontinued', 'Discontinued'),
            ('suspended', 'Suspended'),
            ('cancelled', 'Cancelled'),
        ],
        help_text="Current product status"
    )
    
    # Cost Tracking (Optional but useful)
    unit_size = models.CharField(  # NEW
        max_length=50,
        blank=True,
        help_text="Standard unit size (e.g., '2.5 gallon jug', '50 lb bag')"
    )
    
    cost_per_unit = models.DecimalField(  # NEW
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Cost per unit (for cost tracking)"
    )
    
    # Additional Information
    label_url = models.URLField(  # NEW
        blank=True,
        help_text="URL to product label PDF"
    )
    
    sds_url = models.URLField(  # NEW
        blank=True,
        help_text="URL to Safety Data Sheet"
    )
    
    notes = models.TextField(  # NEW
        blank=True,
        help_text="Additional notes or special instructions"
    )
    
    # Metadata for management
    active = models.BooleanField(  # NEW (if not already present)
        default=True,
        help_text="Is this product actively used on your farm?"
    )
    
    # Search optimization
    search_keywords = models.TextField(  # NEW
        blank=True,
        help_text="Additional keywords for searching (auto-populated)"
    )
    
    class Meta:
        ordering = ['product_name']
        verbose_name = "Pesticide Product"
        verbose_name_plural = "Pesticide Products"
        indexes = [
            models.Index(fields=['epa_registration_number']),
            models.Index(fields=['product_name']),
            models.Index(fields=['product_type']),
            models.Index(fields=['active']),
        ]
    
    def __str__(self):
        return f"{self.product_name} ({self.epa_registration_number})"
    
    def save(self, *args, **kwargs):
        # Auto-populate search keywords
        keywords = [
            self.product_name,
            self.manufacturer,
            self.epa_registration_number,
            self.active_ingredients,
        ]
        self.search_keywords = ' '.join(filter(None, keywords)).lower()
        super().save(*args, **kwargs)
    
    def get_rei_display_hours(self):
        """Get REI in hours for display"""
        if self.rei_hours:
            return self.rei_hours
        elif self.rei_days:
            return self.rei_days * 24
        return None
    
    def is_rei_expired(self, application_date, check_date):
        """Check if REI has expired for an application"""
        from datetime import timedelta
        
        rei_hours = self.get_rei_display_hours()
        if not rei_hours:
            return True  # No REI means safe to enter
        
        rei_end = application_date + timedelta(hours=float(rei_hours))
        return check_date >= rei_end
    
    def is_phi_met(self, application_date, harvest_date):
        """Check if PHI is met for harvest"""
        if not self.phi_days:
            return True  # No PHI restriction
        
        from datetime import timedelta
        phi_end = application_date + timedelta(days=self.phi_days)
        return harvest_date >= phi_end
    
    @property
    def is_high_toxicity(self):
        """Check if product is high toxicity"""
        return self.signal_word == 'DANGER'
    
    @property
    def requires_license(self):
        """Check if product requires licensed applicator"""
        return self.restricted_use or self.is_fumigant


class PesticideApplication(models.Model):
    """Pesticide application records"""
    
    STATUS_CHOICES = [
        ('pending_signature', 'Pending Signature'),
        ('complete', 'Complete'),
        ('submitted', 'Submitted to PUR'),
    ]
    
    # Application date and time
    application_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    
    # Field information
    field = models.ForeignKey(Field, on_delete=models.PROTECT, related_name='applications')
    acres_treated = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Product information
    product = models.ForeignKey(PesticideProduct, on_delete=models.PROTECT, related_name='applications')
    
    # Application details
    amount_used = models.DecimalField(max_digits=10, decimal_places=2)
    
    UNIT_CHOICES = [
        ('gal', 'Gallons'),
        ('lbs', 'Pounds'),
        ('oz', 'Ounces'),
        ('pt', 'Pints'),
        ('qt', 'Quarts'),
    ]
    unit_of_measure = models.CharField(max_length=20, choices=UNIT_CHOICES)
    
    METHOD_CHOICES = [
        ('Ground Spray', 'Ground Spray'),
        ('Aerial Application', 'Aerial Application'),
        ('Chemigation', 'Chemigation'),
        ('Soil Injection', 'Soil Injection'),
        ('Broadcast', 'Broadcast Application'),
    ]
    application_method = models.CharField(max_length=100, choices=METHOD_CHOICES)
    
    target_pest = models.CharField(max_length=200, blank=True)
    
    # Applicator information
    applicator_name = models.CharField(max_length=200)

    # Applicator license number
    applicator_license_no = models.CharField(
        max_length=50, 
        blank=True,
        help_text="California Department of Pesticide Regulation license number"
    )
    
    # Weather conditions
    temperature = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    wind_speed = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    
    WIND_DIRECTION_CHOICES = [
        ('N', 'North'),
        ('NE', 'Northeast'),
        ('E', 'East'),
        ('SE', 'Southeast'),
        ('S', 'South'),
        ('SW', 'Southwest'),
        ('W', 'West'),
        ('NW', 'Northwest'),
    ]
    wind_direction = models.CharField(max_length=2, choices=WIND_DIRECTION_CHOICES, blank=True)
    
    # Additional tracking
    notes = models.TextField(blank=True)
    
    # PUR submission tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_signature')
    submitted_to_pur = models.BooleanField(default=False)
    pur_submission_date = models.DateField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-application_date', '-created_at']

    def __str__(self):
        return f"{self.field.name} - {self.product.product_name} on {self.application_date}"

class WaterSource(models.Model):
    """Water sources used on the farm"""
    
    SOURCE_TYPE_CHOICES = [
        ('well', 'Well'),
        ('municipal', 'Municipal/Public'),
        ('surface', 'Surface Water (pond, stream, etc.)'),
        ('other', 'Other'),
    ]
    
    farm = models.ForeignKey(Farm, on_delete=models.PROTECT, related_name='water_sources')
    name = models.CharField(max_length=200, help_text="e.g., 'Well #1', 'North Pond'")
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPE_CHOICES)
    
    # Location
    location_description = models.TextField(blank=True, help_text="Physical location or GPS coordinates")
    
    # Usage
    used_for_irrigation = models.BooleanField(default=True)
    used_for_washing = models.BooleanField(default=False)
    used_for_pesticide_mixing = models.BooleanField(default=False)
    
    # Fields that use this water source
    fields_served = models.ManyToManyField(Field, blank=True, related_name='water_sources')
    
    # Testing requirements
    test_frequency_days = models.IntegerField(
        default=365,
        help_text="How often to test (365 = annually, 90 = quarterly)"
    )
    
    # Status
    active = models.BooleanField(default=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['farm', 'name']

    def __str__(self):
        return f"{self.farm.name} - {self.name}"
    
    def next_test_due(self):
        """Calculate next test due date based on most recent test"""
        latest_test = self.water_tests.filter(test_date__isnull=False).order_by('-test_date').first()
        if latest_test:
            from datetime import timedelta
            return latest_test.test_date + timedelta(days=self.test_frequency_days)
        return None
    
    def is_test_overdue(self):
        """Check if test is overdue"""
        next_due = self.next_test_due()
        if next_due:
            from django.utils import timezone
            return timezone.now().date() > next_due
        return True  # No tests = overdue


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

BUYER_TYPE_CHOICES = [
    ('packing_house', 'Packing House'),
    ('processor', 'Processor'),
    ('direct_sale', 'Direct Sale'),
    ('farmers_market', 'Farmers Market'),
    ('distributor', 'Distributor'),
    ('export', 'Export'),
]

GRADE_CHOICES = [
    ('fancy', 'Fancy'),
    ('choice', 'Choice'),
    ('standard', 'Standard'),
    ('juice', 'Juice Grade'),
    ('reject', 'Reject/Cull'),
]

# Standard citrus size grades (count per carton)
SIZE_GRADE_CHOICES = [
    ('48', '48'),
    ('56', '56'),
    ('72', '72'),
    ('88', '88'),
    ('113', '113'),
    ('138', '138'),
    ('163', '163'),
    ('180', '180'),
    ('200', '200'),
    ('235', '235'),
    ('mixed', 'Mixed'),
]

PRICE_UNIT_CHOICES = [
    ('per_bin', 'Per Bin'),
    ('per_lb', 'Per Pound'),
    ('per_ton', 'Per Ton'),
    ('per_box', 'Per Box'),
    ('per_carton', 'Per Carton'),
    ('flat_rate', 'Flat Rate'),
]

PAYMENT_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('invoiced', 'Invoiced'),
    ('partial', 'Partially Paid'),
    ('paid', 'Paid'),
    ('disputed', 'Disputed'),
]

HARVEST_STATUS_CHOICES = [
    ('in_progress', 'In Progress'),
    ('complete', 'Complete'),
    ('verified', 'Verified'),
]

PAY_TYPE_CHOICES = [
    ('hourly', 'Hourly'),
    ('piece_rate', 'Piece Rate (per bin)'),
    ('contract', 'Contract/Flat Rate'),
]

CROP_VARIETY_CHOICES = [
    ('navel_orange', 'Navel Orange'),
    ('valencia_orange', 'Valencia Orange'),
    ('cara_cara', 'Cara Cara Orange'),
    ('blood_orange', 'Blood Orange'),
    ('meyer_lemon', 'Meyer Lemon'),
    ('eureka_lemon', 'Eureka Lemon'),
    ('lisbon_lemon', 'Lisbon Lemon'),
    ('lime', 'Lime'),
    ('grapefruit_white', 'White Grapefruit'),
    ('grapefruit_ruby', 'Ruby Red Grapefruit'),
    ('mandarin', 'Mandarin'),
    ('tangerine', 'Tangerine'),
    ('clementine', 'Clementine'),
    ('satsuma', 'Satsuma'),
    ('tangelo', 'Tangelo'),
    ('kumquat', 'Kumquat'),
    ('other', 'Other'),
]

# Default bin weights by crop type (in lbs)
DEFAULT_BIN_WEIGHTS = {
    'navel_orange': 900,
    'valencia_orange': 900,
    'cara_cara': 900,
    'blood_orange': 900,
    'meyer_lemon': 900,
    'eureka_lemon': 900,
    'lisbon_lemon': 900,
    'lime': 850,
    'grapefruit_white': 800,
    'grapefruit_ruby': 800,
    'mandarin': 800,
    'tangerine': 800,
    'clementine': 800,
    'satsuma': 800,
    'tangelo': 850,
    'kumquat': 800,
    'other': 900,
}


# -----------------------------------------------------------------------------
# BUYER MODEL
# -----------------------------------------------------------------------------

class Buyer(models.Model):
    """
    Represents a buyer/destination for harvested crops.
    Packing houses, processors, direct sale contacts, etc.
    """
    name = models.CharField(max_length=200)
    buyer_type = models.CharField(
        max_length=20,
        choices=BUYER_TYPE_CHOICES,
        default='packing_house'
    )
    
    # Contact Information
    contact_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    
    # Address
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, default='CA')
    zip_code = models.CharField(max_length=10, blank=True)
    
    # Business Details
    license_number = models.CharField(
        max_length=50, 
        blank=True,
        help_text="Packer/shipper license number if applicable"
    )
    payment_terms = models.CharField(
        max_length=100, 
        blank=True,
        help_text="e.g., Net 30, COD, etc."
    )
    
    # Status
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        verbose_name_plural = "Buyers"
    
    def __str__(self):
        return f"{self.name} ({self.get_buyer_type_display()})"


# -----------------------------------------------------------------------------
# LABOR CONTRACTOR MODEL
# -----------------------------------------------------------------------------

class LaborContractor(models.Model):
    """
    Represents a harvest labor contractor/crew company.
    """
    company_name = models.CharField(max_length=200)
    
    # Contact Information
    contact_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    
    # Address
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, default='CA')
    zip_code = models.CharField(max_length=10, blank=True)
    
    # Business/Compliance Details
    contractor_license = models.CharField(
        max_length=50,
        blank=True,
        help_text="Farm Labor Contractor License Number"
    )
    license_expiration = models.DateField(null=True, blank=True)
    insurance_carrier = models.CharField(max_length=200, blank=True)
    insurance_policy_number = models.CharField(max_length=100, blank=True)
    insurance_expiration = models.DateField(null=True, blank=True)
    workers_comp_carrier = models.CharField(max_length=200, blank=True)
    workers_comp_policy = models.CharField(max_length=100, blank=True)
    workers_comp_expiration = models.DateField(null=True, blank=True)
    
    # GAP/GHP Training
    food_safety_training_current = models.BooleanField(
        default=False,
        help_text="Crew has current food safety training"
    )
    training_expiration = models.DateField(null=True, blank=True)
    
    # Rates (defaults, can be overridden per harvest)
    default_hourly_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True
    )
    default_piece_rate = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Rate per bin"
    )
    
    # Status
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['company_name']
        verbose_name = "Labor Contractor"
        verbose_name_plural = "Labor Contractors"
    
    def __str__(self):
        return self.company_name
    
    @property
    def is_license_valid(self):
        if not self.license_expiration:
            return None
        from datetime import date
        return self.license_expiration >= date.today()
    
    @property
    def is_insurance_valid(self):
        if not self.insurance_expiration:
            return None
        from datetime import date
        return self.insurance_expiration >= date.today()


# -----------------------------------------------------------------------------
# HARVEST MODEL
# -----------------------------------------------------------------------------

class Harvest(models.Model):
    """
    Represents a single harvest event on a field.
    A field can have multiple harvests per season.
    """
    # Link to field (required)
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='harvests'
    )
    
    # Basic Harvest Info
    harvest_date = models.DateField()
    harvest_number = models.PositiveIntegerField(
        default=1,
        help_text="Pick number this season (1st, 2nd, 3rd pick)"
    )
    crop_variety = models.CharField(
        max_length=30,
        choices=CROP_VARIETY_CHOICES,
        default='navel_orange'
    )
    
    # Quantity
    acres_harvested = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    total_bins = models.PositiveIntegerField(default=0)
    bin_weight_lbs = models.PositiveIntegerField(
        default=900,
        help_text="Weight per bin in pounds"
    )
    estimated_weight_lbs = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Auto-calculated from bins × bin_weight"
    )
    
    # PHI Compliance (auto-populated)
    phi_verified = models.BooleanField(
        default=False,
        help_text="User confirms PHI compliance check performed"
    )
    last_application_date = models.DateField(
        null=True,
        blank=True,
        help_text="Auto-populated from most recent application"
    )
    last_application_product = models.CharField(
        max_length=200,
        blank=True,
        help_text="Auto-populated"
    )
    days_since_last_application = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Auto-calculated"
    )
    phi_required_days = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="PHI from product label"
    )
    phi_compliant = models.BooleanField(
        null=True,
        blank=True,
        help_text="Auto-calculated: days_since >= phi_required"
    )
    
    # GAP/GHP Traceability
    lot_number = models.CharField(
        max_length=50,
        unique=True,
        blank=True,
        help_text="Auto-generated if blank"
    )
    field_conditions = models.TextField(
        blank=True,
        help_text="Weather, ground conditions, etc."
    )
    equipment_cleaned = models.BooleanField(
        default=False,
        help_text="Harvest equipment sanitation verified"
    )
    no_contamination_observed = models.BooleanField(
        default=False,
        help_text="No glass, metal, animal intrusion observed"
    )
    
    # Supervisor
    supervisor_name = models.CharField(max_length=200, blank=True)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=HARVEST_STATUS_CHOICES,
        default='in_progress'
    )
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-harvest_date', '-created_at']
        verbose_name_plural = "Harvests"
    
    def __str__(self):
        return f"{self.field.name} - {self.harvest_date} (Pick #{self.harvest_number})"
    
    def save(self, *args, **kwargs):
        # Auto-generate lot number if not provided
        if not self.lot_number:
            self.lot_number = self._generate_lot_number()
        
        # Set default bin weight based on crop variety
        if not self.bin_weight_lbs or self.bin_weight_lbs == 900:
            self.bin_weight_lbs = DEFAULT_BIN_WEIGHTS.get(self.crop_variety, 900)
        
        # Calculate estimated weight
        if self.total_bins and self.bin_weight_lbs:
            self.estimated_weight_lbs = self.total_bins * self.bin_weight_lbs
        
        # Auto-populate PHI information
        self._populate_phi_info()
        
        super().save(*args, **kwargs)
    
    def _generate_lot_number(self):
        """Generate lot number: FARM-FIELD-YYYYMMDD-SEQ"""
        from datetime import date
        
        # Get farm initials (first letter of each word, max 4 chars)
        farm_name = self.field.farm.name if self.field.farm else "XX"
        initials = ''.join(word[0].upper() for word in farm_name.split()[:4])
        
        # Get field number or name abbreviation
        field_id = self.field.field_number or self.field.name[:3].upper()
        
        # Date portion
        date_str = self.harvest_date.strftime('%Y%m%d') if self.harvest_date else date.today().strftime('%Y%m%d')
        
        # Sequence number (count existing harvests on same field/date)
        base_lot = f"{initials}-{field_id}-{date_str}"
        existing_count = Harvest.objects.filter(
            lot_number__startswith=base_lot
        ).count()
        
        return f"{base_lot}-{existing_count + 1:02d}"
    
    def _populate_phi_info(self):
        """Auto-populate PHI compliance information from recent applications."""
        if not self.field_id:
            return
            
        # Get most recent application on this field
        from django.apps import apps
        PesticideApplication = apps.get_model('api', 'PesticideApplication')
        
        last_app = PesticideApplication.objects.filter(
            field_id=self.field_id
        ).select_related('product').order_by('-application_date').first()
        
        if last_app:
            self.last_application_date = last_app.application_date
            if last_app.product:
                self.last_application_product = last_app.product.product_name
                self.phi_required_days = last_app.product.phi_days
            
            # Calculate days since application
            if self.harvest_date and self.last_application_date:
                delta = self.harvest_date - self.last_application_date
                self.days_since_last_application = delta.days
                
                # Determine compliance
                if self.phi_required_days:
                    self.phi_compliant = self.days_since_last_application >= self.phi_required_days
    
    @property
    def total_revenue(self):
        """Calculate total revenue from all loads."""
        return sum(load.total_revenue or 0 for load in self.loads.all())
    
    @property
    def total_labor_cost(self):
        """Calculate total labor cost from all labor records."""
        return sum(labor.total_labor_cost or 0 for labor in self.labor_records.all())
    
    @property
    def yield_per_acre(self):
        """Calculate bins per acre."""
        if self.acres_harvested and self.total_bins:
            return round(self.total_bins / float(self.acres_harvested), 1)
        return None


# -----------------------------------------------------------------------------
# HARVEST LOAD MODEL
# -----------------------------------------------------------------------------

class HarvestLoad(models.Model):
    """
    Represents a single load/delivery from a harvest.
    Supports split loads to multiple buyers.
    """
    harvest = models.ForeignKey(
        Harvest,
        on_delete=models.CASCADE,
        related_name='loads'
    )
    
    load_number = models.PositiveIntegerField(
        default=1,
        help_text="Load number within this harvest"
    )
    
    # Quantity
    bins = models.PositiveIntegerField(default=0)
    weight_lbs = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Scale weight"
    )
    weight_ticket_number = models.CharField(
        max_length=50,
        blank=True,
        help_text="Scale ticket reference"
    )
    
    # Destination
    buyer = models.ForeignKey(
        Buyer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='loads'
    )
    destination_address = models.CharField(
        max_length=255,
        blank=True,
        help_text="Override buyer address if different"
    )
    
    # Grade & Quality
    grade = models.CharField(
        max_length=20,
        choices=GRADE_CHOICES,
        default='choice'
    )
    size_grade = models.CharField(
        max_length=10,
        choices=SIZE_GRADE_CHOICES,
        blank=True
    )
    quality_notes = models.TextField(
        blank=True,
        help_text="Brix, color, defects, etc."
    )
    
    # Revenue
    price_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    price_unit = models.CharField(
        max_length=20,
        choices=PRICE_UNIT_CHOICES,
        default='per_bin'
    )
    total_revenue = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Auto-calculated or manual override"
    )
    
    # Payment Tracking
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='pending'
    )
    payment_date = models.DateField(null=True, blank=True)
    invoice_number = models.CharField(max_length=50, blank=True)
    
    # GAP/GHP Transportation Traceability
    truck_id = models.CharField(
        max_length=50,
        blank=True,
        help_text="License plate or truck number"
    )
    trailer_id = models.CharField(max_length=50, blank=True)
    driver_name = models.CharField(max_length=200, blank=True)
    departure_time = models.DateTimeField(null=True, blank=True)
    arrival_time = models.DateTimeField(null=True, blank=True)
    temperature_at_loading = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="°F at time of loading"
    )
    seal_number = models.CharField(
        max_length=50,
        blank=True,
        help_text="Trailer seal number if applicable"
    )
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['harvest', 'load_number']
        verbose_name = "Harvest Load"
        verbose_name_plural = "Harvest Loads"
    
    def __str__(self):
        buyer_name = self.buyer.name if self.buyer else "Unknown"
        return f"Load #{self.load_number} - {self.bins} bins to {buyer_name}"
    
    def save(self, *args, **kwargs):
        # Auto-calculate revenue if not manually set
        if self.price_per_unit and not self.total_revenue:
            self.total_revenue = self._calculate_revenue()
        
        # Auto-increment load number
        if not self.load_number:
            existing = HarvestLoad.objects.filter(harvest=self.harvest).count()
            self.load_number = existing + 1
        
        super().save(*args, **kwargs)
    
    def _calculate_revenue(self):
        """Calculate total revenue based on price unit."""
        if not self.price_per_unit:
            return None
            
        if self.price_unit == 'per_bin':
            return self.bins * self.price_per_unit
        elif self.price_unit == 'per_lb' and self.weight_lbs:
            return self.weight_lbs * self.price_per_unit
        elif self.price_unit == 'per_ton' and self.weight_lbs:
            return (self.weight_lbs / 2000) * self.price_per_unit
        elif self.price_unit == 'flat_rate':
            return self.price_per_unit
        
        return None


# -----------------------------------------------------------------------------
# HARVEST LABOR MODEL
# -----------------------------------------------------------------------------

class HarvestLabor(models.Model):
    """
    Tracks labor/crew information for a harvest.
    Supports GAP/GHP worker compliance documentation.
    """
    harvest = models.ForeignKey(
        Harvest,
        on_delete=models.CASCADE,
        related_name='labor_records'
    )
    
    # Crew Information
    contractor = models.ForeignKey(
        LaborContractor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='harvest_jobs'
    )
    crew_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Crew identifier or name"
    )
    foreman_name = models.CharField(max_length=200, blank=True)
    worker_count = models.PositiveIntegerField(default=1)
    
    # Time Tracking
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    total_hours = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Auto-calculated or manual entry"
    )
    
    # Cost Tracking
    pay_type = models.CharField(
        max_length=20,
        choices=PAY_TYPE_CHOICES,
        default='piece_rate'
    )
    rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="$/hour or $/bin depending on pay_type"
    )
    bins_picked = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="For piece rate calculation"
    )
    total_labor_cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Auto-calculated or manual entry"
    )
    
    # GAP/GHP Compliance
    training_verified = models.BooleanField(
        default=False,
        help_text="Workers have current food safety training"
    )
    hygiene_facilities_available = models.BooleanField(
        default=False,
        help_text="Handwashing stations and toilets available"
    )
    illness_check_performed = models.BooleanField(
        default=False,
        help_text="Workers checked for illness/symptoms"
    )
    
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['harvest', '-start_time']
        verbose_name = "Harvest Labor Record"
        verbose_name_plural = "Harvest Labor Records"
    
    def __str__(self):
        contractor_name = self.contractor.company_name if self.contractor else self.crew_name
        return f"{contractor_name} - {self.worker_count} workers"
    
    def save(self, *args, **kwargs):
        # Auto-calculate hours from start/end time
        if self.start_time and self.end_time and not self.total_hours:
            delta = self.end_time - self.start_time
            self.total_hours = round(delta.total_seconds() / 3600, 2)
        
        # Auto-calculate labor cost
        if not self.total_labor_cost:
            self.total_labor_cost = self._calculate_cost()
        
        super().save(*args, **kwargs)
    
    def _calculate_cost(self):
        """Calculate total labor cost based on pay type."""
        if not self.rate:
            return None
            
        if self.pay_type == 'hourly' and self.total_hours:
            return self.total_hours * self.rate * self.worker_count
        elif self.pay_type == 'piece_rate' and self.bins_picked:
            return self.bins_picked * self.rate
        elif self.pay_type == 'contract':
            return self.rate  # Flat rate
        
        return None
    
    @property
    def cost_per_bin(self):
        """Calculate labor cost per bin for analysis."""
        if self.total_labor_cost and self.bins_picked and self.bins_picked > 0:
            return round(float(self.total_labor_cost) / self.bins_picked, 2)
        return None
