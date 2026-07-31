"""Per-invoice billing mode and house-charge acknowledgments.

'direct' invoices are grower-paid and chased for reimbursement; 'house_billed'
invoices are the contractor billing the packinghouse directly — nothing to
chase, and the matching house charge is expected. Acks mark house-posted
charges as expected when the grower never holds an invoice at all.
"""

from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from api.models import PickHaulChargeAck
from api.services.pickhaul import run_reconciliation
from api.services.pickhaul.activity import harvest_activity
from api.services.pickhaul.checks import (
    gate8_reimbursement_aging,
    gate11_unmatched_charges,
)
from api.tests.pickhaul_helpers import SEASON, PickHaulScenario

FAR_FUTURE = date(2027, 6, 1)


class BillingDefaultTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()

    def test_default_billing_is_direct(self):
        inv = self.s.invoice('100.00')
        self.assertEqual(inv.billing, 'direct')
        self.assertTrue(
            inv.__class__.objects.filter(pk=inv.pk, billing='direct').exists()
        )

    def test_is_outstanding_requires_direct(self):
        direct = self.s.invoice('100.00', date_emailed=date(2026, 4, 20))
        house = self.s.invoice(
            '200.00', billing='house_billed', date_emailed=date(2026, 4, 20)
        )
        self.assertTrue(direct.is_outstanding)
        self.assertFalse(house.is_outstanding)


class ChaseListExclusionTests(TestCase):
    """house_billed invoices leave every owed/chase surface."""

    def setUp(self):
        self.s = PickHaulScenario()
        self.direct = self.s.invoice(
            '100.00', date_emailed=date(2026, 1, 5)
        )
        self.house = self.s.invoice(
            '250.00', billing='house_billed', date_emailed=date(2026, 1, 5)
        )
        self.client_api = self.s.factory.create_authenticated_client(self.s.owner)

    def test_outstanding_filter_param(self):
        res = self.client_api.get(
            f'/api/pickhaul/invoices/?season={SEASON}&outstanding=1'
        )
        ids = [r['id'] for r in res.json()['results']] \
            if isinstance(res.json(), dict) and 'results' in res.json() \
            else [r['id'] for r in res.json()]
        self.assertIn(self.direct.pk, ids)
        self.assertNotIn(self.house.pk, ids)

    def test_aging_summary_excludes_house_billed(self):
        res = self.client_api.get(f'/api/pickhaul/summary/aging/?season={SEASON}')
        data = res.json()
        self.assertEqual(Decimal(str(data['total_owed'])), Decimal('100.00'))
        self.assertEqual(data['outstanding_count'], 1)

    def test_harvest_activity_owed_excludes_house_billed(self):
        stats = harvest_activity(self.s.company, SEASON)['stats']
        self.assertEqual(stats['owed_total'], Decimal('100.00'))
        self.assertEqual(stats['owed_count'], 1)

    def test_gate8_excludes_house_billed(self):
        findings = gate8_reimbursement_aging(
            self.s.company, SEASON, today=FAR_FUTURE
        )
        subjects = [f['subject'] for f in findings]
        self.assertIn(str(self.direct.invoice_no), subjects)
        self.assertNotIn(str(self.house.invoice_no), subjects)


class HouseBilledStillReconcilesTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()

    def test_house_billed_gets_charge_posted(self):
        charge = self.s.charge('980.00')
        inv = self.s.invoice('980.00', billing='house_billed')
        run_reconciliation(self.s.company, SEASON)
        inv.refresh_from_db()
        self.assertEqual(inv.match_method, 'exact')
        self.assertEqual(inv.charge_posted, charge.charge_date)
        # Matched and house_billed: not outstanding either way.
        self.assertFalse(inv.is_outstanding)


class ChargeAckTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()
        self.charge = self.s.charge('455.00')
        self.client_api = self.s.factory.create_authenticated_client(self.s.owner)

    def _ack_url(self, charge=None):
        return f'/api/pickhaul/house-charges/{(charge or self.charge).pk}/ack/'

    def test_unacked_charge_is_in_gate11_and_counts(self):
        findings = gate11_unmatched_charges(self.s.company, SEASON)
        self.assertEqual(len(findings), 1)
        stats = harvest_activity(self.s.company, SEASON)['stats']
        self.assertEqual(stats['unmatched_charges']['rows'], 1)

    def test_ack_removes_charge_from_gate11_and_counts(self):
        res = self.client_api.post(
            self._ack_url(), {'reason': 'house_billed', 'note': 'Ortiz bills SLA'},
            format='json',
        )
        self.assertEqual(res.status_code, 201)

        self.assertEqual(gate11_unmatched_charges(self.s.company, SEASON), [])
        stats = harvest_activity(self.s.company, SEASON)['stats']
        self.assertEqual(stats['unmatched_charges']['rows'], 0)

        aging = self.client_api.get(
            f'/api/pickhaul/summary/aging/?season={SEASON}'
        ).json()
        self.assertEqual(aging['unmatched_charges']['rows'], 0)

    def test_unack_restores_gate11(self):
        self.client_api.post(self._ack_url(), {'reason': 'house_billed'}, format='json')
        res = self.client_api.delete(self._ack_url())
        self.assertEqual(res.status_code, 204)
        self.assertEqual(len(gate11_unmatched_charges(self.s.company, SEASON)), 1)

    def test_ack_surfaces_on_charge_serializer(self):
        self.client_api.post(self._ack_url(), {'reason': 'disputed', 'note': 'x'}, format='json')
        res = self.client_api.get(f'/api/pickhaul/house-charges/?season={SEASON}')
        payload = res.json()
        rows = payload['results'] if isinstance(payload, dict) and 'results' in payload else payload
        row = next(r for r in rows if r['id'] == self.charge.pk)
        self.assertTrue(row['acked'])
        self.assertEqual(row['ack_reason'], 'disputed')

    def test_acked_filter_param(self):
        other = self.s.charge('12.00')
        self.client_api.post(self._ack_url(), {'reason': 'house_billed'}, format='json')
        res = self.client_api.get(
            f'/api/pickhaul/house-charges/?season={SEASON}&acked=0'
        )
        payload = res.json()
        rows = payload['results'] if isinstance(payload, dict) and 'results' in payload else payload
        ids = [r['id'] for r in rows]
        self.assertIn(other.pk, ids)
        self.assertNotIn(self.charge.pk, ids)

    def test_invalid_reason_is_400(self):
        res = self.client_api.post(self._ack_url(), {'reason': 'whatever'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_viewer_cannot_ack(self):
        viewer = self.s.member('viewer')
        client = self.s.factory.create_authenticated_client(viewer)
        res = client.post(self._ack_url(), {'reason': 'house_billed'}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_accountant_can_ack(self):
        accountant = self.s.member('accountant')
        client = self.s.factory.create_authenticated_client(accountant)
        res = client.post(self._ack_url(), {'reason': 'house_billed'}, format='json')
        self.assertEqual(res.status_code, 201)

    def test_other_company_charge_is_404(self):
        other = PickHaulScenario()
        res = self.client_api.post(self._ack_url(other.charge('9.99')), {}, format='json')
        self.assertEqual(res.status_code, 404)

    def test_ack_is_upsert(self):
        first = self.client_api.post(self._ack_url(), {'reason': 'house_billed'}, format='json')
        second = self.client_api.post(self._ack_url(), {'reason': 'other'}, format='json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(PickHaulChargeAck.objects.count(), 1)
        self.assertEqual(PickHaulChargeAck.objects.get().reason, 'other')
