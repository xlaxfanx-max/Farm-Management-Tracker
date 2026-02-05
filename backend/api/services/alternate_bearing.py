"""
Alternate Bearing Service for Yield Forecasting.

Computes the Alternate Bearing Index (ABI) from historical yield data
and predicts ON/OFF bearing state for upcoming seasons.
Critical for avocados and some citrus varieties.
"""
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional


@dataclass
class BearingSeason:
    """A single season's yield data for bearing analysis."""
    season_label: str
    yield_per_acre: Decimal
    classification: str = ''  # 'on', 'off', 'average'


@dataclass
class AlternateBearingResult:
    """Result of alternate bearing analysis for a field."""
    bearing_index: Optional[Decimal] = None  # 0 to 1 (0=consistent, 1=strong alternation)
    historical_yields: List[BearingSeason] = field(default_factory=list)
    predicted_bearing_state: str = 'insufficient_data'  # 'on', 'off', 'neutral', 'insufficient_data'
    adjustment_factor: Decimal = Decimal('1.0')  # multiplier for yield forecast
    seasons_analyzed: int = 0
    notes: str = ''


class AlternateBearingService:
    """
    Computes alternate bearing index from historical yield data.

    The Alternate Bearing Index (ABI):
        ABI = sum(|Y[t] - Y[t-1]|) / sum(Y[t] + Y[t-1]) for t = 2..n

    Values near 0 = consistent production; near 1 = strong alternation.
    Also predicts whether the upcoming season is likely an ON or OFF year.

    Usage:
        service = AlternateBearingService(company_id=1)
        result = service.analyze_field(field_id=42, current_season_label='2025-2026')
    """

    MIN_SEASONS = 3  # Need at least 3 seasons to detect a pattern
    ON_THRESHOLD = Decimal('1.15')   # 15% above mean = ON year
    OFF_THRESHOLD = Decimal('0.85')  # 15% below mean = OFF year

    # How strongly alternate bearing adjusts the forecast
    # Strong alternation (ABI > 0.5) with clear pattern gets larger adjustment
    MAX_ADJUSTMENT = Decimal('0.25')  # up to +/- 25%

    def __init__(self, company_id: int):
        self.company_id = company_id

    def analyze_field(
        self, field_id: int, current_season_label: str
    ) -> AlternateBearingResult:
        """
        Analyze alternate bearing for a field and predict next season state.

        Args:
            field_id: The field to analyze
            current_season_label: The season being forecasted (e.g., '2025-2026')

        Returns:
            AlternateBearingResult with bearing index and predicted state
        """
        seasonal_yields = self._get_historical_yields(field_id, current_season_label)

        if len(seasonal_yields) < self.MIN_SEASONS:
            return AlternateBearingResult(
                historical_yields=seasonal_yields,
                seasons_analyzed=len(seasonal_yields),
                notes=f"Need at least {self.MIN_SEASONS} seasons of data; have {len(seasonal_yields)}.",
            )

        # Compute ABI
        abi = self._compute_abi([s.yield_per_acre for s in seasonal_yields])

        # Classify each season
        mean_yield = sum(s.yield_per_acre for s in seasonal_yields) / len(seasonal_yields)
        for s in seasonal_yields:
            ratio = s.yield_per_acre / mean_yield if mean_yield > 0 else Decimal('1')
            if ratio >= self.ON_THRESHOLD:
                s.classification = 'on'
            elif ratio <= self.OFF_THRESHOLD:
                s.classification = 'off'
            else:
                s.classification = 'average'

        # Predict next season
        predicted_state, adjustment = self._predict_bearing_state(
            seasonal_yields, abi, mean_yield
        )

        notes_parts = []
        if abi > Decimal('0.5'):
            notes_parts.append("Strong alternate bearing pattern detected.")
        elif abi > Decimal('0.3'):
            notes_parts.append("Moderate alternate bearing pattern.")
        else:
            notes_parts.append("Weak or no alternate bearing pattern.")

        last = seasonal_yields[-1]
        notes_parts.append(
            f"Last season ({last.season_label}) was {last.classification} "
            f"at {last.yield_per_acre} yield/acre."
        )

        return AlternateBearingResult(
            bearing_index=abi,
            historical_yields=seasonal_yields,
            predicted_bearing_state=predicted_state,
            adjustment_factor=adjustment,
            seasons_analyzed=len(seasonal_yields),
            notes=' '.join(notes_parts),
        )

    def _get_historical_yields(
        self, field_id: int, current_season_label: str
    ) -> List[BearingSeason]:
        """
        Get historical yield per acre by season for a field.
        Excludes the current season being forecasted.
        """
        from api.models import Harvest, Field
        from api.services.season_service import SeasonService

        try:
            field_obj = Field.objects.select_related('crop', 'farm').get(
                id=field_id, farm__company_id=self.company_id
            )
        except Field.DoesNotExist:
            return []

        # Determine crop category for season resolution
        crop_category = 'citrus'
        if field_obj.crop and hasattr(field_obj.crop, 'category'):
            crop_category = field_obj.crop.category or 'citrus'

        season_service = SeasonService()

        # Get all harvests for this field, ordered by date
        harvests = Harvest.objects.filter(
            field_id=field_id,
            field__farm__company_id=self.company_id,
            status__in=['completed', 'in_progress'],
        ).exclude(
            total_bins=0, estimated_weight_lbs__isnull=True
        ).order_by('harvest_date')

        # Group harvests by season
        season_totals = {}  # season_label -> {total_yield, total_acres}
        for harvest in harvests:
            season_period = season_service.get_current_season(
                crop_category=crop_category, target_date=harvest.harvest_date
            )
            season_label = season_period.label
            if season_label == current_season_label:
                continue  # Exclude current season

            if season_label not in season_totals:
                season_totals[season_label] = {
                    'total_yield': Decimal('0'),
                    'total_acres': Decimal('0'),
                }

            # Use primary quantity (bins for citrus, lbs for avocado)
            yield_qty = harvest.primary_quantity
            if yield_qty and harvest.acres_harvested:
                season_totals[season_label]['total_yield'] += Decimal(str(yield_qty))
                season_totals[season_label]['total_acres'] += harvest.acres_harvested

        # Convert to per-acre yields
        results = []
        for label in sorted(season_totals.keys()):
            data = season_totals[label]
            if data['total_acres'] > 0:
                ypa = (data['total_yield'] / data['total_acres']).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
                results.append(BearingSeason(season_label=label, yield_per_acre=ypa))

        return results

    def _compute_abi(self, yields: List[Decimal]) -> Decimal:
        """
        Compute the Alternate Bearing Index.
        ABI = sum(|Y[t] - Y[t-1]|) / sum(Y[t] + Y[t-1]) for t=1..n-1
        Returns value between 0 (no alternation) and 1 (perfect alternation).
        """
        if len(yields) < 2:
            return Decimal('0')

        numerator = Decimal('0')
        denominator = Decimal('0')

        for i in range(1, len(yields)):
            diff = abs(yields[i] - yields[i - 1])
            total = yields[i] + yields[i - 1]
            numerator += diff
            denominator += total

        if denominator == 0:
            return Decimal('0')

        abi = (numerator / denominator).quantize(Decimal('0.001'), rounding=ROUND_HALF_UP)
        return min(abi, Decimal('1.000'))

    def _predict_bearing_state(
        self,
        seasons: List[BearingSeason],
        abi: Decimal,
        mean_yield: Decimal,
    ) -> tuple:
        """
        Predict bearing state for the next season and compute adjustment factor.

        Logic:
        - If ABI is low (<0.2), bearing pattern is weak -> neutral, factor 1.0
        - If ABI is moderate/high, look at last season:
          - Last was ON -> predict OFF, factor < 1.0
          - Last was OFF -> predict ON, factor > 1.0
          - Last was average -> predict neutral, small adjustment

        Returns: (predicted_state, adjustment_factor)
        """
        if abi < Decimal('0.2'):
            return 'neutral', Decimal('1.0')

        last_season = seasons[-1]
        # Scale adjustment by ABI strength
        adjustment_magnitude = min(abi * self.MAX_ADJUSTMENT / Decimal('0.5'), self.MAX_ADJUSTMENT)

        if last_season.classification == 'on':
            # After ON year, expect OFF
            factor = Decimal('1.0') - adjustment_magnitude
            return 'off', factor.quantize(Decimal('0.001'))
        elif last_season.classification == 'off':
            # After OFF year, expect ON
            factor = Decimal('1.0') + adjustment_magnitude
            return 'on', factor.quantize(Decimal('0.001'))
        else:
            # After average year, look at the 2-season pattern
            if len(seasons) >= 2:
                prev = seasons[-2]
                if prev.classification == 'on':
                    # Two seasons ago was ON, last was avg -> slight off tendency
                    factor = Decimal('1.0') - (adjustment_magnitude * Decimal('0.5'))
                    return 'off', factor.quantize(Decimal('0.001'))
                elif prev.classification == 'off':
                    factor = Decimal('1.0') + (adjustment_magnitude * Decimal('0.5'))
                    return 'on', factor.quantize(Decimal('0.001'))

            return 'neutral', Decimal('1.0')
