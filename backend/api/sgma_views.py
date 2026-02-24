"""
SGMA (Sustainable Groundwater Management Act) views.
Includes: PLSS helpers, geocoding, field boundary, well management,
well readings, meter calibrations, water allocations, extraction reports,
irrigation events, and SGMA dashboard.
"""
import requests
import re
import json
from datetime import datetime, timedelta, date
from decimal import Decimal
from django.db.models import Sum, Avg, Count, F, Q, Max
from rest_framework import viewsets, filters, status, serializers
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .permissions import HasCompanyAccess
from .audit_utils import AuditLogMixin
from .view_helpers import get_user_company, require_company, CompanyFilteredViewSet
from .models import (
    Farm, Field, WaterSource, WellReading, MeterCalibration,
    WaterAllocation, ExtractionReport, IrrigationEvent,
)
from .serializers import (
    WellReadingSerializer, WellReadingCreateSerializer, WellReadingListSerializer,
    MeterCalibrationSerializer, MeterCalibrationCreateSerializer,
    WaterAllocationSerializer, WaterAllocationSummarySerializer,
    ExtractionReportSerializer, ExtractionReportCreateSerializer, ExtractionReportListSerializer,
    IrrigationEventSerializer, IrrigationEventCreateSerializer, IrrigationEventListSerializer,
    SGMADashboardSerializer, WaterSourceSerializer,
)


# =============================================================================
# MAP FEATURE ENDPOINTS
# =============================================================================

def get_plss_from_coordinates(lat, lng):
    """
    Get Section, Township, Range from GPS coordinates using BLM PLSS service.
    Returns dict with section, township, range (or None values if not found).
    """
    import requests as req
    import re

    result = {
        'section': None,
        'township': None,
        'range': None
    }

    try:
        # Use identify endpoint
        identify_url = "https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/identify"

        buffer = 0.001
        identify_params = {
            'geometry': f'{lng},{lat}',
            'geometryType': 'esriGeometryPoint',
            'sr': '4326',
            'layers': 'all',
            'tolerance': '1',
            'mapExtent': f'{lng-buffer},{lat-buffer},{lng+buffer},{lat+buffer}',
            'imageDisplay': '100,100,96',
            'returnGeometry': 'false',
            'f': 'json'
        }

        response = req.get(identify_url, params=identify_params, timeout=15,
                          headers={'User-Agent': 'FarmManagementTracker/1.0'})

        if response.status_code == 200:
            data = response.json()

            if 'results' in data:
                for item in data['results']:
                    attrs = item.get('attributes', {})

                    # Look for section number from multiple possible fields
                    if result['section'] is None:
                        # Try FRSTDIVNO first
                        if 'FRSTDIVNO' in attrs and attrs['FRSTDIVNO']:
                            result['section'] = str(attrs['FRSTDIVNO'])
                        # Try SECDIVNO
                        elif 'SECDIVNO' in attrs and attrs['SECDIVNO']:
                            result['section'] = str(attrs['SECDIVNO'])
                        # Try to extract from 'First Division Identifier' (format: CA210140S0200E0SN030)
                        elif 'First Division Identifier' in attrs and attrs['First Division Identifier']:
                            fdi = str(attrs['First Division Identifier'])
                            # Look for SN followed by digits (Section Number)
                            sec_match = re.search(r'SN0*(\d+)', fdi)
                            if sec_match:
                                result['section'] = sec_match.group(1)
                        # Try FRSTDIVID field
                        elif 'FRSTDIVID' in attrs and attrs['FRSTDIVID']:
                            fdi = str(attrs['FRSTDIVID'])
                            sec_match = re.search(r'SN0*(\d+)', fdi)
                            if sec_match:
                                result['section'] = sec_match.group(1)

                    # Look for township/range in TWNSHPLAB
                    # Format can be: "T14S R20E" or "14S 20E" or "T14S-R20E" etc.
                    if 'TWNSHPLAB' in attrs and attrs['TWNSHPLAB']:
                        label = str(attrs['TWNSHPLAB'])

                        # Try to find township (number followed by N or S)
                        if result['township'] is None:
                            twp_match = re.search(r'T?\.?\s*(\d+)\s*([NS])', label, re.IGNORECASE)
                            if twp_match:
                                result['township'] = f"{twp_match.group(1)}{twp_match.group(2).upper()}"

                        # Try to find range (number followed by E or W)
                        if result['range'] is None:
                            rng_match = re.search(r'R?\.?\s*(\d+)\s*([EW])', label, re.IGNORECASE)
                            if rng_match:
                                result['range'] = f"{rng_match.group(1)}{rng_match.group(2).upper()}"

                    # Also check individual fields as backup
                    if result['township'] is None and 'TWNSHPNO' in attrs and attrs['TWNSHPNO']:
                        twp_dir = attrs.get('TWNSHPDIR', 'N')
                        result['township'] = f"{attrs['TWNSHPNO']}{twp_dir}"

                    if result['range'] is None and 'RANGENO' in attrs and attrs['RANGENO']:
                        rng_dir = attrs.get('RANGEDIR', 'E')
                        result['range'] = f"{attrs['RANGENO']}{rng_dir}"

        return result

    except Exception as e:
        print(f"PLSS lookup error: {e}")
        return result


@api_view(['POST'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def geocode_address(request):
    """
    Geocode an address to GPS coordinates using Nominatim (OpenStreetMap).
    Also returns PLSS data (Section, Township, Range) if available.

    Tries multiple address formats to improve success rate for rural addresses.

    POST /api/geocode/
    {
        "address": "123 Main St, Fresno, CA",
        "county": "Fresno",  # Optional - used to try additional search strategies
        "city": "Fresno"     # Optional - used to try additional search strategies
    }

    Returns:
    {
        "lat": 36.7378,
        "lng": -119.7871,
        "display_name": "...",
        "search_query": "...",  # The query that succeeded
        "section": "10",
        "township": "15S",
        "range": "22E",
        "alternatives": [...]  # Other potential matches if found
    }
    """
    address = request.data.get('address', '')
    county = request.data.get('county', '')
    city = request.data.get('city', '')

    if not address and not county:
        return Response({'error': 'Address or county is required'}, status=status.HTTP_400_BAD_REQUEST)

    def try_geocode(query):
        """Try to geocode a single query, return results or empty list."""
        try:
            response = requests.get(
                'https://nominatim.openstreetmap.org/search',
                params={
                    'q': query,
                    'format': 'json',
                    'limit': 5,  # Get multiple results for comparison
                    'countrycodes': 'us',
                    'addressdetails': 1  # Include address breakdown
                },
                headers={'User-Agent': 'FarmManagementTracker/1.0'},
                timeout=10
            )
            return response.json() if response.status_code == 200 else []
        except Exception:
            return []

    # Build list of address queries to try (in order of preference)
    queries_to_try = []

    # 1. Full address as provided
    if address:
        queries_to_try.append(address)

    # 2. Address with explicit California state
    if address and 'california' not in address.lower() and ', ca' not in address.lower():
        queries_to_try.append(f"{address}, California, USA")

    # 3. If county provided, try address + county + state
    if address and county:
        queries_to_try.append(f"{address}, {county} County, California, USA")
        # Also try without "County" suffix
        queries_to_try.append(f"{address}, {county}, California, USA")

    # 4. If city provided, try address + city + state
    if address and city:
        queries_to_try.append(f"{address}, {city}, California, USA")

    # 5. Try just county center (fallback for when address fails)
    if county:
        queries_to_try.append(f"{county} County, California, USA")

    # 6. Try structured query with street parsing (for rural addresses)
    if address:
        # Try extracting just the road/street name for rural areas
        import re
        # Match patterns like "1234 Some Road" or "12345 W Highway 99"
        road_match = re.search(r'\d+\s+(.+)', address.split(',')[0])
        if road_match:
            road_name = road_match.group(1).strip()
            if county:
                queries_to_try.append(f"{road_name}, {county} County, California, USA")
            if city:
                queries_to_try.append(f"{road_name}, {city}, California, USA")

    # Remove duplicates while preserving order
    seen = set()
    unique_queries = []
    for q in queries_to_try:
        q_lower = q.lower()
        if q_lower not in seen:
            seen.add(q_lower)
            unique_queries.append(q)

    # Try each query until we get a result
    best_result = None
    successful_query = None
    all_alternatives = []

    for query in unique_queries:
        results = try_geocode(query)

        if results:
            # Filter results to prefer California results
            ca_results = [r for r in results if 'california' in r.get('display_name', '').lower()]

            if ca_results:
                # Use the first California result as best
                if not best_result:
                    best_result = ca_results[0]
                    successful_query = query

                # Collect alternatives (excluding the best result)
                for r in ca_results[1:]:
                    if r not in all_alternatives:
                        all_alternatives.append(r)
            elif not best_result and results:
                # If no CA results, still use what we found
                best_result = results[0]
                successful_query = query

        # If we found a good result, don't try more queries
        if best_result:
            break

    if best_result:
        lat = float(best_result['lat'])
        lng = float(best_result['lon'])

        # Also get PLSS data (Section/Township/Range)
        plss_data = get_plss_from_coordinates(lat, lng)

        # Format alternatives for response
        formatted_alternatives = []
        for alt in all_alternatives[:4]:  # Limit to 4 alternatives
            formatted_alternatives.append({
                'lat': float(alt['lat']),
                'lng': float(alt['lon']),
                'display_name': alt.get('display_name', ''),
            })

        return Response({
            'lat': lat,
            'lng': lng,
            'display_name': best_result.get('display_name', ''),
            'search_query': successful_query,
            'section': plss_data.get('section'),
            'township': plss_data.get('township'),
            'range': plss_data.get('range'),
            'alternatives': formatted_alternatives,
        })
    else:
        # Return helpful error message
        tried_queries = ', '.join([f'"{q}"' for q in unique_queries[:3]])
        return Response({
            'error': 'Address not found',
            'tried_queries': unique_queries,
            'suggestion': 'Try entering a more specific address, nearby city name, or use the manual coordinate entry option.'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
def update_field_boundary(request, field_id):
    """
    Update a field's boundary from a drawn polygon.
    Also updates total_acres and fetches PLSS data.

    POST /api/fields/{id}/boundary/
    {
        "boundary_geojson": {...},
        "calculated_acres": 45.5
    }
    """
    from .models import Field  # Import here to avoid circular imports

    print(f"[Boundary] update_field_boundary called for field_id: {field_id}")

    try:
        field = Field.objects.get(id=field_id)
        print(f"[Boundary] Found field: {field.name}")
    except Field.DoesNotExist:
        return Response({'error': 'Field not found'}, status=status.HTTP_404_NOT_FOUND)

    boundary = request.data.get('boundary_geojson')
    acres = request.data.get('calculated_acres')

    print(f"[Boundary] Received boundary: {boundary is not None}")
    print(f"[Boundary] Received acres: {acres}")

    if boundary:
        field.boundary_geojson = boundary

        # Calculate centroid of the polygon to get PLSS data
        try:
            coords = boundary.get('coordinates', [[]])[0]
            print(f"[Boundary] Coordinates count: {len(coords) if coords else 0}")
            if coords:
                # Calculate centroid
                lats = [c[1] for c in coords]
                lngs = [c[0] for c in coords]
                centroid_lat = sum(lats) / len(lats)
                centroid_lng = sum(lngs) / len(lngs)

                print(f"[Boundary] Centroid: {centroid_lat}, {centroid_lng}")

                # Update field GPS coordinates to centroid
                field.gps_lat = centroid_lat
                field.gps_long = centroid_lng

                # Get PLSS data
                print(f"[Boundary] Calling get_plss_from_coordinates...")
                plss_data = get_plss_from_coordinates(centroid_lat, centroid_lng)
                print(f"[Boundary] PLSS result: {plss_data}")

                if plss_data.get('section'):
                    field.section = plss_data['section']
                    print(f"[Boundary] Set section: {field.section}")
                if plss_data.get('township'):
                    field.township = plss_data['township']
                    print(f"[Boundary] Set township: {field.township}")
                if plss_data.get('range'):
                    field.range_value = plss_data['range']
                    print(f"[Boundary] Set range: {field.range_value}")
        except Exception as e:
            print(f"[Boundary] Error calculating centroid/PLSS: {e}")
            import traceback
            traceback.print_exc()

    if acres is not None:
        field.calculated_acres = acres
        field.total_acres = acres  # Also update main acres field

    field.save()

    return Response({
        'id': field.id,
        'name': field.name,
        'boundary_geojson': field.boundary_geojson,
        'calculated_acres': str(field.calculated_acres) if field.calculated_acres else None,
        'total_acres': str(field.total_acres) if field.total_acres else None,
        'gps_lat': str(field.gps_lat) if field.gps_lat else None,
        'gps_long': str(field.gps_long) if field.gps_long else None,
        'section': field.section,
        'township': field.township,
        'range': field.range_value,
        'message': 'Boundary saved successfully'
    })


@api_view(['POST'])
def get_plss(request):
    """
    Get Section, Township, Range from GPS coordinates.
    """
    lat = request.data.get('lat')
    lng = request.data.get('lng')

    if lat is None or lng is None:
        return Response({'error': 'lat and lng are required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        plss_data = get_plss_from_coordinates(float(lat), float(lng))
        return Response({
            'section': plss_data.get('section'),
            'township': plss_data.get('township'),
            'range': plss_data.get('range'),
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# -----------------------------------------------------------------------------
# HELPER FUNCTIONS
# -----------------------------------------------------------------------------

def get_current_water_year():
    """Get the current water year string (e.g., '2024-2025')."""
    today = date.today()
    if today.month >= 10:
        return f"{today.year}-{today.year + 1}"
    return f"{today.year - 1}-{today.year}"


def get_water_year_dates(water_year=None):
    """Get start and end dates for a water year."""
    if not water_year:
        water_year = get_current_water_year()

    start_year = int(water_year.split('-')[0])
    return {
        'start': date(start_year, 10, 1),
        'end': date(start_year + 1, 9, 30)
    }


def get_current_reporting_period():
    """Get the current semi-annual reporting period."""
    today = date.today()
    if today.month >= 10:
        # Oct-Mar = Period 1 of next year
        return {
            'period': f"{today.year + 1}-1",
            'type': 'semi_annual_1',
            'start': date(today.year, 10, 1),
            'end': date(today.year + 1, 3, 31)
        }
    elif today.month >= 4:
        # Apr-Sep = Period 2
        return {
            'period': f"{today.year}-2",
            'type': 'semi_annual_2',
            'start': date(today.year, 4, 1),
            'end': date(today.year, 9, 30)
        }
    else:
        # Jan-Mar = Period 1
        return {
            'period': f"{today.year}-1",
            'type': 'semi_annual_1',
            'start': date(today.year - 1, 10, 1),
            'end': date(today.year, 3, 31)
        }


# -----------------------------------------------------------------------------
# WELL VIEWSET
# -----------------------------------------------------------------------------

class WellViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    ViewSet for Well model.
    Provides CRUD operations plus custom actions for well management.
    """
    queryset = WaterSource.objects.filter(source_type="well").select_related(
        'water_source', 'water_source__farm'
    ).all()
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_serializer_class(self):
        if self.action == 'list':
            return WellListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return WellCreateSerializer
        return WellSerializer

    def get_queryset(self):
        """Filter wells by user's current company."""
        queryset = super().get_queryset()

        # Filter by company
        user = self.request.user
        if hasattr(user, 'current_company') and user.current_company:
            queryset = queryset.filter(
                water_source__farm__company=user.current_company
            )

        # Optional filters
        gsa = self.request.query_params.get('gsa')
        if gsa:
            queryset = queryset.filter(gsa=gsa)

        basin = self.request.query_params.get('basin')
        if basin:
            queryset = queryset.filter(basin=basin)

        farm_id = self.request.query_params.get('farm')
        if farm_id:
            queryset = queryset.filter(water_source__farm_id=farm_id)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset

    @action(detail=True, methods=['get'])
    def readings(self, request, pk=None):
        """Get all readings for a specific well."""
        well = self.get_object()
        readings = water_source.readings.all()

        # Optional date filters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if start_date:
            readings = readings.filter(reading_date__gte=start_date)
        if end_date:
            readings = readings.filter(reading_date__lte=end_date)

        serializer = WellReadingListSerializer(readings, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def calibrations(self, request, pk=None):
        """Get calibration history for a specific well."""
        well = self.get_object()
        calibrations = water_source.calibrations.all()
        serializer = MeterCalibrationSerializer(calibrations, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def allocations(self, request, pk=None):
        """Get allocation history for a specific well."""
        well = self.get_object()
        allocations = water_source.allocations.all()

        water_year = request.query_params.get('water_year')
        if water_year:
            allocations = allocations.filter(water_year=water_year)

        serializer = WaterAllocationSerializer(allocations, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def extraction_summary(self, request, pk=None):
        """Get extraction summary for a well."""
        well = self.get_object()
        water_year = request.query_params.get('water_year', get_current_water_year())
        wy_dates = get_water_year_dates(water_year)

        # Get extraction
        extraction = water_source.readings.filter(
            reading_date__gte=wy_dates['start'],
            reading_date__lte=wy_dates['end']
        ).aggregate(
            total_af=Sum('extraction_acre_feet'),
            total_gallons=Sum('extraction_gallons'),
            reading_count=Count('id')
        )

        # Get allocation
        allocation = water_source.allocations.filter(
            water_year=water_year
        ).exclude(
            allocation_type='transferred_out'
        ).aggregate(
            total_af=Sum('allocated_acre_feet')
        )

        total_allocated = allocation['total_af'] or Decimal('0')
        total_extracted = extraction['total_af'] or Decimal('0')
        remaining = total_allocated - total_extracted

        return Response({
            'water_year': water_year,
            'well_id': well.id,
            'well_name': well.well_name or well.water_source.name,
            'total_allocated_af': float(total_allocated),
            'total_extracted_af': float(total_extracted),
            'remaining_af': float(remaining),
            'percent_used': float((total_extracted / total_allocated * 100) if total_allocated else 0),
            'is_over_allocation': remaining < 0,
            'reading_count': extraction['reading_count']
        })

    @action(detail=False, methods=['get'])
    def by_gsa(self, request):
        """Get wells grouped by GSA."""
        queryset = self.get_queryset()

        gsa_data = queryset.values('gsa').annotate(
            count=Count('id'),
            active_count=Count('id', filter=Q(status='active'))
        ).order_by('gsa')

        return Response(list(gsa_data))

    @action(detail=False, methods=['get'])
    def calibration_due(self, request):
        """Get wells with calibration due or overdue."""
        days = int(request.query_params.get('days', 30))
        warning_date = date.today() + timedelta(days=days)

        queryset = self.get_queryset().filter(
            Q(next_calibration_due__lte=warning_date) |
            Q(next_calibration_due__isnull=True),
            has_flowmeter=True,
            status='active'
        )

        serializer = WellListSerializer(queryset, many=True)
        return Response(serializer.data)


# -----------------------------------------------------------------------------
# WELL READING VIEWSET
# -----------------------------------------------------------------------------

class WellReadingViewSet(CompanyFilteredViewSet):
    """ViewSet for WellReading model."""
    model = WellReading
    serializer_class = WellReadingSerializer
    company_field = 'water_source__farm__company'
    select_related_fields = ('water_source', 'water_source__farm')
    default_ordering = ('-id',)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return WellReadingCreateSerializer
        return WellReadingSerializer

    def filter_queryset_by_params(self, qs):
        water_source_id = self.request.query_params.get('water_source') or self.request.query_params.get('well')
        if water_source_id:
            qs = qs.filter(water_source_id=water_source_id)

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(reading_date__gte=start_date)
        if end_date:
            qs = qs.filter(reading_date__lte=end_date)
        return qs

    @action(detail=False, methods=['get'])
    def by_period(self, request):
        """Get readings for a specific reporting period."""
        period_type = request.query_params.get('period_type', 'semi_annual_1')
        water_year = request.query_params.get('water_year', get_current_water_year())

        wy_dates = get_water_year_dates(water_year)

        if period_type == 'semi_annual_1':
            start = wy_dates['start']
            end = date(wy_dates['start'].year + 1, 3, 31)
        elif period_type == 'semi_annual_2':
            start = date(wy_dates['end'].year, 4, 1)
            end = wy_dates['end']
        else:
            start = wy_dates['start']
            end = wy_dates['end']

        queryset = self.get_queryset().filter(
            reading_date__gte=start,
            reading_date__lte=end
        )

        serializer = WellReadingListSerializer(queryset, many=True)
        return Response({
            'period_type': period_type,
            'water_year': water_year,
            'start_date': start,
            'end_date': end,
            'readings': serializer.data
        })


# -----------------------------------------------------------------------------
# METER CALIBRATION VIEWSET
# -----------------------------------------------------------------------------

class MeterCalibrationViewSet(CompanyFilteredViewSet):
    """ViewSet for MeterCalibration model."""
    model = MeterCalibration
    serializer_class = MeterCalibrationSerializer
    company_field = 'water_source__farm__company'
    select_related_fields = ('water_source', 'water_source__farm')
    default_ordering = ('-id',)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MeterCalibrationCreateSerializer
        return MeterCalibrationSerializer

    def filter_queryset_by_params(self, qs):
        well_id = self.request.query_params.get('well')
        if well_id:
            qs = qs.filter(water_source_id=well_id)
        return qs

    @action(detail=False, methods=['get'])
    def expiring(self, request):
        """Get calibrations expiring within specified days."""
        days = int(request.query_params.get('days', 90))
        expiry_date = date.today() + timedelta(days=days)

        queryset = self.get_queryset().filter(
            next_calibration_due__lte=expiry_date,
            next_calibration_due__gte=date.today()
        ).order_by('next_calibration_due')

        serializer = MeterCalibrationSerializer(queryset, many=True)
        return Response(serializer.data)


# -----------------------------------------------------------------------------
# WATER ALLOCATION VIEWSET
# -----------------------------------------------------------------------------

class WaterAllocationViewSet(CompanyFilteredViewSet):
    """ViewSet for WaterAllocation model."""
    model = WaterAllocation
    serializer_class = WaterAllocationSerializer
    company_field = 'water_source__farm__company'
    select_related_fields = ('water_source', 'water_source__farm')
    default_ordering = ('-id',)

    def filter_queryset_by_params(self, qs):
        well_id = self.request.query_params.get('well')
        if well_id:
            qs = qs.filter(water_source_id=well_id)

        water_year = self.request.query_params.get('water_year')
        if water_year:
            qs = qs.filter(water_year=water_year)
        return qs

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get allocation vs extraction summary for all wells."""
        water_year = request.query_params.get('water_year', get_current_water_year())
        wy_dates = get_water_year_dates(water_year)

        user = request.user
        if hasattr(user, 'current_company') and user.current_company:
            wells = WaterSource.objects.filter(source_type="well").filter(
                water_source__farm__company=user.current_company,
                status='active'
            )
        else:
            wells = WaterSource.objects.filter(source_type="well").filter(status='active')

        summaries = []
        for well in wells:
            allocation = water_source.allocations.filter(
                water_year=water_year
            ).exclude(
                allocation_type='transferred_out'
            ).aggregate(total=Sum('allocated_acre_feet'))['total'] or Decimal('0')

            extraction = water_source.readings.filter(
                reading_date__gte=wy_dates['start'],
                reading_date__lte=wy_dates['end']
            ).aggregate(total=Sum('extraction_acre_feet'))['total'] or Decimal('0')

            remaining = allocation - extraction

            summaries.append({
                'water_year': water_year,
                'well_id': well.id,
                'well_name': well.well_name or well.water_source.name,
                'gsa': well.gsa,
                'total_allocated_af': float(allocation),
                'total_extracted_af': float(extraction),
                'remaining_af': float(remaining),
                'percent_used': float((extraction / allocation * 100) if allocation else 0),
                'is_over_allocation': remaining < 0
            })

        return Response(summaries)


# -----------------------------------------------------------------------------
# EXTRACTION REPORT VIEWSET
# -----------------------------------------------------------------------------

class ExtractionReportViewSet(CompanyFilteredViewSet):
    """ViewSet for ExtractionReport model."""
    model = ExtractionReport
    serializer_class = ExtractionReportSerializer
    company_field = 'water_source__farm__company'
    select_related_fields = ('water_source', 'water_source__farm')
    default_ordering = ('-id',)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ExtractionReportCreateSerializer
        return ExtractionReportSerializer

    def filter_queryset_by_params(self, qs):
        well_id = self.request.query_params.get('well')
        if well_id:
            qs = qs.filter(water_source_id=well_id)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        gsa = self.request.query_params.get('gsa')
        if gsa:
            qs = qs.filter(well__gsa=gsa)
        return qs

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Auto-generate extraction report from readings."""
        well_id = request.data.get('well_id')
        period_type = request.data.get('period_type', 'semi_annual_1')
        reporting_period = request.data.get('reporting_period')

        if not well_id:
            return Response(
                {'error': 'well_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            well = WaterSource.objects.filter(source_type="well").get(id=well_id)
        except Well.DoesNotExist:
            return Response(
                {'error': 'Well not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Determine period dates
        if not reporting_period:
            period_info = get_current_reporting_period()
            reporting_period = period_info['period']
            period_start = period_info['start']
            period_end = period_info['end']
        else:
            parts = reporting_period.split('-')
            year = int(parts[0])
            period_num = int(parts[1])

            if period_num == 1:
                period_start = date(year - 1, 10, 1)
                period_end = date(year, 3, 31)
            else:
                period_start = date(year, 4, 1)
                period_end = date(year, 9, 30)

        # Check if report already exists
        if ExtractionReport.objects.filter(
            well=well,
            reporting_period=reporting_period
        ).exists():
            return Response(
                {'error': f'Report for {reporting_period} already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get readings for the period
        readings = WellReading.objects.filter(
            well=well,
            reading_date__gte=period_start,
            reading_date__lte=period_end
        ).order_by('reading_date', 'reading_time')

        if not readings.exists():
            return Response(
                {'error': 'No readings found for this period'},
                status=status.HTTP_400_BAD_REQUEST
            )

        first_reading = readings.first()
        last_reading = readings.last()

        pre_period_reading = WellReading.objects.filter(
            well=well,
            reading_date__lt=period_start
        ).order_by('-reading_date', '-reading_time').first()

        beginning_reading = pre_period_reading.meter_reading if pre_period_reading else first_reading.meter_reading
        beginning_date = pre_period_reading.reading_date if pre_period_reading else first_reading.reading_date

        water_year = f"{period_start.year}-{period_end.year}" if period_start.month >= 10 else f"{period_start.year - 1}-{period_start.year}"
        allocation = water_source.allocations.filter(
            water_year=water_year
        ).exclude(
            allocation_type='transferred_out'
        ).aggregate(total=Sum('allocated_acre_feet'))['total'] or Decimal('0')

        period_allocation = allocation / 2 if period_type.startswith('semi_annual') else allocation

        report = ExtractionReport.objects.create(
            well=well,
            period_type=period_type,
            reporting_period=reporting_period,
            period_start_date=period_start,
            period_end_date=period_end,
            beginning_meter_reading=beginning_reading,
            beginning_reading_date=beginning_date,
            ending_meter_reading=last_reading.meter_reading,
            ending_reading_date=last_reading.reading_date,
            period_allocation_af=period_allocation,
            status='draft'
        )

        serializer = ExtractionReportSerializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Mark report as submitted."""
        report = self.get_object()

        if report.status == 'submitted':
            return Response(
                {'error': 'Report already submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        report.status = 'submitted'
        report.submitted_date = date.today()
        report.save()

        serializer = ExtractionReportSerializer(report)
        return Response(serializer.data)


# -----------------------------------------------------------------------------
# IRRIGATION EVENT VIEWSET (SGMA context)
# -----------------------------------------------------------------------------

class SGMAIrrigationEventViewSet(CompanyFilteredViewSet):
    """ViewSet for IrrigationEvent model (SGMA context)."""
    model = IrrigationEvent
    serializer_class = IrrigationEventSerializer
    company_field = 'field__farm__company'
    select_related_fields = ('field', 'field__farm', 'water_source')
    default_ordering = ('-id',)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return IrrigationEventCreateSerializer
        return IrrigationEventSerializer

    def filter_queryset_by_params(self, qs):
        field_id = self.request.query_params.get('field')
        if field_id:
            qs = qs.filter(field_id=field_id)

        well_id = self.request.query_params.get('well')
        if well_id:
            qs = qs.filter(water_source_id=well_id)

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            qs = qs.filter(irrigation_date__gte=start_date)
        if end_date:
            qs = qs.filter(irrigation_date__lte=end_date)
        return qs

    @action(detail=False, methods=['get'])
    def by_field(self, request):
        """Get irrigation totals grouped by field."""
        queryset = self.get_queryset()

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if start_date:
            queryset = queryset.filter(irrigation_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(irrigation_date__lte=end_date)

        field_data = queryset.values(
            'field__id', 'field__name', 'field__farm__name'
        ).annotate(
            total_af=Sum('water_applied_af'),
            total_gallons=Sum('water_applied_gallons'),
            event_count=Count('id'),
            total_hours=Sum('duration_hours')
        ).order_by('field__farm__name', 'field__name')

        return Response(list(field_data))


# Keep the original name for backward compatibility in the re-export
IrrigationEventViewSet = SGMAIrrigationEventViewSet


# -----------------------------------------------------------------------------
# SGMA DASHBOARD VIEW
# -----------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def sgma_dashboard(request):
    """
    Get SGMA compliance dashboard data.
    Returns summary statistics, alerts, and status for all wells.
    """
    user = request.user

    if hasattr(user, 'current_company') and user.current_company:
        wells = WaterSource.objects.filter(
            source_type="well",
            farm__company=user.current_company
        )
    else:
        wells = WaterSource.objects.filter(source_type="well")

    water_year = get_current_water_year()
    wy_dates = get_water_year_dates(water_year)
    current_period = get_current_reporting_period()

    # Well counts
    total_wells = wells.count()
    active_wells = wells.filter(active=True).count()
    wells_with_ami = wells.filter(has_ami=True).count()

    # YTD extraction
    ytd_extraction = WellReading.objects.filter(
        water_source__in=wells,
        reading_date__gte=wy_dates['start'],
        reading_date__lte=date.today()
    ).aggregate(total=Sum('extraction_acre_feet'))['total'] or Decimal('0')

    # YTD allocation
    ytd_allocation = WaterAllocation.objects.filter(
        water_source__in=wells,
        water_year=water_year
    ).exclude(
        allocation_type='transferred_out'
    ).aggregate(total=Sum('allocated_acre_feet'))['total'] or Decimal('0')

    allocation_remaining = ytd_allocation - ytd_extraction
    percent_used = (ytd_extraction / ytd_allocation * 100) if ytd_allocation else Decimal('0')

    # Current period extraction
    current_period_extraction = WellReading.objects.filter(
        water_source__in=wells,
        reading_date__gte=current_period['start'],
        reading_date__lte=min(current_period['end'], date.today())
    ).aggregate(total=Sum('extraction_acre_feet'))['total'] or Decimal('0')

    # Calibration status
    today = date.today()
    calibrations_current = wells.filter(
        meter_calibration_current=True,
        next_calibration_due__gt=today
    ).count()

    calibrations_due_soon = wells.filter(
        next_calibration_due__lte=today + timedelta(days=90),
        next_calibration_due__gt=today
    ).count()

    calibrations_overdue = wells.filter(
        Q(next_calibration_due__lte=today) |
        Q(next_calibration_due__isnull=True, has_flowmeter=True),
        active=True
    ).count()

    # Next deadlines
    next_calibration = wells.filter(
        next_calibration_due__gte=today
    ).order_by('next_calibration_due').values_list(
        'next_calibration_due', flat=True
    ).first()

    if today.month <= 3:
        next_report_due = date(today.year, 4, 1)
    elif today.month <= 9:
        next_report_due = date(today.year, 10, 1)
    else:
        next_report_due = date(today.year + 1, 4, 1)

    # Generate alerts
    alerts = []

    if calibrations_overdue > 0:
        alerts.append({
            'type': 'warning',
            'category': 'calibration',
            'message': f'{calibrations_overdue} well(s) have overdue meter calibrations',
            'action': 'Schedule calibration appointments'
        })

    if calibrations_due_soon > 0:
        alerts.append({
            'type': 'info',
            'category': 'calibration',
            'message': f'{calibrations_due_soon} well(s) have calibrations due within 90 days',
            'action': 'Plan upcoming calibrations'
        })

    if allocation_remaining < 0:
        alerts.append({
            'type': 'error',
            'category': 'allocation',
            'message': f'Over allocation by {abs(float(allocation_remaining)):.2f} AF',
            'action': 'Review extraction and consider purchasing additional allocation'
        })
    elif ytd_allocation > 0 and percent_used > 80:
        alerts.append({
            'type': 'warning',
            'category': 'allocation',
            'message': f'{float(percent_used):.1f}% of annual allocation used',
            'action': 'Monitor extraction closely'
        })

    # Wells by GSA
    wells_by_gsa_raw = wells.values('gsa').annotate(
        count=Count('id'),
        active_count=Count('id', filter=Q(active=True)),
        ytd_extraction=Sum(
            'readings__extraction_acre_feet',
            filter=Q(readings__reading_date__gte=wy_dates['start'])
        )
    ).order_by('gsa')

    # Convert Decimal to float for JSON serialization
    wells_by_gsa = []
    for item in wells_by_gsa_raw:
        wells_by_gsa.append({
            'gsa': item['gsa'],
            'count': item['count'],
            'active': item['active_count'],
            'ytd_extraction': float(item['ytd_extraction'] or 0)
        })

    # Recent readings
    recent_readings = WellReading.objects.filter(
        water_source__in=wells
    ).select_related('water_source').order_by('-reading_date', '-reading_time')[:10]

    recent_readings_data = WellReadingListSerializer(recent_readings, many=True).data

    return Response({
        'total_wells': total_wells,
        'active_wells': active_wells,
        'wells_with_ami': wells_with_ami,

        'ytd_extraction_af': float(ytd_extraction),
        'ytd_allocation_af': float(ytd_allocation),
        'allocation_remaining_af': float(allocation_remaining),
        'percent_allocation_used': float(percent_used),

        'current_period': current_period['period'],
        'current_period_extraction_af': float(current_period_extraction),
        'current_period_start': str(current_period['start']),
        'current_period_end': str(current_period['end']),

        'calibrations_current': calibrations_current,
        'calibrations_due_soon': calibrations_due_soon,
        'calibrations_overdue': calibrations_overdue,

        'next_report_due': str(next_report_due) if next_report_due else None,
        'next_calibration_due': str(next_calibration) if next_calibration else None,

        'alerts': alerts,
        'wells_by_gsa': wells_by_gsa,
        'recent_readings': recent_readings_data,

        'water_year': water_year,
        'as_of_date': str(date.today())
    })
