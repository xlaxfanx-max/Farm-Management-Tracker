"""
Yield Feature Engine for Yield Forecasting.

Assembles all features for a field/season into a feature vector.
Orchestrates ClimateFeatureService, AlternateBearingService, and
pulls from Field, SoilSurveyData, IrrigationEvent, NutrientApplication, etc.

All feature sources are optional - the engine degrades gracefully when data is missing.
"""
import logging
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class AssembledFeatures:
    """Complete feature set assembled for a field/season."""
    field_id: int
    season_label: str
    snapshot_date: date
    features: Dict = field(default_factory=dict)
    data_quality: Dict = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)


class YieldFeatureEngine:
    """
    Assembles all features for a field/season into a feature vector.

    Each _get_* method returns None for missing values rather than raising.
    The data_quality dict tracks which features have data and overall completeness.

    Usage:
        engine = YieldFeatureEngine(company_id=1)
        result = engine.assemble_features(field_id=42, season_label='2025-2026')
        snapshot = engine.save_snapshot(result)
    """

    # All expected feature keys for completeness tracking
    EXPECTED_FEATURES = [
        'gdd_cumulative', 'chill_hours_cumulative', 'chill_portions',
        'precipitation_cumulative_in', 'eto_cumulative_in',
        'heat_stress_days', 'frost_events',
        'ndvi_mean', 'ndvi_trend', 'canopy_coverage_pct', 'tree_height_avg_m',
        'alternate_bearing_index', 'prior_season_yield_per_acre',
        'tree_age_years', 'trees_per_acre', 'irrigation_type', 'soil_type',
        'rootstock_vigor', 'organic_status',
        'soil_awc', 'soil_clay_pct', 'soil_ph',
        'irrigation_applied_in', 'total_nitrogen_lbs_per_acre',
    ]

    def __init__(self, company_id: int):
        self.company_id = company_id

    def assemble_features(
        self,
        field_id: int,
        season_label: str,
        snapshot_date: Optional[date] = None,
    ) -> AssembledFeatures:
        """
        Assemble all features for a field/season.

        Args:
            field_id: Field to compute features for
            season_label: Season being forecasted
            snapshot_date: Date of snapshot (default: today)
        """
        from api.models import Field
        from api.services.season_service import SeasonService

        if snapshot_date is None:
            snapshot_date = date.today()

        result = AssembledFeatures(
            field_id=field_id,
            season_label=season_label,
            snapshot_date=snapshot_date,
        )

        # Load field with related data
        try:
            field_obj = Field.objects.select_related(
                'farm', 'crop', 'rootstock'
            ).get(id=field_id, farm__company_id=self.company_id)
        except Field.DoesNotExist:
            result.warnings.append(f"Field {field_id} not found for company {self.company_id}.")
            return result

        # Resolve season dates
        season_service = SeasonService()
        crop_category = 'citrus'
        if field_obj.crop and hasattr(field_obj.crop, 'category'):
            crop_category = field_obj.crop.category or 'citrus'

        try:
            season_start, season_end = season_service.get_season_date_range(
                season_label, crop_category=crop_category
            )
        except Exception as e:
            result.warnings.append(f"Could not resolve season dates: {e}")
            return result

        # Clamp end date to snapshot date (don't use future data)
        effective_end = min(season_end, snapshot_date)

        # Assemble each feature group
        features = {}
        quality = {}

        # Climate
        climate = self._get_climate_features(field_obj, season_start, effective_end, crop_category)
        features.update(climate)

        # Vegetation
        vegetation = self._get_vegetation_features(field_obj)
        features.update(vegetation)

        # Alternate bearing
        bearing = self._get_bearing_features(field_id, season_label, crop_category)
        features.update(bearing)

        # Field characteristics
        field_chars = self._get_field_characteristics(field_obj)
        features.update(field_chars)

        # Soil survey
        soil = self._get_soil_features(field_obj)
        features.update(soil)

        # Irrigation
        irrigation = self._get_irrigation_features(field_id, season_start, effective_end)
        features.update(irrigation)

        # Nutrients
        nutrients = self._get_nutrient_features(field_id, field_obj, season_start, effective_end)
        features.update(nutrients)

        # Compute data quality
        available_count = 0
        for key in self.EXPECTED_FEATURES:
            has_data = features.get(key) is not None
            quality[key] = has_data
            if has_data:
                available_count += 1

        quality['completeness_pct'] = round(
            available_count / max(len(self.EXPECTED_FEATURES), 1) * 100, 1
        )

        result.features = features
        result.data_quality = quality
        return result

    def save_snapshot(self, assembled: AssembledFeatures) -> 'YieldFeatureSnapshot':
        """Persist assembled features to a YieldFeatureSnapshot record."""
        from api.models import YieldFeatureSnapshot

        f = assembled.features
        snapshot, _ = YieldFeatureSnapshot.objects.update_or_create(
            field_id=assembled.field_id,
            season_label=assembled.season_label,
            snapshot_date=assembled.snapshot_date,
            defaults={
                # Climate
                'gdd_cumulative': f.get('gdd_cumulative'),
                'gdd_base_temp_f': f.get('gdd_base_temp_f', Decimal('55.0')),
                'chill_hours_cumulative': f.get('chill_hours_cumulative'),
                'chill_portions': f.get('chill_portions'),
                'precipitation_cumulative_in': f.get('precipitation_cumulative_in'),
                'heat_stress_days': f.get('heat_stress_days'),
                'frost_events': f.get('frost_events'),
                'eto_cumulative_in': f.get('eto_cumulative_in'),
                # Vegetation
                'ndvi_mean': f.get('ndvi_mean'),
                'ndvi_trend': f.get('ndvi_trend'),
                'canopy_coverage_pct': f.get('canopy_coverage_pct'),
                'tree_height_avg_m': f.get('tree_height_avg_m'),
                # Bearing
                'alternate_bearing_index': f.get('alternate_bearing_index'),
                'prior_season_yield_per_acre': f.get('prior_season_yield_per_acre'),
                # Field characteristics
                'tree_age_years': f.get('tree_age_years'),
                'trees_per_acre': f.get('trees_per_acre'),
                'irrigation_type': f.get('irrigation_type', ''),
                'soil_type': f.get('soil_type', ''),
                'rootstock_vigor': f.get('rootstock_vigor', ''),
                'organic_status': f.get('organic_status', ''),
                # Soil survey
                'soil_awc': f.get('soil_awc'),
                'soil_clay_pct': f.get('soil_clay_pct'),
                'soil_ph': f.get('soil_ph'),
                # Management
                'irrigation_applied_in': f.get('irrigation_applied_in'),
                'total_nitrogen_lbs_per_acre': f.get('total_nitrogen_lbs_per_acre'),
                # Meta
                'feature_vector': assembled.features,
                'data_quality': assembled.data_quality,
                'warnings': assembled.warnings,
            }
        )
        return snapshot

    def _get_climate_features(
        self, field_obj, season_start: date, season_end: date, crop_category: str
    ) -> dict:
        """Fetch climate features from CIMIS data via ClimateFeatureService."""
        features = {
            'gdd_cumulative': None,
            'gdd_base_temp_f': None,
            'chill_hours_cumulative': None,
            'chill_portions': None,
            'precipitation_cumulative_in': None,
            'eto_cumulative_in': None,
            'heat_stress_days': None,
            'frost_events': None,
        }

        cimis_source = self._resolve_cimis_source(field_obj)
        if not cimis_source:
            return features

        try:
            from api.services.climate_features import ClimateFeatureService
            service = ClimateFeatureService()
            result = service.compute_features(
                cimis_source_id=cimis_source,
                start_date=season_start,
                end_date=season_end,
                crop_category=crop_category,
            )

            if result.data_completeness_pct > 0:
                features['gdd_cumulative'] = result.gdd_cumulative
                features['gdd_base_temp_f'] = result.gdd_base_temp_f
                features['chill_hours_cumulative'] = result.chill_hours_cumulative
                features['chill_portions'] = result.chill_portions
                features['precipitation_cumulative_in'] = result.precipitation_cumulative_in
                features['eto_cumulative_in'] = result.eto_cumulative_in
                features['heat_stress_days'] = result.heat_stress_days
                features['frost_events'] = result.frost_events

        except Exception as e:
            logger.warning(f"Climate features failed for field {field_obj.id}: {e}")

        return features

    def _get_vegetation_features(self, field_obj) -> dict:
        """Pull vegetation/remote sensing features from cached field data."""
        features = {
            'ndvi_mean': None,
            'ndvi_trend': None,
            'canopy_coverage_pct': None,
            'tree_height_avg_m': None,
        }

        # Tree survey data (from latest completed TreeSurvey)
        try:
            from api.models import TreeSurvey

            latest_survey = (
                TreeSurvey.objects
                .filter(field=field_obj, status='completed')
                .order_by('-capture_date')
                .first()
            )

            if latest_survey:
                if latest_survey.canopy_coverage_percent is not None:
                    features['canopy_coverage_pct'] = Decimal(
                        str(latest_survey.canopy_coverage_percent)
                    )
                if latest_survey.avg_ndvi is not None:
                    features['ndvi_mean'] = Decimal(
                        str(latest_survey.avg_ndvi)
                    ).quantize(Decimal('0.001'))

                    features['ndvi_trend'] = self._compute_ndvi_trend(field_obj)

        except Exception as e:
            logger.warning(f"Tree survey features failed for field {field_obj.id}: {e}")

        return features

    def _compute_ndvi_trend(self, field_obj) -> Optional[Decimal]:
        """Compute NDVI trend by comparing latest two tree surveys."""
        from api.models import TreeSurvey

        surveys = list(
            TreeSurvey.objects
            .filter(field=field_obj, status='completed', avg_ndvi__isnull=False)
            .order_by('-capture_date')[:2]
        )

        if len(surveys) < 2:
            return None

        current_avg = surveys[0].avg_ndvi
        previous_avg = surveys[1].avg_ndvi

        if current_avg is not None and previous_avg is not None:
            trend = Decimal(str(current_avg - previous_avg))
            return trend.quantize(Decimal('0.0001'))

        return None

    def _get_bearing_features(
        self, field_id: int, season_label: str, crop_category: str
    ) -> dict:
        """Compute alternate bearing features."""
        features = {
            'alternate_bearing_index': None,
            'prior_season_yield_per_acre': None,
        }

        try:
            from api.services.alternate_bearing import AlternateBearingService
            service = AlternateBearingService(company_id=self.company_id)
            result = service.analyze_field(field_id, season_label)

            features['alternate_bearing_index'] = result.bearing_index
            if result.historical_yields:
                features['prior_season_yield_per_acre'] = (
                    result.historical_yields[-1].yield_per_acre
                )

        except Exception as e:
            logger.warning(f"Bearing features failed for field {field_id}: {e}")

        return features

    def _get_field_characteristics(self, field_obj) -> dict:
        """Pull static field characteristics."""
        features = {
            'tree_age_years': None,
            'trees_per_acre': None,
            'irrigation_type': None,
            'soil_type': None,
            'rootstock_vigor': None,
            'organic_status': None,
        }

        # Tree age
        if hasattr(field_obj, 'crop_age_years'):
            age = field_obj.crop_age_years
            if age is not None:
                features['tree_age_years'] = age

        # Trees per acre (fall back to latest tree survey)
        tpa = field_obj.trees_per_acre
        if tpa is None:
            try:
                from api.models import TreeSurvey
                latest = (
                    TreeSurvey.objects
                    .filter(field=field_obj, status='completed', trees_per_acre__isnull=False)
                    .order_by('-capture_date')
                    .values_list('trees_per_acre', flat=True)
                    .first()
                )
                if latest is not None:
                    tpa = Decimal(str(latest))
            except Exception:
                pass
        features['trees_per_acre'] = tpa

        # Simple string features
        features['irrigation_type'] = field_obj.irrigation_type or None
        features['soil_type'] = field_obj.soil_type or None
        features['organic_status'] = field_obj.organic_status or None

        # Rootstock vigor
        if field_obj.rootstock:
            features['rootstock_vigor'] = field_obj.rootstock.vigor or None

        return features

    def _get_soil_features(self, field_obj) -> dict:
        """Pull SSURGO soil survey data if available."""
        features = {
            'soil_awc': None,
            'soil_clay_pct': None,
            'soil_ph': None,
        }

        try:
            soil = field_obj.soil_survey
            features['soil_awc'] = soil.available_water_capacity
            features['soil_clay_pct'] = soil.clay_pct
            features['soil_ph'] = soil.ph
        except Exception:
            # soil_survey doesn't exist (RelatedObjectDoesNotExist)
            pass

        return features

    def _get_irrigation_features(
        self, field_id: int, season_start: date, season_end: date
    ) -> dict:
        """Sum irrigation applied during the season."""
        features = {'irrigation_applied_in': None}

        try:
            from api.models import IrrigationEvent
            from django.db.models import Sum

            total = IrrigationEvent.objects.filter(
                field_id=field_id,
                irrigation_date__gte=season_start,
                irrigation_date__lte=season_end,
            ).aggregate(total=Sum('acre_inches'))['total']

            if total is not None:
                features['irrigation_applied_in'] = Decimal(str(total)).quantize(
                    Decimal('0.01')
                )
        except Exception as e:
            logger.warning(f"Irrigation features failed for field {field_id}: {e}")

        return features

    def _get_nutrient_features(
        self, field_id: int, field_obj, season_start: date, season_end: date
    ) -> dict:
        """Sum nitrogen applied per acre during the season."""
        features = {'total_nitrogen_lbs_per_acre': None}

        try:
            from api.models import NutrientApplication
            from django.db.models import Sum

            total_n = NutrientApplication.objects.filter(
                field_id=field_id,
                application_date__gte=season_start,
                application_date__lte=season_end,
                lbs_nitrogen_per_acre__isnull=False,
            ).aggregate(total=Sum('lbs_nitrogen_per_acre'))['total']

            if total_n is not None:
                features['total_nitrogen_lbs_per_acre'] = Decimal(str(total_n)).quantize(
                    Decimal('0.01')
                )
        except Exception as e:
            logger.warning(f"Nutrient features failed for field {field_id}: {e}")

        return features

    def _resolve_cimis_source(self, field_obj) -> Optional[str]:
        """
        Find the CIMIS station ID for a field.
        Priority: Farm.cimis_station_id > fallback to empty (no climate data).
        """
        if field_obj.farm and field_obj.farm.cimis_station_id:
            return field_obj.farm.cimis_station_id
        return None
