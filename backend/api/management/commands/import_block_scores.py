"""Import a block report card bundle.

The platform renders grades; it does not compute them. This command lands a
bundle produced by export_block_bundle as one snapshot, reports exactly what
changed against the currently published card, and — only when asked — makes it
the live one.

Three rules it will not bend:

* **A bundle that failed verification cannot land quietly.** The engine's
  verify_data.py is the trust boundary. If its checks did not all pass, the
  import is refused unless --allow-unverified is passed, and every figure from
  that snapshot is badged for as long as it exists.
* **A confirmed unit-to-field mapping is never overwritten.** Someone looked at
  a block and said "this is that Field". An import re-running does not get to
  disagree.
* **Publishing is separate from importing.** A bundle lands staged. The
  previously published card keeps serving until someone reads the diff and
  publishes, so a bad export cannot change a grade on screen by itself.

    python manage.py import_block_scores --bundle block_bundle.json \\
        --company "Finch Farms" --publish
"""

import io
import json
import os
from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_datetime

from api.models import (
    BlockEvidenceRef,
    BlockScoreBenchmark,
    BlockScoreGate,
    BlockScoreSnapshot,
    BlockScorecard,
    BlockSeasonMetric,
    Company,
    ScoringUnit,
)


def _dec(value, places='0.01'):
    if value is None or value == '':
        return None
    try:
        return Decimal(str(value)).quantize(Decimal(places))
    except (InvalidOperation, ValueError, TypeError):
        return None


class Command(BaseCommand):
    help = 'Import a block report card bundle produced by export_block_bundle'

    def add_arguments(self, parser):
        parser.add_argument('--bundle', required=True)
        parser.add_argument('--company', default='Finch Farms')
        parser.add_argument('--publish', action='store_true',
                            help='Make this the live card after importing')
        parser.add_argument('--allow-unverified', action='store_true',
                            help='Import a bundle whose verification did not fully '
                                 'pass. Every figure from it is badged.')
        parser.add_argument('--dry-run', action='store_true',
                            help='Report the diff and write nothing')

    def handle(self, *args, **options):
        path = options['bundle']
        if not os.path.exists(path):
            raise CommandError(f'Bundle not found: {path}')

        with io.open(path, encoding='utf-8') as fh:
            bundle = json.load(fh)

        meta = bundle.get('meta') or {}
        if meta.get('schema') != 1:
            raise CommandError(f'Unsupported bundle schema: {meta.get("schema")!r}')

        company = Company.objects.filter(name__icontains=options['company']).first()
        if not company:
            raise CommandError(f'Company "{options["company"]}" not found')

        passed = int(meta.get('verify_checks_passed') or 0)
        total = int(meta.get('verify_checks_total') or 0)
        verified = total > 0 and passed == total

        self.stdout.write('')
        self.stdout.write(f'Bundle:        {os.path.basename(path)}')
        self.stdout.write(f'Generated:     {meta.get("generated_at", "?")}')
        self.stdout.write(f'Source db:     {(meta.get("pack_db_sha256") or "?")[:16]}')
        self.stdout.write(f'Verification:  {passed}/{total}'
                          f'{"" if verified else "  <-- NOT FULLY VERIFIED"}')
        self.stdout.write(f'Grades:        {len(bundle.get("grades", []))}')
        self.stdout.write(f'Units:         {len(bundle.get("units", []))}')
        self.stdout.write('')

        if not verified and not options['allow_unverified']:
            raise CommandError(
                f'Refusing to import: verification is {passed}/{total}. The '
                f"engine's own checks are the trust boundary for these grades. "
                f'Fix the run, or pass --allow-unverified to import anyway — '
                f'every figure will be badged as unverified wherever it appears.'
            )

        self._report_diff(company, bundle)

        if options['dry_run']:
            self.stdout.write(self.style.WARNING(
                'Dry run — nothing written.'
            ))
            return

        with transaction.atomic():
            snapshot = self._create_snapshot(company, meta, verified)
            units = self._sync_units(company, bundle.get('units', []))
            n_cards = self._load_grades(snapshot, units, bundle.get('grades', []))
            n_seasons = self._load_seasons(snapshot, units, bundle.get('seasons', []))
            n_gates = self._load_gates(snapshot, units, bundle.get('gates', []))
            n_bench = self._load_benchmarks(snapshot, bundle.get('benchmarks', []))
            n_evid = self._load_evidence(snapshot, units, bundle.get('evidence', []))

            if options['publish']:
                snapshot.publish()

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'[OK] snapshot {snapshot.pk}: {len(units)} units, {n_cards} cards, '
            f'{n_seasons} season rows, {n_gates} gates, {n_bench} benchmarks, '
            f'{n_evid} citations.'
        ))
        if snapshot.forced:
            self.stdout.write(self.style.ERROR(
                'This snapshot is UNVERIFIED. Every figure it serves must be badged.'
            ))
        if options['publish']:
            self.stdout.write('Published — this is now the live card.')
        else:
            self.stdout.write(
                f'Staged. The previously published card is still live. '
                f'Publish with: --publish'
            )

        provisional = [b for b in bundle.get('benchmarks', []) if b.get('status') == 'DEFAULT']
        if provisional:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING(
                f'{len(provisional)} benchmark constant(s) are still DEFAULT. Any '
                f'percentage measured against these must say so on screen:'
            ))
            for b in provisional:
                self.stdout.write(f'    {b["factor"]}.{b["parameter"]} = {b["value"]} {b["unit"]}')

    # -- diff -------------------------------------------------------------

    def _report_diff(self, company, bundle):
        """What would change on screen, before anything is written."""
        live = BlockScoreSnapshot.objects.filter(
            company=company, is_published=True
        ).first()
        if not live:
            self.stdout.write('No published card yet — this would be the first.')
            self.stdout.write('')
            return

        current = {
            c.unit.uid: (c.overall, c.acres)
            for c in BlockScorecard.objects.filter(snapshot=live).select_related('unit')
        }
        changes, new = [], []
        for g in bundle.get('grades', []):
            uid = g['uid']
            incoming = (g.get('overall') or '', _dec(g.get('acres')))
            if uid not in current:
                new.append(f'    + {uid}: {incoming[0]}')
            elif current[uid][0] != incoming[0]:
                changes.append(f'    ~ {uid}: {current[uid][0]} -> {incoming[0]}')
            elif current[uid][1] != incoming[1]:
                changes.append(f'    ~ {uid}: acres {current[uid][1]} -> {incoming[1]}')

        gone = sorted(set(current) - {g['uid'] for g in bundle.get('grades', [])})

        self.stdout.write(f'Against published snapshot {live.pk}:')
        if changes:
            self.stdout.write('  grade or acreage changes:')
            for line in changes:
                self.stdout.write(line)
        if new:
            self.stdout.write('  newly graded:')
            for line in new:
                self.stdout.write(line)
        if gone:
            self.stdout.write('  no longer graded:')
            for uid in gone:
                self.stdout.write(f'    - {uid}')
        if not (changes or new or gone):
            self.stdout.write('  no change to any letter grade.')
        self.stdout.write('')

    # -- writers ----------------------------------------------------------

    def _create_snapshot(self, company, meta, verified):
        generated = meta.get('generated_at')
        return BlockScoreSnapshot.objects.create(
            company=company,
            engine_version=meta.get('engine_version') or '',
            bundle_generated_at=parse_datetime(generated) if generated else None,
            pack_db_sha256=meta.get('pack_db_sha256') or '',
            verify_checks_passed=meta.get('verify_checks_passed') or 0,
            verify_checks_total=meta.get('verify_checks_total') or 0,
            forced=not verified,
            grade_window_start=meta.get('grade_window_start'),
            grade_window_end=meta.get('grade_window_end'),
            trend_window_start=meta.get('trend_window_start'),
            trend_window_end=meta.get('trend_window_end'),
        )

    def _sync_units(self, company, rows):
        """Upsert the unit registry. Never touches a confirmed mapping."""
        units = {}
        for row in rows:
            unit, created = ScoringUnit.objects.get_or_create(
                company=company, uid=row['uid'],
                defaults={
                    'display_name': row.get('display_name') or '',
                    'ranch_code': row.get('ranch_code') or '',
                    'crop_code': row.get('crop_code') or '',
                    'block_label': row.get('block_label') or '',
                    'first_year': row.get('first_year'),
                    'last_year': row.get('last_year'),
                },
            )
            if not created:
                changed = []
                # Refresh descriptive fields, but leave farm/field alone when a
                # person has confirmed the mapping.
                for attr, key in (
                    ('display_name', 'display_name'), ('ranch_code', 'ranch_code'),
                    ('crop_code', 'crop_code'), ('block_label', 'block_label'),
                    ('first_year', 'first_year'), ('last_year', 'last_year'),
                ):
                    incoming = row.get(key)
                    if incoming not in (None, '') and getattr(unit, attr) != incoming:
                        setattr(unit, attr, incoming)
                        changed.append(attr)
                if changed:
                    unit.save(update_fields=changed)
            units[row['uid']] = unit
        return units

    def _load_grades(self, snapshot, units, rows):
        cards = []
        for r in rows:
            unit = units.get(r['uid'])
            if unit is None:
                continue
            cards.append(BlockScorecard(
                snapshot=snapshot, unit=unit,
                overall=r.get('overall') or '',
                gpa=_dec(r.get('gpa')),
                grades_on_file=r.get('grades_on_file') or 0,
                acres=_dec(r.get('acres')),
                acres_basis=(r.get('acres_basis') or '')[:200],
                yield_grade=r.get('yield_grade') or '',
                yield_ctn_ac=_dec(r.get('yield_ctn_ac'), '0.1'),
                yield_pct_of_standard=_dec(r.get('yield_pct_of_standard'), '0.1'),
                revenue_grade=r.get('revenue_grade') or '',
                revenue_per_acre=_dec(r.get('revenue_per_acre')),
                revenue_pct_of_standard=_dec(r.get('revenue_pct_of_standard'), '0.1'),
                quality_grade=r.get('quality_grade') or '',
                fresh_packout_pct=_dec(r.get('fresh_packout_pct'), '0.1'),
                quality_trend_grade=r.get('quality_trend_grade') or '',
                quality_trend_pts_yr=_dec(r.get('quality_trend_pts_yr')),
                size_trend_grade=r.get('size_trend_grade') or '',
                money_share_trend_pts_yr=_dec(r.get('money_share_trend_pts_yr')),
                avg_size=_dec(r.get('avg_size'), '0.1'),
                money_size_share_pct=_dec(r.get('money_size_share_pct'), '0.1'),
                avg_size_drift_counts_yr=_dec(r.get('avg_size_drift_counts_yr')),
                timing_score=_dec(r.get('timing_score'), '0.1'),
                peak_share_pct=_dec(r.get('peak_share_pct'), '0.1'),
                strong_share_pct=_dec(r.get('strong_share_pct'), '0.1'),
                soft_share_pct=_dec(r.get('soft_share_pct'), '0.1'),
                flush_share_pct=_dec(r.get('flush_share_pct'), '0.1'),
                picks_per_season=_dec(r.get('picks_per_season'), '0.1'),
                note=r.get('note') or '',
            ))
        BlockScorecard.objects.bulk_create(cards, batch_size=200)
        return len(cards)

    def _load_seasons(self, snapshot, units, rows):
        objs = []
        for r in rows:
            unit = units.get(r['uid'])
            if unit is None:
                continue
            objs.append(BlockSeasonMetric(
                snapshot=snapshot, unit=unit, season=r['season'],
                packed_cartons=_dec(r.get('packed_cartons'), '0.1'),
                cartons_per_acre=_dec(r.get('cartons_per_acre'), '0.1'),
                pct_of_standard=_dec(r.get('pct_of_standard'), '0.1'),
                pool_revenue=_dec(r.get('pool_revenue')),
                revenue_per_acre=_dec(r.get('revenue_per_acre')),
                season_standard_rev_per_acre=_dec(r.get('season_standard_rev_per_acre')),
                fresh_packout_pct=_dec(r.get('fresh_packout_pct'), '0.1'),
                avg_size=_dec(r.get('avg_size'), '0.1'),
                money_size_share_pct=_dec(r.get('money_size_share_pct'), '0.1'),
                timing_score=_dec(r.get('timing_score'), '0.1'),
                pick_rounds=r.get('pick_rounds'),
                pick_months=(r.get('pick_months') or '')[:120],
                revenue_note=(r.get('revenue_note') or '')[:200],
            ))
        BlockSeasonMetric.objects.bulk_create(objs, batch_size=500)
        return len(objs)

    def _load_gates(self, snapshot, units, rows):
        objs = []
        for r in rows:
            unit = units.get(r['uid'])
            if unit is None:
                continue
            objs.append(BlockScoreGate(
                snapshot=snapshot, unit=unit,
                subscore=r['subscore'],
                score=_dec(r.get('score')),
                value_basis=(r.get('value_basis') or '')[:200],
                gate_reason=r.get('gate_reason') or '',
            ))
        BlockScoreGate.objects.bulk_create(objs, batch_size=500)
        return len(objs)

    def _load_benchmarks(self, snapshot, rows):
        objs = [
            BlockScoreBenchmark(
                snapshot=snapshot, factor=r['factor'], parameter=r['parameter'],
                value=str(r.get('value'))[:200], unit=(r.get('unit') or '')[:32],
                source=r.get('source') or '', status=(r.get('status') or '')[:16],
                notes=r.get('notes') or '',
            )
            for r in rows
        ]
        BlockScoreBenchmark.objects.bulk_create(objs, batch_size=200)
        return len(objs)

    def _load_evidence(self, snapshot, units, rows):
        objs = []
        for r in rows:
            unit = units.get(r['uid'])
            if unit is None:
                continue
            objs.append(BlockEvidenceRef(
                snapshot=snapshot, unit=unit,
                doc_id=r['doc_id'], family=(r.get('family') or '')[:24],
                year=r.get('year'),
                relpath=(r.get('relpath') or '').replace('\\', '/')[:500],
                page_start=r.get('page_start'), page_end=r.get('page_end'),
                canonical=bool(r.get('canonical', True)),
                needs_review=bool(r.get('needs_review', False)),
                cartons=_dec(r.get('cartons'), '0.1'),
            ))
        BlockEvidenceRef.objects.bulk_create(objs, batch_size=1000)
        return len(objs)
