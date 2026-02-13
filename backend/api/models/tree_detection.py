"""
Tree detection models — TreeSurvey and DetectedTree.

Uses DeepForest (pre-trained YOLOv8) for tree crown detection from
aerial/satellite imagery, with NDVI-based health scoring for
multispectral (RGB+NIR) images.
"""
from django.conf import settings
from django.db import models


class TreeSurvey(models.Model):
    """
    One image upload + YOLO detection run for a field.
    Combines the image and its detection results in a single record.
    """
    STATUS_CHOICES = [
        ('uploading', 'Uploading'),
        ('pending', 'Pending Detection'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    IMAGE_TYPE_CHOICES = [
        ('rgb', 'RGB (3-band)'),
        ('multispectral', 'Multispectral (RGB+NIR)'),
    ]

    # Ownership
    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='tree_surveys'
    )
    field = models.ForeignKey(
        'Field', on_delete=models.CASCADE, related_name='tree_surveys'
    )

    # Image file
    image_file = models.FileField(upload_to='tree_surveys/%Y/%m/')
    image_type = models.CharField(
        max_length=20, choices=IMAGE_TYPE_CHOICES, default='rgb'
    )
    file_size_mb = models.FloatField(null=True, blank=True)
    capture_date = models.DateField(help_text="Date imagery was captured")
    source = models.CharField(
        max_length=100, blank=True,
        help_text="Imagery provider (e.g. 'drone', 'Planet', 'NAIP')"
    )

    # Geo-metadata (extracted from GeoTIFF on upload)
    resolution_m = models.FloatField(
        null=True, blank=True,
        help_text="Ground sample distance in meters"
    )
    crs = models.CharField(max_length=50, default='EPSG:4326')
    bounds_west = models.FloatField(null=True, blank=True)
    bounds_east = models.FloatField(null=True, blank=True)
    bounds_south = models.FloatField(null=True, blank=True)
    bounds_north = models.FloatField(null=True, blank=True)
    has_nir = models.BooleanField(
        default=False, help_text="Has NIR band for NDVI health scoring"
    )

    # Detection config
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending'
    )
    error_message = models.TextField(blank=True)
    detection_model = models.CharField(
        max_length=50, default='deepforest',
        help_text="Detection model used (e.g. deepforest, yolov8-tree)"
    )
    detection_params = models.JSONField(default=dict, blank=True)

    # Results summary (populated after detection completes)
    tree_count = models.IntegerField(null=True, blank=True)
    trees_per_acre = models.FloatField(null=True, blank=True)
    avg_confidence = models.FloatField(null=True, blank=True)
    avg_ndvi = models.FloatField(
        null=True, blank=True,
        help_text="Mean NDVI of detected trees (multispectral only)"
    )
    canopy_coverage_percent = models.FloatField(null=True, blank=True)
    processing_time_seconds = models.FloatField(null=True, blank=True)

    # Tracking
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='tree_surveys'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'field']),
            models.Index(fields=['field', 'status']),
            models.Index(fields=['capture_date']),
        ]

    def __str__(self):
        return f"{self.field.name} - {self.capture_date} ({self.status})"


class DetectedTree(models.Model):
    """Individual tree detected in a survey via YOLO/DeepForest."""
    HEALTH_CHOICES = [
        ('healthy', 'Healthy'),
        ('moderate', 'Moderate Stress'),
        ('stressed', 'Stressed'),
        ('critical', 'Critical'),
        ('unknown', 'Unknown'),
    ]

    survey = models.ForeignKey(
        TreeSurvey, on_delete=models.CASCADE, related_name='detected_trees'
    )

    # Location (WGS84)
    latitude = models.FloatField()
    longitude = models.FloatField()

    # Bounding box from YOLO (pixel coordinates)
    bbox_x_min = models.IntegerField(help_text="Left edge pixel")
    bbox_y_min = models.IntegerField(help_text="Top edge pixel")
    bbox_x_max = models.IntegerField(help_text="Right edge pixel")
    bbox_y_max = models.IntegerField(help_text="Bottom edge pixel")

    # YOLO detection outputs
    confidence = models.FloatField(help_text="Detection confidence 0-1")
    canopy_diameter_m = models.FloatField(
        null=True, blank=True,
        help_text="Estimated canopy diameter from bbox + resolution"
    )

    # NDVI health (populated if image has NIR band)
    ndvi_mean = models.FloatField(null=True, blank=True)
    ndvi_min = models.FloatField(null=True, blank=True)
    ndvi_max = models.FloatField(null=True, blank=True)
    health_category = models.CharField(
        max_length=20, choices=HEALTH_CHOICES, default='unknown'
    )

    class Meta:
        indexes = [
            models.Index(fields=['survey']),
            models.Index(fields=['health_category']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        return (
            f"Tree ({self.latitude:.5f}, {self.longitude:.5f}) "
            f"conf={self.confidence:.2f} health={self.health_category}"
        )

    @property
    def location_geojson(self):
        return {
            'type': 'Point',
            'coordinates': [self.longitude, self.latitude],
        }
