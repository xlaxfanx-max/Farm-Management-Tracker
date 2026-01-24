"""
Celery tasks for FSMA compliance automation.

These tasks run on schedules to:
- Check facility cleaning compliance
- Check quarterly safety meeting compliance
- Generate monthly inventory snapshots
- Generate audit binders asynchronously
- Send FSMA-specific reminders
"""

import logging
from datetime import date, timedelta
from celery import shared_task
from django.utils import timezone
from django.db.models import F

logger = logging.getLogger(__name__)


@shared_task
def check_cleaning_compliance():
    """
    Daily task to check facility cleaning compliance.

    Runs at 7 AM daily to:
    1. Check which facilities are overdue for cleaning
    2. Generate alerts for overdue cleanings
    3. Update compliance metrics

    Returns:
        Dictionary with processing statistics
    """
    from api.models import Company, FacilityLocation, ComplianceAlert
    from api.services.fsma.cleaning_scheduler import CleaningScheduler

    stats = {
        'companies_checked': 0,
        'facilities_checked': 0,
        'alerts_created': 0,
        'overdue_count': 0,
    }

    companies = Company.objects.all()

    for company in companies:
        stats['companies_checked'] += 1

        scheduler = CleaningScheduler(company)
        overdue = scheduler.get_overdue_facilities()

        for facility in overdue:
            stats['facilities_checked'] += 1
            stats['overdue_count'] += 1

            # Create alert if not already exists
            existing_alert = ComplianceAlert.objects.filter(
                company=company,
                alert_type='cleaning_overdue',
                related_object_type='FacilityLocation',
                related_object_id=facility['facility_id'],
                is_active=True,
            ).exists()

            if not existing_alert:
                priority = 'critical' if facility['days_overdue'] > 3 else 'high' if facility['days_overdue'] > 1 else 'medium'

                ComplianceAlert.objects.create(
                    company=company,
                    alert_type='cleaning_overdue',
                    priority=priority,
                    title=f"Cleaning Overdue: {facility['facility_name']}",
                    message=f"{facility['facility_name']} ({facility['facility_type_display']}) is "
                           f"{facility['days_overdue']} day(s) overdue for cleaning. "
                           f"Last cleaned: {facility['last_cleaning_date'] or 'Never'}",
                    related_object_type='FacilityLocation',
                    related_object_id=facility['facility_id'],
                    action_url='/fsma/cleaning-logs',
                    action_label='Log Cleaning',
                )
                stats['alerts_created'] += 1

    logger.info(f"FSMA cleaning compliance check complete: {stats}")
    return stats


@shared_task
def check_quarterly_meeting_compliance():
    """
    Monthly task to check quarterly safety meeting compliance.

    Runs on 1st of each month at 8 AM to:
    1. Check if quarterly FSMA meeting has been held
    2. Generate alerts if meeting is overdue
    3. Remind about upcoming quarterly meetings

    Returns:
        Dictionary with processing statistics
    """
    from api.models import Company, SafetyMeeting, ComplianceAlert

    today = date.today()
    current_quarter = (today.month - 1) // 3 + 1
    current_year = today.year

    # Calculate days into the quarter
    quarter_start_month = (current_quarter - 1) * 3 + 1
    quarter_start = date(current_year, quarter_start_month, 1)
    days_into_quarter = (today - quarter_start).days

    stats = {
        'companies_checked': 0,
        'meetings_found': 0,
        'alerts_created': 0,
    }

    companies = Company.objects.all()

    for company in companies:
        stats['companies_checked'] += 1

        # Check if quarterly FSMA meeting exists for current quarter
        meeting_exists = SafetyMeeting.objects.filter(
            company=company,
            meeting_type='quarterly_fsma',
            year=current_year,
            quarter=current_quarter,
        ).exists()

        if meeting_exists:
            stats['meetings_found'] += 1
            continue

        # Create alert if we're past 30 days into the quarter and no meeting
        if days_into_quarter > 30:
            existing_alert = ComplianceAlert.objects.filter(
                company=company,
                alert_type='fsma_quarterly_meeting',
                is_active=True,
                created_at__month=today.month,
            ).exists()

            if not existing_alert:
                ComplianceAlert.objects.create(
                    company=company,
                    alert_type='fsma_quarterly_meeting',
                    priority='high',
                    title=f"Quarterly FSMA Meeting Required - Q{current_quarter}",
                    message=f"The quarterly FSMA safety meeting for Q{current_quarter} {current_year} "
                           f"has not been recorded. This meeting is required for compliance.",
                    action_url='/fsma/safety-meetings',
                    action_label='Schedule Meeting',
                )
                stats['alerts_created'] += 1

        # If near quarter end (last 15 days), send urgent alert
        quarter_end_month = quarter_start_month + 2
        if quarter_end_month > 12:
            quarter_end = date(current_year + 1, 1, 1) - timedelta(days=1)
        else:
            quarter_end = date(current_year, quarter_end_month + 1, 1) - timedelta(days=1)

        days_until_quarter_end = (quarter_end - today).days

        if days_until_quarter_end <= 15 and not meeting_exists:
            existing_urgent = ComplianceAlert.objects.filter(
                company=company,
                alert_type='fsma_quarterly_meeting_urgent',
                is_active=True,
            ).exists()

            if not existing_urgent:
                ComplianceAlert.objects.create(
                    company=company,
                    alert_type='fsma_quarterly_meeting_urgent',
                    priority='critical',
                    title=f"URGENT: Q{current_quarter} FSMA Meeting Due Soon",
                    message=f"Only {days_until_quarter_end} days remaining to hold the Q{current_quarter} "
                           f"quarterly FSMA safety meeting. Schedule immediately to maintain compliance.",
                    action_url='/fsma/safety-meetings',
                    action_label='Schedule Now',
                )
                stats['alerts_created'] += 1

    logger.info(f"FSMA quarterly meeting compliance check complete: {stats}")
    return stats


@shared_task
def generate_monthly_inventory_snapshot():
    """
    Monthly task to generate inventory snapshots.

    Runs on 1st of each month at 1 AM to:
    1. Capture current inventory levels for all companies
    2. Store snapshot for historical reporting

    Returns:
        Dictionary with generation statistics
    """
    from api.models import Company, FertilizerInventory, MonthlyInventorySnapshot
    from decimal import Decimal

    today = date.today()
    # Snapshot is for previous month
    if today.month == 1:
        snapshot_month = 12
        snapshot_year = today.year - 1
    else:
        snapshot_month = today.month - 1
        snapshot_year = today.year

    stats = {
        'companies_processed': 0,
        'snapshots_created': 0,
        'snapshots_updated': 0,
    }

    companies = Company.objects.all()

    for company in companies:
        stats['companies_processed'] += 1

        inventories = FertilizerInventory.objects.filter(
            company=company
        ).select_related('product')

        if not inventories.exists():
            continue

        # Build snapshot data
        inventory_data = []
        total_value = Decimal('0')
        low_stock_count = 0

        for inv in inventories:
            # Try to get latest cost for value calculation
            from api.models import FertilizerInventoryTransaction
            last_purchase = FertilizerInventoryTransaction.objects.filter(
                inventory=inv,
                transaction_type='purchase',
                cost_per_unit__isnull=False
            ).order_by('-transaction_date').first()

            item_value = None
            if last_purchase and last_purchase.cost_per_unit:
                item_value = last_purchase.cost_per_unit * inv.quantity_on_hand
                total_value += item_value

            inventory_data.append({
                'product_id': inv.product_id,
                'product_name': inv.product.name,
                'quantity_on_hand': float(inv.quantity_on_hand),
                'unit': inv.unit,
                'reorder_point': float(inv.reorder_point) if inv.reorder_point else None,
                'is_low_stock': inv.is_low_stock,
                'estimated_value': float(item_value) if item_value else None,
            })

            if inv.is_low_stock:
                low_stock_count += 1

        # Create or update snapshot
        snapshot, created = MonthlyInventorySnapshot.objects.update_or_create(
            company=company,
            month=snapshot_month,
            year=snapshot_year,
            defaults={
                'inventory_data': inventory_data,
                'total_products': len(inventory_data),
                'total_value': total_value,
                'low_stock_count': low_stock_count,
            }
        )

        if created:
            stats['snapshots_created'] += 1
        else:
            stats['snapshots_updated'] += 1

    logger.info(f"Monthly inventory snapshot generation complete: {stats}")
    return stats


@shared_task
def generate_audit_binder(binder_id: int):
    """
    Async task to generate an audit binder PDF.

    Called when a user requests an audit binder - runs asynchronously
    to avoid blocking the API request.

    Args:
        binder_id: The ID of the AuditBinder to generate

    Returns:
        Dictionary with generation result
    """
    from api.models import AuditBinder
    from api.services.fsma.audit_binder_generator import AuditBinderGenerator

    try:
        binder = AuditBinder.objects.get(id=binder_id)
    except AuditBinder.DoesNotExist:
        logger.error(f"AuditBinder with id {binder_id} not found")
        return {'success': False, 'error': 'Binder not found'}

    generator = AuditBinderGenerator(binder)
    success = generator.generate()

    if success:
        logger.info(f"Successfully generated audit binder {binder_id}")
        return {
            'success': True,
            'binder_id': binder_id,
            'file_size': binder.file_size,
            'page_count': binder.page_count,
        }
    else:
        logger.error(f"Failed to generate audit binder {binder_id}: {binder.error_message}")
        return {
            'success': False,
            'binder_id': binder_id,
            'error': binder.error_message,
        }


@shared_task
def check_low_inventory_alerts():
    """
    Daily task to check for low inventory and generate alerts.

    Runs at 8 AM daily to:
    1. Check all inventory items against reorder points
    2. Generate alerts for low stock items
    3. Deactivate alerts for replenished items

    Returns:
        Dictionary with processing statistics
    """
    from api.models import Company, FertilizerInventory, ComplianceAlert
    from django.db.models import F

    stats = {
        'companies_checked': 0,
        'items_checked': 0,
        'alerts_created': 0,
        'alerts_cleared': 0,
    }

    companies = Company.objects.all()

    for company in companies:
        stats['companies_checked'] += 1

        # Get low stock items
        low_stock_items = FertilizerInventory.objects.filter(
            company=company,
            reorder_point__isnull=False,
            quantity_on_hand__lte=F('reorder_point')
        ).select_related('product')

        for item in low_stock_items:
            stats['items_checked'] += 1

            # Check if alert already exists
            existing_alert = ComplianceAlert.objects.filter(
                company=company,
                alert_type='low_inventory',
                related_object_type='FertilizerInventory',
                related_object_id=item.id,
                is_active=True,
            ).exists()

            if not existing_alert:
                ComplianceAlert.objects.create(
                    company=company,
                    alert_type='low_inventory',
                    priority='medium',
                    title=f"Low Stock: {item.product.name}",
                    message=f"{item.product.name} inventory is low. "
                           f"Current: {item.quantity_on_hand} {item.unit}, "
                           f"Reorder Point: {item.reorder_point} {item.unit}",
                    related_object_type='FertilizerInventory',
                    related_object_id=item.id,
                    action_url='/fsma/fertilizer-inventory',
                    action_label='View Inventory',
                )
                stats['alerts_created'] += 1

        # Clear alerts for items that have been restocked
        restocked_items = FertilizerInventory.objects.filter(
            company=company,
            reorder_point__isnull=False,
            quantity_on_hand__gt=F('reorder_point')
        )

        for item in restocked_items:
            cleared = ComplianceAlert.objects.filter(
                company=company,
                alert_type='low_inventory',
                related_object_type='FertilizerInventory',
                related_object_id=item.id,
                is_active=True,
            ).update(is_active=False)

            stats['alerts_cleared'] += cleared

    logger.info(f"Low inventory alert check complete: {stats}")
    return stats


@shared_task
def check_phi_compliance_for_upcoming_harvests():
    """
    Daily task to check PHI compliance for harvests scheduled in the next 7 days.

    Runs at 6 AM daily to:
    1. Find harvests scheduled in the next week
    2. Run PHI compliance check for each
    3. Generate alerts for non-compliant harvests

    Returns:
        Dictionary with processing statistics
    """
    from api.models import Harvest, PHIComplianceCheck, ComplianceAlert
    from api.services.fsma.phi_compliance import FSMAPHIComplianceService

    today = date.today()
    week_ahead = today + timedelta(days=7)

    stats = {
        'harvests_checked': 0,
        'compliant': 0,
        'warning': 0,
        'non_compliant': 0,
        'alerts_created': 0,
    }

    # Find upcoming harvests without PHI checks
    upcoming_harvests = Harvest.objects.filter(
        harvest_date__gte=today,
        harvest_date__lte=week_ahead,
    ).select_related('field', 'field__farm', 'field__farm__company')

    service = FSMAPHIComplianceService()

    for harvest in upcoming_harvests:
        stats['harvests_checked'] += 1

        # Check if PHI check already exists
        try:
            phi_check = harvest.phi_compliance_check
        except PHIComplianceCheck.DoesNotExist:
            # Create new check
            phi_check = service.create_phi_compliance_check(harvest)

        # Count by status
        if phi_check.status == 'compliant':
            stats['compliant'] += 1
        elif phi_check.status == 'warning':
            stats['warning'] += 1
            _create_phi_alert(harvest, phi_check, 'high')
            stats['alerts_created'] += 1
        elif phi_check.status == 'non_compliant':
            stats['non_compliant'] += 1
            _create_phi_alert(harvest, phi_check, 'critical')
            stats['alerts_created'] += 1

    logger.info(f"PHI compliance check for upcoming harvests complete: {stats}")
    return stats


def _create_phi_alert(harvest, phi_check, priority):
    """Helper to create PHI compliance alert."""
    from api.models import ComplianceAlert

    company = harvest.field.farm.company

    # Check if alert already exists
    existing = ComplianceAlert.objects.filter(
        company=company,
        alert_type='phi_issue',
        related_object_type='Harvest',
        related_object_id=harvest.id,
        is_active=True,
    ).exists()

    if existing:
        return None

    if phi_check.status == 'non_compliant':
        title = f"PHI Non-Compliant: {harvest.field.name}"
        message = (
            f"Harvest scheduled for {harvest.harvest_date} on {harvest.field.name} "
            f"has PHI compliance issues. Earliest safe harvest date: {phi_check.earliest_safe_harvest}. "
            f"Review applications before proceeding."
        )
    else:
        title = f"PHI Warning: {harvest.field.name}"
        message = (
            f"Harvest scheduled for {harvest.harvest_date} on {harvest.field.name} "
            f"is close to PHI limits. Please review before proceeding."
        )

    ComplianceAlert.objects.create(
        company=company,
        alert_type='phi_issue',
        priority=priority,
        title=title,
        message=message,
        related_object_type='Harvest',
        related_object_id=harvest.id,
        action_url=f'/fsma/phi-checks/{phi_check.id}',
        action_label='View Details',
    )


@shared_task
def send_fsma_daily_reminder():
    """
    Daily task to send FSMA compliance reminders.

    Runs at 7 AM to remind users about:
    1. Facilities needing cleaning today
    2. Visitors expected today
    3. Any pending FSMA compliance issues

    Returns:
        Dictionary with email statistics
    """
    from api.models import (
        Company, FacilityLocation, CompanyMembership,
        NotificationPreference, NotificationLog
    )
    from api.services.fsma.cleaning_scheduler import CleaningScheduler

    today = date.today()
    stats = {
        'companies_processed': 0,
        'emails_sent': 0,
        'emails_skipped': 0,
    }

    companies = Company.objects.all()

    for company in companies:
        stats['companies_processed'] += 1

        # Get cleaning schedule for today
        scheduler = CleaningScheduler(company)
        schedule = scheduler.get_todays_schedule()

        # Count facilities needing cleaning
        pending_cleanings = sum(1 for item in schedule if item['needs_cleaning'] and not item['cleaned_today'])

        if pending_cleanings == 0:
            continue

        # Get users to notify
        members = CompanyMembership.objects.filter(
            company=company,
            is_active=True,
        ).select_related('user')

        for membership in members:
            user = membership.user

            # Check notification preferences
            try:
                prefs = NotificationPreference.objects.get(user=user)
                if not prefs.email_enabled:
                    stats['emails_skipped'] += 1
                    continue
            except NotificationPreference.DoesNotExist:
                pass  # Use defaults

            # Check if already sent today
            already_sent = NotificationLog.objects.filter(
                user=user,
                notification_type='fsma_daily_reminder',
                created_at__date=today,
            ).exists()

            if already_sent:
                stats['emails_skipped'] += 1
                continue

            # Log the notification (actual email sending would go here)
            NotificationLog.objects.create(
                user=user,
                notification_type='fsma_daily_reminder',
                channel='email',
                status='sent',
            )
            stats['emails_sent'] += 1

            logger.info(f"FSMA daily reminder sent to {user.email} - {pending_cleanings} facilities need cleaning")

    logger.info(f"FSMA daily reminder task complete: {stats}")
    return stats


@shared_task
def cleanup_old_fsma_data(days_old: int = 365):
    """
    Annual task to archive or cleanup old FSMA data.

    Runs monthly to:
    1. Archive visitor logs older than retention period
    2. Archive cleaning logs older than retention period
    3. Clean up completed audit binder records

    Args:
        days_old: Days after which to archive data (default 1 year)

    Returns:
        Dictionary with cleanup statistics
    """
    from api.models import VisitorLog, FacilityCleaningLog, AuditBinder

    cutoff_date = date.today() - timedelta(days=days_old)

    stats = {
        'visitor_logs_archived': 0,
        'cleaning_logs_archived': 0,
        'audit_binders_cleaned': 0,
    }

    # Note: In production, you might want to archive rather than delete
    # For now, we just log the counts

    old_visitor_logs = VisitorLog.objects.filter(
        visit_date__lt=cutoff_date
    ).count()
    stats['visitor_logs_archived'] = old_visitor_logs

    old_cleaning_logs = FacilityCleaningLog.objects.filter(
        cleaning_date__lt=cutoff_date
    ).count()
    stats['cleaning_logs_archived'] = old_cleaning_logs

    # Delete old failed audit binders
    old_binders_deleted, _ = AuditBinder.objects.filter(
        status='failed',
        created_at__lt=timezone.now() - timedelta(days=30)
    ).delete()
    stats['audit_binders_cleaned'] = old_binders_deleted

    logger.info(f"FSMA data cleanup complete: {stats}")
    return stats
