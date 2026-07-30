"""Ranch-crop acreage — the shared denominator.

Almost every figure this platform publishes is a rate: dollars per acre, water
per acre, cartons per acre. Those numerators come from different places (pool
statements, well meters, QuickBooks) but they must all divide by the SAME
denominator or two screens will quietly disagree about the same ranch.

This model is that denominator, and it is deliberately separate from
``Field.total_acres``:

* ``RanchCropAcreage`` is ranch x crop x year. It is what the ranch P&L is
  built on and what a water or cost figure divides by. It exists for every
  ranch, including ones with no block detail at all.
* ``Field.total_acres`` is the block numerator, used when a figure is genuinely
  block-grain (a graded block's yield per acre).

They are reconciled against each other, never summed together. A ranch's blocks
routinely do not add up to its ranch acreage — Foster Park's five graded lemon
blocks total 73.60 acres against a ranch figure of 84.89 — and that gap is
information, not an error to paper over.

Bearing vs non-bearing matters more here than in most operations: Rio Vista and
Piru carry substantial non-bearing acreage in active development, and judging
them on a per-planted-acre basis makes a maturing orchard look like a failing
one. Grazing is tracked separately because it takes no irrigation water —
Foster Park's 181 grazing acres would otherwise halve its apparent water
intensity.
"""

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models


CROP_CODE_CHOICES = [
    ('lemons', 'Lemons'),
    ('avocados', 'Avocados'),
    ('valencias', 'Valencias'),
    ('mandarins', 'Mandarins'),
    ('pixies', 'Pixies'),
    ('navels', 'Navels'),
    ('cara_cara', 'Cara Cara'),
    ('other_fruit', 'Other Fruit'),
    ('grazing', 'Grazing / non-orchard'),
]

ACREAGE_SOURCE_CHOICES = [
    ('pnl_setup_acreage', 'Ranch P&L — Setup - Acreage tab'),
    ('plantings', 'Block plantings schedule'),
    ('statement', 'Packinghouse statement derived'),
    ('surveyed', 'Surveyed / legally described'),
    ('estimated', 'Estimated'),
]


class RanchCropAcreage(models.Model):
    """Bearing / non-bearing / grazing acres for one ranch, crop and year."""

    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        related_name='crop_acreage',
    )
    crop_code = models.CharField(max_length=20, choices=CROP_CODE_CHOICES)
    year = models.PositiveSmallIntegerField()

    bearing_acres = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Acres in production — the denominator for yield and revenue rates",
    )
    non_bearing_acres = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Planted but not yet producing (development acreage)",
    )
    grazing_acres = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0'),
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Non-orchard ground. Takes no irrigation water.",
    )

    source = models.CharField(
        max_length=30,
        choices=ACREAGE_SOURCE_CHOICES,
        default='pnl_setup_acreage',
    )
    is_superseded = models.BooleanField(
        default=False,
        db_index=True,
        help_text=(
            "True when a better figure has replaced this one. Superseded rows "
            "are kept so a published number can still be traced to what it was "
            "computed against, but they are excluded from every roll-up."
        ),
    )
    note = models.TextField(
        blank=True,
        help_text="Why this figure is what it is, especially where sources conflict",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'ranch crop acreage'
        verbose_name_plural = 'ranch crop acreage'
        ordering = ['farm__name', 'crop_code', '-year']
        indexes = [
            models.Index(fields=['farm', 'year']),
            models.Index(fields=['year', 'crop_code']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['farm', 'crop_code', 'year'],
                condition=models.Q(is_superseded=False),
                name='uniq_active_ranch_crop_year_acreage',
            ),
        ]

    def __str__(self):
        return f"{self.farm.name} {self.get_crop_code_display()} {self.year}: {self.bearing_acres} bearing"

    @property
    def planted_acres(self):
        """Bearing plus non-bearing. Excludes grazing — nothing is planted there."""
        return (self.bearing_acres or Decimal('0')) + (self.non_bearing_acres or Decimal('0'))

    @property
    def irrigated_acres(self):
        """Acres that actually take water. Same as planted_acres; named
        separately because water cost divides by this and it must not silently
        start including grazing ground."""
        return self.planted_acres
