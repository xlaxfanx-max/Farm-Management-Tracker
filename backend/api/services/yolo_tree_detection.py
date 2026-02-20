"""
Claude Vision-based tree detection service.

Processes GeoTIFF imagery uploaded via TreeSurvey to detect individual
tree crowns using the Anthropic Claude API with vision capabilities.
Computes per-tree NDVI health scores when NIR band is available.

Pipeline:
1. Load GeoTIFF and extract geospatial metadata (CRS, bounds, resolution)
2. Tile the image into manageable chunks and convert to PNG for Claude
3. Send each tile to Claude Vision asking for tree crown locations
4. Convert pixel coordinates to WGS84 lat/lon via affine transform
5. Calculate canopy diameter from estimated crown size * ground resolution
6. If multispectral (has NIR): compute per-tree NDVI stats from NIR+Red
7. Assign health category based on mean NDVI thresholds
8. Bulk-create DetectedTree records and update survey summary
"""

import base64
import io
import json
import logging
import os
import re
import tempfile
import time
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)


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
    """
    import rasterio

    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)

    with rasterio.open(file_path) as src:
        bounds = src.bounds
        transform = src.transform

        res_x = abs(transform.a)
        res_y = abs(transform.e)

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
    """Convert pixel (row, col) to WGS-84 (latitude, longitude)."""
    x_map, y_map = transform * (col + 0.5, row + 0.5)

    if src_crs is None or src_crs.is_geographic:
        return y_map, x_map  # lat, lon

    from pyproj import CRS, Transformer

    dst_crs = CRS.from_epsg(4326)
    transformer = Transformer.from_crs(
        CRS.from_user_input(src_crs), dst_crs, always_xy=True
    )
    lon, lat = transformer.transform(x_map, y_map)
    return lat, lon


def _prepare_rgb_image(file_path: str):
    """
    Read the GeoTIFF and return a uint8 RGB numpy array,
    plus the rasterio dataset metadata needed later.

    Returns:
        (rgb_array, transform, crs, src_height, src_width, full_image)
    """
    import rasterio

    with rasterio.open(file_path) as src:
        full_image = src.read().astype(np.float32)  # (bands, H, W)
        transform = src.transform
        crs = src.crs
        height = src.height
        width = src.width

    rgb = full_image[:3]  # (3, H, W)

    band_max = rgb.max()
    if band_max <= 0:
        rgb_uint8 = np.zeros((height, width, 3), dtype=np.uint8)
    elif band_max <= 1.0:
        rgb_uint8 = (rgb * 255).clip(0, 255).astype(np.uint8)
        rgb_uint8 = np.transpose(rgb_uint8, (1, 2, 0))  # (H, W, 3)
    else:
        rgb_scaled = (rgb / band_max * 255).clip(0, 255).astype(np.uint8)
        rgb_uint8 = np.transpose(rgb_scaled, (1, 2, 0))  # (H, W, 3)

    return rgb_uint8, transform, crs, height, width, full_image


def _compute_tree_ndvi(
    full_image: np.ndarray,
    cx: int,
    cy: int,
    radius_px: int = 10,
) -> Dict[str, Optional[float]]:
    """
    Compute NDVI statistics in a circular region around a tree centre.

    Uses band index 2 for Red and band index 3 for NIR (B-G-R-NIR convention).
    """
    if full_image.shape[0] < 4:
        return {"ndvi_mean": None, "ndvi_min": None, "ndvi_max": None}

    h, w = full_image.shape[1], full_image.shape[2]
    ymin = max(0, cy - radius_px)
    xmin = max(0, cx - radius_px)
    ymax = min(h, cy + radius_px)
    xmax = min(w, cx + radius_px)

    if ymax <= ymin or xmax <= xmin:
        return {"ndvi_mean": None, "ndvi_min": None, "ndvi_max": None}

    red = full_image[2, ymin:ymax, xmin:xmax]
    nir = full_image[3, ymin:ymax, xmin:xmax]

    ndvi = (nir - red) / (nir + red + 1e-10)

    valid = (nir + red) > 0
    if not np.any(valid):
        return {"ndvi_mean": None, "ndvi_min": None, "ndvi_max": None}

    ndvi_valid = ndvi[valid]
    return {
        "ndvi_mean": float(np.mean(ndvi_valid)),
        "ndvi_min": float(np.min(ndvi_valid)),
        "ndvi_max": float(np.max(ndvi_valid)),
    }


def _tile_image_to_pngs(rgb_array: np.ndarray, tile_size: int = 1024, overlap: int = 64):
    """
    Split a large RGB image into overlapping tiles and encode each as PNG.

    Returns list of dicts: {x_offset, y_offset, width, height, png_b64}
    """
    from PIL import Image

    h, w = rgb_array.shape[:2]
    tiles = []
    step = tile_size - overlap

    y = 0
    while y < h:
        x = 0
        tile_h = min(tile_size, h - y)
        while x < w:
            tile_w = min(tile_size, w - x)
            tile_arr = rgb_array[y:y + tile_h, x:x + tile_w]

            img = Image.fromarray(tile_arr)
            buf = io.BytesIO()
            img.save(buf, format="PNG", optimize=True)
            png_b64 = base64.standard_b64encode(buf.getvalue()).decode("ascii")

            tiles.append({
                "x_offset": x,
                "y_offset": y,
                "width": tile_w,
                "height": tile_h,
                "png_b64": png_b64,
            })
            x += step
        y += step

    return tiles


def _call_claude_vision(png_b64: str, tile_width: int, tile_height: int, api_key: str) -> List[Dict]:
    """
    Send a single image tile to Claude Vision and ask it to locate trees.

    Returns a list of dicts with keys: x, y, crown_radius_px, confidence, health_visual
    """
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)

    prompt = f"""You are analyzing an aerial/satellite image tile ({tile_width}x{tile_height} pixels) of agricultural land that may contain trees (e.g., citrus, avocado, or other orchard trees).

Your task: identify every individual tree crown visible in this image.

For each tree, provide:
- "x": the x pixel coordinate of the tree center (0 = left edge, {tile_width} = right edge)
- "y": the y pixel coordinate of the tree center (0 = top edge, {tile_height} = bottom edge)
- "crown_radius_px": estimated crown radius in pixels
- "confidence": your confidence from 0.0 to 1.0
- "health_visual": one of "healthy", "moderate", "stressed", "critical" based on the visual color/canopy appearance (green and full = healthy, yellowish = moderate, sparse/brown = stressed, bare/dead = critical)

Return ONLY a JSON array. No explanation, no markdown, just the raw JSON array.
If there are no trees, return an empty array: []

Example format:
[{{"x": 150, "y": 200, "crown_radius_px": 12, "confidence": 0.9, "health_visual": "healthy"}}]

Be thorough - identify ALL visible trees, even small or partially visible ones at edges. In dense orchards, trees are planted in regular grid patterns, so look for individual crowns even when canopies overlap."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=16000,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": png_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": prompt,
                    },
                ],
            }
        ],
    )

    # Parse JSON from Claude's response
    response_text = response.content[0].text.strip()

    # Try to extract JSON array from the response
    # Sometimes Claude wraps it in markdown code blocks
    json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
    if json_match:
        try:
            trees = json.loads(json_match.group())
            if isinstance(trees, list):
                return trees
        except json.JSONDecodeError:
            logger.warning("Failed to parse Claude response as JSON: %s", response_text[:200])

    return []


def _deduplicate_trees(all_trees: List[Dict], min_distance_px: int = 15) -> List[Dict]:
    """
    Remove duplicate tree detections from overlapping tiles.

    Uses simple distance-based deduplication: if two detections are within
    min_distance_px of each other, keep the one with higher confidence.
    """
    if not all_trees:
        return []

    # Sort by confidence descending so we keep the best detections
    sorted_trees = sorted(all_trees, key=lambda t: t.get("confidence", 0), reverse=True)
    kept = []

    for tree in sorted_trees:
        tx, ty = tree["x"], tree["y"]
        is_dup = False
        for existing in kept:
            dist = ((tx - existing["x"]) ** 2 + (ty - existing["y"]) ** 2) ** 0.5
            if dist < min_distance_px:
                is_dup = True
                break
        if not is_dup:
            kept.append(tree)

    return kept


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run_tree_detection(survey_id: int) -> None:
    """
    Run Claude Vision tree detection on a TreeSurvey image.

    Pipeline:
    1. Marks the survey as 'processing'.
    2. Reads the GeoTIFF and extracts an RGB array.
    3. Tiles the image into chunks suitable for Claude Vision.
    4. Sends each tile to Claude for tree identification.
    5. Deduplicates detections from overlapping tiles.
    6. Converts pixel coords to lat/lon; computes canopy diameter.
    7. If the image has a NIR band, computes per-tree NDVI and health.
    8. Bulk-creates DetectedTree records.
    9. Updates the survey summary fields and sets status='completed'.
    """
    from django.conf import settings
    from django.utils import timezone

    from api.models.tree_detection import DetectedTree, TreeSurvey

    survey = TreeSurvey.objects.select_related("field").get(pk=survey_id)

    # Get API key
    api_key = os.environ.get('ANTHROPIC_API_KEY') or getattr(settings, 'ANTHROPIC_API_KEY', '')
    if not api_key:
        survey.status = "failed"
        survey.error_message = "ANTHROPIC_API_KEY not configured."
        survey.save(update_fields=["status", "error_message"])
        return

    # ---- Mark as processing ------------------------------------------------
    survey.status = "processing"
    survey.error_message = ""
    survey.save(update_fields=["status", "error_message"])
    logger.info("Starting Claude Vision tree detection for survey %s", survey_id)

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
            meta = extract_geotiff_metadata(file_path)
            resolution_m = meta["resolution_m"]

        logger.info(
            "Image: %dx%d, %d bands, resolution=%.3fm, has_nir=%s",
            img_w, img_h, full_image.shape[0], resolution_m, has_nir,
        )

        # ---- Crop to field boundary if available ---------------------------
        # Instead of analyzing the entire satellite scene and filtering after,
        # crop the image to just the field area. This focuses Claude on the
        # right region, saves API calls, and produces more precise results.
        field = survey.field
        boundary_geojson = getattr(field, "boundary_geojson", None)

        # Pixel offsets for the crop region (default: full image)
        crop_x_offset = 0
        crop_y_offset = 0

        if boundary_geojson:
            from shapely.geometry import shape as shp_shape
            try:
                boundary_poly = shp_shape(boundary_geojson)
                minx, miny, maxx, maxy = boundary_poly.bounds  # lon/lat bounds

                # Convert boundary corners to pixel coordinates
                inv_transform = ~transform
                px_min, py_min = inv_transform * (minx, maxy)  # top-left (max lat = min row)
                px_max, py_max = inv_transform * (maxx, miny)  # bottom-right

                # Add padding (10% of each dimension)
                pad_x = int((px_max - px_min) * 0.1)
                pad_y = int((py_max - py_min) * 0.1)

                crop_x1 = max(0, int(px_min) - pad_x)
                crop_y1 = max(0, int(py_min) - pad_y)
                crop_x2 = min(img_w, int(px_max) + pad_x)
                crop_y2 = min(img_h, int(py_max) + pad_y)

                logger.info(
                    "Cropping image to field boundary: pixel (%d,%d)-(%d,%d) from %dx%d",
                    crop_x1, crop_y1, crop_x2, crop_y2, img_w, img_h,
                )

                rgb_array = rgb_array[crop_y1:crop_y2, crop_x1:crop_x2]
                # Also crop the full image for NDVI computation
                full_image = full_image[:, crop_y1:crop_y2, crop_x1:crop_x2]
                crop_x_offset = crop_x1
                crop_y_offset = crop_y1
                img_h, img_w = rgb_array.shape[:2]

                logger.info("Cropped image size: %dx%d", img_w, img_h)
            except Exception as e:
                logger.warning("Failed to crop to field boundary: %s", e)

        # ---- Tile the image ------------------------------------------------
        tile_size = survey.detection_params.get("tile_size", 1024)
        tile_overlap = survey.detection_params.get("tile_overlap", 64)

        tiles = _tile_image_to_pngs(rgb_array, tile_size=tile_size, overlap=tile_overlap)
        logger.info("Created %d tiles (size=%d, overlap=%d)", len(tiles), tile_size, tile_overlap)

        # ---- Send each tile to Claude Vision -------------------------------
        all_trees_global = []  # Trees in global (full-image) pixel coords

        for i, tile in enumerate(tiles):
            logger.info(
                "Processing tile %d/%d (offset=%d,%d size=%dx%d)",
                i + 1, len(tiles),
                tile["x_offset"], tile["y_offset"],
                tile["width"], tile["height"],
            )

            try:
                tile_trees = _call_claude_vision(
                    tile["png_b64"],
                    tile["width"],
                    tile["height"],
                    api_key,
                )
            except Exception as e:
                logger.warning("Claude Vision call failed for tile %d: %s", i + 1, e)
                continue

            # Convert tile-local coords to global (full-image) pixel coords
            # by adding both the tile offset within the crop AND the crop offset
            for tree in tile_trees:
                tree["x"] = tree.get("x", 0) + tile["x_offset"] + crop_x_offset
                tree["y"] = tree.get("y", 0) + tile["y_offset"] + crop_y_offset
                # Validate the detection is within the crop region bounds
                gx, gy = tree["x"], tree["y"]
                if (crop_x_offset <= gx < crop_x_offset + img_w and
                        crop_y_offset <= gy < crop_y_offset + img_h):
                    all_trees_global.append(tree)

            logger.info("Tile %d/%d: %d trees detected", i + 1, len(tiles), len(tile_trees))

        logger.info("Total raw detections across all tiles: %d", len(all_trees_global))

        # ---- Deduplicate overlapping tile detections -----------------------
        dedup_distance = survey.detection_params.get("dedup_distance_px", 15)
        all_trees_global = _deduplicate_trees(all_trees_global, min_distance_px=dedup_distance)
        logger.info("After deduplication: %d trees", len(all_trees_global))

        # ---- Handle no detections ------------------------------------------
        if len(all_trees_global) == 0:
            logger.info("No trees detected for survey %s", survey_id)
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

        for tree_data in all_trees_global:
            # cx, cy are in GLOBAL (full-image) pixel space
            cx = int(tree_data["x"])
            cy = int(tree_data["y"])
            crown_radius_px = int(tree_data.get("crown_radius_px", 10))
            confidence = float(tree_data.get("confidence", 0.7))
            health_visual = tree_data.get("health_visual", "unknown")

            # For bbox and NDVI we need crop-local coords since
            # full_image and img_w/img_h are relative to the crop
            cx_local = cx - crop_x_offset
            cy_local = cy - crop_y_offset

            # Compute bounding box in crop-local space
            bbox_x_min = max(0, cx_local - crown_radius_px)
            bbox_y_min = max(0, cy_local - crown_radius_px)
            bbox_x_max = min(img_w, cx_local + crown_radius_px)
            bbox_y_max = min(img_h, cy_local + crown_radius_px)

            # Convert to lat/lon using GLOBAL coords + original transform
            lat, lon = _pixel_to_latlon(cy, cx, transform, src_crs)

            # Canopy diameter
            canopy_diameter_m = (crown_radius_px * 2) * resolution_m

            # Canopy area (approximate as circle)
            canopy_radius_m = canopy_diameter_m / 2.0
            canopy_area_m2 = np.pi * canopy_radius_m ** 2
            total_canopy_area_m2 += canopy_area_m2

            # NDVI if NIR available, otherwise use Claude's visual assessment
            ndvi_stats = {"ndvi_mean": None, "ndvi_min": None, "ndvi_max": None}
            health = health_visual  # Default to Claude's visual assessment

            if has_nir:
                # Use crop-local coords since full_image is cropped
                ndvi_stats = _compute_tree_ndvi(full_image, cx_local, cy_local, radius_px=crown_radius_px)
                if ndvi_stats["ndvi_mean"] is not None:
                    health = classify_health(ndvi_stats["ndvi_mean"])
                    ndvi_values.append(ndvi_stats["ndvi_mean"])

            tree_objects.append(
                DetectedTree(
                    survey=survey,
                    latitude=lat,
                    longitude=lon,
                    bbox_x_min=bbox_x_min,
                    bbox_y_min=bbox_y_min,
                    bbox_x_max=bbox_x_max,
                    bbox_y_max=bbox_y_max,
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

        field = survey.field
        field_acres = float(getattr(field, "total_acres", 0) or 0)
        trees_per_acre = tree_count / field_acres if field_acres > 0 else None

        avg_ndvi = float(np.mean(ndvi_values)) if ndvi_values else None

        canopy_coverage_percent = None
        if field_acres > 0:
            field_area_m2 = field_acres * 4046.86
            canopy_coverage_percent = min(
                (total_canopy_area_m2 / field_area_m2) * 100.0, 100.0
            )

        processing_time = time.perf_counter() - t_start

        survey.status = "completed"
        survey.detection_model = "claude-sonnet-4-20250514"
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
        import traceback

        error_msg = traceback.format_exc()
        logger.exception("Tree detection failed for survey %s", survey_id)

        survey.status = "failed"
        survey.error_message = error_msg[-2000:]
        survey.processing_time_seconds = round(time.perf_counter() - t_start, 2)
        survey.save(update_fields=["status", "error_message", "processing_time_seconds"])
