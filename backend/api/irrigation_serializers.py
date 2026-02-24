from rest_framework import serializers
from .serializer_mixins import DynamicFieldsMixin
from .models import (
    IrrigationZone, CropCoefficientProfile, CIMISDataCache,
    IrrigationRecommendation, SoilMoistureReading, IrrigationEvent,
)


class CropCoefficientProfileSerializer(serializers.ModelSerializer):
    """Serializer for crop coefficient (Kc) profiles."""

    zone_name = serializers.CharField(source='zone.name', read_only=True, allow_null=True)
    is_default = serializers.SerializerMethodField()

    class Meta:
        model = CropCoefficientProfile
        fields = [
            'id', 'zone', 'zone_name', 'crop_type', 'growth_stage',
            'kc_jan', 'kc_feb', 'kc_mar', 'kc_apr', 'kc_may', 'kc_jun',
            'kc_jul', 'kc_aug', 'kc_sep', 'kc_oct', 'kc_nov', 'kc_dec',
            'notes', 'is_default',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_is_default(self, obj):
        """Check if this is a system default profile (no zone assigned)."""
        return obj.zone is None


class CIMISDataSerializer(serializers.ModelSerializer):
    """Serializer for cached CIMIS weather data."""

    class Meta:
        model = CIMISDataCache
        fields = [
            'id', 'date', 'source_id', 'data_source',
            'eto', 'precipitation',
            'air_temp_avg', 'air_temp_max', 'air_temp_min',
            'eto_qc', 'fetched_at',
        ]
        read_only_fields = ['id', 'fetched_at']


class SoilMoistureReadingSerializer(serializers.ModelSerializer):
    """Serializer for soil moisture sensor readings."""

    zone_name = serializers.CharField(source='zone.name', read_only=True)
    field_name = serializers.CharField(source='zone.field.name', read_only=True)
    depletion_pct = serializers.SerializerMethodField()

    class Meta:
        model = SoilMoistureReading
        fields = [
            'id', 'zone', 'zone_name', 'field_name',
            'reading_datetime', 'sensor_id', 'sensor_depth_inches',
            'volumetric_water_content', 'soil_tension_cb',
            'depletion_pct', 'notes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_depletion_pct(self, obj):
        """Calculate depletion percentage if VWC is available."""
        if obj.volumetric_water_content and obj.zone:
            # Assume field capacity is around 35% VWC for typical soils
            field_capacity = 35.0
            wilting_point = 15.0
            vwc = float(obj.volumetric_water_content)
            if vwc >= field_capacity:
                return 0.0
            elif vwc <= wilting_point:
                return 100.0
            return round(((field_capacity - vwc) / (field_capacity - wilting_point)) * 100, 1)
        return None


class IrrigationRecommendationSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for irrigation recommendations.

    On list action, returns only ``list_fields``.  Detail/create/update
    actions return the full field set.
    """

    list_fields = [
        'id', 'zone', 'zone_name',
        'recommended_date', 'recommended_depth_inches', 'recommended_duration_hours',
        'soil_moisture_depletion_pct', 'status', 'status_display',
        'created_at',
    ]

    zone_name = serializers.CharField(source='zone.name', read_only=True)
    field_name = serializers.CharField(source='zone.field.name', read_only=True)
    farm_name = serializers.CharField(source='zone.field.farm.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    satellite_adjustment = serializers.SerializerMethodField()

    class Meta:
        model = IrrigationRecommendation
        fields = [
            'id', 'zone', 'zone_name', 'field_name', 'farm_name',
            'recommended_date', 'recommended_depth_inches', 'recommended_duration_hours',
            'days_since_last_irrigation', 'cumulative_etc', 'effective_rainfall',
            'soil_moisture_depletion_pct',
            'status', 'status_display',
            'calculation_details', 'satellite_adjustment',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_satellite_adjustment(self, obj):
        """Extract satellite adjustment details from calculation_details."""
        if not obj.calculation_details:
            return None
        return obj.calculation_details.get('satellite_adjustment')


# Backward-compatible alias
IrrigationRecommendationListSerializer = IrrigationRecommendationSerializer


class IrrigationZoneSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for irrigation zones.

    On list action, returns only ``list_fields``.  Detail/create/update
    actions return the full field set.
    """

    list_fields = [
        'id', 'name', 'field', 'field_name', 'farm_name',
        'acres', 'crop_type', 'irrigation_method',
        'cimis_target', 'active',
    ]

    # Related object names
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_id = serializers.IntegerField(source='field.farm.id', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    water_source_name = serializers.CharField(source='water_source.name', read_only=True, allow_null=True)

    # Computed fields
    soil_capacity_inches = serializers.SerializerMethodField()
    mad_threshold_inches = serializers.SerializerMethodField()

    class Meta:
        model = IrrigationZone
        fields = [
            'id', 'name', 'field', 'field_name', 'farm_id', 'farm_name',
            'water_source', 'water_source_name',
            'acres', 'crop_type', 'tree_age', 'tree_spacing_ft',
            'irrigation_method', 'emitters_per_tree', 'emitter_gph',
            'application_rate', 'distribution_uniformity',
            'soil_type', 'soil_water_holding_capacity', 'root_depth_inches',
            'management_allowable_depletion',
            'cimis_target', 'cimis_target_type',
            # Satellite Kc adjustment configuration
            'use_satellite_kc_adjustment', 'reference_canopy_coverage',
            'ndvi_stress_modifier_enabled', 'ndvi_healthy_threshold', 'ndvi_stress_multiplier',
            'soil_capacity_inches', 'mad_threshold_inches',
            'active', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_soil_capacity_inches(self, obj):
        """Calculate total soil water holding capacity in inches."""
        whc = float(obj.soil_water_holding_capacity or 1.5)
        root_depth = float(obj.root_depth_inches or 36)
        return whc * (root_depth / 12)

    def get_mad_threshold_inches(self, obj):
        """Calculate MAD threshold in inches."""
        capacity = self.get_soil_capacity_inches(obj)
        mad_pct = obj.management_allowable_depletion or 50
        return float(capacity * (mad_pct / 100))


# Backward-compatible alias
IrrigationZoneListSerializer = IrrigationZoneSerializer


class IrrigationZoneEventSerializer(serializers.ModelSerializer):
    """
    Serializer for irrigation events linked to a zone.
    Used for zone-based irrigation tracking.
    """

    zone_name = serializers.CharField(source='zone.name', read_only=True, allow_null=True)
    field_name = serializers.CharField(source='zone.field.name', read_only=True, allow_null=True)
    method_display = serializers.CharField(source='get_method_display', read_only=True)

    class Meta:
        model = IrrigationEvent
        fields = [
            'id', 'zone', 'zone_name', 'field_name',
            'date', 'depth_inches', 'duration_hours',
            'method', 'method_display',
            'source', 'notes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class IrrigationZoneEventCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating irrigation events on a zone."""

    class Meta:
        model = IrrigationEvent
        fields = [
            'zone', 'date', 'depth_inches', 'duration_hours',
            'method', 'source', 'notes',
        ]

    def validate(self, data):
        """Validate zone is provided and calculate depth if needed."""
        zone = data.get('zone')
        if not zone:
            raise serializers.ValidationError({
                'zone': 'Irrigation zone is required.'
            })

        # If duration provided but not depth, calculate from application rate
        if data.get('duration_hours') and not data.get('depth_inches'):
            if zone.application_rate:
                from decimal import Decimal
                data['depth_inches'] = Decimal(str(data['duration_hours'])) * zone.application_rate

        return data


class IrrigationZoneDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for irrigation zone with nested relationships.
    Includes recent events, current recommendation, and Kc profile.
    """

    # Related object names
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_id = serializers.IntegerField(source='field.farm.id', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    water_source_name = serializers.CharField(source='water_source.name', read_only=True, allow_null=True)

    # Nested relationships
    kc_profiles = CropCoefficientProfileSerializer(many=True, read_only=True)
    recent_events = serializers.SerializerMethodField()
    recent_recommendations = serializers.SerializerMethodField()
    current_recommendation = serializers.SerializerMethodField()

    # Computed status
    zone_status = serializers.SerializerMethodField()
    soil_capacity_inches = serializers.SerializerMethodField()
    mad_threshold_inches = serializers.SerializerMethodField()

    class Meta:
        model = IrrigationZone
        fields = [
            'id', 'name', 'field', 'field_name', 'farm_id', 'farm_name',
            'water_source', 'water_source_name',
            'acres', 'crop_type', 'tree_age', 'tree_spacing_ft',
            'irrigation_method', 'emitters_per_tree', 'emitter_gph',
            'application_rate', 'distribution_uniformity',
            'soil_type', 'soil_water_holding_capacity', 'root_depth_inches',
            'management_allowable_depletion',
            'cimis_target', 'cimis_target_type',
            'soil_capacity_inches', 'mad_threshold_inches',
            'active', 'notes',
            # Nested data
            'kc_profiles', 'recent_events', 'recent_recommendations', 'current_recommendation',
            'zone_status',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_soil_capacity_inches(self, obj):
        """Calculate total soil water holding capacity in inches."""
        whc = float(obj.soil_water_holding_capacity or 1.5)
        root_depth = float(obj.root_depth_inches or 36)
        return whc * (root_depth / 12)

    def get_mad_threshold_inches(self, obj):
        """Calculate MAD threshold in inches."""
        capacity = self.get_soil_capacity_inches(obj)
        mad_pct = obj.management_allowable_depletion or 50
        return float(capacity * (mad_pct / 100))

    def get_recent_events(self, obj):
        """Get last 5 irrigation events for this zone."""
        events = obj.irrigation_events.order_by('-date')[:5]
        return IrrigationZoneEventSerializer(events, many=True).data

    def get_recent_recommendations(self, obj):
        """Get last 5 recommendations for this zone."""
        recs = obj.recommendations.order_by('-created_at')[:5]
        return IrrigationRecommendationListSerializer(recs, many=True).data

    def get_current_recommendation(self, obj):
        """Get the current pending recommendation if any."""
        rec = obj.recommendations.filter(status='pending').order_by('-created_at').first()
        if rec:
            return IrrigationRecommendationSerializer(rec).data
        return None

    def get_zone_status(self, obj):
        """Calculate current irrigation status for the zone."""
        from .services.irrigation_scheduler import IrrigationScheduler
        try:
            scheduler = IrrigationScheduler(obj)
            return scheduler.get_zone_status_summary()
        except Exception as e:
            return {
                'status': 'error',
                'status_label': 'Unable to calculate',
                'error': str(e),
            }


class IrrigationDashboardSerializer(serializers.Serializer):
    """Serializer for irrigation dashboard summary data."""

    # Zone summary
    total_zones = serializers.IntegerField()
    active_zones = serializers.IntegerField()
    zones_needing_irrigation = serializers.IntegerField()
    zones_irrigation_soon = serializers.IntegerField()

    # Aggregate stats
    total_acres = serializers.DecimalField(max_digits=10, decimal_places=2)
    avg_depletion_pct = serializers.DecimalField(max_digits=5, decimal_places=1)

    # Weather data
    recent_eto_total = serializers.DecimalField(max_digits=6, decimal_places=3, allow_null=True)
    recent_rainfall_total = serializers.DecimalField(max_digits=6, decimal_places=3, allow_null=True)

    # Zone statuses
    zones = IrrigationZoneListSerializer(many=True)
    zones_by_status = serializers.DictField()

    # Upcoming recommendations
    pending_recommendations = IrrigationRecommendationListSerializer(many=True)

    # Recent irrigation events
    recent_events = IrrigationZoneEventSerializer(many=True)
