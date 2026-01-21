"""
Spray Planning Tools for MCP Server

Provides tools for spray operation planning:
- Check current spray conditions (go/no-go decision)
- Find suitable spray windows in the forecast
- Recommend optimal application timing

Wraps the SprayPlanningService.
"""

from typing import Optional
from datetime import datetime
from mcp_server.context import get_company_id


async def check_spray_conditions(farm_id: int) -> dict:
    """
    Check if current weather conditions are suitable for spraying.

    This is the primary "Can I spray today?" tool. Returns a go/no-go
    recommendation with detailed reasoning.

    Args:
        farm_id: The farm ID to check conditions for.

    Returns:
    - recommended: bool - Whether spraying is recommended now
    - current_rating: 'good', 'fair', or 'poor'
    - current_score: 0-100 score
    - current_conditions: Temperature, wind, humidity, etc.
    - issues: List of problems preventing spray (if any)
    - suggestions: Recommendations for better timing
    - optimal_windows: Top 3 upcoming spray windows

    Example:
        check_spray_conditions(1)  # "Can I spray on farm 1 today?"
    """
    from api.services.operations.spray_planning import SprayPlanningService

    company_id = get_company_id()
    service = SprayPlanningService(company_id=company_id)

    result = service.evaluate_spray_conditions(farm_id)
    return result.to_dict()


async def find_spray_windows(
    farm_id: int,
    days_ahead: int = 7,
    application_method: str = 'ground',
    min_window_hours: float = 2.0
) -> dict:
    """
    Find suitable spray windows in the upcoming forecast.

    Use this to plan spray operations in advance by identifying
    periods with good conditions.

    Args:
        farm_id: The farm ID to find windows for.
        days_ahead: How many days to look ahead (1-7, default 7).
        application_method: 'ground' or 'aerial'. Aerial has stricter
                           wind requirements.
        min_window_hours: Minimum window duration to report (default 2.0).

    Returns list of spray windows, each with:
    - start_datetime, end_datetime, duration_hours
    - rating: 'good' or 'fair'
    - score: 0-100
    - confidence: How reliable the forecast is (decreases with distance)
    - conditions: Weather details for that period
    - notes: Advisory notes

    Windows are sorted by score (best first).

    Example:
        find_spray_windows(1)                    # Next 7 days, ground spray
        find_spray_windows(1, days_ahead=3)     # Next 3 days
        find_spray_windows(1, application_method='aerial')  # Aerial application
    """
    from api.services.operations.spray_planning import SprayPlanningService

    # Validate parameters
    days_ahead = min(max(1, days_ahead), 7)
    if application_method not in ('ground', 'aerial'):
        application_method = 'ground'

    company_id = get_company_id()
    service = SprayPlanningService(company_id=company_id)

    windows = service.find_spray_windows(
        farm_id=farm_id,
        days_ahead=days_ahead,
        application_method=application_method,
        min_window_hours=min_window_hours
    )

    return {
        'farm_id': farm_id,
        'days_ahead': days_ahead,
        'application_method': application_method,
        'windows': [w.to_dict() for w in windows],
        'window_count': len(windows),
        'best_window': windows[0].to_dict() if windows else None,
    }


async def recommend_spray_timing(
    field_id: int,
    product_id: int,
    urgency: str = 'normal'
) -> dict:
    """
    Recommend optimal application timing for a specific product and field.

    This tool considers multiple factors:
    - Weather windows (good spray conditions)
    - PHI constraints (if harvest is approaching)
    - REI considerations (worker re-entry restrictions)
    - Product-specific timing recommendations

    Args:
        field_id: The field ID to apply to.
        product_id: The pesticide product ID.
        urgency: How urgent is the application?
            - 'urgent': Find earliest possible time (ASAP)
            - 'normal': Within the next few days (default)
            - 'flexible': Best overall conditions, can wait

    Returns:
    - recommended_datetime: Best time to apply
    - alternative_times: Other good options
    - phi_constraint: PHI implications of this application
    - rei_consideration: REI/worker scheduling info
    - weather_windows: Available spray windows
    - notes: Timing recommendations

    Example:
        recommend_spray_timing(5, 10)                  # Normal urgency
        recommend_spray_timing(5, 10, urgency='urgent')  # Need to spray ASAP
        recommend_spray_timing(5, 10, urgency='flexible')  # Can wait for best conditions
    """
    from api.services.operations.spray_planning import SprayPlanningService

    # Validate urgency
    if urgency not in ('urgent', 'normal', 'flexible'):
        urgency = 'normal'

    company_id = get_company_id()
    service = SprayPlanningService(company_id=company_id)

    result = service.recommend_application_timing(
        field_id=field_id,
        product_id=product_id,
        urgency=urgency
    )

    return result.to_dict()


# Tool definitions for MCP server registration
TOOLS = [
    {
        'function': check_spray_conditions,
        'name': 'check_spray_conditions',
        'description': 'Check if current weather is suitable for spraying. Returns go/no-go recommendation with reasoning.',
    },
    {
        'function': find_spray_windows,
        'name': 'find_spray_windows',
        'description': 'Find suitable spray windows in upcoming forecast (up to 7 days). Sorted by best conditions.',
    },
    {
        'function': recommend_spray_timing,
        'name': 'recommend_spray_timing',
        'description': 'Recommend optimal spray timing for a product/field considering weather, PHI, and REI.',
    },
]
