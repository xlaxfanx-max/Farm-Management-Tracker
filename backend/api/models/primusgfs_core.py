"""
PrimusGFS Core Models — Document Control, Audits, Corrective Actions
"""

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
    document_number = models.CharField(max_length=50, blank=True, help_text="Auto-generated if blank, e.g., SOP-GAP-001")
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
    audit_number = models.CharField(max_length=50, blank=True, help_text="Auto-generated if blank, e.g., IA-2026-001")
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

    finding_number = models.CharField(max_length=20, blank=True, help_text="Auto-generated if blank")
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

    # Generic source linking (audit, mock_recall, inspection, incident, nuoca)
    source_type = models.CharField(
        max_length=50, default='audit',
        help_text="audit, mock_recall, inspection, incident, nuoca"
    )
    source_id = models.IntegerField(
        null=True, blank=True, help_text="ID of source object"
    )

    # NUOCA fields (CAC Doc 09 — Notice of Unusual Occurrence)
    is_nuoca = models.BooleanField(
        default=False,
        help_text="Is this a NUOCA (Notice of Unusual Occurrence and Corrective Action)?"
    )
    nuoca_category = models.CharField(
        max_length=50, blank=True, choices=[
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
    )
    reported_by_name = models.CharField(max_length=200, blank=True)
    occurrence_time = models.TimeField(null=True, blank=True)

    # Action details
    ca_number = models.CharField(max_length=50, blank=True, help_text="Auto-generated if blank, e.g., CA-001")
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
