"""The rules that keep an imported grade trustworthy.

The platform renders grades computed elsewhere. That is only safe while four
things hold, so each is pinned here:

  * a bundle that failed the engine's verification cannot land quietly
  * a missing grade stays missing — it never becomes an F
  * publishing is a separate act from importing
  * a mapping a person confirmed is never overwritten by a re-import
"""

import io
import json
import tempfile
from decimal import Decimal
from pathlib import Path

from django.core.management import CommandError, call_command
from django.test import TestCase

from api.models import (
    BlockScoreGate,
    BlockScoreSnapshot,
    BlockScorecard,
    Farm,
    ScoringUnit,
)
from api.tests.factories import TestDataFactory


def _bundle(passed=37, total=37, grades=None, units=None, **extra):
    return {
        'meta': {
            'schema': 1,
            'generated_at': '2026-07-30T12:00:00+00:00',
            'engine_version': 'test',
            'pack_db_sha256': 'a' * 64,
            'verify_checks_passed': passed,
            'verify_checks_total': total,
            'grade_window_start': 2023, 'grade_window_end': 2025,
            'trend_window_start': 2020, 'trend_window_end': 2025,
        },
        'units': units if units is not None else [{
            'uid': 'SAT-LEM-Block1B', 'display_name': 'Saticoy · Block 1B',
            'ranch_code': 'SAT', 'crop_code': 'LEM', 'block_label': 'Block1B',
            'first_year': 2020, 'last_year': 2025,
        }],
        'grades': grades if grades is not None else [{
            'uid': 'SAT-LEM-Block1B', 'display_name': 'Saticoy · Block 1B',
            'overall': 'A−', 'gpa': 3.8, 'grades_on_file': 5, 'acres': 15.0,
            'yield_grade': 'A', 'revenue_grade': 'A', 'quality_grade': 'B',
            'quality_trend_grade': 'A', 'size_trend_grade': 'A',
        }],
        'seasons': extra.get('seasons', []),
        'gates': extra.get('gates', []),
        'benchmarks': extra.get('benchmarks', []),
        'evidence': extra.get('evidence', []),
    }


class BundleImportTests(TestCase):

    def setUp(self):
        self.factory = TestDataFactory()
        self.company = self.factory.create_company(name='Finch Farms')
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)

    def _write(self, bundle):
        path = Path(self._tmp.name) / 'bundle.json'
        io.open(path, 'w', encoding='utf-8').write(json.dumps(bundle))
        return str(path)

    # -- the verification gate -------------------------------------------

    def test_unverified_bundle_is_refused(self):
        path = self._write(_bundle(passed=34, total=37))
        with self.assertRaises(CommandError) as ctx:
            call_command('import_block_scores', bundle=path,
                         company='Finch Farms', verbosity=0)
        self.assertIn('34/37', str(ctx.exception))
        self.assertFalse(BlockScoreSnapshot.objects.exists())

    def test_unverified_bundle_can_be_forced_but_is_marked(self):
        path = self._write(_bundle(passed=34, total=37))
        call_command('import_block_scores', bundle=path, company='Finch Farms',
                     allow_unverified=True, verbosity=0)
        snap = BlockScoreSnapshot.objects.get()
        self.assertTrue(snap.forced)
        self.assertFalse(snap.fully_verified)

    def test_fully_verified_bundle_imports_without_a_flag(self):
        path = self._write(_bundle())
        call_command('import_block_scores', bundle=path, company='Finch Farms',
                     verbosity=0)
        snap = BlockScoreSnapshot.objects.get()
        self.assertFalse(snap.forced)
        self.assertTrue(snap.fully_verified)

    # -- a dash is not a zero --------------------------------------------

    def test_missing_grades_stay_missing(self):
        """San Antonio Creek has too few seasons for a trend grade.

        Storing 'F' or 0 there would say the block failed, when the engine said
        it could not tell. The GPA denominator must shrink instead.
        """
        bundle = _bundle(
            units=[{'uid': 'SAC-LEM', 'display_name': 'San Antonio Creek',
                    'ranch_code': 'SAC', 'crop_code': 'LEM', 'block_label': ''}],
            grades=[{
                'uid': 'SAC-LEM', 'overall': 'B−', 'gpa': 2.67,
                'grades_on_file': 3, 'acres': 7.0,
                'yield_grade': 'C', 'revenue_grade': 'C', 'quality_grade': 'A',
                'quality_trend_grade': '', 'size_trend_grade': '',
            }],
        )
        call_command('import_block_scores', bundle=self._write(bundle),
                     company='Finch Farms', verbosity=0)
        card = BlockScorecard.objects.get()
        self.assertEqual(card.quality_trend_grade, '')
        self.assertEqual(card.size_trend_grade, '')
        self.assertEqual(card.grades_on_file, 3)
        self.assertEqual(card.graded_letters, ['C', 'C', 'A'])
        self.assertEqual(card.gpa, Decimal('2.67'))

    def test_a_gated_factor_keeps_its_reason_and_no_score(self):
        bundle = _bundle(gates=[{
            'uid': 'SAT-LEM-Block1B', 'subscore': 'P2', 'score': None,
            'value_basis': '', 'gate_reason': 'awaiting real bearing acres',
        }])
        call_command('import_block_scores', bundle=self._write(bundle),
                     company='Finch Farms', verbosity=0)
        gate = BlockScoreGate.objects.get()
        self.assertIsNone(gate.score)
        self.assertTrue(gate.is_gated)
        self.assertEqual(gate.gate_reason, 'awaiting real bearing acres')

    # -- publishing ------------------------------------------------------

    def test_import_does_not_publish_by_itself(self):
        call_command('import_block_scores', bundle=self._write(_bundle()),
                     company='Finch Farms', verbosity=0)
        self.assertFalse(BlockScoreSnapshot.objects.get().is_published)

    def test_publishing_replaces_the_previous_card_atomically(self):
        for _ in range(2):
            call_command('import_block_scores', bundle=self._write(_bundle()),
                         company='Finch Farms', publish=True, verbosity=0)
        published = BlockScoreSnapshot.objects.filter(is_published=True)
        self.assertEqual(published.count(), 1)
        self.assertEqual(published.get(), BlockScoreSnapshot.objects.first())

    def test_a_failed_import_cannot_change_the_live_card(self):
        call_command('import_block_scores', bundle=self._write(_bundle()),
                     company='Finch Farms', publish=True, verbosity=0)
        live = BlockScoreSnapshot.objects.get(is_published=True)

        with self.assertRaises(CommandError):
            call_command('import_block_scores',
                         bundle=self._write(_bundle(passed=30, total=37)),
                         company='Finch Farms', publish=True, verbosity=0)

        self.assertEqual(BlockScoreSnapshot.objects.get(is_published=True), live)

    # -- mappings --------------------------------------------------------

    def test_a_confirmed_mapping_survives_reimport(self):
        farm = self.factory.create_farm(self.company, name='Saticoy')
        call_command('import_block_scores', bundle=self._write(_bundle()),
                     company='Finch Farms', verbosity=0)

        unit = ScoringUnit.objects.get(uid='SAT-LEM-Block1B')
        unit.farm = farm
        unit.mapping_confirmed = True
        unit.save()

        call_command('import_block_scores', bundle=self._write(_bundle()),
                     company='Finch Farms', verbosity=0)

        unit.refresh_from_db()
        self.assertEqual(unit.farm, farm)
        self.assertTrue(unit.mapping_confirmed)

    def test_units_are_reused_across_snapshots(self):
        for _ in range(3):
            call_command('import_block_scores', bundle=self._write(_bundle()),
                         company='Finch Farms', verbosity=0)
        self.assertEqual(ScoringUnit.objects.count(), 1)
        self.assertEqual(BlockScoreSnapshot.objects.count(), 3)
        self.assertEqual(BlockScorecard.objects.count(), 3)

    # -- portability -----------------------------------------------------

    def test_windows_separators_are_normalised(self):
        """The engine stores backslashes; they break its own verify off-Windows."""
        bundle = _bundle(evidence=[{
            'uid': 'SAT-LEM-Block1B', 'doc_id': 42, 'family': 'pool',
            'year': 2024,
            'relpath': 'Saticoy\\Pool Statements 2024\\SLA 2024.pdf',
            'page_start': 1, 'page_end': 2,
            'canonical': True, 'needs_review': False, 'cartons': 100.0,
        }])
        call_command('import_block_scores', bundle=self._write(bundle),
                     company='Finch Farms', verbosity=0)
        from api.models import BlockEvidenceRef
        ref = BlockEvidenceRef.objects.get()
        self.assertNotIn('\\', ref.relpath)
        self.assertEqual(ref.relpath, 'Saticoy/Pool Statements 2024/SLA 2024.pdf')
