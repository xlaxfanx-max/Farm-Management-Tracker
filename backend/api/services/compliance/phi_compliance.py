"""
FSMA PHI (Pre-Harvest Interval) Compliance Service

Provides functionality for checking and validating PHI compliance
before harvest operations. Ensures that all pesticide applications
have met their required pre-harvest intervals.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import List, Dict, Optional
from django.utils import timezone


@dataclass
class ApplicationCheckResult:
    """Result of checking a single pesticide application."""
    application_id: int
    product_name: str
    product_epa_reg_no: str
    application_date: date
    phi_days: int
    days_since_application: int
    earliest_safe_harvest: date
    compliant: bool
    margin_days: int  # How many days past PHI (positive) or until PHI (negative)


@dataclass
class PHICheckResult:
    """Result of a complete PHI compliance check for a field/harvest."""
    status: str  # 'compliant', 'warning', 'non_compliant'
    applications_checked: List[Dict] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    earliest_safe_harvest: Optional[date] = None
    total_applications_checked: int = 0
    non_compliant_count: int = 0
    warning_count: int = 0


class FSMAPHIComplianceService:
    """
    Service for checking Pre-Harvest Interval (PHI) compliance.

    PHI is the minimum number of days that must pass between a pesticide
    application and harvest. This service checks all applications on a
    field to ensure compliance before harvest.
    """

    # Warning threshold - warn if within this many days of PHI
    WARNING_THRESHOLD_DAYS = 3

    def __init__(self):
        pass

    def check_harvest_phi_compliance(
        self,
        field_id: int,
        harvest_date: date
    ) -> PHICheckResult:
        """
        Check PHI compliance for a specific field and harvest date.

        Args:
            field_id: The ID of the field being harvested
            harvest_date: The planned or actual harvest date

        Returns:
            PHICheckResult with compliance status and details
        """
        from api.models import Field, PesticideApplication

        try:
            field = Field.objects.get(id=field_id)
        except Field.DoesNotExist:
            raise ValueError(f"Field with id {field_id} not found")

        # Look back 365 days for applications (covers most PHI requirements)
        lookback_date = harvest_date - timedelta(days=365)

        applications = PesticideApplication.objects.filter(
            field=field,
            application_date__gte=lookback_date,
            application_date__lte=harvest_date
        ).select_related('product')

        return self._analyze_applications(applications, harvest_date)

    def pre_harvest_check(
        self,
        field_id: int,
        proposed_date: Optional[date] = None
    ) -> Dict:
        """
        Run a pre-harvest check without creating a record.

        Args:
            field_id: The ID of the field to check
            proposed_date: The proposed harvest date (defaults to today)

        Returns:
            Dictionary with compliance status and recommendations
        """
        if proposed_date is None:
            proposed_date = date.today()

        result = self.check_harvest_phi_compliance(field_id, proposed_date)

        return {
            'status': result.status,
            'proposed_date': str(proposed_date),
            'can_harvest': result.status in ['compliant', 'warning'],
            'applications_checked': result.applications_checked,
            'warnings': result.warnings,
            'earliest_safe_harvest': str(result.earliest_safe_harvest) if result.earliest_safe_harvest else None,
            'summary': self._generate_summary(result),
        }

    def find_earliest_safe_harvest_date(self, field_id: int) -> Optional[date]:
        """
        Find the earliest date when harvest would be PHI compliant.

        Args:
            field_id: The ID of the field to check

        Returns:
            The earliest safe harvest date, or None if no applications found
        """
        from api.models import PesticideApplication

        # Get the most restrictive (latest) safe date from all applications
        lookback_date = date.today() - timedelta(days=365)

        applications = PesticideApplication.objects.filter(
            field_id=field_id,
            application_date__gte=lookback_date
        ).select_related('product')

        if not applications.exists():
            return date.today()  # No applications = safe to harvest

        latest_safe_date = None

        for app in applications:
            phi_days = app.product.phi_days if app.product.phi_days else 0
            safe_date = app.application_date + timedelta(days=phi_days)

            if latest_safe_date is None or safe_date > latest_safe_date:
                latest_safe_date = safe_date

        return latest_safe_date

    def get_recent_applications_summary(
        self,
        field_id: int,
        days: int = 90
    ) -> List[Dict]:
        """
        Get a summary of recent pesticide applications for a field.

        Args:
            field_id: The ID of the field
            days: Number of days to look back

        Returns:
            List of application summaries with PHI info
        """
        from api.models import PesticideApplication

        lookback_date = date.today() - timedelta(days=days)

        applications = PesticideApplication.objects.filter(
            field_id=field_id,
            application_date__gte=lookback_date
        ).select_related('product').order_by('-application_date')

        summaries = []
        today = date.today()

        for app in applications:
            phi_days = app.product.phi_days if app.product.phi_days else 0
            days_since = (today - app.application_date).days
            safe_date = app.application_date + timedelta(days=phi_days)

            summaries.append({
                'application_id': app.id,
                'application_date': str(app.application_date),
                'product_name': app.product.name,
                'epa_reg_no': app.product.epa_reg_no or '',
                'phi_days': phi_days,
                'days_since_application': days_since,
                'safe_harvest_date': str(safe_date),
                'currently_compliant': days_since >= phi_days,
                'days_until_compliant': max(0, phi_days - days_since),
            })

        return summaries

    def _analyze_applications(
        self,
        applications,
        harvest_date: date
    ) -> PHICheckResult:
        """
        Analyze a set of applications for PHI compliance.

        Args:
            applications: QuerySet of PesticideApplication objects
            harvest_date: The harvest date to check against

        Returns:
            PHICheckResult with analysis details
        """
        result = PHICheckResult(
            status='compliant',
            applications_checked=[],
            warnings=[],
            total_applications_checked=0,
            non_compliant_count=0,
            warning_count=0,
        )

        latest_safe_date = None

        for app in applications:
            phi_days = app.product.phi_days if app.product.phi_days else 0
            days_since = (harvest_date - app.application_date).days
            safe_date = app.application_date + timedelta(days=phi_days)
            margin = days_since - phi_days
            compliant = days_since >= phi_days

            app_result = {
                'application_id': app.id,
                'product_name': app.product.name,
                'product_epa_reg_no': app.product.epa_reg_no or '',
                'application_date': str(app.application_date),
                'phi_days': phi_days,
                'days_since_application': days_since,
                'earliest_safe_harvest': str(safe_date),
                'compliant': compliant,
                'margin_days': margin,
            }
            result.applications_checked.append(app_result)
            result.total_applications_checked += 1

            # Track the latest safe date
            if latest_safe_date is None or safe_date > latest_safe_date:
                latest_safe_date = safe_date

            if not compliant:
                result.non_compliant_count += 1
                result.warnings.append(
                    f"NON-COMPLIANT: {app.product.name} applied on {app.application_date} - "
                    f"only {days_since} days ago (PHI requires {phi_days} days). "
                    f"Cannot harvest until {safe_date}."
                )
                result.status = 'non_compliant'
            elif margin <= self.WARNING_THRESHOLD_DAYS:
                result.warning_count += 1
                result.warnings.append(
                    f"WARNING: {app.product.name} applied on {app.application_date} - "
                    f"{days_since} days ago (PHI is {phi_days} days). "
                    f"Only {margin} days past minimum PHI requirement."
                )
                if result.status == 'compliant':
                    result.status = 'warning'

        # Only set earliest_safe_harvest if there are issues
        if result.status != 'compliant':
            result.earliest_safe_harvest = latest_safe_date

        return result

    def _generate_summary(self, result: PHICheckResult) -> str:
        """Generate a human-readable summary of the PHI check."""
        if result.status == 'compliant':
            return (
                f"All {result.total_applications_checked} pesticide application(s) "
                f"have met their PHI requirements. Field is clear for harvest."
            )
        elif result.status == 'warning':
            return (
                f"Checked {result.total_applications_checked} application(s). "
                f"{result.warning_count} application(s) are within "
                f"{self.WARNING_THRESHOLD_DAYS} days of minimum PHI. "
                f"Harvest is technically compliant but proceed with caution."
            )
        else:  # non_compliant
            return (
                f"HARVEST NOT RECOMMENDED. {result.non_compliant_count} of "
                f"{result.total_applications_checked} application(s) have not met PHI requirements. "
                f"Earliest safe harvest date: {result.earliest_safe_harvest}."
            )

    def create_phi_compliance_check(self, harvest) -> 'PHIComplianceCheck':
        """
        Create a PHIComplianceCheck record for a harvest.

        Args:
            harvest: The Harvest model instance

        Returns:
            Created PHIComplianceCheck instance
        """
        from api.models import PHIComplianceCheck

        result = self.check_harvest_phi_compliance(
            harvest.field_id,
            harvest.harvest_date
        )

        phi_check = PHIComplianceCheck.objects.create(
            harvest=harvest,
            status=result.status,
            applications_checked=result.applications_checked,
            warnings=result.warnings,
            earliest_safe_harvest=result.earliest_safe_harvest,
        )

        return phi_check
