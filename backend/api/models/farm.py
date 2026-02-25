from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from decimal import Decimal

from .base import LocationMixin


# =============================================================================
# FARM & PARCEL MODELS
# =============================================================================

class Farm(LocationMixin, models.Model):
    """
    Farm/Ranch information.
    Inherits GPS/PLSS fields from LocationMixin.
    """
    name = models.CharField(max_length=200)
    farm_number = models.CharField(max_length=50, blank=True, help_text="Internal farm ID or permit number")

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='farms',
        null=True,
        blank=True
    )

    # Owner/Operator information
    owner_name = models.CharField(max_length=200, blank=True)
    operator_name = models.CharField(max_length=200, blank=True)

    # Primary location
    address = models.TextField(blank=True)
    county = models.CharField(max_length=100)

    # NOTE: GPS fields (gps_latitude, gps_longitude) and PLSS fields
    # (plss_section, plss_township, plss_range, plss_meridian)
    # are inherited from LocationMixin

    # Contact info
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)

    # FSMA Environmental Factors
    nearest_animal_operation_ft = models.IntegerField(
        null=True,
        blank=True,
        help_text="Distance to nearest animal operation in feet"
    )
    adjacent_land_uses = models.JSONField(
        default=list,
        blank=True,
        help_text="List of adjacent/nearby land uses for FSMA assessment"
    )
    flooding_history = models.BooleanField(
        default=False,
        help_text="Has this farm experienced flooding in production areas?"
    )
    septic_nearby = models.BooleanField(
        null=True,
        blank=True,
        help_text="Are septic systems located near production areas?"
    )

    # Boundary
    boundary_geojson = models.JSONField(
        null=True,
        blank=True,
        verbose_name="Boundary GeoJSON",
        help_text="Farm boundary polygon in GeoJSON format"
    )
    calculated_acres = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Calculated Acres",
        help_text="Acreage calculated from drawn boundary"
    )

    # Status
    active = models.BooleanField(default=True)

    # CIMIS station mapping for climate data
    cimis_station_id = models.CharField(
        max_length=20,
        blank=True,
        help_text="Nearest CIMIS weather station ID (e.g., '152' for Oxnard). Used for yield forecast climate features."
    )

    # PUR site mapping
    pur_site_id = models.CharField(
        max_length=100, blank=True,
        help_text="Ag Commissioner site ID for PUR matching, e.g., 'FINCH FARMS, LLC 02C'"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def apn_list(self):
        """Returns a comma-separated string of all APNs."""
        return ', '.join(self.parcels.values_list('apn', flat=True))

    @property
    def total_parcel_acreage(self):
        """Sum of all parcel acreages."""
        result = self.parcels.aggregate(total=models.Sum('acreage'))
        return result['total'] or Decimal('0')

    @property
    def parcel_count(self):
        """Number of parcels."""
        return self.parcels.count()

class FarmParcel(models.Model):
    """
    Assessor Parcel Numbers (APNs) associated with a farm.
    A farm can span multiple parcels, each with its own APN.
    """
    farm = models.ForeignKey(
        Farm,
        on_delete=models.CASCADE,
        related_name='parcels'
    )
    apn = models.CharField(
        max_length=50,
        verbose_name="Assessor Parcel Number",
        help_text="County assessor parcel number (e.g., 123-0-456-789)"
    )
    acreage = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Acreage of this parcel"
    )
    ownership_type = models.CharField(
        max_length=20,
        choices=[
            ('owned', 'Owned'),
            ('leased', 'Leased'),
            ('managed', 'Managed'),
        ],
        default='owned'
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Farm Parcel"
        verbose_name_plural = "Farm Parcels"
        unique_together = ['farm', 'apn']
        ordering = ['apn']

    def __str__(self):
        return f"{self.farm.name} - APN: {self.apn}"

    @staticmethod
    def format_apn(apn_string, county=None):
        """Format APN based on county conventions."""
        if not apn_string:
            return ''
        digits = ''.join(filter(str.isdigit, apn_string))

        # Ventura County: XXX-X-XXX-XXX (10 digits)
        if county and county.lower() == 'ventura' and len(digits) == 10:
            return f"{digits[:3]}-{digits[3]}-{digits[4:7]}-{digits[7:]}"

        # Standard CA: XXX-XXX-XXX (9 digits)
        if len(digits) == 9:
            return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"

        return apn_string

# =============================================================================
# CROP AND ROOTSTOCK REFERENCE MODELS
# =============================================================================

class CropCategory(models.TextChoices):
    """Categories for organizing crops."""
    CITRUS = 'citrus', 'Citrus'
    DECIDUOUS_FRUIT = 'deciduous_fruit', 'Deciduous Fruit'
    SUBTROPICAL = 'subtropical', 'Subtropical'
    VINE = 'vine', 'Vine'
    ROW_CROP = 'row_crop', 'Row Crop'
    VEGETABLE = 'vegetable', 'Vegetable'
    NUT = 'nut', 'Nut'
    BERRY = 'berry', 'Berry'
    OTHER = 'other', 'Other'


class CropType(models.TextChoices):
    """Plant type classification affecting field management."""
    TREE = 'tree', 'Tree'
    VINE = 'vine', 'Vine'
    BUSH = 'bush', 'Bush'
    ROW = 'row', 'Row Crop'
    PERENNIAL = 'perennial', 'Perennial'
    ANNUAL = 'annual', 'Annual'


class SeasonType(models.TextChoices):
    """Season type classifications determining how season dates are calculated."""
    CALENDAR_YEAR = 'calendar_year', 'Calendar Year (Jan-Dec)'
    CITRUS = 'citrus', 'Citrus Season (Oct-Sep)'
    AVOCADO = 'avocado', 'Avocado Season (Nov-Oct)'
    ALMOND = 'almond', 'Almond Season (Feb-Oct)'
    GRAPE = 'grape', 'Grape Season (Mar-Dec)'
    MULTIPLE_CYCLE = 'multiple_cycle', 'Multiple Cycles Per Year'
    CUSTOM = 'custom', 'Custom Date Range'


class SeasonTemplate(models.Model):
    """
    Season templates defining date calculation rules for different crop types.
    System-wide defaults (company=null) can be customized per company.

    Examples:
    - California Citrus: starts Oct 1, duration 12 months, crosses calendar year
    - Calendar Year: starts Jan 1, duration 12 months
    - Almond: starts Feb 1, duration 9 months (Feb-Oct harvest window)
    """

    name = models.CharField(
        max_length=100,
        help_text="Template name (e.g., 'California Citrus', 'Calendar Year')"
    )
    season_type = models.CharField(
        max_length=30,
        choices=SeasonType.choices,
        default=SeasonType.CALENDAR_YEAR,
        help_text="Season calculation type"
    )

    # Date calculation fields
    start_month = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(12)],
        help_text="Month season starts (1=January, 12=December)"
    )
    start_day = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        help_text="Day of month season starts"
    )
    duration_months = models.PositiveSmallIntegerField(
        default=12,
        validators=[MinValueValidator(1), MaxValueValidator(24)],
        help_text="Duration in months (typically 12)"
    )

    # Cross-year indicator
    crosses_calendar_year = models.BooleanField(
        default=False,
        help_text="True if season spans two calendar years (e.g., citrus Oct-Sep)"
    )

    # Label format for display
    label_format = models.CharField(
        max_length=50,
        default='{start_year}',
        help_text="Label format using {start_year} and/or {end_year} placeholders"
    )

    # Applicable crop categories (JSON list)
    applicable_categories = models.JSONField(
        default=list,
        blank=True,
        help_text="List of CropCategory values this template applies to (e.g., ['citrus', 'subtropical'])"
    )

    # Ownership - null for system defaults
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='season_templates',
        help_text="Null for system defaults, set for company-specific templates"
    )

    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = "Season Template"
        verbose_name_plural = "Season Templates"
        constraints = [
            models.UniqueConstraint(
                fields=['name', 'company'],
                name='unique_season_template_per_company'
            )
        ]
        indexes = [
            models.Index(fields=['company', 'active']),
            models.Index(fields=['season_type']),
        ]

    def __str__(self):
        company_str = f" ({self.company.name})" if self.company else " (System)"
        return f"{self.name}{company_str}"

    @classmethod
    def get_system_defaults(cls):
        """Get all system default season templates (company=null)."""
        return cls.objects.filter(company__isnull=True, active=True)

    @classmethod
    def get_for_category(cls, category: str, company=None):
        """
        Get the best matching template for a crop category.
        Priority: company-specific > system default > calendar year fallback.
        """
        # Try company-specific first
        if company:
            template = cls.objects.filter(
                company=company,
                applicable_categories__contains=[category],
                active=True
            ).first()
            if template:
                return template

        # Try system default for category
        template = cls.objects.filter(
            company__isnull=True,
            applicable_categories__contains=[category],
            active=True
        ).first()
        if template:
            return template

        # Fall back to calendar year
        return cls.objects.filter(
            company__isnull=True,
            season_type=SeasonType.CALENDAR_YEAR,
            active=True
        ).first()


class Crop(models.Model):
    """
    Master reference table for crop varieties.
    Supports both system defaults (company=null) and company-specific custom crops.
    """

    # === IDENTIFICATION ===
    name = models.CharField(
        max_length=100,
        help_text="Common name (e.g., 'Navel Orange', 'Hass Avocado')"
    )
    scientific_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Scientific/botanical name"
    )
    variety = models.CharField(
        max_length=100,
        blank=True,
        help_text="Specific variety or cultivar"
    )

    # === CLASSIFICATION ===
    category = models.CharField(
        max_length=30,
        choices=CropCategory.choices,
        default=CropCategory.OTHER,
        help_text="Crop category for grouping"
    )
    crop_type = models.CharField(
        max_length=20,
        choices=CropType.choices,
        default=CropType.TREE,
        help_text="Plant type (tree, vine, row crop, etc.)"
    )

    # === AGRONOMIC CHARACTERISTICS ===
    typical_spacing_row_ft = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Typical row spacing in feet"
    )
    typical_spacing_tree_ft = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Typical in-row/tree spacing in feet"
    )
    typical_root_depth_inches = models.IntegerField(
        null=True,
        blank=True,
        help_text="Typical root depth for irrigation calculations"
    )
    years_to_maturity = models.IntegerField(
        null=True,
        blank=True,
        help_text="Typical years from planting to full production"
    )
    productive_lifespan_years = models.IntegerField(
        null=True,
        blank=True,
        help_text="Expected productive lifespan"
    )

    # === WATER/IRRIGATION ===
    kc_mature = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Mature crop coefficient (Kc) for ET calculations"
    )
    kc_young = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Young tree/vine crop coefficient"
    )

    # === HARVEST INFO ===
    typical_harvest_months = models.CharField(
        max_length=100,
        blank=True,
        help_text="Typical harvest window (e.g., 'Nov-Apr')"
    )
    default_bin_weight_lbs = models.IntegerField(
        default=900,
        help_text="Default bin weight for harvest calculations"
    )

    # === SEASON CONFIGURATION ===
    season_template = models.ForeignKey(
        SeasonTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crops',
        help_text="Default season template for this crop type"
    )
    supports_multiple_cycles = models.BooleanField(
        default=False,
        help_text="True for crops with multiple harvests per year (lettuce, strawberries)"
    )
    typical_cycles_per_year = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Typical number of growing cycles per year (for multi-cycle crops)"
    )
    typical_days_to_maturity = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Typical days from planting to harvest"
    )

    # === DPR COMMODITY CODE ===
    dpr_commodity_code = models.CharField(
        max_length=20,
        blank=True,
        help_text="California DPR commodity code, e.g., '2004-00' for lemon"
    )

    # === OWNERSHIP & STATUS ===
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='crops',
        help_text="Null for system defaults, set for custom company crops"
    )
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'name']
        verbose_name = "Crop"
        verbose_name_plural = "Crops"
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['category']),
            models.Index(fields=['active']),
        ]

    def __str__(self):
        if self.variety:
            return f"{self.name} ({self.variety})"
        return self.name

    @classmethod
    def get_system_defaults(cls):
        """Get all system default crops (company=null)."""
        return cls.objects.filter(company__isnull=True, active=True)


class Rootstock(models.Model):
    """
    Rootstock varieties, linked to compatible crops.
    Important for tree/vine crops (citrus, grapes, avocados, etc.)
    """

    VIGOR_CHOICES = [
        ('dwarf', 'Dwarf'),
        ('semi_dwarf', 'Semi-Dwarf'),
        ('standard', 'Standard'),
        ('vigorous', 'Vigorous'),
    ]

    DROUGHT_TOLERANCE_CHOICES = [
        ('low', 'Low'),
        ('moderate', 'Moderate'),
        ('high', 'High'),
    ]

    # === IDENTIFICATION ===
    name = models.CharField(
        max_length=100,
        help_text="Rootstock name (e.g., 'Carrizo Citrange', '1103P')"
    )
    code = models.CharField(
        max_length=50,
        blank=True,
        help_text="Common abbreviation or code"
    )

    # === CROP COMPATIBILITY ===
    compatible_crops = models.ManyToManyField(
        Crop,
        related_name='compatible_rootstocks',
        blank=True,
        help_text="Crops this rootstock is typically used with"
    )
    primary_category = models.CharField(
        max_length=30,
        choices=CropCategory.choices,
        default=CropCategory.CITRUS,
        help_text="Primary crop category"
    )

    # === CHARACTERISTICS ===
    vigor = models.CharField(
        max_length=20,
        choices=VIGOR_CHOICES,
        blank=True,
        help_text="Growth vigor classification"
    )
    disease_resistance = models.TextField(
        blank=True,
        help_text="Known disease resistances"
    )
    soil_tolerance = models.TextField(
        blank=True,
        help_text="Soil condition tolerances (salinity, pH, drainage)"
    )
    cold_hardiness = models.CharField(
        max_length=50,
        blank=True,
        help_text="Cold hardiness rating"
    )
    drought_tolerance = models.CharField(
        max_length=20,
        choices=DROUGHT_TOLERANCE_CHOICES,
        blank=True
    )

    # === OWNERSHIP & STATUS ===
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='rootstocks',
        help_text="Null for system defaults"
    )
    active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['primary_category', 'name']
        verbose_name = "Rootstock"
        verbose_name_plural = "Rootstocks"
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['primary_category']),
        ]

    def __str__(self):
        if self.code:
            return f"{self.name} ({self.code})"
        return self.name


# =============================================================================
# FIELD MODEL
# =============================================================================

class Field(LocationMixin, models.Model):
    """
    Farm field/block information with detailed agricultural data.
    Inherits GPS/PLSS fields from LocationMixin.
    """

    ROW_ORIENTATION_CHOICES = [
        ('ns', 'North-South'),
        ('ew', 'East-West'),
        ('ne_sw', 'Northeast-Southwest'),
        ('nw_se', 'Northwest-Southeast'),
    ]

    TRELLIS_SYSTEM_CHOICES = [
        ('none', 'None'),
        ('vertical_shoot', 'Vertical Shoot Position (VSP)'),
        ('lyre', 'Lyre/U-Shape'),
        ('geneva_double', 'Geneva Double Curtain'),
        ('high_wire', 'High Wire'),
        ('pergola', 'Pergola/Arbor'),
        ('espalier', 'Espalier'),
        ('stake', 'Stake'),
        ('other', 'Other'),
    ]

    SOIL_TYPE_CHOICES = [
        ('sandy', 'Sandy'),
        ('sandy_loam', 'Sandy Loam'),
        ('loam', 'Loam'),
        ('clay_loam', 'Clay Loam'),
        ('clay', 'Clay'),
        ('silty_loam', 'Silty Loam'),
        ('silty_clay', 'Silty Clay'),
    ]

    IRRIGATION_TYPE_CHOICES = [
        ('drip', 'Drip'),
        ('micro_sprinkler', 'Micro-Sprinkler'),
        ('sprinkler', 'Sprinkler'),
        ('flood', 'Flood'),
        ('furrow', 'Furrow'),
        ('none', 'None/Dryland'),
    ]

    ORGANIC_STATUS_CHOICES = [
        ('conventional', 'Conventional'),
        ('transitional', 'Transitional'),
        ('certified', 'Certified Organic'),
    ]

    # === BASIC INFO ===
    name = models.CharField(max_length=200)
    farm = models.ForeignKey(Farm, on_delete=models.PROTECT, related_name='fields', null=True, blank=True)
    field_number = models.CharField(max_length=50, blank=True)

    # Location data - county stays separate (often different from farm county)
    county = models.CharField(max_length=100)

    # NOTE: PLSS fields (plss_section, plss_township, plss_range, plss_meridian)
    # and GPS fields (gps_latitude, gps_longitude) are inherited from LocationMixin

    boundary_geojson = models.JSONField(
        null=True,
        blank=True,
        verbose_name="Boundary GeoJSON",
        help_text="Field boundary polygon in GeoJSON format"
    )
    calculated_acres = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="Calculated Acres",
        help_text="Acreage calculated from drawn boundary"
    )

    # Field characteristics
    total_acres = models.DecimalField(max_digits=10, decimal_places=2)

    # === LEGACY CROP FIELD (kept for backward compatibility) ===
    current_crop = models.CharField(
        max_length=100,
        blank=True,
        help_text="Legacy text field - use 'crop' ForeignKey instead"
    )

    # === NEW CROP FIELDS ===
    crop = models.ForeignKey(
        Crop,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fields',
        help_text="Primary crop planted in this field"
    )
    rootstock = models.ForeignKey(
        Rootstock,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fields',
        help_text="Rootstock variety (for tree/vine crops)"
    )

    # === SEASON CONFIGURATION ===
    season_template = models.ForeignKey(
        SeasonTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fields',
        help_text="Override season template for this field (defaults to crop's template)"
    )
    current_growing_cycle = models.ForeignKey(
        'GrowingCycle',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text="Currently active growing cycle (for multi-cycle crops)"
    )

    # === PLANTING DATA ===
    planting_date = models.DateField(null=True, blank=True)
    year_planted = models.IntegerField(
        null=True,
        blank=True,
        help_text="Year trees/vines were planted (alternative to planting_date)"
    )

    # === SPACING & DENSITY ===
    row_spacing_ft = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Row spacing in feet"
    )
    tree_spacing_ft = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="In-row/tree spacing in feet"
    )
    tree_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Total number of trees/plants"
    )
    trees_per_acre = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Tree/plant density (calculated or manual)"
    )

    # === ORIENTATION & TRELLIS ===
    row_orientation = models.CharField(
        max_length=10,
        choices=ROW_ORIENTATION_CHOICES,
        blank=True,
        help_text="Row orientation for sun exposure"
    )
    trellis_system = models.CharField(
        max_length=30,
        choices=TRELLIS_SYSTEM_CHOICES,
        default='none',
        blank=True
    )

    # === SOIL & IRRIGATION ===
    soil_type = models.CharField(
        max_length=30,
        choices=SOIL_TYPE_CHOICES,
        blank=True,
        help_text="Predominant soil type"
    )
    irrigation_type = models.CharField(
        max_length=20,
        choices=IRRIGATION_TYPE_CHOICES,
        blank=True,
        help_text="Primary irrigation method"
    )

    # FSMA Water Assessment Fields
    typical_days_before_harvest = models.IntegerField(
        null=True,
        blank=True,
        help_text="Typical days between last irrigation and harvest"
    )
    water_contacts_harvestable = models.BooleanField(
        null=True,
        blank=True,
        help_text="Does irrigation water directly contact harvestable portion?"
    )

    # === PRODUCTION & YIELD ===
    expected_yield_per_acre = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Expected yield per acre (crop-appropriate units)"
    )
    yield_unit = models.CharField(
        max_length=30,
        blank=True,
        default='bins',
        help_text="Unit for yield (bins, lbs, tons, boxes, etc.)"
    )

    # === CERTIFICATION STATUS ===
    organic_status = models.CharField(
        max_length=20,
        choices=ORGANIC_STATUS_CHOICES,
        default='conventional'
    )
    organic_certifier = models.CharField(
        max_length=100,
        blank=True,
        help_text="Organic certification agency"
    )
    organic_cert_number = models.CharField(
        max_length=50,
        blank=True
    )
    organic_cert_expiration = models.DateField(
        null=True,
        blank=True
    )

    # === PUR SITE MAPPING ===
    pur_site_id = models.CharField(
        max_length=100, blank=True,
        help_text="Ag Commissioner site ID for PUR matching, e.g., 'FINCH FARMS, LLC 02C'"
    )

    # === NOTES ===
    notes = models.TextField(blank=True)

    # === STATUS ===
    active = models.BooleanField(default=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.field_number})"

    @property
    def crop_age_years(self):
        """Calculate crop age from planting date or year planted."""
        from datetime import date
        if self.planting_date:
            return (date.today() - self.planting_date).days // 365
        elif self.year_planted:
            return date.today().year - self.year_planted
        return None

    @property
    def calculated_trees_per_acre(self):
        """Calculate tree density from spacing."""
        if self.row_spacing_ft and self.tree_spacing_ft:
            sq_ft_per_tree = float(self.row_spacing_ft * self.tree_spacing_ft)
            if sq_ft_per_tree > 0:
                return round(43560 / sq_ft_per_tree, 2)
        return None

    def calculate_centroid_from_boundary(self):
        """Calculate the centroid of the boundary polygon."""
        if not self.boundary_geojson:
            return None
        try:
            coords = self.boundary_geojson.get('coordinates', [[]])[0]
            if not coords:
                return None
            lats = [c[1] for c in coords]
            lngs = [c[0] for c in coords]
            self.gps_latitude = Decimal(str(sum(lats) / len(lats)))
            self.gps_longitude = Decimal(str(sum(lngs) / len(lngs)))
            return (float(self.gps_latitude), float(self.gps_longitude))
        except (KeyError, IndexError, TypeError):
            return None

    def save(self, *args, **kwargs):
        """Auto-calculate values on save."""
        # Auto-calculate trees per acre if not set
        if not self.trees_per_acre and self.row_spacing_ft and self.tree_spacing_ft:
            self.trees_per_acre = self.calculated_trees_per_acre

        # Auto-calculate tree count if not set
        if not self.tree_count and self.trees_per_acre and self.total_acres:
            self.tree_count = int(float(self.trees_per_acre) * float(self.total_acres))

        # Auto-calculate centroid from boundary
        if self.boundary_geojson and not self.has_coordinates:
            self.calculate_centroid_from_boundary()

        super().save(*args, **kwargs)

    def get_season_template(self):
        """
        Get the applicable season template for this field.
        Priority: Field override > Crop default > Category default > Calendar year
        """
        # Field-level override
        if self.season_template:
            return self.season_template

        # Crop-level default
        if self.crop and self.crop.season_template:
            return self.crop.season_template

        # Look up by crop category
        if self.crop and self.crop.category:
            company = self.farm.company if self.farm else None
            return SeasonTemplate.get_for_category(self.crop.category, company)

        # Fall back to calendar year (will be created in migration)
        return SeasonTemplate.objects.filter(
            company__isnull=True,
            season_type=SeasonType.CALENDAR_YEAR,
            active=True
        ).first()


class GrowingCycleStatus(models.TextChoices):
    """Status choices for growing cycles."""
    PLANNED = 'planned', 'Planned'
    PLANTED = 'planted', 'Planted'
    GROWING = 'growing', 'Growing'
    HARVESTING = 'harvesting', 'Harvesting'
    COMPLETE = 'complete', 'Complete'
    ABANDONED = 'abandoned', 'Abandoned'


class GrowingCycle(models.Model):
    """
    Represents a specific growing cycle for crops that have multiple
    harvests per year (lettuce, strawberries, tomatoes, etc.)

    Each cycle tracks planting to harvest for one crop rotation.
    Applications and harvests can optionally link to a specific cycle.
    """

    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='growing_cycles'
    )

    # Cycle identification
    cycle_number = models.PositiveSmallIntegerField(
        default=1,
        help_text="Cycle number within the year (1, 2, 3...)"
    )
    year = models.PositiveIntegerField(
        help_text="Calendar year this cycle occurs in"
    )

    # Crop for this cycle (may differ from field's primary crop for rotation)
    crop = models.ForeignKey(
        'Crop',
        on_delete=models.PROTECT,
        related_name='growing_cycles',
        null=True,
        blank=True,
        help_text="Crop for this cycle (optional, defaults to field's crop)"
    )

    # Cycle dates
    planting_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual or planned planting date"
    )
    expected_harvest_start = models.DateField(
        null=True,
        blank=True,
        help_text="Expected start of harvest window"
    )
    expected_harvest_end = models.DateField(
        null=True,
        blank=True,
        help_text="Expected end of harvest window"
    )
    actual_harvest_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual harvest completion date"
    )

    # Growing parameters
    days_to_maturity = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Expected days from planting to harvest (can override crop default)"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=GrowingCycleStatus.choices,
        default=GrowingCycleStatus.PLANNED
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['year', 'cycle_number']
        verbose_name = "Growing Cycle"
        verbose_name_plural = "Growing Cycles"
        constraints = [
            models.UniqueConstraint(
                fields=['field', 'year', 'cycle_number'],
                name='unique_cycle_per_field_year'
            )
        ]
        indexes = [
            models.Index(fields=['field', 'year']),
            models.Index(fields=['status', 'year']),
            models.Index(fields=['planting_date']),
        ]

    def __str__(self):
        crop_name = self.crop.name if self.crop else (
            self.field.crop.name if self.field.crop else 'Unknown'
        )
        return f"{self.field.name} - {crop_name} Cycle {self.cycle_number} ({self.year})"

    @property
    def is_active(self) -> bool:
        """Check if this cycle is currently active."""
        return self.status in (
            GrowingCycleStatus.PLANTED,
            GrowingCycleStatus.GROWING,
            GrowingCycleStatus.HARVESTING
        )

    @property
    def effective_crop(self):
        """Get the crop for this cycle, defaulting to field's crop."""
        return self.crop or self.field.crop

    @property
    def duration_days(self):
        """Calculate actual or expected duration in days."""
        if self.planting_date and self.actual_harvest_date:
            return (self.actual_harvest_date - self.planting_date).days
        if self.planting_date and self.expected_harvest_end:
            return (self.expected_harvest_end - self.planting_date).days
        return self.days_to_maturity

    def get_season_context(self) -> dict:
        """Return season-like context for this cycle (for compliance checking)."""
        return {
            'label': f"{self.year} Cycle {self.cycle_number}",
            'start_date': self.planting_date,
            'end_date': self.actual_harvest_date or self.expected_harvest_end,
            'type': 'growing_cycle',
            'cycle_id': self.id,
        }

    def save(self, *args, **kwargs):
        # Auto-calculate expected harvest if planting date and days to maturity known
        if self.planting_date and not self.expected_harvest_start:
            days = self.days_to_maturity
            if not days and self.effective_crop:
                days = self.effective_crop.typical_days_to_maturity
            if days:
                from datetime import timedelta
                self.expected_harvest_start = self.planting_date + timedelta(days=days)
        super().save(*args, **kwargs)


class PesticideProduct(models.Model):
    """
    Complete pesticide product database for California PUR compliance.
    Based on California DPR requirements and product label information.
    """

    # EXISTING FIELDS (keep these)
    epa_registration_number = models.CharField(
        max_length=50,
        unique=True,
        help_text="EPA Registration Number (e.g., 12345-678)"
    )
    product_name = models.CharField(
        max_length=200,
        help_text="Product trade name"
    )
    manufacturer = models.CharField(
        max_length=200,
        blank=True,
        help_text="Manufacturer/registrant name"
    )
    active_ingredients = models.TextField(
        blank=True,
        help_text="Active ingredient(s) and percentages"
    )
    formulation_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="e.g., EC, WP, G, etc."
    )
    restricted_use = models.BooleanField(
        default=False,
        help_text="Restricted Use Pesticide (RUP)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # NEW FIELDS FOR ENHANCED PUR COMPLIANCE

    # Product Classification
    product_type = models.CharField(  # NEW
        max_length=50,
        blank=True,
        choices=[
            ('insecticide', 'Insecticide'),
            ('herbicide', 'Herbicide'),
            ('fungicide', 'Fungicide'),
            ('fumigant', 'Fumigant'),
            ('adjuvant', 'Adjuvant'),
            ('plant_growth_regulator', 'Plant Growth Regulator'),
            ('rodenticide', 'Rodenticide'),
            ('other', 'Other'),
        ],
        help_text="Primary product type"
    )

    is_fumigant = models.BooleanField(  # NEW
        default=False,
        help_text="Is this a fumigant product?"
    )

    # Signal Word (Toxicity)
    signal_word = models.CharField(  # NEW
        max_length=20,
        blank=True,
        choices=[
            ('DANGER', 'Danger'),
            ('WARNING', 'Warning'),
            ('CAUTION', 'Caution'),
            ('NONE', 'None'),
        ],
        help_text="Signal word from label"
    )

    # Re-Entry Interval (REI)
    rei_hours = models.DecimalField(  # NEW
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Re-Entry Interval in hours (e.g., 12, 24, 48)"
    )

    rei_days = models.IntegerField(  # NEW
        null=True,
        blank=True,
        help_text="Alternative REI in days (some products use days)"
    )

    # Pre-Harvest Interval (PHI)
    phi_days = models.IntegerField(  # NEW
        null=True,
        blank=True,
        help_text="Pre-Harvest Interval in days"
    )

    # Application Restrictions
    max_applications_per_season = models.IntegerField(  # NEW
        null=True,
        blank=True,
        help_text="Maximum number of applications per season"
    )

    max_rate_per_application = models.DecimalField(  # NEW
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Maximum rate per application"
    )

    max_rate_unit = models.CharField(  # NEW
        max_length=20,
        blank=True,
        choices=[
            ('lbs/acre', 'lbs/acre'),
            ('gal/acre', 'gal/acre'),
            ('oz/acre', 'oz/acre'),
            ('fl oz/acre', 'fl oz/acre'),
            ('kg/ha', 'kg/ha'),
            ('L/ha', 'L/ha'),
        ],
        help_text="Unit for max rate"
    )

    # California Specific
    california_registration_number = models.CharField(  # NEW
        max_length=50,
        blank=True,
        help_text="California DPR registration number (if different from EPA)"
    )

    active_status_california = models.BooleanField(  # NEW
        default=True,
        help_text="Currently registered for use in California?"
    )

    # Product Details
    formulation_code = models.CharField(  # NEW
        max_length=10,
        blank=True,
        help_text="EPA formulation code (e.g., EC, WP, G)"
    )

    density_specific_gravity = models.DecimalField(  # NEW
        max_digits=6,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Specific gravity or density (for conversions)"
    )

    # Approved Crops/Sites
    approved_crops = models.TextField(  # NEW
        blank=True,
        help_text="Comma-separated list of approved crops/sites"
    )

    # Environmental/Safety Notes
    groundwater_advisory = models.BooleanField(  # NEW
        default=False,
        help_text="Has groundwater advisory?"
    )

    endangered_species_restrictions = models.BooleanField(  # NEW
        default=False,
        help_text="Has endangered species restrictions?"
    )

    buffer_zone_required = models.BooleanField(  # NEW
        default=False,
        help_text="Requires buffer zones?"
    )

    buffer_zone_feet = models.IntegerField(  # NEW
        null=True,
        blank=True,
        help_text="Buffer zone distance in feet"
    )

    # Product Availability
    product_status = models.CharField(  # NEW
        max_length=20,
        default='active',
        choices=[
            ('active', 'Active'),
            ('discontinued', 'Discontinued'),
            ('suspended', 'Suspended'),
            ('cancelled', 'Cancelled'),
        ],
        help_text="Current product status"
    )

    # Cost Tracking (Optional but useful)
    unit_size = models.CharField(  # NEW
        max_length=50,
        blank=True,
        help_text="Standard unit size (e.g., '2.5 gallon jug', '50 lb bag')"
    )

    cost_per_unit = models.DecimalField(  # NEW
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Cost per unit (for cost tracking)"
    )

    # Additional Information
    label_url = models.URLField(  # NEW
        blank=True,
        help_text="URL to product label PDF"
    )

    sds_url = models.URLField(  # NEW
        blank=True,
        help_text="URL to Safety Data Sheet"
    )

    notes = models.TextField(  # NEW
        blank=True,
        help_text="Additional notes or special instructions"
    )

    # Metadata for management
    active = models.BooleanField(  # NEW (if not already present)
        default=True,
        help_text="Is this product actively used on your farm?"
    )

    # Search optimization
    search_keywords = models.TextField(  # NEW
        blank=True,
        help_text="Additional keywords for searching (auto-populated)"
    )

    class Meta:
        ordering = ['product_name']
        verbose_name = "Pesticide Product"
        verbose_name_plural = "Pesticide Products"
        indexes = [
            models.Index(fields=['epa_registration_number']),
            models.Index(fields=['product_name']),
            models.Index(fields=['product_type']),
            models.Index(fields=['active']),
        ]

    def __str__(self):
        return f"{self.product_name} ({self.epa_registration_number})"

    def save(self, *args, **kwargs):
        # Auto-populate search keywords
        keywords = [
            self.product_name,
            self.manufacturer,
            self.epa_registration_number,
            self.active_ingredients,
        ]
        self.search_keywords = ' '.join(filter(None, keywords)).lower()
        super().save(*args, **kwargs)

    def get_rei_display_hours(self):
        """Get REI in hours for display"""
        if self.rei_hours:
            return self.rei_hours
        elif self.rei_days:
            return self.rei_days * 24
        return None

    def is_rei_expired(self, application_date, check_date):
        """Check if REI has expired for an application"""
        from datetime import timedelta

        rei_hours = self.get_rei_display_hours()
        if not rei_hours:
            return True  # No REI means safe to enter

        rei_end = application_date + timedelta(hours=float(rei_hours))
        return check_date >= rei_end

    def is_phi_met(self, application_date, harvest_date):
        """Check if PHI is met for harvest"""
        if not self.phi_days:
            return True  # No PHI restriction

        from datetime import timedelta
        phi_end = application_date + timedelta(days=self.phi_days)
        return harvest_date >= phi_end

    @property
    def is_high_toxicity(self):
        """Check if product is high toxicity"""
        return self.signal_word == 'DANGER'

    @property
    def requires_license(self):
        """Check if product requires licensed applicator"""
        return self.restricted_use or self.is_fumigant


class PesticideApplication(models.Model):
    """Pesticide application records"""

    STATUS_CHOICES = [
        ('pending_signature', 'Pending Signature'),
        ('complete', 'Complete'),
        ('submitted', 'Submitted to PUR'),
    ]

    # Application date and time
    application_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()

    # Field information
    field = models.ForeignKey(Field, on_delete=models.PROTECT, related_name='applications')
    acres_treated = models.DecimalField(max_digits=10, decimal_places=2)

    # Growing cycle (optional, for multi-cycle crops)
    growing_cycle = models.ForeignKey(
        'GrowingCycle',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='applications',
        help_text="Associated growing cycle (for multi-cycle crops like lettuce)"
    )

    # Product information
    product = models.ForeignKey(PesticideProduct, on_delete=models.PROTECT, related_name='applications')

    # Application details
    amount_used = models.DecimalField(max_digits=10, decimal_places=2)

    UNIT_CHOICES = [
        ('gal', 'Gallons'),
        ('lbs', 'Pounds'),
        ('oz', 'Ounces'),
        ('pt', 'Pints'),
        ('qt', 'Quarts'),
    ]
    unit_of_measure = models.CharField(max_length=20, choices=UNIT_CHOICES)

    METHOD_CHOICES = [
        ('Ground Spray', 'Ground Spray'),
        ('Aerial Application', 'Aerial Application'),
        ('Chemigation', 'Chemigation'),
        ('Soil Injection', 'Soil Injection'),
        ('Broadcast', 'Broadcast Application'),
    ]
    application_method = models.CharField(max_length=100, choices=METHOD_CHOICES)

    target_pest = models.CharField(max_length=200, blank=True)

    # Applicator information
    applicator_name = models.CharField(max_length=200)

    # Applicator license number
    applicator_license_no = models.CharField(
        max_length=50,
        blank=True,
        help_text="California Department of Pesticide Regulation license number"
    )

    # Weather conditions
    temperature = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    wind_speed = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)

    WIND_DIRECTION_CHOICES = [
        ('N', 'North'),
        ('NE', 'Northeast'),
        ('E', 'East'),
        ('SE', 'Southeast'),
        ('S', 'South'),
        ('SW', 'Southwest'),
        ('W', 'West'),
        ('NW', 'Northwest'),
    ]
    wind_direction = models.CharField(max_length=2, choices=WIND_DIRECTION_CHOICES, blank=True)

    # Additional tracking
    notes = models.TextField(blank=True)

    # PUR submission tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending_signature')
    submitted_to_pur = models.BooleanField(default=False)
    pur_submission_date = models.DateField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-application_date', '-created_at']
        indexes = [
            models.Index(fields=['field', 'application_date'], name='idx_pestapp_field_date'),
            models.Index(fields=['product', 'application_date'], name='idx_pestapp_product_date'),
        ]

    def __str__(self):
        return f"{self.field.name} - {self.product.product_name} on {self.application_date}"


# =============================================================================
# CROP VARIETY & BIN WEIGHT CONSTANTS
# =============================================================================

CROP_VARIETY_CHOICES = [
    ('navel_orange', 'Navel Orange'),
    ('valencia_orange', 'Valencia Orange'),
    ('cara_cara', 'Cara Cara Orange'),
    ('blood_orange', 'Blood Orange'),
    ('meyer_lemon', 'Meyer Lemon'),
    ('eureka_lemon', 'Eureka Lemon'),
    ('lisbon_lemon', 'Lisbon Lemon'),
    ('lime', 'Lime'),
    ('grapefruit_white', 'White Grapefruit'),
    ('grapefruit_ruby', 'Ruby Red Grapefruit'),
    ('mandarin', 'Mandarin'),
    ('tangerine', 'Tangerine'),
    ('clementine', 'Clementine'),
    ('satsuma', 'Satsuma'),
    ('tangelo', 'Tangelo'),
    ('kumquat', 'Kumquat'),
    ('hass_avocado', 'Hass Avocado'),
    ('lamb_hass_avocado', 'Lamb Hass Avocado'),
    ('gem_avocado', 'GEM Avocado'),
    ('reed_avocado', 'Reed Avocado'),
    ('fuerte_avocado', 'Fuerte Avocado'),
    ('bacon_avocado', 'Bacon Avocado'),
    ('other', 'Other'),
]

# Default bin weights by crop type (in lbs)
DEFAULT_BIN_WEIGHTS = {
    'navel_orange': 900,
    'valencia_orange': 900,
    'cara_cara': 900,
    'blood_orange': 900,
    'meyer_lemon': 900,
    'eureka_lemon': 900,
    'lisbon_lemon': 900,
    'lime': 850,
    'grapefruit_white': 800,
    'grapefruit_ruby': 800,
    'mandarin': 800,
    'tangerine': 800,
    'clementine': 800,
    'satsuma': 800,
    'tangelo': 850,
    'kumquat': 800,
    'hass_avocado': 800,
    'lamb_hass_avocado': 800,
    'gem_avocado': 800,
    'reed_avocado': 800,
    'fuerte_avocado': 800,
    'bacon_avocado': 800,
    'other': 900,
}
