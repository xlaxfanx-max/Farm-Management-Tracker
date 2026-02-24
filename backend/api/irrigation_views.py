"""
Irrigation scheduling views: zones, recommendations, crop coefficients,
soil moisture readings, dashboard, and CIMIS stations.
"""
from datetime import datetime, date
from decimal import Decimal
from django.db.models import Sum, Avg, Count, F, Q
from rest_framework import viewsets, filters, status, serializers
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .permissions import HasCompanyAccess
from .audit_utils import AuditLogMixin
from .view_helpers import get_user_company, require_company, CompanyFilteredViewSet
from .models import (
    IrrigationZone, CropCoefficientProfile, CIMISDataCache,
    IrrigationRecommendation, SoilMoistureReading, IrrigationEvent,
)
from .serializers import (
    IrrigationZoneSerializer, IrrigationZoneListSerializer, IrrigationZoneDetailSerializer,
    IrrigationZoneEventSerializer, IrrigationZoneEventCreateSerializer,
    IrrigationRecommendationSerializer, IrrigationRecommendationListSerializer,
    CropCoefficientProfileSerializer, CIMISDataSerializer, SoilMoistureReadingSerializer,
    IrrigationDashboardSerializer,
)


class IrrigationZoneViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing irrigation zones.

    RLS NOTES:
    - Zones inherit company from their Field -> Farm
    - get_queryset filters by company through field.farm relationship
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'crop_type', 'field__name', 'field__farm__name']
    ordering_fields = ['name', 'acres', 'created_at']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return IrrigationZoneDetailSerializer
        return IrrigationZoneSerializer

    def get_queryset(self):
        """Filter zones by current user's company through field.farm."""
        queryset = IrrigationZone.objects.filter(active=True).select_related(
            'field', 'field__farm', 'water_source'
        )
        company = get_user_company(self.request.user)
        if company:
            queryset = queryset.filter(field__farm__company=company)

        # Optional filters
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        farm_id = self.request.query_params.get('farm')
        if farm_id:
            queryset = queryset.filter(field__farm_id=farm_id)

        return queryset

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """Get current irrigation status and recommendation for a zone."""
        zone = self.get_object()
        from .services.irrigation_scheduler import IrrigationScheduler

        try:
            scheduler = IrrigationScheduler(zone)
            status_data = scheduler.get_zone_status_summary()
            return Response(status_data)
        except Exception as e:
            return Response(
                {'error': f'Failed to calculate zone status: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def calculate(self, request, pk=None):
        """Calculate and optionally save a new irrigation recommendation."""
        zone = self.get_object()
        from .services.irrigation_scheduler import IrrigationScheduler

        save_recommendation = request.data.get('save', False)
        as_of_date = request.data.get('as_of_date')

        try:
            if as_of_date:
                as_of_date = datetime.strptime(as_of_date, '%Y-%m-%d').date()
            else:
                as_of_date = date.today()

            scheduler = IrrigationScheduler(zone)
            calculation = scheduler.calculate_recommendation(as_of_date)

            result = {
                'calculation': calculation,
                'saved': False,
            }

            if save_recommendation and calculation['recommended']:
                recommendation = scheduler.create_recommendation_record(calculation)
                result['recommendation_id'] = recommendation.id
                result['saved'] = True

            return Response(result)
        except Exception as e:
            return Response(
                {'error': f'Failed to calculate recommendation: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get', 'post'])
    def events(self, request, pk=None):
        """GET: List irrigation events, POST: Record new event."""
        zone = self.get_object()

        if request.method == 'GET':
            events = zone.irrigation_events.order_by('-date')[:20]
            serializer = IrrigationZoneEventSerializer(events, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            data = request.data.copy()
            data['zone'] = zone.id
            serializer = IrrigationZoneEventCreateSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def recommendations(self, request, pk=None):
        """Get recommendations history for a zone."""
        zone = self.get_object()
        recommendations = zone.recommendations.order_by('-created_at')[:20]
        serializer = IrrigationRecommendationListSerializer(recommendations, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def weather(self, request, pk=None):
        """Get recent weather data for the zone's CIMIS target."""
        zone = self.get_object()

        if not zone.cimis_target:
            return Response(
                {'error': 'No CIMIS target configured for this zone'},
                status=status.HTTP_400_BAD_REQUEST
            )

        days = int(request.query_params.get('days', 7))
        from .services.cimis_service import CIMISService

        try:
            cimis = CIMISService()
            data = cimis.get_recent_data(
                zone.cimis_target,
                days=days,
                target_type=zone.cimis_target_type or 'station'
            )
            serializer = CIMISDataSerializer(
                [CIMISDataCache(**d) for d in data],
                many=True
            )
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': f'Failed to fetch weather data: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class IrrigationRecommendationViewSet(CompanyFilteredViewSet):
    """
    API endpoint for managing irrigation recommendations.

    RLS NOTES:
    - Recommendations inherit company from Zone -> Field -> Farm
    """
    model = IrrigationRecommendation
    serializer_class = IrrigationRecommendationSerializer
    company_field = 'zone__field__farm__company'
    select_related_fields = ('zone', 'zone__field', 'zone__field__farm')
    default_ordering = ('-created_at',)
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['recommended_date', 'created_at']

    def filter_queryset_by_params(self, qs):
        zone_id = self.request.query_params.get('zone')
        if zone_id:
            qs = qs.filter(zone_id=zone_id)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs

    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        """Mark recommendation as applied and record the irrigation event."""
        recommendation = self.get_object()

        if recommendation.status != 'pending':
            return Response(
                {'error': 'This recommendation has already been processed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create irrigation event
        event_data = {
            'zone': recommendation.zone.id,
            'date': request.data.get('date', date.today().isoformat()),
            'depth_inches': request.data.get('depth_inches', recommendation.recommended_depth_inches),
            'duration_hours': request.data.get('duration_hours', recommendation.recommended_duration_hours),
            'method': request.data.get('method', 'scheduled'),
            'source': 'recommendation',
            'notes': request.data.get('notes', f'Applied recommendation #{recommendation.id}'),
        }

        serializer = IrrigationZoneEventCreateSerializer(data=event_data)
        serializer.is_valid(raise_exception=True)
        event = serializer.save()

        # Update recommendation status
        recommendation.status = 'applied'
        recommendation.save()

        return Response({
            'recommendation': IrrigationRecommendationSerializer(recommendation).data,
            'event': IrrigationZoneEventSerializer(event).data,
        })

    @action(detail=True, methods=['post'])
    def skip(self, request, pk=None):
        """Mark recommendation as skipped."""
        recommendation = self.get_object()

        if recommendation.status != 'pending':
            return Response(
                {'error': 'This recommendation has already been processed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        recommendation.status = 'skipped'
        recommendation.save()

        return Response(IrrigationRecommendationSerializer(recommendation).data)


class CropCoefficientProfileViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing crop coefficient (Kc) profiles.

    System default profiles (zone=null) are read-only.
    Zone-specific profiles can be created/edited.
    """
    serializer_class = CropCoefficientProfileSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter]
    search_fields = ['crop_type', 'growth_stage']

    def get_queryset(self):
        """Get Kc profiles - system defaults and company-specific."""
        company = get_user_company(self.request.user)

        # Get system defaults (no zone)
        system_defaults = Q(zone__isnull=True)

        # Get company-specific profiles
        if company:
            company_profiles = Q(zone__field__farm__company=company)
            return CropCoefficientProfile.objects.filter(
                system_defaults | company_profiles
            ).select_related('zone', 'zone__field')
        else:
            return CropCoefficientProfile.objects.filter(system_defaults)

    def perform_create(self, serializer):
        """Ensure zone belongs to user's company."""
        zone = serializer.validated_data.get('zone')
        if zone:
            company = require_company(self.request.user)
            if zone.field.farm.company != company:
                raise serializers.ValidationError({
                    'zone': 'You can only create profiles for zones in your company.'
                })
        serializer.save()

    def perform_update(self, serializer):
        """Prevent editing system defaults."""
        if serializer.instance.zone is None:
            raise serializers.ValidationError(
                'System default profiles cannot be modified.'
            )
        serializer.save()

    def perform_destroy(self, instance):
        """Prevent deleting system defaults."""
        if instance.zone is None:
            raise serializers.ValidationError(
                'System default profiles cannot be deleted.'
            )
        instance.delete()


class SoilMoistureReadingViewSet(CompanyFilteredViewSet):
    """
    API endpoint for soil moisture sensor readings.
    """
    model = SoilMoistureReading
    serializer_class = SoilMoistureReadingSerializer
    company_field = 'zone__field__farm__company'
    select_related_fields = ('zone', 'zone__field', 'zone__field__farm')
    default_ordering = ('-reading_datetime',)
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['reading_datetime']

    def filter_queryset_by_params(self, qs):
        zone_id = self.request.query_params.get('zone')
        if zone_id:
            qs = qs.filter(zone_id=zone_id)
        return qs


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def irrigation_dashboard(request):
    """
    Get irrigation dashboard summary data.

    Returns aggregate statistics, zone statuses, and pending recommendations.
    """
    company = get_user_company(request.user)
    if not company:
        return Response(
            {'error': 'No company associated with user'},
            status=status.HTTP_400_BAD_REQUEST
        )

    from .services.irrigation_scheduler import IrrigationScheduler

    # Get active zones
    zones = IrrigationZone.objects.filter(
        field__farm__company=company,
        active=True
    ).select_related('field', 'field__farm', 'water_source')

    total_zones = zones.count()
    total_acres = zones.aggregate(total=Sum('acres'))['total'] or Decimal('0')

    # Calculate status for each zone
    zone_statuses = []
    zones_needing = 0
    zones_soon = 0
    total_depletion = Decimal('0')
    zones_with_depletion = 0

    for zone in zones:
        try:
            scheduler = IrrigationScheduler(zone)
            zone_status = scheduler.get_zone_status_summary()
            zone_statuses.append(zone_status)

            if zone_status.get('status') == 'needs_irrigation':
                zones_needing += 1
            elif zone_status.get('status') == 'irrigation_soon':
                zones_soon += 1

            depletion = zone_status.get('depletion_pct')
            if depletion is not None:
                total_depletion += Decimal(str(depletion))
                zones_with_depletion += 1
        except Exception as e:
            zone_statuses.append({
                'zone_id': zone.id,
                'zone_name': zone.name,
                'status': 'error',
                'error': str(e)
            })

    avg_depletion = (total_depletion / zones_with_depletion) if zones_with_depletion > 0 else Decimal('0')

    # Get pending recommendations
    pending_recs = IrrigationRecommendation.objects.filter(
        zone__field__farm__company=company,
        status='pending'
    ).select_related('zone').order_by('recommended_date')[:10]

    # Get recent irrigation events
    recent_events = IrrigationEvent.objects.filter(
        zone__field__farm__company=company
    ).select_related('zone', 'zone__field').order_by('-date')[:10]

    # Try to get recent weather data (from first zone with CIMIS target)
    recent_eto = None
    recent_rain = None
    zone_with_cimis = zones.exclude(cimis_target__isnull=True).exclude(cimis_target='').first()
    if zone_with_cimis:
        try:
            from .services.cimis_service import CIMISService
            cimis = CIMISService()
            weather_data = cimis.get_recent_data(
                zone_with_cimis.cimis_target,
                days=7,
                target_type=zone_with_cimis.cimis_target_type or 'station'
            )
            for d in weather_data:
                if d.get('eto'):
                    recent_eto = (recent_eto or Decimal('0')) + d['eto']
                if d.get('precipitation'):
                    recent_rain = (recent_rain or Decimal('0')) + d['precipitation']
        except Exception:
            pass

    # Organize zones by status
    zones_by_status = {
        'needs_irrigation': [z for z in zone_statuses if z.get('status') == 'needs_irrigation'],
        'irrigation_soon': [z for z in zone_statuses if z.get('status') == 'irrigation_soon'],
        'ok': [z for z in zone_statuses if z.get('status') == 'ok'],
        'error': [z for z in zone_statuses if z.get('status') == 'error'],
    }

    return Response({
        'total_zones': total_zones,
        'active_zones': total_zones,  # Already filtered to active
        'zones_needing_irrigation': zones_needing,
        'zones_irrigation_soon': zones_soon,
        'total_acres': float(total_acres),
        'avg_depletion_pct': float(round(avg_depletion, 1)),
        'recent_eto_total': float(recent_eto) if recent_eto else None,
        'recent_rainfall_total': float(recent_rain) if recent_rain else None,
        'zones': IrrigationZoneListSerializer(zones, many=True).data,
        'zones_by_status': zones_by_status,
        'pending_recommendations': IrrigationRecommendationListSerializer(pending_recs, many=True).data,
        'recent_events': IrrigationZoneEventSerializer(recent_events, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def cimis_stations(request):
    """
    Get list of nearby CIMIS stations.

    Query Parameters:
        lat: Latitude
        lng: Longitude
        limit: Max number of stations (default 5)
    """
    lat = request.query_params.get('lat')
    lng = request.query_params.get('lng')
    limit = int(request.query_params.get('limit', 5))

    if not lat or not lng:
        return Response(
            {'error': 'lat and lng parameters are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # For now, return a static list of common California CIMIS stations
    # In production, this could query the CIMIS station list API
    common_stations = [
        {'id': '2', 'name': 'Five Points', 'county': 'Fresno'},
        {'id': '5', 'name': 'Shafter', 'county': 'Kern'},
        {'id': '6', 'name': 'Bishop', 'county': 'Inyo'},
        {'id': '7', 'name': 'Firebaugh', 'county': 'Fresno'},
        {'id': '15', 'name': 'Stratford', 'county': 'Kings'},
        {'id': '39', 'name': 'Parlier', 'county': 'Fresno'},
        {'id': '54', 'name': 'Arvin/Edison', 'county': 'Kern'},
        {'id': '56', 'name': 'Castroville', 'county': 'Monterey'},
        {'id': '80', 'name': 'Fresno State', 'county': 'Fresno'},
        {'id': '105', 'name': 'Lindcove', 'county': 'Tulare'},
        {'id': '106', 'name': 'Meloland', 'county': 'Imperial'},
        {'id': '116', 'name': 'Salinas South', 'county': 'Monterey'},
        {'id': '125', 'name': 'Twitchell Island', 'county': 'Sacramento'},
        {'id': '131', 'name': 'Ripon', 'county': 'San Joaquin'},
        {'id': '170', 'name': 'Goleta Foothills', 'county': 'Santa Barbara'},
    ]

    return Response({
        'stations': common_stations[:limit],
        'note': 'Use station ID as cimis_target with target_type="station"',
    })
