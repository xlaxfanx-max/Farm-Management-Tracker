"""
Spray Planning Service for Optimizing Pesticide Applications.

Handles:
- Weather window identification for spray operations
- Product selection recommendations
- Application timing optimization
- Equipment and method recommendations

Uses weather data from OpenWeatherMap (via WeatherService) and spray condition
thresholds based on EPA and UC Davis guidelines.

This service is designed to be called programmatically by both:
1. REST API endpoints (ViewSets)
2. AI agents for automated spray planning
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any

from django.utils import timezone

logger = logging.getLogger(__name__)


# =============================================================================
# DATA CLASSES FOR SERVICE RESULTS
# =============================================================================

@dataclass
class SprayWindow:
    """
    Represents a suitable window for spray operations.

    Attributes:
        start_datetime: Start of the spray window
        end_datetime: End of the spray window
        confidence: Confidence level (0-1) that conditions will hold
        conditions: Weather conditions during this window
        rating: Overall rating ('good', 'fair', 'poor')
        score: Numerical score (0-100)
        notes: Advisory notes for the operator
    """
    start_datetime: datetime
    end_datetime: datetime
    confidence: float
    conditions: Dict[str, Any]
    rating: str = 'fair'
    score: int = 50
    notes: List[str] = field(default_factory=list)

    @property
    def duration_hours(self) -> float:
        """Calculate duration of the window in hours."""
        delta = self.end_datetime - self.start_datetime
        return delta.total_seconds() / 3600

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'start_datetime': self.start_datetime.isoformat(),
            'end_datetime': self.end_datetime.isoformat(),
            'duration_hours': round(self.duration_hours, 1),
            'confidence': round(self.confidence, 2),
            'conditions': self.conditions,
            'rating': self.rating,
            'score': self.score,
            'notes': self.notes,
        }


@dataclass
class SprayRecommendation:
    """
    Result of spray condition evaluation.

    Attributes:
        recommended: Whether spraying is recommended
        optimal_windows: List of suitable spray windows
        current_conditions: Current weather conditions
        current_rating: Current condition rating
        current_score: Current condition score (0-100)
        issues: List of issues preventing spray
        suggestions: List of suggestions for optimal spraying
    """
    recommended: bool
    optimal_windows: List[SprayWindow]
    current_conditions: Dict[str, Any]
    current_rating: str = 'unknown'
    current_score: int = 0
    issues: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'recommended': self.recommended,
            'optimal_windows': [w.to_dict() for w in self.optimal_windows],
            'current_conditions': self.current_conditions,
            'current_rating': self.current_rating,
            'current_score': self.current_score,
            'issues': self.issues,
            'suggestions': self.suggestions,
        }


@dataclass
class ApplicationTimingResult:
    """
    Recommended application timing result.

    Attributes:
        field_id: ID of the field
        field_name: Name of the field
        product_id: ID of the product
        product_name: Name of the product
        recommended_datetime: Best time to apply
        alternative_times: List of alternative times
        phi_constraint: If harvest is approaching, PHI constraint info
        rei_consideration: REI considerations for worker scheduling
        weather_windows: Available weather windows
    """
    field_id: int
    field_name: str
    product_id: int
    product_name: str
    recommended_datetime: Optional[datetime]
    alternative_times: List[datetime] = field(default_factory=list)
    phi_constraint: Optional[Dict[str, Any]] = None
    rei_consideration: Optional[Dict[str, Any]] = None
    weather_windows: List[SprayWindow] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'field_id': self.field_id,
            'field_name': self.field_name,
            'product_id': self.product_id,
            'product_name': self.product_name,
            'recommended_datetime': self.recommended_datetime.isoformat() if self.recommended_datetime else None,
            'alternative_times': [t.isoformat() for t in self.alternative_times],
            'phi_constraint': self.phi_constraint,
            'rei_consideration': self.rei_consideration,
            'weather_windows': [w.to_dict() for w in self.weather_windows],
            'notes': self.notes,
        }


# =============================================================================
# MAIN SERVICE CLASS
# =============================================================================

class SprayPlanningService:
    """
    Service for spray operation planning and optimization.

    Provides recommendations for optimal spray timing based on weather
    conditions, PHI constraints, and REI considerations.

    Example usage:
        service = SprayPlanningService()

        # Find spray windows for a farm
        windows = service.find_spray_windows(farm_id=1, days_ahead=7)

        # Evaluate current conditions
        result = service.evaluate_spray_conditions(farm_id=1)

        if result.recommended:
            print(f"Good to spray! Score: {result.current_score}/100")
        else:
            for issue in result.issues:
                print(f"Issue: {issue}")
    """

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
        'rain': {
            'good_hours': 6,    # No rain expected within 6 hours
            'fair_hours': 3,    # Rain expected within 6 hours is fair
            # Rain within 3 hours is poor
        }
    }

    # Scoring weights
    SCORE_WEIGHTS = {
        'wind': 25,
        'temperature': 25,
        'humidity': 20,
        'inversion_risk': 15,
        'rain': 15,
    }

    def __init__(self, company_id: Optional[int] = None):
        """
        Initialize the service.

        Args:
            company_id: Optional company ID for RLS filtering
        """
        self.company_id = company_id
        self._weather_service = None

    @property
    def weather_service(self):
        """Lazy-load weather service."""
        if self._weather_service is None:
            from api.weather_service import WeatherService
            self._weather_service = WeatherService()
        return self._weather_service

    # =========================================================================
    # PRIMARY PLANNING METHODS
    # =========================================================================

    def find_spray_windows(
        self,
        farm_id: int,
        days_ahead: int = 7,
        application_method: str = 'ground',
        min_window_hours: float = 2.0
    ) -> List[SprayWindow]:
        """
        Find suitable spray windows in the upcoming forecast.

        Analyzes weather forecast to identify periods with suitable
        conditions for spray operations.

        Args:
            farm_id: ID of the farm
            days_ahead: Number of days to look ahead (max 7)
            application_method: 'ground' or 'aerial' (aerial more restrictive)
            min_window_hours: Minimum window duration to report

        Returns:
            List of SprayWindow objects sorted by score (best first)
        """
        from api.models import Farm

        try:
            farm = Farm.objects.get(id=farm_id)
        except Farm.DoesNotExist:
            logger.error(f"Farm with ID {farm_id} not found")
            return []

        if not farm.has_coordinates:
            logger.warning(f"Farm {farm_id} has no GPS coordinates")
            return []

        try:
            lat = float(farm.gps_latitude)
            lon = float(farm.gps_longitude)
            forecast = self.weather_service.get_forecast(lat, lon)
        except Exception as e:
            logger.error(f"Failed to get forecast for farm {farm_id}: {e}")
            return []

        windows = []
        daily_forecasts = forecast.get('daily', [])[:days_ahead]

        for day_forecast in daily_forecasts:
            # Assess conditions for this day
            day_date = datetime.strptime(day_forecast['date'], '%Y-%m-%d').date()

            conditions = {
                'temperature_high': day_forecast.get('high'),
                'temperature_low': day_forecast.get('low'),
                'wind_speed': day_forecast.get('wind_speed'),
                'humidity': day_forecast.get('humidity'),
                'rain_chance': day_forecast.get('rain_chance', 0),
                'conditions': day_forecast.get('conditions'),
            }

            # Calculate score
            score, rating, notes = self._score_conditions(conditions, application_method)

            if rating in ('good', 'fair'):
                # Create spray window for this day
                # Assume spray hours are 6 AM to 6 PM
                start_dt = timezone.make_aware(datetime.combine(day_date, datetime.min.time().replace(hour=6)))
                end_dt = timezone.make_aware(datetime.combine(day_date, datetime.min.time().replace(hour=18)))

                # Calculate confidence based on how far out the forecast is
                days_out = (day_date - date.today()).days
                confidence = max(0.5, 1.0 - (days_out * 0.1))

                window = SprayWindow(
                    start_datetime=start_dt,
                    end_datetime=end_dt,
                    confidence=confidence,
                    conditions=conditions,
                    rating=rating,
                    score=score,
                    notes=notes
                )
                windows.append(window)

        # Sort by score (best first)
        windows.sort(key=lambda w: w.score, reverse=True)

        return windows

    def evaluate_spray_conditions(
        self,
        farm_id: int,
        target_datetime: Optional[datetime] = None
    ) -> SprayRecommendation:
        """
        Evaluate conditions for a specific spray time.

        Returns detailed go/no-go assessment with reasoning.

        Args:
            farm_id: ID of the farm
            target_datetime: Time to evaluate (default: now)

        Returns:
            SprayRecommendation with detailed assessment
        """
        from api.models import Farm

        if target_datetime is None:
            target_datetime = timezone.now()

        try:
            farm = Farm.objects.get(id=farm_id)
        except Farm.DoesNotExist:
            return SprayRecommendation(
                recommended=False,
                optimal_windows=[],
                current_conditions={},
                issues=[f'Farm with ID {farm_id} not found']
            )

        if not farm.has_coordinates:
            return SprayRecommendation(
                recommended=False,
                optimal_windows=[],
                current_conditions={},
                issues=['Farm has no GPS coordinates for weather lookup']
            )

        try:
            lat = float(farm.gps_latitude)
            lon = float(farm.gps_longitude)
            weather = self.weather_service.get_current_weather(lat, lon)
            assessment = self.weather_service.assess_spray_conditions(weather)
        except Exception as e:
            return SprayRecommendation(
                recommended=False,
                optimal_windows=[],
                current_conditions={},
                issues=[f'Failed to fetch weather data: {str(e)}']
            )

        # Get optimal windows for context
        windows = self.find_spray_windows(farm_id, days_ahead=3)

        # Build issues and suggestions
        issues = []
        suggestions = []
        factors = assessment.get('factors', {})

        # Analyze each factor
        for factor_name, factor_data in factors.items():
            status = factor_data.get('status', 'unknown')
            message = factor_data.get('message', '')

            if status == 'poor':
                issues.append(message)
            elif status == 'fair':
                suggestions.append(f"Monitor: {message}")

        # Overall recommendation
        rating = assessment.get('rating', 'unknown')
        score = assessment.get('score', 0)
        recommended = rating in ('good', 'fair') and score >= 60

        if not recommended and windows:
            # Suggest better times
            best_window = windows[0]
            suggestions.append(
                f"Better conditions expected on {best_window.start_datetime.strftime('%A %m/%d')} "
                f"(score: {best_window.score}/100)"
            )

        return SprayRecommendation(
            recommended=recommended,
            optimal_windows=windows[:3],  # Top 3 windows
            current_conditions=weather,
            current_rating=rating,
            current_score=score,
            issues=issues,
            suggestions=suggestions,
        )

    def recommend_application_timing(
        self,
        field_id: int,
        product_id: int,
        urgency: str = 'normal'  # 'urgent', 'normal', 'flexible'
    ) -> ApplicationTimingResult:
        """
        Recommend optimal application timing considering multiple factors.

        Considers:
        - Weather windows
        - PHI constraints (if harvest approaching)
        - REI and worker scheduling
        - Product efficacy (time of day, temperature)

        Args:
            field_id: ID of the field
            product_id: ID of the product
            urgency: 'urgent' (ASAP), 'normal' (within week), 'flexible' (best conditions)

        Returns:
            ApplicationTimingResult with recommendations
        """
        from api.models import Field, PesticideProduct
        from api.services.compliance.pesticide_compliance import PesticideComplianceService

        try:
            field = Field.objects.select_related('farm').get(id=field_id)
            product = PesticideProduct.objects.get(id=product_id)
        except (Field.DoesNotExist, PesticideProduct.DoesNotExist) as e:
            return ApplicationTimingResult(
                field_id=field_id,
                field_name='Unknown',
                product_id=product_id,
                product_name='Unknown',
                recommended_datetime=None,
                notes=[str(e)]
            )

        notes = []
        alternative_times = []
        phi_constraint = None
        rei_consideration = None

        # Get weather windows
        windows = []
        if field.farm:
            windows = self.find_spray_windows(
                farm_id=field.farm.id,
                days_ahead=7 if urgency != 'urgent' else 3
            )

        # Check PHI implications
        compliance_service = PesticideComplianceService()
        phi_result = compliance_service.calculate_phi_clearance(field_id)

        if product.phi_days:
            phi_constraint = {
                'phi_days': product.phi_days,
                'current_field_clear': phi_result.is_clear,
                'note': f'Application will set PHI to {product.phi_days} days'
            }
            notes.append(f'PHI: {product.phi_days} days')

        # REI consideration
        if product.rei_hours or product.rei_days:
            rei_hours = product.get_rei_display_hours()
            rei_consideration = {
                'rei_hours': float(rei_hours) if rei_hours else None,
                'note': f'Workers cannot enter for {rei_hours} hours after application'
            }
            notes.append(f'REI: {rei_hours} hours')

        # Determine recommended time based on urgency
        recommended_datetime = None

        if urgency == 'urgent':
            # Find first fair or better window
            for window in windows:
                if window.rating in ('good', 'fair'):
                    recommended_datetime = window.start_datetime
                    break
            if not recommended_datetime:
                # If no good windows, suggest earliest possibility
                recommended_datetime = timezone.now() + timedelta(hours=2)
                notes.append('Urgent: No ideal weather windows found, earliest practical time suggested')
        elif urgency == 'normal':
            # Find best window in next 3 days
            near_windows = [w for w in windows if (w.start_datetime.date() - date.today()).days <= 3]
            if near_windows:
                recommended_datetime = near_windows[0].start_datetime
                alternative_times = [w.start_datetime for w in near_windows[1:3]]
        else:  # flexible
            # Find absolute best window
            if windows:
                recommended_datetime = windows[0].start_datetime
                alternative_times = [w.start_datetime for w in windows[1:5]]
            notes.append('Flexible timing: Best overall conditions recommended')

        # Add temperature-based timing advice
        if product.product_type == 'fungicide':
            notes.append('Fungicides: Apply in morning when humidity is higher')
        elif product.product_type == 'insecticide':
            notes.append('Insecticides: Apply when target pests are active')

        return ApplicationTimingResult(
            field_id=field_id,
            field_name=field.name,
            product_id=product_id,
            product_name=product.product_name,
            recommended_datetime=recommended_datetime,
            alternative_times=alternative_times,
            phi_constraint=phi_constraint,
            rei_consideration=rei_consideration,
            weather_windows=windows[:5],
            notes=notes,
        )

    # =========================================================================
    # PRIVATE HELPER METHODS
    # =========================================================================

    def _score_conditions(
        self,
        conditions: Dict[str, Any],
        application_method: str = 'ground'
    ) -> tuple:
        """
        Score weather conditions for spray operations.

        Returns:
            Tuple of (score, rating, notes)
        """
        total_score = 0
        notes = []

        # Wind scoring (25 points)
        wind = conditions.get('wind_speed', 0)
        if self.THRESHOLDS['wind']['good_min'] <= wind <= self.THRESHOLDS['wind']['good_max']:
            total_score += 25
        elif wind < self.THRESHOLDS['wind']['good_min']:
            total_score += 5
            notes.append(f'Low wind ({wind} mph) - inversion risk')
        elif wind <= self.THRESHOLDS['wind']['fair_max']:
            total_score += 15
            notes.append(f'Moderate wind ({wind} mph) - watch for drift')
        else:
            notes.append(f'High wind ({wind} mph) - not recommended')

        # Temperature scoring (25 points)
        temp_high = conditions.get('temperature_high', 70)
        temp_low = conditions.get('temperature_low', 50)
        avg_temp = (temp_high + temp_low) / 2 if temp_high and temp_low else 70

        if self.THRESHOLDS['temperature']['good_min'] <= avg_temp <= self.THRESHOLDS['temperature']['good_max']:
            total_score += 25
        elif self.THRESHOLDS['temperature']['fair_min'] <= avg_temp <= self.THRESHOLDS['temperature']['fair_max']:
            total_score += 15
        else:
            notes.append(f'Temperature ({avg_temp}°F avg) outside optimal range')

        # Humidity scoring (20 points)
        humidity = conditions.get('humidity', 50)
        if self.THRESHOLDS['humidity']['good_min'] <= humidity <= self.THRESHOLDS['humidity']['good_max']:
            total_score += 20
        elif self.THRESHOLDS['humidity']['fair_min'] <= humidity <= self.THRESHOLDS['humidity']['fair_max']:
            total_score += 12
        else:
            notes.append(f'Humidity ({humidity}%) outside optimal range')

        # Rain scoring (15 points)
        rain_chance = conditions.get('rain_chance', 0)
        if rain_chance <= 10:
            total_score += 15
        elif rain_chance <= 30:
            total_score += 10
            notes.append(f'{rain_chance}% chance of rain')
        elif rain_chance <= 50:
            total_score += 5
            notes.append(f'{rain_chance}% chance of rain - may wash off product')
        else:
            notes.append(f'{rain_chance}% chance of rain - not recommended')

        # Inversion risk (15 points) - estimate from wind speed
        if wind >= self.THRESHOLDS['wind']['good_min']:
            total_score += 15
        elif wind >= 2:
            total_score += 8
        else:
            notes.append('Calm conditions - temperature inversion possible')

        # Adjust for aerial application (more restrictive)
        if application_method == 'aerial':
            if wind > 8:
                total_score -= 10
                notes.append('Wind too high for aerial application')

        # Determine rating
        if total_score >= 75:
            rating = 'good'
        elif total_score >= 50:
            rating = 'fair'
        else:
            rating = 'poor'

        return total_score, rating, notes
