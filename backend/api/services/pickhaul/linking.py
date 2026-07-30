"""Attach invoices to the receipts they cover.

Port of the local ``entry.link_entry_invoices``: same rule the data already
follows — same account, pick date inside the invoice's range, same block when
the invoice names one. Links created this way are ``assigned='rule'``.

DEVIATION from the local pipeline, deliberate: locally, rule links only ever
accumulated (INSERT OR IGNORE), so editing an invoice's dates could leave
stale links behind. With first-class web editing that becomes a real bug, so
here the rule set is *recomputed*: rule-assigned links that no longer satisfy
the rule are removed. ``manual`` and ``migrated`` links are never touched.
"""

from api.models import PickHaulInvoice, PickHaulInvoiceReceipt, PickHaulReceipt


def _rule_receipt_ids(invoice):
    """Receipt ids the rule says this invoice covers (empty without a date range)."""
    if not invoice.date_from or not invoice.date_to:
        return set()
    qs = PickHaulReceipt.objects.filter(
        packinghouse_id=invoice.packinghouse_id,
        entity_id=invoice.entity_id,
        season=invoice.season,
        is_active=True,
        pick_date__gte=invoice.date_from,
        pick_date__lte=invoice.date_to,
    )
    if invoice.block_raw:
        qs = qs.filter(block_raw=invoice.block_raw)
    return set(qs.values_list('id', flat=True))


def relink_invoice(invoice):
    """Recompute this invoice's rule links. Returns the net number added.

    Migrated invoices keep the links they came with — the rule never ran on
    them locally and must not start running here.
    """
    if invoice.source == 'migrated':
        return 0

    wanted = _rule_receipt_ids(invoice)
    existing = {
        link.receipt_id: link
        for link in invoice.receipt_links.filter(assigned='rule')
    }
    # A receipt already linked manually must not gain a duplicate rule link.
    pinned = set(
        invoice.receipt_links.exclude(assigned='rule').values_list('receipt_id', flat=True)
    )

    stale = [link.pk for rid, link in existing.items() if rid not in wanted]
    if stale:
        PickHaulInvoiceReceipt.objects.filter(pk__in=stale).delete()

    to_add = wanted - set(existing) - pinned
    PickHaulInvoiceReceipt.objects.bulk_create([
        PickHaulInvoiceReceipt(invoice=invoice, receipt_id=rid, assigned='rule')
        for rid in sorted(to_add)
    ])
    return len(to_add) - len(stale)


def relink_season(company, season):
    """Recompute rule links for every non-migrated invoice in the season."""
    changed = 0
    invoices = PickHaulInvoice.objects.filter(
        company=company, season=season
    ).exclude(source='migrated')
    for invoice in invoices:
        changed += relink_invoice(invoice)
    return changed
