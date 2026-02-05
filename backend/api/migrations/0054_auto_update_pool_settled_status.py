"""
Auto-update pool status to 'settled' for pools where settlement progress >= 100%.
Compares settled quantity (from grade line sums) to packed quantity (from packout
grade lines / packout reports).
"""
from django.db import migrations
from decimal import Decimal


def update_pool_statuses(apps, schema_editor):
    PoolSettlement = apps.get_model('api', 'PoolSettlement')
    SettlementGradeLine = apps.get_model('api', 'SettlementGradeLine')
    PackoutGradeLine = apps.get_model('api', 'PackoutGradeLine')
    PackoutReport = apps.get_model('api', 'PackoutReport')
    Pool = apps.get_model('api', 'Pool')

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
    else:
        print("  No pools needed status update")


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0053_reconcile_settlement_totals_from_grade_lines'),
    ]

    operations = [
        migrations.RunPython(update_pool_statuses, reverse_noop),
    ]
