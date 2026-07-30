"""Match contractor invoices to the packing house's own Direct Charges.

Port of the local pipeline's reconcile.py, structurally line-for-line so the
two can be diffed. The strategies, ranking, exclusions, and the per-account
``used`` allocation set are identical:

    exact      one charge row whose debit equals the invoice
    reference  every charge row under one AP reference sums to the invoice
    block      the rows under one AP reference for one block sum to the invoice
    subset     some subset of one AP reference's rows sums to the invoice

with a ``+combined`` suffix when the pick+haul pool was used (VPOA bills both
kinds on one contractor invoice). A charge dated before the pick cannot pay
for it; a charge on a different block is a different job. Anything left over
is reported, not guessed at.

What this NEVER writes: ``date_rec_from_ph``. That is the human record of
money arriving — a different event from the house posting the charge.

DEVIATIONS from the local pipeline, both deliberate:

* Winning allocations are persisted as PickHaulChargeMatch rows (locally they
  lived only in memory), which is what makes unmatched charges a first-class
  query — gate 11's $360K blind spot.
* An invoice that loses its match on a re-run has its derived columns cleared
  (locally, ``match_method`` was set to 'unmatched' but a stale
  ``charge_posted``/``ap_reference`` could linger — with the chase list keyed
  on ``charge_posted``, that staleness would hide real money).
"""

from dataclasses import dataclass, field
from decimal import Decimal
from itertools import combinations

from django.db import transaction

from api.models import PickHaulChargeMatch, PickHaulDirectCharge, PickHaulInvoice
from .config import (
    AMOUNT_TOLERANCE, BILL_SLACK_DAYS, LAG_OUTLIER_DAYS,
    MAX_SUBSET_ROWS, MAX_SUBSET_SIZE,
)


@dataclass
class Match:
    invoice_id: int
    method: str
    charge_ids: list
    ap_reference: str
    charge_date: object          # datetime.date | None
    total: Decimal
    blocks: set = field(default_factory=set)


def _close(a, b, tol=AMOUNT_TOLERANCE):
    return abs(Decimal(a) - Decimal(b)) <= tol


def _charges(company, season, packinghouse_id, entity_id, kind):
    rows = PickHaulDirectCharge.objects.filter(
        company=company, season=season,
        packinghouse_id=packinghouse_id, entity_id=entity_id,
        kind=kind, debit__gt=0,
    ).order_by('charge_date', 'id').values(
        'id', 'ap_reference', 'block_raw', 'charge_date', 'debit', 'qty'
    )
    # Normalise blanks to None so the block/reference logic matches the local
    # pipeline, whose SQLite columns hold NULL where Django holds ''.
    return [
        {**r,
         'ap_reference': r['ap_reference'] or None,
         'block_raw': r['block_raw'] or None}
        for r in rows
    ]


def _invoices(company, season, packinghouse_id, entity_id, kind):
    rows = PickHaulInvoice.objects.filter(
        company=company, season=season,
        packinghouse_id=packinghouse_id, entity_id=entity_id,
        kind=kind, amount__isnull=False,
    ).order_by('date_from', 'id').values(
        'id', 'contractor', 'invoice_no', 'amount', 'block_raw',
        'date_from', 'date_to', 'date_rec_from_ph',
    )
    return [{**r, 'block_raw': r['block_raw'] or None} for r in rows]


STRATEGY_RANK = {'exact': 0, 'reference': 1, 'block': 1, 'subset': 3}


def _candidates(inv, pool, tol, kind_label):
    """Every way this invoice's amount can be made from the available charges."""
    amount = inv['amount']
    found = []

    def add(method, rows):
        dates = [r['charge_date'] for r in rows if r['charge_date']]
        found.append(Match(
            invoice_id=inv['id'],
            method=method if kind_label == 'same' else f'{method}+combined',
            charge_ids=[r['id'] for r in rows],
            ap_reference=rows[0]['ap_reference'],
            charge_date=max(dates) if dates else None,
            total=sum((r['debit'] for r in rows), Decimal('0')),
            blocks={r['block_raw'] for r in rows},
        ))

    for c in pool:
        if _close(c['debit'], amount, tol):
            add('exact', [c])

    by_ref = {}
    for c in pool:
        by_ref.setdefault(c['ap_reference'] or '', []).append(c)

    for rows in by_ref.values():
        if len(rows) > 1 and _close(sum(r['debit'] for r in rows), amount, tol):
            add('reference', rows)

        by_block = {}
        for r in rows:
            by_block.setdefault(r['block_raw'] or '', []).append(r)
        for brows in by_block.values():
            if len(brows) > 1 and _close(sum(r['debit'] for r in brows), amount, tol):
                add('block', brows)

        if len(rows) <= MAX_SUBSET_ROWS:
            for size in range(2, min(MAX_SUBSET_SIZE, len(rows)) + 1):
                for combo in combinations(rows, size):
                    if _close(sum(r['debit'] for r in combo), amount, tol):
                        add('subset', list(combo))
    return found


def _plausible(m, inv):
    """Hard filters, plus how far the charge sits from the pick.

    Both are exclusions, not penalties — this is what stops a February hauling
    charge from paying an April invoice just because both are $1,344.00.
    """
    d_from, d_to = inv['date_from'], inv['date_to']
    d_charge = m.charge_date

    if inv['block_raw'] and m.blocks and None not in m.blocks:
        if not any(b == inv['block_raw'] for b in m.blocks):
            return False, 0

    if d_charge and d_from and (d_charge - d_from).days < -BILL_SLACK_DAYS:
        return False, 0

    if d_charge and d_to:
        return True, abs((d_charge - d_to).days)
    return True, 999  # undated charge: allowed, but ranked last


def _match_one(inv, same_kind, other_kind, used, tol):
    """Best plausible match, preferring same-kind charges over pick+haul combined."""
    avail_same = [c for c in same_kind if c['id'] not in used]
    avail_other = [c for c in other_kind if c['id'] not in used]

    cands = _candidates(inv, avail_same, tol, 'same')
    # VPOA bills pick and haul on one contractor invoice; allow the combined pool.
    cands += _candidates(inv, avail_same + avail_other, tol, 'combined')

    scored = []
    for m in cands:
        ok, dist = _plausible(m, inv)
        if not ok:
            continue
        base = m.method.split('+')[0]
        scored.append(((0 if '+combined' not in m.method else 1,
                        STRATEGY_RANK[base], dist), m))
    if not scored:
        return None
    scored.sort(key=lambda t: t[0])
    return scored[0][1]


def _accounts(company, season):
    """Distinct (packinghouse_id, entity_id) pairs with invoices or charges."""
    pairs = set(PickHaulInvoice.objects.filter(company=company, season=season)
                .values_list('packinghouse_id', 'entity_id'))
    pairs |= set(PickHaulDirectCharge.objects.filter(company=company, season=season)
                 .values_list('packinghouse_id', 'entity_id'))
    return sorted(pairs)


@transaction.atomic
def run_reconciliation(company, season):
    """Match every invoice it can. Rebuilds all derived match state for the season."""
    tol = AMOUNT_TOLERANCE
    summary = []
    disagreements = []
    offsets = []
    method_counts = {}

    # Matches are derived state: rebuild from scratch each run, exactly as the
    # local pipeline rewrites the derived invoice columns on every run.
    PickHaulChargeMatch.objects.filter(
        invoice__company=company, invoice__season=season
    ).delete()

    for packinghouse_id, entity_id in _accounts(company, season):
        # Charge rows are shared across both kinds for an account, so allocation
        # is tracked per account rather than per kind — otherwise a PICK invoice
        # matched via the combined pool could hand the same HAUL row out twice.
        used = set()
        pools = {
            k: _charges(company, season, packinghouse_id, entity_id, k)
            for k in ('PICK', 'HAUL')
        }

        for kind in ('PICK', 'HAUL'):
            invoices = _invoices(company, season, packinghouse_id, entity_id, kind)
            if not invoices:
                continue
            charges = pools[kind]
            other = pools['HAUL' if kind == 'PICK' else 'PICK']
            matched = 0

            for inv in invoices:
                m = _match_one(inv, charges, other, used, tol)
                if not m:
                    # DEVIATION: clear stale derived fields (see module docstring).
                    PickHaulInvoice.objects.filter(pk=inv['id']).update(
                        match_method='unmatched', ap_reference='', charge_posted=None,
                    )
                    method_counts['unmatched'] = method_counts.get('unmatched', 0) + 1
                    continue

                used.update(m.charge_ids)
                matched += 1
                method_counts[m.method] = method_counts.get(m.method, 0) + 1

                # An operator-entered date is the record of what actually
                # arrived; if it disagrees with the charge date beyond normal
                # lag, say so rather than quietly leaving it.
                existing = inv['date_rec_from_ph']
                if existing and m.charge_date and existing != m.charge_date:
                    lag = (existing - m.charge_date).days
                    offsets.append(lag)
                    if abs(lag) > LAG_OUTLIER_DAYS:
                        disagreements.append({
                            'invoice_id': inv['id'], 'kind': kind,
                            'contractor': inv['contractor'],
                            'invoice_no': inv['invoice_no'],
                            'amount': str(inv['amount']),
                            'entered': existing.isoformat(),
                            'charge_date': m.charge_date.isoformat(),
                            'ap_reference': m.ap_reference, 'lag': lag,
                        })

                # 'date_rec_from_ph' is the human record of money arriving and
                # is never written here — it is a different event.
                PickHaulInvoice.objects.filter(pk=inv['id']).update(
                    ap_reference=m.ap_reference or '',
                    match_method=m.method,
                    charge_posted=m.charge_date,
                )
                PickHaulChargeMatch.objects.bulk_create([
                    PickHaulChargeMatch(invoice_id=inv['id'], charge_id=cid, method=m.method)
                    for cid in m.charge_ids
                ])

            summary.append({
                'packinghouse_id': packinghouse_id, 'entity_id': entity_id,
                'kind': kind, 'invoices': len(invoices), 'matched': matched,
                'charges': len(charges), 'charges_used': len(used),
            })

    lag = None
    if offsets:
        ordered = sorted(offsets)
        lag = {'n': len(ordered), 'median': ordered[len(ordered) // 2],
               'min': ordered[0], 'max': ordered[-1]}

    total = sum(a['invoices'] for a in summary)
    matched_total = sum(a['matched'] for a in summary)
    return {
        'invoices': total, 'matched': matched_total,
        'unmatched': total - matched_total,
        'method_counts': method_counts,
        'accounts': summary, 'disagreements': disagreements, 'lag': lag,
    }
