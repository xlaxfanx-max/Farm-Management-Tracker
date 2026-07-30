"""The foundation the operations work divides by.

Two behaviours are pinned here because both were wrong first time:

1. Block naming. The 'Setup - Plantings' register has no clean natural key —
   Grand and Thacher Creek rows differ only by variety, Piru and Rio Vista rows
   carry neither code, block nor variety, and Thacher Creek genuinely lists
   'Cara' twice. Keying on code+block alone silently collapsed 41 register rows
   into 25 Fields, losing 16 blocks without any error.

2. Grazing. Foster Park carries ~181 grazing acres against ~137 bearing.
   Grazing takes no irrigation water, so letting it into the per-acre
   denominator would understate water intensity by more than half.
"""

from decimal import Decimal

from django.test import TestCase

from api.management.commands.seed_finch_operation import Command as SeedCommand
from api.models import RanchCropAcreage
from api.tests.factories import TestDataFactory


def _row(ranch, code='', block='', variety='', crop_label='Lemons'):
    return {
        'ranch': ranch, 'code': code, 'block': block, 'variety': variety,
        'crop_label': crop_label, 'crop_code': crop_label.lower(),
    }


class BlockNamingTests(TestCase):
    """Every register row must survive as its own block."""

    def test_rows_differing_only_by_variety_stay_distinct(self):
        rows = [
            _row('Grand', 'Grand', 'House', 'val', 'Valencias'),
            _row('Grand', 'Grand', '', 'GN', 'Mandarins'),
            _row('Grand', 'Grand', '', 'Pixie', 'Pixies'),
            _row('Grand', 'Grand', '', 'Lem', 'Lemons'),
        ]
        names, ambiguous = SeedCommand._block_names(rows)
        self.assertEqual(len(set(names)), 4)
        self.assertEqual(ambiguous, 0)

    def test_rows_with_no_identifier_at_all_stay_distinct(self):
        """Rio Vista rows carry no code, block or variety — only a crop."""
        rows = [
            _row('Rio Vista', crop_label='Lemons'),
            _row('Rio Vista', crop_label='Lemons'),
            _row('Rio Vista', crop_label='Lemons'),
            _row('Rio Vista', crop_label='Avocados'),
        ]
        names, ambiguous = SeedCommand._block_names(rows)
        self.assertEqual(len(set(names)), 4)
        # Three identical lemon rows: two of them needed a suffix.
        self.assertEqual(ambiguous, 2)

    def test_genuine_duplicates_are_counted_not_hidden(self):
        """Thacher Creek lists 'Cara' twice. Both survive, and it is reported."""
        rows = [
            _row('Thacher Creek', 'TCC', '', 'Cara', 'Cara Cara'),
            _row('Thacher Creek', 'TCC', '', 'Cara', 'Cara Cara'),
        ]
        names, ambiguous = SeedCommand._block_names(rows)
        self.assertEqual(len(set(names)), 2)
        self.assertEqual(ambiguous, 1)

    def test_the_collapse_that_started_this(self):
        """The old key (code + block) merged these seven into one."""
        rows = [
            _row('Thacher Creek', 'TCC', '', v, c) for v, c in [
                ('Tango', 'Mandarins'), ('Red Val', 'Valencias'),
                ('Cara', 'Cara Cara'), ('Lem', 'Lemons'),
                ('Pixie', 'Pixies'), ('GN', 'Mandarins'), ('Cara', 'Cara Cara'),
            ]
        ]
        old_key = {f"{r['code']} {r['block']}".strip() for r in rows}
        self.assertEqual(len(old_key), 1)  # the bug

        names, _ = SeedCommand._block_names(rows)
        self.assertEqual(len(set(names)), 7)  # the fix


class AcreageDenominatorTests(TestCase):
    """Grazing ground is not irrigated and must not dilute a per-acre rate."""

    def setUp(self):
        self.factory = TestDataFactory()
        company = self.factory.create_company()
        self.farm = self.factory.create_farm(company, name='Foster Park')
        RanchCropAcreage.objects.create(
            farm=self.farm, crop_code='lemons', year=2025,
            bearing_acres=Decimal('84.89'),
        )
        RanchCropAcreage.objects.create(
            farm=self.farm, crop_code='avocados', year=2025,
            bearing_acres=Decimal('52.08'),
        )
        RanchCropAcreage.objects.create(
            farm=self.farm, crop_code='grazing', year=2025,
            grazing_acres=Decimal('181.03'),
        )

    def test_bearing_acres_sums_the_orchard_only(self):
        self.assertEqual(self.farm.bearing_acres(2025), Decimal('136.97'))

    def test_irrigated_acres_excludes_grazing(self):
        self.assertEqual(self.farm.irrigated_acres(2025), Decimal('136.97'))
        self.assertLess(self.farm.irrigated_acres(2025), Decimal('181.03'))

    def test_water_intensity_would_more_than_halve_if_grazing_leaked_in(self):
        water_cost = Decimal('167030')  # Foster Park 2025
        correct = water_cost / self.farm.irrigated_acres(2025)
        wrong = water_cost / (self.farm.irrigated_acres(2025) + Decimal('181.03'))
        self.assertGreater(correct, wrong * Decimal('2'))

    def test_superseded_rows_are_excluded(self):
        RanchCropAcreage.objects.filter(crop_code='lemons').update(is_superseded=True)
        self.assertEqual(self.farm.bearing_acres(2025), Decimal('52.08'))

    def test_per_crop_filter(self):
        self.assertEqual(
            self.farm.bearing_acres(2025, crop_code='lemons'), Decimal('84.89')
        )
