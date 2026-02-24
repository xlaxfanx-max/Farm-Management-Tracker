"""
Farm, Field, Crop, Rootstock, and FarmParcel views.
"""
from rest_framework import viewsets, filters, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .permissions import HasCompanyAccess
from .audit_utils import AuditLogMixin
from django.db.models import Q
from .view_helpers import get_user_company, require_company, CompanyFilteredViewSet
from .models import Farm, Field, FarmParcel, Crop, Rootstock, CropCategory
from .serializers import (
    FarmSerializer, FarmParcelSerializer,
    FieldSerializer, PesticideApplicationSerializer,
    CropSerializer, RootstockSerializer,
)


class FarmViewSet(CompanyFilteredViewSet):
    """
    API endpoint for managing farms.

    RLS NOTES:
    - get_queryset filters by company (defense in depth with RLS)
    - perform_create sets company_id (REQUIRED for RLS INSERT)
    """
    model = Farm
    serializer_class = FarmSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'farm_number', 'owner_name', 'county']
    ordering_fields = ['name', 'created_at']
    default_ordering = ('-id',)

    def filter_queryset_by_params(self, qs):
        return qs.filter(active=True)

    @action(detail=True, methods=['get'])
    def fields(self, request, pk=None):
        """Get all fields for a specific farm"""
        farm = self.get_object()
        fields = farm.fields.all()
        serializer = FieldSerializer(fields, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'])
    def parcels(self, request, pk=None):
        """GET: List parcels, POST: Add parcel"""
        farm = self.get_object()

        if request.method == 'GET':
            serializer = FarmParcelSerializer(farm.parcels.all(), many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            data = request.data.copy()
            data['farm'] = farm.id
            if 'apn' in data:
                data['apn'] = FarmParcel.format_apn(data['apn'], farm.county)

            serializer = FarmParcelSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='bulk-parcels')
    def bulk_parcels(self, request, pk=None):
        """Bulk add/update parcels"""
        farm = self.get_object()
        parcels_data = request.data.get('parcels', [])
        replace_existing = request.data.get('replace', False)

        if replace_existing:
            farm.parcels.all().delete()

        created, updated, errors = [], [], []

        for parcel_data in parcels_data:
            apn = FarmParcel.format_apn(parcel_data.get('apn', ''), farm.county)
            try:
                parcel, was_created = FarmParcel.objects.update_or_create(
                    farm=farm, apn=apn,
                    defaults={
                        'acreage': parcel_data.get('acreage'),
                        'ownership_type': parcel_data.get('ownership_type', 'owned'),
                        'notes': parcel_data.get('notes', ''),
                    }
                )
                (created if was_created else updated).append(
                    FarmParcelSerializer(parcel).data
                )
            except Exception as e:
                errors.append({'apn': parcel_data.get('apn'), 'error': str(e)})

        return Response({
            'created': created, 'updated': updated, 'errors': errors,
            'total_parcels': farm.parcels.count()
        })

    @action(detail=True, methods=['post'], url_path='update-coordinates')
    def update_coordinates(self, request, pk=None):
        """Update only GPS coordinates for a farm - bypasses full serializer validation"""
        farm = self.get_object()

        lat = request.data.get('gps_latitude')
        lng = request.data.get('gps_longitude')

        if lat is None or lng is None:
            return Response(
                {'error': 'Both gps_latitude and gps_longitude are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            farm.gps_latitude = float(lat)
            farm.gps_longitude = float(lng)
            farm.save(update_fields=['gps_latitude', 'gps_longitude'])

            return Response({
                'success': True,
                'gps_latitude': farm.gps_latitude,
                'gps_longitude': farm.gps_longitude
            })
        except (ValueError, TypeError) as e:
            return Response(
                {'error': f'Invalid coordinate values: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

class FieldViewSet(CompanyFilteredViewSet):
    """
    API endpoint for managing fields.

    RLS NOTES:
    - Fields inherit company from their Farm
    - get_queryset filters by company through farm relationship
    """
    model = Field
    serializer_class = FieldSerializer
    company_field = 'farm__company'
    select_related_fields = ('farm',)
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'field_number', 'current_crop', 'county']
    ordering_fields = ['name', 'total_acres', 'created_at']

    def filter_queryset_by_params(self, qs):
        return qs.filter(active=True)

    @action(detail=True, methods=['get'])
    def applications(self, request, pk=None):
        """Get all applications for a specific field"""
        field = self.get_object()
        applications = field.applications.all()
        serializer = PesticideApplicationSerializer(applications, many=True)
        return Response(serializer.data)


# =============================================================================
# CROP & ROOTSTOCK VIEWSETS
# =============================================================================

class CropViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing crops.

    System defaults (company=null) are read-only.
    Companies can create custom crops.
    """
    serializer_class = CropSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'variety', 'scientific_name']
    ordering_fields = ['name', 'category', 'created_at']
    ordering = ['category', 'name']

    def get_queryset(self):
        """Return system defaults + company-specific crops."""
        user = self.request.user
        company = get_user_company(user)
        queryset = Crop.objects.filter(active=True)

        if company:
            # System defaults (company=null) + company's custom crops
            queryset = queryset.filter(Q(company__isnull=True) | Q(company=company))
        else:
            # Only system defaults
            queryset = queryset.filter(company__isnull=True)

        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        # Filter by crop type
        crop_type = self.request.query_params.get('crop_type')
        if crop_type:
            queryset = queryset.filter(crop_type=crop_type)

        return queryset

    def perform_create(self, serializer):
        """Assign company to new crops."""
        company = require_company(self.request.user)
        serializer.save(company=company)

    def perform_update(self, serializer):
        """Prevent editing system defaults."""
        if serializer.instance.company is None:
            raise serializers.ValidationError(
                'System default crops cannot be modified. Create a custom crop instead.'
            )
        serializer.save()

    def perform_destroy(self, instance):
        """Prevent deleting system defaults; soft-delete custom crops."""
        if instance.company is None:
            raise serializers.ValidationError(
                'System default crops cannot be deleted.'
            )
        # Check if crop is in use
        if instance.fields.exists():
            raise serializers.ValidationError(
                'Cannot delete crop that is assigned to fields.'
            )
        instance.active = False
        instance.save()

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Return list of crop categories."""
        return Response([
            {'value': choice.value, 'label': choice.label}
            for choice in CropCategory
        ])

    @action(detail=False, methods=['get'])
    def search(self, request):
        """Quick search for autocomplete."""
        q = request.query_params.get('q', '')
        if len(q) < 2:
            return Response([])
        queryset = self.get_queryset().filter(
            Q(name__icontains=q) | Q(variety__icontains=q)
        )[:20]
        return Response(CropSerializer(queryset, many=True).data)


class RootstockViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing rootstocks.

    System defaults (company=null) are read-only.
    Companies can create custom rootstocks.
    """
    serializer_class = RootstockSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'primary_category']
    ordering = ['primary_category', 'name']

    def get_queryset(self):
        user = self.request.user
        company = get_user_company(user)
        queryset = Rootstock.objects.filter(active=True)

        if company:
            queryset = queryset.filter(Q(company__isnull=True) | Q(company=company))
        else:
            queryset = queryset.filter(company__isnull=True)

        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(primary_category=category)

        # Filter by compatible crop
        crop_id = self.request.query_params.get('crop')
        if crop_id:
            queryset = queryset.filter(compatible_crops__id=crop_id)

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    def perform_update(self, serializer):
        if serializer.instance.company is None:
            raise serializers.ValidationError(
                'System default rootstocks cannot be modified.'
            )
        serializer.save()

    def perform_destroy(self, instance):
        if instance.company is None:
            raise serializers.ValidationError(
                'System default rootstocks cannot be deleted.'
            )
        if instance.fields.exists():
            raise serializers.ValidationError(
                'Cannot delete rootstock that is assigned to fields.'
            )
        instance.active = False
        instance.save()

    @action(detail=False, methods=['get'])
    def for_crop(self, request):
        """Get rootstocks compatible with a specific crop."""
        crop_id = request.query_params.get('crop_id')
        if not crop_id:
            return Response({'error': 'crop_id required'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().filter(compatible_crops__id=crop_id)
        return Response(RootstockSerializer(queryset, many=True).data)


class FarmParcelViewSet(CompanyFilteredViewSet):
    model = FarmParcel
    serializer_class = FarmParcelSerializer
    company_field = 'farm__company'
    select_related_fields = ('farm',)

    def filter_queryset_by_params(self, qs):
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            qs = qs.filter(farm_id=farm_id)
        return qs
