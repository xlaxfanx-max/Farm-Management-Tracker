"""
Yield Forecast Service.

Generates yield forecasts per field per season using historical data,
climate features, and alternate bearing analysis. Supports graceful
degradation through multiple fallback tiers when data is incomplete.

Fallback tiers:
1. Full data (3+ seasons + climate + vegetation + soil) -> climate_adjusted
2. No remote sensing -> climate_adjusted without vegetation features
3. No climate data -> bearing_adjusted (historical avg + bearing)
4. <2 seasons of field history -> crop_baseline (company/crop averages)
5. No harvests at all -> skip with message
"""
import logging
import math
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional, Tuple

from django.db import transaction

logger = logging.getLogger(__name__)


@dataclass
class ForecastResult:
    """Result from the yield forecast model."""
    predicted_yield_per_acre: Decimal = Decimal('0')
    predicted_total_yield: Decimal = Decimal('0')
    yield_unit: str = 'bins'
    harvestable_acres: Decimal = Decimal('0')
    lower_bound_per_acre: Decimal = Decimal('0')
    upper_bound_per_acre: Decimal = Decimal('0')
    confidence_level: Decimal = Decimal('0.80')
    forecast_method: str = 'historical_avg'
    model_version: str = 'v1.0-phase1'
    climate_adjustment_factor: Optional[Decimal] = None
    feature_importance: Dict = field(default_factory=dict)
    feature_snapshot_id: Optional[int] = None
    data_completeness_pct: Optional[Decimal] = None
    degradation_warnings: List[str] = field(default_factory=list)
    notes: str = ''
    skipped: bool = False
    skip_reason: str = ''


class YieldForecastService:
    """
    Generates yield forecasts for fields using tiered methodology.

    Usage:
        service = YieldForecastService(company_id=1)
        result = service.forecast_field(field_id=42, season_label='2025-2026')
        service.save_forecast(field_id=42, season_label='2025-2026', result=result)
    """

    MIN_SEASONS_FOR_FIELD_FORECAST = 2
    MIN_SEASONS_FOR_CLIMATE_ADJUSTED = 3
    DEFAULT_CONFIDENCE_LEVEL = Decimal('0.80')
    Z_SCORE_80 = Decimal('1.282')  # z-score for 80% CI
    HISTORY_LOOKBACK_SEASONS = 5

    # Data penalty: CI widens by this factor per missing feature category
    DATA_PENALTY_PER_MISSING_CATEGORY = Decimal('0.15')
    MAX_DATA_PENALTY = Decimal('1.0')  # at most double the CI width

    # Climate deviation weights for adjustment factor
    CLIMATE_WEIGHTS = {
        'gdd_deviation_pct': Decimal('0.25'),
        'chill_deviation_pct': Decimal('0.20'),
        'precip_deviation_pct': Decimal('0.15'),
        'heat_stress_deviation': Decimal('0.10'),
        'frost_deviation': Decimal('0.10'),
    }
    BEARING_WEIGHT = Decimal('0.20')

    def __init__(self, company_id: int):
        self.company_id = company_id

    def forecast_field(
        self,
        field_id: int,
        season_label: str,
        method: str = 'auto',
    ) -> ForecastResult:
        """
        Generate a yield forecast for a single field.

        Args:
            field_id: Field to forecast
            season_label: Season being forecasted
            method: 'auto' selects best available, or force: 'historical_avg',
                     'climate_adjusted', 'bearing_adjusted', 'crop_baseline'
        """
        from api.models import Field

        try:
            field_obj = Field.objects.select_related(
                'farm', 'crop', 'rootstock'
            ).get(id=field_id, farm__company_id=self.company_id)
        except Field.DoesNotExist:
            return ForecastResult(
                skipped=True,
                skip_reason=f"Field {field_id} not found for company {self.company_id}."
            )

        # Determine yield unit
        yield_unit = self._resolve_yield_unit(field_obj)
        harvestable_acres = field_obj.total_acres or Decimal('0')

        if harvestable_acres <= 0:
            return ForecastResult(
                skipped=True,
                skip_reason="Field has no acreage set."
            )

        # Get historical yields
        historical = self._get_historical_yields(field_id, season_label, field_obj)

        # Assemble features
        snapshot = None
        features_result = None
        try:
            from api.services.yield_feature_engine import YieldFeatureEngine
            engine = YieldFeatureEngine(company_id=self.company_id)
            features_result = engine.assemble_features(field_id, season_label)
            snapshot = engine.save_snapshot(features_result)
        except Exception as e:
            logger.warning(f"Feature assembly failed for field {field_id}: {e}")

        # Determine best method
        if method == 'auto':
            method = self._select_method(historical, features_result)

        # Execute forecast
        if method == 'climate_adjusted':
            result = self._climate_adjusted(
                historical, features_result, yield_unit, harvestable_acres
            )
        elif method == 'bearing_adjusted':
            result = self._bearing_adjusted(
                historical, features_result, yield_unit, harvestable_acres
            )
        elif method == 'crop_baseline':
            result = self._crop_baseline(
                field_obj, yield_unit, harvestable_acres
            )
        else:
            result = self._historical_average(
                historical, yield_unit, harvestable_acres
            )

        # Attach snapshot
        if snapshot:
            result.feature_snapshot_id = snapshot.id
            result.data_completeness_pct = Decimal(
                str(features_result.data_quality.get('completeness_pct', 0))
            )
            result.degradation_warnings.extend(features_result.warnings)

        return result

    def forecast_all_fields(
        self,
        season_label: Optional[str] = None,
        crop_category: Optional[str] = None,
    ) -> List[Tuple[int, str, ForecastResult]]:
        """
        Run forecasts for all eligible fields in the company.

        Returns: List of (field_id, resolved_season_label, ForecastResult) tuples
        """
        from api.models import Field
        from api.services.season_service import SeasonService

        fields = Field.objects.select_related('farm', 'crop').filter(
            farm__company_id=self.company_id,
            farm__active=True,
        )
        if crop_category:
            fields = fields.filter(crop__category=crop_category)

        results = []
        for field_obj in fields:
            # Resolve season if not specified
            label = season_label
            if not label:
                season_service = SeasonService()
                cat = field_obj.crop.category if field_obj.crop else 'citrus'
                current = season_service.get_current_season(crop_category=cat)
                label = current.label

            result = self.forecast_field(field_obj.id, label)
            results.append((field_obj.id, label, result))

        return results

    def save_forecast(
        self,
        field_id: int,
        season_label: str,
        result: ForecastResult,
        user=None,
        auto_publish: bool = False,
    ) -> Optional['YieldForecast']:
        """Persist a ForecastResult to the YieldForecast model."""
        from api.models import YieldForecast

        if result.skipped:
            return None

        with transaction.atomic():
            # Supersede any existing published forecasts for this field/season
            YieldForecast.objects.filter(
                field_id=field_id,
                season_label=season_label,
                status='published',
            ).update(status='superseded')

            forecast = YieldForecast.objects.create(
                field_id=field_id,
                season_label=season_label,
                forecast_date=date.today(),
                predicted_yield_per_acre=result.predicted_yield_per_acre,
                predicted_total_yield=result.predicted_total_yield,
                yield_unit=result.yield_unit,
                harvestable_acres=result.harvestable_acres,
                confidence_level=result.confidence_level,
                lower_bound_per_acre=result.lower_bound_per_acre,
                upper_bound_per_acre=result.upper_bound_per_acre,
                forecast_method=result.forecast_method,
                model_version=result.model_version,
                feature_snapshot_id=result.feature_snapshot_id,
                feature_importance=result.feature_importance,
                climate_adjustment_factor=result.climate_adjustment_factor,
                data_completeness_pct=result.data_completeness_pct,
                degradation_warnings=result.degradation_warnings,
                notes=result.notes,
                status='published' if auto_publish else 'draft',
                created_by=user,
            )
        return forecast

    def backfill_actuals(self, season_label: str) -> int:
        """
        After harvest, populate actual_yield fields on forecasts.
        Returns count of forecasts updated.
        """
        from api.models import Harvest, YieldForecast
        from api.services.season_service import SeasonService
        from django.db.models import Sum, F

        forecasts = YieldForecast.objects.filter(
            field__farm__company_id=self.company_id,
            season_label=season_label,
            actual_yield_per_acre__isnull=True,
        ).select_related('field', 'field__crop')

        updated = 0
        season_service = SeasonService()

        for forecast in forecasts:
            crop_category = 'citrus'
            if forecast.field.crop:
                crop_category = forecast.field.crop.category or 'citrus'

            try:
                start, end = season_service.get_season_date_range(
                    season_label, crop_category=crop_category
                )
            except Exception:
                continue

            harvests = Harvest.objects.filter(
                field_id=forecast.field_id,
                harvest_date__gte=start,
                harvest_date__lte=end,
                status='completed',
            )

            total_yield = Decimal('0')
            total_acres = Decimal('0')

            for h in harvests:
                qty = h.primary_quantity
                if qty and h.acres_harvested:
                    total_yield += Decimal(str(qty))
                    total_acres += h.acres_harvested

            if total_acres > 0:
                actual_ypa = (total_yield / total_acres).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
                actual_total = total_yield.quantize(Decimal('0.01'))

                error_pct = Decimal('0')
                if actual_ypa > 0:
                    error_pct = (
                        abs(actual_ypa - forecast.predicted_yield_per_acre) / actual_ypa * 100
                    ).quantize(Decimal('0.01'))

                forecast.actual_yield_per_acre = actual_ypa
                forecast.actual_total_yield = actual_total
                forecast.forecast_error_pct = error_pct
                forecast.save(update_fields=[
                    'actual_yield_per_acre', 'actual_total_yield',
                    'forecast_error_pct', 'updated_at',
                ])
                updated += 1

        return updated

    # -------------------------------------------------------------------------
    # Forecast methods
    # -------------------------------------------------------------------------

    def _select_method(
        self, historical: List[Decimal], features_result
    ) -> str:
        """Select the best forecast method based on available data."""
        has_climate = False
        if features_result:
            has_climate = features_result.features.get('gdd_cumulative') is not None

        n_seasons = len(historical)

        if n_seasons >= self.MIN_SEASONS_FOR_CLIMATE_ADJUSTED and has_climate:
            return 'climate_adjusted'
        elif n_seasons >= self.MIN_SEASONS_FOR_FIELD_FORECAST:
            return 'bearing_adjusted'
        elif n_seasons >= 1:
            return 'historical_avg'
        else:
            return 'crop_baseline'

    def _historical_average(
        self,
        historical: List[Decimal],
        yield_unit: str,
        harvestable_acres: Decimal,
    ) -> ForecastResult:
        """Simple mean of historical yield per acre."""
        if not historical:
            return ForecastResult(
                skipped=True,
                skip_reason="No historical yield data available."
            )

        mean = sum(historical) / len(historical)
        std_dev = self._std_dev(historical, mean)

        lower, upper = self._compute_ci(mean, std_dev, len(historical))

        return ForecastResult(
            predicted_yield_per_acre=mean.quantize(Decimal('0.01')),
            predicted_total_yield=(mean * harvestable_acres).quantize(Decimal('0.01')),
            yield_unit=yield_unit,
            harvestable_acres=harvestable_acres,
            lower_bound_per_acre=lower,
            upper_bound_per_acre=upper,
            forecast_method='historical_avg',
            feature_importance={'historical_mean': 1.0},
            notes=f"Based on {len(historical)} season(s) of historical data.",
        )

    def _climate_adjusted(
        self,
        historical: List[Decimal],
        features_result,
        yield_unit: str,
        harvestable_acres: Decimal,
    ) -> ForecastResult:
        """
        Historical average adjusted by climate deviations and bearing state.

        Algorithm:
        1. Compute mean yield from last N seasons
        2. Get current season climate features
        3. Compare to historical climate norms (from feature snapshots or CIMIS averages)
        4. Compute adjustment factor from weighted deviations
        5. Apply bearing adjustment
        6. predicted = mean * total_adjustment
        """
        mean = sum(historical) / len(historical)
        std_dev = self._std_dev(historical, mean)

        # Climate adjustment
        climate_factor = Decimal('1.0')
        importance = {}

        if features_result:
            f = features_result.features

            # GDD deviation: compare to what we'd expect at this point in season
            # For Phase 1, use a simple heuristic: if GDD is present, assume
            # normal is the average of historical GDD at this point
            # (proper norm computation comes in Phase 2 with stored historical features)
            # For now, use the feature presence as a quality signal

            # Bearing adjustment (most impactful for avocados)
            bearing_idx = f.get('alternate_bearing_index')
            prior_yield = f.get('prior_season_yield_per_acre')
            if bearing_idx is not None and prior_yield is not None and mean > 0:
                # If strong alternation and prior yield was above/below mean,
                # expect reversion
                yield_ratio = prior_yield / mean
                if yield_ratio > Decimal('1.15'):
                    # Last year was high -> expect lower
                    bearing_adj = Decimal('1.0') - (
                        min(bearing_idx, Decimal('1.0')) * self.BEARING_WEIGHT
                    )
                    climate_factor *= bearing_adj
                    importance['alternate_bearing'] = float(self.BEARING_WEIGHT)
                elif yield_ratio < Decimal('0.85'):
                    # Last year was low -> expect higher
                    bearing_adj = Decimal('1.0') + (
                        min(bearing_idx, Decimal('1.0')) * self.BEARING_WEIGHT
                    )
                    climate_factor *= bearing_adj
                    importance['alternate_bearing'] = float(self.BEARING_WEIGHT)

            # Heat stress penalty
            heat_days = f.get('heat_stress_days')
            if heat_days is not None and heat_days > 5:
                # Each heat stress day beyond 5 reduces yield by ~1%
                penalty = Decimal(str(min(heat_days - 5, 15))) * Decimal('0.01')
                climate_factor *= (Decimal('1.0') - penalty)
                importance['heat_stress'] = float(penalty)

            # Frost penalty
            frost_days = f.get('frost_events')
            if frost_days is not None and frost_days > 2:
                penalty = Decimal(str(min(frost_days - 2, 10))) * Decimal('0.015')
                climate_factor *= (Decimal('1.0') - penalty)
                importance['frost_events'] = float(penalty)

            importance['historical_mean'] = 0.5
            importance['climate_adjustment'] = float(abs(climate_factor - Decimal('1.0')))

        predicted = (mean * climate_factor).quantize(Decimal('0.01'))

        # Widen CI based on data completeness
        data_penalty = Decimal('0')
        warnings = []
        if features_result:
            quality = features_result.data_quality
            missing_categories = sum(
                1 for k in ['gdd_cumulative', 'ndvi_mean', 'soil_awc',
                            'alternate_bearing_index', 'irrigation_applied_in']
                if not quality.get(k, False)
            )
            data_penalty = min(
                missing_categories * self.DATA_PENALTY_PER_MISSING_CATEGORY,
                self.MAX_DATA_PENALTY,
            )
            if missing_categories > 0:
                warnings.append(
                    f"{missing_categories} feature categories missing - CI widened."
                )

        effective_std = std_dev * (Decimal('1.0') + data_penalty)
        lower, upper = self._compute_ci(predicted, effective_std, len(historical))

        result = ForecastResult(
            predicted_yield_per_acre=predicted,
            predicted_total_yield=(predicted * harvestable_acres).quantize(Decimal('0.01')),
            yield_unit=yield_unit,
            harvestable_acres=harvestable_acres,
            lower_bound_per_acre=lower,
            upper_bound_per_acre=upper,
            forecast_method='climate_adjusted',
            climate_adjustment_factor=climate_factor.quantize(Decimal('0.001')),
            feature_importance=importance,
            notes=f"Climate-adjusted forecast from {len(historical)} seasons.",
        )
        result.degradation_warnings = warnings
        return result

    def _bearing_adjusted(
        self,
        historical: List[Decimal],
        features_result,
        yield_unit: str,
        harvestable_acres: Decimal,
    ) -> ForecastResult:
        """Historical average with bearing adjustment only (no climate data)."""
        mean = sum(historical) / len(historical)
        std_dev = self._std_dev(historical, mean)

        bearing_factor = Decimal('1.0')
        importance = {'historical_mean': 0.7}

        if features_result:
            f = features_result.features
            bearing_idx = f.get('alternate_bearing_index')
            prior_yield = f.get('prior_season_yield_per_acre')
            if bearing_idx is not None and prior_yield is not None and mean > 0:
                yield_ratio = prior_yield / mean
                if yield_ratio > Decimal('1.15'):
                    bearing_factor = Decimal('1.0') - (
                        min(bearing_idx, Decimal('1.0')) * Decimal('0.25')
                    )
                elif yield_ratio < Decimal('0.85'):
                    bearing_factor = Decimal('1.0') + (
                        min(bearing_idx, Decimal('1.0')) * Decimal('0.25')
                    )
                importance['alternate_bearing'] = 0.3

        predicted = (mean * bearing_factor).quantize(Decimal('0.01'))

        # Wider CI since no climate data
        effective_std = std_dev * Decimal('1.3')
        lower, upper = self._compute_ci(predicted, effective_std, len(historical))

        return ForecastResult(
            predicted_yield_per_acre=predicted,
            predicted_total_yield=(predicted * harvestable_acres).quantize(Decimal('0.01')),
            yield_unit=yield_unit,
            harvestable_acres=harvestable_acres,
            lower_bound_per_acre=lower,
            upper_bound_per_acre=upper,
            forecast_method='bearing_adjusted',
            climate_adjustment_factor=bearing_factor.quantize(Decimal('0.001')),
            feature_importance=importance,
            degradation_warnings=[
                "No climate data available - using bearing-adjusted historical average.",
            ],
            notes=f"Bearing-adjusted from {len(historical)} seasons (no climate data).",
        )

    # Industry-standard baseline yields per crop category
    # These are conservative California averages used as last-resort defaults
    CROP_CATEGORY_DEFAULTS = {
        'citrus': {'yield': Decimal('400'), 'unit': 'bins', 'label': 'CA citrus average'},
        'subtropical': {'yield': Decimal('10000'), 'unit': 'lbs', 'label': 'CA avocado average'},
        'deciduous_fruit': {'yield': Decimal('300'), 'unit': 'bins', 'label': 'CA deciduous average'},
    }
    DEFAULT_CROP_BASELINE = {'yield': Decimal('350'), 'unit': 'bins', 'label': 'general crop average'}

    def _crop_baseline(
        self,
        field_obj,
        yield_unit: str,
        harvestable_acres: Decimal,
    ) -> ForecastResult:
        """
        Fallback: use company-wide average for same crop, or expected_yield_per_acre,
        or industry defaults. This method never skips - it always produces a forecast.
        """
        from api.models import Harvest
        from django.db.models import Q

        predicted = None
        notes_parts = []
        warnings = [
            "Insufficient field history - using crop-level baseline.",
            "Forecast accuracy will improve as more seasons are harvested.",
        ]

        # Tier 1: Field's expected yield
        if field_obj.expected_yield_per_acre:
            predicted = field_obj.expected_yield_per_acre
            notes_parts.append("Using field's expected yield per acre.")

        # Tier 2: Company-wide average for same crop
        if predicted is None and field_obj.crop:
            company_harvests = Harvest.objects.filter(
                field__farm__company_id=self.company_id,
                field__crop=field_obj.crop,
                status='completed',
            ).exclude(
                Q(total_bins=0) & Q(estimated_weight_lbs__isnull=True)
            )

            yields = []
            for h in company_harvests:
                qty = h.primary_quantity
                if qty and h.acres_harvested and h.acres_harvested > 0:
                    yields.append(Decimal(str(qty)) / h.acres_harvested)

            if yields:
                predicted = (sum(yields) / len(yields)).quantize(Decimal('0.01'))
                notes_parts.append(
                    f"Using company average for {field_obj.crop.name} "
                    f"({len(yields)} harvests)."
                )

        # Tier 3: Industry defaults for crop category
        if predicted is None:
            crop_category = 'citrus'
            if field_obj.crop and hasattr(field_obj.crop, 'category'):
                crop_category = field_obj.crop.category or 'citrus'

            defaults = self.CROP_CATEGORY_DEFAULTS.get(
                crop_category, self.DEFAULT_CROP_BASELINE
            )
            predicted = defaults['yield']
            notes_parts.append(f"Using {defaults['label']} (~{predicted} {defaults['unit']}/acre).")
            warnings.append(
                "No field or company data available - using industry baseline. "
                "Set 'Expected Yield/Acre' on your fields for better estimates."
            )

        # Very wide CI for baseline forecasts
        ci_width = predicted * Decimal('0.40')  # +/- 40%
        lower = max(predicted - ci_width, Decimal('0'))
        upper = predicted + ci_width

        return ForecastResult(
            predicted_yield_per_acre=predicted,
            predicted_total_yield=(predicted * harvestable_acres).quantize(Decimal('0.01')),
            yield_unit=yield_unit,
            harvestable_acres=harvestable_acres,
            lower_bound_per_acre=lower.quantize(Decimal('0.01')),
            upper_bound_per_acre=upper.quantize(Decimal('0.01')),
            forecast_method='crop_baseline',
            feature_importance={'crop_baseline': 1.0},
            degradation_warnings=warnings,
            notes=' '.join(notes_parts),
        )

    # -------------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------------

    def _get_historical_yields(
        self, field_id: int, current_season_label: str, field_obj
    ) -> List[Decimal]:
        """Get per-acre yields for the last N seasons."""
        from api.models import Harvest
        from api.services.season_service import SeasonService
        from django.db.models import Q

        crop_category = 'citrus'
        if field_obj.crop and hasattr(field_obj.crop, 'category'):
            crop_category = field_obj.crop.category or 'citrus'

        season_service = SeasonService()
        harvests = Harvest.objects.filter(
            field_id=field_id,
            field__farm__company_id=self.company_id,
            status='completed',
        ).exclude(
            Q(total_bins=0) & Q(estimated_weight_lbs__isnull=True)
        ).order_by('harvest_date')

        season_yields = {}
        for h in harvests:
            season = season_service.get_current_season(
                crop_category=crop_category, target_date=h.harvest_date
            )
            if season.label == current_season_label:
                continue

            if season.label not in season_yields:
                season_yields[season.label] = {'yield': Decimal('0'), 'acres': Decimal('0')}

            qty = h.primary_quantity
            if qty and h.acres_harvested:
                season_yields[season.label]['yield'] += Decimal(str(qty))
                season_yields[season.label]['acres'] += h.acres_harvested

        # Convert to per-acre, take last N seasons
        yields = []
        for label in sorted(season_yields.keys()):
            data = season_yields[label]
            if data['acres'] > 0:
                ypa = (data['yield'] / data['acres']).quantize(Decimal('0.01'))
                yields.append(ypa)

        return yields[-self.HISTORY_LOOKBACK_SEASONS:]

    def _resolve_yield_unit(self, field_obj) -> str:
        """Determine the appropriate yield unit for a field's crop."""
        if field_obj.yield_unit:
            return field_obj.yield_unit

        if field_obj.crop and hasattr(field_obj.crop, 'category'):
            category = field_obj.crop.category
            if category == 'subtropical':
                return 'lbs'
            elif category in ('citrus', 'deciduous_fruit'):
                return 'bins'

        return 'bins'

    def _std_dev(self, values: List[Decimal], mean: Decimal) -> Decimal:
        """Compute sample standard deviation."""
        if len(values) < 2:
            # With only 1 data point, estimate std_dev as 20% of mean
            return mean * Decimal('0.2')

        variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
        std = Decimal(str(math.sqrt(float(variance))))
        return std.quantize(Decimal('0.01'))

    def _compute_ci(
        self,
        predicted: Decimal,
        std_dev: Decimal,
        n_samples: int,
    ) -> Tuple[Decimal, Decimal]:
        """
        Compute confidence interval.
        Uses z-score for 80% CI (1.282) with sample size adjustment.
        """
        if n_samples <= 0:
            margin = predicted * Decimal('0.35')
        else:
            # Standard error of the mean, adjusted for small samples
            se = std_dev / Decimal(str(math.sqrt(max(n_samples, 1))))
            margin = self.Z_SCORE_80 * se
            # Floor: at least 5% margin
            min_margin = predicted * Decimal('0.05')
            margin = max(margin, min_margin)

        lower = max(predicted - margin, Decimal('0')).quantize(Decimal('0.01'))
        upper = (predicted + margin).quantize(Decimal('0.01'))
        return lower, upper
