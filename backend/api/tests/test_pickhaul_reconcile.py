"""Reconciliation fidelity tests.

Each test pins one behaviour of the matcher port against the local pipeline's
reconcile.py. Test names for the shared behaviours mirror the local test
suite so drift between the two implementations is visible by name.
"""

from datetime import date
from decimal import Decimal

from django.test import TestCase

from api.models import PickHaulChargeMatch, PickHaulInvoiceReceipt
from api.services.pickhaul import run_reconciliation
from api.services.pickhaul.linking import relink_invoice, relink_season
from api.tests.pickhaul_helpers import SEASON, PickHaulScenario


class MatcherStrategyTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()

    def _run(self):
        return run_reconciliation(self.s.company, SEASON)

    def test_exact_match(self):
        # One charge row whose debit equals the invoice.
        charge = self.s.charge('12541.36')
        inv = self.s.invoice('12541.36')
        self._run()
        inv.refresh_from_db()
        self.assertEqual(inv.match_method, 'exact')
        self.assertEqual(inv.ap_reference, 'APM-SL-00500')
        self.assertEqual(inv.charge_posted, charge.charge_date)
        self.assertEqual(PickHaulChargeMatch.objects.get(charge=charge).invoice_id, inv.pk)

    def test_reference_match(self):
        # Every charge row under one AP reference sums to the invoice.
        self.s.charge('1000.00', ap_reference='APM-SL-00600')
        self.s.charge('500.00', ap_reference='APM-SL-00600')
        inv = self.s.invoice('1500.00')
        self._run()
        inv.refresh_from_db()
        self.assertEqual(inv.match_method, 'reference')

    def test_block_match(self):
        # The rows under one AP reference for one block sum to the invoice.
        self.s.charge('700.00', ap_reference='APM-SL-00700', block='SESPE')
        self.s.charge('300.00', ap_reference='APM-SL-00700', block='SESPE')
        self.s.charge('999.00', ap_reference='APM-SL-00700', block='PIRU')
        inv = self.s.invoice('1000.00', block='SESPE')
        self._run()
        inv.refresh_from_db()
        self.assertEqual(inv.match_method, 'block')

    def test_subset_match(self):
        # Some subset of one AP reference's rows sums to the invoice.
        self.s.charge('400.00', ap_reference='APM-SL-00800')
        self.s.charge('350.00', ap_reference='APM-SL-00800')
        self.s.charge('999.99', ap_reference='APM-SL-00800')
        inv = self.s.invoice('750.00')
        self._run()
        inv.refresh_from_db()
        self.assertEqual(inv.match_method, 'subset')

    def test_vpoa_combines_pick_and_haul_on_one_invoice(self):
        # VPOA bills pick and haul on one contractor invoice; the house posts
        # them as separate kinds under one AP reference. Magana #88894.
        self.s.charge('25112.33', kind='PICK', ap_reference='APM-VP-04000',
                      house=self.s.vpoa)
        self.s.charge('2880.00', kind='HAUL', ap_reference='APM-VP-04000',
                      house=self.s.vpoa)
        inv = self.s.invoice('27992.33', kind='PICK', house=self.s.vpoa,
                             invoice_no='88894')
        self._run()
        inv.refresh_from_db()
        self.assertEqual(inv.match_method, 'reference+combined')

    def test_february_charge_cannot_pay_an_april_invoice(self):
        # Haul amounts repeat ($1,344.00 three times in one season). A charge
        # dated before the pick is excluded, not merely penalised.
        self.s.charge('1344.00', kind='HAUL', charge_date=date(2026, 2, 10),
                      ap_reference='APM-SL-00100')
        inv = self.s.invoice('1344.00', kind='HAUL', contractor='Ortiz',
                             date_from=date(2026, 4, 10), date_to=date(2026, 4, 15))
        self._run()
        inv.refresh_from_db()
        self.assertEqual(inv.match_method, 'unmatched')

    def test_wrong_block_is_excluded(self):
        # A charge against a different block is a different job.
        self.s.charge('5000.00', block='PIRU')
        inv = self.s.invoice('5000.00', block='SESPE')
        self._run()
        inv.refresh_from_db()
        self.assertEqual(inv.match_method, 'unmatched')

    def test_charge_allocated_at_most_once(self):
        # Two invoices for the same amount, one charge: first (by date) wins.
        charge = self.s.charge('2000.00')
        first = self.s.invoice('2000.00', date_from=date(2026, 4, 10))
        second = self.s.invoice('2000.00', date_from=date(2026, 4, 12))
        self._run()
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.match_method, 'exact')
        self.assertEqual(second.match_method, 'unmatched')
        # And the OneToOne makes double allocation structurally impossible.
        self.assertEqual(PickHaulChargeMatch.objects.filter(charge=charge).count(), 1)

    def test_same_kind_preferred_over_combined(self):
        # An exact same-kind hit must beat a combined-pool candidate.
        self.s.charge('1000.00', kind='PICK', ap_reference='APM-SL-00901')
        self.s.charge('600.00', kind='HAUL', ap_reference='APM-SL-00902')
        self.s.charge('400.00', kind='PICK', ap_reference='APM-SL-00902')
        inv = self.s.invoice('1000.00', kind='PICK')
        self._run()
        inv.refresh_from_db()
        self.assertEqual(inv.match_method, 'exact')
        self.assertEqual(inv.ap_reference, 'APM-SL-00901')


class DerivedFieldRuleTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()

    def test_date_rec_from_ph_is_never_written(self):
        # The human record of money arriving is not the matcher's to touch —
        # neither to fill when empty nor to correct when it disagrees.
        self.s.charge('100.00')
        blank = self.s.invoice('100.00')
        self.s.charge('200.00', ap_reference='APM-SL-00999')
        keyed = self.s.invoice('200.00', date_rec_from_ph=date(2026, 5, 1))
        run_reconciliation(self.s.company, SEASON)
        blank.refresh_from_db()
        keyed.refresh_from_db()
        self.assertIsNone(blank.date_rec_from_ph)
        self.assertEqual(keyed.date_rec_from_ph, date(2026, 5, 1))
        self.assertEqual(blank.match_method, 'exact')
        self.assertEqual(keyed.match_method, 'exact')

    def test_losing_a_match_clears_stale_derived_fields(self):
        # DEVIATION from local (which left charge_posted/ap_reference stale on
        # unmatched): the chase list keys on charge_posted, so stale values
        # would hide real money.
        inv = self.s.invoice('3000.00', charge_posted=date(2026, 4, 20),
                             ap_reference='APM-SL-STALE', match_method='exact')
        run_reconciliation(self.s.company, SEASON)
        inv.refresh_from_db()
        self.assertEqual(inv.match_method, 'unmatched')
        self.assertEqual(inv.ap_reference, '')
        self.assertIsNone(inv.charge_posted)

    def test_rerun_is_idempotent(self):
        self.s.charge('12541.36')
        inv = self.s.invoice('12541.36')
        first = run_reconciliation(self.s.company, SEASON)
        second = run_reconciliation(self.s.company, SEASON)
        inv.refresh_from_db()
        self.assertEqual(inv.match_method, 'exact')
        self.assertEqual(first['method_counts'], second['method_counts'])
        self.assertEqual(PickHaulChargeMatch.objects.count(), 1)


class LinkingRuleTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()

    def test_rule_links_by_block_and_date_range(self):
        inside = self.s.receipt('1001', pick_date=date(2026, 4, 12), block='SESPE')
        self.s.receipt('1002', pick_date=date(2026, 4, 20), block='SESPE')   # outside range
        self.s.receipt('1003', pick_date=date(2026, 4, 12), block='PIRU')    # wrong block
        inv = self.s.invoice('1000.00', block='SESPE',
                             date_from=date(2026, 4, 10), date_to=date(2026, 4, 15))
        relink_invoice(inv)
        linked = set(inv.receipt_links.values_list('receipt_id', flat=True))
        self.assertEqual(linked, {inside.pk})

    def test_no_block_links_whole_date_range(self):
        a = self.s.receipt('1101', pick_date=date(2026, 4, 11), block='SESPE')
        b = self.s.receipt('1102', pick_date=date(2026, 4, 12), block='PIRU')
        inv = self.s.invoice('1000.00', block='',
                             date_from=date(2026, 4, 10), date_to=date(2026, 4, 15))
        relink_invoice(inv)
        self.assertEqual(
            set(inv.receipt_links.values_list('receipt_id', flat=True)), {a.pk, b.pk}
        )

    def test_editing_dates_rederives_rule_links_only(self):
        early = self.s.receipt('1201', pick_date=date(2026, 4, 11))
        late = self.s.receipt('1202', pick_date=date(2026, 5, 11))
        pinned = self.s.receipt('1203', pick_date=date(2026, 6, 1))
        inv = self.s.invoice('1000.00', block='SESPE',
                             date_from=date(2026, 4, 10), date_to=date(2026, 4, 15))
        relink_invoice(inv)
        PickHaulInvoiceReceipt.objects.create(invoice=inv, receipt=pinned, assigned='manual')

        inv.date_from, inv.date_to = date(2026, 5, 10), date(2026, 5, 15)
        inv.save()
        relink_invoice(inv)

        links = {l.receipt_id: l.assigned for l in inv.receipt_links.all()}
        self.assertNotIn(early.pk, links)            # stale rule link removed
        self.assertEqual(links[late.pk], 'rule')     # new rule link added
        self.assertEqual(links[pinned.pk], 'manual')  # manual link untouched

    def test_migrated_invoices_keep_their_links(self):
        # The rule never ran on migrated invoices locally and must not start.
        self.s.receipt('1301', pick_date=date(2026, 4, 12), block='SESPE')
        inv = self.s.invoice('1000.00', block='SESPE', source='migrated',
                             date_from=date(2026, 4, 10), date_to=date(2026, 4, 15))
        relink_season(self.s.company, SEASON)
        self.assertEqual(inv.receipt_links.count(), 0)

    def test_inactive_receipts_are_not_linked(self):
        self.s.receipt('1401', pick_date=date(2026, 4, 12), is_active=False)
        inv = self.s.invoice('1000.00', block='SESPE',
                             date_from=date(2026, 4, 10), date_to=date(2026, 4, 15))
        relink_invoice(inv)
        self.assertEqual(inv.receipt_links.count(), 0)
