"""
Email Service for Grove Master
Handles all transactional email sending with template rendering.
"""

from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class EmailService:
    """Centralized email sending service."""

    @staticmethod
    def send_email(
        to_email: str,
        subject: str,
        template_name: str,
        context: dict,
        from_email: str = None
    ) -> bool:
        """
        Send an email using Django templates.

        Args:
            to_email: Recipient email address
            subject: Email subject (prefix will be added)
            template_name: Name of template (without extension)
            context: Template context dictionary
            from_email: Optional sender override

        Returns:
            bool: True if sent successfully, False otherwise
        """
        try:
            # Add common context
            context['frontend_url'] = settings.FRONTEND_URL
            context['support_email'] = settings.DEFAULT_FROM_EMAIL

            # Render templates
            html_content = render_to_string(f'emails/{template_name}.html', context)
            text_content = render_to_string(f'emails/{template_name}.txt', context)

            # Create email
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=from_email or settings.DEFAULT_FROM_EMAIL,
                to=[to_email]
            )
            email.attach_alternative(html_content, "text/html")

            # Send
            email.send(fail_silently=False)
            logger.info(f"Email sent successfully to {to_email}: {subject}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    @classmethod
    def send_invitation_email(cls, invitation) -> bool:
        """Send team invitation email."""
        invite_url = f"{settings.FRONTEND_URL}/?invite={invitation.token}"

        # Get inviter's full name
        inviter_name = 'A team member'
        if invitation.invited_by:
            if invitation.invited_by.first_name or invitation.invited_by.last_name:
                inviter_name = f"{invitation.invited_by.first_name} {invitation.invited_by.last_name}".strip()
            else:
                inviter_name = invitation.invited_by.email

        context = {
            'recipient_email': invitation.email,
            'company_name': invitation.company.name,
            'role_name': invitation.role.name,
            'inviter_name': inviter_name,
            'inviter_email': invitation.invited_by.email if invitation.invited_by else '',
            'personal_message': invitation.message,
            'invite_url': invite_url,
            'expires_at': invitation.expires_at,
        }

        return cls.send_email(
            to_email=invitation.email,
            subject=f"You're invited to join {invitation.company.name}",
            template_name='invitation',
            context=context
        )

    @classmethod
    def send_password_reset_email(cls, user, reset_token) -> bool:
        """Send password reset email."""
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

        # Get user's display name
        user_name = user.first_name if user.first_name else user.email.split('@')[0]

        context = {
            'user_name': user_name,
            'user_email': user.email,
            'reset_url': reset_url,
        }

        return cls.send_email(
            to_email=user.email,
            subject="Reset your password",
            template_name='password_reset',
            context=context
        )

    @classmethod
    def send_password_changed_email(cls, user) -> bool:
        """Send confirmation that password was changed."""
        user_name = user.first_name if user.first_name else user.email.split('@')[0]

        context = {
            'user_name': user_name,
            'user_email': user.email,
        }

        return cls.send_email(
            to_email=user.email,
            subject="Your password has been changed",
            template_name='password_changed',
            context=context
        )

    @classmethod
    def send_welcome_email(cls, user, company) -> bool:
        """Send welcome email after accepting invitation."""
        login_url = f"{settings.FRONTEND_URL}/login"

        user_name = user.first_name if user.first_name else user.email.split('@')[0]

        context = {
            'user_name': user_name,
            'company_name': company.name,
            'login_url': login_url,
        }

        return cls.send_email(
            to_email=user.email,
            subject=f"Welcome to {company.name}!",
            template_name='welcome',
            context=context
        )

    # =========================================================================
    # COMPLIANCE EMAIL METHODS
    # =========================================================================

    @classmethod
    def send_compliance_reminder(cls, user, deadline, days_until_due: int) -> bool:
        """
        Send compliance deadline reminder email.

        Args:
            user: User to notify
            deadline: ComplianceDeadline instance
            days_until_due: Number of days until deadline
        """
        user_name = user.first_name if user.first_name else user.email.split('@')[0]
        deadline_url = f"{settings.FRONTEND_URL}/compliance/deadlines/{deadline.id}"

        # Determine urgency level for email styling
        if days_until_due <= 1:
            urgency = 'critical'
            urgency_text = 'URGENT: '
        elif days_until_due <= 7:
            urgency = 'high'
            urgency_text = 'Reminder: '
        else:
            urgency = 'normal'
            urgency_text = ''

        context = {
            'user_name': user_name,
            'deadline_name': deadline.name,
            'deadline_description': deadline.description,
            'deadline_category': deadline.get_category_display(),
            'due_date': deadline.due_date,
            'days_until_due': days_until_due,
            'urgency': urgency,
            'deadline_url': deadline_url,
            'company_name': deadline.company.name,
        }

        return cls.send_email(
            to_email=user.email,
            subject=f"{urgency_text}{deadline.name} due in {days_until_due} day{'s' if days_until_due != 1 else ''}",
            template_name='compliance_deadline_reminder',
            context=context
        )

    @classmethod
    def send_license_expiration_warning(cls, user, license, days_until_expiry: int) -> bool:
        """
        Send license expiration warning email.

        Args:
            user: User to notify (license holder or admin)
            license: License instance
            days_until_expiry: Number of days until expiration
        """
        user_name = user.first_name if user.first_name else user.email.split('@')[0]
        license_url = f"{settings.FRONTEND_URL}/compliance/licenses/{license.id}"

        holder_name = license.user.get_full_name() if license.user else 'Company'

        if days_until_expiry <= 0:
            urgency = 'critical'
            urgency_text = 'EXPIRED: '
            days_text = f'expired {abs(days_until_expiry)} days ago'
        elif days_until_expiry <= 30:
            urgency = 'critical'
            urgency_text = 'URGENT: '
            days_text = f'expires in {days_until_expiry} days'
        elif days_until_expiry <= 60:
            urgency = 'high'
            urgency_text = 'Important: '
            days_text = f'expires in {days_until_expiry} days'
        else:
            urgency = 'normal'
            urgency_text = ''
            days_text = f'expires in {days_until_expiry} days'

        context = {
            'user_name': user_name,
            'holder_name': holder_name,
            'license_type': license.get_license_type_display(),
            'license_number': license.license_number,
            'issuing_authority': license.issuing_authority,
            'expiration_date': license.expiration_date,
            'days_until_expiry': days_until_expiry,
            'days_text': days_text,
            'urgency': urgency,
            'license_url': license_url,
            'company_name': license.company.name,
        }

        return cls.send_email(
            to_email=user.email,
            subject=f"{urgency_text}{license.get_license_type_display()} {days_text}",
            template_name='license_expiration_warning',
            context=context
        )

    @classmethod
    def send_training_due_reminder(cls, user, training_record, days_until_expiry: int) -> bool:
        """
        Send WPS training expiration reminder email.

        Args:
            user: User to notify
            training_record: WPSTrainingRecord instance
            days_until_expiry: Number of days until expiration
        """
        user_name = user.first_name if user.first_name else user.email.split('@')[0]
        training_url = f"{settings.FRONTEND_URL}/compliance/wps/training"

        trainee_name = (
            training_record.trainee_user.get_full_name()
            if training_record.trainee_user
            else training_record.trainee_name
        )

        if days_until_expiry <= 0:
            urgency = 'critical'
            urgency_text = 'EXPIRED: '
        elif days_until_expiry <= 30:
            urgency = 'high'
            urgency_text = 'Action Required: '
        else:
            urgency = 'normal'
            urgency_text = ''

        context = {
            'user_name': user_name,
            'trainee_name': trainee_name,
            'training_type': training_record.get_training_type_display(),
            'training_date': training_record.training_date,
            'expiration_date': training_record.expiration_date,
            'days_until_expiry': days_until_expiry,
            'urgency': urgency,
            'training_url': training_url,
            'company_name': training_record.company.name,
        }

        return cls.send_email(
            to_email=user.email,
            subject=f"{urgency_text}WPS Training for {trainee_name} {'expired' if days_until_expiry <= 0 else 'expiring soon'}",
            template_name='training_due_reminder',
            context=context
        )

    @classmethod
    def send_compliance_digest(
        cls,
        user,
        alerts,
        deadlines,
        expiring_licenses,
        expiring_training
    ) -> bool:
        """
        Send daily/weekly compliance digest email.

        Args:
            user: User to send digest to
            alerts: QuerySet of active ComplianceAlerts
            deadlines: QuerySet of upcoming ComplianceDeadlines
            expiring_licenses: QuerySet of expiring Licenses
            expiring_training: QuerySet of expiring WPSTrainingRecords
        """
        user_name = user.first_name if user.first_name else user.email.split('@')[0]
        dashboard_url = f"{settings.FRONTEND_URL}/compliance"

        # Count items by priority
        critical_count = sum(1 for a in alerts if a.priority == 'critical')
        high_count = sum(1 for a in alerts if a.priority == 'high')
        overdue_count = sum(1 for d in deadlines if d.status == 'overdue')

        # Build subject based on urgency
        if critical_count > 0:
            subject = f"⚠️ {critical_count} Critical Compliance Alert{'s' if critical_count != 1 else ''}"
        elif high_count > 0 or overdue_count > 0:
            subject = f"Compliance Digest: {high_count + overdue_count} item{'s' if (high_count + overdue_count) != 1 else ''} need attention"
        else:
            subject = "Your Daily Compliance Digest"

        context = {
            'user_name': user_name,
            'alerts': list(alerts),
            'deadlines': list(deadlines),
            'expiring_licenses': list(expiring_licenses),
            'expiring_training': list(expiring_training),
            'critical_count': critical_count,
            'high_count': high_count,
            'overdue_count': overdue_count,
            'total_items': len(alerts) + len(deadlines) + len(expiring_licenses) + len(expiring_training),
            'dashboard_url': dashboard_url,
        }

        return cls.send_email(
            to_email=user.email,
            subject=subject,
            template_name='compliance_digest',
            context=context
        )


# Convenience functions for use in tasks
def send_compliance_reminder(user, deadline, days_until_due):
    """Wrapper for EmailService.send_compliance_reminder."""
    return EmailService.send_compliance_reminder(user, deadline, days_until_due)


def send_compliance_digest(user, alerts, deadlines, expiring_licenses, expiring_training):
    """Wrapper for EmailService.send_compliance_digest."""
    return EmailService.send_compliance_digest(
        user, alerts, deadlines, expiring_licenses, expiring_training
    )
