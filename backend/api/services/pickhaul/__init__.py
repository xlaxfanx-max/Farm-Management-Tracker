"""Pick & haul services: bundle sync, reconciliation, receipt linking, gates.

Public entry points:

    apply_bundle(company, payload, token)   -> dict   (sync.py)
    run_reconciliation(company, season)     -> dict   (reconcile.py)
    relink_invoice(invoice)                 -> int    (linking.py)
    run_platform_gates(company, season, batch=None) -> dict (checks.py)
    run_post_change(company, season)        -> dict   (orchestration below)

The matcher and gate logic are ports of the local pipeline's reconcile.py and
checks.py (Pick & Haul Automation). Structure is kept deliberately parallel so
the two can be diffed; behavioural deviations are marked with `# DEVIATION`.
"""

from .sync import apply_bundle, BundleRejected
from .linking import relink_invoice, relink_season
from .reconcile import run_reconciliation
from .checks import run_platform_gates


def run_post_change(company, season):
    """Everything that must re-run after an invoice create/update/delete.

    Scope-wide on purpose: charge allocation (`used`) is global per account,
    so one edited invoice can change another invoice's match. Cheap at this
    scale (~160 charges, ~120 invoices per season).
    """
    relink_season(company, season)
    recon = run_reconciliation(company, season)
    gates = run_platform_gates(company, season)
    return {'reconciliation': recon, 'platform_gates': gates}
