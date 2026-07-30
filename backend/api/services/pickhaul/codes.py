"""House / entity code resolution between the local pipeline and the platform.

The local pipeline speaks in short codes (house 'SLA', entity 'FF'). The
platform speaks in Packinghouse and LegalEntity rows. The only code that
differs is FF: the local pipeline calls Finch Farms LLC 'FF', the platform's
LegalEntity seed calls it 'FFLLC'.
"""

from api.models import LegalEntity, Packinghouse

# local pipeline entity code -> platform LegalEntity.short_code
ENTITY_CODE_MAP = {
    'JPF': 'JPF',
    'FF': 'FFLLC',
    'TCC': 'TCC',
    'RMLF': 'RMLF',
}

# House code -> display name, used when the seed has to create a Packinghouse.
HOUSE_NAMES = {
    'SLA': 'Saticoy Lemon Association',
    'VPOA': 'Villa Park Orchards Association',
    'FPCA': 'Fillmore-Piru Citrus Association',
    'LIM': 'Limoneira',
    'MIS': 'Mission Produce',
    'SUNPAC': 'Piru Sun Pac',
}


class UnknownCode(Exception):
    """A bundle or seed row named a house/entity the platform does not have."""


def entity_code(local_code):
    """Map a local entity code to the platform short_code (identity if unmapped)."""
    return ENTITY_CODE_MAP.get(local_code, local_code)


def build_resolvers(company):
    """Return (houses, entities): local code -> model instance for this company.

    Lookup maps are built once per bundle; unknown codes raise UnknownCode at
    use time with a message naming the code, so a typo'd bundle is rejected
    loudly instead of half-applied.
    """
    houses = {
        (ph.short_code or '').upper(): ph
        for ph in Packinghouse.objects.filter(company=company)
        if ph.short_code
    }
    entities = {
        ent.short_code.upper(): ent
        for ent in LegalEntity.objects.filter(company=company)
    }

    def resolve_house(code):
        ph = houses.get((code or '').upper())
        if not ph:
            raise UnknownCode(f'Unknown packinghouse code {code!r} for {company.name}.')
        return ph

    def resolve_entity(code):
        ent = entities.get(entity_code(code or '').upper())
        if not ent:
            raise UnknownCode(
                f'Unknown entity code {code!r} for {company.name} '
                f'(maps to {entity_code(code)!r}; run seed_finch_operation first).'
            )
        return ent

    return resolve_house, resolve_entity
