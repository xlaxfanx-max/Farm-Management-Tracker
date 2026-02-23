from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from django.utils import timezone

from api.models.farm import CROP_VARIETY_CHOICES, DEFAULT_BIN_WEIGHTS


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


# -----------------------------------------------------------------------------
# BUYER MODEL
# -----------------------------------------------------------------------------

class Buyer(models.Model):
    """
    Represents a buyer/destination for harvested crops.
    Packing houses, processors, direct sale contacts, etc.
    """
    # Multi-tenancy
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='buyers',
        null=True,
        blank=True,
        help_text='Company that owns this buyer record'
    )

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
        indexes = [
            models.Index(fields=['company', 'active'], name='idx_buyer_co_active'),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_buyer_type_display()})"


# -----------------------------------------------------------------------------
# LABOR CONTRACTOR MODEL
# -----------------------------------------------------------------------------

class LaborContractor(models.Model):
    """
    Represents a harvest labor contractor/crew company.
    """
    # Multi-tenancy
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='labor_contractors',
        null=True,
        blank=True,
        help_text='Company that owns this labor contractor record'
    )

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
        indexes = [
            models.Index(fields=['company', 'active'], name='idx_contr_co_active'),
        ]

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

    # Growing cycle (optional, for multi-cycle crops)
    growing_cycle = models.ForeignKey(
        'GrowingCycle',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='harvests',
        help_text="Associated growing cycle (for multi-cycle crops)"
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
        indexes = [
            models.Index(fields=['crop_variety'], name='idx_harv_crop_var'),
            models.Index(fields=['harvest_date'], name='idx_harv_date'),
            models.Index(fields=['field', 'harvest_date'], name='idx_harv_field_date'),
        ]

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
        """Auto-populate PHI compliance information from recent applications.

        Checks ALL applications within a 365-day lookback and uses the
        worst-case (latest clearance date) to determine compliance, not
        just the most recent application.
        """
        if not self.field_id:
            return

        from datetime import timedelta
        from django.apps import apps
        PesticideApplication = apps.get_model('api', 'PesticideApplication')

        harvest_dt = self.harvest_date or date.today()
        lookback_start = harvest_dt - timedelta(days=365)

        applications = PesticideApplication.objects.filter(
            field_id=self.field_id,
            application_date__gte=lookback_start,
        ).select_related('product').order_by('-application_date')

        if not applications.exists():
            return

        # Find the worst-case blocking application (latest clearance date)
        worst_clear_date = None
        worst_app = None

        for app in applications:
            if app.product and app.product.phi_days:
                clear_date = app.application_date + timedelta(days=app.product.phi_days)
                if worst_clear_date is None or clear_date > worst_clear_date:
                    worst_clear_date = clear_date
                    worst_app = app

        # Track the most recent application for display
        last_app = applications.first()
        if last_app:
            self.last_application_date = last_app.application_date
            if last_app.product:
                self.last_application_product = last_app.product.product_name

        # Use worst-case PHI for compliance determination
        if worst_app and self.harvest_date:
            self.phi_required_days = worst_app.product.phi_days
            self.last_application_product = worst_app.product.product_name
            self.last_application_date = worst_app.application_date
            delta = self.harvest_date - worst_app.application_date
            self.days_since_last_application = delta.days
            self.phi_compliant = self.harvest_date >= worst_clear_date
        elif last_app and self.harvest_date and self.last_application_date:
            delta = self.harvest_date - self.last_application_date
            self.days_since_last_application = delta.days

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
        """Calculate primary quantity per acre (bins for citrus, lbs for avocados)."""
        if self.acres_harvested and self.primary_quantity:
            return round(float(self.primary_quantity) / float(self.acres_harvested), 1)
        return None

    @property
    def primary_unit_info(self):
        from api.services.season_service import get_primary_unit_for_crop_variety
        return get_primary_unit_for_crop_variety(self.crop_variety)

    @property
    def primary_quantity(self):
        """Primary quantity in the crop's natural unit (bins or lbs)."""
        info = self.primary_unit_info
        if info['unit'] == 'LBS':
            return self.estimated_weight_lbs or 0
        return self.total_bins

    @property
    def primary_unit(self):
        return self.primary_unit_info['unit']

    @property
    def primary_unit_label(self):
        return self.primary_unit_info['label_plural']


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
    payment_due_date = models.DateField(
        null=True,
        blank=True,
        help_text='Expected payment date based on buyer payment terms'
    )
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
        indexes = [
            models.Index(fields=['payment_status'], name='idx_load_pay_status'),
            models.Index(fields=['buyer'], name='idx_load_buyer'),
        ]

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

    @property
    def days_overdue(self):
        """Calculate days overdue if payment is past due date."""
        if not self.payment_due_date:
            return None
        if self.payment_status in ['paid', 'cancelled']:
            return None

        from datetime import date
        today = date.today()
        if today > self.payment_due_date:
            return (today - self.payment_due_date).days
        return 0


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
        indexes = [
            models.Index(fields=['contractor'], name='idx_labor_contractor'),
        ]

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
