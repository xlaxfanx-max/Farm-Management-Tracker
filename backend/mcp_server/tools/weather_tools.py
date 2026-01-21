"""
Weather Tools for MCP Server

Provides current weather and forecast data for farms.
Uses the WeatherService which integrates with OpenWeatherMap.
"""

from typing import Optional
from mcp_server.context import get_company_id, resolve_farm


async def get_weather(farm_id: int) -> dict:
    """
    Get current weather conditions for a farm.

    Args:
        farm_id: The farm ID to get weather for.

    Returns current weather including:
    - temperature, feels_like (F)
    - humidity (%)
    - wind_speed (mph), wind_direction
    - conditions description
    - dewpoint (important for spray decisions)
    - spray_conditions assessment (good/fair/poor with score)

    The spray conditions assessment is particularly useful for
    determining if it's a good time to spray.

    Example:
        get_weather(1)  # Get weather for farm ID 1
    """
    from api.models import Farm
    from api.weather_service import WeatherService

    try:
        farm = Farm.objects.get(id=farm_id)
    except Farm.DoesNotExist:
        return {
            'error': f'Farm with ID {farm_id} not found',
            'suggestion': 'Use list_farms() to see available farms',
        }

    if not farm.has_coordinates:
        return {
            'error': f'Farm "{farm.name}" has no GPS coordinates configured',
            'suggestion': 'Add GPS coordinates to the farm record',
        }

    try:
        weather_service = WeatherService()
        lat = float(farm.gps_latitude)
        lon = float(farm.gps_longitude)

        weather = weather_service.get_current_weather(lat, lon)
        spray_assessment = weather_service.assess_spray_conditions(weather)

        return {
            'farm_id': farm_id,
            'farm_name': farm.name,
            'current_conditions': weather,
            'spray_assessment': spray_assessment,
        }
    except Exception as e:
        return {
            'error': f'Failed to fetch weather: {str(e)}',
            'farm_id': farm_id,
            'farm_name': farm.name,
        }


async def get_forecast(farm_id: int, days: int = 7) -> dict:
    """
    Get weather forecast for a farm.

    Args:
        farm_id: The farm ID to get forecast for.
        days: Number of days to forecast (max 7, default 7).

    Returns forecast with daily summaries including:
    - date, high/low temperatures
    - conditions, wind_speed, humidity
    - rain_chance
    - spray_rating for each day (good/fair/poor)

    Use this to plan spray operations in advance by finding
    days with good spray conditions.

    Example:
        get_forecast(1)        # 7-day forecast for farm 1
        get_forecast(1, 3)     # 3-day forecast for farm 1
    """
    from api.models import Farm
    from api.weather_service import WeatherService

    days = min(max(1, days), 7)  # Clamp to 1-7

    try:
        farm = Farm.objects.get(id=farm_id)
    except Farm.DoesNotExist:
        return {
            'error': f'Farm with ID {farm_id} not found',
            'suggestion': 'Use list_farms() to see available farms',
        }

    if not farm.has_coordinates:
        return {
            'error': f'Farm "{farm.name}" has no GPS coordinates configured',
            'suggestion': 'Add GPS coordinates to the farm record',
        }

    try:
        weather_service = WeatherService()
        lat = float(farm.gps_latitude)
        lon = float(farm.gps_longitude)

        forecast = weather_service.get_forecast(lat, lon)

        # Limit to requested days
        daily = forecast.get('daily', [])[:days]

        # Find best spray days
        good_days = [d for d in daily if d.get('spray_rating') == 'good']
        fair_days = [d for d in daily if d.get('spray_rating') == 'fair']

        return {
            'farm_id': farm_id,
            'farm_name': farm.name,
            'forecast_days': days,
            'daily_forecast': daily,
            'spray_summary': {
                'good_days': len(good_days),
                'fair_days': len(fair_days),
                'best_day': good_days[0]['date'] if good_days else (fair_days[0]['date'] if fair_days else None),
            },
            'fetched_at': forecast.get('fetched_at'),
        }
    except Exception as e:
        return {
            'error': f'Failed to fetch forecast: {str(e)}',
            'farm_id': farm_id,
            'farm_name': farm.name,
        }


# Tool definitions for MCP server registration
TOOLS = [
    {
        'function': get_weather,
        'name': 'get_weather',
        'description': 'Get current weather conditions for a farm including spray conditions assessment.',
    },
    {
        'function': get_forecast,
        'name': 'get_forecast',
        'description': 'Get weather forecast for a farm (up to 7 days) with spray ratings for each day.',
    },
]
