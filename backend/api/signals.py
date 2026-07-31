"""
Django Signals

- Auto-create PHI compliance checks when harvests are created
"""

import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


# =============================================================================
# HARVEST SIGNALS
# =============================================================================

@receiver(post_save, sender='api.Harvest')
def create_phi_compliance_check(sender, instance, created, **kwargs):
    """
    Auto-create PHIComplianceCheck when a Harvest is created.

    This ensures every harvest has an associated PHI compliance record
    that documents whether all pesticide applications have met their
    pre-harvest interval requirements.
    """
    if not created:
        return

    try:
        from api.services.compliance.phi_compliance import FSMAPHIComplianceService

        # Check if PHI compliance check already exists
        if hasattr(instance, 'phi_compliance_check'):
            return

        service = FSMAPHIComplianceService()
        service.create_phi_compliance_check(instance)

        logger.info(
            f"Created PHI compliance check for Harvest #{instance.id} "
            f"(field: {instance.field_id}, date: {instance.harvest_date})"
        )

    except Exception as e:
        logger.error(f"Error creating PHI compliance check for Harvest #{instance.id}: {e}")
