"""
Celery tasks for compliance management automation.

These tasks run on schedules to:
- Check and update compliance deadline statuses
- Generate alerts for upcoming/overdue items
- Send reminder emails at configured intervals
- Auto-generate recurring deadlines
- Check license and training expirations
- Generate draft compliance reports
"""

import logging
from datetime import timedelta
from celery import shared_task
from django.utils import timezone
from django.db.models import Q

logger = logging.getLogger(__name__)


@shared_task
def check_compliance_deadlines():
    """
    Daily task to check and update compliance deadline statuses.

    Runs at 6 AM daily to:
    1. Update deadline statuses based on due dates
    2. Generate alerts for due_soon and overdue items
    3. Mark completed items that have auto-completed

    Returns:
        Dictionary with processing statistics
    """
    from api.models import ComplianceDeadline, ComplianceAlert

    today = timezone.now().date()
    stats = {
        'deadlines_checked': 0,
        'status_updates': 0,
        'alerts_created': 0,
    }

    # Get all non-completed deadlines
    deadlines = ComplianceDeadline.objects.filter(
        status__in=['upcoming', 'due_soon', 'overdue']
    ).select_related('company', 'related_farm', 'related_field')

    for deadline in deadlines:
        stats['deadlines_checked'] += 1
        old_status = deadline.status

        days_until_due = (deadline.due_date - today).days

        # Determine new status
        if days_until_due < 0:
            new_status = 'overdue'
        elif days_until_due <= deadline.warning_days:
            new_status = 'due_soon'
        else:
            new_status = 'upcoming'

        # Update if status changed
        if new_status != old_status:
            deadline.status = new_status
            deadline.save(update_fields=['status'])
            stats['status_updates'] += 1

            # Create alert for status transitions
            if new_status == 'overdue':
                _create_deadline_alert(deadline, 'critical', 'overdue')
                stats['alerts_created'] += 1
            elif new_status == 'due_soon' and old_status == 'upcoming':
                _create_deadline_alert(deadline, 'high', 'due_soon')
                stats['alerts_created'] += 1

    logger.info(f"Compliance deadline check complete: {stats}")
    return stats


def _create_deadline_alert(deadline, priority, alert_type):
    """Helper to create a compliance alert for a deadline."""
    from api.models import ComplianceAlert

    # Check if an active alert already exists
    existing = ComplianceAlert.objects.filter(
        related_deadline=deadline,
        is_active=True,
        alert_type=alert_type,
    ).exists()

    if existing:
        return None

    days_text = abs((deadline.due_date - timezone.now().date()).days)

    if alert_type == 'overdue':
        title = f"Overdue: {deadline.name}"
        message = f"This compliance deadline was due {days_text} days ago on {deadline.due_date}."
    else:
        title = f"Due Soon: {deadline.name}"
        message = f"This compliance deadline is due in {days_text} days on {deadline.due_date}."

    return ComplianceAlert.objects.create(
        company=deadline.company,
        alert_type=alert_type,
        priority=priority,
        title=title,
        message=message,
        related_deadline=deadline,
        related_object_type='ComplianceDeadline',
        related_object_id=deadline.id,
        action_url=f'/compliance/deadlines/{deadline.id}',
        action_label='View Deadline',
    )


@shared_task
def generate_recurring_deadlines(company_id: int = None):
    """
    Generate recurring deadlines for the next 12 months based on compliance profiles.

    This task:
    1. Reads each company's ComplianceProfile
    2. Generates appropriate deadlines based on requirements
    3. Only creates deadlines that don't already exist

    Args:
        company_id: Optional - process single company, or all if None

    Returns:
        Dictionary with generation statistics
    """
    from api.models import ComplianceProfile, ComplianceDeadline, Company

    stats = {
        'companies_processed': 0,
        'deadlines_created': 0,
    }

    today = timezone.now().date()
    one_year_out = today + timedelta(days=365)

    # Get profiles to process
    if company_id:
        profiles = ComplianceProfile.objects.filter(company_id=company_id)
    else:
        profiles = ComplianceProfile.objects.all()

    profiles = profiles.select_related('company')

    for profile in profiles:
        stats['companies_processed'] += 1
        company = profile.company

        # PUR Monthly Reporting (California)
        if profile.requires_pur_reporting and profile.primary_state == 'CA':
            created = _generate_monthly_pur_deadlines(company, today, one_year_out)
            stats['deadlines_created'] += created

        # SGMA Semi-Annual Reporting
        if profile.primary_state == 'CA':
            created = _generate_sgma_deadlines(company, today, one_year_out)
            stats['deadlines_created'] += created

        # WPS Annual Training
        if profile.requires_wps_compliance:
            created = _generate_wps_training_deadlines(company, today, one_year_out)
            stats['deadlines_created'] += created

        # Water Testing (quarterly)
        created = _generate_water_testing_deadlines(company, today, one_year_out)
        stats['deadlines_created'] += created

    logger.info(f"Recurring deadline generation complete: {stats}")
    return stats


def _generate_monthly_pur_deadlines(company, start_date, end_date):
    """Generate monthly PUR reporting deadlines."""
    from api.models import ComplianceDeadline

    created = 0
    current = start_date.replace(day=10)  # PUR due by 10th of following month

    if current <= start_date:
        current = (current.replace(day=1) + timedelta(days=32)).replace(day=10)

    while current <= end_date:
        # Check if deadline already exists
        reporting_month = (current.replace(day=1) - timedelta(days=1)).strftime('%B %Y')
        deadline_name = f"PUR Report - {reporting_month}"

        exists = ComplianceDeadline.objects.filter(
            company=company,
            name=deadline_name,
        ).exists()

        if not exists:
            ComplianceDeadline.objects.create(
                company=company,
                name=deadline_name,
                description=f"Submit Pesticide Use Report for {reporting_month} to County Agricultural Commissioner",
                category='reporting',
                due_date=current,
                frequency='monthly',
                warning_days=7,
                auto_generated=True,
            )
            created += 1

        # Move to next month
        current = (current.replace(day=1) + timedelta(days=32)).replace(day=10)

    return created


def _generate_sgma_deadlines(company, start_date, end_date):
    """Generate semi-annual SGMA reporting deadlines."""
    from api.models import ComplianceDeadline

    created = 0
    year = start_date.year

    # SGMA reports typically due January 15 and July 15
    deadlines_to_check = []

    for y in range(year, end_date.year + 1):
        from datetime import date
        deadlines_to_check.append((date(y, 1, 15), f"July-December {y-1}"))
        deadlines_to_check.append((date(y, 7, 15), f"January-June {y}"))

    for due_date, period in deadlines_to_check:
        if start_date <= due_date <= end_date:
            deadline_name = f"SGMA Extraction Report - {period}"

            exists = ComplianceDeadline.objects.filter(
                company=company,
                name=deadline_name,
            ).exists()

            if not exists:
                ComplianceDeadline.objects.create(
                    company=company,
                    name=deadline_name,
                    description=f"Submit groundwater extraction report for {period} to GSA",
                    category='reporting',
                    due_date=due_date,
                    frequency='semi_annual',
                    warning_days=14,
                    auto_generated=True,
                )
                created += 1

    return created


def _generate_wps_training_deadlines(company, start_date, end_date):
    """Generate annual WPS training deadlines."""
    from api.models import ComplianceDeadline

    created = 0
    year = start_date.year

    for y in range(year, end_date.year + 1):
        from datetime import date
        # Training should be completed by end of February
        due_date = date(y, 2, 28)

        if start_date <= due_date <= end_date:
            deadline_name = f"WPS Annual Training - {y}"

            exists = ComplianceDeadline.objects.filter(
                company=company,
                name=deadline_name,
            ).exists()

            if not exists:
                ComplianceDeadline.objects.create(
                    company=company,
                    name=deadline_name,
                    description=f"Complete annual Worker Protection Standard training for all workers and handlers",
                    category='training',
                    due_date=due_date,
                    frequency='annual',
                    warning_days=30,
                    auto_generated=True,
                )
                created += 1

    return created


def _generate_water_testing_deadlines(company, start_date, end_date):
    """Generate quarterly water testing deadlines."""
    from api.models import ComplianceDeadline

    created = 0
    year = start_date.year

    quarters = [
        (3, 15, 'Q1'),   # Q1 testing due March 15
        (6, 15, 'Q2'),   # Q2 testing due June 15
        (9, 15, 'Q3'),   # Q3 testing due September 15
        (12, 15, 'Q4'),  # Q4 testing due December 15
    ]

    for y in range(year, end_date.year + 1):
        from datetime import date
        for month, day, quarter in quarters:
            due_date = date(y, month, day)

            if start_date <= due_date <= end_date:
                deadline_name = f"Water Quality Testing - {quarter} {y}"

                exists = ComplianceDeadline.objects.filter(
                    company=company,
                    name=deadline_name,
                ).exists()

                if not exists:
                    ComplianceDeadline.objects.create(
                        company=company,
                        name=deadline_name,
                        description=f"Complete quarterly water quality testing for {quarter} {y}",
                        category='testing',
                        due_date=due_date,
                        frequency='quarterly',
                        warning_days=14,
                        auto_generated=True,
                    )
                    created += 1

    return created


@shared_task
def check_license_expirations():
    """
    Daily task to check license expirations and generate alerts.

    Generates alerts at:
    - 90 days before expiration (medium priority)
    - 60 days before expiration (high priority)
    - 30 days before expiration (critical priority)
    - On expiration date (critical)

    Returns:
        Dictionary with processing statistics
    """
    from api.models import License, ComplianceAlert

    today = timezone.now().date()
    stats = {
        'licenses_checked': 0,
        'alerts_created': 0,
        'expired_count': 0,
    }

    # Get active/expiring_soon licenses
    licenses = License.objects.filter(
        status__in=['active', 'expiring_soon']
    ).select_related('company', 'user')

    for license in licenses:
        stats['licenses_checked'] += 1

        if not license.expiration_date:
            continue

        days_until_expiry = (license.expiration_date - today).days

        # Update license status
        if days_until_expiry < 0:
            if license.status != 'expired':
                license.status = 'expired'
                license.save(update_fields=['status'])
                stats['expired_count'] += 1
                _create_license_alert(license, 'critical', 'expired', days_until_expiry)
                stats['alerts_created'] += 1
        elif days_until_expiry <= 30:
            if license.status != 'expiring_soon':
                license.status = 'expiring_soon'
                license.save(update_fields=['status'])
            _create_license_alert(license, 'critical', 'expiring_30', days_until_expiry)
            stats['alerts_created'] += 1
        elif days_until_expiry <= 60:
            _create_license_alert(license, 'high', 'expiring_60', days_until_expiry)
            stats['alerts_created'] += 1
        elif days_until_expiry <= 90:
            _create_license_alert(license, 'medium', 'expiring_90', days_until_expiry)
            stats['alerts_created'] += 1

    logger.info(f"License expiration check complete: {stats}")
    return stats


def _create_license_alert(license, priority, alert_type, days):
    """Helper to create a license expiration alert."""
    from api.models import ComplianceAlert

    # Check if similar alert already exists today
    existing = ComplianceAlert.objects.filter(
        related_object_type='License',
        related_object_id=license.id,
        is_active=True,
        created_at__date=timezone.now().date(),
    ).exists()

    if existing:
        return None

    user_name = license.user.get_full_name() if license.user else 'Company'

    if alert_type == 'expired':
        title = f"License Expired: {license.get_license_type_display()}"
        message = f"{user_name}'s {license.get_license_type_display()} (#{license.license_number}) expired on {license.expiration_date}."
    else:
        title = f"License Expiring: {license.get_license_type_display()}"
        message = f"{user_name}'s {license.get_license_type_display()} (#{license.license_number}) expires in {days} days on {license.expiration_date}."

    return ComplianceAlert.objects.create(
        company=license.company,
        alert_type='license_expiring',
        priority=priority,
        title=title,
        message=message,
        related_object_type='License',
        related_object_id=license.id,
        action_url=f'/compliance/licenses/{license.id}',
        action_label='View License',
    )


@shared_task
def check_wps_training_expirations():
    """
    Daily task to check WPS training expirations and generate alerts.

    WPS training typically expires annually. Generates alerts at
    90, 60, and 30 days before expiration.

    Returns:
        Dictionary with processing statistics
    """
    from api.models import WPSTrainingRecord, ComplianceAlert

    today = timezone.now().date()
    stats = {
        'records_checked': 0,
        'alerts_created': 0,
        'expired_count': 0,
    }

    # Get non-expired training records
    records = WPSTrainingRecord.objects.exclude(
        expiration_date__lt=today
    ).select_related('company', 'trainee_user')

    for record in records:
        stats['records_checked'] += 1

        if not record.expiration_date:
            continue

        days_until_expiry = (record.expiration_date - today).days

        if days_until_expiry < 0:
            stats['expired_count'] += 1
            _create_training_alert(record, 'critical', days_until_expiry)
            stats['alerts_created'] += 1
        elif days_until_expiry <= 30:
            _create_training_alert(record, 'high', days_until_expiry)
            stats['alerts_created'] += 1
        elif days_until_expiry <= 60:
            _create_training_alert(record, 'medium', days_until_expiry)
            stats['alerts_created'] += 1
        elif days_until_expiry <= 90:
            _create_training_alert(record, 'low', days_until_expiry)
            stats['alerts_created'] += 1

    logger.info(f"WPS training expiration check complete: {stats}")
    return stats


def _create_training_alert(record, priority, days):
    """Helper to create a training expiration alert."""
    from api.models import ComplianceAlert

    # Check if similar alert already exists this week
    week_ago = timezone.now() - timedelta(days=7)
    existing = ComplianceAlert.objects.filter(
        related_object_type='WPSTrainingRecord',
        related_object_id=record.id,
        is_active=True,
        created_at__gte=week_ago,
    ).exists()

    if existing:
        return None

    trainee_name = record.trainee_user.get_full_name() if record.trainee_user else record.trainee_name
    training_type = record.get_training_type_display()

    if days < 0:
        title = f"Training Expired: {trainee_name}"
        message = f"{trainee_name}'s {training_type} training expired {abs(days)} days ago."
    else:
        title = f"Training Expiring: {trainee_name}"
        message = f"{trainee_name}'s {training_type} training expires in {days} days on {record.expiration_date}."

    return ComplianceAlert.objects.create(
        company=record.company,
        alert_type='training_expiring',
        priority=priority,
        title=title,
        message=message,
        related_object_type='WPSTrainingRecord',
        related_object_id=record.id,
        action_url='/compliance/wps/training',
        action_label='View Training Records',
    )


@shared_task
def send_compliance_reminder_emails():
    """
    Send email reminders for upcoming compliance deadlines.

    Sends to users based on their NotificationPreference settings.
    Uses configured reminder thresholds (e.g., 30, 14, 7, 1 days before).

    Returns:
        Dictionary with email statistics
    """
    from api.models import (
        ComplianceDeadline, NotificationPreference, NotificationLog,
        CompanyMembership
    )
    from api.email_service import send_compliance_reminder

    today = timezone.now().date()
    stats = {
        'emails_sent': 0,
        'emails_failed': 0,
    }

    # Get deadlines due soon
    deadlines = ComplianceDeadline.objects.filter(
        status='due_soon'
    ).select_related('company')

    for deadline in deadlines:
        days_until_due = (deadline.due_date - today).days

        # Get company members with notifications enabled
        members = CompanyMembership.objects.filter(
            company=deadline.company,
            is_active=True,
        ).select_related('user')

        for membership in members:
            user = membership.user

            # Check notification preferences
            try:
                prefs = NotificationPreference.objects.get(user=user)
            except NotificationPreference.DoesNotExist:
                # Use defaults
                prefs = None

            if prefs and not prefs.email_enabled:
                continue

            if prefs and not prefs.notify_deadlines:
                continue

            # Check if we should send based on reminder days
            reminder_days = [30, 14, 7, 1]
            if prefs and prefs.deadline_reminder_days:
                reminder_days = prefs.deadline_reminder_days

            if days_until_due not in reminder_days:
                continue

            # Check if we already sent this reminder
            already_sent = NotificationLog.objects.filter(
                user=user,
                notification_type='deadline_reminder',
                related_object_type='ComplianceDeadline',
                related_object_id=deadline.id,
                created_at__date=today,
            ).exists()

            if already_sent:
                continue

            # Send the email
            try:
                send_compliance_reminder(
                    user=user,
                    deadline=deadline,
                    days_until_due=days_until_due,
                )

                # Log the notification
                NotificationLog.objects.create(
                    user=user,
                    notification_type='deadline_reminder',
                    channel='email',
                    related_object_type='ComplianceDeadline',
                    related_object_id=deadline.id,
                    status='sent',
                )
                stats['emails_sent'] += 1

            except Exception as e:
                logger.error(f"Failed to send compliance reminder to {user.email}: {e}")
                NotificationLog.objects.create(
                    user=user,
                    notification_type='deadline_reminder',
                    channel='email',
                    related_object_type='ComplianceDeadline',
                    related_object_id=deadline.id,
                    status='failed',
                    error_message=str(e),
                )
                stats['emails_failed'] += 1

    logger.info(f"Compliance reminder emails sent: {stats}")
    return stats


@shared_task
def auto_generate_monthly_pur_report(company_id: int = None):
    """
    Auto-generate draft PUR report on the 1st of each month.

    Creates a ComplianceReport with status 'draft' containing
    all pesticide applications from the previous month.

    Args:
        company_id: Optional - generate for single company, or all if None

    Returns:
        Dictionary with generation statistics
    """
    from api.models import (
        Company, ComplianceProfile, ComplianceReport,
        PesticideApplication
    )
    from django.db.models import Sum, Count

    today = timezone.now().date()
    stats = {
        'reports_generated': 0,
        'companies_skipped': 0,
    }

    # Determine reporting period (previous month)
    if today.month == 1:
        period_start = today.replace(year=today.year - 1, month=12, day=1)
    else:
        period_start = today.replace(month=today.month - 1, day=1)

    period_end = today.replace(day=1) - timedelta(days=1)

    # Get companies requiring PUR
    if company_id:
        profiles = ComplianceProfile.objects.filter(
            company_id=company_id,
            requires_pur_reporting=True,
            primary_state='CA',
        )
    else:
        profiles = ComplianceProfile.objects.filter(
            requires_pur_reporting=True,
            primary_state='CA',
        )

    profiles = profiles.select_related('company')

    for profile in profiles:
        company = profile.company

        # Check if report already exists
        existing = ComplianceReport.objects.filter(
            company=company,
            report_type='pur_monthly',
            reporting_period_start=period_start,
            reporting_period_end=period_end,
        ).exists()

        if existing:
            stats['companies_skipped'] += 1
            continue

        # Gather applications for the period
        applications = PesticideApplication.objects.filter(
            company=company,
            application_date__gte=period_start,
            application_date__lte=period_end,
        ).select_related('field', 'field__farm', 'product')

        # Build report data
        report_data = {
            'reporting_period': f"{period_start.strftime('%B %Y')}",
            'total_applications': applications.count(),
            'applications': [],
        }

        for app in applications:
            report_data['applications'].append({
                'date': app.application_date.isoformat(),
                'farm': app.field.farm.name if app.field and app.field.farm else None,
                'field': app.field.name if app.field else None,
                'product': app.product.trade_name if app.product else None,
                'epa_reg_no': app.product.epa_registration_number if app.product else None,
                'rate': str(app.application_rate) if app.application_rate else None,
                'rate_unit': app.application_rate_unit,
                'area_treated': str(app.area_treated) if app.area_treated else None,
                'total_applied': str(app.total_amount_applied) if app.total_amount_applied else None,
            })

        # Create the report
        ComplianceReport.objects.create(
            company=company,
            report_type='pur_monthly',
            reporting_period_start=period_start,
            reporting_period_end=period_end,
            status='draft',
            report_data=report_data,
        )

        stats['reports_generated'] += 1
        logger.info(f"Generated draft PUR report for {company.name}")

    logger.info(f"PUR report generation complete: {stats}")
    return stats


@shared_task
def generate_rei_posting_records():
    """
    Generate REI posting records for new pesticide applications.

    Checks for applications without REI posting records and creates them.
    Calculates REI end time based on product REI hours.

    Returns:
        Dictionary with generation statistics
    """
    from api.models import PesticideApplication, REIPostingRecord
    from django.db.models import Q

    stats = {
        'applications_checked': 0,
        'records_created': 0,
    }

    # Get applications without REI posting records
    # that have a product with REI > 0
    applications = PesticideApplication.objects.filter(
        rei_posting_record__isnull=True,
        product__rei_hours__gt=0,
    ).select_related('product', 'field', 'company')

    for app in applications:
        stats['applications_checked'] += 1

        # Calculate REI end time
        if app.application_datetime:
            app_time = app.application_datetime
        else:
            # Use midnight on application date
            from datetime import datetime, time
            app_time = timezone.make_aware(
                datetime.combine(app.application_date, time(0, 0))
            )

        rei_hours = app.product.rei_hours or 0
        rei_end = app_time + timedelta(hours=rei_hours)

        REIPostingRecord.objects.create(
            application=app,
            rei_end_datetime=rei_end,
            posting_compliant=False,  # Not yet posted
        )

        stats['records_created'] += 1

    logger.info(f"REI posting record generation complete: {stats}")
    return stats


@shared_task
def check_active_reis():
    """
    Check active REI postings and generate alerts when REI is ending soon.

    Alerts when:
    - REI ending in less than 2 hours
    - REI has ended but posting not removed

    Returns:
        Dictionary with processing statistics
    """
    from api.models import REIPostingRecord, ComplianceAlert

    now = timezone.now()
    two_hours_from_now = now + timedelta(hours=2)
    stats = {
        'records_checked': 0,
        'alerts_created': 0,
    }

    # Get active REI postings (not yet removed)
    active_reis = REIPostingRecord.objects.filter(
        removed_at__isnull=True,
    ).select_related('application', 'application__field', 'application__company')

    for rei in active_reis:
        stats['records_checked'] += 1

        if rei.rei_end_datetime <= now:
            # REI has ended - alert to remove posting
            _create_rei_alert(rei, 'high', 'ended')
            stats['alerts_created'] += 1
        elif rei.rei_end_datetime <= two_hours_from_now:
            # REI ending soon
            _create_rei_alert(rei, 'medium', 'ending_soon')
            stats['alerts_created'] += 1

    logger.info(f"Active REI check complete: {stats}")
    return stats


def _create_rei_alert(rei, priority, alert_type):
    """Helper to create an REI-related alert."""
    from api.models import ComplianceAlert

    # Check if similar alert exists today
    existing = ComplianceAlert.objects.filter(
        related_object_type='REIPostingRecord',
        related_object_id=rei.id,
        is_active=True,
        created_at__date=timezone.now().date(),
    ).exists()

    if existing:
        return None

    app = rei.application
    field_name = app.field.name if app.field else 'Unknown field'
    product_name = app.product.trade_name if app.product else 'Unknown product'

    if alert_type == 'ended':
        title = f"REI Ended: {field_name}"
        message = f"The Restricted Entry Interval for {product_name} on {field_name} has ended. Remove the posting sign."
    else:
        minutes = int((rei.rei_end_datetime - timezone.now()).total_seconds() / 60)
        title = f"REI Ending Soon: {field_name}"
        message = f"The REI for {product_name} on {field_name} ends in {minutes} minutes at {rei.rei_end_datetime.strftime('%I:%M %p')}."

    return ComplianceAlert.objects.create(
        company=app.company,
        alert_type='rei_alert',
        priority=priority,
        title=title,
        message=message,
        related_object_type='REIPostingRecord',
        related_object_id=rei.id,
        action_url='/compliance/wps/rei',
        action_label='View REI Tracker',
    )


@shared_task
def send_daily_compliance_digest():
    """
    Send daily compliance digest email to users who opted in.

    Summarizes:
    - Active alerts
    - Upcoming deadlines (next 7 days)
    - Expiring licenses (next 30 days)
    - Expiring training (next 30 days)

    Returns:
        Dictionary with email statistics
    """
    from api.models import (
        NotificationPreference, CompanyMembership,
        ComplianceDeadline, ComplianceAlert, License, WPSTrainingRecord,
        NotificationLog,
    )
    from api.email_service import send_compliance_digest

    today = timezone.now().date()
    week_from_now = today + timedelta(days=7)
    month_from_now = today + timedelta(days=30)

    stats = {
        'emails_sent': 0,
        'emails_failed': 0,
        'users_skipped': 0,
    }

    # Get users with daily digest enabled
    prefs = NotificationPreference.objects.filter(
        email_enabled=True,
        email_digest='daily',
    ).select_related('user')

    for pref in prefs:
        user = pref.user

        # Get user's companies
        memberships = CompanyMembership.objects.filter(
            user=user,
            is_active=True,
        ).values_list('company_id', flat=True)

        if not memberships:
            stats['users_skipped'] += 1
            continue

        # Gather digest data
        alerts = ComplianceAlert.objects.filter(
            company_id__in=memberships,
            is_active=True,
        ).order_by('-priority', '-created_at')[:10]

        deadlines = ComplianceDeadline.objects.filter(
            company_id__in=memberships,
            status__in=['due_soon', 'overdue'],
            due_date__lte=week_from_now,
        ).order_by('due_date')[:10]

        expiring_licenses = License.objects.filter(
            company_id__in=memberships,
            status__in=['active', 'expiring_soon'],
            expiration_date__lte=month_from_now,
            expiration_date__gte=today,
        ).order_by('expiration_date')[:5]

        expiring_training = WPSTrainingRecord.objects.filter(
            company_id__in=memberships,
            expiration_date__lte=month_from_now,
            expiration_date__gte=today,
        ).order_by('expiration_date')[:5]

        # Skip if nothing to report
        if not (alerts or deadlines or expiring_licenses or expiring_training):
            stats['users_skipped'] += 1
            continue

        # Send the digest
        try:
            send_compliance_digest(
                user=user,
                alerts=alerts,
                deadlines=deadlines,
                expiring_licenses=expiring_licenses,
                expiring_training=expiring_training,
            )

            NotificationLog.objects.create(
                user=user,
                notification_type='compliance_digest',
                channel='email',
                status='sent',
            )
            stats['emails_sent'] += 1

        except Exception as e:
            logger.error(f"Failed to send compliance digest to {user.email}: {e}")
            NotificationLog.objects.create(
                user=user,
                notification_type='compliance_digest',
                channel='email',
                status='failed',
                error_message=str(e),
            )
            stats['emails_failed'] += 1

    logger.info(f"Daily compliance digest complete: {stats}")
    return stats


@shared_task
def cleanup_old_alerts(days_old: int = 90):
    """
    Clean up old acknowledged/dismissed alerts.

    Args:
        days_old: Number of days after which to delete alerts

    Returns:
        Dictionary with cleanup statistics
    """
    from api.models import ComplianceAlert

    cutoff_date = timezone.now() - timedelta(days=days_old)

    deleted, _ = ComplianceAlert.objects.filter(
        Q(is_acknowledged=True) | Q(is_active=False),
        created_at__lt=cutoff_date,
    ).delete()

    logger.info(f"Cleaned up {deleted} old compliance alerts")
    return {'deleted_alerts': deleted}
