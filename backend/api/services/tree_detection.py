"""
Tree detection service for processing satellite imagery.

Algorithm Overview:
1. Load GeoTIFF and extract metadata (resolution, CRS, bounds)
2. Windowed read with tiling + overlap (memory-safe)
3. Clip to field boundary per tile if provided
4. Calculate vegetation index (NDVI if NIR available, else ExG)
5. Apply Gaussian smoothing to create peaks at canopy centers
6. Find blobs (DoG) with minimum tree spacing constraint
7. De-duplicate across tile boundaries
8. Convert pixel coordinates to lat/lon
9. Calculate canopy metrics (coverage, average diameter)
10. Return results for storage

Supported imagery:
- 3-band RGB (uses Excess Green index)
- 4-band BGRN (uses NDVI - preferred)
"""

import numpy as np
from scipy import ndimage
from skimage import feature
from typing import Tuple, List, Optional, Dict, Any
from dataclasses import dataclass, asdict
import logging

logger = logging.getLogger(__name__)


@dataclass
class DetectionParams:
    """Parameters for tree detection algorithm."""
    min_canopy_diameter_m: float = 3.0  # Minimum expected canopy diameter
    max_canopy_diameter_m: float = 8.0  # Maximum expected canopy diameter
    min_tree_spacing_m: float = 4.0     # Allow closer spacing to detect more trees
    # Tiling and smoothing
    tile_size_px: int = 2048
    tile_overlap_px: int = 128
    gaussian_sigma_px: float = 1.0
    blob_threshold: float = 0.05
    blob_overlap: float = 0.5
    # Shadow rejection parameters
    min_brightness_percentile: float = 5.0
    shadow_ndvi_max: float = 0.3
    min_nir_brightness: float = 0.03


def build_detection_params(field: Any, overrides: Optional[Dict[str, Any]] = None) -> DetectionParams:
    """
    Build detection params with field-specific defaults.

    If tree spacing is known, use it to infer canopy size and minimum spacing.
    Overrides always take precedence.
    """
    params = DetectionParams()

    spacing_ft = getattr(field, 'tree_spacing_ft', None)
    if spacing_ft:
        try:
            spacing_m = float(spacing_ft) * 0.3048
            params.min_tree_spacing_m = max(2.0, spacing_m * 0.85)
            params.min_canopy_diameter_m = max(2.0, spacing_m * 0.5)
            params.max_canopy_diameter_m = max(
                params.min_canopy_diameter_m + 1.0,
                spacing_m * 0.85
            )
        except (TypeError, ValueError):
            pass

    if overrides:
        from dataclasses import fields as dataclass_fields
        valid_fields = {f.name for f in dataclass_fields(DetectionParams)}
        for key, value in overrides.items():
            if key in valid_fields:
                setattr(params, key, value)

    return params


@dataclass
class DetectedTreeData:
    """Data for a single detected tree."""
    pixel_x: int
    pixel_y: int
    longitude: float
    latitude: float
    ndvi_value: float
    confidence_score: float
    canopy_diameter_m: Optional[float] = None


@dataclass
class DetectionResult:
    """Results from tree detection."""
    trees: List[Dict[str, Any]]
    tree_count: int
    trees_per_acre: Optional[float]
    avg_canopy_diameter_m: Optional[float]
    canopy_coverage_percent: Optional[float]
    vegetation_index: str
    resolution_m: float
    field_area_acres: Optional[float]


def calculate_ndvi(image: np.ndarray) -> np.ndarray:
    """
    Calculate NDVI from 4-band image (B,G,R,NIR order - SkyWatch standard).

    NDVI = (NIR - Red) / (NIR + Red)

    Args:
        image: 4-band numpy array with shape (4, height, width)

    Returns:
        NDVI array normalized to 0-1 range
    """
    red = image[2].astype(np.float32)
    nir = image[3].astype(np.float32)

    # Avoid division by zero
    denominator = nir + red
    denominator[denominator == 0] = 1

    ndvi = (nir - red) / denominator

    # Normalize from [-1, 1] to [0, 1] range
    ndvi_normalized = np.clip((ndvi + 1) / 2, 0, 1)

    return ndvi_normalized


def calculate_excess_green(image: np.ndarray) -> np.ndarray:
    """
    Calculate Excess Green (ExG) index from RGB image.

    ExG = 2*Green - Red - Blue

    Used when NIR band is not available.

    Args:
        image: 3 or 4-band numpy array (Blue, Green, Red, [NIR])

    Returns:
        ExG array normalized to 0-1 range
    """
    blue = image[0].astype(np.float32)
    green = image[1].astype(np.float32)
    red = image[2].astype(np.float32)

    # Normalize to 0-1 range
    max_val = max(red.max(), green.max(), blue.max())
    if max_val > 1:
        red = red / max_val
        green = green / max_val
        blue = blue / max_val

    # Calculate ExG
    exg = 2 * green - red - blue

    # Normalize to 0-1 range
    exg_min, exg_max = exg.min(), exg.max()
    if exg_max > exg_min:
        exg_normalized = (exg - exg_min) / (exg_max - exg_min)
    else:
        exg_normalized = np.zeros_like(exg)

    return exg_normalized


def create_shadow_mask(image: np.ndarray, params: DetectionParams) -> np.ndarray:
    """
    Create a simplified mask to exclude only obvious shadow pixels.

    Uses permissive OR logic to avoid over-filtering. A pixel is valid if:
    - It has reasonable brightness, OR
    - It has reasonable NIR reflectance (if available)

    Args:
        image: Multi-band numpy array (B, G, R, [NIR])
        params: Detection parameters with shadow thresholds

    Returns:
        Boolean mask where True = valid (not shadow), False = shadow
    """
    blue = image[0].astype(np.float32)
    green = image[1].astype(np.float32)
    red = image[2].astype(np.float32)

    # Normalize bands
    max_val = max(red.max(), green.max(), blue.max(), 1)
    if max_val > 1:
        blue = blue / max_val
        green = green / max_val
        red = red / max_val

    # Calculate brightness (average of RGB)
    brightness = (red + green + blue) / 3

    # Only reject the very darkest pixels (bottom 5%)
    non_zero_brightness = brightness[brightness > 0]
    if len(non_zero_brightness) == 0:
        logger.warning("No valid brightness pixels found")
        return np.ones(brightness.shape, dtype=bool)

    brightness_threshold = np.percentile(non_zero_brightness, params.min_brightness_percentile)
    bright_enough = brightness > brightness_threshold

    # If NIR available, use permissive OR logic
    has_nir = image.shape[0] >= 4
    if has_nir:
        nir = image[3].astype(np.float32)
        nir_max = nir.max() if nir.max() > 0 else 1
        if nir_max > 1:
            nir = nir / nir_max

        # Pixel is valid if it has decent NIR (vegetation reflects NIR)
        has_nir_signal = nir > params.min_nir_brightness

        # OR logic: valid if bright enough OR has NIR signal
        # This ensures we don't reject vegetation in shadows
        valid_mask = bright_enough | has_nir_signal

        rejected = np.sum(~valid_mask)
        total = valid_mask.size
        logger.info(f"Shadow mask: {rejected} pixels rejected ({100*rejected/total:.1f}%)")
    else:
        # Without NIR, rely only on brightness
        valid_mask = bright_enough
        rejected = np.sum(~valid_mask)
        total = valid_mask.size
        logger.info(f"Shadow mask (RGB only): {rejected} pixels rejected ({100*rejected/total:.1f}%)")

    return valid_mask


def calculate_local_contrast(veg_index: np.ndarray, window_size: int = 5) -> np.ndarray:
    """
    Calculate local contrast - trees should have high contrast with surroundings.

    This helps distinguish actual tree canopies from flat shadowed areas.
    """
    from scipy.ndimage import uniform_filter

    # Local mean
    local_mean = uniform_filter(veg_index, size=window_size)

    # Local standard deviation (measure of contrast)
    local_sq_mean = uniform_filter(veg_index ** 2, size=window_size)
    local_std = np.sqrt(np.maximum(local_sq_mean - local_mean ** 2, 0))

    return local_std


def calculate_resolution_meters(transform, crs, bounds=None) -> float:
    """
    Calculate ground resolution in meters from rasterio transform and CRS.

    Args:
        transform: Affine transform from rasterio
        crs: CRS object from rasterio

    Returns:
        Resolution in meters
    """
    resolution_x = abs(transform.a)
    resolution_y = abs(transform.e)

    # If geographic CRS (degrees), convert to meters
    if crs and crs.is_geographic:
        # Use approximate conversion based on latitude
        # 1 degree latitude ≈ 111km
        # 1 degree longitude ≈ 111km * cos(latitude)
        if bounds is not None:
            mid_lat = (bounds.top + bounds.bottom) / 2
        else:
            mid_lat = 34.45  # Default for California citrus region
        lat_to_m = 111000
        lon_to_m = 111000 * np.cos(np.radians(mid_lat))
        return (resolution_x * lon_to_m + resolution_y * lat_to_m) / 2

    # Assume already in meters
    return (resolution_x + resolution_y) / 2


def reproject_trees_to_wgs84(
    trees: List[DetectedTreeData],
    source_crs
) -> List[DetectedTreeData]:
    """
    Reproject tree coordinates to WGS84 if source CRS is projected.

    Args:
        trees: Detected trees with coordinates in source CRS
        source_crs: Rasterio CRS or CRS string

    Returns:
        Trees with longitude/latitude in WGS84
    """
    if not trees or not source_crs:
        return trees

    try:
        from pyproj import CRS, Transformer

        if hasattr(source_crs, 'is_geographic'):
            if source_crs.is_geographic:
                return trees
            src_crs = source_crs
        else:
            src_crs = CRS.from_user_input(source_crs)
            if src_crs.is_geographic:
                return trees

        dst_crs = CRS.from_epsg(4326)
        transformer = Transformer.from_crs(src_crs, dst_crs, always_xy=True)

        for tree in trees:
            lon, lat = transformer.transform(tree.longitude, tree.latitude)
            tree.longitude = float(lon)
            tree.latitude = float(lat)

        return trees
    except Exception as exc:
        logger.warning(f"Failed to reproject tree coordinates to WGS84: {exc}")
        return trees


def find_trees_blob_detection(
    veg_index: np.ndarray,
    resolution_m: float,
    params: DetectionParams,
    transform,
    valid_mask: np.ndarray = None
) -> List[DetectedTreeData]:
    """
    Detect trees using blob detection (Difference of Gaussian).

    Blob detection finds circular structures of a specified size range,
    which is ideal for detecting tree canopies regardless of their
    absolute vegetation index value.

    Args:
        veg_index: 2D vegetation index array
        resolution_m: Ground resolution in meters per pixel
        params: Detection parameters
        transform: Affine transform for coordinate conversion
        valid_mask: Boolean mask where True = valid pixel (not shadow/edge)

    Returns:
        List of detected tree data
    """
    from skimage.feature import blob_dog

    # Calculate sigma range based on expected canopy size
    # blob_radius ≈ sigma * sqrt(2), so sigma ≈ radius / 1.414
    min_radius_pixels = (params.min_canopy_diameter_m / 2) / resolution_m
    max_radius_pixels = (params.max_canopy_diameter_m / 2) / resolution_m

    min_sigma = max(min_radius_pixels / 1.414, 1.0)
    max_sigma = max_radius_pixels / 1.414

    logger.info(f"Blob detection: diameter {params.min_canopy_diameter_m}-{params.max_canopy_diameter_m}m "
                f"= radius {min_radius_pixels:.1f}-{max_radius_pixels:.1f}px "
                f"= sigma {min_sigma:.1f}-{max_sigma:.1f}")

    # Normalize image to 0-1 for blob detection
    img_min, img_max = veg_index.min(), veg_index.max()
    if img_max > img_min:
        img_normalized = (veg_index - img_min) / (img_max - img_min)
    else:
        logger.warning("Vegetation index has no variation")
        return []

    # Run blob detection (Difference of Gaussian)
    # threshold controls sensitivity - lower = more blobs detected
    try:
        blobs = blob_dog(
            img_normalized,
            min_sigma=min_sigma,
            max_sigma=max_sigma,
            sigma_ratio=1.6,
            threshold=params.blob_threshold,  # Tuned value: lower = more trees, higher = fewer trees
            overlap=params.blob_overlap
        )
        logger.info(f"blob_dog found {len(blobs)} blobs")
    except Exception as e:
        logger.warning(f"blob_dog failed: {e}")
        blobs = np.array([])

    if len(blobs) == 0:
        return []

    # Convert blobs to tree records
    # blobs format: (y, x, sigma) where radius = sigma * sqrt(2)
    trees = []
    rejected_shadow = 0
    rejected_bounds = 0

    for blob in blobs:
        row, col, sigma = blob
        row, col = int(row), int(col)

        # Skip if out of bounds
        if row < 0 or row >= veg_index.shape[0] or col < 0 or col >= veg_index.shape[1]:
            rejected_bounds += 1
            continue

        # Skip if in shadow/invalid area
        if valid_mask is not None and not valid_mask[row, col]:
            rejected_shadow += 1
            continue

        # Get vegetation value at blob center
        veg_value = veg_index[row, col]

        # Convert pixel to geographic coordinates
        lon, lat = transform * (col, row)

        # Calculate canopy diameter from sigma
        radius_pixels = sigma * 1.414
        canopy_diameter_m = radius_pixels * 2 * resolution_m

        # Confidence based on blob strength (larger sigma response = more confident)
        confidence = min(0.5 + (sigma / max_sigma) * 0.5, 1.0)

        trees.append(DetectedTreeData(
            pixel_x=col,
            pixel_y=row,
            longitude=float(lon),
            latitude=float(lat),
            ndvi_value=float(veg_value),
            confidence_score=float(confidence),
            canopy_diameter_m=float(canopy_diameter_m)
        ))

    logger.info(f"Blob detection result: {len(trees)} trees "
                f"({rejected_shadow} shadow, {rejected_bounds} bounds)")
    return trees


def find_tree_peaks(
    veg_index: np.ndarray,
    resolution_m: float,
    params: DetectionParams,
    transform,
    valid_mask: np.ndarray = None
) -> List[DetectedTreeData]:
    """
    Find trees using blob detection as primary method.

    This is a wrapper that calls the blob detection algorithm,
    which is more robust than simple peak detection for finding
    circular tree canopies.
    """
    return find_trees_blob_detection(
        veg_index, resolution_m, params, transform, valid_mask
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
        geom = shape(boundary_geojson)

        # If coordinates are in degrees, convert to approximate square meters
        # using a local projection approximation
        coords = boundary_geojson.get('coordinates', [[]])[0]
        if coords:
            avg_lat = sum(c[1] for c in coords) / len(coords)
            # Approximate conversion
            lat_m = 111000  # meters per degree latitude
            lon_m = 111000 * np.cos(np.radians(avg_lat))

            # Scale the geometry to meters
            from shapely.ops import transform as shapely_transform
            from shapely import affinity

            # Simple scaling (not a true projection but reasonable for small areas)
            def scale_to_meters(x, y):
                return x * lon_m, y * lat_m

            geom_m = shapely_transform(scale_to_meters, geom)
            area_m2 = geom_m.area

            # Convert to acres (1 acre = 4046.86 m²)
            return area_m2 / 4046.86
    except Exception as e:
        logger.warning(f"Failed to calculate field area: {e}")

    return None


def calculate_canopy_metrics(
    trees: List[DetectedTreeData],
    field_area_acres: Optional[float],
    avg_canopy_diameter_m: float
) -> Dict[str, Optional[float]]:
    """
    Calculate summary metrics for detected trees.

    Args:
        trees: List of detected trees
        field_area_acres: Field area in acres
        avg_canopy_diameter_m: Average canopy diameter

    Returns:
        Dictionary with trees_per_acre, canopy_coverage_percent
    """
    tree_count = len(trees)

    # Trees per acre
    trees_per_acre = None
    if field_area_acres and field_area_acres > 0:
        trees_per_acre = tree_count / field_area_acres

    # Canopy coverage
    canopy_coverage_percent = None
    if field_area_acres and field_area_acres > 0 and avg_canopy_diameter_m:
        # Area of each canopy (assuming circular)
        canopy_radius_m = avg_canopy_diameter_m / 2
        canopy_area_m2 = np.pi * canopy_radius_m ** 2
        total_canopy_m2 = canopy_area_m2 * tree_count

        # Field area in m²
        field_area_m2 = field_area_acres * 4046.86

        canopy_coverage_percent = (total_canopy_m2 / field_area_m2) * 100
        canopy_coverage_percent = min(canopy_coverage_percent, 100)  # Cap at 100%

    return {
        'trees_per_acre': trees_per_acre,
        'canopy_coverage_percent': canopy_coverage_percent,
    }


def detect_trees(
    image_path: str,
    field_boundary_geojson: Optional[Dict] = None,
    params: Optional[DetectionParams] = None
) -> DetectionResult:
    """
    Main entry point: Detect trees in satellite imagery.

    Args:
        image_path: Path to GeoTIFF file
        field_boundary_geojson: Optional GeoJSON polygon to clip analysis
        params: Detection parameters (uses defaults if None)

    Returns:
        DetectionResult with trees and metrics
    """
    import time
    import rasterio
    from rasterio import windows
    from rasterio import features
    from rasterio.warp import transform_geom

    if params is None:
        params = DetectionParams()

    def normalize_geometry(geometry: Dict, src_crs):
        if not geometry:
            return None
        if not src_crs:
            return geometry
        try:
            return transform_geom('EPSG:4326', src_crs, geometry, precision=6)
        except Exception as exc:
            logger.warning(f"Failed to reproject geometry to {src_crs}: {exc}")
            return geometry

    def iter_windows(base_window: windows.Window, tile_size: int, overlap: int):
        step = max(tile_size - 2 * overlap, 1)
        row_start = int(base_window.row_off)
        col_start = int(base_window.col_off)
        row_stop = int(base_window.row_off + base_window.height)
        col_stop = int(base_window.col_off + base_window.width)

        for row in range(row_start, row_stop, step):
            for col in range(col_start, col_stop, step):
                height = min(tile_size, row_stop - row)
                width = min(tile_size, col_stop - col)
                yield windows.Window(col, row, width, height)

    def inner_bounds(window: windows.Window, base_window: windows.Window, overlap: int):
        left = int(window.col_off + (0 if window.col_off == base_window.col_off else overlap))
        top = int(window.row_off + (0 if window.row_off == base_window.row_off else overlap))
        right_edge = base_window.col_off + base_window.width
        bottom_edge = base_window.row_off + base_window.height
        right = int(window.col_off + window.width - (0 if window.col_off + window.width >= right_edge else overlap))
        bottom = int(window.row_off + window.height - (0 if window.row_off + window.height >= bottom_edge else overlap))
        return left, top, right, bottom

    def dedupe_trees(trees: List[DetectedTreeData], min_dist_px: float) -> List[DetectedTreeData]:
        if not trees or min_dist_px <= 0:
            return trees

        from scipy.spatial import cKDTree

        coords = np.array([[t.pixel_x, t.pixel_y] for t in trees], dtype=np.float32)
        scores = np.array([t.confidence_score for t in trees], dtype=np.float32)
        order = np.argsort(scores)[::-1]
        suppressed = np.zeros(len(trees), dtype=bool)
        tree = cKDTree(coords)
        keep_indices = []

        for idx in order:
            if suppressed[idx]:
                continue
            keep_indices.append(idx)
            neighbors = tree.query_ball_point(coords[idx], r=min_dist_px)
            for n_idx in neighbors:
                if n_idx != idx:
                    suppressed[n_idx] = True

        return [trees[i] for i in keep_indices]

    timings = {
        'io_seconds': 0.0,
        'compute_seconds': 0.0,
        'tile_count': 0,
    }
    t_start = time.perf_counter()

    with rasterio.open(image_path) as src:
        resolution_m = calculate_resolution_meters(src.transform, src.crs, bounds=src.bounds)
        logger.info(f"Image resolution: {resolution_m:.3f}m")

        geometry = normalize_geometry(field_boundary_geojson, src.crs)
        if geometry:
            bounds = features.bounds(geometry)
            base_window = windows.from_bounds(*bounds, transform=src.transform)
        else:
            base_window = windows.Window(0, 0, src.width, src.height)

        base_window = base_window.round_offsets().round_lengths()
        base_window = windows.intersection(base_window, windows.Window(0, 0, src.width, src.height))

        trees = []
        index_name = 'NDVI' if src.count >= 4 else 'ExG'
        logger.info(f"Using {index_name} (bands={src.count})")
        tile_count = 0

        for window in iter_windows(base_window, params.tile_size_px, params.tile_overlap_px):
            tile_count += 1
            window = windows.intersection(window, windows.Window(0, 0, src.width, src.height))
            window_transform = windows.transform(window, src.transform)

            io_start = time.perf_counter()
            image = src.read(window=window, masked=True)
            timings['io_seconds'] += time.perf_counter() - io_start
            nodata_mask = ~np.any(image.mask, axis=0)
            image = image.filled(0)

            compute_start = time.perf_counter()
            if geometry:
                geometry_mask = features.geometry_mask(
                    [geometry],
                    out_shape=(int(window.height), int(window.width)),
                    transform=window_transform,
                    invert=True
                )
            else:
                geometry_mask = np.ones((int(window.height), int(window.width)), dtype=bool)

            valid_mask = nodata_mask & geometry_mask
            if not np.any(valid_mask):
                timings['compute_seconds'] += time.perf_counter() - compute_start
                continue

            has_nir = image.shape[0] >= 4
            if has_nir:
                veg_index = calculate_ndvi(image)
                index_name = index_name or 'NDVI'
            else:
                veg_index = calculate_excess_green(image)
                index_name = index_name or 'ExG'

            if params.gaussian_sigma_px and params.gaussian_sigma_px > 0:
                veg_index = ndimage.gaussian_filter(veg_index, sigma=params.gaussian_sigma_px)

            shadow_mask = create_shadow_mask(image, params)
            valid_mask = valid_mask & shadow_mask

            if not np.any(valid_mask):
                timings['compute_seconds'] += time.perf_counter() - compute_start
                continue

            tile_trees = find_tree_peaks(veg_index, resolution_m, params, window_transform, valid_mask=valid_mask)
            timings['compute_seconds'] += time.perf_counter() - compute_start

            left, top, right, bottom = inner_bounds(window, base_window, params.tile_overlap_px)
            for tree in tile_trees:
                global_x = int(tree.pixel_x + window.col_off)
                global_y = int(tree.pixel_y + window.row_off)
                if global_x < left or global_x >= right or global_y < top or global_y >= bottom:
                    continue
                tree.pixel_x = global_x
                tree.pixel_y = global_y
                trees.append(tree)

        timings['tile_count'] = tile_count

        min_dist_px = params.min_tree_spacing_m / resolution_m if resolution_m > 0 else 0
        trees = dedupe_trees(trees, min_dist_px)
        logger.info(f"Detected {len(trees)} trees after de-duplication")

        trees = reproject_trees_to_wgs84(trees, src.crs)

        # Calculate field area
        field_area_acres = calculate_field_area_acres(field_boundary_geojson)

        # Calculate metrics
        avg_canopy = (params.min_canopy_diameter_m + params.max_canopy_diameter_m) / 2
        metrics = calculate_canopy_metrics(trees, field_area_acres, avg_canopy)

        # Convert trees to dictionaries
        tree_dicts = [asdict(t) for t in trees]

        timings['total_seconds'] = time.perf_counter() - t_start
        logger.info(f"Detection timings: {timings}")

        return DetectionResult(
            trees=tree_dicts,
            tree_count=len(trees),
            trees_per_acre=metrics['trees_per_acre'],
            avg_canopy_diameter_m=avg_canopy,
            canopy_coverage_percent=metrics['canopy_coverage_percent'],
            vegetation_index=index_name,
            resolution_m=resolution_m,
            field_area_acres=field_area_acres,
        )


def extract_geotiff_metadata(file_path: str) -> Dict[str, Any]:
    """
    Extract metadata from a GeoTIFF file for storage in SatelliteImage model.

    Args:
        file_path: Path to GeoTIFF file

    Returns:
        Dictionary with metadata fields
    """
    import rasterio
    import os

    with rasterio.open(file_path) as src:
        bounds = src.bounds
        resolution_m = calculate_resolution_meters(src.transform, src.crs, bounds=bounds)

        return {
            'file_size_mb': os.path.getsize(file_path) / (1024 * 1024),
            'resolution_m': resolution_m,
            'bands': src.count,
            'has_nir': src.count >= 4,
            'bounds_west': bounds.left,
            'bounds_east': bounds.right,
            'bounds_south': bounds.bottom,
            'bounds_north': bounds.top,
            'crs': str(src.crs) if src.crs else 'EPSG:4326',
            'width': src.width,
            'height': src.height,
            'dtype': str(src.dtypes[0]),
        }
