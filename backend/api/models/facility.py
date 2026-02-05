from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from decimal import Decimal


# =============================================================================
# FSMA COMPLIANCE MODULE
# =============================================================================

# --- FSMA Choice Constants ---

FACILITY_TYPE_CHOICES = [
    ('packing_shed', 'Packing Shed'),
    ('cold_storage', 'Cold Storage'),
    ('processing_area', 'Processing Area'),
    ('restroom', 'Restroom/Portable Toilet'),
    ('break_room', 'Break Room'),
    ('equipment_storage', 'Equipment Storage'),
    ('chemical_storage', 'Chemical/Pesticide Storage'),
    ('loading_dock', 'Loading Dock'),
    ('field_station', 'Field Station'),
    ('other', 'Other'),
]

CLEANING_FREQUENCY_CHOICES = [
    ('daily', 'Daily'),
    ('twice_daily', 'Twice Daily'),
    ('weekly', 'Weekly'),
    ('biweekly', 'Bi-Weekly'),
    ('monthly', 'Monthly'),
    ('as_needed', 'As Needed'),
    ('after_use', 'After Each Use'),
]

VISITOR_TYPE_CHOICES = [
    ('harvester', 'Harvest Crew'),
    ('buyer', 'Buyer/Inspector'),
    ('contractor', 'Contractor'),
    ('vendor', 'Vendor/Supplier'),
    ('government', 'Government Inspector'),
    ('auditor', 'Auditor'),
    ('consultant', 'Consultant/PCA'),
    ('delivery', 'Delivery Personnel'),
    ('maintenance', 'Maintenance'),
    ('visitor', 'General Visitor'),
    ('other', 'Other'),
]

SAFETY_MEETING_TYPE_CHOICES = [
    ('quarterly_fsma', 'Quarterly FSMA Training'),
    ('annual_food_safety', 'Annual Food Safety Training'),
    ('wps_initial', 'WPS Initial Training'),
    ('wps_annual', 'WPS Annual Refresher'),
    ('heat_illness', 'Heat Illness Prevention'),
    ('pesticide_safety', 'Pesticide Safety'),
    ('equipment_operation', 'Equipment Operation'),
    ('emergency_procedures', 'Emergency Procedures'),
    ('ppe_usage', 'PPE Usage Training'),
    ('other', 'Other Safety Meeting'),
]

INVENTORY_TRANSACTION_TYPE_CHOICES = [
    ('purchase', 'Purchase/Received'),
    ('application', 'Application Used'),
    ('adjustment', 'Manual Adjustment'),
    ('return', 'Returned to Supplier'),
    ('disposed', 'Disposed/Expired'),
    ('transfer_in', 'Transfer In'),
    ('transfer_out', 'Transfer Out'),
]


class UserSignature(models.Model):
    """
    Stores a user's saved digital signature for reuse across FSMA forms.
    One signature per user - can be updated when needed.
    """
    user = models.OneToOneField(
        'User',
        on_delete=models.CASCADE,
        related_name='saved_signature'
    )
    signature_data = models.TextField(
        help_text="Base64 encoded PNG signature image"
    )
    signature_hash = models.CharField(
        max_length=64,
        blank=True,
        help_text="SHA256 hash for verification"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Signature"
        verbose_name_plural = "User Signatures"

    def __str__(self):
        return f"Signature for {self.user.email}"

    def save(self, *args, **kwargs):
        import hashlib
        if self.signature_data:
            self.signature_hash = hashlib.sha256(self.signature_data.encode()).hexdigest()
        super().save(*args, **kwargs)


class FacilityLocation(models.Model):
    """
    Defines a facility/location that requires cleaning tracking.
    Each company can have multiple facilities to manage.
    """
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='fsma_facilities'
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='fsma_facilities',
        help_text="Optional: Link to specific farm"
    )
    name = models.CharField(
        max_length=100,
        help_text="Facility name (e.g., 'Main Packing Shed', 'North Field Restroom')"
    )
    facility_type = models.CharField(
        max_length=30,
        choices=FACILITY_TYPE_CHOICES,
        default='packing_shed'
    )
    description = models.TextField(
        blank=True,
        help_text="Additional description or notes"
    )
    cleaning_frequency = models.CharField(
        max_length=20,
        choices=CLEANING_FREQUENCY_CHOICES,
        default='daily'
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive facilities won't appear in cleaning schedules"
    )
    gps_latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True
    )
    gps_longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Facility Location"
        verbose_name_plural = "Facility Locations"
        ordering = ['name']
        indexes = [
            models.Index(fields=['company', 'is_active'], name='idx_facility_company_active'),
            models.Index(fields=['facility_type'], name='idx_facility_type'),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_facility_type_display()})"


class FacilityCleaningLog(models.Model):
    """
    Records a cleaning event for a facility.
    Includes checklist items and signature verification.
    """
    facility = models.ForeignKey(
        FacilityLocation,
        on_delete=models.CASCADE,
        related_name='cleaning_logs'
    )
    cleaning_date = models.DateField()
    cleaning_time = models.TimeField()
    cleaned_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='cleaning_logs_performed'
    )
    cleaned_by_name = models.CharField(
        max_length=100,
        blank=True,
        help_text="Name if cleaned by non-system user"
    )

    # Checklist items (common cleaning tasks)
    surfaces_cleaned = models.BooleanField(default=False)
    floors_cleaned = models.BooleanField(default=False)
    trash_removed = models.BooleanField(default=False)
    sanitizer_applied = models.BooleanField(default=False)
    supplies_restocked = models.BooleanField(default=False)
    equipment_cleaned = models.BooleanField(default=False)

    # Additional checklist items stored as JSON for flexibility
    additional_checklist = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional checklist items specific to facility type"
    )

    notes = models.TextField(blank=True)

    # Signature capture
    signature_data = models.TextField(
        blank=True,
        help_text="Base64 encoded signature image"
    )
    signature_timestamp = models.DateTimeField(null=True, blank=True)

    # Verification
    verified_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cleaning_logs_verified'
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Facility Cleaning Log"
        verbose_name_plural = "Facility Cleaning Logs"
        ordering = ['-cleaning_date', '-cleaning_time']
        indexes = [
            models.Index(fields=['facility', '-cleaning_date'], name='idx_cleaning_facility_date'),
            models.Index(fields=['cleaning_date'], name='idx_cleaning_date'),
        ]

    def __str__(self):
        return f"{self.facility.name} - {self.cleaning_date}"

    @property
    def is_signed(self):
        return bool(self.signature_data)


class VisitorLog(models.Model):
    """
    Tracks all visitors to farm properties for FSMA traceability.
    Can be linked to harvest events for harvester crews.
    """
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='visitor_logs'
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        related_name='visitor_logs'
    )

    # Visitor identification
    visitor_name = models.CharField(max_length=150)
    visitor_company = models.CharField(
        max_length=150,
        blank=True,
        help_text="Visitor's company/organization"
    )
    visitor_type = models.CharField(
        max_length=30,
        choices=VISITOR_TYPE_CHOICES,
        default='visitor'
    )
    visitor_phone = models.CharField(max_length=20, blank=True)
    visitor_email = models.EmailField(blank=True)

    # Visit details
    visit_date = models.DateField()
    time_in = models.TimeField()
    time_out = models.TimeField(null=True, blank=True)
    purpose = models.TextField(
        blank=True,
        help_text="Purpose of visit"
    )

    # Fields/areas visited (M2M to Field)
    fields_visited = models.ManyToManyField(
        'Field',
        blank=True,
        related_name='visitor_logs'
    )
    areas_visited = models.TextField(
        blank=True,
        help_text="Free text for non-field areas visited"
    )

    # Vehicle info
    vehicle_info = models.CharField(
        max_length=100,
        blank=True,
        help_text="Vehicle description/license plate"
    )

    # Harvest linkage
    linked_harvest = models.ForeignKey(
        'Harvest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='visitor_logs',
        help_text="Linked harvest event (for harvest crews)"
    )
    auto_linked = models.BooleanField(
        default=False,
        help_text="Whether harvest was auto-linked by date match"
    )

    # Health screening (COVID-era but still useful)
    health_screening_passed = models.BooleanField(
        default=True,
        help_text="Did visitor pass health screening?"
    )
    screening_notes = models.TextField(blank=True)

    # Signature
    signature_data = models.TextField(
        blank=True,
        help_text="Base64 encoded visitor signature"
    )
    signature_timestamp = models.DateTimeField(null=True, blank=True)

    # Who logged this entry
    logged_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='visitor_logs_created'
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Visitor Log"
        verbose_name_plural = "Visitor Logs"
        ordering = ['-visit_date', '-time_in']
        indexes = [
            models.Index(fields=['company', '-visit_date'], name='idx_visitor_company_date'),
            models.Index(fields=['farm', '-visit_date'], name='idx_visitor_farm_date'),
            models.Index(fields=['visitor_type'], name='idx_visitor_type'),
            models.Index(fields=['linked_harvest'], name='idx_visitor_harvest'),
        ]

    def __str__(self):
        return f"{self.visitor_name} - {self.farm.name} ({self.visit_date})"

    @property
    def is_signed(self):
        return bool(self.signature_data)

    @property
    def duration_minutes(self):
        if self.time_in and self.time_out:
            from datetime import datetime, timedelta
            t_in = datetime.combine(self.visit_date, self.time_in)
            t_out = datetime.combine(self.visit_date, self.time_out)
            if t_out < t_in:
                t_out += timedelta(days=1)
            return int((t_out - t_in).total_seconds() / 60)
        return None


class SafetyMeeting(models.Model):
    """
    Records company-wide safety meetings (not per-farm).
    Quarterly FSMA training and other safety topics.
    """
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='safety_meetings'
    )
    meeting_type = models.CharField(
        max_length=30,
        choices=SAFETY_MEETING_TYPE_CHOICES,
        default='quarterly_fsma'
    )
    meeting_date = models.DateField()
    meeting_time = models.TimeField(null=True, blank=True)
    location = models.CharField(max_length=200, blank=True)

    # Meeting details
    topics_covered = models.JSONField(
        default=list,
        help_text="List of topics covered in this meeting"
    )
    description = models.TextField(
        blank=True,
        help_text="Meeting description or agenda"
    )
    duration_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Meeting duration in minutes"
    )

    # Quarterly tracking (for quarterly compliance)
    quarter = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Quarter number (1-4)"
    )
    year = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Year for quarterly tracking"
    )

    # Trainer/presenter info
    trainer_name = models.CharField(max_length=150, blank=True)
    trainer_credentials = models.CharField(max_length=200, blank=True)

    # Attachments (e.g., presentation, materials)
    materials_provided = models.TextField(
        blank=True,
        help_text="Description of training materials provided"
    )

    # Metadata
    conducted_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='safety_meetings_conducted'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Safety Meeting"
        verbose_name_plural = "Safety Meetings"
        ordering = ['-meeting_date']
        indexes = [
            models.Index(fields=['company', '-meeting_date'], name='idx_safety_meeting_company'),
            models.Index(fields=['meeting_type'], name='idx_safety_meeting_type'),
            models.Index(fields=['company', 'year', 'quarter'], name='idx_safety_meeting_quarter'),
        ]
        unique_together = [
            ['company', 'meeting_type', 'year', 'quarter']  # One quarterly meeting per type
        ]

    def __str__(self):
        return f"{self.get_meeting_type_display()} - {self.meeting_date}"

    def save(self, *args, **kwargs):
        # Auto-calculate quarter and year if not set
        if self.meeting_date and not self.quarter:
            self.quarter = (self.meeting_date.month - 1) // 3 + 1
        if self.meeting_date and not self.year:
            self.year = self.meeting_date.year
        super().save(*args, **kwargs)


class SafetyMeetingAttendee(models.Model):
    """
    Records individual attendance at a safety meeting.
    Each attendee must sign to confirm attendance.
    """
    meeting = models.ForeignKey(
        SafetyMeeting,
        on_delete=models.CASCADE,
        related_name='attendees'
    )

    # Attendee info (may or may not be a system user)
    user = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='safety_meeting_attendance'
    )
    attendee_name = models.CharField(
        max_length=150,
        help_text="Attendee name (auto-filled from user if linked)"
    )
    employee_id = models.CharField(max_length=50, blank=True)
    department = models.CharField(max_length=100, blank=True)

    # Signature capture
    signature_data = models.TextField(
        blank=True,
        help_text="Base64 encoded signature"
    )
    signed_at = models.DateTimeField(null=True, blank=True)

    # Record keeping
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Safety Meeting Attendee"
        verbose_name_plural = "Safety Meeting Attendees"
        ordering = ['attendee_name']
        unique_together = [['meeting', 'attendee_name']]  # One entry per person per meeting

    def __str__(self):
        return f"{self.attendee_name} - {self.meeting}"

    @property
    def is_signed(self):
        return bool(self.signature_data)


class FertilizerInventory(models.Model):
    """
    Tracks current inventory levels for fertilizer products.
    One record per product per company.
    """
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='fertilizer_inventory'
    )
    product = models.ForeignKey(
        'FertilizerProduct',
        on_delete=models.CASCADE,
        related_name='inventory_records'
    )
    quantity_on_hand = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Current quantity on hand"
    )
    unit = models.CharField(
        max_length=20,
        default='lbs',
        help_text="Unit of measurement (lbs, gallons, tons, etc.)"
    )
    reorder_point = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Alert when inventory falls below this level"
    )
    storage_location = models.CharField(
        max_length=100,
        blank=True,
        help_text="Where this product is stored"
    )
    lot_number = models.CharField(max_length=50, blank=True)
    expiration_date = models.DateField(null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Fertilizer Inventory"
        verbose_name_plural = "Fertilizer Inventories"
        unique_together = [['company', 'product']]
        indexes = [
            models.Index(fields=['company', 'product'], name='idx_fert_inv_company_product'),
        ]

    def __str__(self):
        return f"{self.product.name}: {self.quantity_on_hand} {self.unit}"

    @property
    def is_low_stock(self):
        if self.reorder_point:
            return self.quantity_on_hand <= self.reorder_point
        return False


class FertilizerInventoryTransaction(models.Model):
    """
    Records all inventory movements (purchases, applications, adjustments).
    Provides full audit trail for fertilizer usage.
    """
    inventory = models.ForeignKey(
        FertilizerInventory,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=INVENTORY_TRANSACTION_TYPE_CHOICES
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Positive for additions, negative for deductions"
    )
    balance_after = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Inventory balance after this transaction"
    )
    transaction_date = models.DateTimeField()

    # Link to nutrient application if applicable
    nutrient_application = models.ForeignKey(
        'NutrientApplication',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inventory_transactions'
    )

    # Purchase/receiving details
    supplier = models.CharField(max_length=150, blank=True)
    invoice_number = models.CharField(max_length=50, blank=True)
    cost_per_unit = models.DecimalField(
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

    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='inventory_transactions_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Inventory Transaction"
        verbose_name_plural = "Inventory Transactions"
        ordering = ['-transaction_date']
        indexes = [
            models.Index(fields=['inventory', '-transaction_date'], name='idx_inv_trans_inv_date'),
            models.Index(fields=['transaction_type'], name='idx_inv_trans_type'),
        ]

    def __str__(self):
        return f"{self.get_transaction_type_display()}: {self.quantity} ({self.inventory.product.name})"


class MonthlyInventorySnapshot(models.Model):
    """
    Stores monthly inventory snapshots for reporting.
    Auto-generated on the 1st of each month.
    """
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='inventory_snapshots'
    )
    month = models.PositiveSmallIntegerField(help_text="Month (1-12)")
    year = models.PositiveIntegerField()

    # Full inventory snapshot stored as JSON
    inventory_data = models.JSONField(
        default=list,
        help_text="Snapshot of all inventory levels"
    )
    # Summary statistics
    total_products = models.PositiveIntegerField(default=0)
    total_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    low_stock_count = models.PositiveIntegerField(default=0)

    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Monthly Inventory Snapshot"
        verbose_name_plural = "Monthly Inventory Snapshots"
        unique_together = [['company', 'year', 'month']]
        ordering = ['-year', '-month']

    def __str__(self):
        return f"{self.company.name} - {self.year}/{self.month:02d} Inventory"
