"""
Yield Forecast Views.

ViewSets for CRUD operations and function-based views for analytics endpoints.
"""
from datetime import date

from django.db.models import Avg, Count, Q, F
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    ExternalDataSource, SoilSurveyData,
    YieldFeatureSnapshot, YieldForecast,
    Field, Farm,
)
from .yield_serializers import (
    ExternalDataSourceSerializer,
    SoilSurveyDataSerializer,
    YieldFeatureSnapshotSerializer,
    YieldForecastSerializer,
    YieldForecastListSerializer,
)
from .permissions import HasCompanyAccess, AuditLogMixin
from .view_helpers import get_user_company, require_company, CompanyFilteredViewSet


# =============================================================================
# VIEWSETS
# =============================================================================

class YieldForecastViewSet(CompanyFilteredViewSet):
    """CRUD for yield forecasts, filtered by company."""
    model = YieldForecast
    serializer_class = YieldForecastSerializer
    company_field = 'field__farm__company'
    select_related_fields = ('field', 'field__farm', 'field__crop')
    default_ordering = ('-forecast_date',)
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['forecast_date', 'predicted_yield_per_acre', 'season_label']
    ordering = ['-forecast_date']

    def filter_queryset_by_params(self, qs):
        field_id = self.request.query_params.get('field')
        farm_id = self.request.query_params.get('farm')
        season = self.request.query_params.get('season_label')
        status_filter = self.request.query_params.get('status')
        crop_category = self.request.query_params.get('crop_category')

        if field_id:
            qs = qs.filter(field_id=field_id)
        if farm_id:
            qs = qs.filter(field__farm_id=farm_id)
        if season:
            qs = qs.filter(season_label=season)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if crop_category:
            qs = qs.filter(field__crop__category=crop_category)
        return qs

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """
        Trigger forecast generation for specified fields/season.

        Body params:
            field_ids: list[int] (optional, defaults to all fields)
            season_label: str (optional, defaults to current season)
            method: str (optional, defaults to 'auto')
            publish: bool (optional, defaults to false)
        """
        import logging
        import traceback
        from .services.yield_forecast_service import YieldForecastService

        logger = logging.getLogger(__name__)

        try:
            company = require_company(request.user)
        except Exception as e:
            return Response({'error': str(e)}, status=400)

        service = YieldForecastService(company_id=company.id)

        field_ids = request.data.get('field_ids', [])
        season_label = request.data.get('season_label')
        method = request.data.get('method', 'auto')
        publish = request.data.get('publish', False)

        results = []

        try:
            if field_ids:
                for fid in field_ids:
                    try:
                        result = service.forecast_field(fid, season_label or '', method=method)
                        if not result.skipped:
                            forecast = service.save_forecast(
                                fid, season_label or '', result,
                                user=request.user, auto_publish=publish,
                            )
                            results.append({
                                'field_id': fid,
                                'forecast_id': forecast.id if forecast else None,
                                'predicted_yield_per_acre': str(result.predicted_yield_per_acre),
                                'method': result.forecast_method,
                                'warnings': result.degradation_warnings,
                            })
                        else:
                            results.append({
                                'field_id': fid,
                                'skipped': True,
                                'reason': result.skip_reason,
                            })
                    except Exception as e:
                        logger.error(f"Forecast failed for field {fid}: {e}")
                        results.append({
                            'field_id': fid,
                            'skipped': True,
                            'reason': f"Error: {str(e)}",
                        })
            else:
                all_results = service.forecast_all_fields(
                    season_label=season_label,
                )
                for fid, resolved_label, result in all_results:
                    save_label = season_label or resolved_label
                    try:
                        if not result.skipped:
                            forecast = service.save_forecast(
                                fid, save_label, result,
                                user=request.user, auto_publish=publish,
                            )
                            results.append({
                                'field_id': fid,
                                'forecast_id': forecast.id if forecast else None,
                                'predicted_yield_per_acre': str(result.predicted_yield_per_acre),
                                'method': result.forecast_method,
                                'season_label': save_label,
                            })
                        else:
                            results.append({
                                'field_id': fid,
                                'skipped': True,
                                'reason': result.skip_reason,
                            })
                    except Exception as e:
                        logger.error(f"Save forecast failed for field {fid}: {e}")
                        results.append({
                            'field_id': fid,
                            'skipped': True,
                            'reason': f"Error: {str(e)}",
                        })
        except Exception as e:
            logger.error(f"Forecast generation failed: {traceback.format_exc()}")
            return Response({
                'error': f"Forecast generation failed: {str(e)}",
                'generated': 0,
                'skipped': 0,
                'results': results,
            }, status=500)

        return Response({
            'generated': len([r for r in results if not r.get('skipped')]),
            'skipped': len([r for r in results if r.get('skipped')]),
            'results': results,
        })

    @action(detail=False, methods=['post'])
    def backfill_actuals(self, request):
        """Populate actual yields from harvest data for a completed season."""
        from .services.yield_forecast_service import YieldForecastService

        company = require_company(request.user)
        season_label = request.data.get('season_label')
        if not season_label:
            return Response(
                {'error': 'season_label is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        service = YieldForecastService(company_id=company.id)
        updated = service.backfill_actuals(season_label)

        return Response({
            'updated': updated,
            'season_label': season_label,
        })


class YieldFeatureSnapshotViewSet(CompanyFilteredViewSet):
    """Read-only access to feature snapshots."""
    model = YieldFeatureSnapshot
    serializer_class = YieldFeatureSnapshotSerializer
    company_field = 'field__farm__company'
    select_related_fields = ('field', 'field__farm')
    default_ordering = ('-id',)
    http_method_names = ['get', 'head', 'options']

    def filter_queryset_by_params(self, qs):
        field_id = self.request.query_params.get('field')
        season = self.request.query_params.get('season_label')
        if field_id:
            qs = qs.filter(field_id=field_id)
        if season:
            qs = qs.filter(season_label=season)
        return qs


class ExternalDataSourceViewSet(CompanyFilteredViewSet):
    """CRUD for external data source configurations."""
    model = ExternalDataSource
    serializer_class = ExternalDataSourceSerializer
    company_field = 'company'
    default_ordering = ('-id',)


class SoilSurveyDataViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to cached SSURGO soil data."""
    serializer_class = SoilSurveyDataSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        qs = SoilSurveyData.objects.select_related('field', 'field__farm')
        company = get_user_company(self.request.user)
        if company:
            qs = qs.filter(field__farm__company=company)

        field_id = self.request.query_params.get('field')
        if field_id:
            qs = qs.filter(field_id=field_id)
        return qs


# =============================================================================
# ANALYTICS ENDPOINTS
# =============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def yield_forecast_dashboard(request):
    """
    Aggregated forecast dashboard data.

    Query params:
        season_label: filter by season
        farm: filter by farm ID
        crop_category: filter by crop category
    """
    company = get_user_company(request.user)
    if not company:
        return Response({'error': 'No company associated with user'}, status=400)

    try:
        forecasts = YieldForecast.objects.select_related(
            'field', 'field__farm', 'field__crop'
        ).filter(
            field__farm__company=company,
        )

        season = request.query_params.get('season_label')
        farm_id = request.query_params.get('farm')
        crop_category = request.query_params.get('crop_category')

        if season:
            forecasts = forecasts.filter(season_label=season)
        if farm_id:
            forecasts = forecasts.filter(field__farm_id=farm_id)
        if crop_category:
            forecasts = forecasts.filter(field__crop__category=crop_category)

        # Only show latest forecast per field (published or draft)
        forecasts = forecasts.filter(
            status__in=['published', 'draft']
        ).order_by('field_id', '-forecast_date', '-created_at').distinct()

        # Deduplicate to latest per field
        seen_fields = set()
        latest_forecasts = []
        for f in forecasts:
            if f.field_id not in seen_fields:
                seen_fields.add(f.field_id)
                latest_forecasts.append(f)

        # Summary stats
        total_fields = len(latest_forecasts)
        total_predicted_yield = sum(
            f.predicted_total_yield for f in latest_forecasts
        )
        avg_yield_per_acre = (
            sum(f.predicted_yield_per_acre for f in latest_forecasts) / total_fields
            if total_fields > 0 else 0
        )

        # Data quality distribution
        quality_good = sum(1 for f in latest_forecasts if (f.data_completeness_pct or 0) >= 70)
        quality_fair = sum(1 for f in latest_forecasts if 40 <= (f.data_completeness_pct or 0) < 70)
        quality_poor = sum(1 for f in latest_forecasts if (f.data_completeness_pct or 0) < 40)

        # Method distribution
        method_counts = {}
        for f in latest_forecasts:
            method_counts[f.forecast_method] = method_counts.get(f.forecast_method, 0) + 1

        # Accuracy stats (for forecasts with actuals)
        with_actuals = [f for f in latest_forecasts if f.forecast_error_pct is not None]
        avg_error = (
            sum(f.forecast_error_pct for f in with_actuals) / len(with_actuals)
            if with_actuals else None
        )

        # Field-level data
        field_data = YieldForecastListSerializer(latest_forecasts, many=True).data

        # Available seasons
        available_seasons = list(
            YieldForecast.objects.filter(
                field__farm__company=company
            ).values_list('season_label', flat=True).distinct().order_by('-season_label')
        )

        return Response({
            'summary': {
                'total_fields': total_fields,
                'total_predicted_yield': str(total_predicted_yield),
                'avg_yield_per_acre': str(round(avg_yield_per_acre, 2)) if total_fields > 0 else '0',
                'avg_forecast_error_pct': str(round(avg_error, 2)) if avg_error is not None else None,
                'forecasts_with_actuals': len(with_actuals),
            },
            'data_quality': {
                'good': quality_good,
                'fair': quality_fair,
                'poor': quality_poor,
            },
            'method_distribution': method_counts,
            'forecasts': field_data,
            'available_seasons': available_seasons,
        })

    except Exception as e:
        return Response({
            'summary': {'total_fields': 0},
            'data_quality': {},
            'method_distribution': {},
            'forecasts': [],
            'available_seasons': [],
            'error': str(e),
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def field_forecast_detail(request, field_id):
    """
    Detailed forecast data for a single field.

    Returns current forecast, historical yields, feature snapshot, and season comparisons.
    """
    company = get_user_company(request.user)
    if not company:
        return Response({'error': 'No company associated with user'}, status=400)

    try:
        field = Field.objects.select_related('farm', 'crop', 'rootstock').get(
            id=field_id, farm__company=company
        )
    except Field.DoesNotExist:
        return Response({'error': 'Field not found'}, status=404)

    season = request.query_params.get('season_label')

    # Current/latest forecast
    forecast_qs = YieldForecast.objects.filter(
        field_id=field_id,
        status__in=['published', 'draft'],
    ).order_by('-forecast_date', '-created_at')

    if season:
        forecast_qs = forecast_qs.filter(season_label=season)

    latest_forecast = forecast_qs.first()

    # Historical forecasts for this field
    all_forecasts = YieldForecast.objects.filter(
        field_id=field_id,
    ).order_by('season_label', '-forecast_date')

    # Deduplicate to latest per season
    season_forecasts = {}
    for f in all_forecasts:
        if f.season_label not in season_forecasts:
            season_forecasts[f.season_label] = f

    # Feature snapshot
    snapshot = None
    if latest_forecast and latest_forecast.feature_snapshot_id:
        try:
            snapshot = YieldFeatureSnapshot.objects.get(
                id=latest_forecast.feature_snapshot_id
            )
        except YieldFeatureSnapshot.DoesNotExist:
            pass

    # Historical yields (from alternate bearing service)
    historical_yields = []
    try:
        from .services.alternate_bearing import AlternateBearingService
        bearing_service = AlternateBearingService(company_id=company.id)
        bearing_result = bearing_service.analyze_field(
            field_id, season or ''
        )
        historical_yields = [
            {
                'season': s.season_label,
                'yield_per_acre': str(s.yield_per_acre),
                'classification': s.classification,
            }
            for s in bearing_result.historical_yields
        ]
    except Exception:
        pass

    return Response({
        'field': {
            'id': field.id,
            'name': field.name,
            'farm_name': field.farm.name if field.farm else '',
            'crop_name': field.crop.name if field.crop else '',
            'total_acres': str(field.total_acres),
            'tree_age_years': field.crop_age_years if hasattr(field, 'crop_age_years') else None,
        },
        'current_forecast': (
            YieldForecastSerializer(latest_forecast).data if latest_forecast else None
        ),
        'feature_snapshot': (
            YieldFeatureSnapshotSerializer(snapshot).data if snapshot else None
        ),
        'historical_yields': historical_yields,
        'season_forecasts': [
            {
                'season_label': f.season_label,
                'predicted_yield_per_acre': str(f.predicted_yield_per_acre),
                'actual_yield_per_acre': str(f.actual_yield_per_acre) if f.actual_yield_per_acre else None,
                'forecast_error_pct': str(f.forecast_error_pct) if f.forecast_error_pct else None,
                'forecast_method': f.forecast_method,
            }
            for f in sorted(season_forecasts.values(), key=lambda x: x.season_label)
        ],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def forecast_season_comparison(request):
    """Compare forecasts vs actuals across multiple seasons."""
    company = get_user_company(request.user)
    if not company:
        return Response({'error': 'No company associated with user'}, status=400)

    forecasts = YieldForecast.objects.filter(
        field__farm__company=company,
        actual_yield_per_acre__isnull=False,
    ).select_related('field', 'field__crop').order_by('season_label')

    crop_category = request.query_params.get('crop_category')
    if crop_category:
        forecasts = forecasts.filter(field__crop__category=crop_category)

    # Group by season
    seasons = {}
    for f in forecasts:
        if f.season_label not in seasons:
            seasons[f.season_label] = {
                'season_label': f.season_label,
                'forecasts': 0,
                'avg_predicted': 0,
                'avg_actual': 0,
                'avg_error_pct': 0,
                '_predicted_sum': 0,
                '_actual_sum': 0,
                '_error_sum': 0,
            }
        s = seasons[f.season_label]
        s['forecasts'] += 1
        s['_predicted_sum'] += float(f.predicted_yield_per_acre)
        s['_actual_sum'] += float(f.actual_yield_per_acre)
        s['_error_sum'] += float(f.forecast_error_pct)

    result = []
    for label in sorted(seasons.keys()):
        s = seasons[label]
        n = s['forecasts']
        result.append({
            'season_label': label,
            'forecasts_count': n,
            'avg_predicted_yield_per_acre': round(s['_predicted_sum'] / n, 2),
            'avg_actual_yield_per_acre': round(s['_actual_sum'] / n, 2),
            'avg_error_pct': round(s['_error_sum'] / n, 2),
            'avg_accuracy_pct': round(100 - s['_error_sum'] / n, 2),
        })

    return Response({'seasons': result})
