from rest_framework import serializers
from .models import Tree, TreeObservation, TreeMatchingRun, TreeFeedback


class TreeObservationSerializer(serializers.ModelSerializer):
    """Serializer for tree observations - links to satellite/LiDAR detections."""
    source_type_display = serializers.CharField(source='get_source_type_display', read_only=True)
    match_method_display = serializers.CharField(source='get_match_method_display', read_only=True)

    class Meta:
        model = TreeObservation
        fields = [
            'id', 'tree', 'source_type', 'source_type_display',
            'satellite_detection', 'lidar_detection',
            'match_method', 'match_method_display',
            'match_distance_m', 'match_confidence',
            'observation_date',
            'observed_latitude', 'observed_longitude',
            'observed_height_m', 'observed_canopy_diameter_m',
            'observed_canopy_area_sqm', 'observed_ndvi',
            'observed_status',
            'created_at',
        ]
        read_only_fields = '__all__'


class TreeListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for tree lists and map display."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    confidence_display = serializers.CharField(source='get_identity_confidence_display', read_only=True)
    observation_count = serializers.SerializerMethodField()

    class Meta:
        model = Tree
        fields = [
            'id', 'uuid', 'latitude', 'longitude',
            'height_m', 'canopy_diameter_m', 'latest_ndvi',
            'status', 'status_display',
            'identity_confidence', 'confidence_display',
            'observation_count',
            'is_verified', 'tree_label',
            'first_observed', 'last_observed',
        ]

    def get_observation_count(self, obj):
        return obj.satellite_observation_count + obj.lidar_observation_count


class TreeDetailSerializer(serializers.ModelSerializer):
    """Full serializer for tree detail view with observations."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    confidence_display = serializers.CharField(source='get_identity_confidence_display', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    verified_by_name = serializers.SerializerMethodField()
    observations = TreeObservationSerializer(many=True, read_only=True)
    observation_count = serializers.SerializerMethodField()

    class Meta:
        model = Tree
        fields = [
            'id', 'uuid', 'field', 'field_name',
            'latitude', 'longitude',
            'height_m', 'canopy_diameter_m', 'canopy_area_sqm',
            'latest_ndvi', 'ground_elevation_m',
            'status', 'status_display',
            'identity_confidence', 'confidence_display',
            'satellite_observation_count', 'lidar_observation_count',
            'observation_count',
            'first_observed', 'last_observed',
            'is_verified', 'verified_by', 'verified_by_name', 'verified_at',
            'tree_label', 'notes',
            'observations',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'uuid', 'satellite_observation_count', 'lidar_observation_count',
            'first_observed', 'last_observed', 'created_at', 'updated_at',
        ]

    def get_verified_by_name(self, obj):
        if obj.verified_by:
            return obj.verified_by.get_full_name() or obj.verified_by.username
        return None

    def get_observation_count(self, obj):
        return obj.satellite_observation_count + obj.lidar_observation_count


class TreeGeoJSONSerializer(serializers.Serializer):
    """GeoJSON Feature serializer for trees."""
    type = serializers.SerializerMethodField()
    geometry = serializers.SerializerMethodField()
    properties = serializers.SerializerMethodField()

    def get_type(self, obj):
        return "Feature"

    def get_geometry(self, obj):
        return {
            "type": "Point",
            "coordinates": [obj.longitude, obj.latitude]
        }

    def get_properties(self, obj):
        return {
            "id": obj.id,
            "uuid": str(obj.uuid),
            "height_m": obj.height_m,
            "canopy_diameter_m": obj.canopy_diameter_m,
            "canopy_area_sqm": obj.canopy_area_sqm,
            "latest_ndvi": obj.latest_ndvi,
            "status": obj.status,
            "identity_confidence": obj.identity_confidence,
            "satellite_observations": obj.satellite_observation_count,
            "lidar_observations": obj.lidar_observation_count,
            "is_verified": obj.is_verified,
            "tree_label": obj.tree_label,
            "first_observed": obj.first_observed.isoformat() if obj.first_observed else None,
            "last_observed": obj.last_observed.isoformat() if obj.last_observed else None,
        }


class TreeMatchingRunSerializer(serializers.ModelSerializer):
    """Serializer for tree matching run records."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    triggered_by_name = serializers.SerializerMethodField()
    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = TreeMatchingRun
        fields = [
            'id', 'field', 'field_name',
            'satellite_run', 'lidar_run',
            'match_distance_threshold_m',
            'canopy_weight', 'ndvi_weight', 'distance_weight',
            'status', 'status_display',
            'started_at', 'completed_at', 'duration_seconds',
            'trees_matched', 'new_trees_created', 'trees_marked_missing',
            'error_message',
            'triggered_by', 'triggered_by_name',
            'created_at',
        ]
        read_only_fields = '__all__'

    def get_triggered_by_name(self, obj):
        if obj.triggered_by:
            return obj.triggered_by.get_full_name() or obj.triggered_by.username
        return None

    def get_duration_seconds(self, obj):
        if obj.started_at and obj.completed_at:
            return (obj.completed_at - obj.started_at).total_seconds()
        return None


class TreeVerifySerializer(serializers.Serializer):
    """Serializer for tree verification action."""
    is_verified = serializers.BooleanField(required=True)
    tree_label = serializers.CharField(max_length=50, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class TreeMergeSerializer(serializers.Serializer):
    """Serializer for merging duplicate trees."""
    source_tree_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        help_text="IDs of trees to merge into the target tree"
    )


class TreeMatchingTriggerSerializer(serializers.Serializer):
    """Serializer for triggering tree matching."""
    satellite_run_id = serializers.IntegerField(required=False, allow_null=True)
    lidar_run_id = serializers.IntegerField(required=False, allow_null=True)
    prefer_lidar = serializers.BooleanField(
        default=False,
        help_text="If true, LiDAR runs are treated as primary; otherwise satellite is primary"
    )
    match_all_existing = serializers.BooleanField(
        default=False,
        help_text="If true, match all existing unmatched detections"
    )
    match_distance_threshold_m = serializers.FloatField(
        default=3.0,
        min_value=0.5,
        max_value=10.0,
        help_text="Maximum distance in meters for matching"
    )


class FieldUnifiedTreeSummarySerializer(serializers.Serializer):
    """Summary of unified trees for a field."""
    field_id = serializers.IntegerField()
    field_name = serializers.CharField()

    # Tree counts by status
    total_trees = serializers.IntegerField()
    active_trees = serializers.IntegerField()
    missing_trees = serializers.IntegerField()
    dead_trees = serializers.IntegerField()
    uncertain_trees = serializers.IntegerField()

    # Confidence breakdown
    high_confidence_count = serializers.IntegerField()
    medium_confidence_count = serializers.IntegerField()
    low_confidence_count = serializers.IntegerField()

    # Observation coverage
    trees_with_satellite = serializers.IntegerField()
    trees_with_lidar = serializers.IntegerField()
    trees_with_both = serializers.IntegerField()
    verified_trees = serializers.IntegerField()

    # Aggregated metrics
    avg_height_m = serializers.FloatField(allow_null=True)
    avg_canopy_diameter_m = serializers.FloatField(allow_null=True)
    avg_ndvi = serializers.FloatField(allow_null=True)

    # Recent activity
    last_matching_run = serializers.DateTimeField(allow_null=True)
    total_observations = serializers.IntegerField()


# =============================================================================
# TREE FEEDBACK SERIALIZERS
# =============================================================================

class TreeFeedbackSerializer(serializers.ModelSerializer):
    """Full serializer for tree feedback with user info."""
    feedback_type_display = serializers.CharField(source='get_feedback_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    resolved_by_name = serializers.SerializerMethodField()
    tree_uuid = serializers.UUIDField(source='tree.uuid', read_only=True)
    field_id = serializers.IntegerField(source='tree.field_id', read_only=True)
    field_name = serializers.CharField(source='tree.field.name', read_only=True)

    class Meta:
        model = TreeFeedback
        fields = [
            'id', 'tree', 'tree_uuid', 'field_id', 'field_name',
            'observation',
            'feedback_type', 'feedback_type_display',
            'notes',
            'suggested_latitude', 'suggested_longitude',
            'suggested_corrections',
            'status', 'status_display',
            'resolution_notes',
            'resolved_by', 'resolved_by_name', 'resolved_at',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'exported_for_training', 'exported_at',
        ]
        read_only_fields = [
            'id', 'tree_uuid', 'field_id', 'field_name',
            'created_by', 'created_at', 'updated_at',
            'resolved_by', 'resolved_at',
            'exported_for_training', 'exported_at',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_resolved_by_name(self, obj):
        if obj.resolved_by:
            return obj.resolved_by.get_full_name() or obj.resolved_by.username
        return None


class TreeFeedbackCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new feedback."""

    class Meta:
        model = TreeFeedback
        fields = [
            'tree', 'observation',
            'feedback_type', 'notes',
            'suggested_latitude', 'suggested_longitude',
            'suggested_corrections',
        ]

    def validate(self, data):
        # Validate location corrections if feedback type is location_error
        if data.get('feedback_type') == 'location_error':
            if not data.get('suggested_latitude') and not data.get('suggested_longitude'):
                raise serializers.ValidationError(
                    "Location corrections must include suggested_latitude and/or suggested_longitude"
                )
        return data

    def create(self, validated_data):
        # Set created_by from request user
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class TreeFeedbackUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating feedback status (admin review)."""

    class Meta:
        model = TreeFeedback
        fields = ['status', 'resolution_notes']

    def update(self, instance, validated_data):
        from django.utils import timezone

        # If status is changing to accepted or rejected, set resolution fields
        new_status = validated_data.get('status')
        if new_status in ['accepted', 'rejected'] and instance.status == 'pending':
            instance.resolved_by = self.context['request'].user
            instance.resolved_at = timezone.now()

        return super().update(instance, validated_data)


class TreeFeedbackExportSerializer(serializers.ModelSerializer):
    """Serializer for exporting feedback for ML training."""
    tree_uuid = serializers.UUIDField(source='tree.uuid')
    latitude = serializers.FloatField(source='tree.latitude')
    longitude = serializers.FloatField(source='tree.longitude')
    original_source = serializers.SerializerMethodField()
    original_confidence = serializers.CharField(source='tree.identity_confidence')
    resolution = serializers.CharField(source='status')

    class Meta:
        model = TreeFeedback
        fields = [
            'tree_uuid', 'latitude', 'longitude',
            'feedback_type', 'notes',
            'suggested_latitude', 'suggested_longitude',
            'suggested_corrections',
            'original_source', 'original_confidence',
            'resolution', 'resolution_notes',
            'created_at', 'resolved_at',
        ]

    def get_original_source(self, obj):
        tree = obj.tree
        if tree.satellite_observation_count > 0 and tree.lidar_observation_count > 0:
            return 'both'
        elif tree.lidar_observation_count > 0:
            return 'lidar'
        else:
            return 'satellite'


class TreeFeedbackStatisticsSerializer(serializers.Serializer):
    """Statistics about tree feedback."""
    total_feedback = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    accepted_count = serializers.IntegerField()
    rejected_count = serializers.IntegerField()

    # By type
    false_positive_count = serializers.IntegerField()
    false_negative_count = serializers.IntegerField()
    misidentification_count = serializers.IntegerField()
    location_error_count = serializers.IntegerField()
    attribute_error_count = serializers.IntegerField()
    verified_correct_count = serializers.IntegerField()

    # Export status
    exported_count = serializers.IntegerField()
    unexported_accepted_count = serializers.IntegerField()
