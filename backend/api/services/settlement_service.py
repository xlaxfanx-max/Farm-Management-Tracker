"""
Settlement finalization service.

Extracted from packinghouse_views.py to keep view logic thin and make
these helpers independently testable.
"""
from decimal import Decimal
from django.db.models import Sum
from django.db.models.functions import Coalesce
import logging

logger = logging.getLogger(__name__)


def reconcile_settlement_from_grade_lines(settlement):
    """
    Recalculate total_weight_lbs and total_bins from grade line sums.
    Always prefer grade line totals (which represent net/packed quantities)
    over the header-level totals (which may be gross).

    Returns a list of warning strings if the header total differs
    significantly from the grade line sum.
    """
    from api.models import SettlementGradeLine

    warnings = []
    update_fields = []

    # Sum LBS grade lines
    lbs_total = SettlementGradeLine.objects.filter(
        settlement=settlement, unit_of_measure='LBS'
    ).aggregate(total=Coalesce(Sum('quantity'), Decimal('0')))['total']

    # Sum BIN grade lines
    bins_total = SettlementGradeLine.objects.filter(
        settlement=settlement, unit_of_measure='BIN'
    ).aggregate(total=Coalesce(Sum('quantity'), Decimal('0')))['total']

    # Reconcile LBS
    if lbs_total and lbs_total > 0:
        header_lbs = settlement.total_weight_lbs or Decimal('0')
        if header_lbs > 0 and header_lbs != lbs_total:
            diff = abs(float(header_lbs) - float(lbs_total))
            pct = (diff / float(header_lbs)) * 100
            if pct > 1:  # More than 1% difference
                warnings.append(
                    f"Weight mismatch: header shows {header_lbs:,.0f} lbs but grade lines sum to {lbs_total:,.0f} lbs "
                    f"(diff: {diff:,.0f} lbs / {pct:.1f}%). Using grade line total."
                )
        settlement.total_weight_lbs = lbs_total
        update_fields.append('total_weight_lbs')

        # Recalculate net_per_lb
        if settlement.net_return:
            settlement.net_per_lb = round(settlement.net_return / lbs_total, 4)
            update_fields.append('net_per_lb')

    # Reconcile BINs
    if bins_total and bins_total > 0:
        header_bins = settlement.total_bins or Decimal('0')
        if header_bins > 0 and header_bins != bins_total:
            diff = abs(float(header_bins) - float(bins_total))
            pct = (diff / float(header_bins)) * 100
            if pct > 1:  # More than 1% difference
                warnings.append(
                    f"Bins mismatch: header shows {header_bins:,.0f} bins but grade lines sum to {bins_total:,.0f} bins "
                    f"(diff: {diff:,.0f} bins / {pct:.1f}%). Using grade line total."
                )
        settlement.total_bins = bins_total
        update_fields.append('total_bins')

        # Recalculate net_per_bin
        if settlement.net_return:
            settlement.net_per_bin = round(settlement.net_return / bins_total, 4)
            update_fields.append('net_per_bin')

    if update_fields:
        settlement.save(update_fields=update_fields)

    return warnings


def validate_settlement_financials(settlement):
    """
    Validate financial consistency of a PoolSettlement.
    Checks that dollar amounts are internally consistent:
    - Grade line amounts sum to total_credits
    - Deduction amounts sum to total_deductions
    - net_return ≈ total_credits - total_deductions
    - amount_due ≈ net_return - prior_advances

    Non-blocking: returns warnings but does not modify data.

    Args:
        settlement: PoolSettlement instance (already saved with
                    grade_lines and deductions created)

    Returns:
        List[str]: Warning messages, empty if all checks pass.
    """
    from api.models import SettlementGradeLine, SettlementDeduction

    warnings = []

    def _check_mismatch(actual, expected, label, pct_threshold=1.0, abs_threshold=None):
        """Compare actual vs expected. Warn if difference exceeds thresholds."""
        if actual is None or expected is None:
            return None
        diff = abs(float(actual) - float(expected))
        if diff < 0.01:
            return None
        denominator = max(abs(float(actual)), abs(float(expected)))
        if denominator == 0:
            return None
        pct = (diff / denominator) * 100

        exceeded = pct > pct_threshold
        if abs_threshold is not None and diff > abs_threshold:
            exceeded = True

        if exceeded:
            return (
                f"{label}: expected ${float(expected):,.2f} but found "
                f"${float(actual):,.2f} (diff: ${diff:,.2f} / {pct:.1f}%)"
            )
        return None

    # Check 1: Grade line amounts sum to total_credits
    grade_line_sum = SettlementGradeLine.objects.filter(
        settlement=settlement
    ).aggregate(
        total=Coalesce(Sum('total_amount'), Decimal('0'))
    )['total']

    if grade_line_sum and grade_line_sum > 0 and settlement.total_credits:
        warning = _check_mismatch(
            actual=settlement.total_credits,
            expected=grade_line_sum,
            label="Grade line total vs total credits",
        )
        if warning:
            warnings.append(warning)

    # Check 2: Deduction amounts sum to total_deductions
    deduction_sum = SettlementDeduction.objects.filter(
        settlement=settlement
    ).aggregate(
        total=Coalesce(Sum('amount'), Decimal('0'))
    )['total']

    if deduction_sum and deduction_sum > 0 and settlement.total_deductions:
        warning = _check_mismatch(
            actual=settlement.total_deductions,
            expected=deduction_sum,
            label="Deduction total vs total deductions",
        )
        if warning:
            warnings.append(warning)

    # Check 3: net_return ≈ total_credits - total_deductions
    if (settlement.total_credits is not None
            and settlement.total_deductions is not None
            and settlement.net_return is not None):
        expected_net = settlement.total_credits - settlement.total_deductions
        warning = _check_mismatch(
            actual=settlement.net_return,
            expected=expected_net,
            label="Net return math (credits - deductions)",
            abs_threshold=100.00,
        )
        if warning:
            warnings.append(warning)

    # Check 4: amount_due ≈ net_return - prior_advances
    if (settlement.net_return is not None
            and settlement.amount_due is not None):
        prior = settlement.prior_advances or Decimal('0')
        expected_due = settlement.net_return - prior
        warning = _check_mismatch(
            actual=settlement.amount_due,
            expected=expected_due,
            label="Amount due math (net return - prior advances)",
            abs_threshold=50.00,
        )
        if warning:
            warnings.append(warning)

    return warnings


def finalize_settlement(settlement):
    """
    Run all post-creation/update settlement finalization steps:
    1. Reconcile totals from grade lines (weight/bins)
    2. Validate financial consistency
    3. Auto-update pool status if fully settled

    Returns a list of warning strings from reconciliation and validation.
    Must be called inside a transaction.atomic() block.
    """
    warnings = reconcile_settlement_from_grade_lines(settlement)
    financial_warnings = validate_settlement_financials(settlement)
    warnings.extend(financial_warnings)
    auto_update_pool_status(settlement.pool)
    return warnings


def auto_update_pool_status(pool):
    """
    Automatically update a pool's status to 'settled' when all packed
    quantity has been settled. Compares settled lbs/bins to packed lbs/bins.
    Only promotes status forward (active -> settled), never demotes.
    """
    from api.models import PoolSettlement, PackoutGradeLine, SettlementGradeLine, PackoutReport
    from api.services.season_service import get_primary_unit_for_commodity

    if pool.status == 'settled':
        return

    unit_info = get_primary_unit_for_commodity(pool.commodity)
    is_weight_based = (unit_info['unit'] == 'LBS')

    settlements = PoolSettlement.objects.filter(pool=pool)
    if not settlements.exists():
        return

    if is_weight_based:
        settled_lbs = SettlementGradeLine.objects.filter(
            settlement__pool=pool, unit_of_measure='LBS'
        ).aggregate(total=Coalesce(Sum('quantity'), Decimal('0')))['total']

        packed_lbs = PackoutGradeLine.objects.filter(
            packout_report__pool=pool, unit_of_measure='LBS'
        ).aggregate(total=Coalesce(Sum('quantity_this_period'), Decimal('0')))['total']

        if packed_lbs > 0 and settled_lbs >= packed_lbs:
            pool.status = 'settled'
            pool.save(update_fields=['status'])
            logger.info(f"Auto-updated pool {pool.id} ({pool.pool_id}) status to 'settled' "
                        f"({settled_lbs} lbs settled >= {packed_lbs} lbs packed)")
    else:
        settled_bins = SettlementGradeLine.objects.filter(
            settlement__pool=pool, unit_of_measure='BIN'
        ).aggregate(total=Coalesce(Sum('quantity'), Decimal('0')))['total']

        packed_bins = PackoutReport.objects.filter(
            pool=pool
        ).aggregate(total=Coalesce(Sum('bins_this_period'), Decimal('0')))['total']

        if packed_bins > 0 and settled_bins >= packed_bins:
            pool.status = 'settled'
            pool.save(update_fields=['status'])
            logger.info(f"Auto-updated pool {pool.id} ({pool.pool_id}) status to 'settled' "
                        f"({settled_bins} bins settled >= {packed_bins} bins packed)")
