"""PrimusGFS Land Assessment Models"""

from datetime import date, timedelta
from django.conf import settings
from django.db import models

from .primusgfs_core import ControlledDocument


# =============================================================================
# CHOICES
# =============================================================================

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

    # Supporting documents (direct upload — soil tests, county records, deed photos, etc.)
    supporting_document = models.FileField(
        upload_to='land_assessments/%Y/%m/', null=True, blank=True,
        help_text="Upload supporting evidence (soil test PDF, county record, deed photo, etc.)"
    )
    supporting_document_name = models.CharField(
        max_length=255, blank=True,
        help_text="Original filename of the uploaded document"
    )

    # Linked controlled document (formal SOP / policy link)
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
