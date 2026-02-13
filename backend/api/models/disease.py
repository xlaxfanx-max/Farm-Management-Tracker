from django.db import models
from django.utils import timezone


class ExternalDetection(models.Model):
    """
    Stores official disease detections from CDFA, USDA, or other authorities.
    Used for proximity alerting to warn growers of nearby threats.
    """

    SOURCE_CHOICES = [
        ('cdfa', 'California Dept of Food & Agriculture'),
        ('usda', 'USDA APHIS'),
        ('county_ag', 'County Agricultural Commissioner'),
        ('uc_anr', 'UC Agriculture & Natural Resources'),
        ('manual', 'Manual Entry'),
    ]

    DISEASE_TYPE_CHOICES = [
        ('hlb', 'Huanglongbing (Citrus Greening)'),
        ('acp', 'Asian Citrus Psyllid'),
        ('ctvd', 'Citrus Tristeza Virus'),
        ('cyvcv', 'Citrus Yellow Vein Clearing Virus'),
        ('canker', 'Citrus Canker'),
        ('phytophthora', 'Phytophthora Root Rot'),
        ('laurel_wilt', 'Laurel Wilt'),
        ('other', 'Other'),
    ]

    LOCATION_TYPE_CHOICES = [
        ('residential', 'Residential/Backyard'),
        ('commercial', 'Commercial Grove'),
        ('nursery', 'Nursery'),
        ('unknown', 'Unknown'),
    ]

    # Source tracking
    source = models.CharField(max_length=50, choices=SOURCE_CHOICES)
    source_id = models.CharField(max_length=100, blank=True)

    # Disease info
    disease_type = models.CharField(max_length=50, choices=DISEASE_TYPE_CHOICES)
    disease_name = models.CharField(max_length=200)

    # Location
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)
    county = models.CharField(max_length=100)
    city = models.CharField(max_length=100, blank=True)
    location_type = models.CharField(
        max_length=50,
        choices=LOCATION_TYPE_CHOICES,
        default='unknown'
    )

    # Dates
    detection_date = models.DateField()
    reported_date = models.DateField()
    fetched_at = models.DateTimeField(auto_now_add=True)

    # Status
    is_active = models.BooleanField(default=True)
    eradication_date = models.DateField(null=True, blank=True)

    # Metadata
    notes = models.TextField(blank=True)
    raw_data = models.JSONField(default=dict)

    class Meta:
        ordering = ['-detection_date']
        verbose_name = "External Detection"
        verbose_name_plural = "External Detections"
        indexes = [
            models.Index(fields=['disease_type', 'is_active'], name='idx_extdet_disease_active'),
            models.Index(fields=['latitude', 'longitude'], name='idx_extdet_coords'),
            models.Index(fields=['county'], name='idx_extdet_county'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['source', 'source_id'],
                name='unique_external_detection_source',
                condition=models.Q(source_id__gt=''),
            ),
        ]

    def __str__(self):
        return f"{self.disease_name} - {self.county} ({self.detection_date})"


class QuarantineZone(models.Model):
    """
    CDFA quarantine boundary polygons.

    Stores geographic boundaries of quarantine zones for HLB, ACP, and other
    diseases/pests. Used for visualization on threat maps and compliance checking.
    """

    ZONE_TYPE_CHOICES = [
        ('hlb', 'HLB Quarantine'),
        ('acp', 'ACP Quarantine'),
        ('eradication', 'Eradication Area'),
        ('buffer', 'Buffer Zone'),
        ('other', 'Other'),
    ]

    zone_type = models.CharField(max_length=50, choices=ZONE_TYPE_CHOICES)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # GeoJSON Polygon boundary
    boundary = models.JSONField(
        help_text="GeoJSON Polygon geometry for the quarantine boundary"
    )

    # Source tracking
    source = models.CharField(max_length=100, default='cdfa')
    source_url = models.URLField(blank=True)
    source_id = models.CharField(max_length=100, blank=True)

    # Dates
    established_date = models.DateField()
    last_updated = models.DateField(auto_now=True)
    expires_date = models.DateField(null=True, blank=True)

    # Status
    is_active = models.BooleanField(default=True)

    # Geographic info
    county = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=50, default='California')

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-established_date']
        verbose_name = "Quarantine Zone"
        verbose_name_plural = "Quarantine Zones"
        indexes = [
            models.Index(fields=['zone_type', 'is_active'], name='idx_qzone_type_active'),
            models.Index(fields=['county'], name='idx_qzone_county'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['source', 'source_id'],
                name='unique_quarantine_zone_source',
                condition=models.Q(source_id__gt=''),
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.zone_type.upper()})"


class DiseaseAlertRule(models.Model):
    """
    Configurable rules for generating disease alerts.
    Allows per-company customization of alert thresholds.
    """

    RULE_TYPE_CHOICES = [
        ('proximity', 'Proximity Alert'),
        ('ndvi_threshold', 'NDVI Threshold'),
        ('ndvi_change', 'NDVI Change Rate'),
        ('canopy_loss', 'Canopy Loss'),
        ('tree_count_change', 'Tree Count Change'),
        ('regional_trend', 'Regional Trend'),
    ]

    PRIORITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='disease_alert_rules'
    )

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    rule_type = models.CharField(max_length=50, choices=RULE_TYPE_CHOICES)
    conditions = models.JSONField(default=dict)
    alert_priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES)

    send_email = models.BooleanField(default=True)
    send_sms = models.BooleanField(default=False)
    send_immediately = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_disease_rules'
    )

    class Meta:
        ordering = ['name']
        verbose_name = "Disease Alert Rule"
        verbose_name_plural = "Disease Alert Rules"

    def __str__(self):
        return f"{self.name} ({self.get_rule_type_display()})"


class DiseaseAnalysisRun(models.Model):
    """
    Tracks a disease/health analysis run for a field.
    Parallel to TreeDetectionRun but focused on health trends.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    ANALYSIS_TYPE_CHOICES = [
        ('ndvi_trend', 'NDVI Trend Analysis'),
        ('anomaly_detection', 'Anomaly Detection'),
        ('full', 'Full Health Analysis'),
    ]

    RISK_LEVEL_CHOICES = [
        ('low', 'Low'),
        ('moderate', 'Moderate'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='disease_analyses'
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='disease_analyses'
    )

    # Processing status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True)

    # Analysis parameters
    analysis_type = models.CharField(
        max_length=50,
        choices=ANALYSIS_TYPE_CHOICES,
        default='full'
    )
    parameters = models.JSONField(default=dict)

    # Results - Field Level
    avg_ndvi = models.DecimalField(max_digits=4, decimal_places=3, null=True)
    ndvi_change_30d = models.DecimalField(max_digits=5, decimal_places=3, null=True)
    ndvi_change_90d = models.DecimalField(max_digits=5, decimal_places=3, null=True)
    canopy_coverage_percent = models.DecimalField(max_digits=5, decimal_places=2, null=True)
    canopy_change_30d = models.DecimalField(max_digits=5, decimal_places=2, null=True)

    # Results - Tree Level Aggregates
    total_trees_analyzed = models.IntegerField(default=0)
    trees_healthy = models.IntegerField(default=0)
    trees_mild_stress = models.IntegerField(default=0)
    trees_moderate_stress = models.IntegerField(default=0)
    trees_severe_stress = models.IntegerField(default=0)
    trees_declining = models.IntegerField(default=0)

    # Risk Assessment
    health_score = models.IntegerField(null=True)
    risk_level = models.CharField(
        max_length=20,
        choices=RISK_LEVEL_CHOICES,
        null=True,
        blank=True
    )
    risk_factors = models.JSONField(default=list)

    # Anomaly Detection
    anomaly_zones = models.JSONField(default=list)
    anomaly_count = models.IntegerField(default=0)

    # Recommendations
    recommendations = models.JSONField(default=list)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True)

    # Review
    reviewed_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_disease_analyses'
    )
    review_notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Disease Analysis Run"
        verbose_name_plural = "Disease Analysis Runs"
        indexes = [
            models.Index(fields=['company', 'status'], name='idx_disanalysis_co_status'),
            models.Index(fields=['field', '-created_at'], name='idx_disanalysis_field_date'),
        ]

    def __str__(self):
        return f"{self.field.name} - {self.created_at.strftime('%Y-%m-%d')} ({self.status})"


class DiseaseAlert(models.Model):
    """
    Disease-specific alerts for users.
    Follows ComplianceAlert pattern but with disease-specific fields.
    """

    ALERT_TYPE_CHOICES = [
        ('proximity_hlb', 'HLB Detected Nearby'),
        ('proximity_acp', 'ACP Activity Nearby'),
        ('proximity_other', 'Other Disease Nearby'),
        ('ndvi_anomaly', 'NDVI Anomaly Detected'),
        ('tree_decline', 'Tree Decline Detected'),
        ('canopy_loss', 'Canopy Loss Detected'),
        ('regional_trend', 'Regional Health Trend'),
        ('scouting_verified', 'Verified Scouting Report'),
    ]

    PRIORITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='disease_alerts'
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='disease_alerts'
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='disease_alerts'
    )

    alert_type = models.CharField(max_length=50, choices=ALERT_TYPE_CHOICES)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()

    # Context
    distance_miles = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    related_detection = models.ForeignKey(
        ExternalDetection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='alerts'
    )
    related_analysis = models.ForeignKey(
        DiseaseAnalysisRun,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='alerts'
    )

    # Actions
    recommended_actions = models.JSONField(default=list)
    action_url = models.CharField(max_length=500, blank=True)
    action_label = models.CharField(max_length=100, blank=True)

    # Status
    is_active = models.BooleanField(default=True)
    is_acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='acknowledged_disease_alerts'
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    # Notifications sent
    email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)
    sms_sent = models.BooleanField(default=False)
    sms_sent_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Disease Alert"
        verbose_name_plural = "Disease Alerts"
        indexes = [
            models.Index(fields=['company', 'is_active', 'priority'], name='idx_disalert_co_active_pri'),
            models.Index(fields=['alert_type', 'created_at'], name='idx_disalert_type_created'),
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


class ScoutingReport(models.Model):
    """
    User-submitted disease/pest observations for crowdsourced monitoring.
    """

    REPORT_TYPE_CHOICES = [
        ('disease_symptom', 'Disease Symptom'),
        ('pest_sighting', 'Pest Sighting'),
        ('tree_decline', 'Tree Decline'),
        ('tree_death', 'Tree Death'),
        ('acp_sighting', 'Asian Citrus Psyllid'),
        ('other', 'Other'),
    ]

    SEVERITY_CHOICES = [
        ('low', 'Low - Minor/Isolated'),
        ('medium', 'Medium - Several Trees'),
        ('high', 'High - Significant Area'),
    ]

    AI_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('skipped', 'Skipped'),
    ]

    STATUS_CHOICES = [
        ('submitted', 'Submitted'),
        ('under_review', 'Under Review'),
        ('verified', 'Verified'),
        ('false_alarm', 'False Alarm'),
        ('inconclusive', 'Inconclusive'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='scouting_reports'
    )
    reported_by = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='scouting_reports'
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='scouting_reports'
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='scouting_reports'
    )

    # Location
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)

    # Report details
    report_type = models.CharField(max_length=50, choices=REPORT_TYPE_CHOICES)
    symptoms = models.JSONField(default=dict)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES)
    affected_tree_count = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    # AI Analysis
    ai_analysis_status = models.CharField(
        max_length=20,
        choices=AI_STATUS_CHOICES,
        default='pending'
    )
    ai_diagnosis = models.JSONField(default=dict)

    # Verification
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    verified_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_scouting_reports'
    )
    verification_notes = models.TextField(blank=True)

    # Sharing
    share_anonymously = models.BooleanField(default=True)
    is_public = models.BooleanField(default=False)

    # Timestamps
    observed_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Scouting Report"
        verbose_name_plural = "Scouting Reports"
        indexes = [
            models.Index(fields=['farm', '-observed_date'], name='idx_scout_farm_date'),
            models.Index(fields=['field', '-observed_date'], name='idx_scout_field_date'),
        ]

    def __str__(self):
        return f"{self.get_report_type_display()} - {self.observed_date}"


class ScoutingPhoto(models.Model):
    """Photos attached to scouting reports."""

    report = models.ForeignKey(
        ScoutingReport,
        on_delete=models.CASCADE,
        related_name='photos'
    )
    image = models.ImageField(upload_to='scouting/%Y/%m/')
    caption = models.CharField(max_length=200, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Scouting Photo"
        verbose_name_plural = "Scouting Photos"

    def __str__(self):
        return f"Photo for {self.report}"


class TreeHealthRecord(models.Model):
    """
    Tracks health metrics for individual trees over time.
    Links DetectedTree records across multiple detection runs.
    """

    TREND_CHOICES = [
        ('improving', 'Improving'),
        ('stable', 'Stable'),
        ('declining', 'Declining'),
        ('rapid_decline', 'Rapid Decline'),
    ]

    HEALTH_STATUS_CHOICES = [
        ('healthy', 'Healthy'),
        ('mild_stress', 'Mild Stress'),
        ('moderate_stress', 'Moderate Stress'),
        ('severe_stress', 'Severe Stress'),
        ('dead', 'Dead/Removed'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='tree_health_records'
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='tree_health_records'
    )

    # Tree identification
    tree_id = models.CharField(max_length=50)
    latitude = models.DecimalField(max_digits=10, decimal_places=7)
    longitude = models.DecimalField(max_digits=10, decimal_places=7)

    # Current state
    current_ndvi = models.DecimalField(max_digits=4, decimal_places=3, null=True)
    current_canopy_diameter_m = models.DecimalField(max_digits=4, decimal_places=2, null=True)
    last_updated = models.DateTimeField(auto_now=True)

    # Trend data
    ndvi_history = models.JSONField(default=list)
    canopy_history = models.JSONField(default=list)
    ndvi_trend = models.CharField(max_length=20, choices=TREND_CHOICES, default='stable')

    # Health status
    health_status = models.CharField(
        max_length=20,
        choices=HEALTH_STATUS_CHOICES,
        default='healthy'
    )

    # Flags
    flagged_for_inspection = models.BooleanField(default=False)
    flag_reason = models.TextField(blank=True)
    inspected = models.BooleanField(default=False)
    inspection_date = models.DateField(null=True, blank=True)
    inspection_notes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Tree Health Record"
        verbose_name_plural = "Tree Health Records"
        constraints = [
            models.UniqueConstraint(
                fields=['field', 'tree_id'],
                name='unique_tree_health_field_treeid'
            ),
        ]
        indexes = [
            models.Index(fields=['field', 'health_status'], name='idx_treehealth_field_status'),
            models.Index(fields=['flagged_for_inspection'], name='idx_treehealth_flagged'),
        ]

    def __str__(self):
        return f"Tree {self.tree_id} - {self.field.name}"
