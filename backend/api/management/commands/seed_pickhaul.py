"""One-time migration of the local pickhaul.db into the platform.

Dry-run by default. The command imports everything, re-runs reconciliation on
the platform, and compares the platform-computed match methods against what
the local pipeline had stored — the fidelity gate. Any divergence refuses
``--commit`` unless ``--allow-divergence`` is passed, in the spirit of the
local migrate.py's verify_round_trip().

    python manage.py seed_pickhaul --db "...\\data\\pickhaul.db"                # dry-run
    python manage.py seed_pickhaul --db "...\\data\\pickhaul.db" --commit

Idempotent: every writer keys on the same natural keys the sync path uses, so
re-running at cutover (to catch invoices typed during the parallel window)
upserts rather than duplicates.
"""

import sqlite3
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from api.models import (
    Company, Packinghouse,
    PickHaulDirectCharge, PickHaulInvoice, PickHaulInvoiceReceipt,
    PickHaulManualPick, PickHaulPull, PickHaulReceipt, PickHaulSyncBatch,
)
from api.services.pickhaul.checks import run_platform_gates
from api.services.pickhaul.codes import HOUSE_NAMES, entity_code
from api.services.pickhaul.reconcile import run_reconciliation


def _d(value):
    """ISO date or None; unparseable text returns None (caller keeps the raw)."""
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _dt(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    return timezone.make_aware(parsed) if timezone.is_naive(parsed) else parsed


def _dec(value):
    if value is None or value == '':
        return None
    return Decimal(str(value))


def _s(value, limit=None):
    text = '' if value is None else str(value)
    return text[:limit] if limit else text


class Command(BaseCommand):
    help = 'Seed pick & haul data from the local pickhaul.db (dry-run by default).'

    def add_arguments(self, parser):
        parser.add_argument('--db', required=True, help='Path to pickhaul.db')
        parser.add_argument('--company', default='Finch Farms')
        parser.add_argument('--commit', action='store_true')
        parser.add_argument('--allow-divergence', action='store_true')

    def handle(self, *args, **options):
        db_path = Path(options['db'])
        if not db_path.exists():
            raise CommandError(f'No such file: {db_path}')
        try:
            company = Company.objects.get(name__icontains=options['company'])
        except Company.DoesNotExist:
            raise CommandError(f'No company matching {options["company"]!r}.')
        except Company.MultipleObjectsReturned:
            raise CommandError(f'Multiple companies match {options["company"]!r}.')

        conn = sqlite3.connect(f'file:{db_path.as_posix()}?mode=ro', uri=True)
        conn.row_factory = sqlite3.Row

        commit = options['commit']
        with transaction.atomic():
            report = self._seed(conn, company)
            divergent = report['divergences']

            self.stdout.write(self._format_report(report))

            if divergent and commit and not options['allow_divergence']:
                raise CommandError(
                    f'{len(divergent)} invoice(s) reconcile differently on the '
                    f'platform than in pickhaul.db (details above). Refusing '
                    f'--commit; investigate or pass --allow-divergence.'
                )
            if not commit:
                transaction.set_rollback(True)
                self.stdout.write(self.style.WARNING(
                    '\nDRY RUN — nothing written. Re-run with --commit to apply.'
                ))
            else:
                self.stdout.write(self.style.SUCCESS('\nCommitted.'))

    # ------------------------------------------------------------------------
    def _seed(self, conn, company):
        houses = {}
        for row in conn.execute('SELECT code, name FROM house'):
            ph, _ = Packinghouse.objects.get_or_create(
                company=company, short_code=row['code'],
                defaults={'name': row['name'] or HOUSE_NAMES.get(row['code'], row['code'])},
            )
            houses[row['code']] = ph

        entities = {}
        from api.models import LegalEntity
        for row in conn.execute('SELECT code, name FROM entity'):
            short = entity_code(row['code'])
            try:
                entities[row['code']] = LegalEntity.objects.get(
                    company=company, short_code=short)
            except LegalEntity.DoesNotExist:
                raise CommandError(
                    f'LegalEntity {short!r} (for pickhaul entity {row["code"]!r}, '
                    f'{row["name"]!r}) does not exist — run seed_finch_operation first.'
                )

        seasons = [r[0] for r in conn.execute('SELECT DISTINCT season FROM receipt')]
        season = max(seasons) if seasons else date.today().year

        batch = PickHaulSyncBatch.objects.create(
            company=company, season=season, kind='seed', status='applied',
            source_label=f'seed_pickhaul from {Path(conn.execute("PRAGMA database_list").fetchone()[2]).name}',
        )

        counts = {}

        # pulls -------------------------------------------------------------
        n = 0
        for row in conn.execute('SELECT * FROM pull'):
            PickHaulPull.objects.get_or_create(
                packinghouse=houses[row['house']], entity=entities[row['entity']],
                season=row['season'],
                pulled_at=_dt(row['pulled_at']) or timezone.now(),
                sha256=_s(row['sha256'], 64),
                defaults={
                    'company': company, 'batch': batch,
                    'file_name': Path(_s(row['file_path'])).name,
                    'header_text': _s(row['header_text'], 300),
                    'header_year': row['header_year'],
                    'row_count': row['row_count'],
                    'status': _s(row['status'], 20) or 'ok',
                    'note': _s(row['note']),
                },
            )
            n += 1
        counts['pulls'] = n

        # receipts ----------------------------------------------------------
        n = 0
        for row in conn.execute('SELECT * FROM receipt'):
            parsed = _d(row['pick_date'])
            PickHaulReceipt.objects.update_or_create(
                packinghouse=houses[row['house']], entity=entities[row['entity']],
                season=row['season'], receipt_no=_s(row['receipt_no'], 50),
                defaults={
                    'company': company,
                    'pool': _s(row['pool'], 100),
                    'block_raw': _s(row['block_raw'], 200),
                    'pick_date': parsed,
                    'pick_date_raw': '' if parsed else _s(row['pick_date'], 40),
                    'pick_time': _s(row['pick_time'], 20),
                    'variety_code': _s(row['variety_code'], 20),
                    'commodity_code': _s(row['commodity_code'], 20),
                    'uom': _s(row['uom'], 20), 'qty': _dec(row['qty']),
                    'uom2': _s(row['uom2'], 20), 'qty2': _dec(row['qty2']),
                    'extra_12': _s(row['extra_12'], 100),
                    'extra_13': _s(row['extra_13'], 100),
                    'bins': _dec(row['bins']),
                    'is_active': bool(row['is_active']),
                    'first_seen_batch': batch, 'last_seen_batch': batch,
                },
            )
            n += 1
        counts['receipts'] = n

        # direct charges ----------------------------------------------------
        n = 0
        for row in conn.execute('SELECT * FROM direct_charge'):
            parsed = _d(row['charge_date'])
            PickHaulDirectCharge.objects.update_or_create(
                packinghouse=houses[row['house']], entity=entities[row['entity']],
                season=row['season'], row_hash=_s(row['row_hash'], 64),
                defaults={
                    'company': company,
                    'pool': _s(row['pool'], 100),
                    'block_raw': _s(row['block_raw'], 200),
                    'charge_date': parsed,
                    'charge_date_raw': '' if parsed else _s(row['charge_date'], 40),
                    'charge_desc': _s(row['charge_desc'], 100),
                    'kind': row['kind'] or 'OTHER',
                    'txn_desc': _s(row['txn_desc'], 200),
                    'ap_reference': _s(row['ap_reference'], 50),
                    'debit': _dec(row['debit']), 'credit': _dec(row['credit']),
                    'qty': _dec(row['qty']), 'uom': _s(row['uom'], 20),
                    'per_unit': _dec(row['per_unit']),
                    'first_seen_batch': batch,
                },
            )
            n += 1
        counts['direct_charges'] = n

        # invoices ----------------------------------------------------------
        invoice_map = {}
        local_methods = {}
        n = 0
        for row in conn.execute('SELECT * FROM invoice'):
            inv, _ = PickHaulInvoice.objects.update_or_create(
                packinghouse=houses[row['house']], entity=entities[row['entity']],
                season=row['season'], kind=row['kind'],
                contractor=row['contractor'], invoice_no=row['invoice_no'],
                amount=_dec(row['amount']),
                defaults={
                    'company': company,
                    'block_raw': _s(row['block_raw'], 200),
                    'date_from': _d(row['date_from']), 'date_to': _d(row['date_to']),
                    'date_paid': _d(row['date_paid']),
                    'date_emailed': _d(row['date_emailed']),
                    'date_rec_from_ph': _d(row['date_rec_from_ph']),
                    'amount_formula': _s(row['amount_formula'], 200),
                    'conflict_fields': _s(row['conflict_fields'], 200),
                    'notes': _s(row['notes']),
                    'source': row['source'] or 'migrated',
                },
            )
            invoice_map[row['id']] = inv
            local_methods[inv.pk] = row['match_method'] or ''
            n += 1
        counts['invoices'] = n

        # invoice-receipt links ---------------------------------------------
        n = missing = 0
        receipt_cache = {
            (r.packinghouse_id, r.entity_id, r.season, r.receipt_no): r.pk
            for r in PickHaulReceipt.objects.filter(company=company)
        }
        for row in conn.execute('SELECT * FROM invoice_receipt'):
            inv = invoice_map.get(row['invoice_id'])
            if inv is None:
                missing += 1
                continue
            receipt_pk = receipt_cache.get((
                houses[row['house']].pk, entities[row['entity']].pk,
                row['season'], _s(row['receipt_no'], 50),
            ))
            if receipt_pk is None:
                missing += 1
                continue
            PickHaulInvoiceReceipt.objects.get_or_create(
                invoice=inv, receipt_id=receipt_pk,
                defaults={'assigned': row['assigned'] or 'migrated'},
            )
            n += 1
        counts['links'] = n
        counts['links_unresolved'] = missing

        # manual picks ------------------------------------------------------
        n = 0
        for row in conn.execute('SELECT * FROM manual_pick'):
            PickHaulManualPick.objects.update_or_create(
                company=company,
                packinghouse=houses[row['house']], entity=entities[row['entity']],
                season=row['season'], sheet=_s(row['sheet'], 50),
                row_no=row['row_no'],
                defaults={
                    'ranch': _s(row['ranch'], 100), 'block': _s(row['block'], 100),
                    'varietal': _s(row['varietal'], 100),
                    'pick_date': _d(row['pick_date']),
                    'date_label': _s(row['date_label'], 40),
                    'bins': _dec(row['bins']), 'lbs': _dec(row['lbs']),
                    'harvester': _s(row['harvester'], 100),
                    'hauler': _s(row['hauler'], 100),
                    'invoice_no': _s(row['invoice_no'], 50),
                    'cost': _dec(row['cost']), 'haul_cost': _dec(row['haul_cost']),
                    'date_paid': _d(row['date_paid']),
                    'packing_house_text': _s(row['packing_house'], 50),
                    'net_amount': _dec(row['net_amount']),
                    'date_received': _d(row['date_received']),
                    'po_received': _s(row['po_received'], 50),
                    'notes': _s(row['notes']),
                    'count_cost': bool(row['count_cost']),
                    'count_haul': bool(row['count_haul']),
                },
            )
            n += 1
        counts['manual_picks'] = n

        # fidelity: recompute and compare -----------------------------------
        recon = run_reconciliation(company, season)
        gates = run_platform_gates(company, season, batch=batch)

        divergences = []
        for inv in PickHaulInvoice.objects.filter(company=company, season=season):
            local = local_methods.get(inv.pk)
            if local is None:
                continue
            platform = inv.match_method or ''
            if (local or '') != platform and not (local == '' and platform == ''):
                divergences.append({
                    'invoice': f'{inv.kind} {inv.contractor or "?"} #{inv.invoice_no or "?"} '
                               f'(${inv.amount or 0})',
                    'local': local or '(none)', 'platform': platform or '(none)',
                })

        batch.counts = counts
        batch.result = {'reconciliation': recon['method_counts'], 'gates': gates}
        batch.save(update_fields=['counts', 'result'])

        return {
            'counts': counts, 'season': season,
            'method_counts': recon['method_counts'],
            'local_method_counts': self._local_method_counts(conn, season),
            'gates': gates, 'divergences': divergences,
        }

    @staticmethod
    def _local_method_counts(conn, season):
        return {
            (row['match_method'] or '(none)'): row['n']
            for row in conn.execute(
                'SELECT match_method, count(*) n FROM invoice WHERE season=? '
                'GROUP BY match_method', (season,),
            )
        }

    def _format_report(self, report):
        lines = [f"Season {report['season']}:"]
        for key, value in report['counts'].items():
            lines.append(f'  {key:18s} {value}')
        lines.append('')
        lines.append('Match methods (platform vs pickhaul.db):')
        keys = sorted(set(report['method_counts']) | set(report['local_method_counts']))
        for k in keys:
            p = report['method_counts'].get(k, 0)
            l = report['local_method_counts'].get(k, 0)
            marker = '' if p == l else '   <-- DIFFERS'
            lines.append(f'  {k:22s} platform {p:4d}   local {l:4d}{marker}')
        lines.append('')
        lines.append(
            f"Platform gates: {report['gates']['errors']} error, "
            f"{report['gates']['warns']} warn, {report['gates']['infos']} info"
        )
        if report['divergences']:
            lines.append('')
            lines.append(f"{len(report['divergences'])} invoice(s) reconcile differently:")
            for d in report['divergences'][:20]:
                lines.append(f"  {d['invoice']}: local={d['local']} platform={d['platform']}")
            if len(report['divergences']) > 20:
                lines.append(f'  ... and {len(report["divergences"]) - 20} more')
        else:
            lines.append('Fidelity: platform reconciliation matches pickhaul.db exactly.')
        return '\n'.join(lines)
