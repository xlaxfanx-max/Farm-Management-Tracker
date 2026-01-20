"""
LiDAR point cloud processing service.

Processes LAZ/LAS files to generate:
1. Digital Terrain Model (DTM) - bare ground elevation
2. Digital Surface Model (DSM) - including vegetation
3. Canopy Height Model (CHM) - DSM minus DTM
4. Tree detection from CHM using local maxima + watershed
5. Terrain analysis including slope, aspect, and frost risk

Algorithm Overview:
1. Extract metadata from LAZ header (bounds, CRS, point count)
2. Clip points to field boundary (if provided)
3. Separate ground and vegetation points by classification
4. Generate DTM from ground points (class 2)
5. Generate DSM from first returns / highest points
6. Calculate CHM = DSM - DTM
7. Detect trees using local maxima on smoothed CHM
8. Segment tree crowns using marker-controlled watershed
9. Analyze terrain for slope, aspect, frost risk zones

Supported formats:
- LAZ (compressed LAS) - preferred
- LAS (uncompressed)
"""

import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree
from skimage.segmentation import watershed
from skimage.feature import peak_local_max
from typing import Tuple, List, Optional, Dict, Any
from dataclasses import dataclass, asdict, field
import logging
import os
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class LiDARProcessingParams:
    """Parameters for LiDAR processing algorithms."""
    # Raster resolution
    chm_resolution_m: float = 0.5  # CHM/DTM/DSM resolution

    # Tree detection parameters (tuned for California citrus)
    min_tree_height_m: float = 2.0   # Minimum tree height to detect
    max_tree_height_m: float = 15.0  # Maximum expected tree height
    smoothing_sigma: float = 1.0     # Gaussian smoothing for CHM (in pixels)
    min_tree_spacing_m: float = 2.0  # Minimum spacing between tree peaks (citrus ~12-20ft spacing)

    # Watershed segmentation parameters
    watershed_compactness: float = 0.1
    min_crown_area_sqm: float = 1.0  # Minimum crown area to consider (citrus trees ~6-12ft canopy)

    # Ground classification
    ground_class: int = 2  # LAS classification for ground points
    vegetation_classes: List[int] = field(default_factory=lambda: [3, 4, 5])

    # Terrain analysis
    slope_nodata: float = -9999.0
    frost_risk_elevation_threshold_m: float = 5.0  # Relative to field minimum


@dataclass
class LiDARMetadata:
    """Metadata extracted from LAZ/LAS file header."""
    point_count: int
    point_density_per_sqm: float
    bounds_west: float
    bounds_east: float
    bounds_south: float
    bounds_north: float
    crs: str
    has_classification: bool
    file_size_mb: float
    min_z: float
    max_z: float
    classification_counts: Dict[int, int]


@dataclass
class DetectedLiDARTree:
    """Data for a single tree detected from LiDAR."""
    latitude: float
    longitude: float
    height_m: float
    canopy_diameter_m: Optional[float] = None
    canopy_area_sqm: Optional[float] = None
    ground_elevation_m: Optional[float] = None


@dataclass
class TerrainResult:
    """Results from terrain analysis."""
    min_elevation_m: float
    max_elevation_m: float
    mean_elevation_m: float
    mean_slope_degrees: float
    max_slope_degrees: float
    slope_aspect_dominant: str
    slope_distribution: Dict[str, float]  # e.g., {"0-2": 45.0, "2-5": 30.0, ...}
    frost_risk_zones: Dict  # GeoJSON FeatureCollection
    frost_risk_summary: Dict  # {low_percent, medium_percent, high_percent}
    drainage_direction: Optional[str]
    low_spot_count: int


@dataclass
class LiDARProcessingResult:
    """Complete results from LiDAR processing."""
    # Tree detection results
    trees: List[Dict[str, Any]]
    tree_count: int
    trees_per_acre: Optional[float]
    avg_tree_height_m: Optional[float]
    max_tree_height_m: Optional[float]
    min_tree_height_m: Optional[float]
    avg_canopy_diameter_m: Optional[float]
    canopy_coverage_percent: Optional[float]

    # Terrain results
    terrain: Optional[TerrainResult]

    # Generated files (paths)
    dtm_path: Optional[str]
    dsm_path: Optional[str]
    chm_path: Optional[str]

    # Processing info
    field_area_acres: Optional[float]
    processing_time_seconds: float


# =============================================================================
# METADATA EXTRACTION
# =============================================================================

def extract_laz_metadata(file_path: str) -> LiDARMetadata:
    """
    Extract metadata from LAZ/LAS file header.

    Args:
        file_path: Path to LAZ or LAS file

    Returns:
        LiDARMetadata with bounds, point count, CRS, etc.
    """
    import laspy

    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)

    with laspy.open(file_path) as las_file:
        header = las_file.header

        # Get bounds
        bounds_west = header.x_min
        bounds_east = header.x_max
        bounds_south = header.y_min
        bounds_north = header.y_max
        min_z = header.z_min
        max_z = header.z_max

        # Calculate area and point density
        area_sqm = (bounds_east - bounds_west) * (bounds_north - bounds_south)
        point_count = header.point_count
        point_density = point_count / area_sqm if area_sqm > 0 else 0

        # Get CRS
        crs = "Unknown"
        if hasattr(header, 'parse_crs') and callable(header.parse_crs):
            try:
                crs_obj = header.parse_crs()
                if crs_obj:
                    crs = str(crs_obj)
            except Exception:
                pass

        # Check for VLRs with CRS info
        if crs == "Unknown":
            for vlr in header.vlrs:
                if vlr.record_id in [2111, 2112]:  # GeoTIFF keys
                    crs = f"EPSG from VLR (record {vlr.record_id})"
                    break

        # Read a chunk to check classification
        las_data = las_file.read()
        has_classification = False
        classification_counts = {}

        if hasattr(las_data, 'classification'):
            classifications = las_data.classification
            unique, counts = np.unique(classifications, return_counts=True)
            classification_counts = dict(zip(unique.tolist(), counts.tolist()))
            # Has classification if more than just class 0 (unclassified)
            has_classification = len(classification_counts) > 1 or 0 not in classification_counts

        return LiDARMetadata(
            point_count=point_count,
            point_density_per_sqm=point_density,
            bounds_west=bounds_west,
            bounds_east=bounds_east,
            bounds_south=bounds_south,
            bounds_north=bounds_north,
            crs=crs,
            has_classification=has_classification,
            file_size_mb=file_size_mb,
            min_z=min_z,
            max_z=max_z,
            classification_counts=classification_counts,
        )


def transform_bounds_to_wgs84(
    bounds: Tuple[float, float, float, float],
    source_crs: str
) -> Tuple[float, float, float, float]:
    """
    Transform bounds from source CRS to WGS84.

    Args:
        bounds: (west, south, east, north) in source CRS
        source_crs: Source coordinate reference system

    Returns:
        Bounds in WGS84 (longitude/latitude)
    """
    try:
        from pyproj import CRS, Transformer

        src_crs = CRS.from_string(source_crs)
        dst_crs = CRS.from_epsg(4326)

        transformer = Transformer.from_crs(src_crs, dst_crs, always_xy=True)

        west, south, east, north = bounds

        # Transform corners
        sw_lon, sw_lat = transformer.transform(west, south)
        ne_lon, ne_lat = transformer.transform(east, north)

        return (sw_lon, sw_lat, ne_lon, ne_lat)
    except Exception as e:
        logger.warning(f"Failed to transform bounds to WGS84: {e}")
        return bounds


# =============================================================================
# POINT CLOUD OPERATIONS
# =============================================================================

def clip_points_to_boundary(
    laz_path: str,
    field_geojson: Dict,
    output_path: str
) -> str:
    """
    Clip LiDAR points to field boundary polygon.

    The field boundary is expected to be in WGS84 (lat/lon), while LAZ files
    are typically in a projected CRS (e.g., State Plane). This function
    transforms the boundary to match the LAZ coordinate system before clipping.

    Args:
        laz_path: Input LAZ file path
        field_geojson: GeoJSON polygon for field boundary (in WGS84)
        output_path: Output LAZ file path

    Returns:
        Path to clipped LAZ file
    """
    import laspy
    from shapely.geometry import shape, Point, Polygon
    from shapely.prepared import prep
    from shapely.ops import transform as shapely_transform

    # Create shapely geometry from GeoJSON (in WGS84)
    boundary_wgs84 = shape(field_geojson)

    with laspy.open(laz_path) as las_file:
        las_data = las_file.read()
        header = las_file.header

        # Try to get CRS from LAZ file
        laz_crs = None
        try:
            laz_crs = header.parse_crs()
            logger.info(f"LAZ CRS: {laz_crs}")
        except Exception as e:
            logger.warning(f"Could not parse CRS from LAZ header: {e}")

        # Transform boundary from WGS84 to LAZ CRS if possible
        boundary = boundary_wgs84
        if laz_crs:
            try:
                from pyproj import CRS, Transformer

                src_crs = CRS.from_epsg(4326)  # WGS84
                dst_crs = CRS.from_user_input(laz_crs)

                transformer = Transformer.from_crs(src_crs, dst_crs, always_xy=True)

                # Transform the boundary polygon
                def transform_coords(x, y):
                    return transformer.transform(x, y)

                boundary = shapely_transform(transform_coords, boundary_wgs84)
                logger.info(f"Transformed boundary to LAZ CRS. Bounds: {boundary.bounds}")
            except Exception as e:
                logger.warning(f"Failed to transform boundary to LAZ CRS: {e}")
                # Fall back: check if LAZ coordinates look like State Plane (large numbers)
                x_arr = np.array(las_data.x)
                sample_x = x_arr[0] if len(x_arr) > 0 else 0
                if abs(sample_x) > 10000:  # Likely projected coordinates (feet or meters)
                    logger.warning("LAZ appears to be in projected CRS but transformation failed. "
                                   "Attempting manual transformation assuming CA State Plane Zone 5 (EPSG:2229)")
                    try:
                        from pyproj import CRS, Transformer
                        src_crs = CRS.from_epsg(4326)  # WGS84
                        dst_crs = CRS.from_epsg(2229)  # CA State Plane Zone 5 (feet)

                        transformer = Transformer.from_crs(src_crs, dst_crs, always_xy=True)

                        def transform_coords(x, y):
                            return transformer.transform(x, y)

                        boundary = shapely_transform(transform_coords, boundary_wgs84)
                        logger.info(f"Manual transform to EPSG:2229. Bounds: {boundary.bounds}")
                    except Exception as e2:
                        logger.error(f"Manual transformation also failed: {e2}")
                        raise ValueError(f"Cannot transform boundary to match LAZ coordinates: {e2}")

        prepared_boundary = prep(boundary)

        # Get point coordinates as numpy arrays
        x = np.array(las_data.x)
        y = np.array(las_data.y)

        logger.info(f"LAZ point bounds: X=[{x.min():.1f}, {x.max():.1f}], Y=[{y.min():.1f}, {y.max():.1f}]")
        logger.info(f"Boundary bounds: {boundary.bounds}")

        # Create mask for points within boundary using vectorized approach
        # First do a bounding box filter for speed
        minx, miny, maxx, maxy = boundary.bounds
        bbox_mask = (x >= minx) & (x <= maxx) & (y >= miny) & (y <= maxy)
        bbox_indices = np.where(bbox_mask)[0]

        logger.info(f"Points within bounding box: {len(bbox_indices)} of {len(x)}")

        # Now do precise polygon test only on bbox-filtered points
        mask = np.zeros(len(x), dtype=bool)

        # Process in chunks for memory efficiency
        chunk_size = 50000
        for i in range(0, len(bbox_indices), chunk_size):
            end_idx = min(i + chunk_size, len(bbox_indices))
            chunk_indices = bbox_indices[i:end_idx]
            for j in chunk_indices:
                if prepared_boundary.contains(Point(float(x[j]), float(y[j]))):
                    mask[j] = True

        points_in_boundary = np.sum(mask)
        logger.info(f"Points within polygon: {points_in_boundary}")

        if points_in_boundary == 0:
            raise ValueError("No points found within field boundary after transformation")

        # Create new LAS with clipped points
        clipped_las = laspy.create(point_format=las_data.point_format, file_version=las_data.header.version)
        clipped_las.points = las_data.points[mask]

        # Copy header info
        clipped_las.header.offsets = las_data.header.offsets
        clipped_las.header.scales = las_data.header.scales

        # Copy VLRs (including CRS information)
        for vlr in header.vlrs:
            clipped_las.header.vlrs.append(vlr)

        clipped_las.write(output_path)

    logger.info(f"Clipped LAZ saved to {output_path} with {points_in_boundary} points")
    return output_path


def points_to_raster(
    x: np.ndarray,
    y: np.ndarray,
    z: np.ndarray,
    resolution: float,
    bounds: Tuple[float, float, float, float],
    method: str = 'max'
) -> Tuple[np.ndarray, dict]:
    """
    Convert point cloud to raster grid.

    Args:
        x, y, z: Point coordinates
        resolution: Output resolution in same units as coordinates
        bounds: (xmin, ymin, xmax, ymax)
        method: 'max' for DSM, 'min' for DTM, 'mean' for average

    Returns:
        Tuple of (raster array, transform dict)
    """
    xmin, ymin, xmax, ymax = bounds

    # Calculate grid dimensions
    width = int(np.ceil((xmax - xmin) / resolution))
    height = int(np.ceil((ymax - ymin) / resolution))

    # Initialize output arrays
    raster = np.full((height, width), np.nan, dtype=np.float32)
    count = np.zeros((height, width), dtype=np.int32)

    # Convert coordinates to grid indices
    col_idx = ((x - xmin) / resolution).astype(np.int32)
    row_idx = ((ymax - y) / resolution).astype(np.int32)  # Flip Y axis

    # Clip to valid range
    valid = (col_idx >= 0) & (col_idx < width) & (row_idx >= 0) & (row_idx < height)
    col_idx = col_idx[valid]
    row_idx = row_idx[valid]
    z = z[valid]

    if method == 'max':
        # For DSM: use maximum Z value in each cell
        for i in range(len(z)):
            r, c = row_idx[i], col_idx[i]
            if np.isnan(raster[r, c]) or z[i] > raster[r, c]:
                raster[r, c] = z[i]
    elif method == 'min':
        # For DTM: use minimum Z value in each cell
        for i in range(len(z)):
            r, c = row_idx[i], col_idx[i]
            if np.isnan(raster[r, c]) or z[i] < raster[r, c]:
                raster[r, c] = z[i]
    else:
        # Mean: accumulate and divide
        sum_raster = np.zeros((height, width), dtype=np.float64)
        for i in range(len(z)):
            r, c = row_idx[i], col_idx[i]
            sum_raster[r, c] += z[i]
            count[r, c] += 1

        valid_cells = count > 0
        raster[valid_cells] = sum_raster[valid_cells] / count[valid_cells]

    # Create transform info
    transform = {
        'xmin': xmin,
        'ymax': ymax,
        'resolution': resolution,
        'width': width,
        'height': height,
    }

    return raster, transform


# =============================================================================
# DTM / DSM / CHM GENERATION
# =============================================================================

def generate_dtm(
    laz_path: str,
    output_tif: str,
    resolution: float,
    ground_class: int = 2
) -> str:
    """
    Generate Digital Terrain Model (DTM) from ground-classified points.

    Args:
        laz_path: Input LAZ file path
        output_tif: Output GeoTIFF path
        resolution: Output resolution in meters
        ground_class: LAS classification code for ground (default 2)

    Returns:
        Path to output DTM GeoTIFF
    """
    import laspy
    import rasterio
    from rasterio.transform import from_bounds
    from scipy.interpolate import griddata

    with laspy.open(laz_path) as las_file:
        las_data = las_file.read()

        # Filter to ground points
        ground_mask = las_data.classification == ground_class

        if not np.any(ground_mask):
            logger.warning("No ground points found, using all points")
            ground_mask = np.ones(len(las_data.x), dtype=bool)

        x = las_data.x[ground_mask]
        y = las_data.y[ground_mask]
        z = las_data.z[ground_mask]

        logger.info(f"DTM: Using {len(x)} ground points")

        # Get bounds
        bounds = (x.min(), y.min(), x.max(), y.max())

        # Create raster from ground points
        dtm, transform_info = points_to_raster(x, y, z, resolution, bounds, method='min')

        # Fill gaps using interpolation
        mask = np.isnan(dtm)
        if np.any(mask) and np.any(~mask):
            valid_coords = np.argwhere(~mask)
            valid_values = dtm[~mask]
            invalid_coords = np.argwhere(mask)

            if len(valid_coords) > 3 and len(invalid_coords) > 0:
                filled_values = griddata(
                    valid_coords, valid_values, invalid_coords, method='linear'
                )
                dtm[mask] = filled_values

        # Write GeoTIFF
        xmin, ymin, xmax, ymax = bounds
        transform = from_bounds(xmin, ymin, xmax, ymax, dtm.shape[1], dtm.shape[0])

        # Get CRS from LAS header if available
        crs = None
        try:
            crs = las_file.header.parse_crs()
        except Exception:
            pass

        with rasterio.open(
            output_tif, 'w',
            driver='GTiff',
            height=dtm.shape[0],
            width=dtm.shape[1],
            count=1,
            dtype=dtm.dtype,
            crs=crs,
            transform=transform,
            nodata=np.nan,
        ) as dst:
            dst.write(dtm, 1)

    return output_tif


def generate_dsm(
    laz_path: str,
    output_tif: str,
    resolution: float
) -> str:
    """
    Generate Digital Surface Model (DSM) from highest points.

    Args:
        laz_path: Input LAZ file path
        output_tif: Output GeoTIFF path
        resolution: Output resolution in meters

    Returns:
        Path to output DSM GeoTIFF
    """
    import laspy
    import rasterio
    from rasterio.transform import from_bounds
    from scipy.interpolate import griddata

    with laspy.open(laz_path) as las_file:
        las_data = las_file.read()

        x = np.array(las_data.x)
        y = np.array(las_data.y)
        z = np.array(las_data.z)

        logger.info(f"DSM: Using {len(x)} total points")

        # Get bounds
        bounds = (x.min(), y.min(), x.max(), y.max())

        # Create raster using maximum Z
        dsm, transform_info = points_to_raster(x, y, z, resolution, bounds, method='max')

        # Fill gaps using interpolation (similar to DTM)
        # This is important for sparse point clouds where direct rasterization
        # leaves many cells empty
        mask = np.isnan(dsm)
        if np.any(mask) and np.any(~mask):
            valid_coords = np.argwhere(~mask)
            valid_values = dsm[~mask]
            invalid_coords = np.argwhere(mask)

            if len(valid_coords) > 3 and len(invalid_coords) > 0:
                logger.info(f"DSM: Interpolating {len(invalid_coords)} empty cells from {len(valid_coords)} valid cells")
                filled_values = griddata(
                    valid_coords, valid_values, invalid_coords, method='linear'
                )
                dsm[mask] = filled_values

        # Write GeoTIFF
        xmin, ymin, xmax, ymax = bounds
        transform = from_bounds(xmin, ymin, xmax, ymax, dsm.shape[1], dsm.shape[0])

        crs = None
        try:
            crs = las_file.header.parse_crs()
        except Exception:
            pass

        with rasterio.open(
            output_tif, 'w',
            driver='GTiff',
            height=dsm.shape[0],
            width=dsm.shape[1],
            count=1,
            dtype=dsm.dtype,
            crs=crs,
            transform=transform,
            nodata=np.nan,
        ) as dst:
            dst.write(dsm, 1)

    return output_tif


def generate_chm(
    dtm_path: str,
    dsm_path: str,
    output_path: str
) -> str:
    """
    Generate Canopy Height Model (CHM) by subtracting DTM from DSM.

    Args:
        dtm_path: Path to DTM GeoTIFF
        dsm_path: Path to DSM GeoTIFF
        output_path: Output CHM GeoTIFF path

    Returns:
        Path to output CHM GeoTIFF
    """
    import rasterio

    with rasterio.open(dsm_path) as dsm_src, rasterio.open(dtm_path) as dtm_src:
        dsm = dsm_src.read(1)
        dtm = dtm_src.read(1)

        # Calculate CHM
        chm = dsm - dtm

        # Set negative values to 0 (can occur due to interpolation)
        chm = np.maximum(chm, 0)

        # Set areas with no data to nodata
        nodata_mask = np.isnan(dsm) | np.isnan(dtm)
        chm[nodata_mask] = np.nan

        # Write output
        profile = dsm_src.profile.copy()
        profile.update(nodata=np.nan)

        with rasterio.open(output_path, 'w', **profile) as dst:
            dst.write(chm, 1)

    return output_path


# =============================================================================
# TREE DETECTION
# =============================================================================

def detect_trees_from_chm(
    chm_path: str,
    params: LiDARProcessingParams
) -> List[DetectedLiDARTree]:
    """
    Detect individual trees from Canopy Height Model using local maxima
    and watershed segmentation.

    Handles unit conversion for CRS that use feet (e.g., CA State Plane).

    Args:
        chm_path: Path to CHM GeoTIFF
        params: Processing parameters (heights in meters)

    Returns:
        List of detected trees with location and metrics (heights in meters)
    """
    import rasterio

    with rasterio.open(chm_path) as src:
        chm = src.read(1)
        transform = src.transform
        crs = src.crs

        resolution = abs(transform.a)  # Pixel size in map units

        # Detect if CRS uses feet (common for US State Plane coordinates)
        # Convert meter parameters to feet if needed
        FEET_TO_METERS = 0.3048
        METERS_TO_FEET = 1 / FEET_TO_METERS

        uses_feet = False
        if crs:
            crs_str = str(crs).lower()
            if 'foot' in crs_str or 'feet' in crs_str or 'ftus' in crs_str:
                uses_feet = True
                logger.info("CRS uses feet - converting parameters")

        # Convert height thresholds to native units
        if uses_feet:
            min_height_native = params.min_tree_height_m * METERS_TO_FEET
            max_height_native = params.max_tree_height_m * METERS_TO_FEET
            min_spacing_native = params.min_tree_spacing_m * METERS_TO_FEET
            min_crown_area_native = params.min_crown_area_sqm * (METERS_TO_FEET ** 2)
        else:
            min_height_native = params.min_tree_height_m
            max_height_native = params.max_tree_height_m
            min_spacing_native = params.min_tree_spacing_m
            min_crown_area_native = params.min_crown_area_sqm

        logger.info(f"Height range: {min_height_native:.1f} to {max_height_native:.1f} {'feet' if uses_feet else 'meters'}")

        # Clean NaN/nodata values before processing
        valid_data_mask = np.isfinite(chm) & (chm >= 0)
        chm_clean = np.where(valid_data_mask, chm, 0)

        # Create mask for valid tree heights
        height_mask = (chm_clean >= min_height_native) & (chm_clean <= max_height_native)

        if not np.any(height_mask):
            logger.warning("No pixels within tree height range")
            return []

        # Apply Gaussian smoothing to reduce noise (on cleaned data)
        sigma_pixels = params.smoothing_sigma
        chm_smooth = ndimage.gaussian_filter(chm_clean, sigma=sigma_pixels)
        chm_smooth[~height_mask] = 0

        # Find local maxima (tree tops)
        min_distance = int(min_spacing_native / resolution)
        min_distance = max(1, min_distance)

        # Use peak_local_max to find tree tops
        coordinates = peak_local_max(
            chm_smooth,
            min_distance=min_distance,
            threshold_abs=min_height_native,
            exclude_border=True
        )

        logger.info(f"Found {len(coordinates)} potential tree tops")

        if len(coordinates) == 0:
            return []

        # Create markers for watershed segmentation
        markers = np.zeros_like(chm, dtype=np.int32)
        for i, (row, col) in enumerate(coordinates, start=1):
            markers[row, col] = i

        # Apply watershed to segment individual tree crowns
        # Use negative CHM so watersheds fill from peaks
        labels = watershed(-chm_smooth, markers, mask=height_mask, compactness=params.watershed_compactness)

        # Extract tree properties
        trees = []

        for i, (peak_row, peak_col) in enumerate(coordinates, start=1):
            # Get crown mask
            crown_mask = labels == i
            crown_area_pixels = np.sum(crown_mask)
            crown_area_native = crown_area_pixels * (resolution ** 2)

            # Skip very small crowns
            if crown_area_native < min_crown_area_native:
                continue

            # Get tree height at peak (use cleaned CHM)
            height_native = float(chm_clean[peak_row, peak_col])

            # Calculate crown diameter (assuming roughly circular)
            crown_diameter_native = 2 * np.sqrt(crown_area_native / np.pi)

            # Convert to meters for output
            if uses_feet:
                height_m = height_native * FEET_TO_METERS
                crown_diameter_m = crown_diameter_native * FEET_TO_METERS
                crown_area_sqm = crown_area_native * (FEET_TO_METERS ** 2)
            else:
                height_m = height_native
                crown_diameter_m = crown_diameter_native
                crown_area_sqm = crown_area_native

            # Convert pixel coordinates to geographic coordinates
            x_coord, y_coord = transform * (peak_col, peak_row)

            # Get ground elevation from original CHM calculation reference
            # (this would need DTM, but we can estimate from DSM - CHM)
            ground_elevation = None  # Will be populated later if DTM available

            trees.append(DetectedLiDARTree(
                latitude=y_coord,
                longitude=x_coord,
                height_m=height_m,
                canopy_diameter_m=crown_diameter_m,
                canopy_area_sqm=crown_area_sqm,
                ground_elevation_m=ground_elevation,
            ))

        logger.info(f"Detected {len(trees)} trees after crown segmentation")

        return trees


def add_ground_elevation_to_trees(
    trees: List[DetectedLiDARTree],
    dtm_path: str
) -> List[DetectedLiDARTree]:
    """
    Add ground elevation to detected trees from DTM.

    Handles unit conversion for CRS that use feet.

    Args:
        trees: List of detected trees
        dtm_path: Path to DTM GeoTIFF

    Returns:
        Trees with ground_elevation_m populated (in meters)
    """
    import rasterio

    if not trees:
        return trees

    with rasterio.open(dtm_path) as src:
        dtm = src.read(1)
        transform = src.transform
        crs = src.crs

        # Detect if CRS uses feet
        FEET_TO_METERS = 0.3048
        uses_feet = False
        if crs:
            crs_str = str(crs).lower()
            if 'foot' in crs_str or 'feet' in crs_str or 'ftus' in crs_str:
                uses_feet = True

        for tree in trees:
            # Convert geographic to pixel coordinates
            col, row = ~transform * (tree.longitude, tree.latitude)
            col, row = int(col), int(row)

            # Check bounds
            if 0 <= row < dtm.shape[0] and 0 <= col < dtm.shape[1]:
                elevation = dtm[row, col]
                if not np.isnan(elevation):
                    # Convert to meters if needed
                    if uses_feet:
                        tree.ground_elevation_m = float(elevation) * FEET_TO_METERS
                    else:
                        tree.ground_elevation_m = float(elevation)

    return trees


# =============================================================================
# TERRAIN ANALYSIS
# =============================================================================

def analyze_terrain(dtm_path: str, params: LiDARProcessingParams) -> TerrainResult:
    """
    Analyze terrain from DTM for slope, aspect, and frost risk.

    Args:
        dtm_path: Path to DTM GeoTIFF
        params: Processing parameters

    Returns:
        TerrainResult with slope, aspect, and frost risk analysis
    """
    import rasterio

    with rasterio.open(dtm_path) as src:
        dtm = src.read(1)
        transform = src.transform
        resolution = abs(transform.a)
        crs = src.crs

        # Handle nodata
        nodata_mask = np.isnan(dtm)

        # Calculate elevation statistics
        valid_dtm = dtm[~nodata_mask]
        if len(valid_dtm) == 0:
            raise ValueError("DTM contains no valid data")

        min_elevation = float(np.min(valid_dtm))
        max_elevation = float(np.max(valid_dtm))
        mean_elevation = float(np.mean(valid_dtm))

        # Calculate slope and aspect
        slope, aspect = calculate_slope_aspect(dtm, resolution)

        # Mask nodata
        slope[nodata_mask] = np.nan
        aspect[nodata_mask] = np.nan

        valid_slope = slope[~nodata_mask]
        mean_slope = float(np.mean(valid_slope))
        max_slope = float(np.max(valid_slope))

        # Calculate dominant aspect
        valid_aspect = aspect[~nodata_mask]
        dominant_aspect = calculate_dominant_aspect(valid_aspect)

        # Calculate slope distribution
        slope_dist = calculate_slope_distribution(valid_slope)

        # Calculate frost risk zones
        frost_zones, frost_summary = calculate_frost_risk(
            dtm, transform, crs, params.frost_risk_elevation_threshold_m
        )

        # Calculate drainage direction (based on slope aspect)
        drainage_direction = dominant_aspect

        # Count low spots (local minima that may pool water)
        low_spot_count = count_low_spots(dtm, resolution)

        return TerrainResult(
            min_elevation_m=min_elevation,
            max_elevation_m=max_elevation,
            mean_elevation_m=mean_elevation,
            mean_slope_degrees=mean_slope,
            max_slope_degrees=max_slope,
            slope_aspect_dominant=dominant_aspect,
            slope_distribution=slope_dist,
            frost_risk_zones=frost_zones,
            frost_risk_summary=frost_summary,
            drainage_direction=drainage_direction,
            low_spot_count=low_spot_count,
        )


def calculate_slope_aspect(
    dem: np.ndarray,
    resolution: float
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Calculate slope and aspect from DEM using numpy gradients.

    Args:
        dem: Digital Elevation Model array
        resolution: Cell size in meters

    Returns:
        Tuple of (slope in degrees, aspect in degrees)
    """
    # Calculate gradients
    dy, dx = np.gradient(dem, resolution)

    # Calculate slope in degrees
    slope_rad = np.arctan(np.sqrt(dx**2 + dy**2))
    slope_deg = np.degrees(slope_rad)

    # Calculate aspect in degrees (0=North, 90=East, 180=South, 270=West)
    aspect_rad = np.arctan2(-dx, dy)  # Note: dx negated for geographic convention
    aspect_deg = np.degrees(aspect_rad)
    aspect_deg = np.mod(aspect_deg + 360, 360)  # Convert to 0-360 range

    return slope_deg, aspect_deg


def calculate_dominant_aspect(aspect_values: np.ndarray) -> str:
    """
    Determine dominant aspect direction from aspect values.

    Args:
        aspect_values: Array of aspect values in degrees (0-360)

    Returns:
        Dominant aspect as cardinal/intercardinal direction
    """
    # Define aspect ranges
    directions = {
        'N': [(337.5, 360), (0, 22.5)],
        'NE': [(22.5, 67.5)],
        'E': [(67.5, 112.5)],
        'SE': [(112.5, 157.5)],
        'S': [(157.5, 202.5)],
        'SW': [(202.5, 247.5)],
        'W': [(247.5, 292.5)],
        'NW': [(292.5, 337.5)],
    }

    counts = {d: 0 for d in directions}

    for val in aspect_values:
        for direction, ranges in directions.items():
            for low, high in ranges:
                if low <= val < high:
                    counts[direction] += 1
                    break

    # Check if mostly flat (low slope variance)
    total = sum(counts.values())
    if total == 0:
        return 'FLAT'

    return max(counts, key=counts.get)


def calculate_slope_distribution(slope_values: np.ndarray) -> Dict[str, float]:
    """
    Calculate percentage of area in each slope class.

    Args:
        slope_values: Array of slope values in degrees

    Returns:
        Dictionary with slope class percentages
    """
    total = len(slope_values)
    if total == 0:
        return {}

    dist = {
        'slope_0_2_percent': float(np.sum(slope_values < 2) / total * 100),
        'slope_2_5_percent': float(np.sum((slope_values >= 2) & (slope_values < 5)) / total * 100),
        'slope_5_10_percent': float(np.sum((slope_values >= 5) & (slope_values < 10)) / total * 100),
        'slope_over_10_percent': float(np.sum(slope_values >= 10) / total * 100),
    }

    return dist


def calculate_frost_risk(
    dtm: np.ndarray,
    transform,
    crs,
    threshold_m: float
) -> Tuple[Dict, Dict]:
    """
    Calculate frost risk zones based on relative elevation.
    Cold air pools in low-lying areas, creating frost pockets.

    Args:
        dtm: Digital Terrain Model array
        transform: Rasterio transform
        crs: Coordinate reference system
        threshold_m: Elevation threshold for high risk zones

    Returns:
        Tuple of (GeoJSON zones, summary statistics)
    """
    valid_mask = ~np.isnan(dtm)
    if not np.any(valid_mask):
        return {}, {}

    valid_elevations = dtm[valid_mask]
    min_elev = np.min(valid_elevations)
    max_elev = np.max(valid_elevations)
    elev_range = max_elev - min_elev

    if elev_range < 1:
        # Flat terrain - uniform moderate risk
        return {
            'type': 'FeatureCollection',
            'features': []
        }, {
            'low_percent': 0,
            'medium_percent': 100,
            'high_percent': 0,
        }

    # Calculate relative elevation (0 = lowest, 1 = highest)
    relative_elev = (dtm - min_elev) / elev_range
    relative_elev[~valid_mask] = np.nan

    # Classify risk levels
    # High risk: lowest 20% of elevation (cold air pooling)
    # Medium risk: 20-50% elevation
    # Low risk: above 50% elevation
    total_valid = np.sum(valid_mask)

    high_risk_mask = relative_elev < 0.2
    medium_risk_mask = (relative_elev >= 0.2) & (relative_elev < 0.5)
    low_risk_mask = relative_elev >= 0.5

    summary = {
        'low_percent': float(np.sum(low_risk_mask & valid_mask) / total_valid * 100),
        'medium_percent': float(np.sum(medium_risk_mask & valid_mask) / total_valid * 100),
        'high_percent': float(np.sum(high_risk_mask & valid_mask) / total_valid * 100),
    }

    # Create simplified GeoJSON for zones (skip detailed polygonization for performance)
    frost_zones = {
        'type': 'FeatureCollection',
        'features': [],
        'properties': {
            'min_elevation_m': float(min_elev),
            'max_elevation_m': float(max_elev),
            'high_risk_threshold_m': float(min_elev + elev_range * 0.2),
            'medium_risk_threshold_m': float(min_elev + elev_range * 0.5),
        }
    }

    return frost_zones, summary


def count_low_spots(dtm: np.ndarray, resolution: float) -> int:
    """
    Count local minima (low spots) that may pool water.

    Args:
        dtm: Digital Terrain Model array
        resolution: Cell size in meters

    Returns:
        Count of significant low spots
    """
    # Find local minima using minimum filter
    footprint_size = max(3, int(5 / resolution))  # ~5 meter minimum for low spot
    local_min = ndimage.minimum_filter(dtm, size=footprint_size)

    # Find cells that equal the local minimum
    is_minimum = dtm == local_min

    # Must be at least 0.3m below average neighbors
    avg_neighbors = ndimage.uniform_filter(dtm, size=footprint_size)
    significant_minimum = is_minimum & ((avg_neighbors - dtm) > 0.3)

    # Label connected regions
    labeled, num_features = ndimage.label(significant_minimum)

    return num_features


# =============================================================================
# COORDINATE TRANSFORMATION
# =============================================================================

def transform_trees_to_wgs84(
    trees: List[DetectedLiDARTree],
    source_crs: str
) -> List[DetectedLiDARTree]:
    """
    Transform tree coordinates from source CRS to WGS84.

    Args:
        trees: List of trees with coordinates in source CRS
        source_crs: Source coordinate reference system string

    Returns:
        Trees with lat/lon in WGS84
    """
    if not trees:
        return trees

    try:
        from pyproj import CRS, Transformer

        src_crs = CRS.from_string(source_crs)
        dst_crs = CRS.from_epsg(4326)

        transformer = Transformer.from_crs(src_crs, dst_crs, always_xy=True)

        for tree in trees:
            lon, lat = transformer.transform(tree.longitude, tree.latitude)
            tree.longitude = lon
            tree.latitude = lat

        return trees
    except Exception as e:
        logger.warning(f"Failed to transform tree coordinates: {e}")
        return trees


# =============================================================================
# MAIN PROCESSING FUNCTION
# =============================================================================

def run_full_analysis(
    laz_path: str,
    field: Any,  # Field model instance
    output_dir: str,
    params: Optional[LiDARProcessingParams] = None,
    processing_type: str = 'FULL'
) -> LiDARProcessingResult:
    """
    Run complete LiDAR analysis pipeline.

    Args:
        laz_path: Path to input LAZ file
        field: Field model instance with boundary_geojson
        output_dir: Directory for output files
        params: Processing parameters (uses defaults if None)
        processing_type: 'TREE_DETECTION', 'TERRAIN_ANALYSIS', or 'FULL'

    Returns:
        LiDARProcessingResult with all results
    """
    import time
    start_time = time.perf_counter()

    if params is None:
        params = LiDARProcessingParams()

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Generate output file paths
    base_name = Path(laz_path).stem
    dtm_path = os.path.join(output_dir, f"{base_name}_dtm.tif")
    dsm_path = os.path.join(output_dir, f"{base_name}_dsm.tif")
    chm_path = os.path.join(output_dir, f"{base_name}_chm.tif")

    # Get field info
    field_boundary = getattr(field, 'boundary_geojson', None)
    field_acres = float(getattr(field, 'total_acres', 0) or 0)

    # Initialize results
    trees = []
    terrain = None

    # Optionally clip to field boundary
    working_laz = laz_path
    if field_boundary:
        try:
            clipped_path = os.path.join(output_dir, f"{base_name}_clipped.laz")
            working_laz = clip_points_to_boundary(laz_path, field_boundary, clipped_path)
            logger.info(f"Clipped points to field boundary: {clipped_path}")
        except Exception as e:
            logger.warning(f"Failed to clip to boundary, using full dataset: {e}")

    # Generate DTM and DSM
    logger.info("Generating DTM...")
    generate_dtm(working_laz, dtm_path, params.chm_resolution_m, params.ground_class)

    logger.info("Generating DSM...")
    generate_dsm(working_laz, dsm_path, params.chm_resolution_m)

    # Generate CHM
    logger.info("Generating CHM...")
    generate_chm(dtm_path, dsm_path, chm_path)

    # Tree detection
    if processing_type in ['TREE_DETECTION', 'FULL']:
        logger.info("Detecting trees from CHM...")
        trees = detect_trees_from_chm(chm_path, params)

        # Add ground elevation
        trees = add_ground_elevation_to_trees(trees, dtm_path)

        # Get CRS and transform to WGS84 if needed
        try:
            import rasterio
            with rasterio.open(chm_path) as src:
                if src.crs and not src.crs.is_geographic:
                    trees = transform_trees_to_wgs84(trees, str(src.crs))
        except Exception as e:
            logger.warning(f"Failed to transform coordinates: {e}")

    # Terrain analysis
    if processing_type in ['TERRAIN_ANALYSIS', 'FULL']:
        logger.info("Analyzing terrain...")
        terrain = analyze_terrain(dtm_path, params)

    # Calculate summary statistics
    tree_count = len(trees)
    trees_per_acre = tree_count / field_acres if field_acres > 0 else None

    heights = [t.height_m for t in trees]
    avg_height = np.mean(heights) if heights else None
    max_height = max(heights) if heights else None
    min_height = min(heights) if heights else None

    diameters = [t.canopy_diameter_m for t in trees if t.canopy_diameter_m]
    avg_diameter = np.mean(diameters) if diameters else None

    # Calculate canopy coverage
    total_canopy_area = sum(t.canopy_area_sqm or 0 for t in trees)
    field_area_sqm = field_acres * 4046.86
    canopy_coverage = (total_canopy_area / field_area_sqm * 100) if field_area_sqm > 0 else None

    processing_time = time.perf_counter() - start_time

    return LiDARProcessingResult(
        trees=[asdict(t) for t in trees],
        tree_count=tree_count,
        trees_per_acre=trees_per_acre,
        avg_tree_height_m=float(avg_height) if avg_height else None,
        max_tree_height_m=float(max_height) if max_height else None,
        min_tree_height_m=float(min_height) if min_height else None,
        avg_canopy_diameter_m=float(avg_diameter) if avg_diameter else None,
        canopy_coverage_percent=float(canopy_coverage) if canopy_coverage else None,
        terrain=terrain,
        dtm_path=dtm_path,
        dsm_path=dsm_path,
        chm_path=chm_path,
        field_area_acres=field_acres,
        processing_time_seconds=processing_time,
    )


def calculate_field_area_acres(boundary_geojson: Optional[Dict]) -> Optional[float]:
    """
    Calculate field area in acres from GeoJSON boundary.

    Args:
        boundary_geojson: GeoJSON polygon dictionary

    Returns:
        Area in acres or None
    """
    if not boundary_geojson:
        return None

    try:
        from shapely.geometry import shape
        from shapely.ops import transform as shapely_transform

        geom = shape(boundary_geojson)

        # If coordinates are in degrees, convert to approximate square meters
        coords = boundary_geojson.get('coordinates', [[]])[0]
        if coords:
            avg_lat = sum(c[1] for c in coords) / len(coords)
            lat_m = 111000
            lon_m = 111000 * np.cos(np.radians(avg_lat))

            def scale_to_meters(x, y):
                return x * lon_m, y * lat_m

            geom_m = shapely_transform(scale_to_meters, geom)
            area_m2 = geom_m.area

            return area_m2 / 4046.86
    except Exception as e:
        logger.warning(f"Failed to calculate field area: {e}")

    return None
