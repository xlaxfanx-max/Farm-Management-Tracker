"""On-ranch and off-ranch rental property — kept structurally out of farming.

Fourteen houses stand on ranches this operation farms. Until now they existed
only as a QuickBooks class tree, which meant nobody could answer "is this ranch
carried by fruit or by houses?" without opening two spreadsheets. The Office
ranch earned $82,376 renting and $393 farming in FY2024 — and the ag P&L
correctly carries only the $393.

That last sentence is the whole design brief. Rental dollars must be visible
next to a ranch and must never enter a farming margin. QuickBooks already
encodes the boundary correctly: Finch Farms LLC nests
``Income > Ranches > Rentals > {ranch} > {property}`` with **Farming as a
sibling**, not a parent. This module mirrors that shape.

The boundary is enforced four ways, deliberately redundantly:

1. **Structural.** This module references Farm, FarmParcel, Company and
   LegalEntity by string only — it imports nothing. Nothing under
   ``api/services/`` imports it. ``crop_report.py`` takes revenue exclusively
   from ``PoolSettlement`` and cost exclusively from ``ApplicationEvent`` /
   ``PesticideApplication``, so rental dollars cannot reach a ranch margin by
   construction rather than by convention.
2. **Declarative.** ``pnl_treatment`` defaults to ``non_operating``.
3. **Presentational.** Two cards, separate subtotals — copying RMLF's own
   layout, which already gets this right.
4. **Query-level.** The ranch rental summary endpoint carries no acreage field
   at all, so a per-acre rental figure cannot be computed client-side.
   Dividing $82,376 by Office's 10.11 bearing acres is arithmetically valid and
   completely meaningless.

Three modelling decisions that are load-bearing:

* **``location_type`` is its own field, never ``farm_id IS NULL``.** Thacher
  Creek LLC owns both 2728 E Ojai (on-ranch) and the 13-unit Ventura St
  building (off-ranch). Same entity, opposite P&L treatment. The FIFA Real
  Estate Roll-Up states the rule verbatim: on-ranch houses are excluded "to
  avoid double-counting (location rule, not entity)."

* **Rent lives on the Lease, never on a person.** The May 2026 rent roll prints
  a portfolio total of $60,563 by summing 31 tenant rows against 19 actual
  units — Harrison unit 363 appears three times at $1,575. Attaching rent to
  the unit's lease makes that class of error structurally impossible. The
  correct figure is $36,956/mo = $443,472/yr, which ties exactly to the FIFA
  Roll-Up GPR.

* **One ledger row carries both charged and paid.** Gray Prop's "Original
  Amount" column is not additive: 61 charge lines sum to $101,700 against
  $80,700 actually paid, because a split payment repeats the full charge on
  every line (unit 359: $1,600 charged, then $600 + $1,000 paid, every month).
  Collapsing to one row per unit/period/category with two amounts gives
  delinquency for free and cannot double-count a split.

There is deliberately no ``Tenant`` model. Thirty-one names with emails and up
to three phone numbers each, on a live public site, is a liability with no
operational payoff — this operation is not the landlord of record, and the
manager's own statements already key on unit ("359:Vasquez"), which is all
reconciliation needs. ``Lease.occupant_label`` is a plain string.
"""

from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


LOCATION_TYPE_CHOICES = [
    ('on_ranch', 'On-ranch — stands on ground we farm'),
    ('off_ranch', 'Off-ranch — standalone investment property'),
]

PNL_TREATMENT_CHOICES = [
    ('non_operating', 'Non-operating income — outside every farming margin'),
    ('ranch_other_income', 'Ranch other income — shown on the ranch, still outside the crop margin'),
]

PROPERTY_TYPE_CHOICES = [
    ('dwelling', 'Dwelling'),
    ('commercial', 'Commercial'),
    ('yard', 'Yard / barn / storage'),
    ('land', 'Land lease'),
    ('other', 'Other'),
]

LEDGER_GRAIN_CHOICES = [
    ('monthly', 'Monthly'),
    ('annual', 'Annual'),
]

CATEGORY_KIND_CHOICES = [
    ('income', 'Income'),
    ('expense', 'Expense'),
]

LEDGER_SOURCE_CHOICES = [
    ('manager_statement', 'Property manager statement'),
    ('qb_pnl', 'QuickBooks P&L export'),
    ('rent_roll', 'Rent roll workbook'),
    ('manual', 'Entered by hand'),
]


class RentalProperty(models.Model):
    """One rentable property — a house, a commercial building, a barn yard.

    ``farm`` is nullable because off-ranch investment property has no ranch.
    ``location_type`` is a separate field rather than a derivation from that
    null, because the two questions genuinely differ: which ranch is this on,
    versus does this belong in the farming view at all.
    """

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='rental_properties'
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='rental_properties',
        help_text="The ranch this property stands on. Required when on-ranch.",
    )
    parcel = models.ForeignKey(
        'FarmParcel',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rental_properties',
        help_text="APN this property sits on, where known",
    )
    owning_entity = models.ForeignKey(
        'LegalEntity',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='rental_properties',
        help_text=(
            "Entity holding title. Deliberately independent of location_type — "
            "Thacher Creek LLC owns both an on-ranch house and an off-ranch "
            "13-unit building."
        ),
    )

    name = models.CharField(
        max_length=200,
        help_text="As it appears in the books, e.g. '1553 Rio Vista House Rental'",
    )
    location_type = models.CharField(
        max_length=20,
        choices=LOCATION_TYPE_CHOICES,
        db_index=True,
        help_text=(
            "Location rule, not entity rule. Never derive this from whether "
            "farm is null."
        ),
    )
    property_type = models.CharField(
        max_length=20,
        choices=PROPERTY_TYPE_CHOICES,
        default='dwelling',
        help_text=(
            "Not everything that earns rent is a house — Saticoy's Barn/Yard "
            "Rental is the largest single line in Finch Farms LLC at $12,480."
        ),
    )
    pnl_treatment = models.CharField(
        max_length=30,
        choices=PNL_TREATMENT_CHOICES,
        default='non_operating',
        help_text="Defaults to non_operating so the farming boundary holds by default",
    )

    qb_class_path = models.CharField(
        max_length=300,
        blank=True,
        help_text=(
            "Full QuickBooks class tree path, e.g. "
            "'Income > Ranches > Rentals > Office > 956 Orange'. Nesting depth "
            "in the exports is encoded by column index, not by the label."
        ),
    )

    address = models.CharField(max_length=300, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, blank=True, default='CA')
    zip_code = models.CharField(max_length=10, blank=True)

    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="False for sold or no-longer-rented property. Excluded from roll-ups.",
    )
    acquired_on = models.DateField(null=True, blank=True)
    disposed_on = models.DateField(null=True, blank=True)

    note = models.TextField(
        blank=True,
        help_text="Reconciliation notes, especially where a property is double-booked",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'rental properties'
        ordering = ['farm__name', 'name']
        indexes = [
            models.Index(fields=['company', 'location_type']),
            models.Index(fields=['farm', 'is_active']),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(location_type='on_ranch', farm__isnull=False)
                    | models.Q(location_type='off_ranch')
                ),
                name='rentalproperty_on_ranch_requires_farm',
            ),
        ]

    def __str__(self):
        where = self.farm.name if self.farm_id else self.get_location_type_display()
        return f'{self.name} ({where})'

    @property
    def is_on_ranch(self):
        return self.location_type == 'on_ranch'

    @property
    def unit_count(self):
        """Actual units. Shown next to occupant count precisely because the
        rent roll's own total confuses the two."""
        return self.units.count()


class RentalUnit(models.Model):
    """A separately-let space within a property.

    Single-family houses get exactly one unit. Modelling them uniformly means
    the rent roll never has two code paths, and a house that is later split
    does not require a migration.
    """

    rental_property = models.ForeignKey(
        RentalProperty, on_delete=models.CASCADE, related_name='units'
    )
    unit_label = models.CharField(
        max_length=50,
        help_text="As the manager keys it, e.g. '359'. Use 'whole' for single-unit property.",
    )

    bedrooms = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )
    bathrooms = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )
    square_feet = models.PositiveIntegerField(null=True, blank=True)

    is_rent_controlled = models.BooleanField(
        default=False,
        help_text=(
            "Ojai rent control applies to the Ventura St building. Drives "
            "turnover-decontrol sequencing, so it must be per-unit."
        ),
    )
    is_available = models.BooleanField(default=False)

    note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['rental_property__name', 'unit_label']
        constraints = [
            models.UniqueConstraint(
                fields=['rental_property', 'unit_label'],
                name='uniq_rentalunit_property_label',
            ),
        ]

    def __str__(self):
        return f'{self.rental_property.name} — {self.unit_label}'

    @property
    def current_lease(self):
        return self.leases.filter(is_active=True).order_by('-start_date').first()


class Lease(models.Model):
    """A letting of one unit. Rent lives here.

    Dates are nullable and that is not an oversight: there is not one lease
    date in any source file this operation has. A lease row with a rent and no
    dates is the honest representation of what is actually known, and it still
    produces a correct rent roll. The expiry calendar stays unbuilt until real
    dates exist rather than being fabricated from assumptions.
    """

    unit = models.ForeignKey(
        RentalUnit, on_delete=models.CASCADE, related_name='leases'
    )

    occupant_label = models.CharField(
        max_length=200,
        blank=True,
        help_text=(
            "Free-text occupant reference as the manager keys it, e.g. "
            "'Vasquez'. Deliberately not a Tenant record — see module docstring."
        ),
    )

    monthly_rent = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Contract rent for this unit. The only place rent is stored.",
    )
    deposit = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(
        null=True, blank=True, help_text="Null means open-ended or simply unknown"
    )

    is_active = models.BooleanField(default=True, db_index=True)
    note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['unit__rental_property__name', 'unit__unit_label', '-start_date']
        indexes = [
            models.Index(fields=['unit', 'is_active']),
        ]

    def __str__(self):
        who = self.occupant_label or 'unoccupied'
        return f'{self.unit} — {who} @ {self.monthly_rent}/mo'

    @property
    def annual_rent(self):
        return (self.monthly_rent or Decimal('0')) * 12


class RentalCategory(models.Model):
    """An income or expense line as the books name it.

    Kept as data rather than a choices list because the QuickBooks trees differ
    per entity — Finch Farms LLC splits every property into Income and
    Utilities, RMLF does not — and an import must be able to land an unmapped
    category rather than silently dropping it.
    """

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='rental_categories'
    )
    name = models.CharField(max_length=100, help_text="e.g. 'Utilities', 'Property Tax'")
    kind = models.CharField(max_length=10, choices=CATEGORY_KIND_CHOICES)
    qb_account_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Source account label, so an unmapped line can still be traced",
    )
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'rental categories'
        ordering = ['kind', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'name'],
                name='uniq_rentalcategory_company_name',
            ),
        ]

    def __str__(self):
        return f'{self.name} ({self.get_kind_display()})'


class RentalLedgerEntry(models.Model):
    """One period's charged and paid amount for one property/unit/category.

    ``period_month`` is nullable, and the null carries meaning: it marks an
    annual-grain figure. On-ranch houses exist in the books only as annual P&L
    totals; off-ranch property is reported monthly by the manager. Forcing
    either into the other's shape would invent precision or destroy it, so both
    live here and ``grain`` reports which is which. The two are never summed
    into a single blended figure on screen.
    """

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='rental_ledger_entries'
    )
    rental_property = models.ForeignKey(
        RentalProperty, on_delete=models.CASCADE, related_name='ledger_entries'
    )
    unit = models.ForeignKey(
        RentalUnit,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='ledger_entries',
        help_text="Null when the figure is whole-property grain",
    )
    category = models.ForeignKey(
        RentalCategory,
        on_delete=models.PROTECT,
        related_name='ledger_entries',
    )

    period_year = models.PositiveSmallIntegerField(db_index=True)
    period_month = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(12)],
        help_text="Null means this row is the annual figure for period_year",
    )

    amount_charged = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0'),
        help_text="What was billed. One row per period — never one row per split payment.",
    )
    amount_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0'),
        help_text="What was collected, summed across split payments",
    )

    source = models.CharField(
        max_length=30, choices=LEDGER_SOURCE_CHOICES, default='manual'
    )
    is_flagged = models.BooleanField(
        default=False,
        db_index=True,
        help_text=(
            "Import could not fully trust this row. $3,916.90 appears as the "
            "annual figure for three different properties across two entities "
            "and two years — flagged, not silently cleaned."
        ),
    )
    flag_reason = models.TextField(blank=True)
    note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'rental ledger entries'
        ordering = ['-period_year', '-period_month', 'rental_property__name']
        indexes = [
            models.Index(fields=['company', 'period_year']),
            models.Index(fields=['rental_property', 'period_year', 'period_month']),
            models.Index(fields=['is_flagged']),
        ]

    def __str__(self):
        when = f'{self.period_year}-{self.period_month:02d}' if self.period_month else str(self.period_year)
        return f'{self.rental_property.name} {self.category.name} {when}: {self.amount_charged}'

    @property
    def grain(self):
        return 'monthly' if self.period_month else 'annual'

    @property
    def amount_outstanding(self):
        """Delinquency, free. Negative means overpaid — which happens, and
        should be visible rather than clamped to zero."""
        return (self.amount_charged or Decimal('0')) - (self.amount_paid or Decimal('0'))

    @property
    def is_delinquent(self):
        return self.amount_outstanding > 0
