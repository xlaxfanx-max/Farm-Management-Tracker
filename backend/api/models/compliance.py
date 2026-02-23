from django.db import models
from django.utils import timezone

from .base import default_deadline_reminder_days, default_license_reminder_days


# -----------------------------------------------------------------------------
# COMPLIANCE PROFILE - Company-level compliance configuration
# -----------------------------------------------------------------------------

class ComplianceProfile(models.Model):
    """
    Defines which compliance frameworks apply to a company.
    Different growers have different requirements based on location,
    certifications, and buyer requirements.

    Auto-created when a Company is created.
    """

    US_STATES = [
        ('AL', 'Alabama'), ('AK', 'Alaska'), ('AZ', 'Arizona'), ('AR', 'Arkansas'),
        ('CA', 'California'), ('CO', 'Colorado'), ('CT', 'Connecticut'), ('DE', 'Delaware'),
        ('FL', 'Florida'), ('GA', 'Georgia'), ('HI', 'Hawaii'), ('ID', 'Idaho'),
        ('IL', 'Illinois'), ('IN', 'Indiana'), ('IA', 'Iowa'), ('KS', 'Kansas'),
        ('KY', 'Kentucky'), ('LA', 'Louisiana'), ('ME', 'Maine'), ('MD', 'Maryland'),
        ('MA', 'Massachusetts'), ('MI', 'Michigan'), ('MN', 'Minnesota'), ('MS', 'Mississippi'),
        ('MO', 'Missouri'), ('MT', 'Montana'), ('NE', 'Nebraska'), ('NV', 'Nevada'),
        ('NH', 'New Hampshire'), ('NJ', 'New Jersey'), ('NM', 'New Mexico'), ('NY', 'New York'),
        ('NC', 'North Carolina'), ('ND', 'North Dakota'), ('OH', 'Ohio'), ('OK', 'Oklahoma'),
        ('OR', 'Oregon'), ('PA', 'Pennsylvania'), ('RI', 'Rhode Island'), ('SC', 'South Carolina'),
        ('SD', 'South Dakota'), ('TN', 'Tennessee'), ('TX', 'Texas'), ('UT', 'Utah'),
        ('VT', 'Vermont'), ('VA', 'Virginia'), ('WA', 'Washington'), ('WV', 'West Virginia'),
        ('WI', 'Wisconsin'), ('WY', 'Wyoming'),
    ]

    company = models.OneToOneField(
        'Company',
        on_delete=models.CASCADE,
        related_name='compliance_profile'
    )

    # Geographic/Regulatory
    primary_state = models.CharField(
        max_length=2,
        choices=US_STATES,
        default='CA',
        help_text="Primary state of operation - determines default regulations"
    )
    additional_states = models.JSONField(
        default=list,
        blank=True,
        help_text="Additional states where operations occur (list of state codes)"
    )

    # Federal & State Regulatory Programs
    requires_pur_reporting = models.BooleanField(
        default=True,
        verbose_name="California PUR Reporting",
        help_text="Pesticide Use Reports to County Ag Commissioner (CA only)"
    )
    requires_wps_compliance = models.BooleanField(
        default=True,
        verbose_name="Worker Protection Standard",
        help_text="EPA WPS training, posting, and recordkeeping"
    )
    requires_fsma_compliance = models.BooleanField(
        default=False,
        verbose_name="FSMA Produce Safety Rule",
        help_text="FDA Food Safety Modernization Act requirements"
    )
    requires_sgma_reporting = models.BooleanField(
        default=False,
        verbose_name="SGMA Groundwater Reporting",
        help_text="Sustainable Groundwater Management Act (CA)"
    )
    requires_ilrp_reporting = models.BooleanField(
        default=False,
        verbose_name="ILRP Nitrogen Reporting",
        help_text="Irrigated Lands Regulatory Program (CA)"
    )

    # Certifications
    organic_certified = models.BooleanField(
        default=False,
        help_text="USDA NOP Organic Certification"
    )
    organic_certifier = models.CharField(
        max_length=100,
        blank=True,
        help_text="Certifying agency (e.g., CCOF, Oregon Tilth)"
    )
    globalgap_certified = models.BooleanField(
        default=False,
        help_text="GlobalGAP Certification"
    )
    primus_certified = models.BooleanField(
        default=False,
        help_text="PrimusGFS Certification"
    )
    sqf_certified = models.BooleanField(
        default=False,
        help_text="Safe Quality Food Certification"
    )

    # Buyer-specific requirements (flexible JSON storage)
    buyer_requirements = models.JSONField(
        default=dict,
        blank=True,
        help_text="Custom buyer requirements: {buyer_name: {requirement_key: value}}"
    )

    # Notification preferences
    deadline_reminder_days = models.JSONField(
        default=default_deadline_reminder_days,
        help_text="Days before deadline to send reminders"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Compliance Profile"
        verbose_name_plural = "Compliance Profiles"

    def __str__(self):
        return f"Compliance Profile for {self.company.name}"

    @property
    def active_regulations(self):
        """Return list of active regulatory requirements."""
        regs = []
        if self.requires_pur_reporting:
            regs.append('CA PUR')
        if self.requires_wps_compliance:
            regs.append('EPA WPS')
        if self.requires_fsma_compliance:
            regs.append('FSMA')
        if self.requires_sgma_reporting:
            regs.append('SGMA')
        if self.requires_ilrp_reporting:
            regs.append('ILRP')
        if self.organic_certified:
            regs.append('USDA Organic')
        if self.globalgap_certified:
            regs.append('GlobalGAP')
        return regs


# -----------------------------------------------------------------------------
# COMPLIANCE DEADLINE - Tracks all compliance deadlines
# -----------------------------------------------------------------------------

class ComplianceDeadline(models.Model):
    """
    Tracks recurring and one-time compliance deadlines.
    Auto-populated based on ComplianceProfile + custom entries.
    """

    FREQUENCY_CHOICES = [
        ('once', 'One-time'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('semi_annual', 'Semi-Annual'),
        ('annual', 'Annual'),
    ]

    CATEGORY_CHOICES = [
        ('reporting', 'Regulatory Reporting'),
        ('training', 'Training/Certification'),
        ('testing', 'Testing/Sampling'),
        ('documentation', 'Documentation'),
        ('inspection', 'Inspection'),
        ('renewal', 'License/Certificate Renewal'),
        ('audit', 'Audit'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('upcoming', 'Upcoming'),
        ('due_soon', 'Due Soon'),
        ('overdue', 'Overdue'),
        ('completed', 'Completed'),
        ('skipped', 'Skipped/N/A'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='compliance_deadlines'
    )

    # Deadline definition
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    regulation = models.CharField(
        max_length=100,
        blank=True,
        help_text="Regulatory framework (e.g., 'CA PUR', 'EPA WPS', 'USDA NOP')"
    )

    # Timing
    due_date = models.DateField()
    frequency = models.CharField(
        max_length=20,
        choices=FREQUENCY_CHOICES,
        default='once'
    )
    warning_days = models.IntegerField(
        default=14,
        help_text="Days before due date to start showing warnings"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='upcoming'
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='completed_deadlines'
    )
    completion_notes = models.TextField(blank=True)

    # Automation tracking
    auto_generated = models.BooleanField(
        default=False,
        help_text="Was this deadline auto-generated from compliance profile?"
    )
    source_deadline = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='recurring_instances',
        help_text="Parent deadline for recurring deadlines"
    )

    # Optional: Link to specific entities
    related_farm = models.ForeignKey(
        'Farm',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='compliance_deadlines'
    )
    related_field = models.ForeignKey(
        'Field',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='compliance_deadlines'
    )

    # Action URL for quick navigation
    action_url = models.CharField(
        max_length=200,
        blank=True,
        help_text="Frontend route to complete this task (e.g., '/reports/pur')"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date', 'name']
        verbose_name = "Compliance Deadline"
        verbose_name_plural = "Compliance Deadlines"
        indexes = [
            models.Index(fields=['company', 'status', 'due_date'], name='idx_deadline_company_status'),
            models.Index(fields=['company', 'category'], name='idx_deadline_company_cat'),
            models.Index(fields=['due_date', 'status'], name='idx_deadline_due_status'),
        ]

    def __str__(self):
        return f"{self.name} - Due {self.due_date} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        """Auto-update status based on due date."""
        self._update_status()
        super().save(*args, **kwargs)

    def _update_status(self):
        """Update status based on current date and due date."""
        if self.status in ['completed', 'skipped']:
            return  # Don't change completed/skipped items

        from datetime import date
        today = date.today()
        days_until_due = (self.due_date - today).days

        if days_until_due < 0:
            self.status = 'overdue'
        elif days_until_due <= self.warning_days:
            self.status = 'due_soon'
        else:
            self.status = 'upcoming'

    def mark_complete(self, user=None, notes=''):
        """Mark this deadline as completed."""
        self.status = 'completed'
        self.completed_at = timezone.now()
        self.completed_by = user
        if notes:
            self.completion_notes = notes
        self.save()

    @property
    def is_overdue(self):
        from datetime import date
        return self.due_date < date.today() and self.status not in ['completed', 'skipped']

    @property
    def days_until_due(self):
        from datetime import date
        return (self.due_date - date.today()).days


# -----------------------------------------------------------------------------
# COMPLIANCE ALERT - System-generated alerts
# -----------------------------------------------------------------------------

class ComplianceAlert(models.Model):
    """
    System-generated alerts for compliance issues.
    Integrates with existing OperationalAlertsBanner pattern.
    """

    PRIORITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]

    ALERT_TYPE_CHOICES = [
        ('deadline_approaching', 'Deadline Approaching'),
        ('deadline_overdue', 'Deadline Overdue'),
        ('license_expiring', 'License/Certificate Expiring'),
        ('license_expired', 'License/Certificate Expired'),
        ('training_due', 'Training Due'),
        ('training_expired', 'Training Expired'),
        ('phi_violation', 'PHI Violation Risk'),
        ('rei_violation', 'REI Violation Risk'),
        ('missing_documentation', 'Missing Documentation'),
        ('test_overdue', 'Test Overdue'),
        ('report_ready', 'Report Ready for Submission'),
        ('audit_upcoming', 'Audit Upcoming'),
        ('certification_expiring', 'Certification Expiring'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='compliance_alerts'
    )

    alert_type = models.CharField(max_length=50, choices=ALERT_TYPE_CHOICES)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()

    # Source tracking - what generated this alert
    related_deadline = models.ForeignKey(
        ComplianceDeadline,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='alerts'
    )
    related_object_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="Model name of related object (e.g., 'License', 'WPSTrainingRecord')"
    )
    related_object_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="ID of the related object"
    )

    # Status
    is_active = models.BooleanField(default=True)
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='acknowledged_alerts'
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    # Action for resolution
    action_url = models.CharField(
        max_length=200,
        blank=True,
        help_text="Frontend route to resolve this alert"
    )
    action_label = models.CharField(
        max_length=100,
        blank=True,
        help_text="Button label for action (e.g., 'Submit Report', 'Renew License')"
    )

    # Auto-expiration
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Auto-dismiss alert after this time"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-priority', '-created_at']
        verbose_name = "Compliance Alert"
        verbose_name_plural = "Compliance Alerts"
        indexes = [
            models.Index(fields=['company', 'is_active', 'priority'], name='idx_alert_company_active'),
            models.Index(fields=['alert_type', 'is_active'], name='idx_alert_type_active'),
        ]

    def __str__(self):
        return f"[{self.get_priority_display()}] {self.title}"

    def acknowledge(self, user):
        """Acknowledge this alert."""
        self.is_acknowledged = True
        self.acknowledged_by = user
        self.acknowledged_at = timezone.now()
        self.save()

    def dismiss(self):
        """Dismiss/deactivate this alert."""
        self.is_active = False
        self.save()

    @classmethod
    def create_deadline_alert(cls, deadline, alert_type='deadline_approaching'):
        """Factory method to create alert from a deadline."""
        priority_map = {
            'deadline_overdue': 'critical',
            'deadline_approaching': 'high' if deadline.days_until_due <= 7 else 'medium',
        }

        message_map = {
            'deadline_overdue': f"'{deadline.name}' was due on {deadline.due_date}. Please complete immediately.",
            'deadline_approaching': f"'{deadline.name}' is due in {deadline.days_until_due} days on {deadline.due_date}.",
        }

        return cls.objects.create(
            company=deadline.company,
            alert_type=alert_type,
            priority=priority_map.get(alert_type, 'medium'),
            title=f"{deadline.name} - {deadline.get_status_display()}",
            message=message_map.get(alert_type, ''),
            related_deadline=deadline,
            action_url=deadline.action_url or '/compliance/deadlines',
            action_label='View Deadline',
        )


# -----------------------------------------------------------------------------
# LICENSE - Tracks all licenses and certificates
# -----------------------------------------------------------------------------

class License(models.Model):
    """
    Tracks all types of licenses, certificates, and credentials.
    Can be company-level (e.g., PCA license) or user-level (e.g., applicator cert).
    """

    LICENSE_TYPE_CHOICES = [
        ('qal', 'Qualified Applicator License (QAL)'),
        ('qac', 'Qualified Applicator Certificate (QAC)'),
        ('pca', 'Pest Control Advisor (PCA)'),
        ('pilots_license', "Pilot's License (Aerial Application)"),
        ('structural', 'Structural Pest Control'),
        ('cdl', "Commercial Driver's License (CDL)"),
        ('organic_handler', 'Organic Handler Certificate'),
        ('food_safety', 'Food Safety Certificate'),
        ('wps_trainer', 'WPS Trainer Certification'),
        ('haccp', 'HACCP Certification'),
        ('gap_auditor', 'GAP Auditor Certification'),
        ('other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('expiring_soon', 'Expiring Soon'),
        ('expired', 'Expired'),
        ('suspended', 'Suspended'),
        ('pending_renewal', 'Pending Renewal'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='licenses'
    )
    user = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='licenses',
        help_text="Leave blank for company-level licenses"
    )

    # License details
    license_type = models.CharField(max_length=50, choices=LICENSE_TYPE_CHOICES)
    license_number = models.CharField(max_length=100)
    name_on_license = models.CharField(
        max_length=200,
        blank=True,
        help_text="Name as it appears on the license"
    )
    issuing_authority = models.CharField(
        max_length=200,
        help_text="Issuing agency (e.g., 'CA DPR', 'CDFA', 'USDA')"
    )
    issuing_state = models.CharField(
        max_length=2,
        blank=True,
        help_text="State that issued the license"
    )

    # Validity period
    issue_date = models.DateField()
    expiration_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )

    # Categories/endorsements (flexible JSON for different license types)
    categories = models.JSONField(
        default=list,
        blank=True,
        help_text="License categories (e.g., ['A', 'B', 'C'] for applicator)"
    )
    endorsements = models.JSONField(
        default=list,
        blank=True,
        help_text="Special endorsements"
    )

    # Renewal tracking
    renewal_reminder_days = models.IntegerField(
        default=90,
        help_text="Days before expiration to start reminding"
    )
    renewal_in_progress = models.BooleanField(default=False)
    renewal_submitted_date = models.DateField(null=True, blank=True)
    renewal_notes = models.TextField(blank=True)

    # Continuing education (for licenses that require it)
    ce_credits_required = models.IntegerField(
        null=True,
        blank=True,
        help_text="CE credits required per renewal period"
    )
    ce_credits_earned = models.IntegerField(
        null=True,
        blank=True,
        help_text="CE credits earned toward next renewal"
    )

    # Documentation
    document = models.FileField(
        upload_to='licenses/%Y/%m/',
        null=True,
        blank=True,
        help_text="Scanned copy of license"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['expiration_date']
        verbose_name = "License"
        verbose_name_plural = "Licenses"
        indexes = [
            models.Index(fields=['company', 'status'], name='idx_license_company_status'),
            models.Index(fields=['user', 'license_type'], name='idx_license_user_type'),
            models.Index(fields=['expiration_date', 'status'], name='idx_license_exp_status'),
        ]

    def __str__(self):
        holder = self.user.get_full_name() if self.user else self.company.name
        return f"{self.get_license_type_display()} - {holder} (Exp: {self.expiration_date})"

    def save(self, *args, **kwargs):
        """Auto-update status based on expiration date."""
        self._update_status()
        super().save(*args, **kwargs)

    def _update_status(self):
        """Update status based on expiration date."""
        if self.status in ['suspended']:
            return  # Don't auto-change suspended licenses

        from datetime import date
        today = date.today()
        days_until_exp = (self.expiration_date - today).days

        if days_until_exp < 0:
            self.status = 'expired'
        elif days_until_exp <= self.renewal_reminder_days:
            if self.renewal_in_progress:
                self.status = 'pending_renewal'
            else:
                self.status = 'expiring_soon'
        else:
            self.status = 'active'

    @property
    def is_valid(self):
        """Check if license is currently valid for use."""
        return self.status in ['active', 'expiring_soon', 'pending_renewal']

    @property
    def days_until_expiration(self):
        from datetime import date
        return (self.expiration_date - date.today()).days

    @property
    def holder_name(self):
        """Get the license holder's name."""
        if self.name_on_license:
            return self.name_on_license
        if self.user:
            return self.user.get_full_name() or self.user.email
        return self.company.name


# -----------------------------------------------------------------------------
# WPS TRAINING RECORD - Worker Protection Standard training tracking
# -----------------------------------------------------------------------------

class WPSTrainingRecord(models.Model):
    """
    Tracks WPS training for workers and handlers.
    Training valid for 12 months (pesticide safety) and 36 months (handler-specific).
    """

    TRAINING_TYPE_CHOICES = [
        ('pesticide_safety', 'Pesticide Safety Training (Workers)'),
        ('handler', 'Handler Training'),
        ('early_entry', 'Early Entry Training'),
        ('respirator', 'Respirator Fit Test'),
        ('heat_illness', 'Heat Illness Prevention'),
        ('emergency_response', 'Emergency Response'),
        ('ppe', 'Personal Protective Equipment'),
        ('first_aid', 'First Aid/CPR'),
    ]

    VALIDITY_PERIODS = {
        'pesticide_safety': 365,  # 12 months
        'handler': 365,           # 12 months
        'early_entry': 365,       # 12 months
        'respirator': 365,        # 12 months (annual fit test)
        'heat_illness': 365,      # Annual refresh recommended
        'emergency_response': 365,
        'ppe': 365,
        'first_aid': 730,         # 2 years typical
    }

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='wps_training_records'
    )

    # Trainee information
    trainee_name = models.CharField(max_length=200)
    trainee_employee_id = models.CharField(
        max_length=50,
        blank=True,
        help_text="Internal employee ID if applicable"
    )
    trainee_user = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='wps_training_received',
        help_text="Link to user account if trainee is a system user"
    )

    # Training details
    training_type = models.CharField(max_length=50, choices=TRAINING_TYPE_CHOICES)
    training_date = models.DateField()
    expiration_date = models.DateField()

    # Training program details
    training_program = models.CharField(
        max_length=200,
        blank=True,
        help_text="Name of training program/curriculum used"
    )
    training_language = models.CharField(
        max_length=50,
        default='English',
        help_text="Language training was conducted in"
    )

    # Trainer information
    trainer_name = models.CharField(max_length=200)
    trainer_certification = models.CharField(
        max_length=100,
        blank=True,
        help_text="Trainer's certification number"
    )
    trainer_user = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='wps_training_given',
        help_text="Link to trainer's user account if internal"
    )

    # Verification
    verified = models.BooleanField(
        default=False,
        help_text="Trainee comprehension verified"
    )
    verification_method = models.CharField(
        max_length=100,
        blank=True,
        help_text="How comprehension was verified (e.g., 'Quiz - 85%', 'Verbal')"
    )
    quiz_score = models.IntegerField(
        null=True,
        blank=True,
        help_text="Quiz score if applicable (percentage)"
    )

    # Documentation
    certificate_document = models.FileField(
        upload_to='wps_training/%Y/%m/',
        null=True,
        blank=True,
        help_text="Scanned training certificate"
    )

    # Location tracking (for WPS records must show where training occurred)
    training_location = models.CharField(
        max_length=200,
        blank=True,
        help_text="Where training was conducted"
    )
    farm = models.ForeignKey(
        'Farm',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='wps_training_records',
        help_text="Farm where training was conducted if applicable"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-training_date']
        verbose_name = "WPS Training Record"
        verbose_name_plural = "WPS Training Records"
        indexes = [
            models.Index(fields=['company', 'training_type'], name='idx_wps_company_type'),
            models.Index(fields=['trainee_name', 'training_type'], name='idx_wps_trainee_type'),
            models.Index(fields=['expiration_date'], name='idx_wps_expiration'),
        ]

    def __str__(self):
        return f"{self.trainee_name} - {self.get_training_type_display()} ({self.training_date})"

    def save(self, *args, **kwargs):
        """Auto-calculate expiration date if not set."""
        if not self.expiration_date:
            from datetime import timedelta
            days = self.VALIDITY_PERIODS.get(self.training_type, 365)
            self.expiration_date = self.training_date + timedelta(days=days)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        """Check if training is still valid."""
        from datetime import date
        return self.expiration_date >= date.today()

    @property
    def days_until_expiration(self):
        from datetime import date
        return (self.expiration_date - date.today()).days

    @property
    def status(self):
        """Return status string based on expiration."""
        days = self.days_until_expiration
        if days < 0:
            return 'expired'
        elif days <= 90:
            return 'expiring_soon'
        return 'valid'


# -----------------------------------------------------------------------------
# CENTRAL POSTING LOCATION - WPS posting requirements
# -----------------------------------------------------------------------------

class CentralPostingLocation(models.Model):
    """
    WPS requires posting at a central location accessible to workers.
    Tracks posting locations and their compliance status.
    """

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='central_posting_locations'
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        related_name='central_posting_locations'
    )

    location_name = models.CharField(
        max_length=200,
        help_text="Name of posting location (e.g., 'Main Break Room')"
    )
    location_description = models.TextField(
        blank=True,
        help_text="Detailed description of location"
    )

    # WPS requirements checklist
    has_wps_poster = models.BooleanField(
        default=False,
        verbose_name="WPS Safety Poster",
        help_text="EPA WPS safety poster displayed"
    )
    has_emergency_info = models.BooleanField(
        default=False,
        verbose_name="Emergency Information",
        help_text="Emergency medical facility location and phone number posted"
    )
    has_sds_available = models.BooleanField(
        default=False,
        verbose_name="Safety Data Sheets",
        help_text="SDSs for all pesticides used in last 30 days accessible"
    )
    has_application_info = models.BooleanField(
        default=False,
        verbose_name="Application Information",
        help_text="Recent application information posted (within 30 days)"
    )
    has_decontamination_supplies = models.BooleanField(
        default=False,
        verbose_name="Decontamination Supplies",
        help_text="Emergency eye wash and water available"
    )

    # Verification tracking
    last_verified_date = models.DateField(null=True, blank=True)
    last_verified_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='verified_posting_locations'
    )
    verification_notes = models.TextField(blank=True)

    # Photo documentation
    photo = models.ImageField(
        upload_to='posting_locations/%Y/%m/',
        null=True,
        blank=True,
        help_text="Photo of posting location for documentation"
    )

    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['farm__name', 'location_name']
        verbose_name = "Central Posting Location"
        verbose_name_plural = "Central Posting Locations"

    def __str__(self):
        return f"{self.location_name} at {self.farm.name}"

    @property
    def is_compliant(self):
        """Check if all WPS posting requirements are met."""
        return all([
            self.has_wps_poster,
            self.has_emergency_info,
            self.has_sds_available,
            self.has_application_info,
        ])

    @property
    def compliance_score(self):
        """Return compliance percentage."""
        checks = [
            self.has_wps_poster,
            self.has_emergency_info,
            self.has_sds_available,
            self.has_application_info,
            self.has_decontamination_supplies,
        ]
        return int(sum(checks) / len(checks) * 100)

    def verify(self, user, notes=''):
        """Mark location as verified."""
        from datetime import date
        self.last_verified_date = date.today()
        self.last_verified_by = user
        if notes:
            self.verification_notes = notes
        self.save()


# -----------------------------------------------------------------------------
# REI POSTING RECORD - Restricted Entry Interval posting
# -----------------------------------------------------------------------------

class REIPostingRecord(models.Model):
    """
    Tracks REI posting for each pesticide application.
    Auto-generated from PesticideApplication with REI requirements.
    """

    application = models.OneToOneField(
        'PesticideApplication',
        on_delete=models.CASCADE,
        related_name='rei_posting'
    )

    # REI details (cached from product at time of application)
    rei_hours = models.PositiveIntegerField(
        help_text="Restricted Entry Interval in hours"
    )
    rei_end_datetime = models.DateTimeField(
        help_text="When REI expires and field can be re-entered"
    )

    # Posting workflow
    posted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When warning signs were posted"
    )
    posted_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='rei_postings'
    )

    # Removal workflow
    removed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When warning signs were removed"
    )
    removed_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='rei_removals'
    )

    # Compliance tracking
    posting_compliant = models.BooleanField(
        default=False,
        help_text="Signs posted before/during application"
    )
    removal_compliant = models.BooleanField(
        default=False,
        help_text="Signs removed only after REI expired"
    )

    # Early entry tracking (requires special training)
    early_entry_occurred = models.BooleanField(
        default=False,
        help_text="Workers entered during REI"
    )
    early_entry_reason = models.TextField(
        blank=True,
        help_text="Reason for early entry if applicable"
    )
    early_entry_ppe = models.TextField(
        blank=True,
        help_text="PPE worn during early entry"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-rei_end_datetime']
        verbose_name = "REI Posting Record"
        verbose_name_plural = "REI Posting Records"
        indexes = [
            models.Index(fields=['rei_end_datetime'], name='idx_rei_end_datetime'),
        ]

    def __str__(self):
        return f"REI for {self.application} - Ends {self.rei_end_datetime}"

    @property
    def is_active(self):
        """Check if REI is currently active."""
        return timezone.now() < self.rei_end_datetime

    @property
    def time_remaining(self):
        """Return time remaining in REI."""
        if self.is_active:
            return self.rei_end_datetime - timezone.now()
        return None

    def mark_posted(self, user):
        """Mark signs as posted."""
        self.posted_at = timezone.now()
        self.posted_by = user
        # Check if posted before/at time of application
        if self.application.start_time:
            from datetime import datetime, date
            app_datetime = datetime.combine(
                self.application.application_date,
                self.application.start_time
            )
            app_datetime = timezone.make_aware(app_datetime)
            self.posting_compliant = self.posted_at <= app_datetime
        self.save()

    def mark_removed(self, user):
        """Mark signs as removed."""
        self.removed_at = timezone.now()
        self.removed_by = user
        # Check if removed after REI expired
        self.removal_compliant = self.removed_at >= self.rei_end_datetime
        self.save()


# -----------------------------------------------------------------------------
# COMPLIANCE REPORT - Tracks generated compliance reports
# -----------------------------------------------------------------------------

class ComplianceReport(models.Model):
    """
    Tracks generated compliance reports and their submission status.
    Supports auto-generation and validation before submission.
    """

    REPORT_TYPE_CHOICES = [
        ('pur_monthly', 'PUR Monthly Report'),
        ('pur_annual', 'PUR Annual Summary'),
        ('sgma_semi_annual', 'SGMA Semi-Annual Report'),
        ('ilrp_annual', 'ILRP Annual Report'),
        ('wps_annual', 'WPS Training Summary'),
        ('organic_annual', 'Organic Certification Report'),
        ('globalgap_audit', 'GlobalGAP Audit Package'),
        ('custom', 'Custom Report'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_review', 'Pending Review'),
        ('ready', 'Ready for Submission'),
        ('submitted', 'Submitted'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected - Needs Correction'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='compliance_reports'
    )

    # Report identification
    report_type = models.CharField(max_length=50, choices=REPORT_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    reporting_period_start = models.DateField()
    reporting_period_end = models.DateField()

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft'
    )

    # Generated data
    report_data = models.JSONField(
        default=dict,
        help_text="Pre-computed report data in JSON format"
    )
    record_count = models.IntegerField(
        default=0,
        help_text="Number of records included in report"
    )

    # Generated files
    report_file = models.FileField(
        upload_to='compliance_reports/%Y/%m/',
        null=True,
        blank=True,
        help_text="Generated report file (PDF/Excel/CSV)"
    )

    # Validation
    validation_run_at = models.DateTimeField(null=True, blank=True)
    validation_errors = models.JSONField(
        default=list,
        help_text="List of validation errors"
    )
    validation_warnings = models.JSONField(
        default=list,
        help_text="List of validation warnings"
    )
    is_valid = models.BooleanField(
        default=False,
        help_text="Passed validation with no errors"
    )

    # Submission tracking
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='submitted_reports'
    )
    submission_method = models.CharField(
        max_length=50,
        blank=True,
        help_text="How submitted (e.g., 'CalAgPermits', 'Email', 'Mail')"
    )
    submission_reference = models.CharField(
        max_length=100,
        blank=True,
        help_text="Confirmation number or reference"
    )

    # Response tracking
    response_received_at = models.DateTimeField(null=True, blank=True)
    response_notes = models.TextField(blank=True)

    # Related deadline (if applicable)
    related_deadline = models.ForeignKey(
        ComplianceDeadline,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reports'
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_reports'
    )

    class Meta:
        ordering = ['-reporting_period_end', '-created_at']
        verbose_name = "Compliance Report"
        verbose_name_plural = "Compliance Reports"
        indexes = [
            models.Index(fields=['company', 'report_type', 'status'], name='idx_report_company_type'),
            models.Index(fields=['reporting_period_end'], name='idx_report_period_end'),
        ]

    def __str__(self):
        return f"{self.title} ({self.reporting_period_start} to {self.reporting_period_end})"

    @property
    def can_submit(self):
        """Check if report is ready for submission."""
        return self.is_valid and self.status in ['ready', 'pending_review']

    @property
    def period_display(self):
        """Return formatted period string."""
        return f"{self.reporting_period_start.strftime('%b %d, %Y')} - {self.reporting_period_end.strftime('%b %d, %Y')}"


# -----------------------------------------------------------------------------
# INCIDENT REPORT - Safety incidents and near-misses
# -----------------------------------------------------------------------------

class IncidentReport(models.Model):
    """
    Tracks safety incidents, spills, exposures, and near-misses.
    Required for WPS compliance and internal safety programs.
    """

    INCIDENT_TYPE_CHOICES = [
        ('exposure', 'Pesticide Exposure'),
        ('spill', 'Chemical Spill'),
        ('equipment', 'Equipment Failure'),
        ('injury', 'Injury'),
        ('near_miss', 'Near Miss'),
        ('environmental', 'Environmental Release'),
        ('property', 'Property Damage'),
        ('drift', 'Pesticide Drift'),
        ('other', 'Other'),
    ]

    SEVERITY_CHOICES = [
        ('minor', 'Minor'),
        ('moderate', 'Moderate'),
        ('serious', 'Serious'),
        ('critical', 'Critical'),
    ]

    STATUS_CHOICES = [
        ('reported', 'Reported'),
        ('investigating', 'Under Investigation'),
        ('corrective_action', 'Corrective Action in Progress'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='incident_reports'
    )

    # Incident details
    incident_type = models.CharField(max_length=50, choices=INCIDENT_TYPE_CHOICES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    incident_date = models.DateTimeField()
    reported_date = models.DateTimeField(auto_now_add=True)

    # Location
    farm = models.ForeignKey(
        'Farm',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='incident_reports'
    )
    field = models.ForeignKey(
        'Field',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='incident_reports'
    )
    location_description = models.CharField(
        max_length=200,
        blank=True,
        help_text="Specific location description"
    )

    # People involved
    reported_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='incidents_reported'
    )
    affected_persons = models.JSONField(
        default=list,
        help_text="List of affected persons: [{name, role, injuries}]"
    )
    witnesses = models.JSONField(
        default=list,
        help_text="List of witnesses: [{name, contact}]"
    )

    # Description
    title = models.CharField(max_length=200)
    description = models.TextField()
    immediate_actions = models.TextField(
        blank=True,
        help_text="Actions taken immediately after incident"
    )

    # Related application (for exposure/spill)
    related_application = models.ForeignKey(
        'PesticideApplication',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='incident_reports'
    )
    products_involved = models.JSONField(
        default=list,
        help_text="List of products involved: [{name, epa_reg, amount}]"
    )

    # Investigation
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='reported'
    )
    investigator = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='incidents_investigating'
    )
    root_cause = models.TextField(blank=True)
    contributing_factors = models.JSONField(
        default=list,
        help_text="List of contributing factors"
    )

    # Corrective actions
    corrective_actions = models.TextField(blank=True)
    preventive_measures = models.TextField(blank=True)

    # Regulatory reporting
    reported_to_authorities = models.BooleanField(default=False)
    authority_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Agency reported to"
    )
    authority_report_date = models.DateField(null=True, blank=True)
    authority_report_reference = models.CharField(
        max_length=100,
        blank=True,
        help_text="Report/case number"
    )

    # Resolution
    resolved_date = models.DateField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='incidents_resolved'
    )
    resolution_summary = models.TextField(blank=True)

    # Documentation
    documents = models.JSONField(
        default=list,
        help_text="List of attached document paths"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-incident_date']
        verbose_name = "Incident Report"
        verbose_name_plural = "Incident Reports"
        indexes = [
            models.Index(fields=['company', 'status'], name='idx_incident_company_status'),
            models.Index(fields=['incident_type', 'severity'], name='idx_incident_type_severity'),
            models.Index(fields=['incident_date'], name='idx_incident_date'),
            models.Index(fields=['farm', '-incident_date'], name='idx_incident_farm_date'),
        ]

    def __str__(self):
        return f"{self.title} - {self.get_severity_display()} ({self.incident_date.date()})"

    @property
    def days_since_incident(self):
        """Days since incident occurred."""
        from datetime import datetime
        delta = timezone.now() - self.incident_date
        return delta.days

    @property
    def requires_authority_report(self):
        """Check if this type/severity requires reporting to authorities."""
        # Serious/critical exposures and spills typically require reporting
        if self.severity in ['serious', 'critical']:
            if self.incident_type in ['exposure', 'spill', 'environmental', 'drift']:
                return True
        return False


# -----------------------------------------------------------------------------
# NOTIFICATION PREFERENCE - User notification settings
# -----------------------------------------------------------------------------

class NotificationPreference(models.Model):
    """
    User-specific notification preferences for compliance alerts.
    """

    DIGEST_FREQUENCY_CHOICES = [
        ('instant', 'Instant (As they occur)'),
        ('daily', 'Daily Digest'),
        ('weekly', 'Weekly Digest'),
        ('none', 'No Email (In-app only)'),
    ]

    user = models.OneToOneField(
        'User',
        on_delete=models.CASCADE,
        related_name='notification_preferences'
    )

    # Email settings
    email_enabled = models.BooleanField(
        default=True,
        help_text="Receive email notifications"
    )
    email_digest_frequency = models.CharField(
        max_length=20,
        choices=DIGEST_FREQUENCY_CHOICES,
        default='instant'
    )

    # Category preferences
    notify_deadlines = models.BooleanField(
        default=True,
        help_text="Compliance deadline reminders"
    )
    notify_licenses = models.BooleanField(
        default=True,
        help_text="License expiration warnings"
    )
    notify_training = models.BooleanField(
        default=True,
        help_text="Training renewal reminders"
    )
    notify_reports = models.BooleanField(
        default=True,
        help_text="Report generation and submission notifications"
    )
    notify_incidents = models.BooleanField(
        default=True,
        help_text="Incident report notifications"
    )
    notify_rei = models.BooleanField(
        default=True,
        help_text="REI posting and expiration reminders"
    )

    # Reminder timing
    deadline_reminder_days = models.JSONField(
        default=default_deadline_reminder_days,
        help_text="Days before deadline to send reminders"
    )
    license_reminder_days = models.JSONField(
        default=default_license_reminder_days,
        help_text="Days before license expiration to send reminders"
    )

    # Quiet hours (don't send notifications during these times)
    quiet_hours_enabled = models.BooleanField(default=False)
    quiet_hours_start = models.TimeField(
        null=True,
        blank=True,
        help_text="Start of quiet hours (e.g., 21:00)"
    )
    quiet_hours_end = models.TimeField(
        null=True,
        blank=True,
        help_text="End of quiet hours (e.g., 07:00)"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Notification Preference"
        verbose_name_plural = "Notification Preferences"

    def __str__(self):
        return f"Notification Preferences for {self.user.email}"

    def should_notify(self, category):
        """Check if user wants notifications for a category."""
        category_map = {
            'deadline': self.notify_deadlines,
            'license': self.notify_licenses,
            'training': self.notify_training,
            'report': self.notify_reports,
            'incident': self.notify_incidents,
            'rei': self.notify_rei,
        }
        return category_map.get(category, True)


# -----------------------------------------------------------------------------
# NOI SUBMISSION - Notice of Intent tracking for restricted materials
# -----------------------------------------------------------------------------

class NOISubmission(models.Model):
    """
    Tracks Notice of Intent submissions for restricted use pesticide applications.

    California regulations require growers to file an NOI with the County
    Agricultural Commissioner before applying restricted materials. The
    PesticideComplianceService flags when an NOI is needed, and this model
    records that it was actually filed.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending Submission'),
        ('submitted', 'Submitted to County'),
        ('confirmed', 'Confirmed/Approved by County'),
        ('denied', 'Denied by County'),
        ('expired', 'Expired'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='noi_submissions'
    )

    # Link to the application(s) this NOI covers
    pesticide_application = models.ForeignKey(
        'PesticideApplication',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='noi_submissions',
        help_text="The application this NOI covers (may be set after application)"
    )

    # NOI details
    product = models.ForeignKey(
        'PesticideProduct',
        on_delete=models.CASCADE,
        related_name='noi_submissions',
        help_text="Restricted use product requiring NOI"
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='noi_submissions'
    )
    planned_application_date = models.DateField(
        help_text="Planned date of application"
    )
    planned_acres = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Planned acres to treat"
    )

    # Submission tracking
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending'
    )
    county = models.CharField(
        max_length=100,
        help_text="County Agricultural Commissioner office"
    )
    filed_date = models.DateField(
        null=True, blank=True,
        help_text="Date NOI was filed with county"
    )
    confirmation_number = models.CharField(
        max_length=100, blank=True,
        help_text="County confirmation/permit number"
    )
    submission_method = models.CharField(
        max_length=50, blank=True,
        help_text="How submitted (CalAgPermits, fax, in-person, email)"
    )

    # County response
    county_response_date = models.DateField(null=True, blank=True)
    county_response_notes = models.TextField(blank=True)

    # Conditions (county may impose conditions on the NOI)
    conditions = models.TextField(
        blank=True,
        help_text="Any conditions imposed by the county"
    )

    # Validity
    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)

    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='noi_submissions'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-planned_application_date']
        verbose_name = "NOI Submission"
        verbose_name_plural = "NOI Submissions"
        indexes = [
            models.Index(fields=['company', 'status'], name='idx_noi_company_status'),
            models.Index(fields=['field', 'planned_application_date'], name='idx_noi_field_date'),
        ]

    def __str__(self):
        return f"NOI: {self.product} on {self.field} ({self.planned_application_date})"

    @property
    def is_valid(self):
        """Check if NOI is currently valid."""
        if self.status != 'confirmed':
            return False
        from datetime import date as _date
        today = _date.today()
        if self.valid_until and self.valid_until < today:
            return False
        return True

    @property
    def is_overdue(self):
        """Check if NOI should have been submitted but hasn't been."""
        if self.status == 'pending':
            from datetime import date as _date, timedelta
            today = _date.today()
            deadline = self.planned_application_date - timedelta(days=1)
            return today > deadline
        return False


# -----------------------------------------------------------------------------
# NOTIFICATION LOG - Tracks sent notifications
# -----------------------------------------------------------------------------

class NotificationLog(models.Model):
    """
    Tracks all sent notifications for auditing and debugging.
    """

    CHANNEL_CHOICES = [
        ('email', 'Email'),
        ('in_app', 'In-App'),
        ('sms', 'SMS'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='notification_logs'
    )
    user = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='notification_logs'
    )

    # Notification details
    notification_type = models.CharField(
        max_length=50,
        help_text="Type of notification (e.g., 'deadline_reminder', 'license_expiring')"
    )
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)

    subject = models.CharField(max_length=200)
    message = models.TextField()

    # Delivery status
    sent_at = models.DateTimeField(auto_now_add=True)
    delivered = models.BooleanField(default=False)
    delivery_error = models.TextField(blank=True)

    # Read tracking (for in-app)
    read_at = models.DateTimeField(null=True, blank=True)

    # Related object
    related_object_type = models.CharField(max_length=50, blank=True)
    related_object_id = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-sent_at']
        verbose_name = "Notification Log"
        verbose_name_plural = "Notification Logs"
        indexes = [
            models.Index(fields=['user', 'sent_at'], name='idx_notif_user_sent'),
            models.Index(fields=['notification_type', 'sent_at'], name='idx_notif_type_sent'),
        ]

    def __str__(self):
        return f"{self.notification_type} to {self.user.email if self.user else 'N/A'} at {self.sent_at}"

    def mark_read(self):
        """Mark notification as read."""
        if not self.read_at:
            self.read_at = timezone.now()
            self.save()
