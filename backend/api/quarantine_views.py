"""
Quarantine status views: check quarantine status, get quarantine boundaries.
"""
import requests
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from .permissions import HasCompanyAccess
from .models import Farm, Field, QuarantineStatus
from .serializers import QuarantineStatusSerializer
from .view_helpers import get_user_company


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def check_quarantine_status(request):
    """
    Check quarantine status for a farm or field.

    Query Parameters:
        farm_id: ID of the farm to check (mutually exclusive with field_id)
        field_id: ID of the field to check (mutually exclusive with farm_id)
        refresh: Set to 'true' to bypass cache and force a fresh check
        quarantine_type: Type of quarantine to check (default: 'HLB')

    Returns:
        QuarantineStatus object with in_quarantine, zone_name, last_checked, etc.
    """
    from .services.quarantine_service import CDFAQuarantineService
    from datetime import timedelta

    farm_id = request.query_params.get('farm_id')
    field_id = request.query_params.get('field_id')
    refresh = request.query_params.get('refresh', 'false').lower() == 'true'
    quarantine_type = request.query_params.get('quarantine_type', 'HLB')

    # Validate parameters
    if farm_id and field_id:
        return Response(
            {'error': 'Cannot specify both farm_id and field_id'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not farm_id and not field_id:
        return Response(
            {'error': 'Must specify either farm_id or field_id'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Get the farm or field (with company filtering for tenant isolation)
    company = get_user_company(request.user)
    farm = None
    field = None
    latitude = None
    longitude = None

    try:
        if farm_id:
            queryset = Farm.objects.filter(active=True)
            if company:
                queryset = queryset.filter(company=company)
            farm = queryset.get(id=farm_id)
            latitude = farm.gps_latitude
            longitude = farm.gps_longitude
        else:
            queryset = Field.objects.filter(active=True).select_related('farm')
            if company:
                queryset = queryset.filter(farm__company=company)
            field = queryset.get(id=field_id)
            latitude = field.gps_latitude
            longitude = field.gps_longitude
    except (Farm.DoesNotExist, Field.DoesNotExist):
        return Response(
            {'error': 'Farm or field not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Check for missing coordinates
    if latitude is None or longitude is None:
        return Response({
            'in_quarantine': None,
            'zone_name': None,
            'last_checked': None,
            'error': 'No GPS coordinates available for this location',
            'target_name': farm.name if farm else field.name,
            'target_type': 'farm' if farm else 'field',
        })

    # Try to get cached status (wrap in try-except for RLS issues)
    cache_filter = {
        'quarantine_type': quarantine_type,
    }
    if farm:
        cache_filter['farm'] = farm
    else:
        cache_filter['field'] = field

    try:
        cached_status = QuarantineStatus.objects.filter(**cache_filter).first()
    except Exception as db_error:
        # RLS policy may be blocking - log and continue without cache
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"RLS error querying QuarantineStatus: {db_error}")
        cached_status = None

    # Check if cache is valid (less than 24 hours old) and not forcing refresh
    if cached_status and not refresh:
        cache_age = timezone.now() - cached_status.last_checked
        if cache_age < timedelta(hours=24):
            serializer = QuarantineStatusSerializer(cached_status)
            return Response(serializer.data)

    # Query CDFA API
    service = CDFAQuarantineService()
    result = service.check_location(latitude, longitude)

    # Determine if status changed
    previous_status = cached_status.in_quarantine if cached_status else None
    status_changed = previous_status != result['in_quarantine'] and result['in_quarantine'] is not None

    # Save or update the status record
    status_data = {
        'in_quarantine': result['in_quarantine'],
        'zone_name': result['zone_name'] or '',
        'check_latitude': latitude,
        'check_longitude': longitude,
        'raw_response': result['raw_response'],
        'error_message': result['error'] or '',
    }

    if status_changed:
        status_data['last_changed'] = timezone.now()

    # Try to save status (wrap in try-except for RLS issues)
    try:
        if cached_status:
            for key, value in status_data.items():
                setattr(cached_status, key, value)
            cached_status.save()
            quarantine_status = cached_status
        else:
            quarantine_status = QuarantineStatus.objects.create(
                farm=farm,
                field=field,
                quarantine_type=quarantine_type,
                **status_data
            )
        serializer = QuarantineStatusSerializer(quarantine_status)
        return Response(serializer.data)
    except Exception as db_error:
        # RLS policy may be blocking saves - return result without caching
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"RLS error saving QuarantineStatus: {db_error}")

        # Return the CDFA result directly without database caching
        return Response({
            'in_quarantine': result['in_quarantine'],
            'zone_name': result['zone_name'] or '',
            'last_checked': timezone.now().isoformat(),
            'error_message': result['error'] or '',
            'target_name': farm.name if farm else field.name,
            'target_type': 'farm' if farm else 'field',
            '_cache_error': 'Unable to cache result - please run database migrations',
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def get_quarantine_boundaries(request):
    """
    Proxy endpoint for CDFA quarantine boundary GeoJSON.

    Returns GeoJSON FeatureCollection of all active quarantine zones.
    Caches the response for 1 hour to minimize external API calls.

    Query Parameters:
        refresh: Set to 'true' to bypass cache and fetch fresh data
    """
    from django.core.cache import cache

    CACHE_KEY = 'cdfa_quarantine_boundaries'
    CACHE_TIMEOUT = 3600  # 1 hour

    refresh = request.query_params.get('refresh', 'false').lower() == 'true'

    # Try to get from cache unless refreshing
    if not refresh:
        cached_data = cache.get(CACHE_KEY)
        if cached_data:
            return Response(cached_data)

    # Fetch from CDFA FeatureServer
    try:
        cdfa_url = (
            "https://gis2.cdfa.ca.gov/server/rest/services/Plant/ActiveQuarantines/FeatureServer/0/query"
        )
        params = {
            'where': '1=1',
            'outFields': '*',
            'returnGeometry': 'true',
            'outSR': '4326',  # WGS84 for Leaflet
            'f': 'geojson',
        }

        response = requests.get(cdfa_url, params=params, timeout=30)
        response.raise_for_status()

        geojson_data = response.json()

        # Validate it's a valid GeoJSON FeatureCollection
        if geojson_data.get('type') != 'FeatureCollection':
            return Response(
                {'error': 'Invalid response from CDFA API'},
                status=status.HTTP_502_BAD_GATEWAY
            )

        # Cache the response
        cache.set(CACHE_KEY, geojson_data, CACHE_TIMEOUT)

        return Response(geojson_data)

    except requests.exceptions.Timeout:
        return Response(
            {'error': 'CDFA API request timed out'},
            status=status.HTTP_504_GATEWAY_TIMEOUT
        )
    except requests.exceptions.RequestException as e:
        return Response(
            {'error': f'Failed to fetch quarantine boundaries: {str(e)}'},
            status=status.HTTP_502_BAD_GATEWAY
        )
    except ValueError as e:
        return Response(
            {'error': f'Invalid JSON response from CDFA API: {str(e)}'},
            status=status.HTTP_502_BAD_GATEWAY
        )
