from django.db import models
from django.utils import timezone


# =============================================================================
# FSMA / PHI CONSTANTS
# =============================================================================

PHI_STATUS_CHOICES = [
    ('pending', 'Pending Check'),
    ('compliant', 'Compliant'),
    ('warning', 'Warning - Near PHI'),
    ('non_compliant', 'Non-Compliant'),
    ('override', 'Override Applied'),
]

AUDIT_BINDER_STATUS_CHOICES = [
    ('pending', 'Pending Generation'),
    ('generating', 'Generating'),
    ('completed', 'Completed'),
    ('failed', 'Failed'),
]


class PHIComplianceCheck(models.Model):
    """
    Pre-Harvest Interval compliance verification for each harvest.
    Auto-created when a harvest is recorded to verify PHI requirements.
    """
    harvest = models.OneToOneField(
        'Harvest',
        on_delete=models.CASCADE,
        related_name='phi_compliance_check'
    )
    status = models.CharField(
        max_length=20,
        choices=PHI_STATUS_CHOICES,
        default='pending'
    )

    # Details of PHI analysis
    applications_checked = models.JSONField(
        default=list,
        help_text="List of pesticide applications checked with PHI details"
    )
    warnings = models.JSONField(
        default=list,
        help_text="List of warning messages"
    )
    earliest_safe_harvest = models.DateField(
        null=True,
        blank=True,
        help_text="Earliest date harvest would be compliant"
    )

    # Override if user accepts warning
    override_reason = models.TextField(
        blank=True,
        help_text="Reason if status was overridden"
    )
    override_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='phi_overrides'
    )
    override_at = models.DateTimeField(null=True, blank=True)

    checked_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "PHI Compliance Check"
        verbose_name_plural = "PHI Compliance Checks"
        indexes = [
            models.Index(fields=['status'], name='idx_phi_status'),
        ]

    def __str__(self):
        return f"PHI Check for Harvest #{self.harvest.id} - {self.get_status_display()}"


class AuditBinder(models.Model):
    """
    Represents a generated audit binder PDF containing FSMA compliance records.
    Used for inspections and record-keeping.
    """
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='audit_binders'
    )

    # Date range for included records
    date_range_start = models.DateField()
    date_range_end = models.DateField()

    # Content selection flags
    include_visitor_logs = models.BooleanField(default=True)
    include_cleaning_logs = models.BooleanField(default=True)
    include_safety_meetings = models.BooleanField(default=True)
    include_fertilizer_inventory = models.BooleanField(default=True)
    include_phi_reports = models.BooleanField(default=True)
    include_harvest_records = models.BooleanField(default=True)

    # Optional filters
    farm_ids = models.JSONField(
        default=list,
        blank=True,
        help_text="Filter to specific farms (empty = all farms)"
    )

    # Generated document
    pdf_file = models.FileField(
        upload_to='audit_binders/',
        null=True,
        blank=True
    )
    file_size = models.PositiveIntegerField(null=True, blank=True)
    page_count = models.PositiveIntegerField(null=True, blank=True)

    # Generation status
    status = models.CharField(
        max_length=20,
        choices=AUDIT_BINDER_STATUS_CHOICES,
        default='pending'
    )
    error_message = models.TextField(blank=True)
    generation_started = models.DateTimeField(null=True, blank=True)
    generation_completed = models.DateTimeField(null=True, blank=True)

    # Metadata
    generated_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_binders_generated'
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Audit Binder"
        verbose_name_plural = "Audit Binders"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', '-created_at'], name='idx_audit_binder_company'),
            models.Index(fields=['status'], name='idx_audit_binder_status'),
        ]

    def __str__(self):
        return f"Audit Binder {self.date_range_start} to {self.date_range_end}"

    @property
    def generation_duration_seconds(self):
        if self.generation_started and self.generation_completed:
            return (self.generation_completed - self.generation_started).total_seconds()
        return None


# =============================================================================
# FSMA PRE-HARVEST AGRICULTURAL WATER ASSESSMENT MODELS
# =============================================================================

class FSMAWaterAssessment(models.Model):
    """
    Main FSMA Pre-Harvest Agricultural Water Assessment (21 CFR 112.43).

    Each farm needs one assessment per year covering all pre-harvest water sources.
    Must be reviewed and signed by a qualified supervisor.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('in_progress', 'In Progress'),
        ('pending_review', 'Pending Review'),
        ('approved', 'Approved'),
        ('expired', 'Expired'),
    ]

    OUTCOME_CHOICES = [
        ('no_treatment', 'No Treatment Required'),
        ('treatment_required', 'Treatment Required'),
        ('die_off_required', 'Die-Off Period Required'),
        ('testing_required', 'Additional Testing Required'),
    ]

    RISK_LEVEL_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='water_assessments'
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        related_name='water_assessments'
    )
    assessment_year = models.IntegerField(
        help_text="Year this assessment covers"
    )

    # Assessment metadata
    assessment_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date assessment was conducted"
    )
    assessor = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='water_assessments_conducted',
        help_text="User who conducted the assessment"
    )
    assessor_name = models.CharField(max_length=200, blank=True)
    assessor_title = models.CharField(max_length=100, blank=True)

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    # Risk scoring (calculated)
    overall_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Calculated overall risk score (0-100)"
    )
    risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVEL_CHOICES,
        blank=True
    )

    # FDA outcome determination
    fda_outcome = models.CharField(
        max_length=30,
        choices=OUTCOME_CHOICES,
        blank=True
    )
    outcome_notes = models.TextField(
        blank=True,
        help_text="Written justification for the determination"
    )

    # Submission workflow
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submitted_water_assessments'
    )

    # Approval workflow (required by FDA)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_water_assessments'
    )
    approval_notes = models.TextField(blank=True)

    # Signatures
    assessor_signature = models.TextField(
        blank=True,
        help_text="Base64-encoded signature image or typed name"
    )
    assessor_signature_date = models.DateTimeField(null=True, blank=True)
    approver_signature = models.TextField(
        blank=True,
        help_text="Base64-encoded signature image or typed name"
    )
    approver_signature_date = models.DateTimeField(null=True, blank=True)

    # Generated PDF
    pdf_file = models.FileField(
        upload_to='water_assessments/%Y/%m/',
        null=True,
        blank=True
    )
    pdf_generated_at = models.DateTimeField(null=True, blank=True)

    # Expiration (assessments are valid for 1 year)
    valid_until = models.DateField(null=True, blank=True)

    # Notes
    general_notes = models.TextField(blank=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['farm', 'assessment_year']
        ordering = ['-assessment_year', 'farm__name']
        verbose_name = 'FSMA Water Assessment'
        verbose_name_plural = 'FSMA Water Assessments'
        indexes = [
            models.Index(fields=['company', '-assessment_year'], name='idx_water_asmt_company_year'),
            models.Index(fields=['status'], name='idx_water_asmt_status'),
            models.Index(fields=['valid_until'], name='idx_water_asmt_valid_until'),
        ]

    def __str__(self):
        return f"{self.farm.name} - {self.assessment_year} Water Assessment"

    @property
    def is_current(self):
        """Check if this assessment is for the current year."""
        from datetime import date
        return self.assessment_year == date.today().year

    @property
    def days_until_expiry(self):
        """Days until this assessment expires."""
        from datetime import date
        if self.valid_until:
            return (self.valid_until - date.today()).days
        return None

    @property
    def is_expired(self):
        """Check if assessment has expired."""
        from datetime import date
        if self.valid_until:
            return self.valid_until < date.today()
        return False


class FSMASourceAssessment(models.Model):
    """
    Assessment of a specific water source within an FSMA water assessment.
    Evaluates Factor 1: Agricultural Water System per FDA requirements.
    """
    CONDITION_CHOICES = [
        ('good', 'Good - No deficiencies'),
        ('fair', 'Fair - Minor issues'),
        ('poor', 'Poor - Significant deficiencies'),
        ('critical', 'Critical - Immediate action needed'),
    ]

    DISTRIBUTION_TYPE_CHOICES = [
        ('direct_contact', 'Direct Contact with Harvestable Portion'),
        ('indirect_contact', 'Indirect Contact'),
        ('no_contact', 'No Contact with Harvestable Portion'),
    ]

    CONTROL_LEVEL_CHOICES = [
        ('full', 'Fully Under Control'),
        ('partial', 'Partially Under Control'),
        ('minimal', 'Minimal Control'),
    ]

    RISK_LEVEL_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    assessment = models.ForeignKey(
        FSMAWaterAssessment,
        on_delete=models.CASCADE,
        related_name='source_assessments'
    )
    water_source = models.ForeignKey(
        'WaterSource',
        on_delete=models.CASCADE,
        related_name='fsma_source_assessments'
    )

    # Control level assessment
    source_control_level = models.CharField(
        max_length=20,
        choices=CONTROL_LEVEL_CHOICES,
        default='full'
    )
    distribution_control_level = models.CharField(
        max_length=20,
        choices=CONTROL_LEVEL_CHOICES,
        default='full'
    )

    # Physical condition (for wells)
    wellhead_condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES,
        blank=True
    )
    well_cap_secure = models.BooleanField(null=True, blank=True)
    well_casing_intact = models.BooleanField(null=True, blank=True)
    backflow_prevention = models.BooleanField(null=True, blank=True)

    # Distribution system
    distribution_type = models.CharField(
        max_length=30,
        choices=DISTRIBUTION_TYPE_CHOICES,
        blank=True
    )

    # Contamination risk factors
    animal_access_possible = models.BooleanField(default=False)
    debris_present = models.BooleanField(default=False)
    standing_water_near_source = models.BooleanField(default=False)
    runoff_exposure = models.BooleanField(default=False)

    # Inspection status
    inspected_this_year = models.BooleanField(default=False)
    inspection_date = models.DateField(null=True, blank=True)
    inspection_findings = models.TextField(blank=True)

    # Overall condition
    overall_condition = models.CharField(
        max_length=20,
        choices=CONDITION_CHOICES,
        default='good'
    )
    protection_description = models.TextField(
        blank=True,
        help_text="Describe how source is protected from contamination"
    )

    # Testing history
    last_test_date = models.DateField(null=True, blank=True)
    last_e_coli_result = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Most recent E. coli result (CFU/100mL)"
    )
    last_generic_ecoli_gm = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Geometric Mean E. coli (CFU/100mL)"
    )
    last_generic_ecoli_stv = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Statistical Threshold Value (CFU/100mL)"
    )
    meets_quality_standard = models.BooleanField(null=True, blank=True)

    # Treatment
    treatment_applied = models.CharField(max_length=100, blank=True)
    treatment_log_available = models.BooleanField(default=False)

    # Risk scoring
    source_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    source_risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVEL_CHOICES,
        blank=True
    )

    # Risk factors identified (JSON list)
    risk_factors = models.JSONField(
        default=list,
        help_text="List of risk factors identified during assessment"
    )

    # Photos (optional)
    photo_1 = models.ImageField(
        upload_to='water_assessment_photos/',
        null=True,
        blank=True
    )
    photo_2 = models.ImageField(
        upload_to='water_assessment_photos/',
        null=True,
        blank=True
    )

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['assessment', 'water_source']
        verbose_name = 'FSMA Source Assessment'
        verbose_name_plural = 'FSMA Source Assessments'

    def __str__(self):
        return f"{self.assessment} - {self.water_source.name}"


class FSMAFieldAssessment(models.Model):
    """
    Field-specific water practice assessment.
    Evaluates Factor 2 (Practices) and Factor 3 (Crop Characteristics).
    """
    APPLICATION_METHOD_CHOICES = [
        ('overhead', 'Overhead Sprinkler'),
        ('drip', 'Drip/Micro-irrigation'),
        ('micro_sprinkler', 'Micro-Sprinkler'),
        ('furrow', 'Furrow/Flood'),
        ('subsurface', 'Subsurface Drip'),
        ('hand_watering', 'Hand Watering'),
        ('none', 'No Irrigation'),
    ]

    CROP_CONTACT_CHOICES = [
        ('direct', 'Water Directly Contacts Harvestable Portion'),
        ('indirect', 'Water Contacts Non-Harvestable Portions Only'),
        ('soil_only', 'Water Applied to Soil Only'),
    ]

    GROWTH_POSITION_CHOICES = [
        ('tree', 'Tree Fruit (Elevated)'),
        ('vine', 'Vine'),
        ('ground', 'Ground Level'),
        ('root', 'Root Crop'),
    ]

    SURFACE_TYPE_CHOICES = [
        ('smooth', 'Smooth'),
        ('rough', 'Rough/Textured'),
        ('netted', 'Netted'),
        ('leafy', 'Leafy'),
    ]

    SUSCEPTIBILITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    RISK_LEVEL_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    assessment = models.ForeignKey(
        FSMAWaterAssessment,
        on_delete=models.CASCADE,
        related_name='field_assessments'
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='fsma_water_assessments'
    )

    # Water source used for this field
    water_source = models.ForeignKey(
        'WaterSource',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fsma_field_assessments'
    )

    # Factor 2: Water Practices
    application_method = models.CharField(
        max_length=30,
        choices=APPLICATION_METHOD_CHOICES,
        blank=True
    )
    crop_contact_type = models.CharField(
        max_length=20,
        choices=CROP_CONTACT_CHOICES,
        blank=True
    )

    # Timing relative to harvest
    typical_days_before_harvest = models.IntegerField(
        null=True,
        blank=True,
        help_text="Typical days between last irrigation and harvest"
    )
    minimum_days_before_harvest = models.IntegerField(
        null=True,
        blank=True,
        help_text="Minimum days between last irrigation and harvest"
    )

    # Foliar applications
    foliar_applications = models.BooleanField(
        default=False,
        help_text="Any foliar spray applications using this water?"
    )

    # Factor 3: Crop Characteristics
    crop_growth_position = models.CharField(
        max_length=20,
        choices=GROWTH_POSITION_CHOICES,
        default='tree'
    )
    crop_surface_type = models.CharField(
        max_length=20,
        choices=SURFACE_TYPE_CHOICES,
        default='smooth'
    )
    internalization_risk = models.CharField(
        max_length=20,
        choices=SUSCEPTIBILITY_CHOICES,
        default='low',
        help_text="Susceptibility to pathogen internalization"
    )

    # Die-off considerations
    die_off_period_adequate = models.BooleanField(null=True, blank=True)
    die_off_conditions_notes = models.TextField(
        blank=True,
        help_text="UV exposure, temperature, drying conditions, etc."
    )

    # Risk scoring
    practice_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    crop_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    field_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    field_risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVEL_CHOICES,
        blank=True
    )

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['assessment', 'field']
        verbose_name = 'FSMA Field Assessment'
        verbose_name_plural = 'FSMA Field Assessments'

    def __str__(self):
        return f"{self.assessment} - {self.field.name}"


class FSMAEnvironmentalAssessment(models.Model):
    """
    Environmental and adjacent land assessment.
    Evaluates Factor 4 (Environmental) and Factor 5 (Adjacent Land).
    One per FSMAWaterAssessment.
    """
    PROXIMITY_CHOICES = [
        ('within_100ft', 'Within 100 feet'),
        ('100_400ft', '100-400 feet'),
        ('400_1000ft', '400-1000 feet'),
        ('over_1000ft', 'Over 1000 feet'),
        ('none_nearby', 'None in Vicinity'),
    ]

    FLOODING_RISK_CHOICES = [
        ('none', 'No Flooding Risk'),
        ('low', 'Low - Rare flooding'),
        ('medium', 'Medium - Occasional flooding'),
        ('high', 'High - Frequent flooding'),
    ]

    WILDLIFE_PRESSURE_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    RISK_LEVEL_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    assessment = models.ForeignKey(
        FSMAWaterAssessment,
        on_delete=models.CASCADE,
        related_name='environmental_assessments'
    )

    # Factor 4: Environmental Conditions
    flooding_risk = models.CharField(
        max_length=20,
        choices=FLOODING_RISK_CHOICES,
        default='none'
    )
    flooding_history = models.BooleanField(default=False)
    last_flood_date = models.DateField(null=True, blank=True)
    flood_frequency = models.CharField(max_length=50, blank=True)
    heavy_rain_frequency = models.CharField(
        max_length=100,
        blank=True,
        help_text="Description of heavy rain patterns"
    )
    extreme_weather_notes = models.TextField(blank=True)

    # Factor 5: Adjacent Land Uses
    adjacent_land_uses = models.JSONField(
        default=list,
        blank=True,
        help_text="List of adjacent land uses"
    )

    # Animal operations
    animal_operations_nearby = models.BooleanField(default=False)
    animal_operation_type = models.CharField(
        max_length=100,
        blank=True,
        help_text="Type of animal operation (dairy, poultry, etc.)"
    )
    animal_operation_distance_ft = models.IntegerField(
        null=True,
        blank=True,
        help_text="Distance to animal operation in feet"
    )
    nearest_cafo_distance = models.CharField(
        max_length=20,
        choices=PROXIMITY_CHOICES,
        blank=True
    )
    nearest_grazing_distance = models.CharField(
        max_length=20,
        choices=PROXIMITY_CHOICES,
        blank=True
    )
    animal_intrusion_history = models.BooleanField(default=False)
    animal_intrusion_notes = models.TextField(blank=True)

    # Manure application
    manure_application_nearby = models.BooleanField(default=False)
    manure_notes = models.TextField(blank=True)

    # Human waste / septic
    human_waste_nearby = models.BooleanField(default=False)
    human_waste_type = models.CharField(
        max_length=100,
        blank=True,
        help_text="Type (septic, portable toilets, etc.)"
    )
    nearest_septic_distance = models.CharField(
        max_length=20,
        choices=PROXIMITY_CHOICES,
        blank=True
    )
    septic_system_status = models.CharField(max_length=50, blank=True)

    # Runoff
    upslope_land_uses = models.TextField(blank=True)
    runoff_management_in_place = models.BooleanField(default=False)
    runoff_management_description = models.TextField(blank=True)

    # Wildlife
    wildlife_pressure = models.CharField(
        max_length=20,
        choices=WILDLIFE_PRESSURE_CHOICES,
        blank=True
    )
    wildlife_types_observed = models.TextField(blank=True)
    wildlife_exclusion_measures = models.TextField(blank=True)

    # Other water users
    other_water_users = models.TextField(
        blank=True,
        help_text="Description of other users of water system"
    )
    other_hazards = models.TextField(
        blank=True,
        help_text="Any other identified hazards"
    )

    # Historical contamination
    previous_contamination = models.BooleanField(default=False)
    contamination_details = models.TextField(blank=True)

    # Risk scoring
    environmental_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    adjacent_land_risk_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    environmental_risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVEL_CHOICES,
        blank=True
    )

    # Whether adjacent land hazards exist (triggers same-season mitigation)
    has_adjacent_land_hazards = models.BooleanField(default=False)

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'FSMA Environmental Assessment'
        verbose_name_plural = 'FSMA Environmental Assessments'

    def __str__(self):
        return f"{self.assessment} - Environmental"


class FSMAMitigationAction(models.Model):
    """
    Tracks required mitigation measures if hazards are identified.
    """
    PRIORITY_CHOICES = [
        ('critical', 'Critical - Immediate Action Required'),
        ('high', 'High - Action Required Within 7 Days'),
        ('medium', 'Medium - Action Required Within 30 Days'),
        ('low', 'Low - Action Required Before Next Assessment'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('deferred', 'Deferred'),
        ('not_required', 'No Longer Required'),
    ]

    CATEGORY_CHOICES = [
        ('infrastructure', 'Infrastructure Repair/Improvement'),
        ('testing', 'Additional Testing'),
        ('treatment', 'Water Treatment'),
        ('exclusion', 'Animal/Wildlife Exclusion'),
        ('operational', 'Operational Change'),
        ('documentation', 'Documentation/Training'),
        ('other', 'Other'),
    ]

    HAZARD_SOURCE_CHOICES = [
        ('adjacent_animal', 'Adjacent Land - Animal Activity'),
        ('adjacent_manure', 'Adjacent Land - Manure/BSAAO'),
        ('adjacent_human_waste', 'Adjacent Land - Human Waste'),
        ('on_farm', 'On-Farm Hazard'),
        ('water_system', 'Water System Issue'),
        ('environmental', 'Environmental Condition'),
    ]

    assessment = models.ForeignKey(
        FSMAWaterAssessment,
        on_delete=models.CASCADE,
        related_name='mitigation_actions'
    )

    # Related sub-assessment (optional)
    source_assessment = models.ForeignKey(
        FSMASourceAssessment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mitigation_actions'
    )
    field_assessment = models.ForeignKey(
        FSMAFieldAssessment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mitigation_actions'
    )
    environmental_assessment = models.ForeignKey(
        FSMAEnvironmentalAssessment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mitigation_actions'
    )

    # Action details
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    hazard_source = models.CharField(
        max_length=30,
        choices=HAZARD_SOURCE_CHOICES,
        blank=True
    )
    title = models.CharField(max_length=200)
    hazard_description = models.TextField(
        blank=True,
        help_text="Description of the hazard being mitigated"
    )
    mitigation_description = models.TextField(
        help_text="Description of the mitigation action"
    )

    # Priority and timing
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES)
    due_date = models.DateField()
    requires_same_season = models.BooleanField(
        default=False,
        help_text="True if hazard from adjacent land (requires same-season action)"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    assigned_to = models.CharField(max_length=200, blank=True)

    # Completion
    completed_date = models.DateField(null=True, blank=True)
    completed_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_water_mitigations'
    )
    completion_notes = models.TextField(blank=True)

    # Verification
    verification_required = models.BooleanField(default=False)
    verified_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_water_mitigations'
    )
    verified_date = models.DateField(null=True, blank=True)

    # Evidence
    evidence_file = models.FileField(
        upload_to='mitigation_evidence/',
        null=True,
        blank=True
    )
    evidence_photo = models.ImageField(
        upload_to='mitigation_photos/',
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-priority', 'due_date']
        verbose_name = 'FSMA Mitigation Action'
        verbose_name_plural = 'FSMA Mitigation Actions'
        indexes = [
            models.Index(fields=['status', 'due_date'], name='idx_mitigation_status_due'),
        ]

    def __str__(self):
        return f"{self.assessment} - {self.title}"

    @property
    def is_overdue(self):
        """Check if action is overdue."""
        from datetime import date
        if self.status in ['pending', 'in_progress']:
            return self.due_date < date.today()
        return False
