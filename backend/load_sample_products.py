"""
Sample Pesticide Products for California Citrus Operations
Run this in Django shell: exec(open('load_sample_products.py').read())
Or: python manage.py shell < load_sample_products.py
"""

from api.models import PesticideProduct

# Sample products commonly used in California citrus production
SAMPLE_PRODUCTS = [
    # INSECTICIDES
    {
        'epa_registration_number': '432-1489',
        'product_name': 'Movento',
        'manufacturer': 'Bayer CropScience',
        'active_ingredients': 'Spirotetramat 22.4%',
        'formulation_type': 'SC',
        'product_type': 'insecticide',
        'restricted_use': False,
        'signal_word': 'caution',
        'rei_hours': 24,
        'phi_days': 1,
        'notes': 'Target pests: Asian citrus psyllid, aphids, whiteflies, soft scales',
    },
    {
        'epa_registration_number': '100-1498',
        'product_name': 'Admire Pro',
        'manufacturer': 'Bayer CropScience',
        'active_ingredients': 'Imidacloprid 42.8%',
        'formulation_type': 'SC',
        'product_type': 'insecticide',
        'restricted_use': False,
        'signal_word': 'caution',
        'rei_hours': 12,
        'phi_days': 0,
        'notes': 'Target pests: Asian citrus psyllid, aphids, leafminers',
    },
    {
        'epa_registration_number': '352-652',
        'product_name': 'Malathion 8 Flowable',
        'manufacturer': 'Drexel Chemical',
        'active_ingredients': 'Malathion 83.7%',
        'formulation_type': 'EC',
        'product_type': 'insecticide',
        'restricted_use': False,
        'signal_word': 'warning',
        'rei_hours': 12,
        'phi_days': 7,
        'notes': 'Target pests: Citrus thrips, mealybugs, scales',
    },
    {
        'epa_registration_number': '62719-566',
        'product_name': 'Delegate WG',
        'manufacturer': 'Dow AgroSciences',
        'active_ingredients': 'Spinetoram 25%',
        'formulation_type': 'WG',
        'product_type': 'insecticide',
        'restricted_use': False,
        'signal_word': 'caution',
        'rei_hours': 4,
        'phi_days': 1,
        'notes': 'Target pests: Citrus thrips, leafminers, caterpillars',
    },
    {
        'epa_registration_number': '10163-324',
        'product_name': 'Sevin XLR Plus',
        'manufacturer': 'Bayer CropScience',
        'active_ingredients': 'Carbaryl 44.1%',
        'formulation_type': 'XLR',
        'product_type': 'insecticide',
        'restricted_use': False,
        'signal_word': 'caution',
        'rei_hours': 12,
        'phi_days': 5,
        'notes': 'Target pests: Citrus thrips, katydids, orangeworms',
    },
    
    # MITICIDES
    {
        'epa_registration_number': '66222-223',
        'product_name': 'Agri-Mek SC',
        'manufacturer': 'Syngenta',
        'active_ingredients': 'Abamectin 8.4%',
        'formulation_type': 'SC',
        'product_type': 'insecticide',
        'restricted_use': True,
        'signal_word': 'warning',
        'rei_hours': 12,
        'phi_days': 7,
        'notes': 'Target pests: Citrus red mite, citrus rust mite, leafminers. RESTRICTED USE.',
    },
    {
        'epa_registration_number': '707-303',
        'product_name': 'Envidor 2 SC',
        'manufacturer': 'Bayer CropScience',
        'active_ingredients': 'Spirodiclofen 21.7%',
        'formulation_type': 'SC',
        'product_type': 'insecticide',
        'restricted_use': False,
        'signal_word': 'caution',
        'rei_hours': 12,
        'phi_days': 7,
        'notes': 'Target pests: Citrus red mite, citrus rust mite',
    },
    
    # FUNGICIDES
    {
        'epa_registration_number': '62719-449',
        'product_name': 'Pristine',
        'manufacturer': 'BASF',
        'active_ingredients': 'Pyraclostrobin 12.8%, Boscalid 25.2%',
        'formulation_type': 'WG',
        'product_type': 'fungicide',
        'restricted_use': False,
        'signal_word': 'caution',
        'rei_hours': 24,
        'phi_days': 0,
        'notes': 'Target pests: Alternaria brown spot, Septoria spot',
    },
    {
        'epa_registration_number': '100-1231',
        'product_name': 'Luna Sensation',
        'manufacturer': 'Bayer CropScience',
        'active_ingredients': 'Fluopyram 21.4%, Trifloxystrobin 21.4%',
        'formulation_type': 'SC',
        'product_type': 'fungicide',
        'restricted_use': False,
        'signal_word': 'warning',
        'rei_hours': 12,
        'phi_days': 1,
        'notes': 'Target pests: Brown rot, Phytophthora',
    },
    {
        'epa_registration_number': '55146-118',
        'product_name': 'Aliette WDG',
        'manufacturer': 'Bayer CropScience',
        'active_ingredients': 'Fosetyl-Al 80%',
        'formulation_type': 'WDG',
        'product_type': 'fungicide',
        'restricted_use': False,
        'signal_word': 'caution',
        'rei_hours': 12,
        'phi_days': 0,
        'notes': 'Target pests: Phytophthora root rot, brown rot',
    },
    {
        'epa_registration_number': '7969-187',
        'product_name': 'Ridomil Gold SL',
        'manufacturer': 'Syngenta',
        'active_ingredients': 'Mefenoxam 45.3%',
        'formulation_type': 'SL',
        'product_type': 'fungicide',
        'restricted_use': False,
        'signal_word': 'caution',
        'rei_hours': 48,
        'phi_days': 0,
        'notes': 'Target pests: Phytophthora root rot',
    },
    
    # HERBICIDES
    {
        'epa_registration_number': '524-445',
        'product_name': 'Roundup PowerMax',
        'manufacturer': 'Monsanto',
        'active_ingredients': 'Glyphosate 48.7%',
        'formulation_type': 'SL',
        'product_type': 'herbicide',
        'restricted_use': False,
        'signal_word': 'caution',
        'rei_hours': 4,
        'phi_days': 14,
        'notes': 'Target pests: Annual and perennial weeds',
    },
    {
        'epa_registration_number': '62719-324',
        'product_name': 'Rely 280',
        'manufacturer': 'BASF',
        'active_ingredients': 'Glufosinate-ammonium 24.5%',
        'formulation_type': 'SL',
        'product_type': 'herbicide',
        'restricted_use': False,
        'signal_word': 'warning',
        'rei_hours': 12,
        'phi_days': 14,
        'notes': 'Target pests: Annual and perennial weeds',
    },
    {
        'epa_registration_number': '228-597',
        'product_name': 'Gramoxone SL 2.0',
        'manufacturer': 'Syngenta',
        'active_ingredients': 'Paraquat 30.1%',
        'formulation_type': 'SL',
        'product_type': 'herbicide',
        'restricted_use': True,
        'signal_word': 'danger',
        'rei_hours': 24,
        'phi_days': 30,
        'notes': 'Target pests: Annual weeds, weed burndown. RESTRICTED USE.',
    },
    {
        'epa_registration_number': '10163-273',
        'product_name': 'Princep 4L',
        'manufacturer': 'Syngenta',
        'active_ingredients': 'Simazine 41.9%',
        'formulation_type': 'L',
        'product_type': 'herbicide',
        'restricted_use': False,
        'signal_word': 'caution',
        'rei_hours': 12,
        'phi_days': 0,
        'notes': 'Target pests: Annual grasses, broadleaf weeds',
    },
    
    # OILS/ADJUVANTS
    {
        'epa_registration_number': '5905-347',
        'product_name': '415 Oil',
        'manufacturer': 'Helena Chemical',
        'active_ingredients': 'Petroleum Oil 98%',
        'formulation_type': 'EC',
        'product_type': 'adjuvant',
        'restricted_use': False,
        'signal_word': 'caution',
        'rei_hours': 4,
        'phi_days': 0,
        'notes': 'Target pests: Scales, mites (suffocating oil)',
    },
    {
        'epa_registration_number': '49585-27',
        'product_name': 'Omni Supreme Spray',
        'manufacturer': 'Helena Chemical',
        'active_ingredients': 'Mineral Oil 98%',
        'formulation_type': 'EC',
        'product_type': 'adjuvant',
        'restricted_use': False,
        'signal_word': 'caution',
        'rei_hours': 4,
        'phi_days': 0,
        'notes': 'Target pests: Scales, mites, suppression adjuvant',
    },
]

def load_products():
    """Load sample pesticide products into the database."""
    created = 0
    updated = 0
    
    for product_data in SAMPLE_PRODUCTS:
        product, was_created = PesticideProduct.objects.update_or_create(
            epa_registration_number=product_data['epa_registration_number'],
            defaults=product_data
        )
        if was_created:
            created += 1
            print(f"  Created: {product.product_name}")
        else:
            updated += 1
            print(f"  Updated: {product.product_name}")
    
    print(f"\nDone! Created {created} new products, updated {updated} existing products.")
    print(f"Total products in database: {PesticideProduct.objects.count()}")

# Run the loader
print("Loading sample pesticide products for California citrus...")
load_products()
