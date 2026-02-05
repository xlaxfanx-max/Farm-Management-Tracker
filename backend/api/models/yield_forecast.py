from django.db import models
from django.utils import timezone
from decimal import Decimal


# =============================================================================
# YIELD FORECAST MODELS
# =============================================================================

class ExternalDataSource(models.Model):
    """Tracks external data integrations and their sync status."""
    SOURCE_TYPE_CHOICES = [
        ('ssurgo', 'SSURGO Soil Survey'),
        ('cimis', 'CIMIS Weather'),
        ('openweather', 'OpenWeatherMap'),
        ('satellite_ndvi', 'Satellite NDVI'),
        ('prism', 'PRISM Climate'),
        ('usda_nass', 'USDA NASS'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('syncing', 'Syncing'),
        ('success', 'Success'),
        ('error', 'Error'),
    ]

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='external_data_sources'
    )
    source_type = models.CharField(max_length=30, choices=SOURCE_TYPE_CHOICES)
    name = models.CharField(max_length=200, help_text="Human-readable name for this integration")
    api_endpoint = models.URLField(blank=True, help_text="API base URL")
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_sync_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    last_sync_error = models.TextField(blank=True)
    records_synced = models.IntegerField(default=0)
    config = models.JSONField(default=dict, blank=True, help_text="Source-specific configuration")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "External Data Source"
        verbose_name_plural = "External Data Sources"
        unique_together = [['company', 'source_type']]
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.get_source_type_display()} - {self.company.name}"


class SoilSurveyData(models.Model):
    """Cached SSURGO soil properties per field, fetched from USDA Web Soil Survey API."""
    field = models.OneToOneField(
        'Field',
        on_delete=models.CASCADE,
        related_name='soil_survey'
    )
    # SSURGO identifiers
    mukey = models.CharField(max_length=30, blank=True, help_text="Map Unit Key from SSURGO")
    musym = models.CharField(max_length=10, blank=True, help_text="Map Unit Symbol")
    muname = models.CharField(max_length=200, blank=True, help_text="Map Unit Name")

    # Soil properties (dominant component)
    texture_class = models.CharField(max_length=50, blank=True, help_text="USDA texture class (e.g., 'Sandy Loam')")
    clay_pct = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True, help_text="Clay percentage")
    sand_pct = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True, help_text="Sand percentage")
    silt_pct = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True, help_text="Silt percentage")
    organic_matter_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    ph = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True, help_text="Soil pH (1:1 water)")
    cec = models.DecimalField(
        max_digits=6, decimal_places=1, null=True, blank=True,
        help_text="Cation Exchange Capacity (meq/100g)"
    )
    available_water_capacity = models.DecimalField(
        max_digits=5, decimal_places=3, null=True, blank=True,
        help_text="Available water capacity (inches per inch of soil)"
    )
    drainage_class = models.CharField(max_length=50, blank=True, help_text="e.g., 'Well drained'")
    depth_to_restrictive_layer_cm = models.IntegerField(null=True, blank=True)
    ksat = models.DecimalField(
        max_digits=8, decimal_places=3, null=True, blank=True,
        help_text="Saturated hydraulic conductivity (um/s)"
    )

    # Metadata
    fetched_at = models.DateTimeField(auto_now=True)
    raw_response = models.JSONField(default=dict, blank=True, help_text="Full SSURGO API response")

    class Meta:
        verbose_name = "Soil Survey Data"
        verbose_name_plural = "Soil Survey Data"

    def __str__(self):
        return f"Soil: {self.field.name} - {self.muname}"


class YieldFeatureSnapshot(models.Model):
    """
    Computed features at a point in time for a field/season.
    Assembled by the YieldFeatureEngine and used as inputs to the forecast model.
    All feature fields are nullable to support graceful degradation when data is missing.
    """
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='yield_feature_snapshots'
    )
    season_label = models.CharField(max_length=20, help_text="e.g., '2025-2026'")
    snapshot_date = models.DateField(help_text="Date features were computed")

    # --- Climate features (from ClimateFeatureService) ---
    gdd_cumulative = models.DecimalField(
        max_digits=8, decimal_places=1, null=True, blank=True,
        help_text="Growing Degree Days accumulated since season start"
    )
    gdd_base_temp_f = models.DecimalField(
        max_digits=5, decimal_places=1, default=55.0,
        help_text="GDD base temperature (Fahrenheit)"
    )
    chill_hours_cumulative = models.DecimalField(
        max_digits=7, decimal_places=1, null=True, blank=True,
        help_text="Chill hours (Utah model) accumulated Nov 1 - Mar 1"
    )
    chill_portions = models.DecimalField(
        max_digits=6, decimal_places=1, null=True, blank=True,
        help_text="Chill portions (Dynamic model)"
    )
    precipitation_cumulative_in = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True,
        help_text="Cumulative precipitation (inches) since season start"
    )
    heat_stress_days = models.IntegerField(
        null=True, blank=True,
        help_text="Days with max temp > 105F since bloom"
    )
    frost_events = models.IntegerField(
        null=True, blank=True,
        help_text="Days with min temp < 32F during critical period"
    )
    eto_cumulative_in = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True,
        help_text="Cumulative reference ET (inches) since season start"
    )

    # --- Vegetation / remote sensing features ---
    ndvi_mean = models.DecimalField(
        max_digits=4, decimal_places=3, null=True, blank=True,
        help_text="Mean NDVI across field from latest satellite detection"
    )
    ndvi_trend = models.DecimalField(
        max_digits=5, decimal_places=4, null=True, blank=True,
        help_text="NDVI slope over last 3 months (positive = greening)"
    )
    canopy_coverage_pct = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Canopy coverage percentage"
    )
    tree_height_avg_m = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text="Average tree height from LiDAR (meters)"
    )

    # --- Alternate bearing features ---
    alternate_bearing_index = models.DecimalField(
        max_digits=4, decimal_places=3, null=True, blank=True,
        help_text="Alternate bearing index (-1 to 1; positive = expecting ON year)"
    )
    prior_season_yield_per_acre = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Previous season yield/acre for bearing pattern analysis"
    )

    # --- Field characteristics (denormalized for model input) ---
    tree_age_years = models.IntegerField(null=True, blank=True)
    trees_per_acre = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    irrigation_type = models.CharField(max_length=20, blank=True)
    soil_type = models.CharField(max_length=30, blank=True)
    rootstock_vigor = models.CharField(max_length=20, blank=True)
    organic_status = models.CharField(max_length=20, blank=True)

    # --- Soil survey features (denormalized from SoilSurveyData) ---
    soil_awc = models.DecimalField(
        max_digits=5, decimal_places=3, null=True, blank=True,
        help_text="Available water capacity from SSURGO"
    )
    soil_clay_pct = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    soil_ph = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)

    # --- Management inputs ---
    irrigation_applied_in = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True,
        help_text="Cumulative irrigation applied (inches) since season start"
    )
    total_nitrogen_lbs_per_acre = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True,
        help_text="Cumulative N applied this season (lbs/acre)"
    )

    # --- Full feature vector + data quality ---
    feature_vector = models.JSONField(
        default=dict, blank=True,
        help_text="Complete feature dict for model consumption"
    )
    data_quality = models.JSONField(
        default=dict, blank=True,
        help_text="Per-feature availability tracking and completeness_pct"
    )
    warnings = models.JSONField(
        default=list, blank=True,
        help_text="Human-readable data quality warnings"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Yield Feature Snapshot"
        verbose_name_plural = "Yield Feature Snapshots"
        ordering = ['-snapshot_date']
        indexes = [
            models.Index(fields=['field', 'season_label', 'snapshot_date']),
        ]
        unique_together = [['field', 'season_label', 'snapshot_date']]

    def __str__(self):
        return f"Features: {self.field.name} {self.season_label} @ {self.snapshot_date}"


class YieldForecast(models.Model):
    """
    Yield forecast results per field per season.
    Includes confidence intervals, methodology, and actual vs predicted tracking.
    """
    FORECAST_METHOD_CHOICES = [
        ('historical_avg', 'Historical Average'),
        ('climate_adjusted', 'Climate-Adjusted Historical'),
        ('bearing_adjusted', 'Bearing-Adjusted (no climate)'),
        ('crop_baseline', 'Crop Baseline (insufficient field data)'),
        ('regression', 'Linear Regression'),
        ('ml_ensemble', 'ML Ensemble'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('superseded', 'Superseded'),
    ]
    UNIT_CHOICES = [
        ('bins', 'Bins'),
        ('lbs', 'Pounds'),
        ('tons', 'Tons'),
        ('cartons', 'Cartons'),
    ]

    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='yield_forecasts'
    )
    season_label = models.CharField(max_length=20, help_text="e.g., '2025-2026'")
    forecast_date = models.DateField(help_text="Date the forecast was generated")

    # Forecast values
    predicted_yield_per_acre = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Point estimate yield per acre"
    )
    predicted_total_yield = models.DecimalField(
        max_digits=12, decimal_places=2,
        help_text="Total field yield = yield_per_acre * harvestable_acres"
    )
    yield_unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default='bins')
    harvestable_acres = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Acres used for total yield calculation"
    )

    # Confidence interval
    confidence_level = models.DecimalField(
        max_digits=4, decimal_places=2, default=0.80,
        help_text="Confidence level (e.g., 0.80 for 80%)"
    )
    lower_bound_per_acre = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Lower bound of confidence interval (yield/acre)"
    )
    upper_bound_per_acre = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Upper bound of confidence interval (yield/acre)"
    )

    # Methodology
    forecast_method = models.CharField(
        max_length=30, choices=FORECAST_METHOD_CHOICES, default='historical_avg'
    )
    model_version = models.CharField(max_length=50, blank=True, help_text="Model version identifier")
    feature_snapshot = models.ForeignKey(
        YieldFeatureSnapshot,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='forecasts',
        help_text="Feature snapshot used to generate this forecast"
    )

    # Feature importance and adjustments
    feature_importance = models.JSONField(
        default=dict, blank=True,
        help_text="Dict of feature_name -> importance_score"
    )
    climate_adjustment_factor = models.DecimalField(
        max_digits=5, decimal_places=3, null=True, blank=True,
        help_text="Multiplier applied for climate conditions (1.0 = normal)"
    )
    data_completeness_pct = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True,
        help_text="Percentage of possible features that had data"
    )
    degradation_warnings = models.JSONField(
        default=list, blank=True,
        help_text="Warnings about missing data that affected the forecast"
    )

    # Comparison to actual (populated after harvest)
    actual_yield_per_acre = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    actual_total_yield = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    forecast_error_pct = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Absolute % error = |actual - predicted| / actual * 100"
    )

    # Status and notes
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    notes = models.TextField(blank=True, help_text="Manual notes or adjustments")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='yield_forecasts_created'
    )

    class Meta:
        verbose_name = "Yield Forecast"
        verbose_name_plural = "Yield Forecasts"
        ordering = ['-forecast_date', '-created_at']
        indexes = [
            models.Index(fields=['field', 'season_label', '-forecast_date']),
            models.Index(fields=['status', 'season_label']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['field', 'season_label', 'forecast_date', 'status'],
                condition=models.Q(status='published'),
                name='unique_published_forecast_per_field_season_date',
            ),
        ]

    def __str__(self):
        return f"Forecast: {self.field.name} {self.season_label} - {self.predicted_yield_per_acre} {self.yield_unit}/acre"
