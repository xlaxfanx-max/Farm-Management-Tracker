"""Harvest activity: the season's real deliveries, with costs attached.

This is what makes pick & haul data *be* the harvest record rather than sit
next to it. One unified, block-grouped view of portal receipts and hand-keyed
manual picks, each carrying its share of the matched contractor invoices.

Cost allocation rule: an invoice's amount is spread over the receipts it
covers proportional to bins. That is an attribution for display — the invoice
itself remains the money record, and rows whose costs are allocated (rather
than keyed directly, as manual picks are) are labelled as such.
"""

from collections import defaultdict
from decimal import Decimal

from django.db.models import Count, Sum

from api.models import (
    PickHaulDirectCharge, PickHaulInvoice, PickHaulInvoiceReceipt,
    PickHaulManualPick, PickHaulReceipt,
)


def _allocate_invoice_costs(company, season):
    """Per-receipt {receipt_id: {'PICK': Decimal, 'HAUL': Decimal}} plus the
    invoice references behind each receipt, allocated proportional to bins."""
    costs = defaultdict(lambda: {'PICK': Decimal('0'), 'HAUL': Decimal('0')})
    refs = defaultdict(list)

    links = (
        PickHaulInvoiceReceipt.objects.filter(
            invoice__company=company, invoice__season=season,
            invoice__amount__isnull=False,
        )
        .select_related('invoice', 'receipt')
    )
    by_invoice = defaultdict(list)
    for link in links:
        by_invoice[link.invoice].append(link.receipt)

    for invoice, receipts in by_invoice.items():
        total_bins = sum((r.bins or Decimal('0')) for r in receipts)
        for receipt in receipts:
            if total_bins > 0:
                share = (invoice.amount or Decimal('0')) * (receipt.bins or Decimal('0')) / total_bins
            else:
                share = (invoice.amount or Decimal('0')) / len(receipts)
            costs[receipt.pk][invoice.kind] += share
            refs[receipt.pk].append({
                'kind': invoice.kind,
                'invoice_no': invoice.invoice_no,
                'contractor': invoice.contractor,
                'invoice_id': invoice.pk,
            })
    return costs, refs


def season_money_stats(company, season):
    """Season-wide money summary shared by the Deliveries view and the
    season overview: invoice + manual costs, the chase list total (grower-
    paid invoices only), and gate-11 unmatched house charges."""
    invoice_totals = {
        row['kind']: row['total']
        for row in PickHaulInvoice.objects.filter(
            company=company, season=season, amount__isnull=False,
        ).values('kind').annotate(total=Sum('amount'))
    }
    manual_cost = PickHaulManualPick.objects.filter(
        company=company, season=season, count_cost=True,
    ).aggregate(t=Sum('cost'))['t'] or Decimal('0')
    manual_haul = PickHaulManualPick.objects.filter(
        company=company, season=season, count_haul=True,
    ).aggregate(t=Sum('haul_cost'))['t'] or Decimal('0')

    owed = PickHaulInvoice.objects.filter(
        company=company, season=season, billing='direct',
        date_emailed__isnull=False, charge_posted__isnull=True,
    ).aggregate(total=Sum('amount'), n=Count('id'))
    unmatched = PickHaulDirectCharge.objects.filter(
        company=company, season=season, kind__in=('PICK', 'HAUL'),
        debit__gt=0, match__isnull=True, ack__isnull=True,
    ).aggregate(total=Sum('debit'), n=Count('id'))

    return {
        'pick_cost': (invoice_totals.get('PICK') or Decimal('0')) + manual_cost,
        'haul_cost': (invoice_totals.get('HAUL') or Decimal('0')) + manual_haul,
        'owed_total': owed['total'] or Decimal('0'),
        'owed_count': owed['n'] or 0,
        'unmatched_charges': {
            'rows': unmatched['n'] or 0,
            'total': unmatched['total'] or Decimal('0'),
        },
    }


def harvest_activity(company, season):
    """The season's deliveries grouped by block, plus the money summary."""
    costs, refs = _allocate_invoice_costs(company, season)

    blocks = {}

    def block_bucket(house_code, entity_code, label):
        key = (house_code, label)
        if key not in blocks:
            blocks[key] = {
                'block': label or '(no block)', 'house_code': house_code,
                'entity_code': entity_code,
                'bins': Decimal('0'), 'pick_cost': Decimal('0'),
                'haul_cost': Decimal('0'), 'deliveries': [],
            }
        return blocks[key]

    receipts = PickHaulReceipt.objects.filter(
        company=company, season=season,
    ).select_related('packinghouse', 'entity').order_by('block_raw', 'pick_date')
    for r in receipts:
        pick = costs[r.pk]['PICK']
        haul = costs[r.pk]['HAUL']
        bucket = block_bucket(r.packinghouse.short_code, r.entity.short_code, r.block_raw)
        if r.is_active:
            bucket['bins'] += r.bins or Decimal('0')
            bucket['pick_cost'] += pick
            bucket['haul_cost'] += haul
        bucket['deliveries'].append({
            'id': r.pk, 'kind': 'receipt',
            'receipt_no': r.receipt_no,
            'pick_date': r.pick_date,
            'pick_date_raw': r.pick_date_raw,
            'bins': r.bins,
            'pick_cost': pick or None,
            'haul_cost': haul or None,
            'cost_basis': 'allocated' if (pick or haul) else None,
            'invoice_refs': refs.get(r.pk, []),
            'is_active': r.is_active,
        })

    picks = PickHaulManualPick.objects.filter(
        company=company, season=season,
    ).select_related('packinghouse', 'entity').order_by('sheet', 'row_no')
    for p in picks:
        label = ' · '.join(x for x in (p.ranch, p.block) if x) or p.sheet
        bucket = block_bucket(p.packinghouse.short_code, p.entity.short_code, label)
        bucket['bins'] += p.bins or Decimal('0')
        if p.count_cost:
            bucket['pick_cost'] += p.cost or Decimal('0')
        if p.count_haul:
            bucket['haul_cost'] += p.haul_cost or Decimal('0')
        bucket['deliveries'].append({
            'id': p.pk, 'kind': 'manual',
            'sheet': p.sheet,
            'pick_date': p.pick_date,
            'date_label': p.date_label,
            'varietal': p.varietal,
            'bins': p.bins, 'lbs': p.lbs,
            'pick_cost': p.cost, 'haul_cost': p.haul_cost,
            'cost_basis': 'keyed',
            'count_cost': p.count_cost, 'count_haul': p.count_haul,
            'harvester': p.harvester, 'invoice_no': p.invoice_no,
            'is_active': True,
        })

    # ---- season money summary -------------------------------------------
    money = season_money_stats(company, season)
    pick_cost = money['pick_cost']
    haul_cost = money['haul_cost']

    bins_delivered = sum(b['bins'] for b in blocks.values())
    deliveries_count = sum(len(b['deliveries']) for b in blocks.values())

    total_cost = pick_cost + haul_cost
    ordered = sorted(blocks.values(), key=lambda b: -b['bins'])

    return {
        'season': season,
        'stats': {
            'bins_delivered': bins_delivered,
            'deliveries': deliveries_count,
            'pick_cost': pick_cost,
            'haul_cost': haul_cost,
            'cost_per_bin': (total_cost / bins_delivered) if bins_delivered else None,
            'owed_total': money['owed_total'],
            'owed_count': money['owed_count'],
            'unmatched_charges': money['unmatched_charges'],
        },
        'blocks': ordered,
    }
