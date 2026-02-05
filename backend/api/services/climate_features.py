"""
Climate Feature Service for Yield Forecasting.

Computes GDD, chill hours, precipitation, and other climate-derived features
from existing CIMISDataCache records. Used by the YieldFeatureEngine.
"""
import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional

from django.db.models import QuerySet


@dataclass
class ClimateFeatures:
    """Climate features computed from CIMIS data for a date range."""
    gdd_cumulative: Optional[Decimal] = None
    gdd_base_temp_f: Decimal = Decimal('55.0')
    chill_hours_cumulative: Optional[Decimal] = None
    chill_portions: Optional[Decimal] = None
    precipitation_cumulative_in: Optional[Decimal] = None
    eto_cumulative_in: Optional[Decimal] = None
    heat_stress_days: Optional[int] = None
    frost_events: Optional[int] = None
    avg_temp_f: Optional[Decimal] = None
    data_completeness_pct: Decimal = Decimal('0')
    days_with_data: int = 0
    days_in_range: int = 0


class ClimateFeatureService:
    """
    Computes climate-derived features from CIMISDataCache records.

    Usage:
        service = ClimateFeatureService()
        features = service.compute_features(
            cimis_source_id='152',
            start_date=date(2025, 10, 1),
            end_date=date(2026, 2, 3),
            crop_category='citrus'
        )
    """

    # GDD base temps by crop category (Fahrenheit)
    GDD_BASE_TEMPS = {
        'citrus': Decimal('55.0'),
        'subtropical': Decimal('60.0'),      # avocado
        'deciduous_fruit': Decimal('50.0'),
        'nut': Decimal('50.0'),
        'vine': Decimal('50.0'),
        'row_crop': Decimal('50.0'),
        'vegetable': Decimal('50.0'),
        'berry': Decimal('50.0'),
    }
    GDD_UPPER_TEMP = Decimal('95.0')
    HEAT_STRESS_THRESHOLD_F = Decimal('105.0')
    FROST_THRESHOLD_F = Decimal('32.0')

    # Default chill accumulation window (Nov 1 - Mar 1)
    DEFAULT_CHILL_START_MONTH = 11
    DEFAULT_CHILL_START_DAY = 1
    DEFAULT_CHILL_END_MONTH = 3
    DEFAULT_CHILL_END_DAY = 1

    def compute_features(
        self,
        cimis_source_id: str,
        start_date: date,
        end_date: date,
        crop_category: str = 'citrus',
        chill_start_date: Optional[date] = None,
        chill_end_date: Optional[date] = None,
    ) -> ClimateFeatures:
        """
        Compute all climate features for a date range from CIMIS data.

        Args:
            cimis_source_id: CIMIS station ID or zip code
            start_date: Season start date
            end_date: End date (typically today or season end)
            crop_category: Crop category for GDD base temp selection
            chill_start_date: Override chill accumulation start (default Nov 1)
            chill_end_date: Override chill accumulation end (default Mar 1)
        """
        from api.models import CIMISDataCache

        records = CIMISDataCache.objects.filter(
            source_id=cimis_source_id,
            date__gte=start_date,
            date__lte=end_date,
        ).order_by('date')

        days_in_range = (end_date - start_date).days + 1
        days_with_data = records.filter(air_temp_max__isnull=False).count()
        completeness = Decimal(str(days_with_data / max(days_in_range, 1) * 100)).quantize(
            Decimal('0.1'), rounding=ROUND_HALF_UP
        )

        result = ClimateFeatures(
            days_in_range=days_in_range,
            days_with_data=days_with_data,
            data_completeness_pct=completeness,
        )

        if days_with_data == 0:
            return result

        records_list = list(records)

        # GDD
        base_temp = self.GDD_BASE_TEMPS.get(crop_category, Decimal('55.0'))
        result.gdd_base_temp_f = base_temp
        result.gdd_cumulative = self._compute_gdd(records_list, base_temp)

        # Precipitation
        result.precipitation_cumulative_in = self._compute_cumulative_precip(records_list)

        # ETo
        result.eto_cumulative_in = self._compute_cumulative_eto(records_list)

        # Heat stress and frost
        result.heat_stress_days = self._count_heat_stress_days(records_list)
        result.frost_events = self._count_frost_events(records_list)

        # Average temperature
        result.avg_temp_f = self._compute_avg_temp(records_list)

        # Chill hours (only for relevant window)
        chill_records = self._filter_chill_window(
            records_list, start_date, end_date, chill_start_date, chill_end_date
        )
        if chill_records:
            result.chill_hours_cumulative = self._compute_chill_hours_utah(chill_records)
            result.chill_portions = self._compute_chill_portions_dynamic(chill_records)

        return result

    def _compute_gdd(self, records: list, base_temp: Decimal) -> Decimal:
        """
        GDD accumulation using single-triangle / simple average method.
        GDD = max(0, (Tmax + Tmin) / 2 - Tbase)
        Caps Tmax at upper threshold to avoid overestimating in extreme heat.
        """
        total = Decimal('0')
        for rec in records:
            if rec.air_temp_max is None or rec.air_temp_min is None:
                continue
            tmax = min(rec.air_temp_max, self.GDD_UPPER_TEMP)
            tmin = max(rec.air_temp_min, base_temp)
            if tmax < tmin:
                continue
            daily_gdd = (tmax + tmin) / 2 - base_temp
            if daily_gdd > 0:
                total += daily_gdd
        return total.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)

    def _compute_cumulative_precip(self, records: list) -> Decimal:
        total = Decimal('0')
        for rec in records:
            if rec.precipitation is not None:
                total += rec.precipitation
        return total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def _compute_cumulative_eto(self, records: list) -> Decimal:
        total = Decimal('0')
        for rec in records:
            if rec.eto is not None:
                total += rec.eto
        return total.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def _count_heat_stress_days(self, records: list) -> int:
        count = 0
        for rec in records:
            if rec.air_temp_max is not None and rec.air_temp_max > self.HEAT_STRESS_THRESHOLD_F:
                count += 1
        return count

    def _count_frost_events(self, records: list) -> int:
        count = 0
        for rec in records:
            if rec.air_temp_min is not None and rec.air_temp_min < self.FROST_THRESHOLD_F:
                count += 1
        return count

    def _compute_avg_temp(self, records: list) -> Optional[Decimal]:
        temps = [rec.air_temp_avg for rec in records if rec.air_temp_avg is not None]
        if not temps:
            return None
        avg = sum(temps) / len(temps)
        return Decimal(str(avg)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)

    def _filter_chill_window(
        self,
        records: list,
        season_start: date,
        season_end: date,
        chill_start_date: Optional[date],
        chill_end_date: Optional[date],
    ) -> list:
        """Filter records to the chill accumulation window."""
        if chill_start_date and chill_end_date:
            c_start = chill_start_date
            c_end = chill_end_date
        else:
            # Determine chill window year from season dates
            # For a citrus season starting Oct 2025, chill window is Nov 2025 - Mar 2026
            year = season_start.year
            c_start = date(year, self.DEFAULT_CHILL_START_MONTH, self.DEFAULT_CHILL_START_DAY)
            if c_start < season_start:
                c_start = date(year + 1, self.DEFAULT_CHILL_START_MONTH, self.DEFAULT_CHILL_START_DAY)
            c_end = date(c_start.year + 1, self.DEFAULT_CHILL_END_MONTH, self.DEFAULT_CHILL_END_DAY)
            if c_start.month >= self.DEFAULT_CHILL_START_MONTH:
                c_end = date(c_start.year + 1, self.DEFAULT_CHILL_END_MONTH, self.DEFAULT_CHILL_END_DAY)
            else:
                c_end = date(c_start.year, self.DEFAULT_CHILL_END_MONTH, self.DEFAULT_CHILL_END_DAY)

        # Clamp to actual data range
        c_end = min(c_end, season_end)

        return [r for r in records if c_start <= r.date <= c_end]

    def _compute_chill_hours_utah(self, records: list) -> Decimal:
        """
        Utah chill model: assigns weighted chill units based on temperature ranges.
        Estimates 24 hourly temps from daily min/max using sinusoidal interpolation.

        Utah model weights (Fahrenheit):
            <= 34.0:    0.0
            34.1 - 36.0: 0.5
            36.1 - 48.0: 1.0
            48.1 - 54.0: 0.5
            54.1 - 60.0: 0.0
            60.1 - 65.0: -0.5
            > 65.0:     -1.0
        """
        total_chill = Decimal('0')

        for rec in records:
            if rec.air_temp_min is None or rec.air_temp_max is None:
                continue
            hourly_temps = self._estimate_hourly_temps(
                float(rec.air_temp_min), float(rec.air_temp_max)
            )
            daily_chill = Decimal('0')
            for temp in hourly_temps:
                if temp <= 34.0:
                    daily_chill += Decimal('0')
                elif temp <= 36.0:
                    daily_chill += Decimal('0.5')
                elif temp <= 48.0:
                    daily_chill += Decimal('1.0')
                elif temp <= 54.0:
                    daily_chill += Decimal('0.5')
                elif temp <= 60.0:
                    daily_chill += Decimal('0')
                elif temp <= 65.0:
                    daily_chill -= Decimal('0.5')
                else:
                    daily_chill -= Decimal('1.0')
            total_chill += daily_chill

        # Chill hours can't go below zero cumulatively
        return max(total_chill, Decimal('0')).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)

    def _compute_chill_portions_dynamic(self, records: list) -> Decimal:
        """
        Dynamic (Fishman) chill portions model.
        Preferred for mild California climates where the Utah model underperforms.

        Simplified implementation: accumulates chill portions based on
        effective temperature ranges. Full dynamic model uses a two-step
        biochemical approach; this is an approximation suitable for Phase 1.

        Optimal chill temp range: 37-54F (2.8-12.2C).
        Each day fully in this range contributes ~1 portion.
        """
        total_portions = Decimal('0')
        OPTIMAL_LOW = 37.0
        OPTIMAL_HIGH = 54.0
        EFFECTIVE_LOW = 32.0
        EFFECTIVE_HIGH = 62.0

        for rec in records:
            if rec.air_temp_min is None or rec.air_temp_max is None:
                continue
            hourly_temps = self._estimate_hourly_temps(
                float(rec.air_temp_min), float(rec.air_temp_max)
            )
            effective_hours = 0
            for temp in hourly_temps:
                if OPTIMAL_LOW <= temp <= OPTIMAL_HIGH:
                    effective_hours += 1.0
                elif EFFECTIVE_LOW <= temp < OPTIMAL_LOW:
                    # Partial credit for marginal temps
                    effective_hours += 0.5
                elif OPTIMAL_HIGH < temp <= EFFECTIVE_HIGH:
                    effective_hours += 0.3

            # ~24 effective hours = 1 chill portion
            daily_portion = Decimal(str(effective_hours / 24.0))
            total_portions += daily_portion

        return total_portions.quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)

    def _estimate_hourly_temps(self, temp_min: float, temp_max: float) -> List[float]:
        """
        Estimate 24 hourly temperatures from daily min/max using a sinusoidal model.
        Assumes min temp at 6:00 AM (hour 6) and max temp at 3:00 PM (hour 15).
        """
        temps = []
        avg = (temp_min + temp_max) / 2.0
        amp = (temp_max - temp_min) / 2.0

        for hour in range(24):
            # Phase shift: max at hour 15, min at hour 3 (shifted sine)
            # sin peaks at pi/2, so we want peak at hour 15
            angle = math.pi * (hour - 9) / 12.0
            temp = avg + amp * math.sin(angle)
            temps.append(temp)

        return temps
