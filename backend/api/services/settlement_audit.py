"""
Settlement audit — surface anomalies on a pool settlement the grower would
otherwise miss scrolling through a 5-page PDF.

Runs five checks on demand (no persistence) against the existing
PoolSettlement / SettlementGradeLine / SettlementDeduction / GrowerLedgerEntry
schema:

  1. Reconciliation        — does total_credits - total_deductions = net_return,
                             and net_return - prior_advances = amount_due?
  2. Deduction drift       — per category, $/bin vs the grower's trailing 6 pools
  3. Block variance        — per block_id, net/bin vs pool median for same commodity
  4. House variance        — settlement net/bin vs packinghouse's house_avg_per_bin
  5. Historical outliers   — net/bin and deduction-ratio vs 12-month trailing stats

Every finding carries (severity, dollar_impact, source_ref) so the UI can
sort by money and jump to the PDF page. Findings are ephemeral by design —
the whole report recomputes in a single query pass.

Thresholds are tuned conservatively (bias toward surfacing things) and
hard-coded for MVP. A future SettlementAuditPreference table can override
per company without touching this service.
"""

from dataclasses import dataclass, field as dc_field, asdict
from decimal import Decimal
from statistics import mean, pstdev
from typing import List, Optional

from django.db.models import Q


# =============================================================================
# Thresholds (hard-coded for MVP)
# =============================================================================

RECONCILIATION_TOLERANCE = Decimal('5.00')        # accept ≤$5 rounding slack
RECONCILIATION_PCT = Decimal('0.01')              # or 1% of pool value
DRIFT_PCT = Decimal('0.10')                       # 10% change flags drift
DRIFT_MIN_BASE_PER_BIN = Decimal('0.05')          # ignore drift on tiny bases
DRIFT_LOOKBACK_POOLS = 6
BLOCK_VARIANCE_PCT = Decimal('0.15')              # 15% variance block-to-pool
HOUSE_VARIANCE_PCT = Decimal('0.10')              # 10% below/above house avg
HOUSE_VARIANCE_INFO_PCT = Decimal('0.05')
OUTLIER_STDEV_THRESHOLD = Decimal('2.0')
OUTLIER_LOOKBACK_DAYS = 365
OUTLIER_MIN_SAMPLES = 4


# =============================================================================
# Finding dataclasses
# =============================================================================

@dataclass
class Finding:
    """A single audit finding. dollar_impact may be None for informational
    items that don't have a clean dollar translation."""
    code: str
    severity: str            # 'info' | 'warning' | 'critical'
    category: str            # 'reconciliation' | 'drift' | 'block' | 'house' | 'outlier'
    title: str
    message: str
    dollar_impact: Optional[float] = None
    source_ref: Optional[str] = None   # eg "grade-lines", "deductions", "ledger"
    details: dict = dc_field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class AuditReport:
    settlement_id: int
    statement_date: str
    pool_name: str
    packinghouse_name: str
    summary: dict            # counts per severity + overall status
    findings: List[Finding] = dc_field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            'settlement_id': self.settlement_id,
            'statement_date': self.statement_date,
            'pool_name': self.pool_name,
            'packinghouse_name': self.packinghouse_name,
            'summary': self.summary,
            'findings': [f.to_dict() for f in self.findings],
        }


# =============================================================================
# Helpers
# =============================================================================

def _dec(value) -> Optional[Decimal]:
    """Coerce to Decimal. Returns None on empty/None. Tolerates float/int/str."""
    if value is None or value == '':
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:
        return None


def _pct_change(current: Decimal, baseline: Decimal) -> Optional[Decimal]:
    """Percent change vs baseline (returns e.g. Decimal('0.15') for +15%)."""
    if baseline is None or baseline == 0:
        return None
    return (current - baseline) / baseline


def _severity_from_impact(dollar_impact: Decimal, pool_total: Decimal) -> str:
    """Shared severity ladder: critical if impact ≥2% of pool or ≥$500;
    warning if ≥0.5% or ≥$100; otherwise info."""
    abs_impact = abs(dollar_impact)
    if pool_total and pool_total > 0:
        pct = abs_impact / pool_total
        if pct >= Decimal('0.02') or abs_impact >= Decimal('500'):
            return 'critical'
        if pct >= Decimal('0.005') or abs_impact >= Decimal('100'):
            return 'warning'
        return 'info'
    # No pool_total to normalize against — use absolute tiers
    if abs_impact >= Decimal('500'):
        return 'critical'
    if abs_impact >= Decimal('100'):
        return 'warning'
    return 'info'


# =============================================================================
# Check 1 — Reconciliation
# =============================================================================

def _check_reconciliation(settlement) -> List[Finding]:
    findings: List[Finding] = []
    total_credits = _dec(settlement.total_credits) or Decimal(0)
    total_deductions = _dec(settlement.total_deductions) or Decimal(0)
    net_return = _dec(settlement.net_return) or Decimal(0)
    prior_advances = _dec(settlement.prior_advances) or Decimal(0)
    amount_due = _dec(settlement.amount_due) or Decimal(0)

    pool_total = max(total_credits, abs(net_return), Decimal('1'))
    tolerance = max(
        RECONCILIATION_TOLERANCE,
        pool_total * RECONCILIATION_PCT,
    )

    # credits - deductions = net_return
    internal_diff = total_credits - total_deductions - net_return
    if abs(internal_diff) > tolerance:
        findings.append(Finding(
            code='reconciliation_credits_vs_net',
            severity=_severity_from_impact(internal_diff, pool_total),
            category='reconciliation',
            title='Credits − deductions ≠ net return',
            message=(
                f"Total credits (${total_credits:,.2f}) minus deductions "
                f"(${total_deductions:,.2f}) should equal net return "
                f"(${net_return:,.2f}). The books are off by ${internal_diff:,.2f}."
            ),
            dollar_impact=float(internal_diff),
            source_ref='summary',
            details={
                'total_credits': float(total_credits),
                'total_deductions': float(total_deductions),
                'net_return': float(net_return),
                'difference': float(internal_diff),
            },
        ))

    # net_return - prior_advances = amount_due
    advance_diff = net_return - prior_advances - amount_due
    if abs(advance_diff) > tolerance:
        findings.append(Finding(
            code='reconciliation_advance_vs_due',
            severity=_severity_from_impact(advance_diff, pool_total),
            category='reconciliation',
            title='Advance-to-final math is off',
            message=(
                f"Net return (${net_return:,.2f}) minus prior advances "
                f"(${prior_advances:,.2f}) should equal amount due "
                f"(${amount_due:,.2f}), but it's off by ${advance_diff:,.2f}."
            ),
            dollar_impact=float(advance_diff),
            source_ref='summary',
            details={
                'net_return': float(net_return),
                'prior_advances': float(prior_advances),
                'amount_due': float(amount_due),
                'difference': float(advance_diff),
            },
        ))

    return findings


# =============================================================================
# Check 2 — Deduction drift
# =============================================================================

def _deduction_totals_by_category(settlement) -> dict:
    """Returns {category: (total_amount, per_bin)} for this settlement."""
    bins = _dec(settlement.total_bins) or Decimal(0)
    totals: dict = {}
    for ded in settlement.deductions.all():
        amt = _dec(ded.amount) or Decimal(0)
        cat = ded.category or 'other'
        totals[cat] = totals.get(cat, Decimal(0)) + amt
    return {
        cat: (total, (total / bins) if bins > 0 else None)
        for cat, total in totals.items()
    }


def _check_deduction_drift(settlement) -> List[Finding]:
    findings: List[Finding] = []
    from ..models import PoolSettlement

    bins = _dec(settlement.total_bins) or Decimal(0)
    if bins <= 0:
        return findings  # can't compute per-bin

    # Prior settlements for same pool's packinghouse AND same field (grower),
    # excluding this one, limited to the trailing window.
    prior_qs = (
        PoolSettlement.objects
        .filter(
            pool__packinghouse=settlement.pool.packinghouse,
            statement_date__lt=settlement.statement_date,
        )
        .exclude(id=settlement.id)
        .prefetch_related('deductions')
        .order_by('-statement_date')[:DRIFT_LOOKBACK_POOLS]
    )
    if settlement.field_id:
        prior_qs = prior_qs.filter(field_id=settlement.field_id)
    prior_settlements = list(prior_qs)
    if not prior_settlements:
        return findings

    # Aggregate baseline $/bin per category across the prior pools
    baseline_buckets: dict = {}
    for prior in prior_settlements:
        prior_bins = _dec(prior.total_bins) or Decimal(0)
        if prior_bins <= 0:
            continue
        cats = _deduction_totals_by_category(prior)
        for cat, (_, per_bin) in cats.items():
            if per_bin is None:
                continue
            baseline_buckets.setdefault(cat, []).append(per_bin)

    current_cats = _deduction_totals_by_category(settlement)
    pool_total = _dec(settlement.total_credits) or Decimal(0)

    for cat, (current_total, current_per_bin) in current_cats.items():
        if current_per_bin is None:
            continue
        base_samples = baseline_buckets.get(cat) or []
        if not base_samples:
            continue
        baseline = Decimal(str(mean([float(x) for x in base_samples])))
        if baseline < DRIFT_MIN_BASE_PER_BIN:
            continue
        change = _pct_change(current_per_bin, baseline)
        if change is None or abs(change) < DRIFT_PCT:
            continue

        delta_per_bin = current_per_bin - baseline
        impact = delta_per_bin * bins
        direction = 'up' if delta_per_bin > 0 else 'down'

        findings.append(Finding(
            code=f'deduction_drift_{cat}',
            severity=_severity_from_impact(impact, pool_total),
            category='drift',
            title=f'{cat.replace("_", " ").title()} rate moved {direction} vs. your last {len(base_samples)} pools',
            message=(
                f"{cat.replace('_', ' ').title()} is ${current_per_bin:.2f}/bin "
                f"on this pool versus a trailing average of ${baseline:.2f}/bin "
                f"({change:+.0%}). On {bins:,.0f} bins that's a "
                f"${impact:+,.2f} impact vs. the baseline."
            ),
            dollar_impact=float(impact),
            source_ref='deductions',
            details={
                'category': cat,
                'current_per_bin': float(current_per_bin),
                'baseline_per_bin': float(baseline),
                'pct_change': float(change),
                'bins': float(bins),
                'sample_size': len(base_samples),
            },
        ))

    return findings


# =============================================================================
# Check 3 — Block variance
# =============================================================================

def _check_block_variance(settlement) -> List[Finding]:
    findings: List[Finding] = []

    # Group credits and deductions by block_id
    block_credits: dict = {}
    block_bins: dict = {}
    for line in settlement.grade_lines.all():
        block = line.block_id or ''
        if not block:
            continue
        block_credits[block] = block_credits.get(block, Decimal(0)) + (_dec(line.total_amount) or Decimal(0))
        if line.unit_of_measure == 'BIN':
            block_bins[block] = block_bins.get(block, Decimal(0)) + (_dec(line.quantity) or Decimal(0))

    block_deductions: dict = {}
    for ded in settlement.deductions.all():
        block = ded.block_id or ''
        if not block:
            continue
        block_deductions[block] = block_deductions.get(block, Decimal(0)) + (_dec(ded.amount) or Decimal(0))

    # Need at least two blocks to compare
    blocks = set(block_credits.keys()) | set(block_deductions.keys())
    if len(blocks) < 2:
        return findings

    # Per-block net/bin. Skip blocks with no bin data.
    block_net_per_bin: dict = {}
    for block in blocks:
        bins = block_bins.get(block) or Decimal(0)
        if bins <= 0:
            continue
        net = block_credits.get(block, Decimal(0)) - block_deductions.get(block, Decimal(0))
        block_net_per_bin[block] = net / bins

    if len(block_net_per_bin) < 2:
        return findings

    values = list(block_net_per_bin.values())
    median_val = sorted(values)[len(values) // 2]
    pool_total = _dec(settlement.total_credits) or Decimal(0)

    for block, net_per_bin in block_net_per_bin.items():
        change = _pct_change(net_per_bin, median_val)
        if change is None or abs(change) < BLOCK_VARIANCE_PCT:
            continue
        delta = net_per_bin - median_val
        bins = block_bins.get(block) or Decimal(0)
        impact = delta * bins
        direction = 'above' if delta > 0 else 'below'

        findings.append(Finding(
            code='block_variance',
            severity=_severity_from_impact(impact, pool_total),
            category='block',
            title=f'Block {block} net is {abs(change):.0%} {direction} pool median',
            message=(
                f"Block {block} netted ${net_per_bin:.2f}/bin vs. pool median "
                f"${median_val:.2f}/bin on {bins:,.0f} bins "
                f"(${impact:+,.2f} vs. pool). Worth confirming the grade mix "
                f"and deductions for this block."
            ),
            dollar_impact=float(impact),
            source_ref='grade-lines',
            details={
                'block_id': block,
                'block_net_per_bin': float(net_per_bin),
                'pool_median_per_bin': float(median_val),
                'pct_delta': float(change),
                'bins': float(bins),
            },
        ))

    return findings


# =============================================================================
# Check 4 — House variance
# =============================================================================

def _check_house_variance(settlement) -> List[Finding]:
    findings: List[Finding] = []
    net_per_bin = _dec(settlement.net_per_bin)
    house_avg = _dec(settlement.house_avg_per_bin)
    bins = _dec(settlement.total_bins) or Decimal(0)
    if net_per_bin is None or house_avg is None or house_avg <= 0:
        return findings

    change = _pct_change(net_per_bin, house_avg)
    if change is None:
        return findings
    if abs(change) < HOUSE_VARIANCE_INFO_PCT:
        return findings

    delta = net_per_bin - house_avg
    impact = delta * bins if bins > 0 else Decimal(0)
    direction = 'below' if delta < 0 else 'above'

    if abs(change) >= HOUSE_VARIANCE_PCT:
        severity = 'warning' if delta < 0 else 'info'
        if abs(change) >= Decimal('0.20') and delta < 0:
            severity = 'critical'
    else:
        severity = 'info'

    findings.append(Finding(
        code='house_variance',
        severity=severity,
        category='house',
        title=f'Net/bin is {abs(change):.0%} {direction} house average',
        message=(
            f"This settlement netted ${net_per_bin:.2f}/bin vs. the packinghouse "
            f"average of ${house_avg:.2f}/bin. On {bins:,.0f} bins that's "
            f"${impact:+,.2f} vs. the house."
        ),
        dollar_impact=float(impact),
        source_ref='summary',
        details={
            'net_per_bin': float(net_per_bin),
            'house_avg_per_bin': float(house_avg),
            'pct_delta': float(change),
            'bins': float(bins),
        },
    ))
    return findings


# =============================================================================
# Check 5 — Historical outliers
# =============================================================================

def _check_historical_outliers(settlement) -> List[Finding]:
    findings: List[Finding] = []
    from datetime import timedelta
    from ..models import PoolSettlement

    cutoff = settlement.statement_date - timedelta(days=OUTLIER_LOOKBACK_DAYS)
    prior_qs = (
        PoolSettlement.objects
        .filter(
            pool__packinghouse__company=settlement.pool.packinghouse.company,
            statement_date__gte=cutoff,
            statement_date__lt=settlement.statement_date,
        )
        .exclude(id=settlement.id)
    )
    if settlement.field_id:
        prior_qs = prior_qs.filter(field_id=settlement.field_id)

    prior_settlements = list(prior_qs)
    if len(prior_settlements) < OUTLIER_MIN_SAMPLES:
        return findings

    # Net/bin outlier
    net_series = [float(p.net_per_bin) for p in prior_settlements if p.net_per_bin is not None]
    if len(net_series) >= OUTLIER_MIN_SAMPLES:
        avg = Decimal(str(mean(net_series)))
        sd = Decimal(str(pstdev(net_series))) if pstdev(net_series) > 0 else Decimal(0)
        current = _dec(settlement.net_per_bin)
        bins = _dec(settlement.total_bins) or Decimal(0)
        if current is not None and sd > 0:
            z = (current - avg) / sd
            if abs(z) >= OUTLIER_STDEV_THRESHOLD:
                delta = current - avg
                impact = delta * bins
                findings.append(Finding(
                    code='outlier_net_per_bin',
                    severity='warning' if abs(z) < Decimal('3') else 'critical',
                    category='outlier',
                    title=f"Net/bin is {abs(z):.1f} std devs {'below' if z < 0 else 'above'} your 12-month average",
                    message=(
                        f"Net/bin of ${current:.2f} is unusual vs. your "
                        f"{len(net_series)}-settlement trailing average of "
                        f"${avg:.2f} (σ ${sd:.2f}). On {bins:,.0f} bins that's "
                        f"${impact:+,.2f} vs. your typical pool."
                    ),
                    dollar_impact=float(impact),
                    source_ref='summary',
                    details={
                        'current': float(current),
                        'trailing_mean': float(avg),
                        'trailing_stdev': float(sd),
                        'z_score': float(z),
                        'sample_size': len(net_series),
                    },
                ))

    # Deduction ratio outlier (deductions / credits)
    ratio_series = []
    for p in prior_settlements:
        credits = _dec(p.total_credits) or Decimal(0)
        ded = _dec(p.total_deductions) or Decimal(0)
        if credits > 0:
            ratio_series.append(float(ded / credits))
    if len(ratio_series) >= OUTLIER_MIN_SAMPLES:
        avg_ratio = Decimal(str(mean(ratio_series)))
        sd_ratio = Decimal(str(pstdev(ratio_series))) if pstdev(ratio_series) > 0 else Decimal(0)
        current_credits = _dec(settlement.total_credits) or Decimal(0)
        current_ded = _dec(settlement.total_deductions) or Decimal(0)
        if current_credits > 0 and sd_ratio > 0:
            current_ratio = current_ded / current_credits
            z = (current_ratio - avg_ratio) / sd_ratio
            if abs(z) >= OUTLIER_STDEV_THRESHOLD:
                delta_ratio = current_ratio - avg_ratio
                impact = delta_ratio * current_credits
                findings.append(Finding(
                    code='outlier_deduction_ratio',
                    severity='warning' if abs(z) < Decimal('3') else 'critical',
                    category='outlier',
                    title=f"Deductions are {current_ratio:.1%} of credits — {abs(z):.1f}σ vs. typical",
                    message=(
                        f"Deductions ate {current_ratio:.1%} of credits vs. a "
                        f"trailing average of {avg_ratio:.1%}. That's an extra "
                        f"${impact:+,.2f} in deductions vs. your typical pool."
                    ),
                    dollar_impact=float(impact),
                    source_ref='deductions',
                    details={
                        'current_ratio': float(current_ratio),
                        'trailing_mean_ratio': float(avg_ratio),
                        'trailing_stdev_ratio': float(sd_ratio),
                        'z_score': float(z),
                        'sample_size': len(ratio_series),
                    },
                ))

    return findings


# =============================================================================
# Public API
# =============================================================================

def audit_settlement(pool_settlement) -> AuditReport:
    """Run all five checks and return a consolidated report."""
    all_findings: List[Finding] = []
    all_findings.extend(_check_reconciliation(pool_settlement))
    all_findings.extend(_check_deduction_drift(pool_settlement))
    all_findings.extend(_check_block_variance(pool_settlement))
    all_findings.extend(_check_house_variance(pool_settlement))
    all_findings.extend(_check_historical_outliers(pool_settlement))

    # Sort by absolute dollar impact (biggest first), then by severity
    severity_order = {'critical': 0, 'warning': 1, 'info': 2}
    all_findings.sort(
        key=lambda f: (
            severity_order.get(f.severity, 3),
            -abs(f.dollar_impact or 0),
        ),
    )

    counts = {'critical': 0, 'warning': 0, 'info': 0}
    total_impact = 0.0
    for f in all_findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1
        if f.dollar_impact:
            total_impact += abs(f.dollar_impact)

    if counts['critical'] > 0:
        overall = 'critical'
    elif counts['warning'] > 0:
        overall = 'review'
    else:
        overall = 'clean'

    summary = {
        'overall_status': overall,
        'counts': counts,
        'total_abs_dollar_impact': round(total_impact, 2),
    }

    return AuditReport(
        settlement_id=pool_settlement.id,
        statement_date=pool_settlement.statement_date.isoformat()
            if pool_settlement.statement_date else None,
        pool_name=pool_settlement.pool.name if pool_settlement.pool_id else '',
        packinghouse_name=(
            pool_settlement.pool.packinghouse.name
            if pool_settlement.pool_id and pool_settlement.pool.packinghouse_id
            else ''
        ),
        summary=summary,
        findings=all_findings,
    )
