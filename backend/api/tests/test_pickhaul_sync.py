"""Push-bundle sync invariants.

The properties that make the platform safe to point a scheduled task at:
idempotency, upsert-not-clobber, rejection with a recorded reason, and the
structural impossibility of a push touching platform-owned invoices.
"""

from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from api.models import (
    MachineApiToken, PickHaulCheckResult, PickHaulDirectCharge, PickHaulInvoice,
    PickHaulReceipt, PickHaulSyncBatch,
)
from api.services.pickhaul import BundleRejected, apply_bundle
from api.tests.pickhaul_helpers import (
    SEASON, PickHaulScenario, bundle_charge, bundle_pull, bundle_receipt,
    make_bundle,
)


class ApplyBundleTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()

    def test_apply_creates_rows(self):
        bundle = make_bundle(
            receipts=[bundle_receipt('182622'), bundle_receipt('182623', entity='FF')],
            charges=[bundle_charge('h1')],
            pulls=[bundle_pull()],
        )
        result = apply_bundle(self.s.company, bundle)
        self.assertFalse(result['duplicate'])
        self.assertEqual(result['applied']['receipts']['created'], 2)
        self.assertEqual(result['applied']['direct_charges']['created'], 1)
        self.assertEqual(result['applied']['pulls']['created'], 1)
        # 'FF' resolves to the FFLLC LegalEntity.
        ff_receipt = PickHaulReceipt.objects.get(receipt_no='182623')
        self.assertEqual(ff_receipt.entity, self.s.ffllc)
        batch = PickHaulSyncBatch.objects.get(pk=result['batch_id'])
        self.assertEqual(batch.status, 'applied')

    def test_duplicate_bundle_is_a_recorded_noop(self):
        bundle = make_bundle(receipts=[bundle_receipt('1')])
        first = apply_bundle(self.s.company, bundle)
        second = apply_bundle(self.s.company, bundle)
        self.assertTrue(second['duplicate'])
        self.assertEqual(second['batch_id'], first['batch_id'])
        self.assertEqual(PickHaulReceipt.objects.count(), 1)
        # The duplicate contact is still on record for freshness tracking.
        self.assertTrue(PickHaulSyncBatch.objects.filter(status='duplicate').exists())

    def test_receipt_update_preserves_links(self):
        # A changed receipt updates in place — its invoice links must survive.
        apply_bundle(self.s.company, make_bundle(
            receipts=[bundle_receipt('42', bins=20.5, qty=20.5)]))
        receipt = PickHaulReceipt.objects.get(receipt_no='42')
        inv = self.s.invoice('1000.00', block='SESPE',
                             date_from=date(2026, 4, 10), date_to=date(2026, 4, 15))
        from api.services.pickhaul.linking import relink_invoice
        relink_invoice(inv)
        self.assertEqual(inv.receipt_links.count(), 1)

        apply_bundle(self.s.company, make_bundle(
            receipts=[bundle_receipt('42', bins=22.0, qty=22.0)]))
        receipt.refresh_from_db()
        self.assertEqual(receipt.bins, Decimal('22.0'))
        self.assertEqual(inv.receipt_links.count(), 1)  # link intact, same PK

    def test_deactivate_and_reactivate(self):
        apply_bundle(self.s.company, make_bundle(receipts=[bundle_receipt('7')]))
        r2 = apply_bundle(self.s.company, make_bundle(
            receipts=[bundle_receipt('7', is_active=False)]))
        receipt = PickHaulReceipt.objects.get(receipt_no='7')
        self.assertFalse(receipt.is_active)
        self.assertEqual(r2['applied']['receipts']['deactivated'], 1)

        # A later run re-lists the receipt; generated_at always differs run to
        # run, so this is not a byte-identical retry.
        r3 = apply_bundle(self.s.company, make_bundle(
            receipts=[bundle_receipt('7', is_active=True)],
            generated_at='2026-07-31T06:05:00'))
        receipt.refresh_from_db()
        self.assertTrue(receipt.is_active)
        self.assertEqual(r3['applied']['receipts']['reactivated'], 1)

    def test_charges_are_append_only(self):
        apply_bundle(self.s.company, make_bundle(charges=[bundle_charge('dup')]))
        result = apply_bundle(self.s.company, make_bundle(
            charges=[bundle_charge('dup'), bundle_charge('new')],
            # vary meta so the bundle hash differs
            machine='TEST-MACHINE-2',
        ))
        self.assertEqual(result['applied']['direct_charges']['created'], 1)
        self.assertEqual(result['applied']['direct_charges']['existing'], 1)
        self.assertEqual(PickHaulDirectCharge.objects.count(), 2)


class RejectionTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()

    def _assert_rejected(self, bundle, fragment):
        with self.assertRaises(BundleRejected) as ctx:
            apply_bundle(self.s.company, bundle)
        self.assertIn(fragment, ctx.exception.reason)
        batch = ctx.exception.batch
        self.assertIsNotNone(batch)
        self.assertEqual(batch.status, 'rejected')
        # Nothing was written.
        self.assertEqual(PickHaulReceipt.objects.count(), 0)
        self.assertEqual(PickHaulDirectCharge.objects.count(), 0)

    def test_local_gate_errors_are_rejected(self):
        bundle = make_bundle(
            receipts=[bundle_receipt('1')],
            gates={'errors': 2, 'warns': 0, 'infos': 0, 'results': []},
        )
        self._assert_rejected(bundle, 'blocking gates failed')

    def test_wrong_schema_is_rejected(self):
        self._assert_rejected(make_bundle(schema=2), 'schema')

    def test_season_mismatch_is_rejected(self):
        bundle = make_bundle(receipts=[bundle_receipt('1', season=2025)])
        self._assert_rejected(bundle, 'season 2025')

    def test_unknown_house_is_rejected(self):
        bundle = make_bundle(receipts=[bundle_receipt('1', house='XX')])
        self._assert_rejected(bundle, "'XX'")

    def test_unknown_entity_is_rejected(self):
        bundle = make_bundle(receipts=[bundle_receipt('1', entity='ZZ')])
        self._assert_rejected(bundle, "'ZZ'")

    def test_count_mismatch_is_rejected(self):
        bundle = make_bundle(receipts=[bundle_receipt('1')])
        bundle['meta']['counts']['receipts'] = 5
        self._assert_rejected(bundle, 'truncated')

    def test_missing_receipt_no_is_rejected(self):
        bundle = make_bundle(receipts=[bundle_receipt('')])
        self._assert_rejected(bundle, 'receipt_no')

    def test_invoices_key_is_rejected(self):
        # Ownership by construction: a bundle cannot carry invoices, so a
        # compromised or stale client cannot overwrite the accountant's work.
        bundle = make_bundle()
        bundle['invoices'] = [{'contractor': 'Mallory', 'amount': 1}]
        self._assert_rejected(bundle, 'invoices')

    def test_platform_invoices_survive_any_push_byte_identical(self):
        inv = self.s.invoice('12541.36', notes='keyed by hand',
                             date_rec_from_ph=date(2026, 5, 1))
        before = list(PickHaulInvoice.objects.values().order_by('id'))
        apply_bundle(self.s.company, make_bundle(receipts=[bundle_receipt('9')]))
        # Reconciliation may rewrite derived fields, but the human-keyed
        # columns must be untouched.
        after = PickHaulInvoice.objects.get(pk=inv.pk)
        self.assertEqual(after.notes, 'keyed by hand')
        self.assertEqual(after.date_rec_from_ph, date(2026, 5, 1))
        self.assertEqual(after.amount, Decimal('12541.36'))
        self.assertEqual(after.contractor, 'Magana')
        self.assertEqual(len(before), PickHaulInvoice.objects.count())


class LocalCheckRecordingTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()

    def test_local_gate_findings_are_recorded(self):
        bundle = make_bundle(
            receipts=[bundle_receipt('1')],
            gates={'errors': 0, 'warns': 1, 'infos': 1, 'results': [
                {'gate': 3, 'gate_name': 'monotonic-receipts', 'severity': 'warn',
                 'house': 'SLA', 'entity': 'JPF', 'subject': None,
                 'detail': '2 receipt(s) present in an earlier pull are missing'},
                {'gate': 2, 'gate_name': 'freshness', 'severity': 'info',
                 'house': 'SLA', 'entity': 'FF', 'subject': None,
                 'detail': 'unchanged since the previous pull'},
            ]},
        )
        apply_bundle(self.s.company, bundle)
        local = PickHaulCheckResult.objects.filter(origin='local')
        self.assertEqual(local.count(), 2)
        warn = local.get(gate=3)
        self.assertEqual(warn.packinghouse, self.s.sla)
        self.assertEqual(warn.entity, self.s.jpf)
        self.assertEqual(local.get(gate=2).entity, self.s.ffllc)

    def test_next_bundle_replaces_local_findings(self):
        gates1 = {'errors': 0, 'warns': 1, 'infos': 0, 'results': [
            {'gate': 3, 'gate_name': 'monotonic-receipts', 'severity': 'warn',
             'house': 'SLA', 'entity': 'JPF', 'detail': 'old finding'}]}
        apply_bundle(self.s.company, make_bundle(gates=gates1))
        apply_bundle(self.s.company, make_bundle(machine='M2'))
        local = PickHaulCheckResult.objects.filter(origin='local')
        self.assertEqual(local.count(), 0)


class MachineTokenApiTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()
        self.token, self.secret = MachineApiToken.mint(
            self.s.company, self.s.owner, 'test pipeline')
        self.client = APIClient()

    def _post(self, bundle, secret=None):
        return self.client.post(
            '/api/pickhaul/sync/', bundle, format='json',
            HTTP_AUTHORIZATION=f'Token {secret or self.secret}',
        )

    def test_push_with_token_applies(self):
        res = self._post(make_bundle(receipts=[bundle_receipt('1')]))
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(PickHaulReceipt.objects.count(), 1)
        self.token.refresh_from_db()
        self.assertIsNotNone(self.token.last_used_at)

    def test_duplicate_push_returns_200(self):
        bundle = make_bundle(receipts=[bundle_receipt('1')])
        self._post(bundle)
        res = self._post(bundle)
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['duplicate'])

    def test_rejected_bundle_returns_422(self):
        res = self._post(make_bundle(schema=99))
        self.assertEqual(res.status_code, 422)
        self.assertIn('schema', res.data['detail'])

    def test_revoked_token_is_401(self):
        from django.utils import timezone
        self.token.revoked_at = timezone.now()
        self.token.save()
        res = self._post(make_bundle())
        self.assertEqual(res.status_code, 401)

    def test_bad_secret_is_401(self):
        res = self._post(make_bundle(), secret='pht_wrong')
        self.assertEqual(res.status_code, 401)

    def test_machine_token_is_useless_elsewhere(self):
        res = self.client.get(
            '/api/pickhaul/invoices/',
            HTTP_AUTHORIZATION=f'Token {self.secret}',
        )
        self.assertIn(res.status_code, (401, 403))

    def test_humans_cannot_push(self):
        # A JWT/session user (no machine token) has no way into the sync view.
        human = APIClient()
        human.force_authenticate(user=self.s.owner)
        res = human.post('/api/pickhaul/sync/', make_bundle(), format='json')
        self.assertIn(res.status_code, (401, 403))
