"""
Pesticide Compliance Tools for MCP Server

Provides tools for pesticide compliance checking:
- PHI (Pre-Harvest Interval) status
- REI (Restricted Entry Interval) status
- Application validation
- Product restrictions
- NOI (Notice of Intent) requirements

Wraps the PesticideComplianceService.
"""

from typing import Optional
from datetime import date, datetime
from mcp_server.context import get_company_id


async def get_phi_status(
    field_id: int,
    harvest_date: Optional[str] = None
) -> dict:
    """
    Check Pre-Harvest Interval (PHI) status for a field.

    Determines when a field will be clear for harvest based on
    recent pesticide applications.

    Args:
        field_id: The field ID to check.
        harvest_date: Optional proposed harvest date (YYYY-MM-DD).
                     If not provided, checks against today.

    Returns:
    - is_clear: Whether field is clear for harvest
    - earliest_harvest_date: When the field will be clear
    - days_until_clear: Days remaining (0 if already clear)
    - recent_applications: List of recent applications with PHI info
    - blocking_applications: Applications currently blocking harvest

    Example:
        get_phi_status(5)                          # Is field 5 clear today?
        get_phi_status(5, '2024-03-15')           # Will it be clear by March 15?
    """
    from api.services.compliance.pesticide_compliance import PesticideComplianceService

    # Parse harvest date if provided
    proposed_date = None
    if harvest_date:
        try:
            proposed_date = date.fromisoformat(harvest_date)
        except ValueError:
            return {'error': f'Invalid date format: {harvest_date}. Use YYYY-MM-DD.'}

    company_id = get_company_id()
    service = PesticideComplianceService(company_id=company_id)

    result = service.calculate_phi_clearance(
        field_id=field_id,
        proposed_harvest_date=proposed_date
    )

    return result.to_dict()


async def get_rei_status(field_id: int) -> dict:
    """
    Check Restricted Entry Interval (REI) status for a field.

    Determines if workers can safely enter the field based on
    recent pesticide applications.

    Args:
        field_id: The field ID to check.

    Returns:
    - is_clear: Whether field is safe for worker entry
    - rei_expires_at: When REI restrictions expire (if not clear)
    - hours_until_clear: Hours until safe entry (0 if clear)
    - active_applications: Applications with active REI

    This is critical for worker safety - always check before
    sending workers into a recently sprayed field.

    Example:
        get_rei_status(5)  # Can workers enter field 5 now?
    """
    from api.services.compliance.pesticide_compliance import PesticideComplianceService

    company_id = get_company_id()
    service = PesticideComplianceService(company_id=company_id)

    result = service.get_rei_status(field_id=field_id)
    return result.to_dict()


async def validate_application(
    field_id: int,
    product_id: int,
    application_date: str,
    rate_per_acre: float,
    application_method: str,
    acres_treated: float,
    applicator_name: Optional[str] = None,
    applicator_license: Optional[str] = None,
    check_weather: bool = True,
    check_quarantine: bool = True
) -> dict:
    """
    Validate a proposed pesticide application for compliance.

    Comprehensive check including:
    - Product registration for crop
    - Application rate within label limits
    - PHI implications for harvest timing
    - REI requirements
    - California restricted material requirements
    - NOI requirements and deadlines
    - Weather suitability (optional)
    - Quarantine zone restrictions (optional)
    - Maximum applications per season

    Args:
        field_id: The field to apply to.
        product_id: The pesticide product ID.
        application_date: Proposed date (YYYY-MM-DD).
        rate_per_acre: Application rate per acre.
        application_method: Method (e.g., 'Ground Spray', 'Aerial').
        acres_treated: Number of acres to treat.
        applicator_name: Name of applicator (required for restricted products).
        applicator_license: Applicator license number.
        check_weather: Whether to check weather conditions (default True).
        check_quarantine: Whether to check quarantine zones (default True).

    Returns:
    - is_valid: Whether application can proceed (no blocking issues)
    - is_compliant: Whether fully compliant (no warnings either)
    - issues: List of blocking issues that prevent application
    - warnings: List of non-blocking warnings
    - noi_required: Whether Notice of Intent is required
    - noi_deadline: Deadline for NOI submission
    - recommended_actions: Steps to resolve issues

    Example:
        validate_application(
            field_id=5,
            product_id=10,
            application_date='2024-03-01',
            rate_per_acre=2.5,
            application_method='Ground Spray',
            acres_treated=40.0
        )
    """
    from api.services.compliance.pesticide_compliance import PesticideComplianceService

    # Parse application date
    try:
        app_date = date.fromisoformat(application_date)
    except ValueError:
        return {'error': f'Invalid date format: {application_date}. Use YYYY-MM-DD.'}

    company_id = get_company_id()
    service = PesticideComplianceService(company_id=company_id)

    result = service.validate_proposed_application(
        field_id=field_id,
        product_id=product_id,
        application_date=app_date,
        rate_per_acre=rate_per_acre,
        application_method=application_method,
        acres_treated=acres_treated,
        applicator_name=applicator_name,
        applicator_license=applicator_license,
        check_weather=check_weather,
        check_quarantine=check_quarantine,
    )

    return result.to_dict()


async def check_product_restrictions(
    product_id: int,
    field_id: int,
    application_date: str
) -> dict:
    """
    Check all restrictions for a product on a specific field.

    Includes:
    - Label restrictions
    - Quarantine zone restrictions
    - Buffer zone requirements
    - Seasonal restrictions
    - Maximum applications per season

    Args:
        product_id: The pesticide product ID.
        field_id: The field ID.
        application_date: Proposed date (YYYY-MM-DD).

    Returns list of restrictions/issues, each with:
    - severity: 'error', 'warning', or 'info'
    - category: Type of restriction
    - message: Description
    - blocking: Whether this prevents application
    - details: Additional details

    Example:
        check_product_restrictions(10, 5, '2024-03-01')
    """
    from api.services.compliance.pesticide_compliance import PesticideComplianceService

    # Parse date
    try:
        app_date = date.fromisoformat(application_date)
    except ValueError:
        return {'error': f'Invalid date format: {application_date}. Use YYYY-MM-DD.'}

    company_id = get_company_id()
    service = PesticideComplianceService(company_id=company_id)

    issues = service.check_product_restrictions(
        product_id=product_id,
        field_id=field_id,
        application_date=app_date
    )

    blocking = [i for i in issues if i.blocking]
    warnings = [i for i in issues if not i.blocking]

    return {
        'product_id': product_id,
        'field_id': field_id,
        'application_date': application_date,
        'has_blocking_issues': len(blocking) > 0,
        'total_issues': len(issues),
        'issues': [
            {
                'severity': i.severity,
                'category': i.category,
                'message': i.message,
                'blocking': i.blocking,
                'details': i.details,
            }
            for i in issues
        ],
    }


async def get_noi_requirements(
    product_id: int,
    application_date: str,
    county: str
) -> dict:
    """
    Get Notice of Intent (NOI) requirements for California restricted materials.

    NOI is required for restricted use pesticides and fumigants.
    This tool tells you if NOI is required and the submission deadline.

    Args:
        product_id: The pesticide product ID.
        application_date: Planned application date (YYYY-MM-DD).
        county: County where application will occur (e.g., 'Tulare').

    Returns:
    - required: Whether NOI is required
    - deadline: Submission deadline (if required)
    - lead_time_days: How many days before application
    - reason: Why NOI is required
    - submission_info: Where and how to submit

    Example:
        get_noi_requirements(10, '2024-03-01', 'Tulare')
    """
    from api.services.compliance.pesticide_compliance import PesticideComplianceService

    # Parse date
    try:
        app_date = date.fromisoformat(application_date)
    except ValueError:
        return {'error': f'Invalid date format: {application_date}. Use YYYY-MM-DD.'}

    company_id = get_company_id()
    service = PesticideComplianceService(company_id=company_id)

    result = service.get_noi_requirements(
        product_id=product_id,
        application_date=app_date,
        county=county
    )

    return result


# Tool definitions for MCP server registration
TOOLS = [
    {
        'function': get_phi_status,
        'name': 'get_phi_status',
        'description': 'Check Pre-Harvest Interval status for a field. When can we harvest?',
    },
    {
        'function': get_rei_status,
        'name': 'get_rei_status',
        'description': 'Check Restricted Entry Interval status for a field. Can workers enter safely?',
    },
    {
        'function': validate_application,
        'name': 'validate_application',
        'description': 'Validate a proposed pesticide application for compliance (rates, registration, PHI, REI, NOI, etc.).',
    },
    {
        'function': check_product_restrictions,
        'name': 'check_product_restrictions',
        'description': 'Check all restrictions for a product on a field (quarantine, buffer zones, season limits).',
    },
    {
        'function': get_noi_requirements,
        'name': 'get_noi_requirements',
        'description': 'Get Notice of Intent requirements for restricted materials in California.',
    },
]
