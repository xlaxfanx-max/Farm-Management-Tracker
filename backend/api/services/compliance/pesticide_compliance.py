"""
Pesticide Compliance Service for California Citrus Operations.

Handles:
- Pre-application validation (registration, rates, timing)
- PHI (Pre-Harvest Interval) calculations and clearance
- REI (Restricted Entry Interval) tracking
- California restricted materials and NOI requirements
- Buffer zone compliance

California-specific regulations:
- California Food and Agricultural Code Sections 12973-12979
- Title 3, California Code of Regulations, Division 6
- County Agricultural Commissioner requirements

This service is designed to be called programmatically by both:
1. REST API endpoints (ViewSets)
2. AI agents for automated compliance checking
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple

from django.db.models import Q, Sum, Max
from django.utils import timezone

logger = logging.getLogger(__name__)


# =============================================================================
# DATA CLASSES FOR SERVICE RESULTS
# =============================================================================

@dataclass
class ComplianceIssue:
    """
    Represents a compliance issue found during validation.

    Attributes:
        severity: 'error', 'warning', or 'info'
        category: Issue category (phi, rei, rate, registration, weather, buffer, permit)
        message: Human-readable description of the issue
        blocking: If True, this issue prevents the application from proceeding
        field_name: Optional field name for form validation
        details: Optional additional details dict
    """
    severity: str  # 'error', 'warning', 'info'
    category: str  # 'phi', 'rei', 'rate', 'registration', 'weather', 'buffer', 'permit'
    message: str
    blocking: bool = False
    field_name: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


@dataclass
class ApplicationValidationResult:
    """
    Result of validating a proposed pesticide application.

    Attributes:
        is_valid: True if the application passes all required validations
        is_compliant: True if fully compliant with all regulations (no warnings)
        issues: List of blocking issues (errors)
        warnings: List of non-blocking warnings
        noi_required: True if Notice of Intent is required
        noi_deadline: Deadline for NOI submission if required
        recommended_actions: List of suggested actions to resolve issues
    """
    is_valid: bool
    is_compliant: bool
    issues: List[ComplianceIssue] = field(default_factory=list)
    warnings: List[ComplianceIssue] = field(default_factory=list)
    noi_required: bool = False
    noi_deadline: Optional[datetime] = None
    recommended_actions: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'is_valid': self.is_valid,
            'is_compliant': self.is_compliant,
            'issues': [
                {
                    'severity': i.severity,
                    'category': i.category,
                    'message': i.message,
                    'blocking': i.blocking,
                    'field_name': i.field_name,
                    'details': i.details,
                }
                for i in self.issues
            ],
            'warnings': [
                {
                    'severity': w.severity,
                    'category': w.category,
                    'message': w.message,
                    'blocking': w.blocking,
                    'field_name': w.field_name,
                    'details': w.details,
                }
                for w in self.warnings
            ],
            'noi_required': self.noi_required,
            'noi_deadline': self.noi_deadline.isoformat() if self.noi_deadline else None,
            'recommended_actions': self.recommended_actions,
        }


@dataclass
class PHIClearanceResult:
    """
    Result of PHI clearance check for a field.

    Attributes:
        field_id: Database ID of the field
        field_name: Human-readable field name
        is_clear: True if field is clear for harvest
        earliest_harvest_date: Earliest date the field can be harvested
        days_until_clear: Days until the field is clear (0 if already clear)
        recent_applications: List of recent applications affecting PHI
        blocking_applications: Applications currently blocking harvest
    """
    field_id: int
    field_name: str
    is_clear: bool
    earliest_harvest_date: date
    days_until_clear: int
    recent_applications: List[Dict[str, Any]] = field(default_factory=list)
    blocking_applications: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'field_id': self.field_id,
            'field_name': self.field_name,
            'is_clear': self.is_clear,
            'earliest_harvest_date': self.earliest_harvest_date.isoformat(),
            'days_until_clear': self.days_until_clear,
            'recent_applications': self.recent_applications,
            'blocking_applications': self.blocking_applications,
        }


@dataclass
class REIStatus:
    """
    Current REI (Restricted Entry Interval) status for a field.

    Attributes:
        field_id: Database ID of the field
        field_name: Human-readable field name
        is_clear: True if field is safe for worker entry
        rei_expires_at: DateTime when REI expires (if not clear)
        hours_until_clear: Hours until safe entry (0 if clear)
        active_applications: Applications with active REI
    """
    field_id: int
    field_name: str
    is_clear: bool
    rei_expires_at: Optional[datetime]
    hours_until_clear: float
    active_applications: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'field_id': self.field_id,
            'field_name': self.field_name,
            'is_clear': self.is_clear,
            'rei_expires_at': self.rei_expires_at.isoformat() if self.rei_expires_at else None,
            'hours_until_clear': self.hours_until_clear,
            'active_applications': self.active_applications,
        }


# =============================================================================
# MAIN SERVICE CLASS
# =============================================================================

class PesticideComplianceService:
    """
    Service for pesticide compliance checking and validation.

    This service provides comprehensive compliance checking for California
    pesticide regulations, including PHI, REI, restricted materials, and
    NOI requirements.

    Example usage:
        service = PesticideComplianceService()

        # Validate a proposed application
        result = service.validate_proposed_application(
            field_id=1,
            product_id=5,
            application_date=date.today(),
            rate_per_acre=2.5,
            application_method='Ground Spray',
            acres_treated=10.0
        )

        if result.is_valid:
            # Proceed with application
            pass
        else:
            # Handle compliance issues
            for issue in result.issues:
                print(f"Error: {issue.message}")
    """

    # California counties requiring special permits for certain materials
    PERMIT_REQUIRED_COUNTIES = {
        'Fresno', 'Kern', 'Tulare', 'Kings', 'Madera',
        'Merced', 'Stanislaus', 'San Joaquin'
    }

    # Standard NOI lead time requirements (days before application)
    NOI_LEAD_TIME_DAYS = {
        'standard': 1,       # Most restricted materials
        'fumigant': 2,       # Fumigants require 48-hour notice
        'school_buffer': 3,  # Applications near schools
    }

    def __init__(self, company_id: Optional[int] = None):
        """
        Initialize the service.

        Args:
            company_id: Optional company ID for RLS filtering
        """
        self.company_id = company_id
        self._quarantine_service = None
        self._weather_service = None

    @property
    def quarantine_service(self):
        """Lazy-load quarantine service."""
        if self._quarantine_service is None:
            from api.services.quarantine_service import CDFAQuarantineService
            self._quarantine_service = CDFAQuarantineService()
        return self._quarantine_service

    @property
    def weather_service(self):
        """Lazy-load weather service."""
        if self._weather_service is None:
            from api.weather_service import WeatherService
            self._weather_service = WeatherService()
        return self._weather_service

    # =========================================================================
    # PRIMARY VALIDATION METHODS
    # =========================================================================

    def validate_proposed_application(
        self,
        field_id: int,
        product_id: int,
        application_date: date,
        rate_per_acre: float,
        application_method: str,
        acres_treated: float,
        applicator_name: Optional[str] = None,
        applicator_license: Optional[str] = None,
        check_weather: bool = True,
        check_quarantine: bool = True,
    ) -> ApplicationValidationResult:
        """
        Comprehensive validation of a proposed pesticide application.

        Checks:
        - Product is registered for the crop
        - Rate is within label limits
        - PHI allows harvest timing
        - REI requirements
        - Weather suitability (wind, rain)
        - California restricted material status
        - NOI requirements and deadlines
        - Quarantine zone restrictions

        Args:
            field_id: ID of the field to apply to
            product_id: ID of the pesticide product
            application_date: Proposed application date
            rate_per_acre: Application rate per acre
            application_method: Method of application (e.g., 'Ground Spray')
            acres_treated: Number of acres to treat
            applicator_name: Name of applicator (required for restricted products)
            applicator_license: Applicator license number
            check_weather: Whether to check weather conditions
            check_quarantine: Whether to check quarantine zone status

        Returns:
            ApplicationValidationResult with validation status and any issues
        """
        from api.models import Field, PesticideProduct, PesticideApplication

        issues: List[ComplianceIssue] = []
        warnings: List[ComplianceIssue] = []
        recommended_actions: List[str] = []
        noi_required = False
        noi_deadline = None

        # Load field and product
        try:
            field = Field.objects.select_related('farm').get(id=field_id)
        except Field.DoesNotExist:
            issues.append(ComplianceIssue(
                severity='error',
                category='registration',
                message=f'Field with ID {field_id} not found',
                blocking=True,
                field_name='field_id'
            ))
            return ApplicationValidationResult(
                is_valid=False,
                is_compliant=False,
                issues=issues,
                warnings=warnings,
                recommended_actions=['Verify the field ID is correct']
            )

        try:
            product = PesticideProduct.objects.get(id=product_id)
        except PesticideProduct.DoesNotExist:
            issues.append(ComplianceIssue(
                severity='error',
                category='registration',
                message=f'Product with ID {product_id} not found',
                blocking=True,
                field_name='product_id'
            ))
            return ApplicationValidationResult(
                is_valid=False,
                is_compliant=False,
                issues=issues,
                warnings=warnings,
                recommended_actions=['Verify the product ID is correct']
            )

        # Check product registration status
        product_issues = self._check_product_registration(product, field)
        issues.extend([i for i in product_issues if i.blocking])
        warnings.extend([i for i in product_issues if not i.blocking])

        # Check application rate
        rate_issues = self._check_application_rate(product, rate_per_acre, field)
        issues.extend([i for i in rate_issues if i.blocking])
        warnings.extend([i for i in rate_issues if not i.blocking])

        # Check PHI implications
        phi_issues = self._check_phi_implications(field, product, application_date)
        issues.extend([i for i in phi_issues if i.blocking])
        warnings.extend([i for i in phi_issues if not i.blocking])

        # Check restricted use requirements
        restricted_issues = self._check_restricted_use_requirements(
            product, applicator_name, applicator_license
        )
        issues.extend([i for i in restricted_issues if i.blocking])
        warnings.extend([i for i in restricted_issues if not i.blocking])

        # Check NOI requirements
        noi_required, noi_deadline, noi_issues = self._check_noi_requirements(
            product, application_date, field
        )
        issues.extend([i for i in noi_issues if i.blocking])
        warnings.extend([i for i in noi_issues if not i.blocking])

        # Check buffer zone requirements
        buffer_issues = self._check_buffer_zones(product, field)
        issues.extend([i for i in buffer_issues if i.blocking])
        warnings.extend([i for i in buffer_issues if not i.blocking])

        # Check weather conditions (optional)
        if check_weather and field.has_coordinates:
            weather_issues = self._check_weather_conditions(
                field, application_date, application_method
            )
            warnings.extend(weather_issues)  # Weather is always advisory

        # Check quarantine zone restrictions (optional)
        if check_quarantine and field.has_coordinates:
            quarantine_issues = self._check_quarantine_restrictions(
                product, field
            )
            issues.extend([i for i in quarantine_issues if i.blocking])
            warnings.extend([i for i in quarantine_issues if not i.blocking])

        # Check maximum applications per season
        season_issues = self._check_season_limits(product, field, application_date)
        issues.extend([i for i in season_issues if i.blocking])
        warnings.extend([i for i in season_issues if not i.blocking])

        # Generate recommended actions
        if issues:
            for issue in issues:
                if issue.category == 'registration':
                    recommended_actions.append(
                        'Verify product is registered for use on this crop in California'
                    )
                elif issue.category == 'rate':
                    recommended_actions.append(
                        'Reduce application rate to within label limits'
                    )
                elif issue.category == 'permit':
                    recommended_actions.append(
                        'Obtain required restricted materials permit from County Ag Commissioner'
                    )

        if noi_required:
            recommended_actions.append(
                f'Submit Notice of Intent by {noi_deadline.strftime("%m/%d/%Y %H:%M")} '
                f'(at least {self.NOI_LEAD_TIME_DAYS["standard"]} day(s) before application)'
            )

        # Remove duplicates from recommendations
        recommended_actions = list(dict.fromkeys(recommended_actions))

        is_valid = len(issues) == 0
        is_compliant = is_valid and len(warnings) == 0

        logger.info(
            f"Validated application: field={field_id}, product={product_id}, "
            f"valid={is_valid}, compliant={is_compliant}, issues={len(issues)}, warnings={len(warnings)}"
        )

        return ApplicationValidationResult(
            is_valid=is_valid,
            is_compliant=is_compliant,
            issues=issues,
            warnings=warnings,
            noi_required=noi_required,
            noi_deadline=noi_deadline,
            recommended_actions=recommended_actions,
        )

    # =========================================================================
    # PHI CLEARANCE METHODS
    # =========================================================================

    def calculate_phi_clearance(
        self,
        field_id: int,
        proposed_harvest_date: Optional[date] = None,
        lookback_days: int = 90
    ) -> PHIClearanceResult:
        """
        Calculate when a field will be clear for harvest.

        Examines all applications in the specified lookback period and
        determines the earliest safe harvest date based on PHI requirements.

        Args:
            field_id: ID of the field to check
            proposed_harvest_date: Optional proposed harvest date to check against
            lookback_days: Number of days to look back for applications (default 90)

        Returns:
            PHIClearanceResult with clearance status and details
        """
        from api.models import Field, PesticideApplication

        try:
            field = Field.objects.get(id=field_id)
        except Field.DoesNotExist:
            return PHIClearanceResult(
                field_id=field_id,
                field_name='Unknown',
                is_clear=False,
                earliest_harvest_date=date.today(),
                days_until_clear=0,
                recent_applications=[],
                blocking_applications=[{
                    'error': f'Field with ID {field_id} not found'
                }]
            )

        if proposed_harvest_date is None:
            proposed_harvest_date = date.today()

        # Get recent applications
        lookback_start = date.today() - timedelta(days=lookback_days)
        applications = PesticideApplication.objects.filter(
            field_id=field_id,
            application_date__gte=lookback_start
        ).select_related('product').order_by('-application_date')

        recent_apps = []
        blocking_apps = []
        earliest_harvest = date.today()  # Start with today as the earliest

        for app in applications:
            product = app.product
            phi_days = product.phi_days if product else None

            if phi_days:
                clear_date = app.application_date + timedelta(days=phi_days)
                is_blocking = clear_date > proposed_harvest_date

                app_info = {
                    'application_id': app.id,
                    'application_date': app.application_date.isoformat(),
                    'product_name': product.product_name if product else 'Unknown',
                    'product_id': product.id if product else None,
                    'phi_days': phi_days,
                    'clear_date': clear_date.isoformat(),
                    'is_blocking': is_blocking,
                }

                recent_apps.append(app_info)

                if is_blocking:
                    blocking_apps.append(app_info)

                if clear_date > earliest_harvest:
                    earliest_harvest = clear_date
            else:
                # No PHI restriction for this product
                recent_apps.append({
                    'application_id': app.id,
                    'application_date': app.application_date.isoformat(),
                    'product_name': product.product_name if product else 'Unknown',
                    'product_id': product.id if product else None,
                    'phi_days': None,
                    'clear_date': None,
                    'is_blocking': False,
                })

        # If earliest harvest is in the past, use today
        if earliest_harvest < date.today():
            earliest_harvest = date.today()

        is_clear = earliest_harvest <= proposed_harvest_date
        days_until_clear = max(0, (earliest_harvest - date.today()).days)

        return PHIClearanceResult(
            field_id=field_id,
            field_name=field.name,
            is_clear=is_clear,
            earliest_harvest_date=earliest_harvest,
            days_until_clear=days_until_clear,
            recent_applications=recent_apps,
            blocking_applications=blocking_apps,
        )

    def calculate_phi_for_all_fields(
        self,
        farm_id: Optional[int] = None,
        proposed_harvest_date: Optional[date] = None,
    ) -> List[PHIClearanceResult]:
        """
        Calculate PHI clearance for all fields (optionally filtered by farm).

        Args:
            farm_id: Optional farm ID to filter by
            proposed_harvest_date: Optional proposed harvest date

        Returns:
            List of PHIClearanceResult for each field
        """
        from api.models import Field

        queryset = Field.objects.filter(active=True)

        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        if self.company_id:
            queryset = queryset.filter(farm__company_id=self.company_id)

        results = []
        for field in queryset:
            result = self.calculate_phi_clearance(
                field_id=field.id,
                proposed_harvest_date=proposed_harvest_date
            )
            results.append(result)

        return results

    # =========================================================================
    # REI TRACKING METHODS
    # =========================================================================

    def get_rei_status(
        self,
        field_id: int,
        check_datetime: Optional[datetime] = None
    ) -> REIStatus:
        """
        Get current REI (Restricted Entry Interval) status for a field.

        Args:
            field_id: ID of the field to check
            check_datetime: DateTime to check (default: now)

        Returns:
            REIStatus with current entry restriction status
        """
        from api.models import Field, PesticideApplication

        try:
            field = Field.objects.get(id=field_id)
        except Field.DoesNotExist:
            return REIStatus(
                field_id=field_id,
                field_name='Unknown',
                is_clear=False,
                rei_expires_at=None,
                hours_until_clear=0,
                active_applications=[{
                    'error': f'Field with ID {field_id} not found'
                }]
            )

        if check_datetime is None:
            check_datetime = timezone.now()

        # Get applications from the last 7 days (max typical REI)
        lookback = check_datetime - timedelta(days=7)
        applications = PesticideApplication.objects.filter(
            field_id=field_id,
            application_date__gte=lookback.date()
        ).select_related('product').order_by('-application_date')

        active_apps = []
        latest_rei_expiry = None

        for app in applications:
            product = app.product
            if not product:
                continue

            # Calculate REI expiry time
            rei_hours = product.get_rei_display_hours()
            if rei_hours:
                # Combine application date and end time
                if app.end_time:
                    app_datetime = datetime.combine(app.application_date, app.end_time)
                    app_datetime = timezone.make_aware(app_datetime) if timezone.is_naive(app_datetime) else app_datetime
                else:
                    # Assume end of day if no end time
                    app_datetime = datetime.combine(
                        app.application_date,
                        datetime.max.time().replace(microsecond=0)
                    )
                    app_datetime = timezone.make_aware(app_datetime)

                rei_expiry = app_datetime + timedelta(hours=float(rei_hours))

                if rei_expiry > check_datetime:
                    active_apps.append({
                        'application_id': app.id,
                        'application_date': app.application_date.isoformat(),
                        'product_name': product.product_name,
                        'product_id': product.id,
                        'rei_hours': float(rei_hours),
                        'rei_expires_at': rei_expiry.isoformat(),
                    })

                    if latest_rei_expiry is None or rei_expiry > latest_rei_expiry:
                        latest_rei_expiry = rei_expiry

        is_clear = len(active_apps) == 0
        hours_until_clear = 0.0

        if latest_rei_expiry:
            delta = latest_rei_expiry - check_datetime
            hours_until_clear = max(0.0, delta.total_seconds() / 3600)

        return REIStatus(
            field_id=field_id,
            field_name=field.name,
            is_clear=is_clear,
            rei_expires_at=latest_rei_expiry,
            hours_until_clear=round(hours_until_clear, 1),
            active_applications=active_apps,
        )

    # =========================================================================
    # NOI (NOTICE OF INTENT) METHODS
    # =========================================================================

    def get_noi_requirements(
        self,
        product_id: int,
        application_date: date,
        county: str
    ) -> Dict[str, Any]:
        """
        Determine NOI requirements for California restricted materials.

        Args:
            product_id: ID of the pesticide product
            application_date: Planned application date
            county: County where application will occur

        Returns:
            Dictionary with NOI requirements:
            - required: bool
            - deadline: datetime (if required)
            - lead_time_hours: int
            - reason: str
            - submission_info: dict with submission details
        """
        from api.models import PesticideProduct

        try:
            product = PesticideProduct.objects.get(id=product_id)
        except PesticideProduct.DoesNotExist:
            return {
                'required': False,
                'error': f'Product with ID {product_id} not found'
            }

        required = False
        reason = None
        lead_time_days = self.NOI_LEAD_TIME_DAYS['standard']

        # Check if NOI is required
        if product.restricted_use:
            required = True
            reason = 'Restricted Use Pesticide (RUP)'

        if product.is_fumigant:
            required = True
            reason = 'Fumigant application'
            lead_time_days = self.NOI_LEAD_TIME_DAYS['fumigant']

        if not required:
            return {
                'required': False,
                'reason': 'Product does not require NOI'
            }

        # Calculate deadline
        deadline = datetime.combine(
            application_date - timedelta(days=lead_time_days),
            datetime.min.time()
        )
        deadline = timezone.make_aware(deadline)

        return {
            'required': True,
            'deadline': deadline.isoformat(),
            'deadline_date': (application_date - timedelta(days=lead_time_days)).isoformat(),
            'lead_time_days': lead_time_days,
            'lead_time_hours': lead_time_days * 24,
            'reason': reason,
            'product_name': product.product_name,
            'submission_info': {
                'submit_to': f'{county} County Agricultural Commissioner',
                'methods': ['Online portal', 'Fax', 'In-person'],
                'required_information': [
                    'Operator identification',
                    'Property location (APN or address)',
                    'Date and time of application',
                    'Product EPA registration number',
                    'Application rate and total amount',
                    'Acres to be treated',
                    'Commodity/crop',
                ]
            }
        }

    # =========================================================================
    # PRODUCT RESTRICTIONS METHODS
    # =========================================================================

    def check_product_restrictions(
        self,
        product_id: int,
        field_id: int,
        application_date: date
    ) -> List[ComplianceIssue]:
        """
        Check all restrictions for a product on a specific field.

        Includes:
        - Label restrictions
        - Quarantine zones
        - Buffer zones
        - Seasonal restrictions
        - Maximum applications per season

        Args:
            product_id: ID of the pesticide product
            field_id: ID of the field
            application_date: Proposed application date

        Returns:
            List of ComplianceIssue objects
        """
        from api.models import Field, PesticideProduct

        issues = []

        try:
            product = PesticideProduct.objects.get(id=product_id)
            field = Field.objects.select_related('farm').get(id=field_id)
        except (PesticideProduct.DoesNotExist, Field.DoesNotExist) as e:
            issues.append(ComplianceIssue(
                severity='error',
                category='registration',
                message=str(e),
                blocking=True
            ))
            return issues

        # Check product status
        if product.product_status != 'active':
            issues.append(ComplianceIssue(
                severity='error',
                category='registration',
                message=f'Product is {product.product_status} and cannot be used',
                blocking=True
            ))

        # Check California registration
        if not product.active_status_california:
            issues.append(ComplianceIssue(
                severity='error',
                category='registration',
                message='Product is not registered for use in California',
                blocking=True
            ))

        # Check buffer zones
        issues.extend(self._check_buffer_zones(product, field))

        # Check season limits
        issues.extend(self._check_season_limits(product, field, application_date))

        # Check quarantine restrictions
        if field.has_coordinates:
            issues.extend(self._check_quarantine_restrictions(product, field))

        return issues

    # =========================================================================
    # PRIVATE HELPER METHODS
    # =========================================================================

    def _check_product_registration(
        self,
        product: 'PesticideProduct',
        field: 'Field'
    ) -> List[ComplianceIssue]:
        """Check product registration and crop compatibility."""
        issues = []

        # Check California registration
        if not product.active_status_california:
            issues.append(ComplianceIssue(
                severity='error',
                category='registration',
                message=f'{product.product_name} is not registered for use in California',
                blocking=True
            ))

        # Check product status
        if product.product_status != 'active':
            issues.append(ComplianceIssue(
                severity='error',
                category='registration',
                message=f'{product.product_name} status is "{product.product_status}" - cannot be used',
                blocking=True
            ))

        # Check crop compatibility (if approved_crops is populated)
        if product.approved_crops and field.current_crop:
            crop_lower = field.current_crop.lower()
            approved = product.approved_crops.lower()

            # Simple check - in production, this would be more sophisticated
            if crop_lower not in approved and 'citrus' not in approved:
                issues.append(ComplianceIssue(
                    severity='warning',
                    category='registration',
                    message=f'{product.product_name} may not be labeled for {field.current_crop}. '
                           f'Verify label before application.',
                    blocking=False,
                    details={'approved_crops': product.approved_crops}
                ))

        return issues

    def _check_application_rate(
        self,
        product: 'PesticideProduct',
        rate_per_acre: float,
        field: 'Field'
    ) -> List[ComplianceIssue]:
        """Check if application rate is within label limits."""
        issues = []

        if product.max_rate_per_application:
            max_rate = float(product.max_rate_per_application)

            if rate_per_acre > max_rate:
                issues.append(ComplianceIssue(
                    severity='error',
                    category='rate',
                    message=f'Application rate ({rate_per_acre} {product.max_rate_unit}) exceeds '
                           f'maximum label rate ({max_rate} {product.max_rate_unit})',
                    blocking=True,
                    field_name='rate_per_acre',
                    details={
                        'requested_rate': rate_per_acre,
                        'max_rate': max_rate,
                        'unit': product.max_rate_unit
                    }
                ))
            elif rate_per_acre > max_rate * 0.9:
                issues.append(ComplianceIssue(
                    severity='warning',
                    category='rate',
                    message=f'Application rate is close to maximum label rate '
                           f'({rate_per_acre}/{max_rate} {product.max_rate_unit})',
                    blocking=False
                ))

        return issues

    def _check_phi_implications(
        self,
        field: 'Field',
        product: 'PesticideProduct',
        application_date: date
    ) -> List[ComplianceIssue]:
        """Check PHI implications of the application."""
        issues = []

        if not product.phi_days:
            return issues

        # Calculate when harvest would be allowed
        earliest_harvest = application_date + timedelta(days=product.phi_days)

        issues.append(ComplianceIssue(
            severity='info',
            category='phi',
            message=f'PHI of {product.phi_days} days. Earliest harvest: {earliest_harvest.strftime("%m/%d/%Y")}',
            blocking=False,
            details={
                'phi_days': product.phi_days,
                'earliest_harvest_date': earliest_harvest.isoformat()
            }
        ))

        return issues

    def _check_restricted_use_requirements(
        self,
        product: 'PesticideProduct',
        applicator_name: Optional[str],
        applicator_license: Optional[str]
    ) -> List[ComplianceIssue]:
        """Check requirements for restricted use products."""
        issues = []

        if product.restricted_use or product.is_fumigant:
            if not applicator_name:
                issues.append(ComplianceIssue(
                    severity='error',
                    category='permit',
                    message='Restricted Use Pesticide requires licensed applicator name',
                    blocking=True,
                    field_name='applicator_name'
                ))

            if not applicator_license:
                issues.append(ComplianceIssue(
                    severity='warning',
                    category='permit',
                    message='Applicator license number recommended for restricted materials',
                    blocking=False,
                    field_name='applicator_license'
                ))

        return issues

    def _check_noi_requirements(
        self,
        product: 'PesticideProduct',
        application_date: date,
        field: 'Field'
    ) -> Tuple[bool, Optional[datetime], List[ComplianceIssue]]:
        """Check Notice of Intent requirements."""
        issues = []
        required = False
        deadline = None

        if product.restricted_use or product.is_fumigant:
            required = True
            lead_time = self.NOI_LEAD_TIME_DAYS['fumigant'] if product.is_fumigant else self.NOI_LEAD_TIME_DAYS['standard']
            deadline = datetime.combine(
                application_date - timedelta(days=lead_time),
                datetime.min.time()
            )
            deadline = timezone.make_aware(deadline)

            if deadline < timezone.now():
                issues.append(ComplianceIssue(
                    severity='warning',
                    category='permit',
                    message=f'NOI deadline has passed. Submit NOI immediately if not already done.',
                    blocking=False,
                    details={
                        'deadline': deadline.isoformat(),
                        'lead_time_days': lead_time
                    }
                ))

        return required, deadline, issues

    def _check_buffer_zones(
        self,
        product: 'PesticideProduct',
        field: 'Field'
    ) -> List[ComplianceIssue]:
        """Check buffer zone requirements."""
        issues = []

        if product.buffer_zone_required:
            issues.append(ComplianceIssue(
                severity='warning',
                category='buffer',
                message=f'{product.product_name} requires {product.buffer_zone_feet or "specified"} ft buffer zone',
                blocking=False,
                details={
                    'buffer_feet': product.buffer_zone_feet
                }
            ))

        if product.endangered_species_restrictions:
            issues.append(ComplianceIssue(
                severity='warning',
                category='buffer',
                message='Product has endangered species restrictions. Check EPA Bulletins Live! Two.',
                blocking=False
            ))

        return issues

    def _check_weather_conditions(
        self,
        field: 'Field',
        application_date: date,
        application_method: str
    ) -> List[ComplianceIssue]:
        """Check weather conditions for spray operations."""
        issues = []

        # Only check if application is today or tomorrow
        days_until = (application_date - date.today()).days
        if days_until > 1:
            return issues

        try:
            lat = float(field.gps_latitude)
            lon = float(field.gps_longitude)
            weather = self.weather_service.get_current_weather(lat, lon)
            assessment = self.weather_service.assess_spray_conditions(weather)

            if assessment.get('rating') == 'poor':
                issues.append(ComplianceIssue(
                    severity='warning',
                    category='weather',
                    message='Current weather conditions are poor for spraying. '
                           f"Score: {assessment.get('score', 0)}/100",
                    blocking=False,
                    details=assessment.get('factors', {})
                ))
            elif assessment.get('rating') == 'fair':
                issues.append(ComplianceIssue(
                    severity='info',
                    category='weather',
                    message=f"Weather conditions are fair. Score: {assessment.get('score', 0)}/100",
                    blocking=False,
                    details=assessment.get('factors', {})
                ))
        except Exception as e:
            logger.warning(f"Failed to check weather conditions: {e}")

        return issues

    def _check_quarantine_restrictions(
        self,
        product: 'PesticideProduct',
        field: 'Field'
    ) -> List[ComplianceIssue]:
        """Check quarantine zone restrictions."""
        issues = []

        try:
            lat = float(field.gps_latitude)
            lon = float(field.gps_longitude)
            quarantine_status = self.quarantine_service.check_hlb_quarantine(lat, lon)

            if quarantine_status.get('in_quarantine_zone'):
                issues.append(ComplianceIssue(
                    severity='info',
                    category='permit',
                    message=f"Field is in HLB quarantine zone: {quarantine_status.get('zone_name', 'Unknown')}. "
                           f"Verify product is approved for quarantine area use.",
                    blocking=False,
                    details=quarantine_status
                ))
        except Exception as e:
            logger.warning(f"Failed to check quarantine status: {e}")

        return issues

    def _check_season_limits(
        self,
        product: 'PesticideProduct',
        field: 'Field',
        application_date: date
    ) -> List[ComplianceIssue]:
        """
        Check maximum applications per season.

        Uses the field's season template (or crop's default) to determine
        the correct season boundaries. This properly handles:
        - Citrus: Oct-Sep seasons
        - Deciduous/Nuts: Calendar year
        - Row crops: Calendar year or per-cycle
        """
        issues = []

        if not product.max_applications_per_season:
            return issues

        from api.models import PesticideApplication
        from api.services.season_service import SeasonService

        # Get the correct season for this field based on crop type
        service = SeasonService()
        season = service.get_current_season(
            field_id=field.id,
            target_date=application_date
        )

        season_start = season.start_date
        season_end = season.end_date

        # Count existing applications this season
        existing_count = PesticideApplication.objects.filter(
            field=field,
            product=product,
            application_date__gte=season_start,
            application_date__lte=season_end
        ).count()

        if existing_count >= product.max_applications_per_season:
            issues.append(ComplianceIssue(
                severity='error',
                category='rate',
                message=f'Maximum applications per season ({product.max_applications_per_season}) '
                       f'already reached for {product.product_name} on this field',
                blocking=True,
                details={
                    'max_allowed': product.max_applications_per_season,
                    'current_count': existing_count,
                    'season': season.label,
                    'season_start': season_start.isoformat(),
                    'season_end': season_end.isoformat(),
                }
            ))
        elif existing_count >= product.max_applications_per_season - 1:
            issues.append(ComplianceIssue(
                severity='warning',
                category='rate',
                message=f'This will be the last allowed application of {product.product_name} '
                       f'on this field for the {season.label} season',
                blocking=False,
                details={
                    'max_allowed': product.max_applications_per_season,
                    'current_count': existing_count,
                    'remaining_after': 0,
                    'season': season.label,
                }
            ))

        return issues
