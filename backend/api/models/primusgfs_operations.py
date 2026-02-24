"""PrimusGFS Field Operations Models — Sanitation, Equipment, Pest Control, Inspections"""

import math
from datetime import date, timedelta
from django.conf import settings
from django.db import models

from .primusgfs_core import CorrectiveAction, ControlledDocument


# =============================================================================
# CHOICES
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
