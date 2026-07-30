"""The data-shaped gates, run on the platform after every push and edit.

Port of the local checks.py gates 5–8 and 10 — same numbers, names,
severities, and message shapes. The file-shaped gates (1 season, 2 freshness,
3 monotonic-receipts, 4 key-integrity, 9 entity-identity) stay on the local
machine, where the files are; their findings arrive inside push bundles and
are stored with ``origin='local'``.

New here: **gate 11, unmatched-charges** — house-posted PICK/HAUL charges with
no invoice allocated against them. Locally these were invisible: gate 8 starts
from invoices, and a posted charge with nothing keyed has no invoice to age.
At the time of the port that blind spot held $360,108 across 48 rows.

Severities:
    error  something is wrong with the data
    warn   worth a human look
    info   informational
"""

from datetime import date

from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone

from api.models import (
    PickHaulCheckResult, PickHaulDirectCharge, PickHaulInvoice, PickHaulReceipt,
)
from .config import AGING_DAYS, PER_BIN_BANDS, SELF_HAULING_CONTRACTOR

GATE_NAMES = {
    5: 'orphan-invoices',
    6: 'bin-coverage',
    7: 'per-bin-sanity',
    8: 'reimbursement-aging',
    10: 'hauling-cover',
    11: 'unmatched-charges',
}


def _finding(gate, severity, detail, packinghouse_id=None, entity_id=None,
             subject=None, invoice_id=None):
    return {
        'gate': gate, 'gate_name': GATE_NAMES[gate], 'severity': severity,
        'detail': detail, 'packinghouse_id': packinghouse_id,
        'entity_id': entity_id, 'subject': subject or '',
        'invoice_id': invoice_id,
    }


def gate5_orphan_invoices(company, season):
    """An invoice that covers no receipts is either mistyped or premature.

    Scoped to accounts that have receipts this season — the no-portal houses
    have no receipts by definition, and their costs live in manual picks.
    """
    out = []
    accounts_with_receipts = set(
        PickHaulReceipt.objects.filter(company=company, season=season)
        .values_list('packinghouse_id', 'entity_id')
    )
    qs = PickHaulInvoice.objects.filter(
        company=company, season=season, receipt_links__isnull=True,
    ).select_related('packinghouse', 'entity')
    for inv in qs:
        if (inv.packinghouse_id, inv.entity_id) not in accounts_with_receipts:
            continue
        amount = inv.amount or 0
        out.append(_finding(
            5, 'error',
            f'{inv.kind} invoice {inv.contractor} #{inv.invoice_no} '
            f'${amount:,.2f} matches no receipts '
            f'(block {inv.block_raw!r}, {inv.date_from}..{inv.date_to})',
            packinghouse_id=inv.packinghouse_id, entity_id=inv.entity_id,
            subject=str(inv.invoice_no), invoice_id=inv.pk,
        ))
    return out


def gate6_bin_coverage(company, season):
    """Every receipt with bins should end up covered by a pick invoice eventually."""
    out = []
    covered_ids = set(
        PickHaulReceipt.objects.filter(
            company=company, season=season,
            invoice_links__invoice__kind='PICK',
        ).values_list('id', flat=True)
    )
    groups = {}
    receipts = PickHaulReceipt.objects.filter(
        company=company, season=season, is_active=True,
    ).values('id', 'packinghouse_id', 'entity_id', 'block_raw', 'bins')
    for r in receipts:
        key = (r['packinghouse_id'], r['entity_id'], r['block_raw'])
        bins = r['bins'] or 0
        g = groups.setdefault(key, {'bins': 0, 'uncovered': 0})
        g['bins'] += bins
        if r['id'] not in covered_ids:
            g['uncovered'] += bins
    for (ph_id, ent_id, block), g in sorted(groups.items(), key=lambda kv: str(kv[0])):
        if not g['uncovered']:
            continue
        pct = 100.0 * float(g['uncovered']) / float(g['bins']) if g['bins'] else 0
        out.append(_finding(
            6, 'info',
            f"{g['uncovered']:.1f} of {g['bins']:.1f} bins ({pct:.0f}%) on "
            f"{block!r} have no pick invoice yet",
            packinghouse_id=ph_id, entity_id=ent_id, subject=block,
        ))
    return out


def gate7_per_bin_sanity(company, season):
    """Cost per bin outside a plausible band usually means a typo or a bad link."""
    out = []
    invoices = PickHaulInvoice.objects.filter(
        company=company, season=season,
    ).annotate(linked_bins=Sum('receipt_links__receipt__bins'))
    for inv in invoices:
        bins = inv.linked_bins or 0
        amount = inv.amount or 0
        if not bins or not amount:
            continue
        per_bin = amount / bins
        lo, hi = PER_BIN_BANDS.get(inv.kind, (0, None))
        if hi is not None and not (lo <= per_bin <= hi):
            out.append(_finding(
                7, 'warn',
                f'{inv.kind} {inv.contractor} #{inv.invoice_no} works out to '
                f'${per_bin:,.2f}/bin (${amount:,.2f} over {bins:.1f} bins), '
                f'outside the ${lo:g}-${hi:g} band',
                packinghouse_id=inv.packinghouse_id, entity_id=inv.entity_id,
                subject=str(inv.invoice_no), invoice_id=inv.pk,
            ))
    return out


def gate8_reimbursement_aging(company, season, today=None):
    """Invoices emailed to the house that it has not yet charged back.

    This is the question the workbook's 'Date Rec from PH' column was trying
    to answer by eye. Predicate faithful to the local gate: keys on
    ``date_emailed``, not ``date_paid``.
    """
    out = []
    today = today or date.today()
    qs = PickHaulInvoice.objects.filter(
        company=company, season=season,
        charge_posted__isnull=True, date_emailed__isnull=False,
    ).order_by('date_emailed')
    for inv in qs:
        age = (today - inv.date_emailed).days
        if age >= AGING_DAYS:
            amount = inv.amount or 0
            out.append(_finding(
                8, 'warn',
                f'{inv.kind} {inv.contractor} #{inv.invoice_no} '
                f'${amount:,.2f} emailed {inv.date_emailed} '
                f'({age} days ago) with no matching Direct Charge yet',
                packinghouse_id=inv.packinghouse_id, entity_id=inv.entity_id,
                subject=str(inv.invoice_no), invoice_id=inv.pk,
            ))
    return out


def gate10_hauling_cover(company, season):
    """Mark's rule: Magana hauls; MCM does not, so Ortiz hauls for them.

    A picked load with nobody billed for moving it is either an invoice not
    yet entered or one attached to the wrong receipts.
    """
    out = []
    picks = PickHaulInvoice.objects.filter(
        company=company, season=season, kind='PICK',
    ).exclude(contractor__icontains=SELF_HAULING_CONTRACTOR)
    for inv in picks:
        if not inv.contractor:
            out.append(_finding(
                10, 'warn',
                f'pick invoice #{inv.invoice_no} ${inv.amount or 0:,.2f} has '
                f'no contractor recorded',
                packinghouse_id=inv.packinghouse_id, entity_id=inv.entity_id,
                subject=str(inv.invoice_no), invoice_id=inv.pk,
            ))
            continue
        receipt_ids = list(inv.receipt_links.values_list('receipt_id', flat=True))
        haul_rows = 0
        if receipt_ids:
            haul_rows = PickHaulInvoice.objects.filter(
                company=company, season=season, kind='HAUL',
                receipt_links__receipt_id__in=receipt_ids,
            ).count()
        if not haul_rows:
            out.append(_finding(
                10, 'info',
                f'{inv.contractor} pick #{inv.invoice_no} '
                f'${inv.amount or 0:,.2f} on {inv.block_raw} '
                f'({inv.date_from}) has no hauling invoice against the same '
                f'receipts - {inv.contractor} does not haul, so an Ortiz '
                f'invoice should cover it',
                packinghouse_id=inv.packinghouse_id, entity_id=inv.entity_id,
                subject=str(inv.invoice_no), invoice_id=inv.pk,
            ))
    return out


def gate11_unmatched_charges(company, season):
    """House-posted PICK/HAUL charges with no invoice allocated against them.

    The house says we owe (or already deducted) this money and nothing in the
    invoice register accounts for it. One finding per account, because the fix
    is per-account: key the missing invoices or dispute the charge.
    """
    out = []
    groups = (
        PickHaulDirectCharge.objects.filter(
            company=company, season=season, kind__in=('PICK', 'HAUL'),
            debit__gt=0, match__isnull=True,
        )
        .values('packinghouse_id', 'entity_id')
        .annotate(rows=Count('id'), total=Sum('debit'))
        .order_by('packinghouse_id', 'entity_id')
    )
    for g in groups:
        out.append(_finding(
            11, 'warn',
            f"{g['rows']} house-posted charge row(s) totalling ${g['total']:,.2f} have "
            f"no contractor invoice against them - the house billed this, and "
            f"nothing in the register accounts for it",
            packinghouse_id=g['packinghouse_id'], entity_id=g['entity_id'],
        ))
    return out


ALL_GATES = [
    gate5_orphan_invoices,
    gate6_bin_coverage,
    gate7_per_bin_sanity,
    gate8_reimbursement_aging,
    gate10_hauling_cover,
    gate11_unmatched_charges,
]


@transaction.atomic
def run_platform_gates(company, season, batch=None):
    """Run all platform gates and persist the findings.

    Platform findings are current-state, not history: each run replaces the
    previous platform-origin rows for the scope. (Local findings append per
    batch — they describe a specific file pull.)
    """
    findings = []
    for gate in ALL_GATES:
        findings.extend(gate(company, season))

    PickHaulCheckResult.objects.filter(
        company=company, season=season, origin='platform',
    ).delete()

    now = timezone.now()
    PickHaulCheckResult.objects.bulk_create([
        PickHaulCheckResult(
            company=company, batch=batch, run_at=now, origin='platform',
            gate=f['gate'], gate_name=f['gate_name'], severity=f['severity'],
            packinghouse_id=f['packinghouse_id'], entity_id=f['entity_id'],
            season=season, subject=f['subject'], detail=f['detail'],
            invoice_id=f['invoice_id'],
        )
        for f in findings
    ])

    return {
        'errors': sum(1 for f in findings if f['severity'] == 'error'),
        'warns': sum(1 for f in findings if f['severity'] == 'warn'),
        'infos': sum(1 for f in findings if f['severity'] == 'info'),
    }
