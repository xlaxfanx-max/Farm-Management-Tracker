"""
Weather API Views
=================
REST API endpoints for weather data and spray condition assessment.
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .permissions import HasCompanyAccess

from .models import Farm
from .weather_service import weather_service, WeatherService


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def get_current_weather(request, farm_id):
    """
    Get current weather conditions for a farm.

    Returns:
    - temperature, feels_like, humidity
    - wind_speed, wind_direction
    - conditions, icon
    - spray_conditions assessment
    """
    try:
        # Get farm and verify access
        farm = Farm.objects.get(
            id=farm_id,
            company=request.user.company_memberships.first().company
        )
    except Farm.DoesNotExist:
        return Response(
            {'error': 'Farm not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )

    try:
        weather_data = weather_service.get_farm_weather(farm)
        return Response(weather_data)
    except ValueError as e:
        return Response(
            {'error': str(e), 'needs_api_key': True},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch weather: {str(e)}'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def get_weather_forecast(request, farm_id):
    """
    Get 7-day weather forecast for a farm.

    Returns:
    - daily: array of daily forecasts with:
      - date, high, low, conditions, icon
      - wind_speed, humidity, rain_chance
      - spray_rating
    """
    try:
        farm = Farm.objects.get(
            id=farm_id,
            company=request.user.company_memberships.first().company
        )
    except Farm.DoesNotExist:
        return Response(
            {'error': 'Farm not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )

    try:
        forecast = weather_service.get_farm_forecast(farm)
        return Response(forecast)
    except ValueError as e:
        return Response(
            {'error': str(e), 'needs_api_key': True},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except Exception as e:
        return Response(
            {'error': f'Failed to fetch forecast: {str(e)}'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def get_spray_conditions(request, farm_id):
    """
    Get detailed spray condition assessment for a farm.

    Returns spray conditions with:
    - rating: 'good', 'fair', or 'poor'
    - score: 0-100
    - factors: detailed assessment of wind, temp, humidity, inversion, rain
    """
    try:
        farm = Farm.objects.get(
            id=farm_id,
            company=request.user.company_memberships.first().company
        )
    except Farm.DoesNotExist:
        return Response(
            {'error': 'Farm not found or access denied'},
            status=status.HTTP_404_NOT_FOUND
        )

    try:
        weather_data = weather_service.get_farm_weather(farm)

        if 'error' in weather_data:
            return Response(weather_data, status=status.HTTP_400_BAD_REQUEST)

        # Return just the spray conditions portion
        return Response({
            'farm_id': farm_id,
            'farm_name': farm.name,
            'spray_conditions': weather_data.get('spray_conditions', {}),
            'current_weather': {
                'temperature': weather_data.get('temperature'),
                'wind_speed': weather_data.get('wind_speed'),
                'humidity': weather_data.get('humidity'),
                'conditions': weather_data.get('conditions'),
            },
            'fetched_at': weather_data.get('fetched_at'),
            'cached': weather_data.get('cached', False),
        })
    except Exception as e:
        return Response(
            {'error': f'Failed to assess spray conditions: {str(e)}'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def get_spray_thresholds(request):
    """
    Get spray condition threshold values.

    Returns the threshold configuration used for spray assessments:
    - wind: good_min, good_max, fair_max
    - temperature: good_min, good_max, fair_min, fair_max
    - humidity: good_min, good_max, fair_min, fair_max
    - inversion: good_diff, fair_diff
    """
    return Response({
        'thresholds': WeatherService.THRESHOLDS,
        'descriptions': {
            'wind': {
                'good': f"{WeatherService.THRESHOLDS['wind']['good_min']}-{WeatherService.THRESHOLDS['wind']['good_max']} mph - Ideal for spraying",
                'fair': f"{WeatherService.THRESHOLDS['wind']['good_max']}-{WeatherService.THRESHOLDS['wind']['fair_max']} mph - Watch for drift",
                'poor_low': f"Below {WeatherService.THRESHOLDS['wind']['good_min']} mph - Inversion risk",
                'poor_high': f"Above {WeatherService.THRESHOLDS['wind']['fair_max']} mph - High drift risk",
            },
            'temperature': {
                'good': f"{WeatherService.THRESHOLDS['temperature']['good_min']}-{WeatherService.THRESHOLDS['temperature']['good_max']}°F - Optimal",
                'fair': f"{WeatherService.THRESHOLDS['temperature']['fair_min']}-{WeatherService.THRESHOLDS['temperature']['fair_max']}°F - Acceptable",
                'poor': "Outside acceptable range",
            },
            'humidity': {
                'good': f"{WeatherService.THRESHOLDS['humidity']['good_min']}-{WeatherService.THRESHOLDS['humidity']['good_max']}% - Ideal",
                'fair': f"{WeatherService.THRESHOLDS['humidity']['fair_min']}-{WeatherService.THRESHOLDS['humidity']['fair_max']}% - Acceptable",
                'poor_low': "Below 30% - Evaporation risk",
                'poor_high': "Above 80% - Poor drying",
            },
            'inversion': {
                'info': "Based on temperature-dewpoint difference",
                'good': f">{WeatherService.THRESHOLDS['inversion']['good_diff']}°F difference - Low risk",
                'fair': f"{WeatherService.THRESHOLDS['inversion']['fair_diff']}-{WeatherService.THRESHOLDS['inversion']['good_diff']}°F difference - Moderate risk",
                'poor': f"<{WeatherService.THRESHOLDS['inversion']['fair_diff']}°F difference - High risk",
            },
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def get_all_farms_weather(request):
    """
    Get weather summary for all farms belonging to the user's company.
    Useful for dashboard overview.
    """
    company = request.user.company_memberships.first()
    if not company:
        return Response(
            {'error': 'No company associated with user'},
            status=status.HTTP_400_BAD_REQUEST
        )

    farms = Farm.objects.filter(company=company.company)
    results = []

    for farm in farms:
        farm_data = {
            'id': farm.id,
            'name': farm.name,
            'has_coordinates': farm.has_coordinates,
        }

        if farm.has_coordinates:
            try:
                weather = weather_service.get_farm_weather(farm)
                farm_data['weather'] = {
                    'temperature': weather.get('temperature'),
                    'conditions': weather.get('conditions'),
                    'icon': weather.get('icon'),
                    'spray_rating': weather.get('spray_conditions', {}).get('rating'),
                }
            except Exception:
                farm_data['weather'] = None
                farm_data['weather_error'] = True
        else:
            farm_data['weather'] = None

        results.append(farm_data)

    return Response({'farms': results})
