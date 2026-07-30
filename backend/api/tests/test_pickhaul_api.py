"""API surface, permission, gate, and aging-summary tests."""

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from api.models import PickHaulCheckResult, PickHaulInvoice
from api.services.pickhaul import run_platform_gates
from api.services.pickhaul.linking import relink_season
from api.services.pickhaul.reconcile import run_reconciliation
from api.tests.pickhaul_helpers import SEASON, PickHaulScenario


def _rows(res):
    """Tolerate paginated and bare-array list responses."""
    data = res.data
    return data['results'] if isinstance(data, dict) and 'results' in data else data


class PermissionTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()

    def _client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def _invoice_payload(self, **overrides):
        payload = {
            'packinghouse': self.s.sla.pk, 'entity': self.s.jpf.pk,
            'season': SEASON, 'kind': 'PICK', 'contractor': 'Magana',
            'invoice_no': '90001', 'amount': '5000.00',
            'block_raw': 'SESPE', 'date_from': '2026-04-10', 'date_to': '2026-04-15',
        }
        payload.update(overrides)
        return payload

    def test_accountant_can_enter_invoices(self):
        accountant = self.s.member('accountant')
        res = self._client(accountant).post(
            '/api/pickhaul/invoices/', self._invoice_payload(), format='json')
        self.assertEqual(res.status_code, 201, res.data)
        inv = PickHaulInvoice.objects.get()
        self.assertEqual(inv.source, 'platform')
        self.assertEqual(inv.created_by, accountant)

    def test_viewer_can_read_but_not_write(self):
        viewer = self.s.member('viewer')
        client = self._client(viewer)
        self.assertEqual(client.get('/api/pickhaul/invoices/').status_code, 200)
        res = client.post('/api/pickhaul/invoices/', self._invoice_payload(), format='json')
        self.assertEqual(res.status_code, 403)

    def test_worker_has_no_pick_haul_access(self):
        worker = self.s.member('worker')
        res = self._client(worker).get('/api/pickhaul/invoices/')
        self.assertEqual(res.status_code, 403)

    def test_other_company_sees_nothing(self):
        self.s.invoice('1000.00')
        other_company, other_user = self.s.factory.create_company_with_user()
        res = self._client(other_user).get('/api/pickhaul/invoices/')
        # Owner role is fully wired by setup_roles, so this is pure tenancy.
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(_rows(res)), 0)


class InvoiceApiTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()
        self.client = APIClient()
        self.client.force_authenticate(user=self.s.member('accountant'))

    def test_derived_fields_cannot_be_written(self):
        inv = self.s.invoice('1000.00')
        res = self.client.patch(
            f'/api/pickhaul/invoices/{inv.pk}/',
            {'charge_posted': '2026-05-01', 'ap_reference': 'APM-FAKE',
             'match_method': 'exact', 'source': 'entry', 'notes': 'updated'},
            format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
        inv.refresh_from_db()
        self.assertEqual(inv.notes, 'updated')            # writable field took
        self.assertIsNone(inv.charge_posted)              # derived ignored
        self.assertEqual(inv.ap_reference, '')
        self.assertEqual(inv.source, 'platform')

    def test_date_rec_from_ph_is_human_writable(self):
        inv = self.s.invoice('1000.00')
        res = self.client.patch(
            f'/api/pickhaul/invoices/{inv.pk}/',
            {'date_rec_from_ph': '2026-05-02'}, format='json',
        )
        self.assertEqual(res.status_code, 200)
        inv.refresh_from_db()
        self.assertEqual(inv.date_rec_from_ph, date(2026, 5, 2))

    def test_duplicate_identity_is_a_readable_400(self):
        # The JPF-SLA #5782 regression: same identity twice must be refused.
        self.s.invoice('2351.82', contractor=None, invoice_no='5782')
        res = self.client.post('/api/pickhaul/invoices/', {
            'packinghouse': self.s.sla.pk, 'entity': self.s.jpf.pk,
            'season': SEASON, 'kind': 'PICK', 'contractor': '',
            'invoice_no': '5782', 'amount': '2351.82',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('already exists', str(res.data))

    def test_create_triggers_reconciliation(self):
        self.s.charge('12541.36')
        res = self.client.post('/api/pickhaul/invoices/', {
            'packinghouse': self.s.sla.pk, 'entity': self.s.jpf.pk,
            'season': SEASON, 'kind': 'PICK', 'contractor': 'Magana',
            'invoice_no': '89110', 'amount': '12541.36',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        # The response already carries what reconciliation derived.
        self.assertEqual(res.data['match_method'], 'exact')
        self.assertEqual(res.data['ap_reference'], 'APM-SL-00500')

    def test_delete_triggers_reconciliation_for_survivors(self):
        self.s.charge('2000.00')
        winner = self.s.invoice('2000.00', date_from=date(2026, 4, 10))
        loser = self.s.invoice('2000.00', date_from=date(2026, 4, 12))
        run_reconciliation(self.s.company, SEASON)
        loser.refresh_from_db()
        self.assertEqual(loser.match_method, 'unmatched')

        self.client.delete(f'/api/pickhaul/invoices/{winner.pk}/')
        loser.refresh_from_db()
        self.assertEqual(loser.match_method, 'exact')  # charge freed up

    def test_contractors_action(self):
        self.s.invoice('100.00', contractor='Magana')
        self.s.invoice('200.00', contractor='Ortiz', kind='HAUL')
        res = self.client.get('/api/pickhaul/invoices/contractors/')
        self.assertEqual(res.data, ['Magana', 'Ortiz'])

    def test_outstanding_filter(self):
        outstanding = self.s.invoice('100.00', date_emailed=date(2026, 6, 1))
        self.s.invoice('200.00', date_emailed=date(2026, 6, 1),
                       charge_posted=date(2026, 6, 10))   # charged back
        self.s.invoice('300.00')                          # never emailed
        res = self.client.get('/api/pickhaul/invoices/?outstanding=true')
        rows = _rows(res)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['id'], outstanding.pk)


class GateTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()

    def _gate(self, number):
        return PickHaulCheckResult.objects.filter(origin='platform', gate=number)

    def test_gate5_orphan_invoice(self):
        self.s.receipt('1', pick_date=date(2026, 3, 1))  # account has receipts
        self.s.invoice('500.00', date_from=date(2026, 4, 10), date_to=date(2026, 4, 15))
        run_platform_gates(self.s.company, SEASON)
        finding = self._gate(5).get()
        self.assertEqual(finding.severity, 'error')
        self.assertIn('matches no receipts', finding.detail)

    def test_gate5_skips_houses_without_receipts(self):
        # A Limoneira-style invoice (no portal, no receipts) is not an orphan.
        self.s.invoice('500.00')
        run_platform_gates(self.s.company, SEASON)
        self.assertEqual(self._gate(5).count(), 0)

    def test_gate6_uncovered_bins(self):
        self.s.receipt('1', bins='30.0')
        run_platform_gates(self.s.company, SEASON)
        finding = self._gate(6).get()
        self.assertEqual(finding.severity, 'info')
        self.assertIn('30.0', finding.detail)

    def test_gate7_per_bin_sanity(self):
        r = self.s.receipt('1', bins='10.0')
        inv = self.s.invoice('2500.00')   # $250/bin, above the $200 pick cap
        relink_season(self.s.company, SEASON)
        run_platform_gates(self.s.company, SEASON)
        finding = self._gate(7).get()
        self.assertIn('$250.00/bin', finding.detail)
        self.assertEqual(finding.invoice_id, inv.pk)

    def test_gate8_aging_boundary(self):
        today = date.today()
        self.s.invoice('100.00', invoice_no='OLD',
                       date_emailed=today - timedelta(days=45))
        self.s.invoice('200.00', invoice_no='FRESH',
                       date_emailed=today - timedelta(days=44))
        run_platform_gates(self.s.company, SEASON)
        findings = self._gate(8)
        self.assertEqual(findings.count(), 1)
        self.assertIn('#OLD', findings.get().detail)

    def test_gate10_mcm_pick_needs_ortiz_haul(self):
        r = self.s.receipt('1', pick_date=date(2026, 4, 12))
        mcm = self.s.invoice('1000.00', contractor='MCM')
        relink_season(self.s.company, SEASON)
        run_platform_gates(self.s.company, SEASON)
        self.assertEqual(self._gate(10).count(), 1)
        self.assertIn('does not haul', self._gate(10).get().detail)

        # An Ortiz haul over the same receipts clears it.
        self.s.invoice('120.00', kind='HAUL', contractor='Ortiz')
        relink_season(self.s.company, SEASON)
        run_platform_gates(self.s.company, SEASON)
        self.assertEqual(self._gate(10).count(), 0)

    def test_gate10_magana_hauls_for_itself(self):
        self.s.receipt('1', pick_date=date(2026, 4, 12))
        self.s.invoice('1000.00', contractor='Magana')
        relink_season(self.s.company, SEASON)
        run_platform_gates(self.s.company, SEASON)
        self.assertEqual(self._gate(10).count(), 0)

    def test_gate11_unmatched_charges_are_first_class(self):
        self.s.charge('56544.00', ap_reference='APM-SL-00562')
        self.s.charge('5465.00', ap_reference='APM-SL-00481')
        run_reconciliation(self.s.company, SEASON)
        run_platform_gates(self.s.company, SEASON)
        finding = self._gate(11).get()
        self.assertEqual(finding.severity, 'warn')
        self.assertIn('$62,009.00', finding.detail)
        self.assertIn('2 house-posted charge row(s)', finding.detail)

    def test_platform_rerun_replaces_findings(self):
        self.s.invoice('100.00', date_emailed=date.today() - timedelta(days=60))
        run_platform_gates(self.s.company, SEASON)
        run_platform_gates(self.s.company, SEASON)
        self.assertEqual(self._gate(8).count(), 1)  # replaced, not appended


class HarvestActivityTests(TestCase):
    """The unified deliveries view: receipts ARE the harvest record."""

    def setUp(self):
        self.s = PickHaulScenario()
        self.client = APIClient()
        self.client.force_authenticate(user=self.s.owner)

    def _get(self):
        res = self.client.get('/api/pickhaul/harvest-activity/')
        self.assertEqual(res.status_code, 200, res.data)
        return res.data

    def test_invoice_cost_allocates_proportional_to_bins(self):
        # One $300 pick invoice over a 20-bin and a 10-bin receipt: $200/$100.
        r1 = self.s.receipt('1', pick_date=date(2026, 4, 11), bins='20')
        r2 = self.s.receipt('2', pick_date=date(2026, 4, 12), bins='10')
        self.s.invoice('300.00', block='SESPE',
                       date_from=date(2026, 4, 10), date_to=date(2026, 4, 15))
        relink_season(self.s.company, SEASON)
        data = self._get()
        block = data['blocks'][0]
        by_no = {d['receipt_no']: d for d in block['deliveries']}
        self.assertEqual(Decimal(str(by_no['1']['pick_cost'])), Decimal('200'))
        self.assertEqual(Decimal(str(by_no['2']['pick_cost'])), Decimal('100'))
        self.assertEqual(by_no['1']['cost_basis'], 'allocated')
        self.assertEqual(Decimal(str(block['pick_cost'])), Decimal('300'))

    def test_manual_picks_join_the_record_and_respect_count_flags(self):
        from api.models import PickHaulManualPick
        for row_no, (cost, count) in enumerate([('100.00', True), ('100.00', False)], 1):
            PickHaulManualPick.objects.create(
                company=self.s.company, packinghouse=self.s.sla, entity=self.s.jpf,
                season=SEASON, sheet='Limoneira', ranch='Rancho', block='A',
                pick_date=date(2026, 4, 1), bins=Decimal('5'),
                cost=Decimal(cost), count_cost=count, row_no=row_no,
            )
        data = self._get()
        # The repeat row displays but does not double the totals.
        self.assertEqual(Decimal(str(data['stats']['pick_cost'])), Decimal('100'))
        self.assertEqual(Decimal(str(data['stats']['bins_delivered'])), Decimal('10'))
        manual_block = data['blocks'][0]
        self.assertEqual(len(manual_block['deliveries']), 2)
        self.assertEqual(manual_block['deliveries'][0]['cost_basis'], 'keyed')

    def test_inactive_receipts_display_but_do_not_count(self):
        self.s.receipt('1', bins='20')
        self.s.receipt('2', bins='30', is_active=False)
        data = self._get()
        self.assertEqual(Decimal(str(data['stats']['bins_delivered'])), Decimal('20'))
        self.assertEqual(data['stats']['deliveries'], 2)  # still visible

    def test_owed_and_unmatched_travel_in_stats(self):
        self.s.invoice('5000.00', date_emailed=date(2026, 6, 1))
        self.s.charge('7777.00', ap_reference='APM-SL-00999')
        run_reconciliation(self.s.company, SEASON)
        data = self._get()
        self.assertEqual(Decimal(str(data['stats']['owed_total'])), Decimal('5000.00'))
        self.assertEqual(data['stats']['unmatched_charges']['rows'], 1)

    def test_requires_pick_haul_permission(self):
        worker = self.s.member('worker')
        client = APIClient()
        client.force_authenticate(user=worker)
        self.assertEqual(client.get('/api/pickhaul/harvest-activity/').status_code, 403)


class AgingSummaryTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()
        self.client = APIClient()
        self.client.force_authenticate(user=self.s.owner)
        today = date.today()
        # One invoice per bucket, plus the boundary cases 30/31 and 90/91.
        self.s.invoice('100.00', invoice_no='b1', date_emailed=today - timedelta(days=10))
        self.s.invoice('200.00', invoice_no='b2', date_emailed=today - timedelta(days=30))
        self.s.invoice('300.00', invoice_no='b3', date_emailed=today - timedelta(days=31))
        self.s.invoice('400.00', invoice_no='b4', date_emailed=today - timedelta(days=90))
        self.s.invoice('500.00', invoice_no='b5', date_emailed=today - timedelta(days=91))
        # Charged-back and never-emailed rows stay out of the buckets.
        self.s.invoice('999.00', invoice_no='done', date_emailed=today,
                       charge_posted=today)
        self.s.invoice('888.00', invoice_no='not-sent')

    def test_bucket_math(self):
        res = self.client.get('/api/pickhaul/summary/aging/')
        self.assertEqual(res.status_code, 200, res.data)
        data = res.data
        self.assertEqual(data['outstanding_count'], 5)
        self.assertEqual(Decimal(str(data['total_owed'])), Decimal('1500.00'))
        b = data['buckets']
        self.assertEqual(b['0_30']['count'], 2)      # days 10 and 30
        self.assertEqual(b['31_60']['count'], 1)     # day 31
        self.assertEqual(b['61_90']['count'], 1)     # day 90
        self.assertEqual(b['90_plus']['count'], 1)   # day 91
        self.assertEqual(len(data['houses']), 1)
        house = data['houses'][0]
        self.assertEqual(house['outstanding_count'], 5)
        self.assertEqual(house['oldest_days'], 91)

    def test_sync_status_shape(self):
        res = self.client.get('/api/pickhaul/sync-status/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['stale'])           # no batch yet
        self.assertIsNone(res.data['last_push_at'])
        self.assertEqual(res.data['sources'], [])
