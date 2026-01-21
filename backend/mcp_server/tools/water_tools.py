"""
Water Compliance Tools for MCP Server

Provides tools for water management and SGMA compliance:
- Allocation status tracking
- Usage forecasting
- Well compliance checking
- SGMA report generation

Wraps the WaterComplianceService.
"""

from typing import Optional
from mcp_server.context import get_company_id


async def get_water_allocation(
    farm_id: Optional[int] = None,
    water_year: Optional[str] = None
) -> dict:
    """
    Get current water allocation status for wells.

    Tracks water usage against SGMA allocations.

    Args:
        farm_id: Optional farm ID to filter by. If not provided,
                 shows all wells.
        water_year: Water year to check (e.g., '2024-2025').
                   If not provided, uses current water year.
                   Note: Water year runs Oct 1 to Sep 30.

    Returns list of wells with:
    - allocated_af: Total allocated acre-feet
    - used_af: Total extracted acre-feet
    - remaining_af: Remaining allocation
    - percent_used: Percentage of allocation used
    - projected_annual_use: Projected total use at current rate
    - on_track: Whether usage is sustainable
    - warnings: Any alerts about usage

    Example:
        get_water_allocation()                    # All wells, current year
        get_water_allocation(farm_id=1)          # Farm 1 wells only
        get_water_allocation(water_year='2023-2024')  # Previous year
    """
    from api.services.compliance.water_compliance import WaterComplianceService

    company_id = get_company_id()
    service = WaterComplianceService(company_id=company_id)

    results = service.get_allocation_status(
        farm_id=farm_id,
        water_year=water_year
    )

    # Summarize
    total_allocated = sum(r.allocated_af for r in results)
    total_used = sum(r.used_af for r in results)
    wells_over = sum(1 for r in results if not r.on_track)

    return {
        'water_year': water_year or 'current',
        'farm_id': farm_id,
        'summary': {
            'total_wells': len(results),
            'total_allocated_af': round(total_allocated, 2),
            'total_used_af': round(total_used, 2),
            'total_remaining_af': round(total_allocated - total_used, 2),
            'percent_used': round(total_used / total_allocated * 100, 1) if total_allocated else 0,
            'wells_over_allocation': wells_over,
        },
        'wells': [r.to_dict() for r in results],
    }


async def forecast_water_usage(
    farm_id: int,
    months_ahead: int = 6
) -> dict:
    """
    Forecast water usage based on historical patterns.

    Projects future water usage to help plan for allocation compliance.

    Args:
        farm_id: The farm ID to forecast for.
        months_ahead: Number of months to forecast (1-12, default 6).

    Returns for each well:
    - current_ytd_use: Year-to-date extraction
    - projected_annual_use: Projected total for the water year
    - allocated_af: Allocation for comparison
    - projected_remaining: Expected remaining at year end
    - forecast_confidence: How reliable the forecast is
    - monthly_projections: Month-by-month projections
    - notes: Warnings about over-allocation risk

    Example:
        forecast_water_usage(1)        # 6-month forecast for farm 1
        forecast_water_usage(1, 12)    # Full year forecast
    """
    from api.services.compliance.water_compliance import WaterComplianceService

    # Validate months
    months_ahead = min(max(1, months_ahead), 12)

    company_id = get_company_id()
    service = WaterComplianceService(company_id=company_id)

    results = service.forecast_water_usage(
        farm_id=farm_id,
        months_ahead=months_ahead
    )

    # Check for over-allocation projections
    at_risk = [r for r in results if r.projected_remaining < 0]

    return {
        'farm_id': farm_id,
        'forecast_months': months_ahead,
        'summary': {
            'total_wells': len(results),
            'wells_at_risk': len(at_risk),
            'at_risk_wells': [r.water_source_name for r in at_risk],
        },
        'forecasts': [r.to_dict() for r in results],
    }


async def check_well_compliance(farm_id: Optional[int] = None) -> dict:
    """
    Check compliance status for all wells.

    Identifies violations including:
    - Over-allocation (extraction exceeds allocation)
    - Missing meter readings
    - Overdue meter calibrations
    - Missing calibration records

    Args:
        farm_id: Optional farm ID to filter by. If not provided,
                 checks all wells.

    Returns:
    - is_compliant: Whether all wells are compliant (no errors)
    - wells_checked: Number of wells checked
    - summary: Count of errors, warnings, info items
    - violations: Detailed list of all violations

    Example:
        check_well_compliance()          # Check all wells
        check_well_compliance(farm_id=1) # Check farm 1 wells only
    """
    from api.services.compliance.water_compliance import WaterComplianceService

    company_id = get_company_id()
    service = WaterComplianceService(company_id=company_id)

    result = service.check_all_wells_compliance(farm_id=farm_id)
    return result


async def get_sgma_report(farm_id: int, report_period: str = 'current') -> dict:
    """
    Generate data for SGMA semi-annual reporting.

    SGMA requires semi-annual extraction reporting to the GSA:
    - H1: October - March
    - H2: April - September

    Args:
        farm_id: The farm ID to generate report for.
        report_period: Which period to report:
            - 'H1': October - March
            - 'H2': April - September
            - 'current': Current reporting period (default)

    Returns:
    - farm_name: Farm name for report
    - report_period: H1 or H2
    - water_year: Water year being reported
    - period_start, period_end: Report period dates
    - wells: List of wells with extraction data
    - total_extraction_af: Total extraction for period
    - total_allocation_af: Period allocation
    - compliance_status: 'compliant', 'over_allocation', etc.
    - notes: Any compliance issues or warnings

    Example:
        get_sgma_report(1)              # Current period for farm 1
        get_sgma_report(1, 'H1')        # H1 report for farm 1
        get_sgma_report(1, 'H2')        # H2 report for farm 1
    """
    from api.services.compliance.water_compliance import (
        WaterComplianceService,
        get_current_reporting_period
    )

    # Determine report period
    if report_period == 'current':
        period_info = get_current_reporting_period()
        report_period = period_info['period']
    elif report_period not in ('H1', 'H2'):
        return {'error': f'Invalid report_period: {report_period}. Use "H1", "H2", or "current".'}

    company_id = get_company_id()
    service = WaterComplianceService(company_id=company_id)

    result = service.generate_sgma_report_data(
        farm_id=farm_id,
        report_period=report_period
    )

    return result.to_dict()


# Tool definitions for MCP server registration
TOOLS = [
    {
        'function': get_water_allocation,
        'name': 'get_water_allocation',
        'description': 'Get water allocation status for wells. Track usage vs SGMA allocations.',
    },
    {
        'function': forecast_water_usage,
        'name': 'forecast_water_usage',
        'description': 'Forecast water usage based on historical patterns. Identify over-allocation risk.',
    },
    {
        'function': check_well_compliance,
        'name': 'check_well_compliance',
        'description': 'Check compliance for all wells (over-allocation, missing readings, calibration).',
    },
    {
        'function': get_sgma_report,
        'name': 'get_sgma_report',
        'description': 'Generate SGMA semi-annual report data for a farm (H1: Oct-Mar, H2: Apr-Sep).',
    },
]
