"""
Reconcile total_weight_lbs and total_bins on ALL PoolSettlement records
from their grade line sums.

Previously, total_weight_lbs could contain gross pounds (from the PDF header)
rather than net pounds (from the grade line breakdown). This migration
overwrites header totals with grade line sums for both LBS and BIN units,
recalculates net_per_lb / net_per_bin, and auto-updates pool status to
'settled' where settlement progress >= 100%.
"""
from django.db import migrations
from decimal import Decimal


def reconcile_from_grade_lines(apps, schema_editor):
    PoolSettlement = apps.get_model('api', 'PoolSettlement')
    SettlementGradeLine = apps.get_model('api', 'SettlementGradeLine')
    PackoutGradeLine = apps.get_model('api', 'PackoutGradeLine')
    PackoutReport = apps.get_model('api', 'PackoutReport')
    Pool = apps.get_model('api', 'Pool')

    updated = 0
    for settlement in PoolSettlement.objects.all():
        update_fields = []

        # Sum LBS grade lines
        lbs_lines = SettlementGradeLine.objects.filter(
            settlement=settlement, unit_of_measure='LBS'
        )
        if lbs_lines.exists():
            total_lbs = sum(
                gl.quantity for gl in lbs_lines if gl.quantity
            ) or Decimal('0')
            if total_lbs > 0 and settlement.total_weight_lbs != total_lbs:
                settlement.total_weight_lbs = total_lbs
                update_fields.append('total_weight_lbs')
                if settlement.net_return and settlement.net_return > 0:
                    settlement.net_per_lb = round(settlement.net_return / total_lbs, 4)
                    update_fields.append('net_per_lb')

        # Sum BIN grade lines
        bin_lines = SettlementGradeLine.objects.filter(
            settlement=settlement, unit_of_measure='BIN'
        )
        if bin_lines.exists():
            total_bins = sum(
                gl.quantity for gl in bin_lines if gl.quantity
            ) or Decimal('0')
            if total_bins > 0 and settlement.total_bins != total_bins:
                settlement.total_bins = total_bins
                update_fields.append('total_bins')
                if settlement.net_return and settlement.net_return > 0:
                    settlement.net_per_bin = round(settlement.net_return / total_bins, 4)
                    update_fields.append('net_per_bin')

        if update_fields:
            settlement.save(update_fields=update_fields)
            updated += 1

    if updated:
        print(f"  Reconciled totals on {updated} settlement(s) from grade lines")

    # Auto-update pool statuses
    pools_updated = 0
    for pool in Pool.objects.filter(status__in=['active', 'closed']):
        settlements = PoolSettlement.objects.filter(pool=pool)
        if not settlements.exists():
            continue

        # Check LBS-based (avocados etc.)
        settled_lbs = sum(
            gl.quantity for gl in SettlementGradeLine.objects.filter(
                settlement__pool=pool, unit_of_measure='LBS'
            ) if gl.quantity
        ) or Decimal('0')
        packed_lbs = sum(
            gl.quantity_this_period for gl in PackoutGradeLine.objects.filter(
                packout_report__pool=pool, unit_of_measure='LBS'
            ) if gl.quantity_this_period
        ) or Decimal('0')

        if packed_lbs > 0 and settled_lbs >= packed_lbs:
            pool.status = 'settled'
            pool.save(update_fields=['status'])
            pools_updated += 1
            continue

        # Check BIN-based (citrus etc.)
        settled_bins = sum(
            gl.quantity for gl in SettlementGradeLine.objects.filter(
                settlement__pool=pool, unit_of_measure='BIN'
            ) if gl.quantity
        ) or Decimal('0')
        packed_bins = sum(
            pr.bins_this_period for pr in PackoutReport.objects.filter(
                pool=pool
            ) if pr.bins_this_period
        ) or Decimal('0')

        if packed_bins > 0 and settled_bins >= packed_bins:
            pool.status = 'settled'
            pool.save(update_fields=['status'])
            pools_updated += 1

    if pools_updated:
        print(f"  Auto-updated {pools_updated} pool(s) to 'settled' status")


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0052_backfill_settlement_weight_lbs'),
    ]

    operations = [
        migrations.RunPython(reconcile_from_grade_lines, reverse_noop),
    ]
