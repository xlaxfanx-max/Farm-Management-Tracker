"""
Data migration to normalize existing Pool.commodity values.

Maps variant commodity strings to canonical names:
- HASS, CA AVOCADO, etc. → AVOCADOS
- LEMON → LEMONS
- NAVEL, NAVEL ORANGES → NAVELS
- etc.

Unrecognized values (e.g., ranch names mistakenly stored as commodities)
are printed as warnings but left unchanged for manual review.
"""

from django.db import migrations


# Self-contained alias map (mirrors season_service.COMMODITY_ALIASES)
COMMODITY_ALIASES = {
    'AVOCADOS': [
        'AVOCADO', 'CA AVOCADO', 'CA AVOCADOS', 'CALIFORNIA AVOCADO',
        'HASS', 'HASS AVOCADO', 'HASS AVOCADOS', 'FUERTE', 'FUERTE AVOCADO',
        'LAMB HASS', 'GEM', 'REED', 'ZUTANO', 'BACON',
    ],
    'LEMONS': ['LEMON'],
    'NAVELS': ['NAVEL', 'NAVEL ORANGE', 'NAVEL ORANGES'],
    'VALENCIAS': ['VALENCIA', 'VALENCIA ORANGE', 'VALENCIA ORANGES'],
    'TANGERINES': [
        'TANGERINE', 'MANDARIN', 'MANDARINS',
        'CLEMENTINE', 'CLEMENTINES', 'PIXIE', 'PIXIES',
        'TANGO', 'MURCOTT', 'W. MURCOTT',
    ],
    'GRAPEFRUIT': ['GRAPEFRUITS'],
    'LIMES': ['LIME'],
    'ORANGES': ['ORANGE'],
}


def normalize_pool_commodities(apps, schema_editor):
    Pool = apps.get_model('api', 'Pool')

    # Build reverse lookup
    lookup = {}
    for canonical, aliases in COMMODITY_ALIASES.items():
        lookup[canonical.upper()] = canonical
        for alias in aliases:
            lookup[alias.upper()] = canonical

    pools = Pool.objects.all()
    updated = 0
    unknown = []

    for pool in pools:
        original = pool.commodity
        cleaned = (original or '').strip().upper()

        if not cleaned:
            continue

        # Direct lookup
        if cleaned in lookup:
            canonical = lookup[cleaned]
            if pool.commodity != canonical:
                pool.commodity = canonical
                pool.save(update_fields=['commodity'])
                updated += 1
            continue

        # Substring match fallback
        matched = False
        for keyword, canonical in lookup.items():
            if keyword in cleaned:
                pool.commodity = canonical
                pool.save(update_fields=['commodity'])
                updated += 1
                matched = True
                break

        if not matched:
            unknown.append(f"Pool {pool.id} (packinghouse={pool.packinghouse_id}, season={pool.season}): '{original}'")

    if unknown:
        print(f"\n⚠️  WARNING: {len(unknown)} pools have unrecognized commodities:")
        for item in unknown:
            print(f"  - {item}")
        print("These were left unchanged. Please review and fix manually.\n")

    print(f"✅ Normalized {updated} pool commodity values.")


def reverse_noop(apps, schema_editor):
    """Cannot reverse normalization — original values are not preserved."""
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0045_settlement_deduction_unit_default'),
    ]

    operations = [
        migrations.RunPython(normalize_pool_commodities, reverse_noop),
    ]
