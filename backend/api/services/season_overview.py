"""The deliveries-first season overview.

Composes the two halves of a season that no single module holds:

* the DELIVERY side — pick & haul receipts and manual picks, with contractor
  costs — which is live all season, and
* the SETTLEMENT side — pool settlements from statement uploads — which is
  *supposed* to lag by months.

Settlement % is settled ÷ DELIVERED (receipts are the denominator), and
net-to-grower = settlement net return − allocated pick & haul cost, emitted
only where both sides exist. Cash received rolls up ledger entries
(advances / pool closes / payments) plus reimbursements actually received on
grower-paid invoices.
"""

from collections import defaultdict
from decimal import Decimal

from django.db.models import Count, Sum

from api.models import (
    GrowerLedgerEntry, PackerCommitment, PickHaulInvoice,
    PickHaulInvoiceReceipt, PickHaulManualPick, PickHaulReceipt,
    Pool, PoolSettlement,
)
from api.services.pickhaul.activity import season_money_stats
from api.services.season_service import (
    get_crop_category_for_commodity,
    get_primary_unit_for_commodity,
    normalize_commodity,
    season_int_to_label,
    season_label_to_int,
)

UNMAPPED = 'UNMAPPED'


def _receipt_commodity(receipt):
    """Best-effort canonical commodity for a receipt row."""
    raw = receipt.commodity_code or receipt.variety_code or ''
    canonical = normalize_commodity(raw)
    if canonical in _known_canonicals():
        return canonical
    return UNMAPPED


_KNOWN = None


def _known_canonicals():
    global _KNOWN
    if _KNOWN is None:
        from api.services.season_service import COMMODITY_ALIASES
        _KNOWN = set(COMMODITY_ALIASES.keys())
    return _KNOWN


def _delivered_by_commodity(company, season):
    """{commodity: {'bins': Decimal, 'deliveries': int}} from active receipts
    plus manual picks."""
    out = defaultdict(lambda: {'bins': Decimal('0'), 'deliveries': 0})

    receipts = PickHaulReceipt.objects.filter(
        company=company, season=season, is_active=True,
    ).only('commodity_code', 'variety_code', 'bins')
    for r in receipts:
        bucket = out[_receipt_commodity(r)]
        bucket['bins'] += r.bins or Decimal('0')
        bucket['deliveries'] += 1

    picks = PickHaulManualPick.objects.filter(company=company, season=season)
    for p in picks:
        raw = (p.varietal or '').strip()
        canonical = normalize_commodity(raw) if raw else UNMAPPED
        if canonical not in _known_canonicals():
            canonical = UNMAPPED
        bucket = out[canonical]
        bucket['bins'] += p.bins or Decimal('0')
        bucket['deliveries'] += 1

    return out


def _cost_by_commodity(company, season):
    """Allocate invoice amounts to commodities proportional to the bins of
    their linked receipts; invoices with no receipt links (and manual pick
    costs) fall back to their own commodity signal or UNMAPPED."""
    out = defaultdict(lambda: Decimal('0'))

    links = PickHaulInvoiceReceipt.objects.filter(
        invoice__company=company, invoice__season=season,
        invoice__amount__isnull=False,
    ).select_related('invoice', 'receipt')

    by_invoice = defaultdict(list)
    for link in links:
        by_invoice[link.invoice].append(link.receipt)

    linked_invoice_ids = set()
    for invoice, receipts in by_invoice.items():
        linked_invoice_ids.add(invoice.pk)
        amount = invoice.amount or Decimal('0')
        total_bins = sum((r.bins or Decimal('0')) for r in receipts)
        if total_bins > 0:
            per_commodity_bins = defaultdict(lambda: Decimal('0'))
            for r in receipts:
                per_commodity_bins[_receipt_commodity(r)] += r.bins or Decimal('0')
            for commodity, bins in per_commodity_bins.items():
                out[commodity] += amount * bins / total_bins
        else:
            out[UNMAPPED] += amount

    unlinked = PickHaulInvoice.objects.filter(
        company=company, season=season, amount__isnull=False,
    ).exclude(pk__in=linked_invoice_ids)
    for inv in unlinked:
        out[UNMAPPED] += inv.amount or Decimal('0')

    for p in PickHaulManualPick.objects.filter(company=company, season=season):
        raw = (p.varietal or '').strip()
        canonical = normalize_commodity(raw) if raw else UNMAPPED
        if canonical not in _known_canonicals():
            canonical = UNMAPPED
        if p.count_cost and p.cost:
            out[canonical] += p.cost
        if p.count_haul and p.haul_cost:
            out[canonical] += p.haul_cost

    return out


def _settlements_by_commodity(company, season):
    """Settlement aggregates per canonical commodity, matching pools whose
    free-text season label parses to this season's end year."""
    out = {}
    settlements = PoolSettlement.objects.filter(
        pool__packinghouse__company=company,
    ).select_related('pool')

    for s in settlements:
        if season_label_to_int(s.pool.season) != season:
            continue
        commodity = normalize_commodity(s.pool.commodity or '')
        if commodity not in _known_canonicals():
            commodity = UNMAPPED
        bucket = out.setdefault(commodity, {
            'settlements': 0,
            'settled_bins': Decimal('0'),
            'settled_lbs': Decimal('0'),
            'net_return': Decimal('0'),
        })
        bucket['settlements'] += 1
        bucket['settled_bins'] += s.total_bins or Decimal('0')
        bucket['settled_lbs'] += s.total_weight_lbs or Decimal('0')
        bucket['net_return'] += s.net_return or Decimal('0')

    return out


def _actual_houses_by_commodity(company, season):
    """{commodity: [house short codes seen on receipts/manual picks]}"""
    out = defaultdict(set)
    receipts = PickHaulReceipt.objects.filter(
        company=company, season=season, is_active=True,
    ).select_related('packinghouse')
    for r in receipts:
        code = r.packinghouse.short_code or r.packinghouse.name
        out[_receipt_commodity(r)].add(code)
    for p in PickHaulManualPick.objects.filter(
        company=company, season=season,
    ).select_related('packinghouse'):
        raw = (p.varietal or '').strip()
        canonical = normalize_commodity(raw) if raw else UNMAPPED
        if canonical not in _known_canonicals():
            canonical = UNMAPPED
        out[canonical].add(p.packinghouse.short_code or p.packinghouse.name)
    return out


def _cash_received(company, season):
    """Ledger credits (advances / pool closes / payments) for pools in this
    season, plus reimbursements actually received on grower-paid invoices."""
    totals = {'advances': Decimal('0'), 'pool_close': Decimal('0'),
              'payments': Decimal('0')}
    entries = GrowerLedgerEntry.objects.filter(
        packinghouse__company=company,
        entry_type__in=('advance', 'pool_close', 'payment'),
    ).select_related('pool')
    for e in entries:
        if e.pool_id:
            if season_label_to_int(e.pool.season) != season:
                continue
        else:
            # Pool-less entries: attribute by date within the citrus window
            # for this season (Oct season-1 through Sep season).
            if e.entry_date is None:
                continue
            in_window = (
                (e.entry_date.year == season - 1 and e.entry_date.month >= 10)
                or (e.entry_date.year == season and e.entry_date.month <= 9)
            )
            if not in_window:
                continue
        key = {'advance': 'advances', 'pool_close': 'pool_close',
               'payment': 'payments'}[e.entry_type]
        totals[key] += e.credit or Decimal('0')

    reimbursed = PickHaulInvoice.objects.filter(
        company=company, season=season, billing='direct',
        date_rec_from_ph__isnull=False, amount__isnull=False,
    ).aggregate(t=Sum('amount'), n=Count('id'))

    totals['reimbursements'] = reimbursed['t'] or Decimal('0')
    totals['reimbursement_count'] = reimbursed['n'] or 0
    totals['total'] = (
        totals['advances'] + totals['pool_close'] + totals['payments']
        + totals['reimbursements']
    )
    return totals


def _commitments_by_commodity(company, season):
    """{commodity: {'default': {...}|None, 'overrides': [...], 'flex': bool}}"""
    out = {}
    for c in PackerCommitment.objects.filter(
        company=company, season=season,
    ).select_related('packinghouse', 'field'):
        bucket = out.setdefault(c.commodity, {
            'default': None, 'overrides': [], 'flex': False,
        })
        row = {
            'packinghouse': c.packinghouse.short_code or c.packinghouse.name,
            'flex': c.flex,
        }
        if c.field_id:
            row['field'] = c.field.name
            bucket['overrides'].append(row)
        else:
            bucket['default'] = row
        if c.flex:
            bucket['flex'] = True
    return out


def build_season_overview(company, season, include_pickhaul=True):
    """The composed season picture. Without pick & haul permission the
    delivery/cash sections are omitted and settlement data stands alone."""
    result = {'season': season}

    settlements = _settlements_by_commodity(company, season)

    if include_pickhaul:
        money = season_money_stats(company, season)
        delivered = _delivered_by_commodity(company, season)
        costs = _cost_by_commodity(company, season)
        actual_houses = _actual_houses_by_commodity(company, season)
        cash = _cash_received(company, season)

        bins_delivered = sum(d['bins'] for d in delivered.values())
        deliveries = sum(d['deliveries'] for d in delivered.values())
        total_cost = money['pick_cost'] + money['haul_cost']

        result['delivery'] = {
            'bins_delivered': bins_delivered,
            'deliveries': deliveries,
            'pick_cost': money['pick_cost'],
            'haul_cost': money['haul_cost'],
            'total_cost': total_cost,
            'cost_per_bin': (total_cost / bins_delivered) if bins_delivered else None,
            'owed_total': money['owed_total'],
            'owed_count': money['owed_count'],
            'unmatched_charges': money['unmatched_charges'],
        }
        result['cash_received'] = cash
    else:
        delivered = {}
        costs = {}
        actual_houses = {}

    commitments = _commitments_by_commodity(company, season)

    commodity_keys = sorted(
        set(delivered) | set(settlements) | set(commitments),
        key=lambda c: (c == UNMAPPED, c),
    )

    cards = []
    for commodity in commodity_keys:
        d = delivered.get(commodity)
        s = settlements.get(commodity)
        cost = costs.get(commodity)
        unit = get_primary_unit_for_commodity(commodity) \
            if commodity != UNMAPPED else get_primary_unit_for_commodity('OTHER')
        category = get_crop_category_for_commodity(commodity) \
            if commodity != UNMAPPED else 'other'

        card = {
            'commodity': commodity,
            'crop_category': category,
            'season_label': season_int_to_label(season, category),
            'unit': unit['unit'],
            'delivered_bins': d['bins'] if d else None,
            'deliveries': d['deliveries'] if d else None,
            'pickhaul_cost': cost,
            'settlements': s['settlements'] if s else 0,
            'settled_bins': s['settled_bins'] if s else None,
            'settled_lbs': s['settled_lbs'] if s else None,
            'net_return': s['net_return'] if s else None,
            'awaiting_settlement': bool(d and d['bins'] > 0 and not s),
        }

        # Settlement % — settled ÷ delivered, only when both are bins.
        if d and d['bins'] > 0 and s and s['settled_bins'] > 0:
            card['settlement_percent'] = round(
                float(s['settled_bins'] / d['bins'] * 100), 1,
            )
        else:
            card['settlement_percent'] = None

        # Net to grower — both sides must exist.
        if s and cost is not None and s['net_return']:
            net = s['net_return'] - cost
            card['net_to_grower'] = net
            if d and d['bins'] > 0:
                card['net_to_grower_per_bin'] = net / d['bins']
            else:
                card['net_to_grower_per_bin'] = None
        else:
            card['net_to_grower'] = None
            card['net_to_grower_per_bin'] = None

        # Commitment annotation.
        commitment = commitments.get(commodity)
        actual = sorted(actual_houses.get(commodity, set()))
        card['actual_houses'] = actual
        if commitment:
            card['committed'] = commitment
            committed_houses = set()
            if commitment['default']:
                committed_houses.add(commitment['default']['packinghouse'])
            for o in commitment['overrides']:
                committed_houses.add(o['packinghouse'])
            card['commitment_mismatch'] = bool(
                not commitment['flex']
                and actual
                and any(h not in committed_houses for h in actual)
            )
        else:
            card['committed'] = None
            card['commitment_mismatch'] = False

        cards.append(card)

    result['commodities'] = cards
    result['has_settlement_data'] = bool(settlements)
    return result
