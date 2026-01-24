"""
Django Signals for FSMA Compliance Module

This module contains signal handlers for automatic integrations:
- Auto-create PHI compliance checks when harvests are created
- Auto-deduct fertilizer inventory when nutrient applications are recorded
- Auto-link visitor logs to harvests for harvester visitors
"""

import logging
from decimal import Decimal
from datetime import timedelta
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

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
        from api.models import PHIComplianceCheck
        from api.services.fsma.phi_compliance import FSMAPHIComplianceService

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


# =============================================================================
# NUTRIENT APPLICATION SIGNALS
# =============================================================================

@receiver(post_save, sender='api.NutrientApplication')
def deduct_inventory_on_application(sender, instance, created, **kwargs):
    """
    Auto-deduct fertilizer inventory when a NutrientApplication is recorded.

    This maintains accurate inventory levels by automatically creating
    inventory transactions when fertilizer is applied to fields.
    """
    if not created:
        return

    try:
        from api.models import FertilizerInventory, FertilizerInventoryTransaction

        # Get the company from the field
        company = instance.field.farm.company

        # Find matching inventory record
        try:
            inventory = FertilizerInventory.objects.get(
                company=company,
                product=instance.product
            )
        except FertilizerInventory.DoesNotExist:
            # No inventory tracking set up for this product
            logger.debug(
                f"No inventory record found for {instance.product.name} "
                f"in company {company.name}"
            )
            return

        # Calculate quantity to deduct
        # Use total_product_applied if available, otherwise calculate
        if instance.total_product_applied:
            quantity_used = Decimal(str(instance.total_product_applied))
        elif instance.rate and instance.acres_treated:
            quantity_used = Decimal(str(instance.rate)) * Decimal(str(instance.acres_treated))
        else:
            logger.warning(
                f"Cannot calculate quantity for NutrientApplication #{instance.id}"
            )
            return

        # Create deduction transaction
        new_balance = inventory.quantity_on_hand - quantity_used
        if new_balance < 0:
            logger.warning(
                f"Inventory deduction would result in negative balance for "
                f"{instance.product.name}. Current: {inventory.quantity_on_hand}, "
                f"Deduction: {quantity_used}"
            )
            new_balance = Decimal('0')

        FertilizerInventoryTransaction.objects.create(
            inventory=inventory,
            transaction_type='application',
            quantity=-quantity_used,  # Negative for deduction
            balance_after=new_balance,
            transaction_date=timezone.now(),
            nutrient_application=instance,
            notes=f"Auto-deducted for application on {instance.field.name} ({instance.application_date})",
            created_by=instance.created_by,
        )

        # Update inventory balance
        inventory.quantity_on_hand = new_balance
        inventory.save(update_fields=['quantity_on_hand'])

        logger.info(
            f"Deducted {quantity_used} from inventory for {instance.product.name} "
            f"(NutrientApplication #{instance.id})"
        )

    except Exception as e:
        logger.error(
            f"Error deducting inventory for NutrientApplication #{instance.id}: {e}"
        )


# =============================================================================
# VISITOR LOG SIGNALS
# =============================================================================

@receiver(post_save, sender='api.VisitorLog')
def auto_link_visitor_to_harvest(sender, instance, created, **kwargs):
    """
    Auto-link visitor logs to harvests when visitor type is 'harvester'.

    This helps maintain traceability by automatically connecting harvest
    crew visits to the corresponding harvest events.
    """
    if not created:
        return

    # Only auto-link harvester type visitors
    if instance.visitor_type != 'harvester':
        return

    # Don't override manual links
    if instance.linked_harvest is not None:
        return

    try:
        from api.models import Harvest

        # Find harvests on the same farm and date
        same_day_harvests = Harvest.objects.filter(
            field__farm=instance.farm,
            harvest_date=instance.visit_date
        )

        if same_day_harvests.count() == 1:
            # Exact match - link automatically
            instance.linked_harvest = same_day_harvests.first()
            instance.auto_linked = True
            instance.save(update_fields=['linked_harvest', 'auto_linked'])

            logger.info(
                f"Auto-linked VisitorLog #{instance.id} ({instance.visitor_name}) "
                f"to Harvest #{instance.linked_harvest.id}"
            )

        elif same_day_harvests.count() > 1:
            # Multiple harvests - check if visitor specified fields
            if instance.fields_visited.exists():
                # Try to match based on fields visited
                matching_harvests = same_day_harvests.filter(
                    field__in=instance.fields_visited.all()
                )
                if matching_harvests.count() == 1:
                    instance.linked_harvest = matching_harvests.first()
                    instance.auto_linked = True
                    instance.save(update_fields=['linked_harvest', 'auto_linked'])

                    logger.info(
                        f"Auto-linked VisitorLog #{instance.id} to Harvest "
                        f"#{instance.linked_harvest.id} based on field match"
                    )
                else:
                    logger.debug(
                        f"Multiple harvests found for VisitorLog #{instance.id}, "
                        f"manual linking required"
                    )

    except Exception as e:
        logger.error(f"Error auto-linking visitor to harvest: {e}")


# =============================================================================
# SAFETY MEETING SIGNALS
# =============================================================================

@receiver(pre_save, sender='api.SafetyMeeting')
def set_meeting_quarter_year(sender, instance, **kwargs):
    """
    Auto-set quarter and year fields on SafetyMeeting before save.

    This ensures quarterly meetings are properly categorized for
    compliance tracking.
    """
    if instance.meeting_date:
        if not instance.quarter:
            instance.quarter = (instance.meeting_date.month - 1) // 3 + 1
        if not instance.year:
            instance.year = instance.meeting_date.year


# =============================================================================
# USER SIGNATURE SIGNALS
# =============================================================================

@receiver(pre_save, sender='api.UserSignature')
def hash_signature_data(sender, instance, **kwargs):
    """
    Auto-generate signature hash before saving.

    This provides a verification mechanism for signature integrity.
    """
    import hashlib

    if instance.signature_data and not instance.signature_hash:
        instance.signature_hash = hashlib.sha256(
            instance.signature_data.encode()
        ).hexdigest()


# =============================================================================
# CLEANING LOG SIGNALS
# =============================================================================

@receiver(pre_save, sender='api.FacilityCleaningLog')
def set_signature_timestamp(sender, instance, **kwargs):
    """
    Auto-set signature timestamp when signature data is provided.
    """
    if instance.signature_data and not instance.signature_timestamp:
        instance.signature_timestamp = timezone.now()
