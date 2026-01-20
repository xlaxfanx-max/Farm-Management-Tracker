"""
Weather Service Module
======================
Handles OpenWeatherMap API integration and spray condition assessment.
"""

import os
import requests
from datetime import datetime, timedelta
from django.utils import timezone
from django.conf import settings


class WeatherService:
    """Service class for weather API integration and spray assessment."""

    # OpenWeatherMap API configuration
    BASE_URL = "https://api.openweathermap.org/data/2.5"

    # Spray condition thresholds (based on EPA/UC Davis guidelines)
    THRESHOLDS = {
        'wind': {
            'good_min': 3,      # mph - below this, inversion risk
            'good_max': 10,     # mph - ideal spray conditions
            'fair_max': 15,     # mph - acceptable but watch for drift
            # Above fair_max is poor
        },
        'temperature': {
            'good_min': 50,     # °F
            'good_max': 85,     # °F
            'fair_min': 40,     # °F
            'fair_max': 95,     # °F
            # Outside fair range is poor
        },
        'humidity': {
            'good_min': 40,     # %
            'good_max': 70,     # %
            'fair_min': 30,     # %
            'fair_max': 80,     # %
            # Outside fair range is poor
        },
        'rain_hours': {
            'good': 6,          # No rain expected within 6 hours
            'fair': 12,         # Rain expected within 6-12 hours
            # Rain within 6 hours is poor
        },
        'inversion': {
            'good_diff': 5,     # °F temp-dewpoint difference
            'fair_diff': 2,     # °F
            # Below fair_diff is high inversion risk
        }
    }

    def __init__(self):
        self.api_key = os.environ.get('OPENWEATHERMAP_API_KEY', '')

    def _make_request(self, endpoint, params):
        """Make request to OpenWeatherMap API."""
        if not self.api_key:
            raise ValueError("OPENWEATHERMAP_API_KEY not configured")

        params['appid'] = self.api_key
        params['units'] = 'imperial'  # Use Fahrenheit

        url = f"{self.BASE_URL}/{endpoint}"
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        return response.json()

    def get_current_weather(self, lat, lon):
        """
        Fetch current weather conditions from OpenWeatherMap.

        Returns dict with:
        - temperature, feels_like (°F)
        - humidity (%)
        - wind_speed (mph), wind_direction
        - conditions (description)
        - icon (weather icon code)
        - dewpoint, pressure, visibility
        """
        try:
            data = self._make_request('weather', {'lat': lat, 'lon': lon})

            # Calculate wind direction from degrees
            wind_deg = data.get('wind', {}).get('deg', 0)
            directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                         'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
            wind_direction = directions[int((wind_deg + 11.25) / 22.5) % 16]

            # Calculate dewpoint from temp and humidity
            temp = data['main']['temp']
            humidity = data['main']['humidity']
            dewpoint = self._calculate_dewpoint(temp, humidity)

            return {
                'temperature': round(data['main']['temp']),
                'feels_like': round(data['main']['feels_like']),
                'humidity': data['main']['humidity'],
                'wind_speed': round(data['wind'].get('speed', 0)),
                'wind_gust': round(data['wind'].get('gust', 0)) if 'gust' in data.get('wind', {}) else None,
                'wind_direction': wind_direction,
                'wind_degrees': wind_deg,
                'conditions': data['weather'][0]['description'].title(),
                'icon': data['weather'][0]['icon'],
                'dewpoint': round(dewpoint),
                'pressure': data['main']['pressure'],
                'visibility': data.get('visibility', 10000) / 1609.34,  # Convert m to miles
                'clouds': data.get('clouds', {}).get('all', 0),
                'sunrise': data['sys'].get('sunrise'),
                'sunset': data['sys'].get('sunset'),
                'fetched_at': timezone.now().isoformat(),
            }
        except requests.RequestException as e:
            raise Exception(f"Failed to fetch weather data: {str(e)}")

    def get_forecast(self, lat, lon):
        """
        Fetch 7-day weather forecast from OpenWeatherMap.
        Uses the One Call API 3.0 or falls back to 5-day forecast.
        """
        try:
            # Try One Call API first (requires subscription for 3.0)
            # Fall back to 5-day/3-hour forecast (free tier)
            data = self._make_request('forecast', {'lat': lat, 'lon': lon})

            # Process 5-day/3-hour forecast into daily summaries
            daily_forecasts = self._process_forecast_data(data)

            return {
                'daily': daily_forecasts,
                'fetched_at': timezone.now().isoformat(),
            }
        except requests.RequestException as e:
            raise Exception(f"Failed to fetch forecast data: {str(e)}")

    def _process_forecast_data(self, data):
        """Process 3-hour forecast data into daily summaries."""
        daily = {}

        for item in data.get('list', []):
            dt = datetime.fromtimestamp(item['dt'])
            date_key = dt.strftime('%Y-%m-%d')

            if date_key not in daily:
                daily[date_key] = {
                    'date': date_key,
                    'temps': [],
                    'humidity': [],
                    'wind_speeds': [],
                    'conditions': [],
                    'icons': [],
                    'rain': 0,
                }

            daily[date_key]['temps'].append(item['main']['temp'])
            daily[date_key]['humidity'].append(item['main']['humidity'])
            daily[date_key]['wind_speeds'].append(item['wind'].get('speed', 0))
            daily[date_key]['conditions'].append(item['weather'][0]['description'])
            daily[date_key]['icons'].append(item['weather'][0]['icon'])

            # Accumulate rain
            if 'rain' in item:
                daily[date_key]['rain'] += item['rain'].get('3h', 0)

        # Convert to list and calculate summaries
        result = []
        for date_key in sorted(daily.keys())[:7]:  # Limit to 7 days
            day_data = daily[date_key]

            # Find most common condition for the day
            conditions = day_data['conditions']
            most_common = max(set(conditions), key=conditions.count)

            # Find corresponding icon (prefer daytime icons)
            icons = day_data['icons']
            day_icons = [i for i in icons if i.endswith('d')]
            icon = day_icons[0] if day_icons else icons[0]

            avg_wind = sum(day_data['wind_speeds']) / len(day_data['wind_speeds'])
            avg_humidity = sum(day_data['humidity']) / len(day_data['humidity'])

            # Assess spray conditions for this day
            spray_rating = self._assess_daily_spray({
                'wind_speed': avg_wind,
                'humidity': avg_humidity,
                'temperature': sum(day_data['temps']) / len(day_data['temps']),
                'rain': day_data['rain'],
            })

            result.append({
                'date': date_key,
                'high': round(max(day_data['temps'])),
                'low': round(min(day_data['temps'])),
                'conditions': most_common.title(),
                'icon': icon,
                'wind_speed': round(avg_wind),
                'humidity': round(avg_humidity),
                'rain_chance': min(100, int(day_data['rain'] * 10)) if day_data['rain'] > 0 else 0,
                'spray_rating': spray_rating,
            })

        return result

    def _assess_daily_spray(self, day_data):
        """Quick assessment for daily forecast spray rating."""
        issues = 0

        # Check wind
        wind = day_data.get('wind_speed', 0)
        if wind < self.THRESHOLDS['wind']['good_min'] or wind > self.THRESHOLDS['wind']['fair_max']:
            issues += 2
        elif wind > self.THRESHOLDS['wind']['good_max']:
            issues += 1

        # Check humidity
        humidity = day_data.get('humidity', 50)
        if humidity < self.THRESHOLDS['humidity']['fair_min'] or humidity > self.THRESHOLDS['humidity']['fair_max']:
            issues += 2
        elif humidity < self.THRESHOLDS['humidity']['good_min'] or humidity > self.THRESHOLDS['humidity']['good_max']:
            issues += 1

        # Check rain
        if day_data.get('rain', 0) > 0:
            issues += 2

        if issues == 0:
            return 'good'
        elif issues <= 2:
            return 'fair'
        else:
            return 'poor'

    def assess_spray_conditions(self, weather_data):
        """
        Assess spray conditions based on current weather.

        Returns dict with:
        - rating: 'good', 'fair', or 'poor'
        - score: 0-100 overall score
        - factors: detailed assessment of each factor
        """
        factors = {}
        total_score = 0
        max_score = 0

        # Wind assessment (25 points)
        max_score += 25
        wind = weather_data.get('wind_speed', 0)
        if self.THRESHOLDS['wind']['good_min'] <= wind <= self.THRESHOLDS['wind']['good_max']:
            factors['wind'] = {
                'status': 'good',
                'value': wind,
                'message': f'Ideal wind speed ({wind} mph)',
            }
            total_score += 25
        elif wind < self.THRESHOLDS['wind']['good_min']:
            factors['wind'] = {
                'status': 'poor',
                'value': wind,
                'message': f'Too calm ({wind} mph) - inversion risk',
            }
            total_score += 5
        elif wind <= self.THRESHOLDS['wind']['fair_max']:
            factors['wind'] = {
                'status': 'fair',
                'value': wind,
                'message': f'Moderate wind ({wind} mph) - watch for drift',
            }
            total_score += 15
        else:
            factors['wind'] = {
                'status': 'poor',
                'value': wind,
                'message': f'Too windy ({wind} mph) - high drift risk',
            }
            total_score += 0

        # Temperature assessment (25 points)
        max_score += 25
        temp = weather_data.get('temperature', 70)
        if self.THRESHOLDS['temperature']['good_min'] <= temp <= self.THRESHOLDS['temperature']['good_max']:
            factors['temperature'] = {
                'status': 'good',
                'value': temp,
                'message': f'Optimal temperature ({temp}°F)',
            }
            total_score += 25
        elif self.THRESHOLDS['temperature']['fair_min'] <= temp <= self.THRESHOLDS['temperature']['fair_max']:
            factors['temperature'] = {
                'status': 'fair',
                'value': temp,
                'message': f'Acceptable temperature ({temp}°F)',
            }
            total_score += 15
        else:
            factors['temperature'] = {
                'status': 'poor',
                'value': temp,
                'message': f'Temperature outside safe range ({temp}°F)',
            }
            total_score += 0

        # Humidity assessment (20 points)
        max_score += 20
        humidity = weather_data.get('humidity', 50)
        if self.THRESHOLDS['humidity']['good_min'] <= humidity <= self.THRESHOLDS['humidity']['good_max']:
            factors['humidity'] = {
                'status': 'good',
                'value': humidity,
                'message': f'Good humidity level ({humidity}%)',
            }
            total_score += 20
        elif self.THRESHOLDS['humidity']['fair_min'] <= humidity <= self.THRESHOLDS['humidity']['fair_max']:
            factors['humidity'] = {
                'status': 'fair',
                'value': humidity,
                'message': f'Humidity slightly {"low" if humidity < 40 else "high"} ({humidity}%)',
            }
            total_score += 12
        else:
            factors['humidity'] = {
                'status': 'poor',
                'value': humidity,
                'message': f'Humidity {"too low - evaporation risk" if humidity < 30 else "too high - poor drying"} ({humidity}%)',
            }
            total_score += 0

        # Inversion risk assessment (15 points)
        max_score += 15
        temp_dewpoint_diff = abs(weather_data.get('temperature', 70) - weather_data.get('dewpoint', 50))
        if temp_dewpoint_diff >= self.THRESHOLDS['inversion']['good_diff']:
            factors['inversion'] = {
                'status': 'good',
                'value': 'low',
                'message': 'Low inversion risk',
            }
            total_score += 15
        elif temp_dewpoint_diff >= self.THRESHOLDS['inversion']['fair_diff']:
            factors['inversion'] = {
                'status': 'fair',
                'value': 'medium',
                'message': 'Moderate inversion risk',
            }
            total_score += 8
        else:
            factors['inversion'] = {
                'status': 'poor',
                'value': 'high',
                'message': 'High inversion risk - spray may not disperse',
            }
            total_score += 0

        # Rain assessment (15 points) - based on conditions
        max_score += 15
        conditions = weather_data.get('conditions', '').lower()
        if 'rain' in conditions or 'shower' in conditions or 'drizzle' in conditions:
            factors['rain'] = {
                'status': 'poor',
                'value': 'yes',
                'message': 'Rain detected - do not spray',
            }
            total_score += 0
        else:
            factors['rain'] = {
                'status': 'good',
                'value': 'no',
                'message': 'No rain expected',
            }
            total_score += 15

        # Calculate overall rating
        score = int((total_score / max_score) * 100)

        if score >= 75:
            rating = 'good'
        elif score >= 50:
            rating = 'fair'
        else:
            rating = 'poor'

        return {
            'rating': rating,
            'score': score,
            'factors': factors,
        }

    def _calculate_dewpoint(self, temp_f, humidity):
        """
        Calculate dewpoint from temperature (°F) and relative humidity (%).
        Uses Magnus formula approximation.
        """
        # Convert to Celsius for calculation
        temp_c = (temp_f - 32) * 5 / 9

        # Magnus formula constants
        a = 17.27
        b = 237.7

        # Calculate alpha
        alpha = ((a * temp_c) / (b + temp_c)) + (humidity / 100.0)

        # Calculate dewpoint in Celsius
        dewpoint_c = (b * alpha) / (a - alpha)

        # Convert back to Fahrenheit
        return (dewpoint_c * 9 / 5) + 32

    def get_farm_weather(self, farm):
        """
        Get weather for a specific farm, using cache if available.

        Args:
            farm: Farm model instance

        Returns:
            dict with current weather and spray conditions
        """
        from .models import WeatherCache

        if not farm.has_coordinates:
            return {
                'error': 'Farm does not have GPS coordinates set',
                'needs_location': True,
            }

        lat = float(farm.gps_latitude)
        lon = float(farm.gps_longitude)

        # Check cache
        try:
            cache = WeatherCache.objects.get(farm=farm)
            if not cache.is_current_stale:
                weather_data = cache.weather_data
                weather_data['cached'] = True
                weather_data['spray_conditions'] = self.assess_spray_conditions(weather_data)
                return weather_data
        except WeatherCache.DoesNotExist:
            cache = None

        # Fetch fresh data
        try:
            weather_data = self.get_current_weather(lat, lon)
            weather_data['spray_conditions'] = self.assess_spray_conditions(weather_data)
            weather_data['cached'] = False

            # Update cache
            if cache:
                cache.latitude = lat
                cache.longitude = lon
                cache.weather_data = weather_data
                cache.save()
            else:
                WeatherCache.objects.create(
                    farm=farm,
                    latitude=lat,
                    longitude=lon,
                    weather_data=weather_data,
                )

            return weather_data
        except Exception as e:
            # If API fails but we have stale cache, return it
            if cache:
                weather_data = cache.weather_data
                weather_data['cached'] = True
                weather_data['stale'] = True
                weather_data['spray_conditions'] = self.assess_spray_conditions(weather_data)
                return weather_data
            raise e

    def get_farm_forecast(self, farm):
        """
        Get forecast for a specific farm, using cache if available.
        """
        from .models import WeatherCache

        if not farm.has_coordinates:
            return {
                'error': 'Farm does not have GPS coordinates set',
                'needs_location': True,
            }

        lat = float(farm.gps_latitude)
        lon = float(farm.gps_longitude)

        # Check cache
        try:
            cache = WeatherCache.objects.get(farm=farm)
            if cache.forecast_data and not cache.is_forecast_stale:
                forecast = cache.forecast_data
                forecast['cached'] = True
                return forecast
        except WeatherCache.DoesNotExist:
            cache = None

        # Fetch fresh data
        try:
            forecast = self.get_forecast(lat, lon)
            forecast['cached'] = False

            # Update cache
            if cache:
                cache.forecast_data = forecast
                cache.save()
            else:
                WeatherCache.objects.create(
                    farm=farm,
                    latitude=lat,
                    longitude=lon,
                    weather_data={},
                    forecast_data=forecast,
                )

            return forecast
        except Exception as e:
            # If API fails but we have stale cache, return it
            if cache and cache.forecast_data:
                forecast = cache.forecast_data
                forecast['cached'] = True
                forecast['stale'] = True
                return forecast
            raise e


# Singleton instance for easy import
weather_service = WeatherService()
