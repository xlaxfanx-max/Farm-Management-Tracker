"""
Tests for the season label <-> integer helpers.

The pick & haul module stores season as a single integer; the convention is
that the integer is the END YEAR of the cross-year label ("2025-2026" -> 2026).
"""

from django.test import SimpleTestCase

from api.services.season_service import (
    season_int_to_label,
    season_label_to_int,
)


class SeasonIntToLabelTests(SimpleTestCase):
    def test_citrus_crosses_calendar_year(self):
        self.assertEqual(season_int_to_label(2026, 'citrus'), '2025-2026')

    def test_subtropical_crosses_calendar_year(self):
        self.assertEqual(season_int_to_label(2026, 'subtropical'), '2025-2026')

    def test_nut_single_year(self):
        self.assertEqual(season_int_to_label(2026, 'nut'), '2026')

    def test_unknown_category_falls_back_to_single_year(self):
        self.assertEqual(season_int_to_label(2026, 'row_crop'), '2026')

    def test_default_category_is_citrus(self):
        self.assertEqual(season_int_to_label(2026), '2025-2026')


class SeasonLabelToIntTests(SimpleTestCase):
    def test_cross_year_label(self):
        self.assertEqual(season_label_to_int('2025-2026'), 2026)

    def test_two_digit_shorthand(self):
        self.assertEqual(season_label_to_int('2025-26'), 2026)

    def test_single_year(self):
        self.assertEqual(season_label_to_int('2026'), 2026)

    def test_whitespace_tolerated(self):
        self.assertEqual(season_label_to_int(' 2025 - 2026 '), 2026)

    def test_garbage_returns_none(self):
        self.assertIsNone(season_label_to_int('SESPE POOL'))

    def test_empty_and_none_return_none(self):
        self.assertIsNone(season_label_to_int(''))
        self.assertIsNone(season_label_to_int(None))


class RoundTripTests(SimpleTestCase):
    def test_round_trip_all_categories(self):
        for category in ('citrus', 'subtropical', 'nut', 'vine', 'other'):
            label = season_int_to_label(2026, category)
            self.assertEqual(
                season_label_to_int(label), 2026,
                f"round trip failed for {category}: {label}",
            )
