"""
YOLO-based tree detection service using DeepForest.

Processes GeoTIFF imagery uploaded via TreeSurvey to detect individual
tree crowns using DeepForest's pre-trained model (built on RetinaNet/YOLO
architecture trained on NEON aerial data). Computes per-tree NDVI health
scores when NIR band is available.

Pipeline:
1. Load GeoTIFF and extract geospatial metadata (CRS, bounds, resolution)
2. Extract RGB bands for DeepForest input
3. Optionally clip detections to field boundary polygon
4. Run DeepForest predict_tile with configurable patch size/overlap
5. Convert pixel bounding boxes to WGS84 lat/lon via affine transform
6. Calculate canopy diameter from bbox width * ground resolution
7. If multispectral (has NIR): compute per-tree NDVI stats from NIR+Red
8. Assign health category based on mean NDVI thresholds
9. Bulk-create DetectedTree records and update survey summary
"""

import logging
import os
import tempfile
import time
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

# Guard DeepForest import — it is a heavy optional dependency
try:
    from deepforest import main as deepforest_main
    DEEPFOREST_AVAILABLE = True
except ImportError:
    DEEPFOREST_AVAILABLE = False
    logger.warning(
        "deepforest is not installed. Tree detection via YOLO/DeepForest "
        "will not be available. Install with: pip install deepforest"
    )


# ---------------------------------------------------------------------------
# Health classification
# ---------------------------------------------------------------------------

def classify_health(ndvi_mean: Optional[float]) -> str:
    """
    Return a health category string from an NDVI value.

    Thresholds (standard remote-sensing ranges for tree canopy):
        > 0.6  -> healthy
        0.4-0.6 -> moderate
        0.2-0.4 -> stressed
        <= 0.2  -> critical

    If *ndvi_mean* is None the tree has no NIR data and we return 'unknown'.
    """
    if ndvi_mean is None:
        return "unknown"
    if ndvi_mean > 0.6:
        return "healthy"
    if ndvi_mean > 0.4:
        return "moderate"
    if ndvi_mean > 0.2:
        return "stressed"
    return "critical"


# ---------------------------------------------------------------------------
# GeoTIFF metadata extraction
# ---------------------------------------------------------------------------

def extract_geotiff_metadata(file_path: str) -> Dict[str, Any]:
    """
    Extract geospatial metadata from a GeoTIFF for storage on TreeSurvey.

    Uses rasterio to read:
        - CRS (coordinate reference system)
        - Geographic bounds (west, east, south, north)
        - Ground sample distance (resolution in metres)
        - Band count and whether NIR is present (band >= 4)

    Args:
        file_path: Absolute path to a GeoTIFF file.

    Returns:
        Dict with keys: crs, bounds_west, bounds_east, bounds_south,
        bounds_north, resolution_m, band_count, has_nir, file_size_mb.
    """
    import rasterio

    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)

    with rasterio.open(file_path) as src:
        bounds = src.bounds
        transform = src.transform

        # Resolution in native CRS units
        res_x = abs(transform.a)
        res_y = abs(transform.e)

        # Convert to metres if CRS is geographic (degrees)
        if src.crs and src.crs.is_geographic:
            mid_lat = (bounds.top + bounds.bottom) / 2.0
            lat_m = 111_000.0
            lon_m = 111_000.0 * np.cos(np.radians(mid_lat))
            resolution_m = (res_x * lon_m + res_y * lat_m) / 2.0
        else:
            resolution_m = (res_x + res_y) / 2.0

        band_count = src.count
        has_nir = band_count >= 4

        return {
            "crs": str(src.crs) if src.crs else "EPSG:4326",
            "bounds_west": bounds.left,
            "bounds_east": bounds.right,
            "bounds_south": bounds.bottom,
            "bounds_north": bounds.top,
            "resolution_m": resolution_m,
            "band_count": band_count,
            "has_nir": has_nir,
            "file_size_mb": round(file_size_mb, 2),
        }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _pixel_to_latlon(row: int, col: int, transform, src_crs):
    """
    Convert pixel (row, col) to WGS-84 (latitude, longitude).

    Uses the rasterio affine *transform* to go from pixel to map
    coordinates, then reprojects to EPSG:4326 if the source CRS
    is projected.
    """
    # Pixel centre -> map coordinates in source CRS
    x_map, y_map = transform * (col + 0.5, row + 0.5)

    if src_crs is None or src_crs.is_geographic:
        # Already in lon/lat
        return y_map, x_map  # lat, lon

    # Reproject to WGS-84
    from pyproj import CRS, Transformer

    dst_crs = CRS.from_epsg(4326)
    transformer = Transformer.from_crs(
        CRS.from_user_input(src_crs), dst_crs, always_xy=True
    )
    lon, lat = transformer.transform(x_map, y_map)
    return lat, lon


def _prepare_rgb_image(file_path: str):
    """
    Read the GeoTIFF and return a uint8 RGB numpy array suitable for
    DeepForest, plus the rasterio dataset metadata needed later.

    DeepForest expects an (H, W, 3) uint8 BGR or RGB array. We read
    the first three bands and assume they are in R-G-B or B-G-R order
    (DeepForest is tolerant of both since its backbone was trained on
    natural images).

    If the raster has more than 8-bit depth we rescale to 0-255.

    Returns:
        (rgb_array, transform, crs, src_height, src_width, full_image)
        where *full_image* is the raw rasterio read (all bands, float32)
        needed for NDVI computation.
    """
    import rasterio

    with rasterio.open(file_path) as src:
        # Read all bands as float32 for later NDVI
        full_image = src.read().astype(np.float32)  # (bands, H, W)
        transform = src.transform
        crs = src.crs
        height = src.height
        width = src.width

    # Extract first 3 bands for RGB
    rgb = full_image[:3]  # (3, H, W)

    # Rescale to uint8 if needed
    band_max = rgb.max()
    if band_max <= 0:
        rgb_uint8 = np.zeros((height, width, 3), dtype=np.uint8)
    elif band_max <= 1.0:
        rgb_uint8 = (rgb * 255).clip(0, 255).astype(np.uint8)
        rgb_uint8 = np.transpose(rgb_uint8, (1, 2, 0))  # (H, W, 3)
    else:
        # Scale to 0-255
        rgb_scaled = (rgb / band_max * 255).clip(0, 255).astype(np.uint8)
        rgb_uint8 = np.transpose(rgb_scaled, (1, 2, 0))  # (H, W, 3)

    return rgb_uint8, transform, crs, height, width, full_image


def _compute_tree_ndvi(
    full_image: np.ndarray,
    xmin: int,
    ymin: int,
    xmax: int,
    ymax: int,
) -> Dict[str, Optional[float]]:
    """
    Compute NDVI statistics within a bounding box.

    Assumes band ordering: band 0 = Red (or Blue), band 2 = Red, band 3 = NIR.
    We use band index 2 for Red and band index 3 for NIR, matching the
    common B-G-R-NIR convention used by SkyWatch / Planet imagery and
    consistent with the existing tree_detection.py service.

    NDVI = (NIR - Red) / (NIR + Red + 1e-10)

    Returns dict with ndvi_mean, ndvi_min, ndvi_max (all float or None).
    """
    if full_image.shape[0] < 4:
        return {"ndvi_mean": None, "ndvi_min": None, "ndvi_max": None}

    # Clamp bbox to image bounds
    h, w = full_image.shape[1], full_image.shape[2]
    ymin_c = max(0, ymin)
    xmin_c = max(0, xmin)
    ymax_c = min(h, ymax)
    xmax_c = min(w, xmax)

    if ymax_c <= ymin_c or xmax_c <= xmin_c:
        return {"ndvi_mean": None, "ndvi_min": None, "ndvi_max": None}

    red = full_image[2, ymin_c:ymax_c, xmin_c:xmax_c]
    nir = full_image[3, ymin_c:ymax_c, xmin_c:xmax_c]

    ndvi = (nir - red) / (nir + red + 1e-10)

    # Mask out invalid pixels (both bands zero)
    valid = (nir + red) > 0
    if not np.any(valid):
        return {"ndvi_mean": None, "ndvi_min": None, "ndvi_max": None}

    ndvi_valid = ndvi[valid]
    return {
        "ndvi_mean": float(np.mean(ndvi_valid)),
        "ndvi_min": float(np.min(ndvi_valid)),
        "ndvi_max": float(np.max(ndvi_valid)),
    }


def _filter_detections_to_boundary(
    detections_df,
    transform,
    src_crs,
    boundary_geojson: Dict,
):
    """
    Remove detections whose centre falls outside the field boundary.

    *boundary_geojson* is expected in WGS-84 (EPSG:4326). We convert
    each detection centre to WGS-84 and test containment.

    Returns a filtered copy of the DataFrame.
    """
    from shapely.geometry import Point, shape

    boundary = shape(boundary_geojson)

    keep = []
    for idx, row in detections_df.iterrows():
        cx = int((row["xmin"] + row["xmax"]) / 2)
        cy = int((row["ymin"] + row["ymax"]) / 2)
        lat, lon = _pixel_to_latlon(cy, cx, transform, src_crs)
        if boundary.contains(Point(lon, lat)):
            keep.append(idx)

    logger.info(
        "Boundary filter: kept %d of %d detections",
        len(keep),
        len(detections_df),
    )
    return detections_df.loc[keep].reset_index(drop=True)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_tree_detection(survey_id: int) -> None:
    """
    Run DeepForest tree detection on a TreeSurvey image.

    This is the main entry point called (typically asynchronously) after a
    GeoTIFF has been uploaded. It:

    1. Marks the survey as 'processing'.
    2. Reads the GeoTIFF and extracts an RGB array for DeepForest.
    3. Optionally clips detections to the associated field boundary.
    4. Runs ``deepforest.main.deepforest().predict_tile()``.
    5. Converts pixel bboxes to lat/lon; computes canopy diameter.
    6. If the image has a NIR band, computes per-tree NDVI and health.
    7. Bulk-creates ``DetectedTree`` records.
    8. Updates the survey summary fields and sets status='completed'.

    On any unhandled exception the survey is marked 'failed' with the
    error message stored for debugging.

    Args:
        survey_id: Primary key of the ``TreeSurvey`` to process.
    """
    if not DEEPFOREST_AVAILABLE:
        raise RuntimeError(
            "deepforest is not installed. "
            "Install with: pip install deepforest"
        )

    # Late imports so the module can be loaded without Django configured
    # (e.g. for unit tests that mock the models).
    from django.utils import timezone

    from api.models.tree_detection import DetectedTree, TreeSurvey

    survey = TreeSurvey.objects.select_related("field").get(pk=survey_id)

    # ---- Mark as processing ------------------------------------------------
    survey.status = "processing"
    survey.error_message = ""
    survey.save(update_fields=["status", "error_message"])
    logger.info("Starting YOLO/DeepForest detection for survey %s", survey_id)

    t_start = time.perf_counter()

    try:
        # ---- Load image ----------------------------------------------------
        file_path = survey.image_file.path
        logger.info("Loading GeoTIFF: %s", file_path)

        rgb_array, transform, src_crs, img_h, img_w, full_image = (
            _prepare_rgb_image(file_path)
        )

        has_nir = full_image.shape[0] >= 4
        resolution_m = survey.resolution_m
        if resolution_m is None or resolution_m <= 0:
            # Fallback: compute from transform
            meta = extract_geotiff_metadata(file_path)
            resolution_m = meta["resolution_m"]

        logger.info(
            "Image: %dx%d, %d bands, resolution=%.3fm, has_nir=%s",
            img_w, img_h, full_image.shape[0], resolution_m, has_nir,
        )

        # ---- Write RGB to a temp file for DeepForest -----------------------
        # DeepForest's predict_tile expects a file path to a raster.
        # We write the uint8 RGB to a temporary GeoTIFF so the spatial
        # reference is preserved for tiled reading.
        import rasterio
        from rasterio.transform import from_bounds

        tmp_dir = tempfile.mkdtemp(prefix="yolo_tree_")
        tmp_rgb_path = os.path.join(tmp_dir, "rgb_for_deepforest.tif")

        # Transpose back to (3, H, W) for rasterio write
        rgb_bands = np.transpose(rgb_array, (2, 0, 1))  # (3, H, W)

        with rasterio.open(
            tmp_rgb_path,
            "w",
            driver="GTiff",
            height=img_h,
            width=img_w,
            count=3,
            dtype="uint8",
            crs=src_crs,
            transform=transform,
        ) as dst:
            dst.write(rgb_bands)

        logger.info("Wrote temporary RGB raster: %s", tmp_rgb_path)

        # ---- Run DeepForest ------------------------------------------------
        patch_size = survey.detection_params.get("patch_size", 200)
        patch_overlap = survey.detection_params.get("patch_overlap", 0.6)
        iou_threshold = survey.detection_params.get("iou_threshold", 0.5)
        score_thresh = survey.detection_params.get("score_thresh", 0.05)

        model = deepforest_main.deepforest()
        model.use_release()  # Load pre-trained weights

        # Override the score threshold if provided
        if score_thresh:
            model.config["score_thresh"] = score_thresh

        logger.info(
            "Running DeepForest predict_tile (patch_size=%d, overlap=%.2f)",
            patch_size, patch_overlap,
        )

        detections = model.predict_tile(
            raster_path=tmp_rgb_path,
            patch_size=patch_size,
            patch_overlap=patch_overlap,
            iou_threshold=iou_threshold,
            return_plot=False,
        )

        # Clean up temp file
        try:
            os.remove(tmp_rgb_path)
            os.rmdir(tmp_dir)
        except OSError:
            pass

        if detections is None or len(detections) == 0:
            logger.info("DeepForest returned no detections for survey %s", survey_id)
            survey.status = "completed"
            survey.tree_count = 0
            survey.trees_per_acre = 0
            survey.avg_confidence = None
            survey.avg_ndvi = None
            survey.canopy_coverage_percent = 0
            survey.processing_time_seconds = time.perf_counter() - t_start
            survey.completed_at = timezone.now()
            survey.save()
            return

        logger.info("DeepForest raw detections: %d", len(detections))

        # ---- Clip to field boundary if available ---------------------------
        field = survey.field
        boundary_geojson = getattr(field, "boundary_geojson", None)

        if boundary_geojson:
            detections = _filter_detections_to_boundary(
                detections, transform, src_crs, boundary_geojson
            )

        if len(detections) == 0:
            logger.info(
                "All detections fell outside field boundary for survey %s",
                survey_id,
            )
            survey.status = "completed"
            survey.tree_count = 0
            survey.trees_per_acre = 0
            survey.avg_confidence = None
            survey.avg_ndvi = None
            survey.canopy_coverage_percent = 0
            survey.processing_time_seconds = time.perf_counter() - t_start
            survey.completed_at = timezone.now()
            survey.save()
            return

        # ---- Build DetectedTree objects ------------------------------------
        tree_objects: List[DetectedTree] = []
        ndvi_values: List[float] = []
        total_canopy_area_m2 = 0.0

        for _, row in detections.iterrows():
            xmin = int(row["xmin"])
            ymin = int(row["ymin"])
            xmax = int(row["xmax"])
            ymax = int(row["ymax"])
            confidence = float(row["score"])

            # Centre pixel
            cx = int((xmin + xmax) / 2)
            cy = int((ymin + ymax) / 2)

            # Convert to lat/lon
            lat, lon = _pixel_to_latlon(cy, cx, transform, src_crs)

            # Canopy diameter from bbox width (use the larger dimension)
            bbox_w_px = xmax - xmin
            bbox_h_px = ymax - ymin
            canopy_diameter_m = max(bbox_w_px, bbox_h_px) * resolution_m

            # Canopy area (approximate as circle)
            canopy_radius_m = canopy_diameter_m / 2.0
            canopy_area_m2 = np.pi * canopy_radius_m ** 2
            total_canopy_area_m2 += canopy_area_m2

            # NDVI if NIR available
            ndvi_stats = {"ndvi_mean": None, "ndvi_min": None, "ndvi_max": None}
            health = "unknown"
            if has_nir:
                ndvi_stats = _compute_tree_ndvi(full_image, xmin, ymin, xmax, ymax)
                health = classify_health(ndvi_stats["ndvi_mean"])
                if ndvi_stats["ndvi_mean"] is not None:
                    ndvi_values.append(ndvi_stats["ndvi_mean"])

            tree_objects.append(
                DetectedTree(
                    survey=survey,
                    latitude=lat,
                    longitude=lon,
                    bbox_x_min=xmin,
                    bbox_y_min=ymin,
                    bbox_x_max=xmax,
                    bbox_y_max=ymax,
                    confidence=confidence,
                    canopy_diameter_m=canopy_diameter_m,
                    ndvi_mean=ndvi_stats["ndvi_mean"],
                    ndvi_min=ndvi_stats["ndvi_min"],
                    ndvi_max=ndvi_stats["ndvi_max"],
                    health_category=health,
                )
            )

        # ---- Bulk create ----------------------------------------------------
        DetectedTree.objects.filter(survey=survey).delete()
        DetectedTree.objects.bulk_create(tree_objects, batch_size=500)
        logger.info("Created %d DetectedTree records", len(tree_objects))

        # ---- Update survey summary -----------------------------------------
        tree_count = len(tree_objects)
        avg_confidence = float(np.mean([t.confidence for t in tree_objects]))

        # Trees per acre
        field_acres = float(getattr(field, "total_acres", 0) or 0)
        if field_acres and field_acres > 0:
            trees_per_acre = tree_count / field_acres
        else:
            trees_per_acre = None

        # Average NDVI
        avg_ndvi = float(np.mean(ndvi_values)) if ndvi_values else None

        # Canopy coverage percent
        canopy_coverage_percent = None
        if field_acres and field_acres > 0:
            field_area_m2 = field_acres * 4046.86  # 1 acre = 4046.86 m^2
            canopy_coverage_percent = min(
                (total_canopy_area_m2 / field_area_m2) * 100.0, 100.0
            )

        processing_time = time.perf_counter() - t_start

        survey.status = "completed"
        survey.tree_count = tree_count
        survey.trees_per_acre = trees_per_acre
        survey.avg_confidence = round(avg_confidence, 4)
        survey.avg_ndvi = round(avg_ndvi, 4) if avg_ndvi is not None else None
        survey.canopy_coverage_percent = (
            round(canopy_coverage_percent, 2) if canopy_coverage_percent is not None else None
        )
        survey.processing_time_seconds = round(processing_time, 2)
        survey.completed_at = timezone.now()
        survey.save()

        logger.info(
            "Survey %s completed: %d trees, %.1f trees/acre, "
            "avg_conf=%.3f, avg_ndvi=%s, canopy=%.1f%%, %.1fs",
            survey_id,
            tree_count,
            trees_per_acre or 0,
            avg_confidence,
            f"{avg_ndvi:.3f}" if avg_ndvi is not None else "N/A",
            canopy_coverage_percent or 0,
            processing_time,
        )

    except Exception:
        # ---- Failure path ---------------------------------------------------
        import traceback

        error_msg = traceback.format_exc()
        logger.exception("Tree detection failed for survey %s", survey_id)

        survey.status = "failed"
        survey.error_message = error_msg[-2000:]  # Truncate to fit TextField
        survey.processing_time_seconds = round(time.perf_counter() - t_start, 2)
        survey.save(update_fields=["status", "error_message", "processing_time_seconds"])
