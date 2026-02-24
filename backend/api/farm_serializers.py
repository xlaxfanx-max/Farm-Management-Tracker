from rest_framework import serializers
from .models import FarmParcel, Farm, Field
from .crop_serializers import CropListSerializer, RootstockListSerializer
from .serializer_mixins import DynamicFieldsMixin


class FarmParcelSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for farm parcel/APN data."""

    list_fields = ['id', 'apn', 'acreage', 'ownership_type']

    class Meta:
        model = FarmParcel
        fields = [
            'id', 'farm', 'apn', 'acreage',
            'ownership_type', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# Backward-compatible alias
FarmParcelListSerializer = FarmParcelSerializer


class FarmSerializer(serializers.ModelSerializer):
    field_count = serializers.SerializerMethodField()
    parcels = FarmParcelSerializer(many=True, read_only=True)
    apn_list = serializers.ReadOnlyField()
    parcel_count = serializers.ReadOnlyField()
    total_parcel_acreage = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    # Add properties from LocationMixin
    has_coordinates = serializers.ReadOnlyField()
    has_plss = serializers.ReadOnlyField()
    plss_display = serializers.ReadOnlyField()

    class Meta:
        model = Farm
        fields = [
            'id', 'name', 'farm_number', 'owner_name', 'operator_name',
            'address', 'county', 'gps_latitude', 'gps_longitude',
            'plss_section', 'plss_township', 'plss_range', 'plss_meridian',
            'has_coordinates', 'has_plss', 'plss_display',
            'phone', 'email', 'active',
            'parcels', 'apn_list', 'parcel_count', 'total_parcel_acreage',
            'cimis_station_id', 'pur_site_id',
            'created_at', 'updated_at', 'field_count'
        ]

    def get_field_count(self, obj):
        return obj.fields.count()

class FieldSerializer(serializers.ModelSerializer):
    application_count = serializers.SerializerMethodField()
    farm_name = serializers.CharField(source='farm.name', read_only=True)

    # Add properties from LocationMixin
    has_coordinates = serializers.ReadOnlyField()
    has_plss = serializers.ReadOnlyField()
    plss_display = serializers.ReadOnlyField()

    # Crop/Rootstock nested data
    crop_name = serializers.CharField(source='crop.name', read_only=True, allow_null=True)
    crop_detail = CropListSerializer(source='crop', read_only=True)
    rootstock_name = serializers.CharField(source='rootstock.name', read_only=True, allow_null=True)
    rootstock_detail = RootstockListSerializer(source='rootstock', read_only=True)

    # Computed properties
    crop_age_years = serializers.ReadOnlyField()
    calculated_trees_per_acre = serializers.ReadOnlyField()

    # Display fields for choices
    row_orientation_display = serializers.CharField(source='get_row_orientation_display', read_only=True)
    trellis_system_display = serializers.CharField(source='get_trellis_system_display', read_only=True)
    soil_type_display = serializers.CharField(source='get_soil_type_display', read_only=True)
    irrigation_type_display = serializers.CharField(source='get_irrigation_type_display', read_only=True)
    organic_status_display = serializers.CharField(source='get_organic_status_display', read_only=True)

    class Meta:
        model = Field
        fields = [
            'id', 'name', 'farm', 'farm_name', 'field_number', 'county',
            'plss_section', 'plss_township', 'plss_range', 'plss_meridian',
            'gps_latitude', 'gps_longitude',
            'has_coordinates', 'has_plss', 'plss_display',
            'boundary_geojson', 'calculated_acres',
            'total_acres',
            # Legacy crop field (for backward compatibility)
            'current_crop',
            # New crop fields
            'crop', 'crop_name', 'crop_detail',
            'rootstock', 'rootstock_name', 'rootstock_detail',
            # Planting data
            'planting_date', 'year_planted',
            # Spacing & density
            'row_spacing_ft', 'tree_spacing_ft', 'tree_count', 'trees_per_acre',
            'crop_age_years', 'calculated_trees_per_acre',
            # Orientation & trellis
            'row_orientation', 'row_orientation_display',
            'trellis_system', 'trellis_system_display',
            # Soil & irrigation
            'soil_type', 'soil_type_display',
            'irrigation_type', 'irrigation_type_display',
            # Production
            'expected_yield_per_acre', 'yield_unit',
            # Certification
            'organic_status', 'organic_status_display',
            'organic_certifier', 'organic_cert_number', 'organic_cert_expiration',
            # PUR mapping
            'pur_site_id',
            # Notes & status
            'notes', 'active',
            'created_at', 'updated_at', 'application_count'
        ]

    def get_application_count(self, obj):
        return obj.applications.count()
