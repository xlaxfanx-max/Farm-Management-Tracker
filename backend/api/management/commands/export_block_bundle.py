"""Build a portable bundle of the block report card.

Runs on the machine that holds the scoring engine — the source database is
7.6 MB across 29 tables, built from 2,112 PDFs, and its evidence folder is
~133 MB of rendered page images. None of that can live on a web host. This
command reduces it to one JSON of a few hundred kilobytes: the grades, the
season rows behind them, the gate reasons, the benchmark constants and their
firmness, and citations to the source documents without the images.

The verification tally travels with the bundle. Run the engine's own
verify_data.py first and pass its result; the importer refuses a bundle whose
checks did not all pass unless it is explicitly forced.

    python manage.py export_block_bundle \\
        --pack-db "<...>/_Database/pack_reports.db" \\
        --block-scoring "<...>/Block Scoring" \\
        --verify-passed 37 --verify-total 37 \\
        --out block_bundle.json
"""

import csv
import hashlib
import io
import json
import os
import sqlite3
from datetime import datetime, timezone

from django.core.management.base import BaseCommand, CommandError

GRADES_CSV = 'Finch_Report_Card_Grades.csv'
SEASONS_CSV = 'Finch_Report_Card_Seasons.csv'


def _num(value):
    """CSV cells are strings; empty means 'not graded', which is not zero."""
    if value is None:
        return None
    value = str(value).strip()
    if value in ('', '-', '—', 'n/a', 'N/A'):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _grade(value):
    """A letter or nothing. Never a zero."""
    if not value:
        return ''
    value = str(value).strip()
    return value if value in ('A', 'B', 'C', 'D', 'F') else ''


def _split_uid(uid):
    """{RANCH3}-{CROP}-{Block}; some units have no block segment."""
    parts = uid.split('-', 2)
    ranch = parts[0] if parts else ''
    crop = parts[1] if len(parts) > 1 else ''
    block = parts[2] if len(parts) > 2 else ''
    return ranch, crop, block


class Command(BaseCommand):
    help = 'Export the block report card to a portable JSON bundle'

    def add_arguments(self, parser):
        parser.add_argument('--pack-db', required=True, help='Path to pack_reports.db')
        parser.add_argument('--block-scoring', required=True,
                            help='Directory holding the report-card CSVs')
        parser.add_argument('--out', required=True, help='Bundle path to write')
        parser.add_argument('--verify-passed', type=int, required=True,
                            help="Checks passed in the engine's verify_data.py run")
        parser.add_argument('--verify-total', type=int, required=True,
                            help='Total checks in that run')
        parser.add_argument('--engine-version', default='', help='Optional label')
        parser.add_argument('--grade-window', default='2023-2025')
        parser.add_argument('--trend-window', default='2020-2025')

    def handle(self, *args, **options):
        pack_db = options['pack_db']
        scoring_dir = options['block_scoring']
        for path, what in ((pack_db, 'pack database'), (scoring_dir, 'block-scoring directory')):
            if not os.path.exists(path):
                raise CommandError(f'{what} not found: {path}')

        grades_path = os.path.join(scoring_dir, GRADES_CSV)
        seasons_path = os.path.join(scoring_dir, SEASONS_CSV)
        for path in (grades_path, seasons_path):
            if not os.path.exists(path):
                raise CommandError(f'Report-card CSV not found: {path}')

        passed, total = options['verify_passed'], options['verify_total']
        if total <= 0:
            raise CommandError('--verify-total must be positive')
        if passed < total:
            self.stdout.write(self.style.WARNING(
                f'Verification is {passed}/{total} — not all checks passed. The '
                f'bundle will be written and marked unverified; importing it '
                f'requires --allow-unverified and badges every figure.'
            ))

        conn = sqlite3.connect(pack_db)
        conn.row_factory = sqlite3.Row

        grades = self._read_grades(grades_path)
        seasons = self._read_seasons(seasons_path)
        gates = self._read_gates(conn)
        benchmarks = self._read_benchmarks(conn)
        evidence = self._read_evidence(conn)
        units = self._build_units(conn, grades, seasons, gates)
        conn.close()

        gw = self._window(options['grade_window'])
        tw = self._window(options['trend_window'])

        bundle = {
            'meta': {
                'schema': 1,
                'generated_at': datetime.now(timezone.utc).isoformat(),
                'engine_version': options['engine_version'],
                'pack_db_sha256': self._sha256(pack_db),
                'verify_checks_passed': passed,
                'verify_checks_total': total,
                'grade_window_start': gw[0], 'grade_window_end': gw[1],
                'trend_window_start': tw[0], 'trend_window_end': tw[1],
            },
            'units': units,
            'grades': grades,
            'seasons': seasons,
            'gates': gates,
            'benchmarks': benchmarks,
            'evidence': evidence,
        }

        with io.open(options['out'], 'w', encoding='utf-8', newline='\n') as fh:
            json.dump(bundle, fh, indent=1, ensure_ascii=False)

        size_kb = os.path.getsize(options['out']) / 1024
        self.stdout.write('')
        self.stdout.write(f'  units       {len(units)}')
        self.stdout.write(f'  grades      {len(grades)}')
        self.stdout.write(f'  seasons     {len(seasons)}')
        self.stdout.write(f'  gates       {len(gates)}')
        self.stdout.write(f'  benchmarks  {len(benchmarks)}'
                          f'  ({sum(1 for b in benchmarks if b["status"] == "DEFAULT")} DEFAULT)')
        self.stdout.write(f'  evidence    {len(evidence)}')
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'[OK] {options["out"]} ({size_kb:.0f} KB), verification {passed}/{total}'
        ))

    # -- readers ----------------------------------------------------------

    @staticmethod
    def _sha256(path):
        h = hashlib.sha256()
        with open(path, 'rb') as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b''):
                h.update(chunk)
        return h.hexdigest()

    @staticmethod
    def _window(text):
        try:
            start, end = str(text).split('-')
            return int(start), int(end)
        except (ValueError, AttributeError):
            return None, None

    def _read_grades(self, path):
        out = []
        with io.open(path, encoding='utf-8-sig') as fh:
            for row in csv.DictReader(fh):
                uid = (row.get('uid') or '').strip()
                if not uid:
                    continue
                letters = [
                    _grade(row.get(k)) for k in (
                        'yield_grade', 'revenue_grade', 'quality_grade',
                        'quality_trend_grade', 'size_trend_grade')
                ]
                out.append({
                    'uid': uid,
                    'display_name': (row.get('block') or '').strip(),
                    'overall': (row.get('overall') or '').strip(),
                    'gpa': _num(row.get('gpa')),
                    'grades_on_file': sum(1 for g in letters if g),
                    'acres': _num(row.get('acres')),
                    'yield_grade': letters[0],
                    'yield_ctn_ac': _num(row.get('yield_ctn_ac')),
                    'yield_pct_of_standard': _num(row.get('yield_pct_of_standard')),
                    'revenue_grade': letters[1],
                    'revenue_per_acre': _num(row.get('revenue_per_acre')),
                    'revenue_pct_of_standard': _num(row.get('revenue_pct_of_standard')),
                    'quality_grade': letters[2],
                    'fresh_packout_pct': _num(row.get('fresh_packout_pct')),
                    'quality_trend_grade': letters[3],
                    'quality_trend_pts_yr': _num(row.get('quality_trend_pts_yr')),
                    'size_trend_grade': letters[4],
                    'money_share_trend_pts_yr': _num(row.get('money_share_trend_pts_yr')),
                    'avg_size': _num(row.get('avg_size')),
                    'money_size_share_pct': _num(row.get('money_size_share_pct')),
                    'avg_size_drift_counts_yr': _num(row.get('avg_size_drift_counts_yr')),
                    'timing_score': _num(row.get('timing_score_pct_of_season_avg_price')),
                    'peak_share_pct': _num(row.get('peak_share_pct')),
                    'strong_share_pct': _num(row.get('strong_share_pct')),
                    'soft_share_pct': _num(row.get('soft_share_pct')),
                    'flush_share_pct': _num(row.get('flush_share_pct')),
                    'picks_per_season': _num(row.get('picks_per_season')),
                    'note': (row.get('note') or '').strip(),
                })
        return out

    def _read_seasons(self, path):
        out = []
        with io.open(path, encoding='utf-8-sig') as fh:
            for row in csv.DictReader(fh):
                uid = (row.get('uid') or '').strip()
                season = _num(row.get('season'))
                if not uid or season is None:
                    continue
                pick_rounds = _num(row.get('pick_rounds'))
                out.append({
                    'uid': uid,
                    'season': int(season),
                    'packed_cartons': _num(row.get('packed_cartons')),
                    'cartons_per_acre': _num(row.get('cartons_per_acre')),
                    'pct_of_standard': _num(row.get('pct_of_standard')),
                    'pool_revenue': _num(row.get('pool_revenue')),
                    'revenue_per_acre': _num(row.get('revenue_per_acre')),
                    'season_standard_rev_per_acre': _num(row.get('season_standard_rev_per_acre')),
                    'fresh_packout_pct': _num(row.get('fresh_packout_pct')),
                    'avg_size': _num(row.get('avg_size')),
                    'money_size_share_pct': _num(row.get('money_size_share_pct')),
                    'timing_score': _num(row.get('timing_score')),
                    'pick_rounds': int(pick_rounds) if pick_rounds is not None else None,
                    'pick_months': (row.get('pick_months') or '').strip(),
                    'revenue_note': (row.get('revenue_note') or '').strip(),
                })
        return out

    def _read_gates(self, conn):
        return [
            {
                'uid': r['uid'],
                'subscore': r['subscore'],
                'score': r['score'],
                'value_basis': r['value_basis'] or '',
                'gate_reason': r['gate_reason'] or '',
            }
            for r in conn.execute(
                'SELECT uid, subscore, score, value_basis, gate_reason FROM unit_score'
            )
        ]

    def _read_benchmarks(self, conn):
        return [
            {
                'factor': r['factor'], 'parameter': r['parameter'],
                'value': str(r['value']), 'unit': r['unit'] or '',
                'source': r['source'] or '', 'status': r['status'] or '',
                'notes': r['notes'] or '',
            }
            for r in conn.execute(
                'SELECT factor, parameter, value, unit, source, status, notes '
                'FROM scoring_benchmark'
            )
        ]

    def _read_evidence(self, conn):
        out = []
        for r in conn.execute(
            'SELECT uid, doc_id, family, year, relpath, page_start, page_end, '
            'canonical, needs_review, cartons FROM unit_doc'
        ):
            # The engine stores Windows separators. Normalising here is what
            # keeps the citation usable on a Linux host — the same backslash
            # problem breaks the engine's own verification off-Windows.
            relpath = (r['relpath'] or '').replace('\\', '/')
            out.append({
                'uid': r['uid'], 'doc_id': r['doc_id'],
                'family': r['family'] or '', 'year': r['year'],
                'relpath': relpath,
                'page_start': r['page_start'], 'page_end': r['page_end'],
                'canonical': bool(r['canonical']),
                'needs_review': bool(r['needs_review']),
                'cartons': r['cartons'],
            })
        return out

    def _build_units(self, conn, grades, seasons, gates):
        """Every unit the engine knows, not only the graded ones.

        Fifteen blocks carry letter grades; sixty exist. Exporting only the
        graded ones would hide the other forty-five and make the card look like
        complete coverage of the farm, which it is not.

        `unit_metric` also carries a `_FARM_` sentinel holding farm-level
        context — the lemon farm price per year that the price index is
        measured against, the premium size set, the portable net per carton.
        That is not a block and must not appear as one.
        """
        names = {g['uid']: g['display_name'] for g in grades if g['display_name']}
        years = {}
        for s in seasons:
            lo, hi = years.get(s['uid'], (None, None))
            season = s['season']
            years[s['uid']] = (
                season if lo is None else min(lo, season),
                season if hi is None else max(hi, season),
            )

        uids = {g['uid'] for g in gates} | {g['uid'] for g in grades} | set(years)
        try:
            uids |= {r[0] for r in conn.execute('SELECT DISTINCT uid FROM unit_metric')}
        except sqlite3.Error:
            pass

        # Sentinels are wrapped in underscores by convention (_FARM_).
        sentinels = {u for u in uids if u.startswith('_')}
        if sentinels:
            self.stdout.write(
                f'  (excluding {len(sentinels)} non-block sentinel(s): '
                f'{", ".join(sorted(sentinels))})'
            )
        uids -= sentinels

        out = []
        for uid in sorted(uids):
            ranch, crop, block = _split_uid(uid)
            first, last = years.get(uid, (None, None))
            out.append({
                'uid': uid,
                'display_name': names.get(uid, ''),
                'ranch_code': ranch, 'crop_code': crop, 'block_label': block,
                'first_year': first, 'last_year': last,
            })
        return out
