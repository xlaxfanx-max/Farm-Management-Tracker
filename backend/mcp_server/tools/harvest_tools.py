"""
Harvest Planning Tools for MCP Server

Provides tools for harvest operations:
- Assess harvest readiness (PHI clearance)
- Get harvest schedule recommendations
- Estimate field yields
- Get buyer harvest summaries

Wraps the HarvestPlanningService.
"""

from typing import Optional
from datetime import date, timedelta
from mcp_server.context import get_company_id


async def assess_harvest_readiness(
    farm_id: Optional[int] = None,
    harvest_date: Optional[str] = None
) -> dict:
    """
    Assess harvest readiness for fields, checking PHI clearance.

    This is the primary "When can I harvest?" tool. Checks all fields
    (or fields on a specific farm) for PHI restrictions.

    Args:
        farm_id: Optional farm ID to filter by. If not provided,
                 checks all fields.
        harvest_date: Optional proposed harvest date (YYYY-MM-DD).
                     If not provided, checks for today.

    Returns list of fields with:
    - is_ready: Whether the field is ready for harvest
    - phi_clear: Whether PHI requirements are met
    - phi_clear_date: When the field will be clear
    - estimated_yield_bins: Estimated yield in bins
    - blocking_issues: What's preventing harvest (if any)
    - advisory_notes: Additional notes about recent applications

    Fields are sorted with ready fields first, then by PHI clear date.

    Example:
        assess_harvest_readiness()                    # All fields, today
        assess_harvest_readiness(farm_id=1)          # Farm 1 only
        assess_harvest_readiness(harvest_date='2024-03-15')  # Check for specific date
    """
    from api.services.operations.harvest_planning import HarvestPlanningService

    # Parse harvest date if provided
    proposed_date = None
    if harvest_date:
        try:
            proposed_date = date.fromisoformat(harvest_date)
        except ValueError:
            return {'error': f'Invalid date format: {harvest_date}. Use YYYY-MM-DD.'}

    company_id = get_company_id()
    service = HarvestPlanningService(company_id=company_id)

    results = service.assess_harvest_readiness(
        farm_id=farm_id,
        proposed_harvest_date=proposed_date
    )

    # Summarize results
    ready_count = sum(1 for r in results if r.is_ready)
    total_yield = sum(r.estimated_yield_bins or 0 for r in results if r.is_ready)

    return {
        'check_date': (proposed_date or date.today()).isoformat(),
        'farm_id': farm_id,
        'summary': {
            'total_fields': len(results),
            'ready_now': ready_count,
            'not_ready': len(results) - ready_count,
            'ready_yield_estimate_bins': round(total_yield, 1),
        },
        'fields': [r.to_dict() for r in results],
    }


async def get_harvest_schedule(
    farm_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    crew_size: Optional[int] = None
) -> dict:
    """
    Get recommended harvest schedule for a farm.

    Plans harvest sequence based on PHI clearance, yield estimates,
    and available crew capacity.

    Args:
        farm_id: The farm ID to plan harvest for.
        start_date: Start of planning window (YYYY-MM-DD). Default: today.
        end_date: End of planning window (YYYY-MM-DD). Default: 14 days out.
        crew_size: Available crew size. Default: 8.

    Returns:
    - schedule_period: Start/end dates and duration
    - summary: Total fields, bins, hours needed
    - crew_info: Crew capacity calculations
    - schedule: Ordered list of fields to harvest with:
        - field_id, field_name
        - recommended_date
        - priority: 'high', 'medium', 'low'
        - estimated_bins, estimated_hours
        - notes

    Example:
        get_harvest_schedule(1)                          # Default 14-day window
        get_harvest_schedule(1, start_date='2024-03-01', end_date='2024-03-15')
        get_harvest_schedule(1, crew_size=12)           # Larger crew
    """
    from api.services.operations.harvest_planning import HarvestPlanningService

    # Parse dates
    try:
        start = date.fromisoformat(start_date) if start_date else date.today()
    except ValueError:
        return {'error': f'Invalid start_date format: {start_date}. Use YYYY-MM-DD.'}

    try:
        end = date.fromisoformat(end_date) if end_date else (start + timedelta(days=14))
    except ValueError:
        return {'error': f'Invalid end_date format: {end_date}. Use YYYY-MM-DD.'}

    company_id = get_company_id()
    service = HarvestPlanningService(company_id=company_id)

    result = service.get_harvest_schedule_recommendation(
        farm_id=farm_id,
        start_date=start,
        end_date=end,
        available_crew_size=crew_size
    )

    return result


async def estimate_yield(field_id: int) -> dict:
    """
    Estimate yield for a specific field.

    Uses available data in priority order:
    1. Tree count (if available) x bins per tree
    2. Historical yields for this field
    3. Default values by crop type

    Args:
        field_id: The field ID to estimate yield for.

    Returns:
    - estimation_method: How the estimate was calculated
    - estimated_total_bins: Total estimated yield in bins
    - estimated_bins_per_acre: Yield per acre
    - confidence: Confidence level (0-1)
    - factors: Data used in calculation
    - notes: Explanation of estimation

    Example:
        estimate_yield(5)  # Get yield estimate for field 5
    """
    from api.services.operations.harvest_planning import HarvestPlanningService

    company_id = get_company_id()
    service = HarvestPlanningService(company_id=company_id)

    result = service.estimate_field_yield(field_id)
    return result.to_dict()


async def get_buyer_summary(buyer_id: int, season_year: Optional[int] = None) -> dict:
    """
    Get harvest summary for a specific buyer.

    Useful for coordinating with buyers and tracking commitments.

    Args:
        buyer_id: The buyer ID to get summary for.
        season_year: Season year to summarize. Default: current year.

    Returns:
    - buyer_name: Name of the buyer
    - season_year: Year of data
    - summary: Totals for loads, bins, revenue, avg price
    - by_field: Breakdown by field

    Example:
        get_buyer_summary(1)           # Current year summary for buyer 1
        get_buyer_summary(1, 2023)     # 2023 summary for buyer 1
    """
    from api.services.operations.harvest_planning import HarvestPlanningService

    company_id = get_company_id()
    service = HarvestPlanningService(company_id=company_id)

    result = service.get_buyer_harvest_summary(
        buyer_id=buyer_id,
        season_year=season_year
    )

    return result


# Tool definitions for MCP server registration
TOOLS = [
    {
        'function': assess_harvest_readiness,
        'name': 'assess_harvest_readiness',
        'description': 'Check which fields are ready for harvest based on PHI clearance. Answer "When can I harvest?"',
    },
    {
        'function': get_harvest_schedule,
        'name': 'get_harvest_schedule',
        'description': 'Get recommended harvest schedule for a farm considering PHI, yields, and crew capacity.',
    },
    {
        'function': estimate_yield,
        'name': 'estimate_yield',
        'description': 'Estimate yield for a field using tree counts, historical data, or crop defaults.',
    },
    {
        'function': get_buyer_summary,
        'name': 'get_buyer_summary',
        'description': 'Get harvest summary for a buyer including loads, bins, and revenue by field.',
    },
]
