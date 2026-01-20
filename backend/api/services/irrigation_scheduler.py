"""
Irrigation Scheduler Service

Calculates irrigation recommendations using the water balance method.
ETc = ETo × Kc
Water Balance: Soil Moisture = Previous + Rainfall + Irrigation - ETc

When soil moisture depletion reaches MAD threshold, irrigation is recommended.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Optional

from django.db.models import Max

logger = logging.getLogger(__name__)


def _default_satellite_adjustment() -> dict[str, Any]:
    """Return default satellite adjustment dict when not using satellite data."""
    return {
        'adjusted_kc': None,
        'base_kc': None,
        'canopy_factor': Decimal('1.0'),
        'health_modifier': Decimal('1.0'),
        'satellite_data_used': False,
        'adjustments_applied': ['Satellite adjustment disabled or unavailable'],
        'data_freshness': 'unavailable',
        'canopy_coverage_percent': None,
        'reference_coverage_percent': None,
        'crop_type': None,
        'tree_age': None,
        'zone_avg_ndvi': None,
        'detection_date': None,
    }

# Default Kc values by month for mature citrus
DEFAULT_CITRUS_KC = {
    1: Decimal('0.65'), 2: Decimal('0.65'), 3: Decimal('0.70'), 4: Decimal('0.70'),
    5: Decimal('0.70'), 6: Decimal('0.65'), 7: Decimal('0.65'), 8: Decimal('0.65'),
    9: Decimal('0.65'), 10: Decimal('0.65'), 11: Decimal('0.65'), 12: Decimal('0.65'),
}

# Default ETo values by month (inches/day) for Central California
# Based on typical CIMIS data for San Joaquin Valley
DEFAULT_ETO_BY_MONTH = {
    1: Decimal('0.06'),   # January - low evaporation
    2: Decimal('0.09'),   # February
    3: Decimal('0.13'),   # March
    4: Decimal('0.18'),   # April
    5: Decimal('0.23'),   # May
    6: Decimal('0.27'),   # June - peak summer
    7: Decimal('0.28'),   # July - highest
    8: Decimal('0.25'),   # August
    9: Decimal('0.19'),   # September
    10: Decimal('0.12'),  # October
    11: Decimal('0.07'),  # November
    12: Decimal('0.05'),  # December - lowest
}

# Effective rainfall factor (accounts for runoff/interception)
EFFECTIVE_RAINFALL_FACTOR = Decimal('0.75')


class IrrigationScheduler:
    """
    Calculates irrigation recommendations for an irrigation zone.
    """

    def __init__(self, zone, use_satellite_adjustment: bool = True):
        """
        Initialize scheduler for a zone.

        Args:
            zone: IrrigationZone model instance
            use_satellite_adjustment: Whether to apply satellite-based Kc adjustments
        """
        self.zone = zone
        self._cimis_service = None
        self._satellite_adjuster = None
        # Check zone-level override, then use parameter
        if hasattr(zone, 'use_satellite_kc_adjustment'):
            self.use_satellite_adjustment = zone.use_satellite_kc_adjustment
        else:
            self.use_satellite_adjustment = use_satellite_adjustment

    @property
    def cimis_service(self):
        """Lazy-load CIMIS service."""
        if self._cimis_service is None:
            from .cimis_service import CIMISService
            self._cimis_service = CIMISService()
        return self._cimis_service

    @property
    def satellite_adjuster(self):
        """Lazy-load satellite Kc adjuster."""
        if self._satellite_adjuster is None:
            from .satellite_kc_adjuster import SatelliteKcAdjuster
            self._satellite_adjuster = SatelliteKcAdjuster(self.zone)
        return self._satellite_adjuster

    def calculate_recommendation(self, as_of_date: Optional[date] = None) -> dict:
        """
        Calculate irrigation recommendation for the zone.

        Args:
            as_of_date: Calculate as of this date (default: today)

        Returns:
            dict with:
                - recommended: bool (True if irrigation needed)
                - recommended_date: date (when to irrigate)
                - recommended_depth_inches: Decimal
                - recommended_hours: Decimal
                - current_depletion_pct: Decimal
                - days_to_depletion: int (estimated days until MAD)
                - details: dict (calculation breakdown)
        """
        if as_of_date is None:
            as_of_date = date.today()

        # Get soil capacity
        soil_capacity = self._get_soil_capacity()
        mad_threshold = self._get_mad_threshold()

        # Find last irrigation
        last_irrigation = self._get_last_irrigation(as_of_date)
        last_irrigation_date = last_irrigation.date if last_irrigation else as_of_date - timedelta(days=30)
        last_irrigation_depth = last_irrigation.depth_inches if last_irrigation else Decimal('0')

        # Get weather data since last irrigation
        weather_data = self._get_weather_data(last_irrigation_date, as_of_date)

        # Calculate water balance
        balance = self._calculate_water_balance(
            soil_capacity,
            weather_data,
            last_irrigation_depth
        )

        current_moisture = balance['current_moisture']
        current_depletion = soil_capacity - current_moisture
        depletion_pct = (current_depletion / soil_capacity) * 100 if soil_capacity > 0 else Decimal('0')

        # Determine if irrigation is needed
        needs_irrigation = depletion_pct >= Decimal(self.zone.management_allowable_depletion)

        # Calculate recommended irrigation amount
        if needs_irrigation:
            # Refill to field capacity, adjusted for system efficiency
            refill_amount = current_depletion
            efficiency = Decimal(self.zone.distribution_uniformity) / Decimal('100')
            if efficiency > 0:
                recommended_depth = refill_amount / efficiency
            else:
                recommended_depth = refill_amount
        else:
            recommended_depth = Decimal('0')

        # Calculate runtime
        app_rate = self.zone.application_rate or Decimal('0.05')
        if app_rate > 0 and recommended_depth > 0:
            recommended_hours = recommended_depth / app_rate
        else:
            recommended_hours = Decimal('0')

        # Estimate days to MAD if not yet at threshold
        if not needs_irrigation and balance['avg_daily_etc'] > 0:
            remaining_before_mad = mad_threshold - current_depletion
            days_to_depletion = int(remaining_before_mad / balance['avg_daily_etc'])
        else:
            days_to_depletion = 0

        # Build satellite adjustment details for output
        kc_details = balance.get('kc_adjustment_details', _default_satellite_adjustment())
        satellite_adjustment = {
            'base_kc': float(kc_details['base_kc']) if kc_details.get('base_kc') else None,
            'adjusted_kc': float(kc_details['adjusted_kc']) if kc_details.get('adjusted_kc') else None,
            'canopy_factor': float(kc_details.get('canopy_factor', 1.0)),
            'health_modifier': float(kc_details.get('health_modifier', 1.0)),
            'satellite_data_used': kc_details.get('satellite_data_used', False),
            'canopy_coverage_percent': kc_details.get('canopy_coverage_percent'),
            'reference_coverage_percent': kc_details.get('reference_coverage_percent'),
            'crop_type': kc_details.get('crop_type'),
            'tree_age': kc_details.get('tree_age'),
            'zone_avg_ndvi': kc_details.get('zone_avg_ndvi'),
            'detection_date': kc_details.get('detection_date'),
            'data_freshness': kc_details.get('data_freshness', 'unavailable'),
            'adjustments_applied': kc_details.get('adjustments_applied', []),
        }

        # Build result
        result = {
            'recommended': needs_irrigation,
            'recommended_date': as_of_date if needs_irrigation else as_of_date + timedelta(days=max(1, days_to_depletion)),
            'recommended_depth_inches': round(recommended_depth, 3),
            'recommended_hours': round(recommended_hours, 2),
            'current_depletion_pct': round(depletion_pct, 1),
            'days_to_depletion': days_to_depletion,
            'days_since_last_irrigation': (as_of_date - last_irrigation_date).days,
            'details': {
                'soil_capacity_inches': float(soil_capacity),
                'mad_threshold_inches': float(mad_threshold),
                'mad_pct': self.zone.management_allowable_depletion,
                'current_moisture_inches': float(current_moisture),
                'current_depletion_inches': float(current_depletion),
                'last_irrigation_date': last_irrigation_date.isoformat() if last_irrigation_date else None,
                'last_irrigation_depth': float(last_irrigation_depth) if last_irrigation_depth else 0,
                'cumulative_etc': float(balance['total_etc']),
                'cumulative_rainfall': float(balance['total_rain']),
                'effective_rainfall': float(balance['effective_rain']),
                'avg_daily_etc': float(balance['avg_daily_etc']),
                'weather_days': balance['weather_days'],
                'using_default_et': balance.get('using_default_et', False),
                'satellite_adjustment': satellite_adjustment,
            }
        }

        return result

    def _get_soil_capacity(self) -> Decimal:
        """
        Calculate total soil water holding capacity.

        Formula: water_holding_capacity × (root_depth / 12)
        Returns capacity in inches.
        """
        whc = self.zone.soil_water_holding_capacity or Decimal('1.5')
        root_depth = self.zone.root_depth_inches or Decimal('36')
        return whc * (root_depth / Decimal('12'))

    def _get_mad_threshold(self) -> Decimal:
        """
        Calculate MAD threshold in inches.
        """
        capacity = self._get_soil_capacity()
        mad_pct = Decimal(self.zone.management_allowable_depletion or 50)
        return capacity * (mad_pct / Decimal('100'))

    def _get_current_kc(self, month: int) -> tuple[Decimal, dict[str, Any]]:
        """
        Get crop coefficient for a given month with satellite adjustments.

        Returns tuple of (adjusted_kc, adjustment_details).
        """
        base_kc = self._get_base_kc(month)

        # Apply satellite adjustment if enabled
        if self.use_satellite_adjustment:
            try:
                adjustment_details = self.satellite_adjuster.get_adjusted_kc(base_kc, month)
                return adjustment_details['adjusted_kc'], adjustment_details
            except Exception as e:
                logger.warning(
                    f"Satellite Kc adjustment failed for zone {self.zone.id}: {e}"
                )
                # Fall through to return base Kc

        # Return base Kc with minimal details
        details = _default_satellite_adjustment()
        details['adjusted_kc'] = base_kc
        details['base_kc'] = base_kc
        return base_kc, details

    def _get_base_kc(self, month: int) -> Decimal:
        """
        Get base crop coefficient for a given month (without satellite adjustment).
        Checks zone-specific profile first, then falls back to defaults.
        """
        # Try zone-specific profile
        profile = self.zone.kc_profiles.first()
        if profile:
            return profile.get_kc_for_month(month)

        # Try crop-type default profile
        from api.models import CropCoefficientProfile
        crop_type = self.zone.crop_type or 'citrus'

        # Adjust for tree age
        if self.zone.tree_age and self.zone.tree_age < 4:
            crop_type = f"{crop_type}_young"
        else:
            crop_type = f"{crop_type}_mature"

        default_profile = CropCoefficientProfile.objects.filter(
            zone__isnull=True,
            crop_type__icontains=crop_type.split('_')[0]  # Match base crop type
        ).first()

        if default_profile:
            return default_profile.get_kc_for_month(month)

        # Final fallback to hardcoded defaults
        return DEFAULT_CITRUS_KC.get(month, Decimal('0.65'))

    def _get_last_irrigation(self, before_date: date):
        """Get the most recent irrigation event on or before the given date."""
        from api.models import IrrigationEvent

        return IrrigationEvent.objects.filter(
            zone=self.zone,
            date__lte=before_date,
            method__in=['scheduled', 'manual'],  # Exclude rainfall
        ).order_by('-date').first()

    def _get_weather_data(self, start_date: date, end_date: date) -> list[dict]:
        """
        Fetch weather data for the date range.
        Falls back to default ET values if CIMIS is not configured.
        """
        if not self.zone.cimis_target:
            logger.info(f"No CIMIS target configured for zone {self.zone.id}, using default ET values")
            return self._generate_default_weather_data(start_date, end_date)

        target_type = self.zone.cimis_target_type or 'station'
        weather_data = self.cimis_service.get_daily_data(
            self.zone.cimis_target,
            start_date,
            end_date,
            target_type
        )

        # If CIMIS returns no data, fall back to defaults
        if not weather_data:
            logger.info(f"No CIMIS data available for zone {self.zone.id}, using default ET values")
            return self._generate_default_weather_data(start_date, end_date)

        return weather_data

    def _generate_default_weather_data(self, start_date: date, end_date: date) -> list[dict]:
        """
        Generate default weather data using typical ET values by month.
        Used when CIMIS data is unavailable.
        """
        weather_data = []
        current_date = start_date

        while current_date <= end_date:
            # Get default ETo for this month
            default_eto = DEFAULT_ETO_BY_MONTH.get(current_date.month, Decimal('0.15'))

            weather_data.append({
                'date': current_date,
                'eto': default_eto,
                'precipitation': Decimal('0'),  # Assume no rainfall in default mode
                'is_default': True,  # Flag to indicate this is estimated data
            })
            current_date += timedelta(days=1)

        logger.debug(f"Generated {len(weather_data)} days of default weather data")
        return weather_data

    def _calculate_water_balance(
        self,
        soil_capacity: Decimal,
        weather_data: list[dict],
        last_irrigation_depth: Decimal
    ) -> dict:
        """
        Calculate water balance from last irrigation to present.

        Tracks daily:
        - ETc (ETo × Kc)
        - Effective rainfall
        - Running soil moisture

        Returns dict with totals, current moisture, and satellite adjustment details.
        """
        # Start at field capacity after last irrigation
        current_moisture = soil_capacity

        total_etc = Decimal('0')
        total_rain = Decimal('0')
        effective_rain = Decimal('0')

        # Track Kc adjustment details (use first day's details for reporting)
        kc_adjustment_details = None

        for day_data in weather_data:
            record_date = day_data.get('date')
            if not record_date:
                continue

            # Get ETo for the day
            eto = day_data.get('eto') or Decimal('0')

            # Get Kc for the month (with satellite adjustment)
            kc, adjustment_details = self._get_current_kc(record_date.month)

            # Store first day's adjustment details for reporting
            if kc_adjustment_details is None:
                kc_adjustment_details = adjustment_details

            # Calculate ETc
            etc = eto * kc

            # Get precipitation
            precip = day_data.get('precipitation') or Decimal('0')
            eff_precip = precip * EFFECTIVE_RAINFALL_FACTOR

            # Update water balance
            # Add effective rainfall (cap at field capacity)
            current_moisture = min(soil_capacity, current_moisture + eff_precip)

            # Subtract ETc (floor at 0)
            current_moisture = max(Decimal('0'), current_moisture - etc)

            # Accumulate totals
            total_etc += etc
            total_rain += precip
            effective_rain += eff_precip

        # Calculate average daily ETc
        days = len(weather_data) or 1
        avg_daily_etc = total_etc / Decimal(days)

        # Check if using default/estimated data
        using_defaults = any(d.get('is_default', False) for d in weather_data)

        return {
            'current_moisture': current_moisture,
            'total_etc': total_etc,
            'total_rain': total_rain,
            'effective_rain': effective_rain,
            'avg_daily_etc': avg_daily_etc,
            'weather_days': days,
            'using_default_et': using_defaults,
            'kc_adjustment_details': kc_adjustment_details or _default_satellite_adjustment(),
        }

    def create_recommendation_record(self, calculation: dict) -> 'IrrigationRecommendation':
        """
        Create an IrrigationRecommendation record from calculation results.

        Args:
            calculation: Result from calculate_recommendation()

        Returns:
            Created IrrigationRecommendation instance
        """
        from api.models import IrrigationRecommendation

        return IrrigationRecommendation.objects.create(
            zone=self.zone,
            recommended_date=calculation['recommended_date'],
            recommended_depth_inches=calculation['recommended_depth_inches'],
            recommended_duration_hours=calculation['recommended_hours'],
            days_since_last_irrigation=calculation['days_since_last_irrigation'],
            cumulative_etc=Decimal(str(calculation['details']['cumulative_etc'])),
            effective_rainfall=Decimal(str(calculation['details']['effective_rainfall'])),
            soil_moisture_depletion_pct=calculation['current_depletion_pct'],
            status='pending',
            calculation_details=calculation['details'],
        )

    def get_zone_status_summary(self) -> dict:
        """
        Get a summary of the zone's irrigation status.

        Returns:
            dict with status, days_until_irrigation, last_irrigation, etc.
        """
        calc = self.calculate_recommendation()

        if calc['recommended']:
            status = 'needs_irrigation'
            status_label = 'Irrigate Today'
            status_color = 'red'
        elif calc['days_to_depletion'] <= 2:
            status = 'irrigation_soon'
            status_label = f'Irrigate in {calc["days_to_depletion"]} days'
            status_color = 'yellow'
        else:
            status = 'ok'
            status_label = f'OK - {calc["days_to_depletion"]} days'
            status_color = 'green'

        return {
            'zone_id': self.zone.id,
            'zone_name': self.zone.name,
            'field_name': self.zone.field.name if self.zone.field else None,
            'status': status,
            'status_label': status_label,
            'status_color': status_color,
            'depletion_pct': float(calc['current_depletion_pct']),
            'mad_pct': self.zone.management_allowable_depletion,
            'days_to_depletion': calc['days_to_depletion'],
            'days_since_irrigation': calc['days_since_last_irrigation'],
            'recommendation': {
                'needed': calc['recommended'],
                'date': calc['recommended_date'].isoformat(),
                'depth_inches': float(calc['recommended_depth_inches']),
                'hours': float(calc['recommended_hours']),
            },
            'details': calc['details'],
        }
