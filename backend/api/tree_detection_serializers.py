"""
Serializers for the TreeSurvey / DetectedTree YOLO detection pipeline.

Provides list, detail, upload, GeoJSON, and health-summary representations.
"""

import os
import tempfile

from rest_framework import serializers

from .models import TreeSurvey, DetectedTree
from .serializer_mixins import DynamicFieldsMixin
from .view_helpers import get_user_company


# =============================================================================
# TREE SURVEY SERIALIZERS
# =============================================================================

class TreeSurveySerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Unified serializer for TreeSurvey (list + detail)."""
    list_fields = [
        'id', 'field_id', 'field_name', 'capture_date',
        'status', 'tree_count', 'avg_ndvi', 'created_at',
    ]

    field_id = serializers.IntegerField(source='field.id', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    uploaded_by_username = serializers.SerializerMethodField()

    class Meta:
        model = TreeSurvey
        fields = [
            'id',
            'company',
            'field',
            'field_id',
            'field_name',
            'image_file',
            'image_type',
            'file_size_mb',
            'capture_date',
            'source',
            'resolution_m',
            'crs',
            'bounds_west',
            'bounds_east',
            'bounds_south',
            'bounds_north',
            'has_nir',
            'status',
            'error_message',
            'detection_model',
            'detection_params',
            'tree_count',
            'trees_per_acre',
            'avg_confidence',
            'avg_ndvi',
            'canopy_coverage_percent',
            'processing_time_seconds',
            'uploaded_by',
            'uploaded_by_username',
            'created_at',
            'completed_at',
        ]
        read_only_fields = [
            'id', 'company',
            'file_size_mb', 'resolution_m', 'crs',
            'bounds_west', 'bounds_east', 'bounds_south', 'bounds_north',
            'has_nir',
            'status', 'error_message',
            'detection_model', 'detection_params',
            'tree_count', 'trees_per_acre',
            'avg_confidence', 'avg_ndvi',
            'canopy_coverage_percent', 'processing_time_seconds',
            'uploaded_by', 'created_at', 'completed_at',
        ]

    def get_uploaded_by_username(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return None


# Backward-compatible aliases
TreeSurveyListSerializer = TreeSurveySerializer
TreeSurveyDetailSerializer = TreeSurveySerializer


class TreeSurveyUploadSerializer(serializers.ModelSerializer):
    """
    Create-only serializer for uploading a new survey image.

    Accepts the image file, field, capture_date, and source.
    On create it:
      1. Resolves company from the authenticated user.
      2. Writes the upload to a temp file and extracts GeoTIFF metadata
         (bounds, CRS, resolution, NIR detection, file size).
      3. Saves the TreeSurvey record with extracted metadata.
    """

    class Meta:
        model = TreeSurvey
        fields = [
            'id',
            'field',
            'image_file',
            'capture_date',
            'source',
            'status',
            'image_type',
            'file_size_mb',
            'has_nir',
            'created_at',
        ]
        read_only_fields = ['id', 'status', 'image_type', 'file_size_mb', 'has_nir', 'created_at']
        extra_kwargs = {
            'capture_date': {'required': False, 'allow_null': True},
            'source': {'required': False, 'allow_blank': True},
        }

    def create(self, validated_data):
        import logging
        logger = logging.getLogger(__name__)

        request = self.context.get('request')
        company = get_user_company(request.user)
        if not company:
            raise serializers.ValidationError(
                "You must be associated with a company to upload a survey."
            )

        file_obj = validated_data['image_file']

        # Write to a temp file so the metadata extractor can read it
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, file_obj.name)
        try:
            with open(temp_path, 'wb') as f:
                for chunk in file_obj.chunks():
                    f.write(chunk)
        except Exception as e:
            logger.exception("Failed to write upload to temp file: %s", e)
            raise serializers.ValidationError(
                f"Failed to save uploaded file: {e}"
            )

        # Try to extract GeoTIFF metadata; fall back to defaults if it fails
        metadata = {}
        try:
            from api.services.yolo_tree_detection import extract_geotiff_metadata
            metadata = extract_geotiff_metadata(temp_path)
        except Exception as e:
            logger.warning(
                "GeoTIFF metadata extraction failed (will use defaults): %s", e
            )
        finally:
            file_obj.seek(0)
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass

        # Determine image type from metadata
        image_type = 'multispectral' if metadata.get('has_nir', False) else 'rgb'

        try:
            survey = TreeSurvey.objects.create(
                company=company,
                field=validated_data['field'],
                image_file=validated_data['image_file'],
                capture_date=validated_data.get('capture_date'),
                source=validated_data.get('source', ''),
                image_type=image_type,
                file_size_mb=metadata.get('file_size_mb'),
                resolution_m=metadata.get('resolution_m'),
                crs=metadata.get('crs', 'EPSG:4326'),
                bounds_west=metadata.get('bounds_west'),
                bounds_east=metadata.get('bounds_east'),
                bounds_south=metadata.get('bounds_south'),
                bounds_north=metadata.get('bounds_north'),
                has_nir=metadata.get('has_nir', False),
                status='pending',
                uploaded_by=request.user,
            )
        except Exception as e:
            logger.exception("Failed to create TreeSurvey: %s", e)
            raise serializers.ValidationError(
                f"Failed to create survey record: {e}"
            )
        return survey


# =============================================================================
# DETECTED TREE SERIALIZERS
# =============================================================================

class DetectedTreeSerializer(serializers.ModelSerializer):
    """Full serializer for an individual detected tree."""

    class Meta:
        model = DetectedTree
        fields = [
            'id',
            'survey',
            'latitude',
            'longitude',
            'bbox_x_min',
            'bbox_y_min',
            'bbox_x_max',
            'bbox_y_max',
            'confidence',
            'canopy_diameter_m',
            'ndvi_mean',
            'ndvi_min',
            'ndvi_max',
            'health_category',
        ]
        read_only_fields = [
            'id', 'survey',
            'latitude', 'longitude',
            'bbox_x_min', 'bbox_y_min', 'bbox_x_max', 'bbox_y_max',
            'confidence', 'canopy_diameter_m',
            'ndvi_mean', 'ndvi_min', 'ndvi_max',
            'health_category',
        ]


class DetectedTreeGeoJSONSerializer(serializers.Serializer):
    """
    Returns a GeoJSON FeatureCollection for a queryset of DetectedTree
    instances, suitable for map rendering.
    """

    def to_representation(self, queryset):
        features = []
        for tree in queryset:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [tree.longitude, tree.latitude],
                },
                "properties": {
                    "id": tree.id,
                    "confidence": tree.confidence,
                    "canopy_diameter_m": tree.canopy_diameter_m,
                    "ndvi_mean": tree.ndvi_mean,
                    "ndvi_min": tree.ndvi_min,
                    "ndvi_max": tree.ndvi_max,
                    "health_category": tree.health_category,
                    "bbox": [
                        tree.bbox_x_min,
                        tree.bbox_y_min,
                        tree.bbox_x_max,
                        tree.bbox_y_max,
                    ],
                },
            })

        return {
            "type": "FeatureCollection",
            "features": features,
        }


# =============================================================================
# HEALTH SUMMARY SERIALIZER
# =============================================================================

class HealthSummarySerializer(serializers.Serializer):
    """
    Read-only summary of health-category breakdown for a survey's trees.

    Fields:
        total_trees          - total detected trees in the survey
        healthy_count/percent   - count & percentage for 'healthy'
        moderate_count/percent  - count & percentage for 'moderate'
        stressed_count/percent  - count & percentage for 'stressed'
        critical_count/percent  - count & percentage for 'critical'
        unknown_count/percent   - count & percentage for 'unknown'
        avg_ndvi             - mean NDVI across all trees
        avg_confidence       - mean detection confidence
    """
    total_trees = serializers.IntegerField(read_only=True)

    healthy_count = serializers.IntegerField(read_only=True)
    healthy_percent = serializers.FloatField(read_only=True)

    moderate_count = serializers.IntegerField(read_only=True)
    moderate_percent = serializers.FloatField(read_only=True)

    stressed_count = serializers.IntegerField(read_only=True)
    stressed_percent = serializers.FloatField(read_only=True)

    critical_count = serializers.IntegerField(read_only=True)
    critical_percent = serializers.FloatField(read_only=True)

    unknown_count = serializers.IntegerField(read_only=True)
    unknown_percent = serializers.FloatField(read_only=True)

    avg_ndvi = serializers.FloatField(read_only=True, allow_null=True)
    avg_confidence = serializers.FloatField(read_only=True, allow_null=True)
