import uuid

from django.db import models
from django.utils import timezone


# =============================================================================
# QUARANTINE STATUS MODEL
# =============================================================================

class QuarantineStatus(models.Model):
    """
    Caches quarantine status results from CDFA API queries.
    Used to track whether farms/fields fall within HLB quarantine zones.

    One of farm or field must be set (not both, not neither).
    """

    QUARANTINE_TYPE_CHOICES = [
        ('HLB', 'Huanglongbing (Citrus Greening)'),
        ('ACP_BULK', 'Asian Citrus Psyllid Bulk Citrus'),
    ]

    # Link to either Farm or Field (one must be set)
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        related_name='quarantine_statuses',
        null=True,
        blank=True,
        help_text="Farm being checked for quarantine status"
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='quarantine_statuses',
        null=True,
        blank=True,
        help_text="Field being checked for quarantine status"
    )

    # Quarantine type being checked
    quarantine_type = models.CharField(
        max_length=20,
        choices=QUARANTINE_TYPE_CHOICES,
        default='HLB',
        help_text="Type of quarantine check"
    )

    # Status result
    in_quarantine = models.BooleanField(
        null=True,
        blank=True,
        help_text="True if in quarantine, False if not, null if unknown/error"
    )
    zone_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of the quarantine zone if applicable"
    )

    # Tracking timestamps
    last_checked = models.DateTimeField(
        auto_now=True,
        help_text="When the status was last checked"
    )
    last_changed = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the quarantine status actually changed"
    )

    # Coordinates used for the check (cached for reference)
    check_latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        help_text="Latitude used for the check"
    )
    check_longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        help_text="Longitude used for the check"
    )

    # Raw API response for debugging
    raw_response = models.JSONField(
        null=True,
        blank=True,
        help_text="Raw response from CDFA API for debugging"
    )

    # Error tracking
    error_message = models.TextField(
        blank=True,
        help_text="Error message if the check failed"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Quarantine Status"
        verbose_name_plural = "Quarantine Statuses"
        ordering = ['-last_checked']
        indexes = [
            models.Index(fields=['farm', 'quarantine_type']),
            models.Index(fields=['field', 'quarantine_type']),
            models.Index(fields=['last_checked']),
        ]
        # Ensure only one record per farm+type or field+type combination
        constraints = [
            models.UniqueConstraint(
                fields=['farm', 'quarantine_type'],
                condition=models.Q(farm__isnull=False),
                name='unique_farm_quarantine_type'
            ),
            models.UniqueConstraint(
                fields=['field', 'quarantine_type'],
                condition=models.Q(field__isnull=False),
                name='unique_field_quarantine_type'
            ),
        ]

    def __str__(self):
        target = self.farm.name if self.farm else (self.field.name if self.field else "Unknown")
        status = "In Quarantine" if self.in_quarantine else "Clear" if self.in_quarantine is False else "Unknown"
        return f"{target} - {self.get_quarantine_type_display()}: {status}"

    def clean(self):
        """Validate that exactly one of farm or field is set."""
        from django.core.exceptions import ValidationError

        if self.farm and self.field:
            raise ValidationError("Cannot set both farm and field. Choose one.")
        if not self.farm and not self.field:
            raise ValidationError("Must set either farm or field.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def target_name(self):
        """Get the name of the farm or field being checked."""
        if self.farm:
            return self.farm.name
        elif self.field:
            return self.field.name
        return "Unknown"

    @property
    def target_type(self):
        """Get whether this is a farm or field check."""
        if self.farm:
            return "farm"
        elif self.field:
            return "field"
        return "unknown"

    @property
    def is_stale(self):
        """Check if the status is older than 24 hours."""
        from datetime import timedelta
        return timezone.now() - self.last_checked > timedelta(hours=24)

    @property
    def status_display(self):
        """Human-readable status."""
        if self.error_message:
            return "Error"
        if self.in_quarantine is None:
            return "Unknown"
        return "In Quarantine" if self.in_quarantine else "Clear"

    def get_company(self):
        """Get the company that owns this status (for RLS)."""
        if self.farm:
            return self.farm.company
        elif self.field and self.field.farm:
            return self.field.farm.company
        return None


# =============================================================================
# SATELLITE IMAGERY & TREE DETECTION MODELS
# =============================================================================

class SatelliteImage(models.Model):
    """
    Uploaded satellite imagery for tree detection and canopy analysis.
    Supports multi-band GeoTIFF files (e.g., 4-band BGRN from SkyWatch).
    """

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='satellite_images',
        help_text="Company that owns this imagery"
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        related_name='satellite_images',
        help_text="Farm this imagery covers"
    )

    # File storage
    file = models.FileField(
        upload_to='imagery/%Y/%m/',
        help_text="Uploaded GeoTIFF file"
    )
    file_size_mb = models.FloatField(
        help_text="File size in megabytes"
    )

    # Image metadata
    capture_date = models.DateField(
        help_text="Date the imagery was captured"
    )
    resolution_m = models.FloatField(
        help_text="Ground sample distance in meters (e.g., 0.38 for 38cm)"
    )
    bands = models.IntegerField(
        default=3,
        help_text="Number of spectral bands (3 for RGB, 4 for BGRN)"
    )
    has_nir = models.BooleanField(
        default=False,
        help_text="Has near-infrared band for NDVI calculation"
    )
    source = models.CharField(
        max_length=50,
        help_text="Imagery provider (e.g., SkyWatch, NAIP, Planet, Maxar)"
    )
    source_product_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Provider's product/order ID for reference"
    )

    # Coverage bounds (WGS84 / EPSG:4326)
    bounds_west = models.FloatField(
        help_text="Western boundary longitude"
    )
    bounds_east = models.FloatField(
        help_text="Eastern boundary longitude"
    )
    bounds_south = models.FloatField(
        help_text="Southern boundary latitude"
    )
    bounds_north = models.FloatField(
        help_text="Northern boundary latitude"
    )

    # CRS information
    crs = models.CharField(
        max_length=50,
        default='EPSG:4326',
        help_text="Coordinate Reference System"
    )

    # Provider metadata
    metadata_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="Full provider metadata (cloud cover, sun angle, etc.)"
    )

    # Tracking
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_satellite_images'
    )

    class Meta:
        ordering = ['-capture_date']
        verbose_name = "Satellite Image"
        verbose_name_plural = "Satellite Images"
        indexes = [
            models.Index(fields=['company', 'farm']),
            models.Index(fields=['capture_date']),
        ]

    def __str__(self):
        return f"{self.farm.name} - {self.capture_date} ({self.source})"

    @property
    def bounds_geojson(self):
        """Return bounds as GeoJSON polygon."""
        return {
            "type": "Polygon",
            "coordinates": [[
                [self.bounds_west, self.bounds_south],
                [self.bounds_east, self.bounds_south],
                [self.bounds_east, self.bounds_north],
                [self.bounds_west, self.bounds_north],
                [self.bounds_west, self.bounds_south],
            ]]
        }

    @property
    def center_coordinates(self):
        """Return center point of coverage area."""
        return {
            'latitude': (self.bounds_north + self.bounds_south) / 2,
            'longitude': (self.bounds_east + self.bounds_west) / 2,
        }

    def covers_field(self, field):
        """Check if this image covers a given field's boundary or center point."""
        if field.boundary_geojson:
            # Check if field boundary is within image bounds
            coords = field.boundary_geojson.get('coordinates', [[]])[0]
            if coords:
                for coord in coords:
                    lng, lat = coord[0], coord[1]
                    if not (self.bounds_west <= lng <= self.bounds_east and
                            self.bounds_south <= lat <= self.bounds_north):
                        return False
                return True
        elif field.gps_latitude and field.gps_longitude:
            # Check if field center is within bounds
            lat = float(field.gps_latitude)
            lng = float(field.gps_longitude)
            return (self.bounds_west <= lng <= self.bounds_east and
                    self.bounds_south <= lat <= self.bounds_north)
        return False


class TreeDetectionRun(models.Model):
    """
    A single execution of tree detection on satellite imagery for a field.
    Tracks processing status, parameters used, and results summary.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    satellite_image = models.ForeignKey(
        SatelliteImage,
        on_delete=models.CASCADE,
        related_name='detection_runs',
        help_text="Source imagery for detection"
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='detection_runs',
        help_text="Field being analyzed"
    )

    # Processing status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error details if detection failed"
    )

    # Algorithm settings
    algorithm_version = models.CharField(
        max_length=20,
        default='1.0',
        help_text="Version of detection algorithm used"
    )
    vegetation_index = models.CharField(
        max_length=10,
        default='NDVI',
        help_text="Vegetation index used (NDVI or ExG)"
    )
    parameters = models.JSONField(
        default=dict,
        help_text="Detection parameters: min_canopy_diameter_m, max_canopy_diameter_m, min_tree_spacing_m, vegetation_threshold_percentile"
    )

    # Results summary
    tree_count = models.IntegerField(
        null=True,
        help_text="Total trees detected"
    )
    trees_per_acre = models.FloatField(
        null=True,
        help_text="Tree density (trees/acre)"
    )
    avg_canopy_diameter_m = models.FloatField(
        null=True,
        help_text="Average canopy diameter in meters"
    )
    canopy_coverage_percent = models.FloatField(
        null=True,
        help_text="Percentage of field covered by canopy"
    )
    processing_time_seconds = models.FloatField(
        null=True,
        help_text="Time taken to process in seconds"
    )

    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(
        null=True,
        help_text="When processing completed"
    )

    # User verification
    reviewed_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_detection_runs'
    )
    review_notes = models.TextField(
        blank=True,
        help_text="Notes from user review"
    )
    is_approved = models.BooleanField(
        default=False,
        help_text="User verified results are accurate"
    )

    class Meta:
        ordering = ['-created_at']
        get_latest_by = 'created_at'
        verbose_name = "Tree Detection Run"
        verbose_name_plural = "Tree Detection Runs"
        indexes = [
            models.Index(fields=['field', 'status']),
            models.Index(fields=['satellite_image']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.field.name} - {self.created_at.strftime('%Y-%m-%d %H:%M')} ({self.status})"

    @property
    def is_latest_for_field(self):
        """Check if this is the most recent completed run for the field."""
        latest = self.field.detection_runs.filter(
            status='completed',
            is_approved=True
        ).order_by('-completed_at').first()
        return latest and latest.id == self.id


class DetectedTree(models.Model):
    """
    Individual tree detected from satellite imagery analysis.
    Stores location, metrics, and status for each tree.
    """

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('dead', 'Dead/Removed'),
        ('uncertain', 'Uncertain'),
        ('false_positive', 'False Positive'),
    ]

    detection_run = models.ForeignKey(
        TreeDetectionRun,
        on_delete=models.CASCADE,
        related_name='trees',
        help_text="Detection run that identified this tree"
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='detected_trees',
        help_text="Field containing this tree"
    )

    # Location (WGS84)
    latitude = models.FloatField(
        help_text="Tree center latitude"
    )
    longitude = models.FloatField(
        help_text="Tree center longitude"
    )

    # Pixel location in source image (for reference/debugging)
    pixel_x = models.IntegerField(
        help_text="X pixel coordinate in source image"
    )
    pixel_y = models.IntegerField(
        help_text="Y pixel coordinate in source image"
    )

    # Tree metrics
    canopy_diameter_m = models.FloatField(
        null=True,
        help_text="Estimated canopy diameter in meters"
    )
    ndvi_value = models.FloatField(
        null=True,
        help_text="NDVI value at tree center (0-1 scale)"
    )
    confidence_score = models.FloatField(
        help_text="Detection confidence score (0-1)"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )
    is_verified = models.BooleanField(
        default=False,
        help_text="User has manually verified this tree"
    )
    notes = models.TextField(
        blank=True,
        help_text="User notes about this tree"
    )

    class Meta:
        verbose_name = "Detected Tree"
        verbose_name_plural = "Detected Trees"
        indexes = [
            models.Index(fields=['field', 'status']),
            models.Index(fields=['detection_run']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        return f"Tree at ({self.latitude:.6f}, {self.longitude:.6f}) - {self.status}"

    @property
    def location_geojson(self):
        """Return location as GeoJSON Point."""
        return {
            "type": "Point",
            "coordinates": [self.longitude, self.latitude]
        }


# =============================================================================
# LIDAR MODELS (Point Cloud Processing)
# =============================================================================

class LiDARDataset(models.Model):
    """
    Stores uploaded LiDAR point cloud data (LAZ/LAS files).
    Contains metadata extracted from the point cloud header.
    """

    SOURCE_CHOICES = [
        ('USGS_3DEP', 'USGS 3DEP'),
        ('NOAA', 'NOAA Digital Coast'),
        ('CUSTOM_DRONE', 'Custom Drone Flight'),
        ('COMMERCIAL', 'Commercial Provider'),
    ]

    STATUS_CHOICES = [
        ('uploaded', 'Uploaded'),
        ('validating', 'Validating'),
        ('ready', 'Ready'),
        ('error', 'Error'),
    ]

    # Ownership
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='lidar_datasets',
        help_text="Company that owns this dataset"
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='lidar_datasets',
        help_text="Optional farm association"
    )

    # File storage
    file = models.FileField(
        upload_to='lidar/%Y/%m/',
        help_text="LAZ or LAS point cloud file"
    )
    file_size_mb = models.FloatField(
        null=True,
        blank=True,
        help_text="File size in megabytes"
    )

    # Metadata
    name = models.CharField(
        max_length=255,
        help_text="User-friendly name for the dataset"
    )
    source = models.CharField(
        max_length=50,
        choices=SOURCE_CHOICES,
        help_text="Data source/provider"
    )
    capture_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date the LiDAR data was captured"
    )

    # Point cloud specifications
    point_count = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="Total number of points in the dataset"
    )
    point_density_per_sqm = models.FloatField(
        null=True,
        blank=True,
        help_text="Point density (points per square meter)"
    )

    # Coordinate system
    crs = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text="Coordinate Reference System (e.g., EPSG:6414)"
    )

    # Bounding box (WGS84)
    bounds_west = models.FloatField(
        null=True,
        blank=True,
        help_text="Western boundary (longitude)"
    )
    bounds_east = models.FloatField(
        null=True,
        blank=True,
        help_text="Eastern boundary (longitude)"
    )
    bounds_south = models.FloatField(
        null=True,
        blank=True,
        help_text="Southern boundary (latitude)"
    )
    bounds_north = models.FloatField(
        null=True,
        blank=True,
        help_text="Northern boundary (latitude)"
    )

    # Classification info
    has_classification = models.BooleanField(
        default=False,
        help_text="Whether point cloud has LAS classification codes"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='uploaded'
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error message if validation failed"
    )

    # Timestamps
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_lidar_datasets'
    )

    # Additional metadata from header
    metadata_json = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata extracted from file header"
    )

    class Meta:
        db_table = 'api_lidar_dataset'
        ordering = ['-uploaded_at']
        verbose_name = "LiDAR Dataset"
        verbose_name_plural = "LiDAR Datasets"

    def __str__(self):
        return f"{self.name} ({self.source}) - {self.status}"

    @property
    def bounds_geojson(self):
        """Return bounding box as GeoJSON Polygon."""
        if all([self.bounds_west, self.bounds_east, self.bounds_south, self.bounds_north]):
            return {
                "type": "Polygon",
                "coordinates": [[
                    [self.bounds_west, self.bounds_south],
                    [self.bounds_east, self.bounds_south],
                    [self.bounds_east, self.bounds_north],
                    [self.bounds_west, self.bounds_north],
                    [self.bounds_west, self.bounds_south],
                ]]
            }
        return None

    @property
    def center_coordinates(self):
        """Return center point of bounding box."""
        if all([self.bounds_west, self.bounds_east, self.bounds_south, self.bounds_north]):
            return {
                'latitude': (self.bounds_north + self.bounds_south) / 2,
                'longitude': (self.bounds_east + self.bounds_west) / 2
            }
        return None

    def covers_field(self, field):
        """Check if this LiDAR dataset covers a given field."""
        if not field.boundary_geojson or not all([
            self.bounds_west, self.bounds_east, self.bounds_south, self.bounds_north
        ]):
            return False

        try:
            coords = field.boundary_geojson.get('coordinates', [[]])[0]
            if not coords:
                return False

            # Check if any field vertex is within bounds
            for lon, lat in coords:
                if (self.bounds_west <= lon <= self.bounds_east and
                    self.bounds_south <= lat <= self.bounds_north):
                    return True
            return False
        except (KeyError, IndexError, TypeError):
            return False


class LiDARProcessingRun(models.Model):
    """
    A processing run that generates derived products from LiDAR.
    Creates DTM, DSM, CHM rasters and performs tree/terrain analysis.
    """

    PROCESSING_TYPE_CHOICES = [
        ('TREE_DETECTION', 'Tree Detection'),
        ('TERRAIN_ANALYSIS', 'Terrain Analysis'),
        ('FULL', 'Full Analysis'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    # Source data
    lidar_dataset = models.ForeignKey(
        LiDARDataset,
        on_delete=models.CASCADE,
        related_name='processing_runs',
        help_text="Source LiDAR dataset"
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='lidar_runs',
        help_text="Field being analyzed"
    )

    # Processing configuration
    processing_type = models.CharField(
        max_length=50,
        choices=PROCESSING_TYPE_CHOICES,
        default='FULL'
    )
    parameters = models.JSONField(
        default=dict,
        blank=True,
        help_text="Processing parameters (resolution, thresholds, etc.)"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error message if processing failed"
    )

    # Tree Detection Results
    tree_count = models.IntegerField(
        null=True,
        blank=True,
        help_text="Number of trees detected"
    )
    trees_per_acre = models.FloatField(
        null=True,
        blank=True,
        help_text="Tree density (trees per acre)"
    )
    avg_tree_height_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Average tree height in meters"
    )
    max_tree_height_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Maximum tree height in meters"
    )
    min_tree_height_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Minimum tree height in meters"
    )
    avg_canopy_diameter_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Average canopy diameter in meters"
    )
    canopy_coverage_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Percentage of field covered by tree canopy"
    )

    # Terrain Results
    avg_slope_degrees = models.FloatField(
        null=True,
        blank=True,
        help_text="Average slope in degrees"
    )
    max_slope_degrees = models.FloatField(
        null=True,
        blank=True,
        help_text="Maximum slope in degrees"
    )
    elevation_range_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Elevation range (max - min) in meters"
    )

    # Generated raster files
    dtm_file = models.FileField(
        upload_to='lidar_products/%Y/%m/',
        null=True,
        blank=True,
        help_text="Digital Terrain Model (bare ground)"
    )
    dsm_file = models.FileField(
        upload_to='lidar_products/%Y/%m/',
        null=True,
        blank=True,
        help_text="Digital Surface Model (including vegetation)"
    )
    chm_file = models.FileField(
        upload_to='lidar_products/%Y/%m/',
        null=True,
        blank=True,
        help_text="Canopy Height Model (DSM - DTM)"
    )

    # Approval workflow
    is_approved = models.BooleanField(
        default=False,
        help_text="Whether results have been approved"
    )
    approved_by = models.ForeignKey(
        'User',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='approved_lidar_runs'
    )
    approved_at = models.DateTimeField(
        null=True,
        blank=True
    )
    review_notes = models.TextField(
        blank=True,
        help_text="Notes from reviewer"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(
        null=True,
        blank=True
    )
    processing_time_seconds = models.IntegerField(
        null=True,
        blank=True,
        help_text="Total processing time in seconds"
    )

    class Meta:
        db_table = 'api_lidar_processing_run'
        ordering = ['-created_at']
        verbose_name = "LiDAR Processing Run"
        verbose_name_plural = "LiDAR Processing Runs"

    def __str__(self):
        return f"{self.field.name} - {self.processing_type} ({self.status})"

    @property
    def is_latest_for_field(self):
        """Check if this is the most recent completed run for the field."""
        latest = self.field.lidar_runs.filter(
            status='completed',
            is_approved=True
        ).order_by('-completed_at').first()
        return latest and latest.id == self.id


class LiDARDetectedTree(models.Model):
    """
    Individual tree detected from LiDAR CHM analysis.
    Stores 3D location, height, and canopy metrics.
    """

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('dead', 'Dead/Missing'),
        ('uncertain', 'Uncertain'),
        ('false_positive', 'False Positive'),
    ]

    # Relationships
    processing_run = models.ForeignKey(
        LiDARProcessingRun,
        on_delete=models.CASCADE,
        related_name='detected_trees',
        help_text="Processing run that detected this tree"
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='lidar_detected_trees',
        help_text="Field containing this tree"
    )

    # Location (WGS84)
    latitude = models.FloatField(
        help_text="Tree crown center latitude"
    )
    longitude = models.FloatField(
        help_text="Tree crown center longitude"
    )

    # Tree metrics from LiDAR
    height_m = models.FloatField(
        help_text="Tree height in meters (from CHM)"
    )
    canopy_diameter_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Estimated canopy diameter in meters"
    )
    canopy_area_sqm = models.FloatField(
        null=True,
        blank=True,
        help_text="Estimated canopy area in square meters"
    )

    # Ground elevation at tree base
    ground_elevation_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Ground elevation at tree base (from DTM)"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )
    is_verified = models.BooleanField(
        default=False,
        help_text="User has manually verified this tree"
    )
    notes = models.TextField(
        blank=True,
        help_text="User notes about this tree"
    )

    class Meta:
        db_table = 'api_lidar_detected_tree'
        verbose_name = "LiDAR Detected Tree"
        verbose_name_plural = "LiDAR Detected Trees"
        indexes = [
            models.Index(fields=['processing_run', 'field']),
            models.Index(fields=['field', 'status']),
            models.Index(fields=['latitude', 'longitude']),
        ]

    def __str__(self):
        return f"Tree at ({self.latitude:.6f}, {self.longitude:.6f}) - {self.height_m:.1f}m"

    @property
    def location_geojson(self):
        """Return location as GeoJSON Point."""
        return {
            "type": "Point",
            "coordinates": [self.longitude, self.latitude]
        }


class TerrainAnalysis(models.Model):
    """
    Terrain analysis results for frost/irrigation planning.
    Generated from LiDAR DTM data.
    """

    ASPECT_CHOICES = [
        ('N', 'North'),
        ('NE', 'Northeast'),
        ('E', 'East'),
        ('SE', 'Southeast'),
        ('S', 'South'),
        ('SW', 'Southwest'),
        ('W', 'West'),
        ('NW', 'Northwest'),
        ('FLAT', 'Flat'),
    ]

    # Relationship
    processing_run = models.OneToOneField(
        LiDARProcessingRun,
        on_delete=models.CASCADE,
        related_name='terrain_analysis',
        help_text="Processing run that generated this analysis"
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='terrain_analyses',
        help_text="Field being analyzed"
    )

    # Elevation metrics
    min_elevation_m = models.FloatField(
        help_text="Minimum ground elevation in meters"
    )
    max_elevation_m = models.FloatField(
        help_text="Maximum ground elevation in meters"
    )
    mean_elevation_m = models.FloatField(
        help_text="Mean ground elevation in meters"
    )

    # Slope analysis
    mean_slope_degrees = models.FloatField(
        help_text="Mean slope in degrees"
    )
    max_slope_degrees = models.FloatField(
        help_text="Maximum slope in degrees"
    )
    slope_aspect_dominant = models.CharField(
        max_length=20,
        choices=ASPECT_CHOICES,
        help_text="Dominant slope aspect (direction facing)"
    )

    # Slope distribution (percentage of field)
    slope_0_2_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Percentage of field with 0-2 degree slope"
    )
    slope_2_5_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Percentage of field with 2-5 degree slope"
    )
    slope_5_10_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Percentage of field with 5-10 degree slope"
    )
    slope_over_10_percent = models.FloatField(
        null=True,
        blank=True,
        help_text="Percentage of field with >10 degree slope"
    )

    # Frost risk analysis (cold air pooling)
    frost_risk_zones = models.JSONField(
        default=dict,
        blank=True,
        help_text="GeoJSON of frost risk zones"
    )
    frost_risk_summary = models.JSONField(
        default=dict,
        blank=True,
        help_text="Summary statistics for frost risk"
    )

    # Drainage analysis
    drainage_direction = models.CharField(
        max_length=20,
        choices=ASPECT_CHOICES,
        null=True,
        blank=True,
        help_text="Primary drainage direction"
    )
    low_spot_count = models.IntegerField(
        null=True,
        blank=True,
        help_text="Number of low spots that may pool water"
    )

    class Meta:
        db_table = 'api_terrain_analysis'
        verbose_name = "Terrain Analysis"
        verbose_name_plural = "Terrain Analyses"

    def __str__(self):
        return f"Terrain: {self.field.name} - Avg slope {self.mean_slope_degrees:.1f}\u00b0"


# =============================================================================
# UNIFIED TREE IDENTITY MODELS
# =============================================================================

class Tree(models.Model):
    """
    Master tree identity that persists across detection runs.
    Correlates satellite and LiDAR observations of the same physical tree.
    Enables tracking tree health and changes over time.
    """

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('dead', 'Dead/Removed'),
        ('missing', 'Missing (Not in Recent Detections)'),
        ('uncertain', 'Uncertain'),
    ]

    CONFIDENCE_CHOICES = [
        ('high', 'High'),      # Multiple matching observations
        ('medium', 'Medium'),  # Single or few observations
        ('low', 'Low'),        # Only matched via spatial proximity
    ]

    # Primary key using UUID for external references
    uuid = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        help_text="Unique identifier for external references"
    )

    # Ownership
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='trees',
        help_text="Field containing this tree"
    )

    # Canonical location (weighted average from observations)
    latitude = models.FloatField(
        help_text="Best-estimate tree center latitude (WGS84)"
    )
    longitude = models.FloatField(
        help_text="Best-estimate tree center longitude (WGS84)"
    )

    # Best-known attributes (updated from most recent/reliable source)
    height_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Best estimate tree height in meters (from LiDAR)"
    )
    canopy_diameter_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Best estimate canopy diameter in meters"
    )
    canopy_area_sqm = models.FloatField(
        null=True,
        blank=True,
        help_text="Best estimate canopy area in sq meters (from LiDAR)"
    )
    latest_ndvi = models.FloatField(
        null=True,
        blank=True,
        help_text="Most recent NDVI value (from satellite)"
    )
    ground_elevation_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Ground elevation at tree base in meters"
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active'
    )
    identity_confidence = models.CharField(
        max_length=10,
        choices=CONFIDENCE_CHOICES,
        default='medium',
        help_text="Confidence in tree identity across observations"
    )

    # Observation counts
    satellite_observation_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of satellite detection observations"
    )
    lidar_observation_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of LiDAR detection observations"
    )

    # First and last observation dates
    first_observed = models.DateField(
        help_text="Date tree was first detected"
    )
    last_observed = models.DateField(
        help_text="Date of most recent detection"
    )

    # User verification
    is_verified = models.BooleanField(
        default=False,
        help_text="User has manually verified this tree identity"
    )
    verified_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_trees'
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    # User notes
    notes = models.TextField(blank=True)

    # Custom tree ID for field reference
    tree_label = models.CharField(
        max_length=50,
        blank=True,
        help_text="Optional user-assigned label (e.g., 'Row-3-Tree-15')"
    )

    # Row/position inference (populated by spatial analysis)
    inferred_row = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Inferred row number in field"
    )
    inferred_position = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Inferred position within row"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'api_tree'
        verbose_name = "Tree"
        verbose_name_plural = "Trees"
        indexes = [
            models.Index(fields=['field', 'status'], name='api_tree_field_status_idx'),
            models.Index(fields=['latitude', 'longitude'], name='api_tree_lat_lon_idx'),
            models.Index(fields=['field', 'inferred_row', 'inferred_position'], name='api_tree_row_pos_idx'),
            models.Index(fields=['last_observed'], name='api_tree_last_obs_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['field', 'tree_label'],
                name='unique_tree_label_per_field',
                condition=models.Q(tree_label__gt='')
            )
        ]

    def __str__(self):
        label = self.tree_label or f"Tree-{self.id}"
        return f"{label} at ({self.latitude:.6f}, {self.longitude:.6f})"

    @property
    def location_geojson(self):
        """Return location as GeoJSON Point."""
        return {
            "type": "Point",
            "coordinates": [self.longitude, self.latitude]
        }

    @property
    def total_observation_count(self):
        """Total observations from all sources."""
        return self.satellite_observation_count + self.lidar_observation_count


class TreeObservation(models.Model):
    """
    Links a Tree identity to specific detections from satellite or LiDAR runs.
    Allows tracking the same tree across multiple observation sources and times.
    """

    SOURCE_CHOICES = [
        ('satellite', 'Satellite'),
        ('lidar', 'LiDAR'),
    ]

    MATCH_METHOD_CHOICES = [
        ('spatial', 'Spatial Proximity'),
        ('manual', 'Manual Assignment'),
        ('algorithm', 'Algorithm Match'),
    ]

    # Master tree identity
    tree = models.ForeignKey(
        Tree,
        on_delete=models.CASCADE,
        related_name='observations'
    )

    # Source identification
    source_type = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES
    )

    # Link to original detection (one of these will be set based on source_type)
    satellite_detection = models.OneToOneField(
        DetectedTree,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='tree_observation'
    )
    lidar_detection = models.OneToOneField(
        LiDARDetectedTree,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='tree_observation'
    )

    # Matching metadata
    match_method = models.CharField(
        max_length=20,
        choices=MATCH_METHOD_CHOICES,
        default='spatial'
    )
    match_distance_m = models.FloatField(
        null=True,
        blank=True,
        help_text="Distance to tree center when matched (meters)"
    )
    match_confidence = models.FloatField(
        null=True,
        blank=True,
        help_text="Match confidence score (0-1)"
    )

    # Observation date (denormalized for query efficiency)
    observation_date = models.DateField(
        help_text="Date of the detection run"
    )

    # Snapshot of key metrics at observation time
    observed_latitude = models.FloatField()
    observed_longitude = models.FloatField()
    observed_height_m = models.FloatField(null=True, blank=True)
    observed_canopy_diameter_m = models.FloatField(null=True, blank=True)
    observed_ndvi = models.FloatField(null=True, blank=True)
    observed_status = models.CharField(max_length=20)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_tree_observation'
        verbose_name = "Tree Observation"
        verbose_name_plural = "Tree Observations"
        indexes = [
            models.Index(fields=['tree', 'observation_date'], name='api_treeobs_tree_date_idx'),
            models.Index(fields=['source_type', 'observation_date'], name='api_treeobs_source_date_idx'),
        ]

    def __str__(self):
        return f"Observation of Tree {self.tree_id} ({self.source_type}) on {self.observation_date}"


class TreeMatchingRun(models.Model):
    """
    Records each execution of the tree matching algorithm.
    Provides audit trail and allows re-running with different parameters.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    # Context
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='tree_matching_runs'
    )
    triggered_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # Source runs being matched
    satellite_run = models.ForeignKey(
        TreeDetectionRun,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='matching_runs'
    )
    lidar_run = models.ForeignKey(
        LiDARProcessingRun,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='matching_runs'
    )

    # Parameters used
    match_distance_threshold_m = models.FloatField(
        default=3.0,
        help_text="Maximum distance for tree matching (meters)"
    )
    parameters = models.JSONField(
        default=dict,
        help_text="Full matching parameters used"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    error_message = models.TextField(blank=True)

    # Results summary
    trees_matched = models.IntegerField(null=True, blank=True)
    new_trees_created = models.IntegerField(null=True, blank=True)
    trees_marked_missing = models.IntegerField(null=True, blank=True)
    observations_created = models.IntegerField(null=True, blank=True)

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    processing_time_seconds = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_tree_matching_run'
        verbose_name = "Tree Matching Run"
        verbose_name_plural = "Tree Matching Runs"
        ordering = ['-created_at']

    def __str__(self):
        return f"Matching Run {self.id} for {self.field.name} ({self.status})"


class TreeFeedback(models.Model):
    """
    User feedback on tree detections for ML training improvement.
    Tracks flags, corrections, and verifications that can be used to
    improve detection algorithms over time.
    """

    FEEDBACK_TYPES = [
        ('false_positive', 'False Positive - Not a Tree'),
        ('false_negative', 'False Negative - Missed/Wrong Status'),
        ('misidentification', 'Misidentification - Wrong Tree Matched'),
        ('location_error', 'Location Error - Position Incorrect'),
        ('attribute_error', 'Attribute Error - Measurements Wrong'),
        ('verified_correct', 'Verified Correct'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]

    # Link to tree (required) or specific observation (optional)
    tree = models.ForeignKey(
        Tree,
        on_delete=models.CASCADE,
        related_name='feedback'
    )
    observation = models.ForeignKey(
        TreeObservation,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='feedback',
        help_text="Specific observation being flagged (optional)"
    )

    # Feedback details
    feedback_type = models.CharField(
        max_length=30,
        choices=FEEDBACK_TYPES
    )
    notes = models.TextField(
        blank=True,
        help_text="Explanation of the issue"
    )

    # For location corrections
    suggested_latitude = models.FloatField(
        null=True,
        blank=True,
        help_text="Suggested corrected latitude"
    )
    suggested_longitude = models.FloatField(
        null=True,
        blank=True,
        help_text="Suggested corrected longitude"
    )

    # For attribute corrections
    suggested_corrections = models.JSONField(
        default=dict,
        blank=True,
        help_text="Key-value pairs of suggested attribute corrections"
    )

    # Workflow
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    resolution_notes = models.TextField(
        blank=True,
        help_text="Notes from reviewer about resolution"
    )
    resolved_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_tree_feedback'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    # Tracking
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='tree_feedback_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # ML Export tracking
    exported_for_training = models.BooleanField(
        default=False,
        help_text="Whether this feedback has been exported for ML training"
    )
    exported_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'api_tree_feedback'
        verbose_name = "Tree Feedback"
        verbose_name_plural = "Tree Feedback"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tree', 'feedback_type'], name='api_treefb_tree_type_idx'),
            models.Index(fields=['status', 'created_at'], name='api_treefb_status_date_idx'),
            models.Index(fields=['exported_for_training'], name='api_treefb_exported_idx'),
        ]

    def __str__(self):
        return f"{self.get_feedback_type_display()} for Tree {self.tree_id} ({self.status})"
