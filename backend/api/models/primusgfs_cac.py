"""
PrimusGFS CAC Food Safety Manual V5.0 Models
"""

from datetime import date
from django.conf import settings
from django.db import models

from .primusgfs_core import ControlledDocument, CorrectiveAction
from .primusgfs_supply import ApprovedSupplier


# =============================================================================
# CAC FOOD SAFETY MANUAL V5.0 — ADDITIONAL CHOICES
# =============================================================================

QUARTER_CHOICES = [
    ('Q1', 'Q1 (Jan-Mar)'),
    ('Q2', 'Q2 (Apr-Jun)'),
    ('Q3', 'Q3 (Jul-Sep)'),
    ('Q4', 'Q4 (Oct-Dec)'),
]

TRAINING_CATEGORY_CHOICES = [
    ('psa', 'Produce Safety Alliance'),
    ('animal_intrusion', 'Animal Intrusion'),
    ('food_safety', 'Food Safety & Security'),
    ('hygiene', 'Worker Health & Hygiene'),
    ('bleeding_illness', 'Bleeding/Bodily Fluids & Illness'),
    ('inspections', 'Internal & External Inspections'),
    ('crop_protection', 'Crop Protection / Pesticides'),
    ('emergency', 'Emergency Response'),
    ('food_defense', 'Food Defense'),
    ('other', 'Other'),
]

LANGUAGE_CHOICES = [
    ('english', 'English'),
    ('spanish', 'Spanish'),
    ('bilingual', 'Bilingual (English/Spanish)'),
]

RISK_LEVEL_CHOICES = [
    ('low', 'Low'),
    ('medium', 'Medium'),
    ('high', 'High'),
    ('critical', 'Critical'),
]

VERIFICATION_TYPE_CHOICES = [
    ('crop_protection', 'Crop Protection Applicator'),
    ('labor_contractor', 'Labor Contractor'),
    ('toilet_service', 'Toilet/Handwash Service'),
    ('water_lab', 'Water Testing Laboratory'),
    ('packinghouse', 'Packinghouse'),
    ('fertilizer', 'Fertilizer Supplier'),
    ('other', 'Other'),
]

VIOLATION_TYPE_CHOICES = [
    ('hygiene', 'Hygiene Violation'),
    ('food_safety_procedure', 'Food Safety Procedure Violation'),
    ('ppe', 'PPE Violation'),
    ('restricted_area', 'Restricted Area Violation'),
    ('toilet_use', 'Toilet Use Violation'),
    ('eating_smoking', 'Eating/Smoking in Growing Area'),
    ('other', 'Other'),
]

HOLD_STATUS_CHOICES = [
    ('on_hold', 'On Hold'),
    ('released', 'Released'),
    ('rejected', 'Rejected'),
    ('destroyed', 'Destroyed'),
]

HOLD_REASON_CHOICES = [
    ('contamination_suspected', 'Suspected Contamination'),
    ('pesticide_violation', 'Pesticide Violation'),
    ('water_quality', 'Water Quality Issue'),
    ('foreign_material', 'Foreign Material'),
    ('customer_complaint', 'Customer Complaint'),
    ('damaged_packaging', 'Damaged Packaging'),
    ('missing_documentation', 'Missing Documentation'),
    ('investigation', 'Under Investigation'),
    ('other', 'Other'),
]

NUOCA_CATEGORY_CHOICES = [
    ('food_safety_incident', 'Food Safety Incident'),
    ('contamination_suspected', 'Suspected Contamination'),
    ('animal_intrusion', 'Animal Intrusion'),
    ('chemical_spill', 'Chemical Spill'),
    ('equipment_failure', 'Equipment Failure'),
    ('worker_illness', 'Worker Illness/Injury'),
    ('water_system', 'Water System Issue'),
    ('product_rejection', 'Product Rejection'),
    ('flooding', 'Flooding Event'),
    ('security_breach', 'Security Breach'),
    ('other', 'Other Unusual Occurrence'),
]

CHEMICAL_TYPE_CHOICES = [
    ('herbicide', 'Herbicide'),
    ('insecticide', 'Insecticide'),
    ('fungicide', 'Fungicide'),
    ('rodenticide', 'Rodenticide'),
    ('fumigant', 'Fumigant'),
    ('adjuvant', 'Adjuvant'),
    ('growth_regulator', 'Growth Regulator'),
    ('other', 'Other'),
]

EMERGENCY_CONTACT_TYPE_CHOICES = [
    ('fire', 'Fire Department'),
    ('police', 'Police / Sheriff'),
    ('ambulance', 'Ambulance / EMS'),
    ('hospital', 'Hospital'),
    ('poison_control', 'Poison Control'),
    ('county_ag', 'County Agricultural Commissioner'),
    ('dpr', 'Dept. of Pesticide Regulation'),
    ('epa', 'EPA'),
    ('fda', 'FDA'),
    ('cdfa', 'CDFA'),
    ('usda', 'USDA'),
    ('cdc', 'CDC'),
    ('utility', 'Utility Company'),
    ('packinghouse', 'Packinghouse'),
    ('company_management', 'Company Management'),
    ('food_safety_coordinator', 'Food Safety Coordinator'),
    ('other', 'Other'),
]

ROLE_CATEGORY_CHOICES = [
    ('owner', 'Owner / Grower'),
    ('coordinator', 'Food Safety Coordinator'),
    ('alternate_coordinator', 'Alternate Coordinator'),
    ('committee_member', 'Committee Member'),
    ('manager', 'Manager / Foreman'),
    ('supervisor', 'Supervisor'),
    ('irrigator', 'Irrigator'),
    ('applicator', 'Pesticide Applicator'),
    ('worker', 'Worker'),
    ('other', 'Other'),
]

FRAUD_VULNERABILITY_CHOICES = [
    ('low', 'Low'),
    ('medium', 'Medium'),
    ('high', 'High'),
]

SIGNER_ROLE_CHOICES = [
    ('coordinator', 'Food Safety Coordinator'),
    ('owner', 'Owner / Grower'),
    ('reviewer', 'Reviewer'),
    ('assessor', 'Assessor'),
    ('supervisor', 'Supervisor'),
    ('employee', 'Employee'),
    ('attendee', 'Attendee'),
]


# =============================================================================
# CAC DOC 01 — FOOD SAFETY PROFILE
# =============================================================================

class FoodSafetyProfile(models.Model):
    """
    Ranch-level food safety profile (CAC Doc 01).
    One per company — stores coordinator info, policy statement, ranch overview.
    """
    company = models.OneToOneField(
        'Company', on_delete=models.CASCADE, related_name='food_safety_profile'
    )

    # Food Safety Coordinator (Doc 01)
    coordinator_name = models.CharField(max_length=200, blank=True)
    coordinator_title = models.CharField(max_length=200, blank=True)
    coordinator_phone = models.CharField(max_length=50, blank=True)
    coordinator_email = models.EmailField(blank=True)
    alternate_coordinator_name = models.CharField(max_length=200, blank=True)
    alternate_coordinator_phone = models.CharField(max_length=50, blank=True)

    # Food Safety Policy Statement (Doc 01 page 2)
    policy_statement = models.TextField(
        blank=True,
        help_text="The company's food safety policy — must be posted in a public area"
    )
    policy_effective_date = models.DateField(null=True, blank=True)
    policy_reviewed_date = models.DateField(null=True, blank=True)
    policy_approved_by = models.CharField(max_length=200, blank=True)
    policy_approved_title = models.CharField(max_length=200, blank=True)

    # Ranch Overview
    commodities_grown = models.JSONField(
        default=list, blank=True, help_text='["Avocados", "Lemons"]'
    )
    total_planted_acres = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    ranch_map_file = models.FileField(
        upload_to='food_safety_profiles/%Y/', null=True, blank=True,
        help_text="Aerial image/map showing water fixtures, crops, fields"
    )

    last_reviewed_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Food Safety Profile"

    def __str__(self):
        return f"Food Safety Profile - {self.company}"


# =============================================================================
# CAC DOC 02 — ORGANIZATIONAL STRUCTURE
# =============================================================================

class FoodSafetyRoleAssignment(models.Model):
    """
    Food safety org chart role assignments (CAC Doc 02).
    Maps people to food safety roles with their responsibilities.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='food_safety_roles'
    )
    role_category = models.CharField(max_length=30, choices=ROLE_CATEGORY_CHOICES)
    role_title = models.CharField(max_length=200, help_text="e.g., Owner / Grower")
    person_name = models.CharField(max_length=200)
    person_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='food_safety_roles'
    )
    alternate_name = models.CharField(max_length=200, blank=True)
    responsibilities = models.JSONField(
        default=list, blank=True,
        help_text='["Oversees food safety and security", "Responsible for paperwork upkeep"]'
    )
    active = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'role_category']
        indexes = [
            models.Index(fields=['company', 'active'], name='idx_fsrole_company_active'),
        ]

    def __str__(self):
        return f"{self.person_name} - {self.role_title}"


# =============================================================================
# CAC DOCS 03-04 — FOOD SAFETY COMMITTEE MEETING
# =============================================================================

class FoodSafetyCommitteeMeeting(models.Model):
    """
    Quarterly food safety committee meeting log (CAC Docs 03-04).
    Tracks required agenda items: animal activity, pesticide/herbicide apps,
    fertilizer apps, water testing, worker training.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='committee_meetings'
    )
    meeting_date = models.DateField()
    meeting_time = models.TimeField(null=True, blank=True)
    meeting_quarter = models.CharField(max_length=2, choices=QUARTER_CHOICES)
    meeting_year = models.IntegerField()
    location = models.CharField(max_length=200, blank=True)
    farm = models.ForeignKey(
        'Farm', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='committee_meetings'
    )

    # Attendees (Doc 04 sign-in list)
    attendees = models.JSONField(
        default=list,
        help_text='[{"name": "...", "title": "...", "signed": true}]'
    )

    # I. Animal Activity (Doc 04 Section I)
    animal_activity_reviewed = models.BooleanField(default=False)
    animal_activity_notes = models.TextField(blank=True)

    # II. Pesticide / Herbicide Application (Doc 04 Section II)
    pesticide_apps_reviewed = models.BooleanField(default=False)
    pesticide_apps_notes = models.TextField(blank=True)
    pesticide_records_in_binder = models.BooleanField(null=True, blank=True)
    phi_followed = models.BooleanField(null=True, blank=True)

    # IV. Fertilizer Application (Doc 04 Section IV)
    fertilizer_apps_reviewed = models.BooleanField(default=False)
    fertilizer_apps_notes = models.TextField(blank=True)
    fertilizer_records_in_binder = models.BooleanField(null=True, blank=True)

    # V. Water Testing (Doc 04 Section V)
    water_testing_reviewed = models.BooleanField(default=False)
    water_testing_notes = models.TextField(blank=True)
    last_irrigation_water_test = models.DateField(null=True, blank=True)
    last_handwash_water_test = models.DateField(null=True, blank=True)
    water_records_current = models.BooleanField(null=True, blank=True)

    # VI. Worker Training (Doc 04 Section VI)
    worker_training_reviewed = models.BooleanField(default=False)
    worker_training_notes = models.TextField(blank=True)
    last_pesticide_training = models.DateField(null=True, blank=True)
    last_food_safety_training = models.DateField(null=True, blank=True)

    # Additional Topics
    additional_topics = models.TextField(blank=True)

    # Action Items
    action_items = models.JSONField(
        default=list, blank=True,
        help_text='[{"item": "...", "assigned_to": "...", "due_date": "...", "status": "open"}]'
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=[('draft', 'Draft'), ('completed', 'Completed')],
        default='draft'
    )
    coordinator_signature_date = models.DateField(null=True, blank=True)
    next_meeting_date = models.DateField(null=True, blank=True)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-meeting_date']
        indexes = [
            models.Index(
                fields=['company', '-meeting_date'],
                name='idx_committee_company_date'
            ),
            models.Index(
                fields=['company', 'meeting_year', 'meeting_quarter'],
                name='idx_committee_year_quarter'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'meeting_year', 'meeting_quarter'],
                name='unique_committee_meeting_per_quarter'
            )
        ]

    def __str__(self):
        return f"Committee Meeting {self.meeting_quarter} {self.meeting_year}"

    @property
    def all_sections_reviewed(self):
        return all([
            self.animal_activity_reviewed,
            self.pesticide_apps_reviewed,
            self.fertilizer_apps_reviewed,
            self.water_testing_reviewed,
            self.worker_training_reviewed,
        ])


# =============================================================================
# CAC DOC 05 — MANAGEMENT VERIFICATION REVIEW
# =============================================================================

class ManagementVerificationReview(models.Model):
    """
    Annual management verification review and food safety resource analysis
    (CAC Doc 05). Covers all FSMS areas annually.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='management_reviews'
    )
    review_year = models.IntegerField()
    review_date = models.DateField()
    conducted_by = models.CharField(max_length=200)
    conducted_by_title = models.CharField(max_length=200, blank=True)

    # Internal Audits Review
    internal_audits_reviewed = models.BooleanField(default=False)
    internal_audits_analysis = models.TextField(blank=True)
    internal_audits_comments = models.TextField(blank=True)

    # External Audits Review
    external_audits_reviewed = models.BooleanField(default=False)
    external_audits_analysis = models.TextField(blank=True)
    external_audits_comments = models.TextField(blank=True)

    # Incidents Review (NUOCA, water testing, food defense, food fraud, recalls)
    incidents_reviewed = models.BooleanField(default=False)
    incidents_analysis = models.TextField(blank=True)
    incidents_comments = models.TextField(blank=True)

    # Complaints / Recall Team
    complaints_reviewed = models.BooleanField(default=False)
    complaints_analysis = models.TextField(blank=True)
    complaints_comments = models.TextField(blank=True)

    # Company Objectives
    objectives_reviewed = models.BooleanField(default=False)
    objectives_analysis = models.TextField(blank=True)
    objectives_comments = models.TextField(blank=True)

    # Organizational Structure
    org_structure_reviewed = models.BooleanField(default=False)
    org_structure_analysis = models.TextField(blank=True)
    org_structure_comments = models.TextField(blank=True)

    # SOPs
    sops_reviewed = models.BooleanField(default=False)
    sops_analysis = models.TextField(blank=True)
    sops_comments = models.TextField(blank=True)

    # Food Safety Training
    training_reviewed = models.BooleanField(default=False)
    training_analysis = models.TextField(blank=True)
    training_comments = models.TextField(blank=True)

    # Equipment
    equipment_reviewed = models.BooleanField(default=False)
    equipment_analysis = models.TextField(blank=True)
    equipment_comments = models.TextField(blank=True)

    # Job Roles and Descriptions
    job_roles_reviewed = models.BooleanField(default=False)
    job_roles_analysis = models.TextField(blank=True)
    job_roles_comments = models.TextField(blank=True)

    # Approved Supplier Program
    supplier_program_reviewed = models.BooleanField(default=False)
    supplier_program_analysis = models.TextField(blank=True)
    supplier_program_comments = models.TextField(blank=True)

    # Food Safety Committee
    committee_reviewed = models.BooleanField(default=False)
    committee_analysis = models.TextField(blank=True)
    committee_comments = models.TextField(blank=True)

    # Resource Analysis
    resources_adequate = models.BooleanField(null=True, blank=True)
    resource_gaps = models.TextField(blank=True)
    resource_allocation_plan = models.TextField(blank=True)

    # Overall
    overall_assessment = models.TextField(blank=True)
    action_items = models.JSONField(
        default=list, blank=True,
        help_text='[{"item": "...", "assigned_to": "...", "due_date": "...", "status": "open"}]'
    )

    # Attendees
    attendees = models.JSONField(
        default=list, blank=True,
        help_text='[{"name": "...", "title": "...", "signed": true}]'
    )

    # Sign-off
    approved = models.BooleanField(default=False)
    approved_by = models.CharField(max_length=200, blank=True)
    approved_date = models.DateField(null=True, blank=True)
    next_review_date = models.DateField(null=True, blank=True)
    report_file = models.FileField(
        upload_to='management_reviews/%Y/', null=True, blank=True
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-review_year']
        indexes = [
            models.Index(
                fields=['company', '-review_year'],
                name='idx_mgmtreview_company_year'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'review_year'],
                name='unique_management_review_per_year'
            )
        ]

    def __str__(self):
        return f"Management Review {self.review_year}"

    @property
    def all_sections_reviewed(self):
        return all([
            self.internal_audits_reviewed, self.external_audits_reviewed,
            self.incidents_reviewed, self.complaints_reviewed,
            self.objectives_reviewed, self.org_structure_reviewed,
            self.sops_reviewed, self.training_reviewed,
            self.equipment_reviewed, self.job_roles_reviewed,
            self.supplier_program_reviewed, self.committee_reviewed,
        ])

    @property
    def sections_reviewed_count(self):
        sections = [
            self.internal_audits_reviewed, self.external_audits_reviewed,
            self.incidents_reviewed, self.complaints_reviewed,
            self.objectives_reviewed, self.org_structure_reviewed,
            self.sops_reviewed, self.training_reviewed,
            self.equipment_reviewed, self.job_roles_reviewed,
            self.supplier_program_reviewed, self.committee_reviewed,
        ]
        return sum(1 for s in sections if s)


# =============================================================================
# CAC DOC 06 — TRAINING MANAGEMENT MATRIX
# =============================================================================

class TrainingRecord(models.Model):
    """
    Per-employee training matrix (CAC Doc 06).
    Tracks completion of all 8 required training types per employee.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='training_records'
    )
    employee_name = models.CharField(max_length=200)
    employee_id = models.CharField(max_length=50, blank=True)
    employee_role = models.CharField(max_length=200, blank=True)
    employee_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='training_records'
    )

    # PSA Training (one-time)
    psa_training_date = models.DateField(null=True, blank=True)
    psa_certificate_number = models.CharField(max_length=100, blank=True)

    # Animal Intrusion Training (annual)
    animal_intrusion_date = models.DateField(null=True, blank=True)
    animal_intrusion_expiration = models.DateField(null=True, blank=True)

    # Food Safety & Security Training (quarterly)
    food_safety_date = models.DateField(null=True, blank=True)
    food_safety_expiration = models.DateField(null=True, blank=True)

    # Worker Health & Hygiene (quarterly)
    worker_hygiene_date = models.DateField(null=True, blank=True)
    worker_hygiene_expiration = models.DateField(null=True, blank=True)

    # Bleeding/Bodily Fluids & Illness (annual)
    bleeding_illness_date = models.DateField(null=True, blank=True)
    bleeding_illness_expiration = models.DateField(null=True, blank=True)

    # Internal & External Inspections (annual)
    inspections_date = models.DateField(null=True, blank=True)
    inspections_expiration = models.DateField(null=True, blank=True)

    # Crop Protection / Pesticides (annual)
    crop_protection_date = models.DateField(null=True, blank=True)
    crop_protection_expiration = models.DateField(null=True, blank=True)

    # Private Applicator License (if applicable)
    applicator_license_number = models.CharField(max_length=100, blank=True)
    applicator_license_expiration = models.DateField(null=True, blank=True)

    # Additional custom training entries
    additional_training = models.JSONField(
        default=list, blank=True,
        help_text='[{"topic": "...", "date": "2026-01-15", "expiration": "2027-01-15", "trainer": "..."}]'
    )

    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['employee_name']
        indexes = [
            models.Index(fields=['company', 'active'], name='idx_trainrec_company_active'),
        ]

    def __str__(self):
        return f"Training Record - {self.employee_name}"

    @property
    def training_types_current(self):
        """Count how many of the 8 training types are current (not expired)."""
        today = date.today()
        count = 0
        # PSA is one-time — just needs a date
        if self.psa_training_date:
            count += 1
        # Others check expiration
        for exp in [
            self.animal_intrusion_expiration,
            self.food_safety_expiration,
            self.worker_hygiene_expiration,
            self.bleeding_illness_expiration,
            self.inspections_expiration,
            self.crop_protection_expiration,
        ]:
            if exp and exp >= today:
                count += 1
        # Applicator license
        if self.applicator_license_expiration and self.applicator_license_expiration >= today:
            count += 1
        return count

    @property
    def training_types_total(self):
        """Total required training types (8)."""
        return 8

    @property
    def compliance_percentage(self):
        return round((self.training_types_current / 8) * 100)


# =============================================================================
# CAC DOC 37 — WORKER TRAINING SESSION LOG
# =============================================================================

class WorkerTrainingSession(models.Model):
    """
    Per-session training log with attendee sign-in (CAC Doc 37).
    One record per training event — many attendees per session.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='training_sessions'
    )
    farm = models.ForeignKey(
        'Farm', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='training_sessions'
    )

    # Training details
    training_date = models.DateField()
    training_topic = models.CharField(max_length=300)
    training_category = models.CharField(
        max_length=30, choices=TRAINING_CATEGORY_CHOICES
    )
    language = models.CharField(
        max_length=20, choices=LANGUAGE_CHOICES, default='bilingual'
    )

    # Instructor
    instructor_name = models.CharField(max_length=200)
    instructor_title = models.CharField(max_length=200, blank=True)

    # Session info
    duration_minutes = models.IntegerField(null=True, blank=True)
    location = models.CharField(max_length=200, blank=True)
    materials_used = models.TextField(blank=True)

    # Attendees (Doc 37 sign-in sheet)
    attendees = models.JSONField(
        default=list,
        help_text='[{"name": "...", "employee_id": "", "role": "", "signature_date": ""}]'
    )
    attendee_count = models.IntegerField(default=0)

    # Assessment
    quiz_administered = models.BooleanField(default=False)
    average_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    # Documentation
    sign_in_sheet = models.FileField(
        upload_to='training_sessions/%Y/%m/', null=True, blank=True,
        help_text="Scanned sign-in sheet with signatures"
    )
    related_document = models.ForeignKey(
        ControlledDocument, on_delete=models.SET_NULL, null=True, blank=True
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-training_date']
        indexes = [
            models.Index(
                fields=['company', '-training_date'],
                name='idx_trainsess_company_date'
            ),
            models.Index(
                fields=['company', 'training_category'],
                name='idx_trainsess_company_cat'
            ),
        ]

    def __str__(self):
        return f"Training: {self.training_topic} ({self.training_date})"

    def save(self, *args, **kwargs):
        if self.attendees:
            self.attendee_count = len(self.attendees)
        super().save(*args, **kwargs)


# =============================================================================
# CAC DOC 24 — PERIMETER AND WATER SOURCE MONITORING LOG
# =============================================================================

class PerimeterMonitoringLog(models.Model):
    """
    Weekly perimeter and water source monitoring log (CAC Doc 24).
    Year-round weekly checks for animal activity, security, water integrity.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='perimeter_logs'
    )
    farm = models.ForeignKey(
        'Farm', on_delete=models.CASCADE, related_name='perimeter_logs'
    )

    log_date = models.DateField()
    week_number = models.IntegerField(
        help_text="ISO week number (1-53), auto-calculated"
    )
    inspector_name = models.CharField(max_length=200)
    inspector = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='perimeter_logs'
    )

    # Perimeter checks
    perimeter_intact = models.BooleanField(null=True, blank=True)
    gates_secured = models.BooleanField(null=True, blank=True)
    signage_in_place = models.BooleanField(null=True, blank=True)

    # Animal activity
    animal_activity_found = models.BooleanField(default=False)
    animal_species_observed = models.CharField(max_length=300, blank=True)
    fecal_matter_found = models.BooleanField(default=False)
    fecal_matter_action = models.TextField(blank=True)
    animal_carcass_found = models.BooleanField(default=False)
    crop_damage_from_animals = models.BooleanField(default=False)
    buffer_zones_clear = models.BooleanField(null=True, blank=True)

    # Water source checks
    water_sources_checked = models.JSONField(
        default=list, blank=True,
        help_text='[{"source_name": "...", "type": "well/reservoir/etc", "condition": "ok/issue", "access_secure": true, "notes": ""}]'
    )
    water_source_integrity_ok = models.BooleanField(null=True, blank=True)

    # Security
    unauthorized_access_found = models.BooleanField(default=False)
    unauthorized_access_notes = models.TextField(blank=True)
    trespassing_evidence = models.BooleanField(default=False)
    trash_found = models.BooleanField(default=False)

    # Corrective action
    corrective_action_needed = models.BooleanField(default=False)
    corrective_action_description = models.TextField(blank=True)
    corrective_action_ref = models.ForeignKey(
        CorrectiveAction, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='perimeter_log_source'
    )

    findings_summary = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-log_date']
        indexes = [
            models.Index(
                fields=['company', 'farm', '-log_date'],
                name='idx_perimeter_company_farm'
            ),
            models.Index(
                fields=['farm', 'week_number'],
                name='idx_perimeter_farm_week'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['farm', 'log_date'],
                name='unique_perimeter_log_per_farm_date'
            )
        ]

    def __str__(self):
        return f"Perimeter Log - {self.farm} (Week {self.week_number}, {self.log_date})"

    def save(self, *args, **kwargs):
        if self.log_date:
            self.week_number = self.log_date.isocalendar()[1]
        super().save(*args, **kwargs)


# =============================================================================
# CAC DOC 38 — PRE-SEASON SELF-ASSESSMENT CHECKLIST
# =============================================================================

class PreSeasonChecklist(models.Model):
    """
    Ranch-level pre-season self-assessment (CAC Doc 38).
    Must be completed prior to harvesting each season.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='pre_season_checklists'
    )
    farm = models.ForeignKey(
        'Farm', on_delete=models.CASCADE, related_name='pre_season_checklists'
    )
    season_year = models.IntegerField()
    assessment_date = models.DateField()
    assessed_by = models.CharField(max_length=200)
    assessed_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='pre_season_checklists'
    )

    # Ground History
    non_ag_previous_use = models.BooleanField(null=True, blank=True)
    animal_husbandry_previous = models.BooleanField(null=True, blank=True)
    waste_storage_previous = models.BooleanField(null=True, blank=True)
    animal_activity_evidence = models.BooleanField(null=True, blank=True)
    flooding_occurred = models.BooleanField(null=True, blank=True)
    new_purchase_or_lease = models.BooleanField(null=True, blank=True)
    ground_history_notes = models.TextField(blank=True)

    # Adjacent Land Use
    adjacent_livestock = models.BooleanField(null=True, blank=True)
    adjacent_manure_storage = models.BooleanField(null=True, blank=True)
    adjacent_land_notes = models.TextField(blank=True)

    # Fertilizer / Crop Nutrition
    raw_manure_used = models.BooleanField(null=True, blank=True)
    biosolids_used = models.BooleanField(null=True, blank=True)
    composted_manure_used = models.BooleanField(null=True, blank=True)
    heat_treated_manure_used = models.BooleanField(null=True, blank=True)
    soil_amendments_used = models.BooleanField(null=True, blank=True)
    nonsynthetic_treatments_used = models.BooleanField(null=True, blank=True)
    fertilizer_storage_safe = models.BooleanField(null=True, blank=True)
    fertilizer_notes = models.TextField(blank=True)

    # Irrigation / Water Use
    water_sources = models.JSONField(
        default=list, blank=True,
        help_text='["municipal", "well", "reservoir", "surface", "reclaimed"]'
    )
    microbial_tests_conducted = models.BooleanField(null=True, blank=True)
    backflow_prevention_in_use = models.BooleanField(null=True, blank=True)
    water_delivery_good_condition = models.BooleanField(null=True, blank=True)
    water_risk_factors_identified = models.BooleanField(null=True, blank=True)
    water_risk_factors_detail = models.TextField(blank=True)
    water_notes = models.TextField(blank=True)

    # Worker Hygiene
    toilet_facilities_available = models.BooleanField(null=True, blank=True)
    toilet_facilities_maintained = models.BooleanField(null=True, blank=True)
    workers_trained = models.BooleanField(null=True, blank=True)
    first_aid_current = models.BooleanField(null=True, blank=True)
    access_roads_safe = models.BooleanField(null=True, blank=True)
    toilet_location_suitable = models.BooleanField(null=True, blank=True)
    service_company_procedures = models.BooleanField(null=True, blank=True)
    hygiene_notes = models.TextField(blank=True)

    # Necessary Records
    pca_qal_license_current = models.BooleanField(null=True, blank=True)
    letters_of_guarantee_current = models.BooleanField(null=True, blank=True)
    pesticide_use_reports_current = models.BooleanField(null=True, blank=True)
    water_tests_current = models.BooleanField(null=True, blank=True)
    perimeter_monitoring_log_current = models.BooleanField(null=True, blank=True)
    restroom_maintenance_log_current = models.BooleanField(null=True, blank=True)
    training_log_current = models.BooleanField(null=True, blank=True)
    committee_log_current = models.BooleanField(null=True, blank=True)
    management_review_current = models.BooleanField(null=True, blank=True)
    fertilizer_log_current = models.BooleanField(null=True, blank=True)
    nuoca_forms_current = models.BooleanField(null=True, blank=True)
    chemical_inventory_current = models.BooleanField(null=True, blank=True)
    records_notes = models.TextField(blank=True)

    # Overall
    deficiencies_found = models.BooleanField(default=False)
    deficiency_list = models.JSONField(
        default=list, blank=True,
        help_text='[{"item": "...", "corrective_action": "...", "due_date": "..."}]'
    )
    approved_for_season = models.BooleanField(default=False)
    approved_by = models.CharField(max_length=200, blank=True)
    approval_date = models.DateField(null=True, blank=True)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-season_year']
        indexes = [
            models.Index(
                fields=['company', 'farm', '-season_year'],
                name='idx_preseason_company_farm_yr'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['farm', 'season_year'],
                name='unique_preseason_per_farm_year'
            )
        ]

    def __str__(self):
        return f"Pre-Season Checklist - {self.farm} ({self.season_year})"


# =============================================================================
# CAC DOC 39 — FIELD RISK ASSESSMENT
# =============================================================================

class FieldRiskAssessment(models.Model):
    """
    Comprehensive field risk assessment (CAC Doc 39).
    6-page risk matrix covering biological/chemical/physical risks
    across land, water, inputs, workers, and equipment categories.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='field_risk_assessments'
    )
    farm = models.ForeignKey(
        'Farm', on_delete=models.CASCADE, related_name='field_risk_assessments'
    )
    field = models.ForeignKey(
        'Field', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='field_risk_assessments'
    )

    assessment_date = models.DateField()
    season_year = models.IntegerField()
    assessed_by = models.CharField(max_length=200)
    assessed_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='field_risk_assessments'
    )

    # Overview
    total_acres = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    crops_grown = models.JSONField(default=list, blank=True)
    structures_on_property = models.TextField(blank=True)
    previous_land_use = models.CharField(max_length=300, blank=True)
    recent_flood_event = models.BooleanField(null=True, blank=True)
    adjacent_land_use = models.TextField(blank=True)

    # Risk categories — each as JSON array of risk entries
    # Entry format: {"hazard": "...", "biological": "...", "chemical": "...", "physical": "...",
    #                "probability": "low/medium/high", "severity": "low/medium/high",
    #                "justification": "...", "preventive_measures": "...",
    #                "supporting_docs": "..."}

    land_contamination_risks = models.JSONField(
        default=list, blank=True,
        help_text="Risks from structures, animals, previous land use, flooding"
    )
    water_source_risks = models.JSONField(
        default=list, blank=True,
        help_text="Risks per water source type (well, district, reservoir, creek, reclaimed)"
    )
    agricultural_input_risks = models.JSONField(
        default=list, blank=True,
        help_text="Risks from fertilizers, soil amendments, pesticides"
    )
    worker_hygiene_risks = models.JSONField(
        default=list, blank=True,
        help_text="Risks from toilet/handwash facilities, worker contamination, equipment"
    )
    labor_harvesting_risks = models.JSONField(
        default=list, blank=True,
        help_text="Risks from worker practices, equipment, foreign materials"
    )

    # Water source detail
    water_sources_description = models.TextField(blank=True)
    water_tests_conducted = models.BooleanField(null=True, blank=True)

    # Inputs detail
    fertilizer_suppliers = models.TextField(blank=True)
    pesticide_suppliers = models.TextField(blank=True)
    animal_amendments_used = models.BooleanField(null=True, blank=True)

    # Worker detail
    toilet_type = models.CharField(
        max_length=30, blank=True,
        help_text="permanent/portable/na"
    )
    maintenance_provider = models.CharField(max_length=200, blank=True)
    labor_hired_by = models.CharField(max_length=100, blank=True)
    harvest_arranged_by = models.CharField(max_length=100, blank=True)
    harvest_crew_certified = models.BooleanField(null=True, blank=True)

    # Summary
    overall_risk_level = models.CharField(
        max_length=20, choices=RISK_LEVEL_CHOICES, default='low'
    )
    critical_risks_count = models.IntegerField(default=0)
    high_risks_count = models.IntegerField(default=0)

    # Sign-off
    reviewed_by = models.CharField(max_length=200, blank=True)
    review_date = models.DateField(null=True, blank=True)
    approved = models.BooleanField(default=False)
    report_file = models.FileField(
        upload_to='field_risk_assessments/%Y/', null=True, blank=True
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-assessment_date']
        indexes = [
            models.Index(
                fields=['company', 'farm', '-season_year'],
                name='idx_fieldrisk_company_farm_yr'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['farm', 'season_year'],
                name='unique_field_risk_per_farm_year'
            )
        ]

    def __str__(self):
        return f"Field Risk Assessment - {self.farm} ({self.season_year})"


# =============================================================================
# CAC DOCS 08-09 — NUOCA ENHANCEMENTS (extend CorrectiveAction)
# Note: NUOCA fields added via migration to CorrectiveAction above.
# We add the choices here and the migration adds the fields.
# =============================================================================

# NUOCA_CATEGORY_CHOICES defined above in the choices section


# =============================================================================
# CAC DOC 09A — EMPLOYEE NON-CONFORMANCE
# =============================================================================

class EmployeeNonConformance(models.Model):
    """
    Employee non-conformance form (CAC Doc 09A).
    Tracks violations and the 3-warning progressive discipline system.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='employee_non_conformances'
    )
    employee_name = models.CharField(max_length=200)
    employee_id = models.CharField(max_length=50, blank=True)
    employee_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='non_conformances'
    )

    violation_date = models.DateField()
    violation_type = models.CharField(max_length=30, choices=VIOLATION_TYPE_CHOICES)
    violation_description = models.TextField()

    supervisor_name = models.CharField(max_length=200)
    supervisor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='supervised_non_conformances'
    )

    # 3-warning system
    warning_level = models.IntegerField(
        choices=[(1, '1st Warning (Verbal)'), (2, '2nd Warning (Written)'), (3, '3rd Warning (Disciplinary)')],
        default=1
    )
    warning_description = models.TextField(blank=True)
    employee_acknowledged = models.BooleanField(default=False)
    employee_signature_date = models.DateField(null=True, blank=True)

    follow_up_required = models.BooleanField(default=False)
    follow_up_date = models.DateField(null=True, blank=True)
    follow_up_notes = models.TextField(blank=True)
    resolved = models.BooleanField(default=False)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-violation_date']
        indexes = [
            models.Index(
                fields=['company', '-violation_date'],
                name='idx_empnc_company_date'
            ),
        ]

    def __str__(self):
        return f"Non-Conformance - {self.employee_name} ({self.violation_date})"


# =============================================================================
# CAC DOCS 11-12 — PRODUCT REJECTION AND RELEASE
# =============================================================================

class ProductHoldRelease(models.Model):
    """
    Product rejection and release form (CAC Docs 11-12).
    Tracks farm inputs and products placed on hold, investigated, and released/rejected.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='product_holds'
    )
    farm = models.ForeignKey(
        'Farm', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='product_holds'
    )

    hold_number = models.CharField(max_length=50, blank=True, help_text="Auto-generated if blank")
    hold_date = models.DateField()
    hold_time = models.TimeField(null=True, blank=True)

    # Product / material details
    product_type = models.CharField(
        max_length=30,
        choices=[('farm_input', 'Farm Input'), ('product', 'Product (Avocados)')],
        default='product'
    )
    product_description = models.CharField(max_length=300)
    lot_numbers = models.JSONField(default=list, blank=True)
    quantity = models.CharField(max_length=100, blank=True)

    # Hold details
    hold_reason = models.CharField(max_length=30, choices=HOLD_REASON_CHOICES)
    hold_reason_detail = models.TextField()
    hold_initiated_by = models.CharField(max_length=200)
    segregation_method = models.TextField(
        blank=True, help_text="How affected product is segregated"
    )

    # Status
    status = models.CharField(max_length=20, choices=HOLD_STATUS_CHOICES, default='on_hold')

    # Investigation
    investigation_notes = models.TextField(blank=True)

    # Release details
    release_date = models.DateField(null=True, blank=True)
    release_time = models.TimeField(null=True, blank=True)
    release_authorized_by = models.CharField(max_length=200, blank=True)
    disposition = models.TextField(blank=True, help_text="Actions taken on product")

    # Links
    corrective_action_ref = models.ForeignKey(
        CorrectiveAction, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='product_hold_source'
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-hold_date']
        indexes = [
            models.Index(
                fields=['company', 'status'],
                name='idx_prodhold_company_status'
            ),
        ]

    def __str__(self):
        return f"Hold {self.hold_number} - {self.product_description}"


# =============================================================================
# CAC DOC 15 — SUPPLIER CONTROL VERIFICATION LOG
# =============================================================================

class SupplierVerificationLog(models.Model):
    """
    Supplier control verification log (CAC Doc 15).
    Periodic verification checklists for crop protection, labor, toilet service suppliers.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='supplier_verifications'
    )
    supplier = models.ForeignKey(
        ApprovedSupplier, on_delete=models.CASCADE, related_name='verifications'
    )
    verification_date = models.DateField()
    verification_type = models.CharField(max_length=30, choices=VERIFICATION_TYPE_CHOICES)
    verified_by = models.CharField(max_length=200)
    verified_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='supplier_verifications'
    )

    # Checklist items (varies by verification type)
    checklist_items = models.JSONField(
        default=list,
        help_text='[{"question": "...", "result": "yes/no/na", "notes": "..."}]'
    )

    # Results
    overall_result = models.CharField(
        max_length=20,
        choices=[('passed', 'Passed'), ('failed', 'Failed'), ('conditional', 'Conditional')],
        default='passed'
    )
    deficiencies = models.TextField(blank=True)
    corrective_action_required = models.BooleanField(default=False)
    corrective_action_ref = models.ForeignKey(
        CorrectiveAction, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='supplier_verification_source'
    )
    nuoca_filed = models.BooleanField(default=False)
    next_verification_date = models.DateField(null=True, blank=True)
    satisfied_with_service = models.BooleanField(null=True, blank=True)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-verification_date']
        indexes = [
            models.Index(
                fields=['company', '-verification_date'],
                name='idx_suppverify_company_date'
            ),
        ]

    def __str__(self):
        return f"Verification - {self.supplier.supplier_name} ({self.verification_date})"


# =============================================================================
# CAC DOC 18 — FOOD FRAUD VULNERABILITY ASSESSMENT
# =============================================================================

class FoodFraudAssessment(models.Model):
    """
    Food fraud vulnerability assessment (CAC Doc 18).
    Annual assessment of 7 fraud types with mitigation measures.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='food_fraud_assessments'
    )
    assessment_year = models.IntegerField()
    assessment_date = models.DateField()
    assessed_by = models.CharField(max_length=200)

    # 7 fraud type assessments
    fraud_assessments = models.JSONField(
        default=list,
        help_text='[{"fraud_type": "substitution", "location": "Harvest and Transportation", '
                  '"description": "...", "significant": true, "likelihood": "low", '
                  '"severity": "...", "preventive_measures": "...", "supporting_docs": "..."}]'
    )

    overall_vulnerability = models.CharField(
        max_length=20, choices=FRAUD_VULNERABILITY_CHOICES, default='low'
    )
    mitigation_summary = models.TextField(blank=True)

    # Sign-off
    reviewed_date = models.DateField(null=True, blank=True)
    approved = models.BooleanField(default=False)
    related_document = models.ForeignKey(
        ControlledDocument, on_delete=models.SET_NULL, null=True, blank=True
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-assessment_year']
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'assessment_year'],
                name='unique_fraud_assessment_per_year'
            )
        ]

    def __str__(self):
        return f"Food Fraud Assessment {self.assessment_year}"


# =============================================================================
# CAC DOC 21 — EMERGENCY CONTACTS
# =============================================================================

class EmergencyContact(models.Model):
    """
    Emergency contacts list (CAC Doc 21).
    Regulatory agencies, hospitals, utility companies, packinghouse reps.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='emergency_contacts'
    )
    contact_type = models.CharField(max_length=30, choices=EMERGENCY_CONTACT_TYPE_CHOICES)
    organization = models.CharField(max_length=300)
    contact_name = models.CharField(max_length=200, blank=True)
    phone_primary = models.CharField(max_length=50)
    phone_secondary = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    notes = models.CharField(max_length=300, blank=True)
    display_order = models.IntegerField(default=0)
    active = models.BooleanField(default=True)
    last_verified_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'contact_type']
        indexes = [
            models.Index(fields=['company', 'active'], name='idx_emcontact_company_active'),
        ]

    def __str__(self):
        return f"{self.organization} ({self.get_contact_type_display()})"


# =============================================================================
# CAC DOC 29 — CHEMICAL INVENTORY LOG
# =============================================================================

class ChemicalInventoryLog(models.Model):
    """
    Monthly chemical/pesticide inventory log (CAC Doc 29).
    Tracks stock on hand, received, used, disposed per chemical per month.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='chemical_inventory_logs'
    )
    chemical_name = models.CharField(max_length=300)
    epa_registration_number = models.CharField(max_length=100, blank=True)
    chemical_type = models.CharField(max_length=30, choices=CHEMICAL_TYPE_CHOICES)
    storage_location = models.CharField(max_length=200, blank=True)
    unit_of_measure = models.CharField(
        max_length=30,
        choices=[
            ('gallons', 'Gallons'), ('pounds', 'Pounds'), ('ounces', 'Ounces'),
            ('liters', 'Liters'), ('kilograms', 'Kilograms'), ('units', 'Units'),
        ],
        default='gallons'
    )

    # Monthly inventory entry
    inventory_date = models.DateField(help_text="Date of inventory count")
    inventory_month = models.IntegerField(help_text="Month (1-12)")
    inventory_year = models.IntegerField()

    stock_on_hand = models.DecimalField(max_digits=10, decimal_places=2)
    counted_by = models.CharField(max_length=200)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-inventory_date']
        indexes = [
            models.Index(
                fields=['company', '-inventory_date'],
                name='idx_cheminv_company_date'
            ),
            models.Index(
                fields=['company', 'chemical_name', 'inventory_year'],
                name='idx_cheminv_chem_year'
            ),
        ]

    def __str__(self):
        return f"{self.chemical_name} - {self.inventory_date}"


# =============================================================================
# CAC DOC 34 — SANITATION MAINTENANCE LOG
# =============================================================================

class SanitationMaintenanceLog(models.Model):
    """
    Toilet and hand washing station maintenance log (CAC Doc 34).
    Tracks servicing, restocking, and condition of sanitation units.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='sanitation_maintenance_logs'
    )
    farm = models.ForeignKey(
        'Farm', on_delete=models.CASCADE, related_name='sanitation_maintenance_logs'
    )

    log_date = models.DateField()
    log_time = models.TimeField(null=True, blank=True)
    unit_identifier = models.CharField(
        max_length=100, help_text="Unit number or location identifier"
    )

    # Supply checks (Doc 34 checklist)
    paper_towels_stocked = models.BooleanField(default=False)
    toilet_paper_stocked = models.BooleanField(default=False)
    soap_available = models.BooleanField(default=False)
    potable_water_available = models.BooleanField(default=False)
    trash_removed = models.BooleanField(default=False)
    restroom_cleaned = models.BooleanField(default=False)

    # Condition
    condition_acceptable = models.BooleanField(default=True)
    repairs_needed = models.BooleanField(default=False)
    repairs_description = models.TextField(blank=True)

    serviced_by = models.CharField(max_length=200)
    serviced_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='sanitation_maintenance_logs'
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-log_date']
        indexes = [
            models.Index(
                fields=['company', 'farm', '-log_date'],
                name='idx_sanmaint_company_farm'
            ),
        ]

    def __str__(self):
        return f"Maintenance Log - {self.unit_identifier} ({self.log_date})"


# =============================================================================
# CAC FOOD SAFETY MANUAL V5.0 — PDF SIGNATURE TRACKING
# =============================================================================

class CACDocumentSignature(models.Model):
    """
    Tracks required signatures on each CAC Food Safety Manual document page.
    Links to the existing UserSignature for the actual PNG data.
    Used when generating the filled PDF to overlay signatures at the correct positions.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='cac_signatures'
    )

    # Which document and page
    doc_number = models.CharField(
        max_length=10, help_text="CAC document number, e.g., '01', '04', '09A'"
    )
    page_number = models.IntegerField(
        help_text="PDF page number where signature appears"
    )

    # Who must sign
    signer_role = models.CharField(max_length=50, choices=SIGNER_ROLE_CHOICES)
    signer_name = models.CharField(max_length=200)
    signer_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='cac_signatures'
    )
    signer_order = models.IntegerField(
        default=0, help_text="Order for multi-signature pages (e.g., attendee 1, 2, 3)"
    )

    # Signature data
    signed = models.BooleanField(default=False)
    signature_data = models.TextField(
        blank=True,
        help_text="Base64 PNG, copied from UserSignature at signing time"
    )
    signed_at = models.DateTimeField(null=True, blank=True)

    # Season/year context
    season_year = models.IntegerField()

    # Source record reference (generic)
    source_model = models.CharField(
        max_length=100, blank=True,
        help_text="e.g., 'FoodSafetyCommitteeMeeting', 'MockRecall'"
    )
    source_id = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['doc_number', 'page_number', 'signer_order']
        indexes = [
            models.Index(
                fields=['company', 'season_year', 'doc_number'],
                name='idx_cacsig_company_year_doc'
            ),
        ]

    def __str__(self):
        status = "Signed" if self.signed else "Pending"
        return f"CAC Doc {self.doc_number} p{self.page_number} - {self.signer_name} ({status})"
