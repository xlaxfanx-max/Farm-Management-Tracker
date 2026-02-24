from rest_framework import serializers
from .models import Crop, Rootstock, CropCategory
from .serializer_mixins import DynamicFieldsMixin


class CropSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for Crop model."""
    is_system_default = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    crop_type_display = serializers.CharField(source='get_crop_type_display', read_only=True)
    season_template_name = serializers.CharField(source='season_template.name', read_only=True)
    display_name = serializers.SerializerMethodField()

    list_fields = ['id', 'name', 'variety', 'display_name', 'category', 'crop_type']

    class Meta:
        model = Crop
        fields = [
            'id', 'name', 'scientific_name', 'variety',
            'category', 'category_display', 'crop_type', 'crop_type_display',
            'typical_spacing_row_ft', 'typical_spacing_tree_ft',
            'typical_root_depth_inches', 'years_to_maturity',
            'productive_lifespan_years',
            'kc_mature', 'kc_young',
            'typical_harvest_months', 'default_bin_weight_lbs',
            # Season configuration
            'season_template', 'season_template_name',
            'supports_multiple_cycles', 'typical_cycles_per_year',
            'typical_days_to_maturity',
            'company', 'active', 'notes',
            'is_system_default',
            'display_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_is_system_default(self, obj):
        return obj.company is None

    def get_display_name(self, obj):
        if obj.variety:
            return f"{obj.name} ({obj.variety})"
        return obj.name


# Alias for backward compatibility
CropListSerializer = CropSerializer


class RootstockSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for Rootstock model."""
    compatible_crop_ids = serializers.PrimaryKeyRelatedField(
        source='compatible_crops',
        queryset=Crop.objects.all(),
        many=True,
        required=False
    )
    is_system_default = serializers.SerializerMethodField()
    primary_category_display = serializers.CharField(source='get_primary_category_display', read_only=True)
    display_name = serializers.SerializerMethodField()

    list_fields = ['id', 'name', 'code', 'display_name', 'primary_category', 'vigor']

    class Meta:
        model = Rootstock
        fields = [
            'id', 'name', 'code', 'primary_category', 'primary_category_display',
            'vigor', 'disease_resistance', 'soil_tolerance',
            'cold_hardiness', 'drought_tolerance',
            'compatible_crop_ids',
            'company', 'active', 'notes',
            'is_system_default',
            'display_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_is_system_default(self, obj):
        return obj.company is None

    def get_display_name(self, obj):
        if obj.code:
            return f"{obj.name} ({obj.code})"
        return obj.name


# Alias for backward compatibility
RootstockListSerializer = RootstockSerializer
