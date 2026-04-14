"""
Sample Products for California Citrus Operations (unified Product model)

These load as system/global products (company=None) so they're visible to
every tenant — useful for fresh demo databases.

Run via:
    python manage.py shell < load_sample_products.py
or:
    exec(open('load_sample_products.py').read())
"""

import re

from api.models import Product

# ---------------------------------------------------------------------------
# Sample products commonly used in California citrus production.
#
# NOTE: The legacy `PesticideProduct.product_type` had values like
# 'insecticide' / 'miticide' / 'fungicide' / 'herbicide'. The unified
# `Product.product_type` collapses those into 'pesticide' (with a few extra
# values: fertilizer, adjuvant, growth_regulator, biological, other). The
# narrower category is captured in the active ingredients / notes.
#
# `category` below is just metadata for the seed script — it isn't a model
# field. It's mapped to product_type by `_resolve_product_type()` below.
# ---------------------------------------------------------------------------

SAMPLE_PRODUCTS = [
    # INSECTICIDES
    {
        'category': 'insecticide',
        'epa_registration_number': '432-1489',
        'product_name': 'Movento',
        'manufacturer': 'Bayer CropScience',
        'active_ingredients_text': 'Spirotetramat 22.4%',
        'formulation_code': 'SC',
        'restricted_use': False,
        'signal_word': 'CAUTION',
        'rei_hours': 24,
        'phi_days': 1,
        'notes': 'Target pests: Asian citrus psyllid, aphids, whiteflies, soft scales',
    },
    {
        'category': 'insecticide',
        'epa_registration_number': '100-1498',
        'product_name': 'Admire Pro',
        'manufacturer': 'Bayer CropScience',
        'active_ingredients_text': 'Imidacloprid 42.8%',
        'formulation_code': 'SC',
        'restricted_use': False,
        'signal_word': 'CAUTION',
        'rei_hours': 12,
        'phi_days': 0,
        'notes': 'Target pests: Asian citrus psyllid, aphids, leafminers',
    },
    {
        'category': 'insecticide',
        'epa_registration_number': '352-652',
        'product_name': 'Malathion 8 Flowable',
        'manufacturer': 'Drexel Chemical',
        'active_ingredients_text': 'Malathion 83.7%',
        'formulation_code': 'EC',
        'restricted_use': False,
        'signal_word': 'WARNING',
        'rei_hours': 12,
        'phi_days': 7,
        'notes': 'Target pests: Citrus thrips, mealybugs, scales',
    },
    {
        'category': 'insecticide',
        'epa_registration_number': '62719-566',
        'product_name': 'Delegate WG',
        'manufacturer': 'Dow AgroSciences',
        'active_ingredients_text': 'Spinetoram 25%',
        'formulation_code': 'WG',
        'restricted_use': False,
        'signal_word': 'CAUTION',
        'rei_hours': 4,
        'phi_days': 1,
        'notes': 'Target pests: Citrus thrips, leafminers, caterpillars',
    },
    {
        'category': 'insecticide',
        'epa_registration_number': '10163-324',
        'product_name': 'Sevin XLR Plus',
        'manufacturer': 'Bayer CropScience',
        'active_ingredients_text': 'Carbaryl 44.1%',
        'formulation_code': 'XLR',
        'restricted_use': False,
        'signal_word': 'CAUTION',
        'rei_hours': 12,
        'phi_days': 5,
        'notes': 'Target pests: Citrus thrips, katydids, orangeworms',
    },

    # MITICIDES (mapped to product_type='pesticide')
    {
        'category': 'miticide',
        'epa_registration_number': '66222-223',
        'product_name': 'Agri-Mek SC',
        'manufacturer': 'Syngenta',
        'active_ingredients_text': 'Abamectin 8.4%',
        'formulation_code': 'SC',
        'restricted_use': True,
        'signal_word': 'WARNING',
        'rei_hours': 12,
        'phi_days': 7,
        'notes': 'Target pests: Citrus red mite, citrus rust mite, leafminers. RESTRICTED USE.',
    },
    {
        'category': 'miticide',
        'epa_registration_number': '707-303',
        'product_name': 'Envidor 2 SC',
        'manufacturer': 'Bayer CropScience',
        'active_ingredients_text': 'Spirodiclofen 21.7%',
        'formulation_code': 'SC',
        'restricted_use': False,
        'signal_word': 'CAUTION',
        'rei_hours': 12,
        'phi_days': 7,
        'notes': 'Target pests: Citrus red mite, citrus rust mite',
    },

    # FUNGICIDES (mapped to product_type='pesticide')
    {
        'category': 'fungicide',
        'epa_registration_number': '62719-449',
        'product_name': 'Pristine',
        'manufacturer': 'BASF',
        'active_ingredients_text': 'Pyraclostrobin 12.8%, Boscalid 25.2%',
        'formulation_code': 'WG',
        'restricted_use': False,
        'signal_word': 'CAUTION',
        'rei_hours': 24,
        'phi_days': 0,
        'notes': 'Target pests: Alternaria brown spot, Septoria spot',
    },
    {
        'category': 'fungicide',
        'epa_registration_number': '100-1231',
        'product_name': 'Luna Sensation',
        'manufacturer': 'Bayer CropScience',
        'active_ingredients_text': 'Fluopyram 21.4%, Trifloxystrobin 21.4%',
        'formulation_code': 'SC',
        'restricted_use': False,
        'signal_word': 'WARNING',
        'rei_hours': 12,
        'phi_days': 1,
        'notes': 'Target pests: Brown rot, Phytophthora',
    },
    {
        'category': 'fungicide',
        'epa_registration_number': '55146-118',
        'product_name': 'Aliette WDG',
        'manufacturer': 'Bayer CropScience',
        'active_ingredients_text': 'Fosetyl-Al 80%',
        'formulation_code': 'WDG',
        'restricted_use': False,
        'signal_word': 'CAUTION',
        'rei_hours': 12,
        'phi_days': 0,
        'notes': 'Target pests: Phytophthora root rot, brown rot',
    },
    {
        'category': 'fungicide',
        'epa_registration_number': '7969-187',
        'product_name': 'Ridomil Gold SL',
        'manufacturer': 'Syngenta',
        'active_ingredients_text': 'Mefenoxam 45.3%',
        'formulation_code': 'SL',
        'restricted_use': False,
        'signal_word': 'CAUTION',
        'rei_hours': 48,
        'phi_days': 0,
        'notes': 'Target pests: Phytophthora root rot',
    },

    # HERBICIDES (mapped to product_type='pesticide')
    {
        'category': 'herbicide',
        'epa_registration_number': '524-445',
        'product_name': 'Roundup PowerMax',
        'manufacturer': 'Monsanto',
        'active_ingredients_text': 'Glyphosate 48.7%',
        'formulation_code': 'SL',
        'restricted_use': False,
        'signal_word': 'CAUTION',
        'rei_hours': 4,
        'phi_days': 14,
        'notes': 'Target pests: Annual and perennial weeds',
    },
    {
        'category': 'herbicide',
        'epa_registration_number': '62719-324',
        'product_name': 'Rely 280',
        'manufacturer': 'BASF',
        'active_ingredients_text': 'Glufosinate-ammonium 24.5%',
        'formulation_code': 'SL',
        'restricted_use': False,
        'signal_word': 'WARNING',
        'rei_hours': 12,
        'phi_days': 14,
        'notes': 'Target pests: Annual and perennial weeds',
    },
    {
        'category': 'herbicide',
        'epa_registration_number': '228-597',
        'product_name': 'Gramoxone SL 2.0',
        'manufacturer': 'Syngenta',
        'active_ingredients_text': 'Paraquat 30.1%',
        'formulation_code': 'SL',
        'restricted_use': True,
        'signal_word': 'DANGER',
        'rei_hours': 24,
        'phi_days': 30,
        'notes': 'Target pests: Annual weeds, weed burndown. RESTRICTED USE.',
    },
    {
        'category': 'herbicide',
        'epa_registration_number': '10163-273',
        'product_name': 'Princep 4L',
        'manufacturer': 'Syngenta',
        'active_ingredients_text': 'Simazine 41.9%',
        'formulation_code': 'L',
        'restricted_use': False,
        'signal_word': 'CAUTION',
        'rei_hours': 12,
        'phi_days': 0,
        'notes': 'Target pests: Annual grasses, broadleaf weeds',
    },

    # OILS / ADJUVANTS
    {
        'category': 'adjuvant',
        'epa_registration_number': '5905-347',
        'product_name': '415 Oil',
        'manufacturer': 'Helena Chemical',
        'active_ingredients_text': 'Petroleum Oil 98%',
        'formulation_code': 'EC',
        'restricted_use': False,
        'signal_word': 'CAUTION',
        'rei_hours': 4,
        'phi_days': 0,
        'notes': 'Target pests: Scales, mites (suffocating oil)',
    },
    {
        'category': 'adjuvant',
        'epa_registration_number': '49585-27',
        'product_name': 'Omni Supreme Spray',
        'manufacturer': 'Helena Chemical',
        'active_ingredients_text': 'Mineral Oil 98%',
        'formulation_code': 'EC',
        'restricted_use': False,
        'signal_word': 'CAUTION',
        'rei_hours': 4,
        'phi_days': 0,
        'notes': 'Target pests: Scales, mites, suppression adjuvant',
    },
]


# Map the legacy narrow category to the unified Product.product_type.
_TYPE_MAP = {
    'insecticide': 'pesticide',
    'miticide': 'pesticide',
    'fungicide': 'pesticide',
    'herbicide': 'pesticide',
    'adjuvant': 'adjuvant',
    'fertilizer': 'fertilizer',
    'growth_regulator': 'growth_regulator',
    'biological': 'biological',
}


_AI_PATTERN = re.compile(r'^\s*(?P<name>.+?)\s+(?P<pct>\d+(?:\.\d+)?)\s*%\s*$')


def _parse_active_ingredients(text):
    """
    Convert "Spirotetramat 22.4%" or
    "Pyraclostrobin 12.8%, Boscalid 25.2%" into
    [{'name': 'Spirotetramat', 'percent': 22.4}, ...].
    """
    items = []
    for chunk in (text or '').split(','):
        m = _AI_PATTERN.match(chunk)
        if not m:
            chunk = chunk.strip()
            if chunk:
                items.append({'name': chunk, 'percent': None})
            continue
        items.append({
            'name': m.group('name').strip(),
            'percent': float(m.group('pct')),
        })
    return items


def _resolve_product_type(category):
    return _TYPE_MAP.get(category, 'other')


def load_products():
    """Load sample products into the unified Product table as system globals."""
    created = 0
    updated = 0

    for raw in SAMPLE_PRODUCTS:
        ai_list = _parse_active_ingredients(raw.get('active_ingredients_text', ''))
        primary_ai = ai_list[0] if ai_list else {}

        defaults = {
            'product_type': _resolve_product_type(raw.get('category')),
            'product_name': raw['product_name'],
            'manufacturer': raw.get('manufacturer', ''),
            'active_ingredients': ai_list,
            'active_ingredient': primary_ai.get('name', ''),
            'active_ingredient_percent': primary_ai.get('percent'),
            'restricted_use': raw.get('restricted_use', False),
            'signal_word': raw.get('signal_word', ''),
            'rei_hours': raw.get('rei_hours'),
            'phi_days': raw.get('phi_days'),
            'formulation_code': raw.get('formulation_code', ''),
            'notes': raw.get('notes', ''),
            'is_active': True,
        }

        # System/global product => company is NULL. Match on
        # (epa_registration_number, company=None) so re-running the script
        # is idempotent and doesn't collide with any tenant-owned product
        # that happens to share the EPA number.
        product, was_created = Product.objects.update_or_create(
            epa_registration_number=raw['epa_registration_number'],
            company__isnull=True,
            defaults={**defaults, 'company': None},
        )
        if was_created:
            created += 1
            print(f"  Created: {product.product_name}")
        else:
            updated += 1
            print(f"  Updated: {product.product_name}")

    print(f"\nDone! Created {created} new products, updated {updated} existing products.")
    print(f"Total system/global products in database: "
          f"{Product.objects.filter(company__isnull=True).count()}")


# Run the loader when executed via `manage.py shell < ...`.
print("Loading sample products for California citrus (unified Product model)...")
load_products()
