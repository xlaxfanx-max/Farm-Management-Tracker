"""
CAC Food Safety Manual - Audit Binder Management Models

Manages the CAC Food Safety Manual V5.0 fillable PDF (39 documents across
7 sections) for PrimusGFS audit preparation. Tracks document completion,
stores SOP policy text, caches auto-filled data from system models, and
manages supporting document attachments.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


# =============================================================================
# CHOICES
# =============================================================================

BINDER_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('in_progress', 'In Progress'),
    ('ready', 'Ready for Audit'),
    ('submitted', 'Submitted'),
]

SECTION_STATUS_CHOICES = [
    ('not_started', 'Not Started'),
    ('in_progress', 'In Progress'),
    ('complete', 'Complete'),
    ('not_applicable', 'Not Applicable'),
]

SECTION_DOC_TYPE_CHOICES = [
    ('auto_fill', 'Auto-Fill from System Data'),
    ('partial_fill', 'Partial Auto-Fill'),
    ('sop', 'Standard Operating Procedure'),
    ('blank_template', 'Blank On-Site Template'),
    ('reference', 'Static Reference Material'),
]

SECTION_GROUP_CHOICES = [
    ('management', 'Food Safety Management System'),
    ('field_sanitation', 'Field Sanitation & Hygiene'),
    ('agricultural_inputs', 'Agricultural Inputs'),
    ('worker_health', 'Worker Health, Hygiene & Training'),
    ('training', 'Training'),
    ('audit_checklists', 'Audit Checklists'),
    ('risk_assessment', 'Risk Assessment'),
]

# Default section definitions for CAC Food Safety Manual V5.0
# Each entry: (doc_number, title, section_group, doc_type, auto_fill_source)
CAC_V5_SECTION_DEFINITIONS = [
    (1, 'Ranch Information', 'management', 'auto_fill', 'ranch_info'),
    (2, 'Organizational Structure', 'management', 'partial_fill', 'org_structure'),
    (3, 'Food Safety Policy Statement', 'management', 'sop', None),
    (4, 'Food Safety Committee Meeting Log', 'management', 'auto_fill', 'committee_log'),
    (5, 'Regulatory Agency Contact List', 'management', 'reference', None),
    (6, 'Document Control SOP', 'management', 'sop', None),
    (7, 'Internal Audit SOP', 'management', 'sop', None),
    (8, 'Corrective Action / Preventive Action SOP', 'management', 'sop', None),
    (9, 'Traceability SOP', 'management', 'sop', None),
    (10, 'Mock Recall SOP', 'management', 'sop', None),
    (11, 'Supplier Approval SOP', 'management', 'sop', None),
    (12, 'Food Defense Plan', 'management', 'sop', None),
    (13, 'Allergen Management SOP', 'management', 'sop', None),
    (14, 'Environmental Monitoring SOP', 'management', 'sop', None),
    (15, 'Glass & Brittle Plastics SOP', 'management', 'sop', None),
    (16, 'Worker Health, Hygiene & Training SOP', 'worker_health', 'sop', None),
    (17, 'Biological Hazards SOP', 'management', 'sop', None),
    (18, 'Chemical Hazards SOP', 'management', 'sop', None),
    (19, 'Physical Hazards SOP', 'management', 'sop', None),
    (20, 'Visitor Log', 'field_sanitation', 'auto_fill', 'visitor_log'),
    (21, 'Toilet / Handwashing Maintenance Log', 'field_sanitation', 'blank_template', None),
    (22, 'Soils / Land Use Assessment', 'agricultural_inputs', 'partial_fill', 'land_history'),
    (23, 'Approved Supplier List', 'agricultural_inputs', 'auto_fill', 'approved_suppliers'),
    (24, 'Perimeter Monitoring Log', 'agricultural_inputs', 'partial_fill', 'perimeter_monitoring'),
    (25, 'Animal Intrusion / Contamination Event Log', 'agricultural_inputs', 'blank_template', None),
    (26, 'Fertilizer Application Log', 'agricultural_inputs', 'auto_fill', 'fertilizer_log'),
    (27, 'Water Usage & Testing Log', 'agricultural_inputs', 'auto_fill', 'water_usage'),
    (28, 'Crop Protection Materials Log', 'agricultural_inputs', 'auto_fill', 'crop_protection'),
    (29, 'Chemical Inventory', 'agricultural_inputs', 'auto_fill', 'chemical_inventory'),
    (30, 'Worker Health / Illness / Injury Log', 'worker_health', 'blank_template', None),
    (31, 'Shade Structure / Break Area Cleaning Log', 'field_sanitation', 'blank_template', None),
    (32, 'Vehicle / Equipment Cleaning Log', 'field_sanitation', 'blank_template', None),
    (33, 'Harvest Container / Tool Sanitization Log', 'field_sanitation', 'blank_template', None),
    (34, 'Toilet / Handwashing Station Maintenance Log', 'field_sanitation', 'auto_fill', 'toilet_maintenance'),
    (35, 'Food Safety Training Outline (Bilingual)', 'training', 'reference', None),
    (36, 'Foodborne Illness Training (Supervisors)', 'training', 'reference', None),
    (37, 'Training Log', 'training', 'auto_fill', 'training_log'),
    (38, 'Pre-Season Self-Assessment Checklist', 'audit_checklists', 'partial_fill', 'pre_season_assessment'),
    (39, 'Field Risk Assessment', 'risk_assessment', 'partial_fill', 'field_risk_assessment'),
]


# =============================================================================
# MODELS
# =============================================================================

class CACBinderTemplate(models.Model):
    """
    A versioned CAC Food Safety Manual PDF template.
    Stores the fillable PDF and defines the 39 document sections.
    """
    company = models.ForeignKey(
        'api.Company',
        on_delete=models.CASCADE,
        related_name='cac_binder_templates',
    )
    version = models.CharField(
        max_length=20,
        help_text="Template version, e.g. '5.0'"
    )
    name = models.CharField(
        max_length=200,
        help_text="e.g. 'CAC Food Safety Manual Version 5'"
    )
    pdf_file = models.FileField(
        upload_to='cac_templates/',
        blank=True,
        null=True,
        help_text="The fillable PDF template file"
    )
    section_definitions = models.JSONField(
        default=list,
        help_text="List of section defs: [{doc_number, title, section_group, doc_type, auto_fill_source}]"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'is_active']),
        ]

    def __str__(self):
        return f"{self.name} (v{self.version})"

    @classmethod
    def get_default_section_definitions(cls):
        """Return the default V5.0 section definitions as a list of dicts."""
        return [
            {
                'doc_number': num,
                'title': title,
                'section_group': group,
                'doc_type': dtype,
                'auto_fill_source': source,
            }
            for num, title, group, dtype, source in CAC_V5_SECTION_DEFINITIONS
        ]


class AuditBinderInstance(models.Model):
    """
    A specific audit binder being prepared, e.g. '2026 Pre-Season Audit Binder'.
    Contains 39 BinderSection records (one per CAC document).
    """
    company = models.ForeignKey(
        'api.Company',
        on_delete=models.CASCADE,
        related_name='audit_binder_instances',
    )
    template = models.ForeignKey(
        CACBinderTemplate,
        on_delete=models.PROTECT,
        related_name='instances',
    )
    name = models.CharField(
        max_length=200,
        help_text="e.g. '2026 Pre-Season Audit Binder'"
    )
    season_year = models.IntegerField(
        help_text="Audit season year"
    )
    farm = models.ForeignKey(
        'api.Farm',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_binders',
        help_text="Optional: scope binder to a specific farm"
    )
    status = models.CharField(
        max_length=20,
        choices=BINDER_STATUS_CHOICES,
        default='draft',
    )
    notes = models.TextField(blank=True)
    generated_pdf = models.FileField(
        upload_to='audit_binders/generated/',
        blank=True,
        null=True,
        help_text="Final assembled PDF for audit"
    )
    generated_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_binders',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'status']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    @property
    def completion_stats(self):
        """Return completion statistics for this binder."""
        sections = self.sections.all()
        total = sections.count()
        if total == 0:
            return {'total': 0, 'complete': 0, 'in_progress': 0,
                    'not_started': 0, 'not_applicable': 0, 'percent': 0}
        complete = sections.filter(status='complete').count()
        na = sections.filter(status='not_applicable').count()
        in_progress = sections.filter(status='in_progress').count()
        not_started = sections.filter(status='not_started').count()
        applicable = total - na
        percent = round((complete / applicable * 100) if applicable > 0 else 0)
        return {
            'total': total,
            'complete': complete,
            'in_progress': in_progress,
            'not_started': not_started,
            'not_applicable': na,
            'percent': percent,
        }

    def create_sections_from_template(self):
        """Create all BinderSection records from the template's section_definitions."""
        sections = []
        for defn in self.template.section_definitions:
            sections.append(BinderSection(
                binder=self,
                doc_number=defn['doc_number'],
                title=defn['title'],
                section_group=defn['section_group'],
                doc_type=defn['doc_type'],
                auto_fill_source=defn.get('auto_fill_source') or '',
                status='not_started',
            ))
        BinderSection.objects.bulk_create(sections)
        return sections


class BinderSection(models.Model):
    """
    One of the 39 documents within an audit binder instance.
    Tracks completion status, stores SOP content, caches auto-fill data.
    """
    binder = models.ForeignKey(
        AuditBinderInstance,
        on_delete=models.CASCADE,
        related_name='sections',
    )
    doc_number = models.IntegerField(
        help_text="Document number (1-39) in the CAC manual"
    )
    title = models.CharField(max_length=200)
    section_group = models.CharField(
        max_length=30,
        choices=SECTION_GROUP_CHOICES,
    )
    doc_type = models.CharField(
        max_length=20,
        choices=SECTION_DOC_TYPE_CHOICES,
    )
    status = models.CharField(
        max_length=20,
        choices=SECTION_STATUS_CHOICES,
        default='not_started',
    )
    sop_content = models.TextField(
        blank=True,
        help_text="Rich text content for SOP/policy documents"
    )
    auto_fill_source = models.CharField(
        max_length=50,
        blank=True,
        help_text="Registry key for auto-fill data source"
    )
    auto_fill_data = models.JSONField(
        null=True,
        blank=True,
        help_text="Cached auto-fill data from system models"
    )
    manual_overrides = models.JSONField(
        null=True,
        blank=True,
        help_text="User edits on top of auto-filled data"
    )
    pdf_field_data = models.JSONField(
        null=True,
        blank=True,
        help_text="PDF form field values keyed by AcroForm field names, e.g. {'1-a-100': 'Sunrise Ranch'}"
    )
    notes = models.TextField(blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_binder_sections',
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['doc_number']
        unique_together = [('binder', 'doc_number')]

    def __str__(self):
        return f"Doc {self.doc_number:02d}: {self.title}"

    def mark_complete(self, user):
        """Mark this section as complete."""
        self.status = 'complete'
        self.completed_by = user
        self.completed_at = timezone.now()
        self.save(update_fields=['status', 'completed_by', 'completed_at'])

    def mark_not_applicable(self, reason=''):
        """Mark this section as not applicable."""
        self.status = 'not_applicable'
        if reason:
            self.notes = reason
        self.save(update_fields=['status', 'notes'])


class BinderSupportingDocument(models.Model):
    """
    A supporting document attached to a binder section
    (e.g. lab reports, certificates, photos).
    """
    section = models.ForeignKey(
        BinderSection,
        on_delete=models.CASCADE,
        related_name='supporting_documents',
    )
    file = models.FileField(upload_to='audit_binders/supporting/')
    file_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_binder_documents',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.file_name
