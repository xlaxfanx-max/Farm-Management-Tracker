from rest_framework import serializers
from .models import LiDARDataset, LiDARProcessingRun, LiDARDetectedTree, TerrainAnalysis, Field


class LiDARDatasetListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for LiDAR dataset listings."""
    farm_name = serializers.CharField(source='farm.name', read_only=True, allow_null=True)
    processing_run_count = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = LiDARDataset
        fields = [
            'id', 'name', 'farm', 'farm_name', 'source', 'capture_date',
            'status', 'status_display', 'point_count', 'point_density_per_sqm',
            'file_size_mb', 'uploaded_at', 'processing_run_count'
        ]

    def get_processing_run_count(self, obj):
        return obj.processing_runs.count()


class LiDARDatasetSerializer(serializers.ModelSerializer):
    """Full serializer for LiDAR dataset details."""
    farm_name = serializers.CharField(source='farm.name', read_only=True, allow_null=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.email', read_only=True, allow_null=True)
    bounds_geojson = serializers.ReadOnlyField()
    center_coordinates = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    processing_run_count = serializers.SerializerMethodField()
    covered_fields = serializers.SerializerMethodField()

    class Meta:
        model = LiDARDataset
        fields = [
            'id', 'company', 'farm', 'farm_name',
            'file', 'file_size_mb', 'name',
            'source', 'source_display', 'capture_date',
            'point_count', 'point_density_per_sqm',
            'crs', 'has_classification',
            'bounds_west', 'bounds_east', 'bounds_south', 'bounds_north',
            'bounds_geojson', 'center_coordinates',
            'status', 'status_display', 'error_message',
            'metadata_json',
            'uploaded_at', 'uploaded_by', 'uploaded_by_name',
            'processing_run_count', 'covered_fields'
        ]
        read_only_fields = [
            'id', 'company', 'file_size_mb', 'point_count', 'point_density_per_sqm',
            'crs', 'has_classification',
            'bounds_west', 'bounds_east', 'bounds_south', 'bounds_north',
            'status', 'error_message', 'metadata_json',
            'uploaded_at', 'uploaded_by'
        ]

    def get_processing_run_count(self, obj):
        return obj.processing_runs.count()

    def get_covered_fields(self, obj):
        """Get list of fields that fall within this LiDAR dataset's coverage."""
        if not obj.farm:
            return []

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


class LiDARDatasetUploadSerializer(serializers.ModelSerializer):
    """Serializer for uploading LiDAR data with validation."""

    class Meta:
        model = LiDARDataset
        fields = [
            'id', 'farm', 'file', 'name', 'source', 'capture_date'
        ]
        read_only_fields = ['id']

    def validate_file(self, value):
        """Validate that the uploaded file is a LAZ or LAS file."""
        filename = value.name.lower()
        if not (filename.endswith('.laz') or filename.endswith('.las')):
            raise serializers.ValidationError(
                "Only LAZ or LAS point cloud files are supported."
            )
        return value

    def create(self, validated_data):
        import os
        request = self.context.get('request')

        # Get file size
        file_obj = validated_data['file']
        file_size_mb = file_obj.size / (1024 * 1024)

        # Create the dataset (validation happens async via Celery task)
        dataset = LiDARDataset.objects.create(
            company=request.user.current_company,
            farm=validated_data.get('farm'),
            file=file_obj,
            name=validated_data['name'],
            source=validated_data.get('source', 'COMMERCIAL'),
            capture_date=validated_data.get('capture_date'),
            file_size_mb=file_size_mb,
            uploaded_by=request.user,
            status='uploaded',
        )

        # Try async validation first, fall back to sync
        try:
            from .tasks.lidar_tasks import validate_lidar_dataset
            validate_lidar_dataset.delay(dataset.id)
        except Exception as e:
            # Celery not available - do sync validation
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to queue validation task: {e}")

            # Perform synchronous metadata extraction
            try:
                from .services.lidar_processing import extract_laz_metadata, transform_bounds_to_wgs84
                metadata = extract_laz_metadata(dataset.file.path)

                # Transform bounds to WGS84
                bounds_sp = (metadata.bounds_west, metadata.bounds_south,
                           metadata.bounds_east, metadata.bounds_north)
                bounds_wgs84 = transform_bounds_to_wgs84(bounds_sp, metadata.crs)

                # Update dataset
                dataset.point_count = metadata.point_count
                dataset.point_density_per_sqm = metadata.point_density_per_sqm
                dataset.crs = 'EPSG:3498' if '3498' in metadata.crs else metadata.crs[:100]
                dataset.has_classification = metadata.has_classification
                dataset.bounds_west = bounds_wgs84[0]
                dataset.bounds_east = bounds_wgs84[2]
                dataset.bounds_south = bounds_wgs84[1]
                dataset.bounds_north = bounds_wgs84[3]
                dataset.status = 'validated'
                dataset.save()
                logger.info(f"LiDAR dataset {dataset.id} validated synchronously")
            except Exception as val_err:
                logger.error(f"Failed to validate LiDAR dataset: {val_err}")

        return dataset


class LiDARProcessingRunListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for processing run listings."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    dataset_name = serializers.CharField(source='lidar_dataset.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    processing_type_display = serializers.CharField(source='get_processing_type_display', read_only=True)

    class Meta:
        model = LiDARProcessingRun
        fields = [
            'id', 'lidar_dataset', 'dataset_name', 'field', 'field_name',
            'processing_type', 'processing_type_display',
            'status', 'status_display',
            'tree_count', 'trees_per_acre', 'avg_tree_height_m',
            'is_approved', 'created_at', 'completed_at', 'processing_time_seconds'
        ]


class LiDARProcessingRunSerializer(serializers.ModelSerializer):
    """Full serializer for processing run details."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    dataset_name = serializers.CharField(source='lidar_dataset.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    processing_type_display = serializers.CharField(source='get_processing_type_display', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.email', read_only=True, allow_null=True)
    detected_tree_count = serializers.SerializerMethodField()
    has_terrain_analysis = serializers.SerializerMethodField()
    is_latest_for_field = serializers.ReadOnlyField()

    class Meta:
        model = LiDARProcessingRun
        fields = [
            'id', 'lidar_dataset', 'dataset_name', 'field', 'field_name',
            'processing_type', 'processing_type_display', 'parameters',
            'status', 'status_display', 'error_message',
            # Tree results
            'tree_count', 'trees_per_acre',
            'avg_tree_height_m', 'max_tree_height_m', 'min_tree_height_m',
            'avg_canopy_diameter_m', 'canopy_coverage_percent',
            # Terrain results
            'avg_slope_degrees', 'max_slope_degrees', 'elevation_range_m',
            # Generated files
            'dtm_file', 'dsm_file', 'chm_file',
            # Approval
            'is_approved', 'approved_by', 'approved_by_name', 'approved_at', 'review_notes',
            # Timestamps
            'created_at', 'completed_at', 'processing_time_seconds',
            # Computed
            'detected_tree_count', 'has_terrain_analysis', 'is_latest_for_field'
        ]
        read_only_fields = [
            'id', 'status', 'error_message',
            'tree_count', 'trees_per_acre',
            'avg_tree_height_m', 'max_tree_height_m', 'min_tree_height_m',
            'avg_canopy_diameter_m', 'canopy_coverage_percent',
            'avg_slope_degrees', 'max_slope_degrees', 'elevation_range_m',
            'dtm_file', 'dsm_file', 'chm_file',
            'approved_by', 'approved_at',
            'created_at', 'completed_at', 'processing_time_seconds'
        ]

    def get_detected_tree_count(self, obj):
        return obj.detected_trees.count()

    def get_has_terrain_analysis(self, obj):
        return hasattr(obj, 'terrain_analysis') and obj.terrain_analysis is not None


class LiDARProcessingRunCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new processing runs."""

    class Meta:
        model = LiDARProcessingRun
        fields = ['id', 'lidar_dataset', 'field', 'processing_type', 'parameters']
        read_only_fields = ['id']

    def validate(self, attrs):
        """Validate that the LiDAR dataset covers the field."""
        lidar_dataset = attrs.get('lidar_dataset')
        field = attrs.get('field')

        if lidar_dataset.status != 'ready':
            raise serializers.ValidationError({
                'lidar_dataset': f"Dataset is not ready for processing (status: {lidar_dataset.status})"
            })

        if not field.boundary_geojson:
            raise serializers.ValidationError({
                'field': "Field has no boundary defined. Please draw a boundary first."
            })

        if not lidar_dataset.covers_field(field):
            raise serializers.ValidationError({
                'field': "The LiDAR dataset does not cover this field's boundary."
            })

        return attrs

    def create(self, validated_data):
        # Create the processing run
        run = LiDARProcessingRun.objects.create(**validated_data)

        # Trigger async processing task
        try:
            from .tasks.lidar_tasks import process_lidar_for_field
            process_lidar_for_field.delay(run.id)
        except Exception as e:
            # Update run with error if task queue fails
            run.status = 'failed'
            run.error_message = f"Failed to queue processing task: {str(e)}"
            run.save()
            import logging
            logging.getLogger(__name__).error(f"Failed to queue LiDAR processing task: {e}")

        return run


class LiDARDetectedTreeSerializer(serializers.ModelSerializer):
    """Full serializer for LiDAR detected trees."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    location_geojson = serializers.ReadOnlyField()

    class Meta:
        model = LiDARDetectedTree
        fields = [
            'id', 'processing_run', 'field', 'field_name',
            'latitude', 'longitude',
            'height_m', 'canopy_diameter_m', 'canopy_area_sqm', 'ground_elevation_m',
            'status', 'status_display', 'is_verified', 'notes',
            'location_geojson'
        ]
        read_only_fields = [
            'id', 'processing_run', 'field',
            'latitude', 'longitude',
            'height_m', 'canopy_diameter_m', 'canopy_area_sqm', 'ground_elevation_m'
        ]


class LiDARDetectedTreeGeoJSONSerializer(serializers.Serializer):
    """Serializer for LiDAR trees as GeoJSON FeatureCollection for map display."""

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
                    "height_m": tree.height_m,
                    "canopy_diameter_m": tree.canopy_diameter_m,
                    "canopy_area_sqm": tree.canopy_area_sqm,
                    "ground_elevation_m": tree.ground_elevation_m,
                    "status": tree.status,
                    "is_verified": tree.is_verified,
                }
            })

        return {
            "type": "FeatureCollection",
            "features": features
        }


class TerrainAnalysisSerializer(serializers.ModelSerializer):
    """Full serializer for terrain analysis results."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    slope_aspect_display = serializers.CharField(source='get_slope_aspect_dominant_display', read_only=True)
    drainage_direction_display = serializers.CharField(
        source='get_drainage_direction_display',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = TerrainAnalysis
        fields = [
            'id', 'processing_run', 'field', 'field_name',
            # Elevation
            'min_elevation_m', 'max_elevation_m', 'mean_elevation_m',
            # Slope
            'mean_slope_degrees', 'max_slope_degrees',
            'slope_aspect_dominant', 'slope_aspect_display',
            # Slope distribution
            'slope_0_2_percent', 'slope_2_5_percent',
            'slope_5_10_percent', 'slope_over_10_percent',
            # Frost risk
            'frost_risk_zones', 'frost_risk_summary',
            # Drainage
            'drainage_direction', 'drainage_direction_display', 'low_spot_count'
        ]
        read_only_fields = '__all__'


class FieldLiDARSummarySerializer(serializers.Serializer):
    """Serializer for field LiDAR summary comparing satellite vs LiDAR."""
    field_id = serializers.IntegerField()
    field_name = serializers.CharField()
    total_acres = serializers.FloatField(allow_null=True)

    # Manual tree count (from Field model)
    manual_tree_count = serializers.IntegerField(allow_null=True)
    manual_trees_per_acre = serializers.FloatField(allow_null=True)

    # Satellite detection data
    satellite_tree_count = serializers.IntegerField(allow_null=True)
    satellite_trees_per_acre = serializers.FloatField(allow_null=True)
    satellite_canopy_coverage_percent = serializers.FloatField(allow_null=True)
    satellite_detection_date = serializers.DateField(allow_null=True)

    # LiDAR detection data
    lidar_tree_count = serializers.IntegerField(allow_null=True)
    lidar_trees_per_acre = serializers.FloatField(allow_null=True)
    lidar_avg_tree_height_m = serializers.FloatField(allow_null=True)
    lidar_canopy_coverage_percent = serializers.FloatField(allow_null=True)
    lidar_detection_date = serializers.DateField(allow_null=True)

    # Terrain data
    avg_slope_degrees = serializers.FloatField(allow_null=True)
    primary_aspect = serializers.CharField(allow_null=True)
    frost_risk_level = serializers.CharField(allow_null=True)

    # Comparisons
    satellite_vs_lidar_diff = serializers.IntegerField(allow_null=True)
    satellite_vs_lidar_diff_percent = serializers.FloatField(allow_null=True)
