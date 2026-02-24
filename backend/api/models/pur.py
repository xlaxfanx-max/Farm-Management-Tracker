"""
PUR (Pesticide Use Report) models — unified product, applicator, application event,
and tank mix item models for California PUR compliance.

Replaces the old PesticideProduct + PesticideApplication single-product model
with a proper tank-mix architecture where one ApplicationEvent can have multiple
TankMixItem line items (3–10+ products per spray pass).
"""

from django.db import models
from django.core.validators import MinValueValidator
from decimal import Decimal


# =============================================================================
# PRODUCT TYPE CHOICES
# =============================================================================

PRODUCT_TYPE_CHOICES = [
    ('pesticide', 'Pesticide'),
    ('fertilizer', 'Fertilizer'),
    ('adjuvant', 'Adjuvant / Surfactant'),
    ('growth_regulator', 'Plant Growth Regulator'),
    ('biological', 'Biological'),
    ('other', 'Other'),
]

SIGNAL_WORD_CHOICES = [
    ('DANGER', 'Danger'),
    ('WARNING', 'Warning'),
    ('CAUTION', 'Caution'),
    ('NONE', 'None'),
]

APPLICATOR_TYPE_CHOICES = [
    ('pco', 'Pest Control Operator (PCO)'),
    ('pca', 'Pest Control Advisor (PCA)'),
    ('grower', 'Grower-Applicator'),
    ('aerial', 'Aerial Applicator'),
]

PUR_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('sent', 'Sent to County'),
    ('unsent', 'Unsent'),
    ('rejected', 'Rejected'),
]

APPLICATION_METHOD_CHOICES = [
    ('ground', 'Ground'),
    ('air', 'Air (Aerial)'),
    ('chemigation', 'Chemigation'),
    ('hand', 'Hand Application'),
    ('other', 'Other'),
]

AMOUNT_UNIT_CHOICES = [
    ('Ga', 'Gallons'),
    ('Floz', 'Fluid Ounces'),
    ('Qt', 'Quarts'),
    ('Pt', 'Pints'),
    ('Lb', 'Pounds'),
    ('Oz', 'Ounces'),
]

RATE_UNIT_CHOICES = [
    ('Ga/A', 'Gallons per Acre'),
    ('Floz/A', 'Fluid Ounces per Acre'),
    ('Qt/A', 'Quarts per Acre'),
    ('Pt/A', 'Pints per Acre'),
    ('Lb/A', 'Pounds per Acre'),
    ('Oz/A', 'Ounces per Acre'),
]


# =============================================================================
# PRODUCT (unified — pesticides, fertilizers, adjuvants, etc.)
# =============================================================================

class Product(models.Model):
    """
    Unified product model for pesticides, fertilizers, adjuvants, and other ag inputs.
    All of these appear together on PUR reports in tank mixes.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='products',
        help_text="Null = system/global product"
    )

    product_type = models.CharField(
        max_length=20, choices=PRODUCT_TYPE_CHOICES, default='pesticide'
    )

    # Identity
    product_name = models.CharField(max_length=300)
    manufacturer = models.CharField(max_length=200, blank=True)
    epa_registration_number = models.CharField(
        max_length=50, blank=True,
        help_text="EPA reg number with state suffix, e.g., '71058-5-ZA'. Empty for fertilizers."
    )

    # Active ingredient(s) — structured JSON for multi-AI products
    # Format: [{"name": "Abamectin", "percent": 1.90}, ...]
    active_ingredients = models.JSONField(
        default=list, blank=True,
        help_text="List of {name, percent} objects"
    )

    # For backward compat and simple queries
    active_ingredient = models.CharField(
        max_length=200, blank=True,
        help_text="Primary active ingredient name"
    )
    active_ingredient_percent = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )

    # Pesticide-specific fields
    restricted_use = models.BooleanField(default=False)
    signal_word = models.CharField(
        max_length=20, blank=True, choices=SIGNAL_WORD_CHOICES
    )
    phi_days = models.IntegerField(
        null=True, blank=True, help_text="Pre-Harvest Interval in days"
    )
    rei_hours = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Re-Entry Interval in hours"
    )
    formulation_code = models.CharField(
        max_length=10, blank=True, help_text="EC, WP, SC, WDG, G, etc."
    )

    # Fertilizer-specific fields
    n_percent = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    p_percent = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    k_percent = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    # Shared fields
    is_organic_approved = models.BooleanField(default=False)
    label_url = models.URLField(blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['product_name']
        indexes = [
            models.Index(fields=['epa_registration_number']),
            models.Index(fields=['product_type']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        if self.epa_registration_number:
            return f"{self.product_name} ({self.epa_registration_number})"
        return self.product_name


# =============================================================================
# APPLICATOR
# =============================================================================

class Applicator(models.Model):
    """Licensed pesticide applicator business (PCA, PCO, or grower-applicator)."""
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='applicators'
    )

    name = models.CharField(
        max_length=200,
        help_text="Business name, e.g., 'Ag Rx', 'Hansen Pest Control'"
    )
    applicator_type = models.CharField(
        max_length=20, choices=APPLICATOR_TYPE_CHOICES, default='pco'
    )
    applicator_id = models.CharField(
        max_length=50, blank=True,
        help_text="County applicator ID number, e.g., '30889'"
    )
    license_number = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    zip_code = models.CharField(max_length=10, blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    contact_email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.applicator_id})" if self.applicator_id else self.name


# =============================================================================
# APPLICATION EVENT (one PUR report / spray event)
# =============================================================================

class ApplicationEvent(models.Model):
    """
    A single application event (one PUR report). May contain multiple
    products (tank mix) via related TankMixItem records.
    """
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='application_events'
    )
    farm = models.ForeignKey(
        'Farm', on_delete=models.CASCADE,
        related_name='application_events',
        help_text="PUR reports are filed at the farm/ranch level"
    )
    field = models.ForeignKey(
        'Field', on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='application_events',
        help_text="Optional: specific field within the farm"
    )
    applicator = models.ForeignKey(
        Applicator, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='application_events'
    )

    # PUR tracking
    pur_number = models.CharField(
        max_length=50, blank=True,
        help_text="TELUS/County PUR ID, e.g., '833-15766184'"
    )
    pur_status = models.CharField(
        max_length=20, choices=PUR_STATUS_CHOICES, default='draft'
    )
    recommendation_number = models.CharField(
        max_length=50, blank=True,
        help_text="PCA recommendation number, e.g., 'REC9307633'"
    )

    # Location (PLSS) — from the PUR header
    county = models.CharField(max_length=50, default='Ventura')
    section = models.CharField(max_length=10, blank=True)
    township = models.CharField(max_length=10, blank=True)
    range_field = models.CharField(max_length=10, blank=True, db_column='range')
    baseline = models.CharField(max_length=5, blank=True, default='S')

    # Permit info
    permit_number = models.CharField(
        max_length=20, blank=True, help_text="e.g., '56P0049'"
    )
    site_id = models.CharField(
        max_length=100, blank=True,
        help_text="Ag Commissioner site ID, e.g., 'FINCH FARMS, LLC 02C'"
    )

    # Timing
    date_started = models.DateTimeField(help_text="Application start date/time")
    date_completed = models.DateTimeField(
        null=True, blank=True, help_text="Application end date/time"
    )

    # Area
    planted_area_acres = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    treated_area_acres = models.DecimalField(max_digits=8, decimal_places=2)

    # Commodity (from DPR commodity codes)
    commodity_name = models.CharField(
        max_length=100, blank=True, help_text="e.g., 'LEMON'"
    )
    commodity_code = models.CharField(
        max_length=20, blank=True, help_text="DPR code, e.g., '2004-00'"
    )

    # Method
    application_method = models.CharField(
        max_length=20, choices=APPLICATION_METHOD_CHOICES, default='ground'
    )

    # Spray conditions
    dilution_gallons = models.DecimalField(
        max_digits=8, decimal_places=1, null=True, blank=True,
        help_text="Total spray volume per acre in gallons"
    )
    wind_direction_degrees = models.IntegerField(null=True, blank=True)
    wind_velocity_mph = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True
    )
    temperature_start_f = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True
    )
    temperature_finish_f = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True
    )

    # Compliance — computed from the tank mix items (max of all products)
    rei_hours = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True,
        help_text="Maximum REI across all products in tank mix"
    )
    phi_days = models.IntegerField(
        null=True, blank=True,
        help_text="Maximum PHI across all products in tank mix"
    )

    # Applied by
    applied_by = models.CharField(
        max_length=200, blank=True,
        help_text="Person who applied, e.g., 'Ag Rx/Armando'"
    )
    supervised_by = models.CharField(max_length=200, blank=True)

    # Additional PUR fields
    is_nursery = models.BooleanField(default=False)
    is_organic = models.BooleanField(default=False)
    is_pre_plant = models.BooleanField(default=False)

    # Comments / restrictions from PUR
    comments = models.TextField(blank=True)
    restrictions = models.TextField(
        blank=True, help_text="Label restrictions noted on PUR"
    )

    # Import tracking
    imported_from = models.CharField(
        max_length=50, blank=True,
        help_text="Source: 'telus_pdf', 'manual', 'csv'"
    )
    import_batch_id = models.CharField(
        max_length=100, blank=True,
        help_text="Batch ID for grouped imports"
    )
    source_pdf_filename = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_started']
        indexes = [
            models.Index(fields=['pur_number']),
            models.Index(fields=['date_started']),
            models.Index(fields=['pur_status']),
        ]

    def __str__(self):
        date_str = self.date_started.strftime('%Y-%m-%d') if self.date_started else '?'
        return f"{self.field} - {date_str} ({self.get_application_method_display()})"

    def update_compliance_from_items(self):
        """Recalculate REI/PHI from tank mix items."""
        items = self.tank_mix_items.select_related('product').all()
        reis = [i.product.rei_hours for i in items if i.product.rei_hours]
        phis = [i.product.phi_days for i in items if i.product.phi_days]
        self.rei_hours = max(reis) if reis else None
        self.phi_days = max(phis) if phis else None
        self.save(update_fields=['rei_hours', 'phi_days'])


# =============================================================================
# TANK MIX ITEM (product line items within an application)
# =============================================================================

class TankMixItem(models.Model):
    """Individual product within a tank mix application."""
    application_event = models.ForeignKey(
        ApplicationEvent, on_delete=models.CASCADE,
        related_name='tank_mix_items'
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT,
        related_name='tank_mix_uses'
    )

    # Quantity applied
    total_amount = models.DecimalField(
        max_digits=12, decimal_places=3,
        help_text="Total product used for this application"
    )
    amount_unit = models.CharField(max_length=10, choices=AMOUNT_UNIT_CHOICES)

    # Application rate
    rate = models.DecimalField(
        max_digits=10, decimal_places=3,
        help_text="Rate per acre"
    )
    rate_unit = models.CharField(max_length=10, choices=RATE_UNIT_CHOICES)

    # Dilution volume (spray mix gallons per acre)
    dilution_gallons = models.DecimalField(
        max_digits=8, decimal_places=1, null=True, blank=True,
        help_text="Spray solution volume in gallons (e.g., 500, 250, 75)"
    )

    # Order within the PUR (for faithful reproduction)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ['sort_order']

    def __str__(self):
        return f"{self.product.product_name}: {self.total_amount} {self.amount_unit}"
