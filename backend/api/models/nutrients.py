from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal
from django.utils import timezone


# -----------------------------------------------------------------------------
# FERTILIZER PRODUCT CHOICES
# -----------------------------------------------------------------------------

FERTILIZER_FORM_CHOICES = [
    ('granular', 'Granular'),
    ('liquid', 'Liquid'),
    ('soluble', 'Water Soluble'),
    ('organic', 'Organic'),
    ('foliar', 'Foliar'),
    ('controlled_release', 'Controlled Release'),
    ('suspension', 'Suspension'),
]

NUTRIENT_RATE_UNIT_CHOICES = [
    ('lbs_acre', 'lbs/acre'),
    ('tons_acre', 'tons/acre'),
    ('gal_acre', 'gallons/acre'),
    ('oz_acre', 'oz/acre'),
    ('lbs_1000sqft', 'lbs/1000 sq ft'),
    ('units_acre', 'units/acre'),
    ('kg_ha', 'kg/ha'),
    ('L_ha', 'L/ha'),
]

NUTRIENT_APPLICATION_METHOD_CHOICES = [
    ('broadcast', 'Broadcast'),
    ('banded', 'Banded'),
    ('foliar', 'Foliar Spray'),
    ('fertigation', 'Fertigation'),
    ('injection', 'Soil Injection'),
    ('sidedress', 'Sidedress'),
    ('topdress', 'Topdress'),
    ('incorporated', 'Pre-plant Incorporated'),
    ('drip', 'Drip/Micro-irrigation'),
    ('aerial', 'Aerial Application'),
]


class FertilizerProduct(models.Model):
    """
    Reference table for fertilizer products.
    Parallel to PesticideProduct for consistency.
    """

    # === IDENTIFICATION ===
    name = models.CharField(max_length=200, help_text="Product name")
    manufacturer = models.CharField(max_length=100, blank=True)
    product_code = models.CharField(max_length=50, blank=True)

    # === NPK ANALYSIS ===
    nitrogen_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name="Nitrogen (N) %"
    )
    phosphorus_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name="Phosphate (P2O5) %"
    )
    potassium_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        validators=[MinValueValidator(Decimal('0'))],
        verbose_name="Potash (K2O) %"
    )

    # === NITROGEN BREAKDOWN ===
    nitrate_nitrogen_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    ammoniacal_nitrogen_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    urea_nitrogen_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    slow_release_nitrogen_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    # === SECONDARY & MICRONUTRIENTS ===
    calcium_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    magnesium_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    sulfur_pct = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    iron_pct = models.DecimalField(max_digits=5, decimal_places=3, null=True, blank=True)
    zinc_pct = models.DecimalField(max_digits=5, decimal_places=3, null=True, blank=True)
    manganese_pct = models.DecimalField(max_digits=5, decimal_places=3, null=True, blank=True)
    boron_pct = models.DecimalField(max_digits=5, decimal_places=3, null=True, blank=True)

    # === PRODUCT CHARACTERISTICS ===
    form = models.CharField(max_length=20, choices=FERTILIZER_FORM_CHOICES, default='granular')
    density_lbs_per_gallon = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)

    # === CERTIFICATIONS ===
    is_organic = models.BooleanField(default=False)
    omri_listed = models.BooleanField(default=False)
    cdfa_organic_registered = models.BooleanField(default=False)

    # === STATUS ===
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    company = models.ForeignKey('Company', on_delete=models.CASCADE, null=True, blank=True, related_name='fertilizer_products')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = "Fertilizer Product"
        verbose_name_plural = "Fertilizer Products"
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['nitrogen_pct']),
            models.Index(fields=['active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.npk_display})"

    @property
    def npk_display(self):
        n = int(self.nitrogen_pct) if self.nitrogen_pct == int(self.nitrogen_pct) else float(self.nitrogen_pct)
        p = int(self.phosphorus_pct) if self.phosphorus_pct == int(self.phosphorus_pct) else float(self.phosphorus_pct)
        k = int(self.potassium_pct) if self.potassium_pct == int(self.potassium_pct) else float(self.potassium_pct)
        return f"{n}-{p}-{k}"

    @property
    def lbs_n_per_100lbs(self):
        return float(self.nitrogen_pct)

    @property
    def is_nitrogen_source(self):
        return self.nitrogen_pct > 0 and self.nitrogen_pct >= self.phosphorus_pct and self.nitrogen_pct >= self.potassium_pct


class NutrientApplication(models.Model):
    """
    Records a fertilizer/nutrient application to a specific field.
    Nitrogen calculations are auto-computed on save.
    """

    # === RELATIONSHIPS ===
    field = models.ForeignKey('Field', on_delete=models.CASCADE, related_name='nutrient_applications')
    product = models.ForeignKey('FertilizerProduct', on_delete=models.PROTECT, related_name='applications')
    water_source = models.ForeignKey('WaterSource', on_delete=models.SET_NULL, null=True, blank=True, related_name='nutrient_applications')

    # === APPLICATION DETAILS ===
    application_date = models.DateField()
    rate = models.DecimalField(max_digits=10, decimal_places=3, validators=[MinValueValidator(Decimal('0.001'))])
    rate_unit = models.CharField(max_length=20, choices=NUTRIENT_RATE_UNIT_CHOICES, default='lbs_acre')
    acres_treated = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    # === CALCULATED VALUES (auto-populated) ===
    rate_lbs_per_acre = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_product_applied = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    lbs_nitrogen_per_acre = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    total_lbs_nitrogen = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    lbs_phosphorus_per_acre = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    lbs_potassium_per_acre = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    # === METHOD ===
    application_method = models.CharField(max_length=20, choices=NUTRIENT_APPLICATION_METHOD_CHOICES, default='broadcast')

    # === APPLICATOR ===
    applied_by = models.CharField(max_length=100, blank=True)
    custom_applicator = models.BooleanField(default=False)
    applicator_company = models.CharField(max_length=100, blank=True)

    # === COST TRACKING ===
    cost_per_unit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cost_unit = models.CharField(max_length=20, blank=True)
    total_product_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    application_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # === METADATA ===
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True, related_name='nutrient_applications_created')

    class Meta:
        ordering = ['-application_date', '-created_at']
        verbose_name = "Nutrient Application"
        verbose_name_plural = "Nutrient Applications"
        indexes = [
            models.Index(fields=['application_date']),
            models.Index(fields=['field', 'application_date']),
        ]

    def __str__(self):
        return f"{self.product.name} on {self.field.name} ({self.application_date})"

    @property
    def effective_acres(self):
        return self.acres_treated or (self.field.total_acres if self.field else Decimal('0'))

    @property
    def farm(self):
        return self.field.farm if self.field else None

    def _convert_rate_to_lbs_acre(self):
        rate = Decimal(str(self.rate))
        if self.rate_unit == 'lbs_acre':
            return rate
        elif self.rate_unit == 'tons_acre':
            return rate * Decimal('2000')
        elif self.rate_unit == 'gal_acre':
            density = self.product.density_lbs_per_gallon or Decimal('10')
            return rate * density
        elif self.rate_unit == 'oz_acre':
            return rate / Decimal('16')
        elif self.rate_unit == 'lbs_1000sqft':
            return rate * Decimal('43.56')
        elif self.rate_unit == 'kg_ha':
            return rate * Decimal('0.892179')
        elif self.rate_unit == 'L_ha':
            gal_acre = rate * Decimal('0.106907')
            density = self.product.density_lbs_per_gallon or Decimal('10')
            return gal_acre * density
        return rate

    def calculate_nutrients(self):
        if not self.product or not self.rate:
            return

        self.rate_lbs_per_acre = self._convert_rate_to_lbs_acre()
        acres = Decimal(str(self.effective_acres or 0))
        self.total_product_applied = self.rate_lbs_per_acre * acres

        n_pct = Decimal(str(self.product.nitrogen_pct or 0)) / Decimal('100')
        p_pct = Decimal(str(self.product.phosphorus_pct or 0)) / Decimal('100')
        k_pct = Decimal(str(self.product.potassium_pct or 0)) / Decimal('100')

        self.lbs_nitrogen_per_acre = self.rate_lbs_per_acre * n_pct
        self.lbs_phosphorus_per_acre = self.rate_lbs_per_acre * p_pct
        self.lbs_potassium_per_acre = self.rate_lbs_per_acre * k_pct
        self.total_lbs_nitrogen = self.lbs_nitrogen_per_acre * acres

        if self.total_product_cost and self.application_cost:
            self.total_cost = self.total_product_cost + self.application_cost
        elif self.total_product_cost:
            self.total_cost = self.total_product_cost
        elif self.application_cost:
            self.total_cost = self.application_cost

    def save(self, *args, **kwargs):
        self.calculate_nutrients()
        super().save(*args, **kwargs)


class NutrientPlan(models.Model):
    """
    Annual nitrogen management plan for a field.
    Required by some coalitions for ILRP compliance.
    """

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('completed', 'Completed'),
    ]

    field = models.ForeignKey('Field', on_delete=models.CASCADE, related_name='nutrient_plans')
    year = models.IntegerField()

    # Crop info
    crop = models.CharField(max_length=100)
    expected_yield = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    yield_unit = models.CharField(max_length=30, blank=True)

    # Nitrogen budget
    planned_nitrogen_lbs_acre = models.DecimalField(max_digits=8, decimal_places=2)
    soil_nitrogen_credit = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    irrigation_water_nitrogen = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    organic_matter_credit = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    # Coalition info
    coalition_name = models.CharField(max_length=100, blank=True)
    coalition_member_id = models.CharField(max_length=50, blank=True)

    notes = models.TextField(blank=True)
    prepared_by = models.CharField(max_length=100, blank=True)
    prepared_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['field', 'year']
        ordering = ['-year', 'field__name']
        verbose_name = "Nutrient Plan"
        verbose_name_plural = "Nutrient Plans"

    def __str__(self):
        return f"{self.field.name} - {self.year} N Plan"

    @property
    def total_n_credits(self):
        return (self.soil_nitrogen_credit or Decimal('0')) + \
               (self.irrigation_water_nitrogen or Decimal('0')) + \
               (self.organic_matter_credit or Decimal('0'))

    @property
    def net_planned_nitrogen(self):
        return (self.planned_nitrogen_lbs_acre or Decimal('0')) - self.total_n_credits

    @property
    def actual_nitrogen_applied_per_acre(self):
        from django.db.models import Sum
        result = self.field.nutrient_applications.filter(
            application_date__year=self.year
        ).aggregate(total_n=Sum('lbs_nitrogen_per_acre'))
        return result['total_n'] or Decimal('0')

    @property
    def actual_nitrogen_applied_total(self):
        from django.db.models import Sum
        result = self.field.nutrient_applications.filter(
            application_date__year=self.year
        ).aggregate(total_n=Sum('total_lbs_nitrogen'))
        return result['total_n'] or Decimal('0')

    @property
    def nitrogen_variance_per_acre(self):
        return self.actual_nitrogen_applied_per_acre - self.net_planned_nitrogen

    @property
    def percent_of_plan_applied(self):
        if not self.net_planned_nitrogen or self.net_planned_nitrogen == 0:
            return Decimal('0')
        return (self.actual_nitrogen_applied_per_acre / self.net_planned_nitrogen) * 100

    @property
    def application_count(self):
        return self.field.nutrient_applications.filter(application_date__year=self.year).count()


# Helper function for seeding
def get_common_fertilizers():
    """Returns common fertilizer products for California citrus."""
    return [
        {'name': 'UN-32 (Urea Ammonium Nitrate)', 'nitrogen_pct': 32, 'phosphorus_pct': 0, 'potassium_pct': 0, 'form': 'liquid', 'density_lbs_per_gallon': Decimal('11.06')},
        {'name': 'CAN-17 (Calcium Ammonium Nitrate)', 'nitrogen_pct': 17, 'phosphorus_pct': 0, 'potassium_pct': 0, 'form': 'liquid', 'density_lbs_per_gallon': Decimal('12.2'), 'calcium_pct': Decimal('8.8')},
        {'name': 'Urea (46-0-0)', 'nitrogen_pct': 46, 'phosphorus_pct': 0, 'potassium_pct': 0, 'form': 'granular'},
        {'name': 'Ammonium Sulfate (21-0-0)', 'nitrogen_pct': 21, 'phosphorus_pct': 0, 'potassium_pct': 0, 'form': 'granular', 'sulfur_pct': Decimal('24')},
        {'name': 'Calcium Nitrate (15.5-0-0)', 'nitrogen_pct': Decimal('15.5'), 'phosphorus_pct': 0, 'potassium_pct': 0, 'form': 'granular', 'calcium_pct': Decimal('19')},
        {'name': 'Triple 15 (15-15-15)', 'nitrogen_pct': 15, 'phosphorus_pct': 15, 'potassium_pct': 15, 'form': 'granular'},
        {'name': 'Triple 16 (16-16-16)', 'nitrogen_pct': 16, 'phosphorus_pct': 16, 'potassium_pct': 16, 'form': 'granular'},
        {'name': 'Citrus & Avocado Food (10-6-4)', 'nitrogen_pct': 10, 'phosphorus_pct': 6, 'potassium_pct': 4, 'form': 'granular'},
        {'name': 'Potassium Sulfate (0-0-50)', 'nitrogen_pct': 0, 'phosphorus_pct': 0, 'potassium_pct': 50, 'form': 'granular', 'sulfur_pct': Decimal('17')},
        {'name': 'Blood Meal (12-0-0)', 'nitrogen_pct': 12, 'phosphorus_pct': 0, 'potassium_pct': 0, 'form': 'organic', 'is_organic': True, 'omri_listed': True},
    ]


# =============================================================================
# WEATHER CACHE MODEL
# =============================================================================

class WeatherCache(models.Model):
    """
    Cache weather data to minimize API calls to OpenWeatherMap.
    Each farm gets its own cached weather data based on GPS coordinates.
    """
    farm = models.OneToOneField(
        'Farm',
        on_delete=models.CASCADE,
        related_name='weather_cache'
    )
    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        help_text="Cached latitude for weather lookup"
    )
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        help_text="Cached longitude for weather lookup"
    )
    weather_data = models.JSONField(
        default=dict,
        help_text="Current weather data from API"
    )
    forecast_data = models.JSONField(
        default=dict,
        null=True,
        blank=True,
        help_text="7-day forecast data from API"
    )
    fetched_at = models.DateTimeField(
        auto_now=True,
        help_text="When weather data was last fetched"
    )

    class Meta:
        verbose_name = "Weather Cache"
        verbose_name_plural = "Weather Caches"

    def __str__(self):
        return f"Weather for {self.farm.name}"

    @property
    def is_current_stale(self):
        """Check if current weather data is older than 30 minutes."""
        from datetime import timedelta
        return timezone.now() - self.fetched_at > timedelta(minutes=30)

    @property
    def is_forecast_stale(self):
        """Check if forecast data is older than 3 hours."""
        from datetime import timedelta
        return timezone.now() - self.fetched_at > timedelta(hours=3)
