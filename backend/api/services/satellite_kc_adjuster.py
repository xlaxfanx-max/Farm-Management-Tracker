"""
Satellite-based Kc adjustment service.

Adjusts crop coefficients based on satellite-derived canopy coverage
and NDVI health indicators. Uses crop-specific maturation curves to
handle young vs mature plantings appropriately.
"""

import logging
from datetime import date
from decimal import Decimal
from typing import Any, Optional

from django.db.models import Avg

logger = logging.getLogger(__name__)

# Configuration constants
MIN_CANOPY_FACTOR = Decimal('0.30')  # Floor to prevent severe underwatering
MAX_CANOPY_FACTOR = Decimal('1.0')  # Cap at 100%
SATELLITE_DATA_STALE_DAYS = 180  # Data older than this gets flagged as stale

# Default NDVI thresholds (can be overridden per zone)
DEFAULT_NDVI_HEALTHY_THRESHOLD = 0.75
DEFAULT_NDVI_STRESSED_THRESHOLD = 0.65
DEFAULT_NDVI_SEVERE_THRESHOLD = 0.55

# Default stress multipliers
DEFAULT_MILD_STRESS_MULTIPLIER = Decimal('1.05')
DEFAULT_MODERATE_STRESS_MULTIPLIER = Decimal('1.10')
DEFAULT_SEVERE_STRESS_MULTIPLIER = Decimal('1.15')


class SatelliteKcAdjuster:
    """
    Calculates Kc adjustment factors based on satellite data.

    Uses crop-specific maturation curves to determine expected canopy coverage
    for a given tree age, then compares actual satellite-observed coverage
    to calculate an appropriate adjustment factor.
    """

    # Crop-specific maturation curves: {crop_type: {year: expected_coverage%}}
    # Values represent typical canopy coverage percentage at each age
    CROP_MATURATION = {
        # Citrus family - 5-6 years to full canopy
        'citrus': {1: 10, 2: 25, 3: 40, 4: 55, 5: 65, 'mature': 70},
        'lemon': {1: 10, 2: 25, 3: 40, 4: 55, 5: 65, 'mature': 70},
        'orange': {1: 10, 2: 25, 3: 40, 4: 55, 5: 65, 'mature': 70},
        'grapefruit': {1: 10, 2: 25, 3: 40, 4: 55, 5: 65, 'mature': 70},
        'mandarin': {1: 10, 2: 25, 3: 40, 4: 55, 5: 65, 'mature': 70},
        'tangerine': {1: 10, 2: 25, 3: 40, 4: 55, 5: 65, 'mature': 70},
        'lime': {1: 10, 2: 25, 3: 40, 4: 55, 5: 65, 'mature': 70},

        # Subtropical - dense canopy, slower initial establishment
        'avocado': {1: 15, 2: 30, 3: 45, 4: 55, 5: 65, 'mature': 75},

        # Stone fruit - faster maturing deciduous
        'stone_fruit': {1: 20, 2: 40, 3: 55, 4: 65, 5: 70, 'mature': 70},
        'peach': {1: 20, 2: 40, 3: 55, 4: 65, 5: 70, 'mature': 70},
        'nectarine': {1: 20, 2: 40, 3: 55, 4: 65, 5: 70, 'mature': 70},
        'plum': {1: 20, 2: 40, 3: 55, 4: 65, 5: 70, 'mature': 70},
        'apricot': {1: 20, 2: 40, 3: 55, 4: 65, 5: 70, 'mature': 70},
        'cherry': {1: 15, 2: 35, 3: 50, 4: 60, 5: 65, 'mature': 70},

        # Pome fruit
        'apple': {1: 15, 2: 35, 3: 50, 4: 60, 5: 65, 'mature': 70},
        'pear': {1: 15, 2: 35, 3: 50, 4: 60, 5: 65, 'mature': 70},

        # Nuts - large spacing, slower canopy fill
        'almond': {1: 10, 2: 20, 3: 35, 4: 50, 5: 60, 'mature': 65},
        'walnut': {1: 10, 2: 20, 3: 35, 4: 50, 5: 60, 'mature': 65},
        'pecan': {1: 8, 2: 18, 3: 30, 4: 45, 5: 55, 'mature': 65},

        # Pistachio - very slow, wide spacing
        'pistachio': {1: 8, 2: 15, 3: 25, 4: 35, 5: 45, 'mature': 55},

        # Vines - fast canopy establishment on trellis
        'grape': {1: 25, 2: 50, 3: 65, 4: 70, 5: 70, 'mature': 70},
        'vine': {1: 25, 2: 50, 3: 65, 4: 70, 5: 70, 'mature': 70},

        # Berries
        'blueberry': {1: 20, 2: 40, 3: 55, 4: 65, 5: 70, 'mature': 70},
        'raspberry': {1: 30, 2: 55, 3: 70, 4: 70, 5: 70, 'mature': 70},

        # Default fallback for unknown crops
        'default': {1: 15, 2: 30, 3: 50, 4: 60, 5: 65, 'mature': 70},
    }

    def __init__(self, zone):
        """
        Initialize adjuster for a zone.

        Args:
            zone: IrrigationZone model instance
        """
        self.zone = zone
        self.field = zone.field
        self.reference_coverage = self._get_crop_age_reference()

    def get_adjusted_kc(self, base_kc: Decimal, month: int) -> dict[str, Any]:
        """
        Calculate adjusted Kc based on satellite data.

        Args:
            base_kc: Base crop coefficient from profile
            month: Current month (for logging context)

        Returns:
            Dict with:
                - adjusted_kc: Final adjusted Kc value
                - base_kc: Original Kc value
                - canopy_factor: Factor from canopy coverage
                - health_modifier: Factor from NDVI health
                - satellite_data_used: Whether satellite data was used
                - adjustments_applied: List of adjustment descriptions
                - data_freshness: 'current', 'stale', or 'unavailable'
        """
        result = {
            'adjusted_kc': base_kc,
            'base_kc': base_kc,
            'canopy_factor': Decimal('1.0'),
            'health_modifier': Decimal('1.0'),
            'satellite_data_used': False,
            'adjustments_applied': [],
            'data_freshness': 'unavailable',
            'canopy_coverage_percent': None,
            'reference_coverage_percent': self.reference_coverage,
            'crop_type': self.zone.crop_type,
            'tree_age': self.zone.tree_age,
            'zone_avg_ndvi': None,
            'detection_date': None,
        }

        # Check if satellite data is available
        if not self._has_valid_satellite_data():
            result['adjustments_applied'].append(
                'No satellite data available - using base Kc'
            )
            return result

        # Calculate data freshness
        data_age_days = self._get_data_age_days()
        if data_age_days is None:
            freshness = 'unavailable'
        elif data_age_days <= SATELLITE_DATA_STALE_DAYS:
            freshness = 'current'
        else:
            freshness = 'stale'
        result['data_freshness'] = freshness
        result['detection_date'] = (
            self.field.latest_detection_date.isoformat()
            if self.field.latest_detection_date else None
        )

        # Get canopy coverage factor
        canopy_factor = self._calculate_canopy_factor()
        result['canopy_factor'] = canopy_factor
        result['canopy_coverage_percent'] = float(
            self.field.satellite_canopy_coverage_percent
        ) if self.field.satellite_canopy_coverage_percent else None

        # Add crop/age context to adjustments
        crop_type = self.zone.crop_type or 'default'
        tree_age = self.zone.tree_age
        if tree_age and tree_age < 6:
            result['adjustments_applied'].append(
                f'Using {crop_type} maturation curve '
                f'(year {tree_age} reference: {self.reference_coverage:.0f}%)'
            )

        # Get NDVI health modifier
        health_modifier, avg_ndvi = self._calculate_health_modifier()
        result['health_modifier'] = health_modifier
        result['zone_avg_ndvi'] = round(avg_ndvi, 3) if avg_ndvi else None

        # Apply adjustments
        adjusted_kc = base_kc * canopy_factor * health_modifier
        result['adjusted_kc'] = adjusted_kc.quantize(Decimal('0.001'))
        result['satellite_data_used'] = True

        # Build adjustment descriptions
        if canopy_factor < Decimal('1.0'):
            coverage = self.field.satellite_canopy_coverage_percent
            reduction_pct = (1 - float(canopy_factor)) * 100
            result['adjustments_applied'].append(
                f'Canopy coverage ({coverage:.1f}%) below reference '
                f'({self.reference_coverage:.0f}%) - Kc reduced by {reduction_pct:.0f}%'
            )
        elif canopy_factor == Decimal('1.0') and self.field.satellite_canopy_coverage_percent:
            coverage = self.field.satellite_canopy_coverage_percent
            result['adjustments_applied'].append(
                f'Canopy coverage ({coverage:.1f}%) at or above reference '
                f'({self.reference_coverage:.0f}%) - no canopy adjustment'
            )

        if health_modifier > Decimal('1.0'):
            increase_pct = (float(health_modifier) - 1) * 100
            result['adjustments_applied'].append(
                f'NDVI indicates vegetation stress ({avg_ndvi:.2f}) - '
                f'water needs increased by {increase_pct:.0f}%'
            )

        if freshness == 'stale':
            result['adjustments_applied'].append(
                f'Satellite data is {data_age_days} days old - consider refreshing imagery'
            )

        if not result['adjustments_applied']:
            result['adjustments_applied'].append(
                'Satellite data validates base Kc - no adjustment needed'
            )

        logger.info(
            f"Zone {self.zone.id} ({self.zone.name}): "
            f"Kc adjusted from {base_kc} to {adjusted_kc} "
            f"(canopy={canopy_factor}, health={health_modifier}, "
            f"crop={crop_type}, age={tree_age})"
        )

        return result

    def _get_crop_age_reference(self) -> float:
        """
        Get expected canopy coverage based on crop type and tree age.

        Returns crop-specific, age-appropriate reference coverage percentage.
        User override (zone.reference_canopy_coverage) takes priority.
        """
        # User override takes priority
        if hasattr(self.zone, 'reference_canopy_coverage') and self.zone.reference_canopy_coverage:
            return float(self.zone.reference_canopy_coverage)

        # Normalize crop type for lookup (lowercase, handle variations)
        crop = (self.zone.crop_type or 'default').lower().strip()

        # Find matching maturation curve
        curve = self.CROP_MATURATION.get(crop)
        if not curve:
            # Try partial match (e.g., "valencia orange" matches "orange")
            for key in self.CROP_MATURATION:
                if key in crop or crop in key:
                    curve = self.CROP_MATURATION[key]
                    break
        if not curve:
            curve = self.CROP_MATURATION['default']
            logger.debug(
                f"No maturation curve for crop '{crop}', using default"
            )

        # Get age-appropriate reference
        tree_age = self.zone.tree_age
        if tree_age is None or tree_age >= 6:
            # Assume mature if age unknown or >= 6 years
            return curve['mature']

        return curve.get(tree_age, curve['mature'])

    def _has_valid_satellite_data(self) -> bool:
        """Check if field has usable satellite data."""
        return (
            self.field.satellite_canopy_coverage_percent is not None
            and self.field.latest_detection_date is not None
        )

    def _get_data_age_days(self) -> Optional[int]:
        """Calculate days since satellite data was captured."""
        if not self.field.latest_detection_date:
            return None
        return (date.today() - self.field.latest_detection_date).days

    def _calculate_canopy_factor(self) -> Decimal:
        """
        Calculate Kc scaling factor based on canopy coverage.

        Compares actual coverage to expected (reference) coverage.
        Returns factor clamped to [MIN_CANOPY_FACTOR, MAX_CANOPY_FACTOR].
        """
        coverage = self.field.satellite_canopy_coverage_percent

        if coverage is None or coverage <= 0:
            return Decimal('1.0')

        if self.reference_coverage <= 0:
            return Decimal('1.0')

        # Calculate ratio to reference coverage
        ratio = Decimal(str(coverage / self.reference_coverage))

        # Clamp to valid range
        factor = max(MIN_CANOPY_FACTOR, min(ratio, MAX_CANOPY_FACTOR))

        return factor.quantize(Decimal('0.01'))

    def _calculate_health_modifier(self) -> tuple[Decimal, Optional[float]]:
        """
        Calculate health modifier based on zone-average NDVI.

        Stressed vegetation (low NDVI) gets increased water by default.

        Returns:
            Tuple of (modifier, average_ndvi)
        """
        # Check if NDVI stress adjustment is enabled for this zone
        if hasattr(self.zone, 'ndvi_stress_modifier_enabled'):
            if not self.zone.ndvi_stress_modifier_enabled:
                return Decimal('1.0'), None

        avg_ndvi = self._get_zone_average_ndvi()

        if avg_ndvi is None:
            return Decimal('1.0'), None

        # Get thresholds from zone config or use defaults
        healthy_threshold = DEFAULT_NDVI_HEALTHY_THRESHOLD
        if hasattr(self.zone, 'ndvi_healthy_threshold') and self.zone.ndvi_healthy_threshold:
            healthy_threshold = float(self.zone.ndvi_healthy_threshold)

        # Get stress multiplier from zone config or use tiered defaults
        stress_multiplier = None
        if hasattr(self.zone, 'ndvi_stress_multiplier') and self.zone.ndvi_stress_multiplier:
            stress_multiplier = Decimal(str(self.zone.ndvi_stress_multiplier))

        # Determine stress level and modifier
        if avg_ndvi >= healthy_threshold:
            # Healthy - no adjustment
            modifier = Decimal('1.0')
        elif stress_multiplier:
            # Use zone-configured multiplier for any stress
            modifier = stress_multiplier
        elif avg_ndvi < DEFAULT_NDVI_SEVERE_THRESHOLD:
            # Severe stress - significant increase
            modifier = DEFAULT_SEVERE_STRESS_MULTIPLIER
        elif avg_ndvi < DEFAULT_NDVI_STRESSED_THRESHOLD:
            # Moderate stress - moderate increase
            modifier = DEFAULT_MODERATE_STRESS_MULTIPLIER
        else:
            # Mild stress (below healthy but above stressed threshold)
            modifier = DEFAULT_MILD_STRESS_MULTIPLIER

        return modifier, avg_ndvi

    def _get_zone_average_ndvi(self) -> Optional[float]:
        """
        Calculate average NDVI for active trees in the zone's field.

        Uses the most recent completed TreeSurvey for this field.
        """
        from api.models import TreeSurvey

        latest_survey = (
            TreeSurvey.objects
            .filter(field=self.field, status='completed', avg_ndvi__isnull=False)
            .order_by('-capture_date')
            .first()
        )
        if not latest_survey:
            return None

        return latest_survey.avg_ndvi
