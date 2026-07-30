"""Tolerances and bands, mirroring the local pipeline's config.toml.

Kept as module constants for now; if these ever need to vary per company they
become a settings model, but the local pipeline has run a full season on these
exact values.
"""

from decimal import Decimal

# [reconcile] in config.toml
AMOUNT_TOLERANCE = Decimal('0.01')
AGING_DAYS = 45

# reconcile.py module constants
BILL_SLACK_DAYS = 3          # a charge may post slightly before the last pick
LAG_OUTLIER_DAYS = 14        # 'Date Rec from PH' vs charge date, worth flagging beyond this
MAX_SUBSET_ROWS = 14         # guard on the subset search
MAX_SUBSET_SIZE = 5

# [sanity] in config.toml: plausible $/bin bands
PER_BIN_BANDS = {
    'PICK': (Decimal('20'), Decimal('200')),
    'HAUL': (Decimal('2'), Decimal('40')),
}

# Mark's hauling rule, verbatim from the local gate 10: Magana's picks include
# hauling; every other contractor's picks need a separate haul invoice.
SELF_HAULING_CONTRACTOR = 'MAGANA'
