"""The deliveries-first season overview endpoint."""

from datetime import date
from decimal import Decimal

from django.test import TestCase

from api.models import (
    GrowerLedgerEntry, PackerCommitment, Pool, PoolSettlement,
)
from api.services.season_overview import build_season_overview
from api.tests.pickhaul_helpers import SEASON, PickHaulScenario


def _settlement(pool, *, total_bins=None, total_weight_lbs=None,
                net_return=Decimal('0'), statement_date=date(2026, 6, 1)):
    return PoolSettlement.objects.create(
        pool=pool, statement_date=statement_date,
        total_bins=total_bins, total_weight_lbs=total_weight_lbs,
        total_credits=net_return, total_deductions=Decimal('0'),
        net_return=net_return, prior_advances=Decimal('0'),
        amount_due=net_return,
    )


def _card(result, commodity):
    return next(
        (c for c in result['commodities'] if c['commodity'] == commodity), None,
    )


class SeasonOverviewServiceTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()

    def _lemon_pool(self, season_label='2025-2026'):
        return Pool.objects.create(
            packinghouse=self.s.sla, pool_id=f'LEM-{season_label}',
            name='Lemon Pool', commodity='LEMONS', season=season_label,
        )

    def test_delivery_stats_present(self):
        self.s.receipt('1001', bins='20.0', commodity_code='LEM')
        self.s.receipt('1002', bins='10.0', commodity_code='LEM')
        self.s.invoice('600.00')

        result = build_season_overview(self.s.company, SEASON)
        self.assertEqual(result['delivery']['bins_delivered'], Decimal('30.0'))
        self.assertEqual(result['delivery']['pick_cost'], Decimal('600.00'))
        card = _card(result, 'LEMONS')
        self.assertIsNotNone(card)
        self.assertEqual(card['delivered_bins'], Decimal('30.0'))
        self.assertTrue(card['awaiting_settlement'])
        self.assertIsNone(card['settlement_percent'])

    def test_settlement_pct_uses_delivered_denominator(self):
        self.s.receipt('1001', bins='100.0', commodity_code='LEM')
        pool = self._lemon_pool()
        _settlement(pool, total_bins=Decimal('60.0'), net_return=Decimal('9000.00'))
        result = build_season_overview(self.s.company, SEASON)
        card = _card(result, 'LEMONS')
        self.assertEqual(card['settlement_percent'], 60.0)
        self.assertFalse(card['awaiting_settlement'])

    def test_pool_label_drift_tolerated(self):
        self.s.receipt('1001', bins='10.0', commodity_code='LEM')
        pool = self._lemon_pool(season_label='2025-26')  # drifted label
        _settlement(pool, total_bins=Decimal('10.0'), net_return=Decimal('1500.00'))
        result = build_season_overview(self.s.company, SEASON)
        card = _card(result, 'LEMONS')
        self.assertEqual(card['net_return'], Decimal('1500.00'))

    def test_net_to_grower_requires_both_sides(self):
        # Delivery + cost, no settlement -> None.
        r = self.s.receipt('1001', bins='10.0', commodity_code='LEM')
        inv = self.s.invoice('300.00')
        inv.receipt_links.create(receipt=r, assigned='manual')
        result = build_season_overview(self.s.company, SEASON)
        self.assertIsNone(_card(result, 'LEMONS')['net_to_grower'])

        # Add the settlement -> net = 1500 - 300.
        pool = self._lemon_pool()
        _settlement(pool, total_bins=Decimal('10.0'), net_return=Decimal('1500.00'))
        result = build_season_overview(self.s.company, SEASON)
        card = _card(result, 'LEMONS')
        self.assertEqual(card['net_to_grower'], Decimal('1200.00'))
        self.assertEqual(card['net_to_grower_per_bin'], Decimal('120.00'))

    def test_cash_received_rollup(self):
        pool = self._lemon_pool()
        GrowerLedgerEntry.objects.create(
            packinghouse=self.s.sla, pool=pool,
            entry_date=date(2026, 1, 10), entry_type='advance',
            credit=Decimal('5000.00'), debit=Decimal('0'),
        )
        GrowerLedgerEntry.objects.create(
            packinghouse=self.s.sla, pool=None,
            entry_date=date(2026, 2, 1), entry_type='payment',
            credit=Decimal('750.00'), debit=Decimal('0'),
        )
        # Reimbursement actually received on a grower-paid invoice.
        self.s.invoice(
            '400.00', date_emailed=date(2026, 3, 1),
            date_rec_from_ph=date(2026, 4, 1),
        )
        # House-billed invoices never count as reimbursements.
        self.s.invoice(
            '999.00', billing='house_billed',
            date_rec_from_ph=date(2026, 4, 2),
        )

        result = build_season_overview(self.s.company, SEASON)
        cash = result['cash_received']
        self.assertEqual(cash['advances'], Decimal('5000.00'))
        self.assertEqual(cash['payments'], Decimal('750.00'))
        self.assertEqual(cash['reimbursements'], Decimal('400.00'))
        self.assertEqual(cash['total'], Decimal('6150.00'))

    def test_commitment_annotation_and_mismatch(self):
        self.s.receipt('1001', bins='10.0', commodity_code='LEM', house=self.s.vpoa)
        PackerCommitment.objects.create(
            company=self.s.company, season=SEASON, commodity='LEMONS',
            packinghouse=self.s.sla,
        )
        result = build_season_overview(self.s.company, SEASON)
        card = _card(result, 'LEMONS')
        self.assertEqual(card['committed']['default']['packinghouse'], 'SLA')
        self.assertEqual(card['actual_houses'], ['VPOA'])
        self.assertTrue(card['commitment_mismatch'])

    def test_flex_suppresses_mismatch(self):
        self.s.receipt('1001', bins='10.0', commodity_code='LEM', house=self.s.vpoa)
        PackerCommitment.objects.create(
            company=self.s.company, season=SEASON, commodity='LEMONS',
            packinghouse=self.s.sla, flex=True,
        )
        result = build_season_overview(self.s.company, SEASON)
        self.assertFalse(_card(result, 'LEMONS')['commitment_mismatch'])

    def test_unknown_codes_bucket_as_unmapped(self):
        self.s.receipt('1001', bins='5.0', commodity_code='ZZZ')
        result = build_season_overview(self.s.company, SEASON)
        card = _card(result, 'UNMAPPED')
        self.assertIsNotNone(card)
        self.assertEqual(card['delivered_bins'], Decimal('5.0'))

    def test_without_pickhaul_permission_sections_omitted(self):
        self.s.receipt('1001', bins='10.0', commodity_code='LEM')
        result = build_season_overview(self.s.company, SEASON, include_pickhaul=False)
        self.assertNotIn('delivery', result)
        self.assertNotIn('cash_received', result)


class SeasonOverviewEndpointTests(TestCase):
    def setUp(self):
        self.s = PickHaulScenario()
        self.client_api = self.s.factory.create_authenticated_client(self.s.owner)

    def test_endpoint_shape(self):
        self.s.receipt('1001', bins='12.5', commodity_code='LEM')
        res = self.client_api.get(
            f'/api/harvest-packing/season-overview/?season={SEASON}'
        )
        self.assertEqual(res.status_code, 200, res.content)
        data = res.json()
        self.assertEqual(data['season'], SEASON)
        self.assertIn('delivery', data)
        self.assertIn('cash_received', data)
        self.assertIn('commodities', data)

    def test_invalid_season_is_400(self):
        res = self.client_api.get('/api/harvest-packing/season-overview/?season=abc')
        self.assertEqual(res.status_code, 400)


class ModeARegressionTests(TestCase):
    """The two Mode A pipeline fixes: season param honored, BIN/LBS unmixed."""

    def setUp(self):
        self.s = PickHaulScenario()

    def _pipeline(self, **kwargs):
        from api.services.packinghouse_analytics import PackinghouseAnalyticsService
        return PackinghouseAnalyticsService.harvest_packing_pipeline(
            company=self.s.company, **kwargs,
        )

    def test_mode_a_honors_season_param(self):
        old_pool = Pool.objects.create(
            packinghouse=self.s.sla, pool_id='LEM-OLD', name='Old Lemon Pool',
            commodity='LEMONS', season='2024-2025',
        )
        _settlement(old_pool, total_bins=Decimal('50.0'),
                    net_return=Decimal('7000.00'), statement_date=date(2025, 6, 1))
        result = self._pipeline(season_id='2024-2025')
        card = next(c for c in result['commodity_cards'] if c['commodity'] == 'LEMONS')
        self.assertEqual(card['current_season'], '2024-2025')
        self.assertEqual(card['revenue'], 7000.0)

    def test_mode_a_summary_does_not_mix_units(self):
        from api.models import PackoutReport
        lemon_pool = Pool.objects.create(
            packinghouse=self.s.sla, pool_id='LEM-1', name='Lemon Pool',
            commodity='LEMONS', season='2025-2026',
        )
        avo_pool = Pool.objects.create(
            packinghouse=self.s.sla, pool_id='AVO-1', name='Avocado Pool',
            commodity='AVOCADOS', season='2025-2026',
        )
        _settlement(lemon_pool, total_bins=Decimal('50.0'), net_return=Decimal('7000.00'))
        PackoutReport.objects.create(
            pool=lemon_pool, report_date=date(2026, 5, 1),
            period_start=date(2026, 4, 1), period_end=date(2026, 4, 30),
            bins_this_period=Decimal('100.0'), bins_cumulative=Decimal('100.0'),
        )
        # Avocado packout carries bins-denominated numbers but settles in lbs.
        PackoutReport.objects.create(
            pool=avo_pool, report_date=date(2026, 5, 1),
            period_start=date(2026, 4, 1), period_end=date(2026, 4, 30),
            bins_this_period=Decimal('40.0'), bins_cumulative=Decimal('40.0'),
        )
        _settlement(avo_pool, total_weight_lbs=Decimal('36000.0'),
                    net_return=Decimal('30000.00'))

        result = self._pipeline(season_id='2025-2026')
        summary = result['summary']
        # BIN summary excludes the avocado packout's 40 bins.
        self.assertEqual(summary['total_bins_packed'], 100.0)
        self.assertEqual(summary['total_bins_settled'], 50.0)
        self.assertEqual(summary['settlement_percent'], 50.0)
        self.assertEqual(summary['total_lbs_settled'], 36000.0)
