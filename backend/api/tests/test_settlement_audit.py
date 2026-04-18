"""
Tests for the settlement audit service.

Each check gets focused coverage: reconciliation exact/off, drift at the
threshold boundaries, block variance on uneven grade distributions, house
variance direction sensitivity, and historical outlier fallbacks when
sample size is insufficient. The end-to-end case confirms the findings
come back sorted by severity then dollar impact.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase

from api.models import (
    Company,
    Farm,
    Field,
    Packinghouse,
    Pool,
    PoolSettlement,
    SettlementDeduction,
    SettlementGradeLine,
)
from api.services.settlement_audit import (
    audit_settlement,
    _check_block_variance,
    _check_deduction_drift,
    _check_historical_outliers,
    _check_house_variance,
    _check_reconciliation,
    DRIFT_PCT,
)


def make_settlement(
    pool,
    field,
    statement_date,
    *,
    total_bins=Decimal('100.00'),
    total_credits=Decimal('5000.00'),
    total_deductions=Decimal('1000.00'),
    net_return=None,
    prior_advances=Decimal('0.00'),
    amount_due=None,
    net_per_bin=None,
    house_avg_per_bin=None,
):
    if net_return is None:
        net_return = total_credits - total_deductions
    if amount_due is None:
        amount_due = net_return - prior_advances
    if net_per_bin is None and total_bins > 0:
        net_per_bin = net_return / total_bins
    return PoolSettlement.objects.create(
        pool=pool, field=field, statement_date=statement_date,
        total_bins=total_bins,
        total_credits=total_credits,
        total_deductions=total_deductions,
        net_return=net_return,
        prior_advances=prior_advances,
        amount_due=amount_due,
        net_per_bin=net_per_bin,
        house_avg_per_bin=house_avg_per_bin,
    )


class SettlementAuditBase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Citrus Co')
        cls.farm = Farm.objects.create(company=cls.company, name='North')
        cls.field = Field.objects.create(
            farm=cls.farm, name='Block 1',
            total_acres=Decimal('10.00'),
            current_crop='Navel Oranges',
        )
        cls.packinghouse = Packinghouse.objects.create(
            company=cls.company, name='VPOA', short_code='VPOA',
        )
        cls.pool = Pool.objects.create(
            packinghouse=cls.packinghouse,
            pool_id='POOL-1', name='Navel Pool',
            commodity='NAVELS', season='2025-2026',
        )


class ReconciliationTests(SettlementAuditBase):
    def test_reconciliation_clean_when_math_ties(self):
        s = make_settlement(self.pool, self.field, date(2026, 3, 1))
        findings = _check_reconciliation(s)
        self.assertEqual(findings, [])

    def test_reconciliation_flags_credits_vs_net_mismatch(self):
        # net_return off by $200 from credits - deductions
        s = make_settlement(
            self.pool, self.field, date(2026, 3, 1),
            total_credits=Decimal('5000'),
            total_deductions=Decimal('1000'),
            net_return=Decimal('4200'),  # should be 4000
            amount_due=Decimal('4200'),
        )
        findings = _check_reconciliation(s)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].code, 'reconciliation_credits_vs_net')
        self.assertAlmostEqual(findings[0].dollar_impact, -200.0, places=1)

    def test_reconciliation_flags_advance_vs_due_mismatch(self):
        # amount_due off from net_return - prior_advances by $50
        s = make_settlement(
            self.pool, self.field, date(2026, 3, 1),
            total_credits=Decimal('5000'),
            total_deductions=Decimal('1000'),
            net_return=Decimal('4000'),
            prior_advances=Decimal('1000'),
            amount_due=Decimal('3050'),  # should be 3000
        )
        findings = _check_reconciliation(s)
        codes = {f.code for f in findings}
        self.assertIn('reconciliation_advance_vs_due', codes)

    def test_reconciliation_ignores_rounding_slack(self):
        # $2 slop should stay under tolerance
        s = make_settlement(
            self.pool, self.field, date(2026, 3, 1),
            total_credits=Decimal('5000'),
            total_deductions=Decimal('1000'),
            net_return=Decimal('4000'),
            prior_advances=Decimal('500'),
            amount_due=Decimal('3502'),  # $2 off — under tolerance
        )
        findings = _check_reconciliation(s)
        self.assertEqual(findings, [])


class DeductionDriftTests(SettlementAuditBase):
    def _with_deduction(self, settlement, category, amount, per_bin_rate=None):
        bins = settlement.total_bins or Decimal(1)
        if per_bin_rate is None:
            per_bin_rate = amount / bins
        SettlementDeduction.objects.create(
            settlement=settlement, category=category,
            description=category.title(), quantity=bins,
            unit_of_measure='BIN', rate=per_bin_rate, amount=amount,
        )

    def test_drift_flagged_when_category_jumps(self):
        # Three baseline pools at $40 packing (0.40/bin on 100 bins)
        for days_ago in [60, 30, 15]:
            base = make_settlement(
                self.pool, self.field,
                date(2026, 3, 1) - timedelta(days=days_ago),
            )
            self._with_deduction(base, 'packing', Decimal('40.00'))

        # Current pool has packing at $60 (0.60/bin) — 50% jump
        current = make_settlement(self.pool, self.field, date(2026, 3, 1))
        self._with_deduction(current, 'packing', Decimal('60.00'))

        findings = _check_deduction_drift(current)
        drift = [f for f in findings if f.code.startswith('deduction_drift_')]
        self.assertEqual(len(drift), 1)
        self.assertIn('packing', drift[0].code)
        # Impact should be approx -$20 (extra $0.20/bin × 100 bins, negative to grower)
        self.assertAlmostEqual(drift[0].dollar_impact, 20.0, places=1)

    def test_drift_not_flagged_under_threshold(self):
        # Baseline at 0.40/bin, current at 0.43 → 7.5% change, under 10% floor
        for days_ago in [60, 30, 15]:
            base = make_settlement(
                self.pool, self.field,
                date(2026, 3, 1) - timedelta(days=days_ago),
            )
            self._with_deduction(base, 'packing', Decimal('40.00'))

        current = make_settlement(self.pool, self.field, date(2026, 3, 1))
        self._with_deduction(current, 'packing', Decimal('43.00'))

        findings = _check_deduction_drift(current)
        drift = [f for f in findings if f.code.startswith('deduction_drift_')]
        self.assertEqual(drift, [])

    def test_drift_skips_tiny_baseline(self):
        # baseline per-bin < DRIFT_MIN_BASE_PER_BIN — noise, don't flag
        for days_ago in [30, 15]:
            base = make_settlement(
                self.pool, self.field,
                date(2026, 3, 1) - timedelta(days=days_ago),
            )
            self._with_deduction(base, 'other', Decimal('2.00'))  # 0.02/bin

        current = make_settlement(self.pool, self.field, date(2026, 3, 1))
        self._with_deduction(current, 'other', Decimal('5.00'))  # 0.05/bin — 150% jump

        findings = _check_deduction_drift(current)
        self.assertEqual(findings, [])


class BlockVarianceTests(SettlementAuditBase):
    def _grade_line(self, settlement, block, quantity_bins, total):
        SettlementGradeLine.objects.create(
            settlement=settlement,
            block_id=block, grade='SK DOMESTIC', size='',
            unit_of_measure='BIN', quantity=Decimal(quantity_bins),
            percent_of_total=Decimal('50.00'),
            fob_rate=Decimal(str(total / quantity_bins)),
            total_amount=Decimal(str(total)),
        )

    def test_block_variance_flagged_when_one_block_underperforms(self):
        s = make_settlement(self.pool, self.field, date(2026, 3, 1))
        # Block 2 at $40/bin, Block 3 at $20/bin — 50% gap
        self._grade_line(s, '002', 25, 1000)  # $40/bin
        self._grade_line(s, '003', 25, 500)   # $20/bin
        findings = _check_block_variance(s)
        self.assertGreater(len(findings), 0)
        codes = {f.code for f in findings}
        self.assertIn('block_variance', codes)

    def test_block_variance_skips_when_only_one_block(self):
        s = make_settlement(self.pool, self.field, date(2026, 3, 1))
        self._grade_line(s, '002', 25, 1000)
        findings = _check_block_variance(s)
        self.assertEqual(findings, [])


class HouseVarianceTests(SettlementAuditBase):
    def test_house_variance_flags_when_below_house(self):
        s = make_settlement(
            self.pool, self.field, date(2026, 3, 1),
            net_per_bin=Decimal('35.00'),
            house_avg_per_bin=Decimal('45.00'),
        )
        findings = _check_house_variance(s)
        self.assertEqual(len(findings), 1)
        # 22% below — should be critical
        self.assertEqual(findings[0].severity, 'critical')

    def test_house_variance_informational_when_above_house(self):
        s = make_settlement(
            self.pool, self.field, date(2026, 3, 1),
            net_per_bin=Decimal('50.00'),
            house_avg_per_bin=Decimal('45.00'),
        )
        findings = _check_house_variance(s)
        self.assertEqual(len(findings), 1)
        self.assertEqual(findings[0].severity, 'info')

    def test_house_variance_skipped_under_info_threshold(self):
        # 3% delta — below 5% info floor
        s = make_settlement(
            self.pool, self.field, date(2026, 3, 1),
            net_per_bin=Decimal('43.65'),
            house_avg_per_bin=Decimal('45.00'),
        )
        findings = _check_house_variance(s)
        self.assertEqual(findings, [])


class HistoricalOutlierTests(SettlementAuditBase):
    def test_outlier_skipped_when_insufficient_history(self):
        # Only 2 prior pools — need at least 4
        for days_ago in [60, 30]:
            make_settlement(
                self.pool, self.field,
                date(2026, 3, 1) - timedelta(days=days_ago),
                net_per_bin=Decimal('45.00'),
            )
        current = make_settlement(
            self.pool, self.field, date(2026, 3, 1),
            net_per_bin=Decimal('10.00'),
        )
        findings = _check_historical_outliers(current)
        self.assertEqual(findings, [])

    def test_outlier_flagged_with_enough_history(self):
        # Five baseline pools tightly clustered around $45
        for days_ago, net in zip([150, 120, 90, 60, 30], [45, 46, 44, 45, 45]):
            make_settlement(
                self.pool, self.field,
                date(2026, 3, 1) - timedelta(days=days_ago),
                net_per_bin=Decimal(str(net)),
            )
        current = make_settlement(
            self.pool, self.field, date(2026, 3, 1),
            net_per_bin=Decimal('25.00'),  # way out of band
        )
        findings = _check_historical_outliers(current)
        net_outliers = [f for f in findings if f.code == 'outlier_net_per_bin']
        self.assertEqual(len(net_outliers), 1)


class EndToEndAuditTests(SettlementAuditBase):
    def test_clean_settlement_returns_clean_status(self):
        s = make_settlement(
            self.pool, self.field, date(2026, 3, 1),
            net_per_bin=Decimal('45.00'),
            house_avg_per_bin=Decimal('45.00'),
        )
        report = audit_settlement(s)
        self.assertEqual(report.summary['overall_status'], 'clean')
        self.assertEqual(report.findings, [])

    def test_findings_sorted_by_severity_then_impact(self):
        # Build a settlement with both a critical reconciliation error and
        # an informational house variance
        s = make_settlement(
            self.pool, self.field, date(2026, 3, 1),
            total_credits=Decimal('5000'),
            total_deductions=Decimal('1000'),
            net_return=Decimal('3500'),   # off by $500 from credits-deductions
            amount_due=Decimal('3500'),
            net_per_bin=Decimal('35.00'),  # 7% above house — info tier
            house_avg_per_bin=Decimal('32.50'),
        )
        report = audit_settlement(s)
        self.assertGreater(len(report.findings), 0)
        # First finding should be the reconciliation one (critical)
        self.assertEqual(report.findings[0].category, 'reconciliation')
        # Overall status should be at least 'review'
        self.assertIn(report.summary['overall_status'], ('review', 'critical'))
