from rest_framework import serializers
from .models import SatelliteImage, TreeDetectionRun, DetectedTree, Field


class SatelliteImageListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for satellite image listings."""
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    detection_run_count = serializers.SerializerMethodField()

    class Meta:
        model = SatelliteImage
        fields = [
            'id', 'farm', 'farm_name', 'capture_date', 'source',
            'resolution_m', 'bands', 'has_nir', 'file_size_mb',
            'uploaded_at', 'detection_run_count'
        ]

    def get_detection_run_count(self, obj):
        return obj.detection_runs.count()


class SatelliteImageSerializer(serializers.ModelSerializer):
    """Full serializer for satellite image details."""
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.email', read_only=True, allow_null=True)
    bounds_geojson = serializers.ReadOnlyField()
    center_coordinates = serializers.ReadOnlyField()
    detection_run_count = serializers.SerializerMethodField()
    covered_fields = serializers.SerializerMethodField()

    class Meta:
        model = SatelliteImage
        fields = [
            'id', 'company', 'farm', 'farm_name',
            'file', 'file_size_mb',
            'capture_date', 'resolution_m', 'bands', 'has_nir',
            'source', 'source_product_id',
            'bounds_west', 'bounds_east', 'bounds_south', 'bounds_north',
            'bounds_geojson', 'center_coordinates', 'crs',
            'metadata_json',
            'uploaded_at', 'uploaded_by', 'uploaded_by_name',
            'detection_run_count', 'covered_fields'
        ]
        read_only_fields = [
            'id', 'company', 'file_size_mb', 'resolution_m', 'bands', 'has_nir',
            'bounds_west', 'bounds_east', 'bounds_south', 'bounds_north', 'crs',
            'uploaded_at', 'uploaded_by'
        ]

    def get_detection_run_count(self, obj):
        return obj.detection_runs.count()

    def get_covered_fields(self, obj):
        """Get list of fields that fall within this image's coverage."""
        fields = Field.objects.filter(farm=obj.farm, active=True)
        covered = []
        for field in fields:
            if obj.covers_field(field):
                covered.append({
                    'id': field.id,
                    'name': field.name,
                    'has_boundary': bool(field.boundary_geojson),
                    'total_acres': float(field.total_acres) if field.total_acres else None,
                })
        return covered


class SatelliteImageUploadSerializer(serializers.ModelSerializer):
    """Serializer for uploading satellite imagery with auto-metadata extraction."""

    class Meta:
        model = SatelliteImage
        fields = [
            'id', 'farm', 'file', 'capture_date', 'source', 'source_product_id', 'metadata_json'
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        from .services.tree_detection import extract_geotiff_metadata
        import os
        import tempfile

        request = self.context.get('request')

        # Get metadata from file
        file_obj = validated_data['file']

        # Save temporarily to extract metadata (cross-platform temp directory)
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, file_obj.name)
        with open(temp_path, 'wb') as f:
            for chunk in file_obj.chunks():
                f.write(chunk)

        try:
            metadata = extract_geotiff_metadata(temp_path)
        finally:
            # Reset file pointer
            file_obj.seek(0)
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)

        # Create the image with extracted metadata
        satellite_image = SatelliteImage.objects.create(
            company=request.user.current_company,
            farm=validated_data['farm'],
            file=validated_data['file'],
            capture_date=validated_data['capture_date'],
            source=validated_data.get('source', 'Unknown'),
            source_product_id=validated_data.get('source_product_id', ''),
            file_size_mb=metadata['file_size_mb'],
            resolution_m=metadata['resolution_m'],
            bands=metadata['bands'],
            has_nir=metadata['has_nir'],
            bounds_west=metadata['bounds_west'],
            bounds_east=metadata['bounds_east'],
            bounds_south=metadata['bounds_south'],
            bounds_north=metadata['bounds_north'],
            crs=metadata['crs'],
            metadata_json={
                **validated_data.get('metadata_json', {}),
                'width': metadata['width'],
                'height': metadata['height'],
                'dtype': metadata['dtype'],
            },
            uploaded_by=request.user,
        )

        return satellite_image


class TreeDetectionRunListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for detection run listings."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    image_capture_date = serializers.DateField(source='satellite_image.capture_date', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = TreeDetectionRun
        fields = [
            'id', 'field', 'field_name', 'satellite_image', 'image_capture_date',
            'status', 'status_display', 'tree_count', 'trees_per_acre',
            'canopy_coverage_percent', 'is_approved', 'created_at', 'completed_at'
        ]


class TreeDetectionRunSerializer(serializers.ModelSerializer):
    """Full serializer for detection run details."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    field_acres = serializers.DecimalField(
        source='field.total_acres', max_digits=10, decimal_places=2, read_only=True
    )
    image_capture_date = serializers.DateField(source='satellite_image.capture_date', read_only=True)
    image_source = serializers.CharField(source='satellite_image.source', read_only=True)
    image_resolution = serializers.FloatField(source='satellite_image.resolution_m', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.email', read_only=True, allow_null=True)
    is_latest_for_field = serializers.ReadOnlyField()

    class Meta:
        model = TreeDetectionRun
        fields = [
            'id', 'satellite_image', 'field', 'field_name', 'field_acres',
            'image_capture_date', 'image_source', 'image_resolution',
            'status', 'status_display', 'error_message',
            'algorithm_version', 'vegetation_index', 'parameters',
            'tree_count', 'trees_per_acre', 'avg_canopy_diameter_m',
            'canopy_coverage_percent', 'processing_time_seconds',
            'created_at', 'completed_at',
            'reviewed_by', 'reviewed_by_name', 'review_notes', 'is_approved',
            'is_latest_for_field'
        ]
        read_only_fields = [
            'id', 'status', 'error_message', 'algorithm_version',
            'tree_count', 'trees_per_acre', 'avg_canopy_diameter_m',
            'canopy_coverage_percent', 'processing_time_seconds',
            'created_at', 'completed_at'
        ]


class TreeDetectionRunCreateSerializer(serializers.Serializer):
    """Serializer for triggering tree detection on fields."""
    field_ids = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="List of field IDs to run detection on"
    )
    parameters = serializers.DictField(
        required=False,
        default=dict,
        help_text="Optional detection parameters"
    )

    def validate_field_ids(self, value):
        if not value:
            raise serializers.ValidationError("At least one field ID is required.")
        return value


class DetectedTreeSerializer(serializers.ModelSerializer):
    """Serializer for individual detected trees."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    location_geojson = serializers.ReadOnlyField()

    class Meta:
        model = DetectedTree
        fields = [
            'id', 'detection_run', 'field', 'field_name',
            'latitude', 'longitude', 'pixel_x', 'pixel_y',
            'canopy_diameter_m', 'ndvi_value', 'confidence_score',
            'status', 'status_display', 'is_verified', 'notes',
            'location_geojson'
        ]
        read_only_fields = [
            'id', 'detection_run', 'field', 'latitude', 'longitude',
            'pixel_x', 'pixel_y', 'canopy_diameter_m', 'ndvi_value',
            'confidence_score'
        ]


class DetectedTreeGeoJSONSerializer(serializers.Serializer):
    """Serializer for trees as GeoJSON FeatureCollection for map display."""

    def to_representation(self, queryset):
        features = []
        for tree in queryset:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [tree.longitude, tree.latitude]
                },
                "properties": {
                    "id": tree.id,
                    "ndvi_value": tree.ndvi_value,
                    "confidence_score": tree.confidence_score,
                    "canopy_diameter_m": tree.canopy_diameter_m,
                    "status": tree.status,
                    "is_verified": tree.is_verified,
                }
            })

        return {
            "type": "FeatureCollection",
            "features": features
        }


class FieldTreeSummarySerializer(serializers.Serializer):
    """Serializer for field tree summary data."""
    field_id = serializers.IntegerField()
    field_name = serializers.CharField()
    total_acres = serializers.FloatField(allow_null=True)

    # Manual tree count (from Field model)
    manual_tree_count = serializers.IntegerField(allow_null=True)
    manual_trees_per_acre = serializers.FloatField(allow_null=True)

    # Satellite detection data
    satellite_tree_count = serializers.IntegerField(allow_null=True)
    satellite_trees_per_acre = serializers.FloatField(allow_null=True)
    canopy_coverage_percent = serializers.FloatField(allow_null=True)
    detection_date = serializers.DateField(allow_null=True)
    detection_run_id = serializers.IntegerField(allow_null=True)

    # Comparison
    count_difference = serializers.IntegerField(allow_null=True)
    count_difference_percent = serializers.FloatField(allow_null=True)
