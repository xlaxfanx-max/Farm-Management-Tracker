"""
Primus GFS (Farm GAP) Compliance Models

Phase 1: Document Control, Internal Audits, Land History Assessment
Phase 2: Supplier Control, Mock Recall, Food Defense, Field Sanitation
Phase 3: Equipment Calibration, Pest Control Program, Pre-Harvest Inspection

These models support Primus GFS certification but are designed to be
reusable across GFSI frameworks (GlobalGAP, SQF, etc.).
"""

import math
from datetime import date, timedelta
from django.conf import settings
from django.db import models


# =============================================================================
# CHOICES
# =============================================================================

DOCUMENT_TYPE_CHOICES = [
    ('sop', 'Standard Operating Procedure'),
    ('policy', 'Policy'),
    ('manual', 'Manual'),
    ('form', 'Form/Template'),
    ('record', 'Record'),
    ('plan', 'Plan'),
    ('work_instruction', 'Work Instruction'),
    ('external', 'External Document'),
]

DOCUMENT_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('pending_review', 'Pending Review'),
    ('approved', 'Approved'),
    ('superseded', 'Superseded'),
    ('archived', 'Archived'),
]

PRIMUS_MODULE_CHOICES = [
    ('food_safety_management', 'Food Safety Management System'),
    ('good_agricultural_practices', 'Good Agricultural Practices'),
    ('pest_management', 'Pest Management'),
    ('water_management', 'Water Management'),
    ('worker_hygiene', 'Worker Hygiene & Sanitation'),
    ('traceability', 'Traceability & Recall'),
    ('supplier_management', 'Supplier Management'),
    ('food_defense', 'Food Defense'),
    ('land_assessment', 'Land Assessment'),
    ('equipment_calibration', 'Equipment Calibration'),
    ('general', 'General'),
]

AUDIT_TYPE_CHOICES = [
    ('internal', 'Internal Audit'),
    ('gap', 'GAP Audit Prep'),
    ('management_review', 'Management Review'),
    ('mock_audit', 'Mock Audit'),
    ('follow_up', 'Follow-Up Audit'),
]

AUDIT_STATUS_CHOICES = [
    ('planned', 'Planned'),
    ('in_progress', 'In Progress'),
    ('completed', 'Completed'),
    ('cancelled', 'Cancelled'),
]

FINDING_SEVERITY_CHOICES = [
    ('critical', 'Critical Non-Conformance'),
    ('major', 'Major Non-Conformance'),
    ('minor', 'Minor Non-Conformance'),
    ('observation', 'Observation'),
    ('opportunity', 'Improvement Opportunity'),
]

CORRECTIVE_ACTION_STATUS_CHOICES = [
    ('open', 'Open'),
    ('in_progress', 'In Progress'),
    ('implemented', 'Implemented'),
    ('verified', 'Verified & Closed'),
    ('overdue', 'Overdue'),
]

LAND_USE_CHOICES = [
    ('agriculture', 'Agriculture'),
    ('livestock', 'Livestock'),
    ('industrial', 'Industrial'),
    ('commercial', 'Commercial'),
    ('residential', 'Residential'),
    ('vacant', 'Vacant/Undeveloped'),
    ('landfill', 'Landfill'),
    ('mining', 'Mining'),
    ('other', 'Other'),
]

CONTAMINATION_RISK_CHOICES = [
    ('low', 'Low'),
    ('medium', 'Medium'),
    ('high', 'High'),
    ('unknown', 'Unknown - Requires Investigation'),
]


# =============================================================================
# PHASE 1 — DOCUMENT CONTROL
# =============================================================================

class ControlledDocument(models.Model):
    """
    Version-controlled documents (SOPs, policies, manuals) with approval workflow.
    Central to Primus GFS — every module requires documented procedures.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='controlled_documents'
    )

    # Identification
    document_number = models.CharField(max_length=50, help_text="e.g., SOP-GAP-001")
    title = models.CharField(max_length=300)
    document_type = models.CharField(max_length=30, choices=DOCUMENT_TYPE_CHOICES)
    primus_module = models.CharField(
        max_length=50, choices=PRIMUS_MODULE_CHOICES, default='general'
    )

    # Version control
    version = models.CharField(max_length=20, default='1.0')
    revision_date = models.DateField()
    effective_date = models.DateField()
    review_due_date = models.DateField(help_text="Next mandatory review date")

    # Content
    description = models.TextField(blank=True)
    file = models.FileField(
        upload_to='controlled_documents/%Y/%m/', null=True, blank=True
    )
    content_text = models.TextField(
        blank=True, help_text="Plain text content for searchability"
    )

    # Approval workflow
    status = models.CharField(
        max_length=20, choices=DOCUMENT_STATUS_CHOICES, default='draft'
    )
    prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='documents_prepared'
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='documents_reviewed'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='documents_approved'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Supersession
    supersedes = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='superseded_by'
    )

    # Distribution & tagging
    distribution_list = models.JSONField(
        default=list, blank=True, help_text="User IDs or role names"
    )
    tags = models.JSONField(default=list, blank=True)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['document_number']
        verbose_name = "Controlled Document"
        indexes = [
            models.Index(
                fields=['company', 'status'], name='idx_cdoc_company_status'
            ),
            models.Index(
                fields=['company', 'document_type'], name='idx_cdoc_company_type'
            ),
            models.Index(
                fields=['company', 'primus_module'], name='idx_cdoc_company_module'
            ),
            models.Index(
                fields=['review_due_date'], name='idx_cdoc_review_due'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'document_number', 'version'],
                name='unique_doc_version'
            )
        ]

    def __str__(self):
        return f"{self.document_number} v{self.version} - {self.title}"

    @property
    def is_review_overdue(self):
        return (
            self.status == 'approved'
            and self.review_due_date
            and self.review_due_date < date.today()
        )

    @property
    def days_until_review(self):
        if self.review_due_date:
            return (self.review_due_date - date.today()).days
        return None

    def save(self, *args, **kwargs):
        # Auto-mark parent as superseded when a new version is approved
        if self.status == 'approved' and self.supersedes_id:
            ControlledDocument.objects.filter(
                pk=self.supersedes_id
            ).update(status='superseded')
        super().save(*args, **kwargs)


class DocumentRevisionHistory(models.Model):
    """Tracks each revision of a document for audit trail."""
    document = models.ForeignKey(
        ControlledDocument, on_delete=models.CASCADE, related_name='revision_history'
    )
    version = models.CharField(max_length=20)
    change_description = models.TextField()
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    changed_at = models.DateTimeField(auto_now_add=True)
    previous_file = models.FileField(
        upload_to='document_revisions/%Y/%m/', null=True, blank=True
    )

    class Meta:
        ordering = ['-changed_at']
        indexes = [
            models.Index(
                fields=['document', '-changed_at'], name='idx_docrev_doc_date'
            ),
        ]

    def __str__(self):
        return f"{self.document.document_number} v{self.version}"


# =============================================================================
# PHASE 1 — INTERNAL AUDIT
# =============================================================================

class InternalAudit(models.Model):
    """
    Internal audit scheduling, execution, and tracking.
    Primus GFS requires at least 1 internal audit per year.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='internal_audits'
    )

    # Audit identification
    audit_number = models.CharField(max_length=50, help_text="e.g., IA-2026-001")
    title = models.CharField(max_length=300)
    audit_type = models.CharField(
        max_length=30, choices=AUDIT_TYPE_CHOICES, default='internal'
    )
    primus_modules_covered = models.JSONField(
        default=list, help_text="List of PRIMUS_MODULE_CHOICES values audited"
    )

    # Scheduling
    planned_date = models.DateField()
    actual_date = models.DateField(null=True, blank=True)

    # Scope
    scope_description = models.TextField(blank=True)
    farms_audited = models.ManyToManyField(
        'Farm', blank=True, related_name='internal_audits'
    )

    # Auditor
    lead_auditor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='audits_led'
    )
    auditor_name = models.CharField(max_length=200, blank=True)
    audit_team = models.JSONField(
        default=list, blank=True, help_text='[{"name": "...", "role": "..."}]'
    )

    # Status & Results
    status = models.CharField(
        max_length=20, choices=AUDIT_STATUS_CHOICES, default='planned'
    )
    overall_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    executive_summary = models.TextField(blank=True)

    # Report
    report_file = models.FileField(
        upload_to='audit_reports/%Y/%m/', null=True, blank=True
    )

    # Linked documents
    related_documents = models.ManyToManyField(
        ControlledDocument, blank=True, related_name='related_audits'
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-planned_date']
        indexes = [
            models.Index(
                fields=['company', 'status'], name='idx_audit_company_status'
            ),
            models.Index(
                fields=['company', '-planned_date'], name='idx_audit_company_date'
            ),
        ]

    def __str__(self):
        return f"{self.audit_number} - {self.title}"

    @property
    def total_findings(self):
        return self.findings.count()

    @property
    def open_findings(self):
        return self.findings.filter(
            corrective_actions__status__in=['open', 'in_progress', 'overdue']
        ).distinct().count()


class AuditFinding(models.Model):
    """Individual finding/non-conformance discovered during an audit."""
    audit = models.ForeignKey(
        InternalAudit, on_delete=models.CASCADE, related_name='findings'
    )

    finding_number = models.CharField(max_length=20)
    primus_module = models.CharField(
        max_length=50, choices=PRIMUS_MODULE_CHOICES, blank=True
    )
    primus_clause = models.CharField(
        max_length=50, blank=True, help_text="e.g., 2.01.01"
    )
    severity = models.CharField(max_length=20, choices=FINDING_SEVERITY_CHOICES)

    description = models.TextField()
    evidence = models.TextField(blank=True)
    area_location = models.CharField(max_length=200, blank=True)

    # Photo evidence stored as JSON list of file paths
    photos = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['finding_number']
        indexes = [
            models.Index(
                fields=['audit', 'severity'], name='idx_finding_audit_sev'
            ),
        ]

    def __str__(self):
        return f"Finding {self.finding_number} ({self.get_severity_display()})"


class CorrectiveAction(models.Model):
    """
    Corrective action for an audit finding. Generic model — reusable from
    audits, mock recalls, inspections, incidents. Tracks root cause analysis,
    corrective steps, verification, and closure.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='corrective_actions'
    )
    finding = models.ForeignKey(
        AuditFinding, on_delete=models.CASCADE,
        null=True, blank=True, related_name='corrective_actions'
    )

    # Generic source linking (audit, mock_recall, inspection, incident)
    source_type = models.CharField(
        max_length=50, default='audit',
        help_text="audit, mock_recall, inspection, incident"
    )
    source_id = models.IntegerField(
        null=True, blank=True, help_text="ID of source object"
    )

    # Action details
    ca_number = models.CharField(max_length=50)
    description = models.TextField()
    root_cause = models.TextField(blank=True)
    corrective_steps = models.TextField(blank=True)
    preventive_steps = models.TextField(blank=True)

    # Assignment
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_corrective_actions'
    )
    assigned_to_name = models.CharField(max_length=200, blank=True)
    due_date = models.DateField()

    # Status tracking
    status = models.CharField(
        max_length=20, choices=CORRECTIVE_ACTION_STATUS_CHOICES, default='open'
    )
    implemented_date = models.DateField(null=True, blank=True)
    verified_date = models.DateField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='verified_corrective_actions'
    )
    verification_notes = models.TextField(blank=True)

    # Evidence
    evidence_files = models.JSONField(default=list, blank=True)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date']
        indexes = [
            models.Index(
                fields=['company', 'status'], name='idx_ca_company_status'
            ),
            models.Index(
                fields=['due_date', 'status'], name='idx_ca_due_status'
            ),
        ]

    def __str__(self):
        return f"CA-{self.ca_number}: {self.description[:60]}"

    @property
    def is_overdue(self):
        return (
            self.status in ('open', 'in_progress')
            and self.due_date
            and self.due_date < date.today()
        )

    @property
    def days_until_due(self):
        if self.due_date:
            return (self.due_date - date.today()).days
        return None

    def save(self, *args, **kwargs):
        # Auto-set overdue status
        if self.status in ('open', 'in_progress') and self.due_date and self.due_date < date.today():
            self.status = 'overdue'
        super().save(*args, **kwargs)


# =============================================================================
# PHASE 1 — LAND HISTORY ASSESSMENT
# =============================================================================

class LandHistoryAssessment(models.Model):
    """
    Previous land use assessment per field. Primus GFS requires documented
    land history going back at least 5 years for new production sites.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='land_assessments'
    )
    field = models.ForeignKey(
        'Field', on_delete=models.CASCADE, related_name='land_assessments'
    )

    # Assessment info
    assessment_date = models.DateField()
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='land_assessments_conducted'
    )

    # Land use history — JSON array of entries
    land_use_history = models.JSONField(
        default=list,
        help_text='[{"year_start": 2019, "year_end": 2024, "land_use": "agriculture", "details": "...", "operator": "..."}]'
    )

    # Risk factors
    previous_pesticide_use = models.BooleanField(null=True, blank=True)
    previous_chemical_storage = models.BooleanField(null=True, blank=True)
    previous_waste_disposal = models.BooleanField(null=True, blank=True)
    previous_mining = models.BooleanField(null=True, blank=True)
    flood_zone = models.BooleanField(null=True, blank=True)
    adjacent_contamination_risk = models.BooleanField(null=True, blank=True)

    # Soil testing
    soil_testing_conducted = models.BooleanField(default=False)
    soil_test_date = models.DateField(null=True, blank=True)
    soil_test_results = models.JSONField(
        default=dict, blank=True,
        help_text='{"heavy_metals": "pass", "pH": 6.8, "contaminants": "none detected"}'
    )
    soil_test_passed = models.BooleanField(null=True, blank=True)

    # Overall assessment
    contamination_risk = models.CharField(
        max_length=20, choices=CONTAMINATION_RISK_CHOICES, default='unknown'
    )
    risk_justification = models.TextField(blank=True)
    mitigation_measures = models.TextField(blank=True)

    # Approval
    approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='land_assessments_approved'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Source documentation
    information_source = models.CharField(
        max_length=200, blank=True,
        help_text="How land history was obtained (county records, owner interview, deed research, etc.)"
    )

    # Buffer period between prior non-ag use and current production
    buffer_period_months = models.IntegerField(
        null=True, blank=True,
        help_text="Months between prior non-ag use cessation and current production"
    )
    buffer_period_adequate = models.BooleanField(null=True, blank=True)

    # Animal history (Primus GFS specific requirement)
    previous_animal_operations = models.BooleanField(null=True, blank=True)
    animal_operation_details = models.TextField(
        blank=True,
        help_text="Type of animals, manure management, duration"
    )

    # Soil testing detail
    soil_test_lab = models.CharField(max_length=200, blank=True)
    soil_test_parameters_tested = models.JSONField(
        default=list, blank=True,
        help_text='["heavy_metals", "pH", "e_coli", "salmonella", "nitrates"]'
    )

    # Remediation tracking
    remediation_required = models.BooleanField(default=False)
    remediation_description = models.TextField(blank=True)
    remediation_completion_date = models.DateField(null=True, blank=True)
    remediation_verified = models.BooleanField(default=False)

    # Linked document
    related_document = models.ForeignKey(
        ControlledDocument, on_delete=models.SET_NULL, null=True, blank=True
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-assessment_date']
        indexes = [
            models.Index(
                fields=['company', 'field'], name='idx_landassess_company_field'
            ),
            models.Index(
                fields=['contamination_risk'], name='idx_landassess_risk'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['field', 'assessment_date'],
                name='unique_land_assess_per_field_date'
            )
        ]

    def __str__(self):
        return f"Land Assessment - {self.field} ({self.assessment_date})"

    @property
    def risk_factor_count(self):
        """Count how many risk factors are flagged True."""
        factors = [
            self.previous_pesticide_use,
            self.previous_chemical_storage,
            self.previous_waste_disposal,
            self.previous_mining,
            self.flood_zone,
            self.adjacent_contamination_risk,
        ]
        return sum(1 for f in factors if f is True)


# =============================================================================
# PHASE 2 — CHOICES
# =============================================================================

SUPPLIER_STATUS_CHOICES = [
    ('pending_approval', 'Pending Approval'),
    ('approved', 'Approved'),
    ('conditional', 'Conditionally Approved'),
    ('suspended', 'Suspended'),
    ('removed', 'Removed'),
]

MATERIAL_TYPE_CHOICES = [
    ('seed', 'Seeds/Seedlings'),
    ('fertilizer', 'Fertilizer'),
    ('pesticide', 'Pesticide'),
    ('packaging', 'Packaging Material'),
    ('water_treatment', 'Water Treatment Chemical'),
    ('cleaning_chemical', 'Cleaning Chemical'),
    ('equipment', 'Equipment'),
    ('soil_amendment', 'Soil Amendment'),
    ('other', 'Other'),
]

RECALL_STATUS_CHOICES = [
    ('planned', 'Planned'),
    ('in_progress', 'In Progress'),
    ('completed', 'Completed'),
    ('failed', 'Failed - Follow-Up Required'),
]

THREAT_LEVEL_CHOICES = [
    ('low', 'Low'),
    ('medium', 'Medium'),
    ('high', 'High'),
    ('critical', 'Critical'),
]


# =============================================================================
# PHASE 2 — SUPPLIER CONTROL
# =============================================================================

class ApprovedSupplier(models.Model):
    """
    Approved supplier list with audit and certificate tracking.
    Primus GFS requires documented supplier approval program.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='approved_suppliers'
    )

    # Supplier info
    supplier_name = models.CharField(max_length=300)
    supplier_code = models.CharField(max_length=50, blank=True)
    contact_name = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)

    # Supplied materials
    material_types = models.JSONField(
        default=list, help_text="List of MATERIAL_TYPE_CHOICES values"
    )

    # Status
    status = models.CharField(
        max_length=20, choices=SUPPLIER_STATUS_CHOICES, default='pending_approval'
    )

    # Approval details
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='suppliers_approved'
    )
    approved_date = models.DateField(null=True, blank=True)
    next_review_date = models.DateField(null=True, blank=True)

    # Certifications (JSON: [{name, number, expiry}])
    certifications = models.JSONField(default=list, blank=True)

    # Audit history
    last_audit_date = models.DateField(null=True, blank=True)
    last_audit_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['supplier_name']
        indexes = [
            models.Index(
                fields=['company', 'status'], name='idx_supplier_company_status'
            ),
            models.Index(
                fields=['company', 'next_review_date'],
                name='idx_supplier_review_due'
            ),
        ]

    def __str__(self):
        return f"{self.supplier_name} ({self.get_status_display()})"

    @property
    def is_review_overdue(self):
        return (
            self.next_review_date
            and self.next_review_date < date.today()
            and self.status in ('approved', 'conditional')
        )


class IncomingMaterialVerification(models.Model):
    """Records verification of incoming materials from suppliers."""
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE,
        related_name='material_verifications'
    )
    supplier = models.ForeignKey(
        ApprovedSupplier, on_delete=models.CASCADE,
        related_name='material_verifications'
    )

    receipt_date = models.DateField()
    material_type = models.CharField(max_length=30, choices=MATERIAL_TYPE_CHOICES)
    material_description = models.CharField(max_length=300)
    lot_number = models.CharField(max_length=100, blank=True)
    quantity = models.CharField(max_length=100, blank=True)

    # Verification checks
    condition_acceptable = models.BooleanField(null=True)
    labeling_correct = models.BooleanField(null=True)
    certificate_verified = models.BooleanField(null=True)
    temperature_acceptable = models.BooleanField(null=True, blank=True)

    # Result
    accepted = models.BooleanField(default=True)
    rejection_reason = models.TextField(blank=True)

    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-receipt_date']
        indexes = [
            models.Index(
                fields=['company', '-receipt_date'],
                name='idx_matverify_company_date'
            ),
            models.Index(
                fields=['supplier', '-receipt_date'],
                name='idx_matverify_supplier_date'
            ),
        ]

    def __str__(self):
        return f"{self.material_description} from {self.supplier.supplier_name} ({self.receipt_date})"


# =============================================================================
# PHASE 2 — MOCK RECALL
# =============================================================================

class MockRecall(models.Model):
    """
    Mock recall exercise. Primus GFS requires at least 1 per year.
    Must demonstrate ability to trace 100% of product within 4 hours.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='mock_recalls'
    )

    recall_number = models.CharField(max_length=50)
    exercise_date = models.DateField()

    # Recall scenario
    scenario_description = models.TextField()
    trigger_reason = models.CharField(
        max_length=200,
        help_text="e.g., Pathogen detection, Chemical contamination"
    )
    target_product = models.CharField(max_length=200)
    target_lot_numbers = models.JSONField(default=list)

    # Status
    status = models.CharField(
        max_length=20, choices=RECALL_STATUS_CHOICES, default='planned'
    )

    # Timing (key metric — must be < 4 hours)
    trace_start_time = models.DateTimeField(null=True, blank=True)
    trace_end_time = models.DateTimeField(null=True, blank=True)
    trace_duration_minutes = models.IntegerField(null=True, blank=True)

    # Traceability results
    product_accounted_percent = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    lots_traced_forward = models.JSONField(
        default=list, blank=True,
        help_text="Buyers/destinations reached"
    )
    lots_traced_backward = models.JSONField(
        default=list, blank=True,
        help_text="Suppliers/fields traced back to"
    )

    # Scoring
    effectiveness_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="0-100"
    )
    passed = models.BooleanField(null=True, blank=True)

    # Participants
    led_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='mock_recalls_led'
    )
    participants = models.JSONField(
        default=list, blank=True,
        help_text='[{"name": "...", "role": "..."}]'
    )

    # Report
    report_file = models.FileField(
        upload_to='mock_recalls/%Y/%m/', null=True, blank=True
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-exercise_date']
        indexes = [
            models.Index(
                fields=['company', '-exercise_date'],
                name='idx_mockrecall_company_date'
            ),
            models.Index(
                fields=['company', 'status'],
                name='idx_mockrecall_company_status'
            ),
        ]

    def __str__(self):
        return f"Mock Recall {self.recall_number} ({self.exercise_date})"

    def save(self, *args, **kwargs):
        # Auto-calculate duration
        if self.trace_start_time and self.trace_end_time:
            delta = self.trace_end_time - self.trace_start_time
            self.trace_duration_minutes = int(delta.total_seconds() / 60)
        super().save(*args, **kwargs)

    @property
    def within_time_limit(self):
        """Check if trace was completed within 4 hours (240 minutes)."""
        if self.trace_duration_minutes is not None:
            return self.trace_duration_minutes <= 240
        return None


# =============================================================================
# PHASE 2 — FOOD DEFENSE PLAN
# =============================================================================

class FoodDefensePlan(models.Model):
    """
    Company-level food defense plan. Primus GFS requires a documented
    vulnerability assessment and security measures.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='food_defense_plans'
    )

    plan_year = models.IntegerField()
    effective_date = models.DateField()
    review_date = models.DateField(help_text="Next mandatory review")

    # Vulnerability assessment
    vulnerability_assessment = models.JSONField(
        default=list,
        help_text='[{"area": "...", "threat_type": "...", "likelihood": 1-5, "severity": 1-5, "risk_score": 1-25, "mitigation": "..."}]'
    )
    overall_threat_level = models.CharField(
        max_length=20, choices=THREAT_LEVEL_CHOICES, default='low'
    )

    # Security measures
    security_measures = models.JSONField(
        default=list,
        help_text='[{"measure": "...", "responsible_person": "...", "frequency": "...", "location": "..."}]'
    )

    # Access control
    perimeter_security = models.TextField(blank=True)
    access_points = models.JSONField(default=list, blank=True)
    key_control_procedure = models.TextField(blank=True)

    # Personnel
    food_defense_coordinator = models.CharField(max_length=200, blank=True)
    emergency_contacts = models.JSONField(default=list, blank=True)

    # Incident response
    tampering_response_procedure = models.TextField(blank=True)
    reporting_procedure = models.TextField(blank=True)

    # Status
    approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Linked SOP
    related_document = models.ForeignKey(
        ControlledDocument, on_delete=models.SET_NULL, null=True, blank=True
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-plan_year']
        indexes = [
            models.Index(
                fields=['company', '-plan_year'],
                name='idx_fooddef_company_year'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'plan_year'],
                name='unique_food_defense_per_year'
            )
        ]

    def __str__(self):
        return f"Food Defense Plan {self.plan_year}"

    @property
    def is_review_overdue(self):
        return self.review_date and self.review_date < date.today()


# =============================================================================
# PHASE 2 — FIELD SANITATION
# =============================================================================

class FieldSanitationLog(models.Model):
    """
    Daily field sanitation unit tracking. Primus GFS requires 1 unit per
    20 workers and regular supply verification.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='sanitation_logs'
    )
    farm = models.ForeignKey(
        'Farm', on_delete=models.CASCADE, related_name='sanitation_logs'
    )
    field = models.ForeignKey(
        'Field', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='sanitation_logs'
    )

    log_date = models.DateField()

    # Worker count & unit requirements
    worker_count = models.IntegerField()
    units_required = models.IntegerField(
        help_text="Auto-calculated: ceil(worker_count / 20)"
    )
    units_deployed = models.IntegerField()

    # Supply verification
    hand_wash_stations = models.IntegerField(default=0)
    soap_available = models.BooleanField(default=False)
    paper_towels_available = models.BooleanField(default=False)
    potable_water_available = models.BooleanField(default=False)
    sanitizer_available = models.BooleanField(default=False)

    # Condition check
    units_clean = models.BooleanField(default=False)
    service_needed = models.BooleanField(default=False)
    service_requested_date = models.DateField(null=True, blank=True)

    # Compliance
    compliant = models.BooleanField(default=False)
    deficiency_notes = models.TextField(blank=True)

    checked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-log_date']
        indexes = [
            models.Index(
                fields=['company', '-log_date'],
                name='idx_sanitation_company_date'
            ),
            models.Index(
                fields=['farm', '-log_date'],
                name='idx_sanitation_farm_date'
            ),
            models.Index(
                fields=['compliant'],
                name='idx_sanitation_compliant'
            ),
        ]

    def __str__(self):
        return f"Sanitation Log - {self.farm} ({self.log_date})"

    def save(self, *args, **kwargs):
        # Auto-calculate units required
        self.units_required = math.ceil(self.worker_count / 20)
        # Auto-determine compliance
        self.compliant = (
            self.units_deployed >= self.units_required
            and self.soap_available
            and self.paper_towels_available
            and self.potable_water_available
            and self.units_clean
        )
        super().save(*args, **kwargs)


# =============================================================================
# PHASE 3 — CHOICES
# =============================================================================

CALIBRATION_STATUS_CHOICES = [
    ('scheduled', 'Scheduled'),
    ('in_progress', 'In Progress'),
    ('passed', 'Passed'),
    ('failed', 'Failed'),
    ('overdue', 'Overdue'),
]

CALIBRATION_METHOD_CHOICES = [
    ('internal', 'Internal'),
    ('external_lab', 'External Lab'),
    ('manufacturer', 'Manufacturer Service'),
    ('third_party', 'Third Party'),
]

EQUIPMENT_TYPE_CHOICES = [
    ('scale', 'Scale / Weighing'),
    ('thermometer', 'Thermometer'),
    ('ph_meter', 'pH Meter'),
    ('pressure_gauge', 'Pressure Gauge'),
    ('flow_meter', 'Flow Meter'),
    ('sprayer', 'Sprayer / Applicator'),
    ('conductivity_meter', 'Conductivity Meter'),
    ('moisture_meter', 'Moisture Meter'),
    ('other', 'Other'),
]

PEST_TYPE_CHOICES = [
    ('rodent', 'Rodents'),
    ('insect', 'Insects'),
    ('bird', 'Birds'),
    ('wildlife', 'Wildlife'),
    ('other', 'Other'),
]

PEST_ACTIVITY_CHOICES = [
    ('none', 'None Detected'),
    ('low', 'Low Activity'),
    ('moderate', 'Moderate Activity'),
    ('high', 'High Activity'),
]

INSPECTION_STATUS_CHOICES = [
    ('scheduled', 'Scheduled'),
    ('in_progress', 'In Progress'),
    ('completed', 'Completed'),
    ('failed', 'Failed - Action Required'),
]


# =============================================================================
# PHASE 3 — EQUIPMENT CALIBRATION
# =============================================================================

class EquipmentCalibration(models.Model):
    """
    Equipment calibration record. Primus GFS requires documented calibration
    schedules and records for all measuring devices (scales, thermometers,
    pH meters, sprayers, etc.).
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='equipment_calibrations'
    )

    # Equipment info
    equipment_name = models.CharField(max_length=200)
    equipment_type = models.CharField(max_length=30, choices=EQUIPMENT_TYPE_CHOICES)
    equipment_id = models.CharField(
        max_length=100, blank=True,
        help_text="Serial number or asset ID"
    )
    location = models.CharField(max_length=200, blank=True)
    manufacturer = models.CharField(max_length=200, blank=True)
    model_number = models.CharField(max_length=100, blank=True)

    # Calibration details
    calibration_date = models.DateField()
    next_calibration_date = models.DateField()
    calibration_method = models.CharField(
        max_length=20, choices=CALIBRATION_METHOD_CHOICES, default='internal'
    )
    calibrated_by = models.CharField(max_length=200, blank=True)
    calibration_standard = models.CharField(
        max_length=200, blank=True,
        help_text="Reference standard used for calibration"
    )

    # Results
    status = models.CharField(
        max_length=20, choices=CALIBRATION_STATUS_CHOICES, default='scheduled'
    )
    reading_before = models.CharField(
        max_length=100, blank=True,
        help_text="Reading before calibration"
    )
    reading_after = models.CharField(
        max_length=100, blank=True,
        help_text="Reading after calibration"
    )
    tolerance = models.CharField(
        max_length=100, blank=True,
        help_text="Acceptable tolerance range"
    )
    within_tolerance = models.BooleanField(null=True, blank=True)

    # Corrective action if failed
    corrective_action_taken = models.TextField(blank=True)
    corrective_action_ref = models.ForeignKey(
        CorrectiveAction, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='calibration_source'
    )

    # Certificate / documentation
    certificate_number = models.CharField(max_length=100, blank=True)
    certificate_file = models.FileField(
        upload_to='calibration_certs/%Y/%m/', null=True, blank=True
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-calibration_date']
        indexes = [
            models.Index(
                fields=['company', 'equipment_type'],
                name='idx_calib_company_type'
            ),
            models.Index(
                fields=['company', 'next_calibration_date'],
                name='idx_calib_company_nextdate'
            ),
            models.Index(
                fields=['status'],
                name='idx_calib_status'
            ),
        ]

    def __str__(self):
        return f"{self.equipment_name} ({self.calibration_date})"

    @property
    def is_overdue(self):
        return (
            self.next_calibration_date
            and self.next_calibration_date < date.today()
            and self.status not in ('passed', 'failed')
        )

    @property
    def days_until_due(self):
        if self.next_calibration_date:
            return (self.next_calibration_date - date.today()).days
        return None

    def save(self, *args, **kwargs):
        # Auto-set overdue status
        if (self.status == 'scheduled'
                and self.next_calibration_date
                and self.next_calibration_date < date.today()):
            self.status = 'overdue'
        super().save(*args, **kwargs)


# =============================================================================
# PHASE 3 — PEST CONTROL PROGRAM
# =============================================================================

class PestControlProgram(models.Model):
    """
    Company-level pest control program. Primus GFS requires a documented
    pest management program with monitoring stations, service records,
    and trend analysis.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='pest_control_programs'
    )

    program_year = models.IntegerField()
    effective_date = models.DateField()
    review_date = models.DateField()

    # Pest control operator
    pco_company = models.CharField(
        max_length=200, blank=True,
        help_text="Licensed pest control operator/company"
    )
    pco_license_number = models.CharField(max_length=100, blank=True)
    pco_contact_name = models.CharField(max_length=200, blank=True)
    pco_contact_phone = models.CharField(max_length=50, blank=True)
    service_frequency = models.CharField(
        max_length=100, blank=True,
        help_text="e.g., Weekly, Bi-weekly, Monthly"
    )

    # Station map
    monitoring_stations = models.JSONField(
        default=list,
        help_text='[{"station_id": "R-01", "type": "rodent_bait", "location": "West wall", "farm": "Main"}]'
    )
    total_stations = models.IntegerField(default=0)

    # Target pests
    target_pests = models.JSONField(
        default=list,
        help_text='["rodent", "insect", "bird"]'
    )

    # Products used
    products_used = models.JSONField(
        default=list,
        help_text='[{"product_name": "...", "active_ingredient": "...", "epa_reg": "...", "usage_area": "..."}]'
    )

    # Approval
    approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Linked SOP
    related_document = models.ForeignKey(
        ControlledDocument, on_delete=models.SET_NULL, null=True, blank=True
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-program_year']
        indexes = [
            models.Index(
                fields=['company', '-program_year'],
                name='idx_pestprog_company_year'
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'program_year'],
                name='unique_pest_program_per_year'
            )
        ]

    def __str__(self):
        return f"Pest Control Program {self.program_year}"

    @property
    def is_review_overdue(self):
        return self.review_date and self.review_date < date.today()


class PestMonitoringLog(models.Model):
    """
    Individual pest monitoring service record / inspection log.
    Records findings at each station during routine inspections.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='pest_monitoring_logs'
    )
    program = models.ForeignKey(
        PestControlProgram, on_delete=models.CASCADE,
        related_name='monitoring_logs', null=True, blank=True
    )
    farm = models.ForeignKey(
        'Farm', on_delete=models.CASCADE, related_name='pest_monitoring_logs'
    )

    inspection_date = models.DateField()
    inspector_name = models.CharField(max_length=200)
    is_pco_visit = models.BooleanField(
        default=False, help_text="Was this a licensed PCO service visit?"
    )

    # Station-by-station results
    station_results = models.JSONField(
        default=list,
        help_text='[{"station_id": "R-01", "pest_type": "rodent", "activity": "none", "bait_consumed": false, "action_taken": ""}]'
    )

    # Summary
    total_stations_checked = models.IntegerField(default=0)
    stations_with_activity = models.IntegerField(default=0)
    pest_types_found = models.JSONField(default=list, blank=True)
    overall_activity_level = models.CharField(
        max_length=20, choices=PEST_ACTIVITY_CHOICES, default='none'
    )

    # Actions taken
    treatments_applied = models.JSONField(
        default=list, blank=True,
        help_text='[{"product": "...", "amount": "...", "area": "...", "epa_reg": "..."}]'
    )
    corrective_actions_needed = models.BooleanField(default=False)
    corrective_action_description = models.TextField(blank=True)

    # Linked corrective action
    corrective_action_ref = models.ForeignKey(
        CorrectiveAction, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='pest_monitoring_source'
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-inspection_date']
        indexes = [
            models.Index(
                fields=['company', '-inspection_date'],
                name='idx_pestlog_company_date'
            ),
            models.Index(
                fields=['farm', '-inspection_date'],
                name='idx_pestlog_farm_date'
            ),
            models.Index(
                fields=['overall_activity_level'],
                name='idx_pestlog_activity'
            ),
        ]

    def __str__(self):
        return f"Pest Monitoring - {self.farm} ({self.inspection_date})"


# =============================================================================
# PHASE 3 — PRE-HARVEST INSPECTION
# =============================================================================

class PreHarvestInspection(models.Model):
    """
    Pre-harvest field inspection. Primus GFS requires documented pre-harvest
    assessments covering biological/chemical/physical hazards, field condition,
    and worker readiness before any harvest begins.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='pre_harvest_inspections'
    )
    farm = models.ForeignKey(
        'Farm', on_delete=models.CASCADE, related_name='pre_harvest_inspections'
    )
    field = models.ForeignKey(
        'Field', on_delete=models.CASCADE, related_name='pre_harvest_inspections'
    )

    # Inspection details
    inspection_date = models.DateField()
    planned_harvest_date = models.DateField()
    inspector = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='pre_harvest_inspections_conducted'
    )
    inspector_name = models.CharField(max_length=200, blank=True)
    crop = models.CharField(max_length=200, blank=True)

    # Status
    status = models.CharField(
        max_length=20, choices=INSPECTION_STATUS_CHOICES, default='scheduled'
    )

    # Biological hazards
    animal_intrusion = models.BooleanField(null=True, blank=True)
    animal_droppings_found = models.BooleanField(null=True, blank=True)
    adjacent_animal_operations = models.BooleanField(null=True, blank=True)
    water_source_contamination = models.BooleanField(null=True, blank=True)
    biological_hazard_notes = models.TextField(blank=True)

    # Chemical hazards
    phi_respected = models.BooleanField(
        null=True, blank=True,
        help_text="Pre-Harvest Interval for last pesticide application respected?"
    )
    last_pesticide_date = models.DateField(null=True, blank=True)
    last_pesticide_product = models.CharField(max_length=200, blank=True)
    drift_risk = models.BooleanField(null=True, blank=True)
    chemical_spill_evidence = models.BooleanField(null=True, blank=True)
    chemical_hazard_notes = models.TextField(blank=True)

    # Physical hazards
    foreign_material_found = models.BooleanField(null=True, blank=True)
    glass_metal_debris = models.BooleanField(null=True, blank=True)
    equipment_condition_ok = models.BooleanField(null=True, blank=True)
    physical_hazard_notes = models.TextField(blank=True)

    # Field condition
    field_condition_acceptable = models.BooleanField(null=True, blank=True)
    drainage_adequate = models.BooleanField(null=True, blank=True)
    sanitation_units_in_place = models.BooleanField(null=True, blank=True)
    hand_wash_available = models.BooleanField(null=True, blank=True)
    field_condition_notes = models.TextField(blank=True)

    # Worker readiness
    workers_trained = models.BooleanField(null=True, blank=True)
    harvest_containers_clean = models.BooleanField(null=True, blank=True)
    transport_vehicles_clean = models.BooleanField(null=True, blank=True)
    worker_readiness_notes = models.TextField(blank=True)

    # Overall result
    passed = models.BooleanField(null=True, blank=True)
    overall_notes = models.TextField(blank=True)

    # Corrective actions if failed
    corrective_action_ref = models.ForeignKey(
        CorrectiveAction, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='pre_harvest_source'
    )

    # Approval
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='pre_harvest_inspections_approved'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-inspection_date']
        indexes = [
            models.Index(
                fields=['company', '-inspection_date'],
                name='idx_preharvest_company_date'
            ),
            models.Index(
                fields=['farm', 'field', '-inspection_date'],
                name='idx_preharvest_farm_field'
            ),
            models.Index(
                fields=['status'],
                name='idx_preharvest_status'
            ),
        ]

    def __str__(self):
        return f"Pre-Harvest Inspection - {self.field} ({self.inspection_date})"

    def save(self, *args, **kwargs):
        # Auto-calculate passed status based on critical checks
        if self.status == 'completed' and self.passed is None:
            critical_checks = [
                self.phi_respected is not False,
                self.chemical_spill_evidence is not True,
                self.water_source_contamination is not True,
                self.field_condition_acceptable is not False,
            ]
            self.passed = all(critical_checks)
        super().save(*args, **kwargs)
