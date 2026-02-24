"""PrimusGFS Supplier Control, Mock Recall & Food Defense Models"""

from datetime import date, timedelta
from django.conf import settings
from django.db import models

from .primusgfs_core import ControlledDocument


# =============================================================================
# CHOICES
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

    recall_number = models.CharField(max_length=50, blank=True, help_text="Auto-generated if blank, e.g., MR-2026-001")
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
