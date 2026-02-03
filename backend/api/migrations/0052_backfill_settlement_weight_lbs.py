"""
Backfill total_weight_lbs on PoolSettlement records from grade lines.

For settlements where total_weight_lbs is NULL but grade lines exist with
LBS unit_of_measure, sum the grade line quantities to populate total_weight_lbs.
Also calculates net_per_lb where missing.
"""
from django.db import migrations


def backfill_weight_from_grade_lines(apps, schema_editor):
    PoolSettlement = apps.get_model('api', 'PoolSettlement')
    SettlementGradeLine = apps.get_model('api', 'SettlementGradeLine')
    from decimal import Decimal

    # Find settlements with NULL total_weight_lbs that have grade lines
    settlements_missing_weight = PoolSettlement.objects.filter(
        total_weight_lbs__isnull=True
    )

    updated = 0
    for settlement in settlements_missing_weight:
        # Sum LBS grade lines
        lbs_lines = SettlementGradeLine.objects.filter(
            settlement=settlement,
            unit_of_measure='LBS'
        )
        if lbs_lines.exists():
            total_lbs = sum(
                gl.quantity for gl in lbs_lines if gl.quantity
            )
            if total_lbs and total_lbs > 0:
                settlement.total_weight_lbs = total_lbs
                # Calculate net_per_lb if missing
                if not settlement.net_per_lb and settlement.net_return and settlement.net_return > 0:
                    settlement.net_per_lb = round(settlement.net_return / total_lbs, 4)
                settlement.save(update_fields=['total_weight_lbs', 'net_per_lb'])
                updated += 1

    if updated:
        print(f"  Backfilled total_weight_lbs on {updated} settlement(s)")


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0051_commodity_unit_awareness'),
    ]

    operations = [
        migrations.RunPython(backfill_weight_from_grade_lines, reverse_noop),
    ]
