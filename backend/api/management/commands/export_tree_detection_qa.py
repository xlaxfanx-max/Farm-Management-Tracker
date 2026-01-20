"""
Export a visual QA pack for tree detection runs.

Outputs:
  - overlay PNGs for random tiles
  - detections GeoJSON
  - summary JSON (counts, confidence histogram)
  - optional label-based precision/recall if labels are provided
"""

import json
import os
import random
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Export a visual QA pack for a tree detection run.'

    def add_arguments(self, parser):
        parser.add_argument('--run-id', type=int, help='TreeDetectionRun ID')
        parser.add_argument('--field-id', type=int, help='Field ID (uses latest completed run)')
        parser.add_argument('--out-dir', type=str, default='', help='Output directory (default: temp folder)')
        parser.add_argument('--tiles', type=int, default=8, help='Number of random tiles to export')
        parser.add_argument('--tile-size', type=int, default=512, help='Tile size in pixels')
        parser.add_argument('--seed', type=int, default=13, help='Random seed')
        parser.add_argument('--labels', type=str, default='', help='Optional label GeoJSON (Point features)')
        parser.add_argument('--match-radius-m', type=float, default=2.0, help='Match radius for labels (meters)')

    def handle(self, *args, **options):
        import numpy as np
        import rasterio
        from rasterio import windows, features
        from rasterio.warp import transform_geom
        from PIL import Image, ImageDraw
        from scipy.spatial import cKDTree
        from api.models import TreeDetectionRun, DetectedTree
        from api.services.tree_detection import calculate_field_area_acres

        run_id = options['run_id']
        field_id = options['field_id']

        if not run_id and not field_id:
            raise CommandError('Provide --run-id or --field-id')

        if run_id:
            run = TreeDetectionRun.objects.select_related('field', 'satellite_image').get(id=run_id)
        else:
            run = TreeDetectionRun.objects.select_related('field', 'satellite_image').filter(
                field_id=field_id,
                status='completed'
            ).order_by('-created_at').first()
            if not run:
                raise CommandError('No completed detection run found for field')

        trees = list(DetectedTree.objects.filter(detection_run=run).order_by('id'))
        if not trees:
            raise CommandError('No detected trees for this run')

        field = run.field
        image_path = run.satellite_image.file.path
        tile_count = options['tiles']
        tile_size = options['tile_size']

        out_dir = options['out_dir']
        if not out_dir:
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            out_dir = os.path.join(os.getcwd(), f'qa_pack_{run.id}_{timestamp}')
        os.makedirs(out_dir, exist_ok=True)

        rng = random.Random(options['seed'])

        def normalize_geometry(geometry, src_crs):
            if not geometry:
                return None
            if not src_crs:
                return geometry
            try:
                return transform_geom('EPSG:4326', src_crs, geometry, precision=6)
            except Exception:
                return geometry

        def stretch_band(band):
            band = band.astype(np.float32)
            lo, hi = np.percentile(band, [2, 98])
            if hi <= lo:
                return np.clip(band, 0, 1)
            band = (band - lo) / (hi - lo)
            return np.clip(band, 0, 1)

        def to_rgb(tile):
            if tile.shape[0] >= 3:
                blue = stretch_band(tile[0])
                green = stretch_band(tile[1])
                red = stretch_band(tile[2])
            else:
                gray = stretch_band(tile[0])
                red = green = blue = gray
            rgb = np.stack([red, green, blue], axis=-1)
            return (rgb * 255).astype(np.uint8)

        def sample_windows(base_window, count):
            windows_out = []
            row_min = int(base_window.row_off)
            col_min = int(base_window.col_off)
            row_max = int(base_window.row_off + base_window.height - tile_size)
            col_max = int(base_window.col_off + base_window.width - tile_size)
            if row_max <= row_min or col_max <= col_min:
                windows_out.append(windows.Window(col_min, row_min, base_window.width, base_window.height))
                return windows_out
            for _ in range(count):
                row = rng.randint(row_min, row_max)
                col = rng.randint(col_min, col_max)
                windows_out.append(windows.Window(col, row, tile_size, tile_size))
            return windows_out

        with rasterio.open(image_path) as src:
            geometry = normalize_geometry(field.boundary_geojson, src.crs)
            if geometry:
                bounds = features.bounds(geometry)
                base_window = windows.from_bounds(*bounds, transform=src.transform)
            else:
                base_window = windows.Window(0, 0, src.width, src.height)

            base_window = base_window.round_offsets().round_lengths()
            base_window = windows.intersect(base_window, windows.Window(0, 0, src.width, src.height))

            tile_windows = sample_windows(base_window, tile_count)

            for idx, window in enumerate(tile_windows, start=1):
                window = windows.intersect(window, windows.Window(0, 0, src.width, src.height))
                image = src.read(window=window, masked=True).filled(0)
                rgb = to_rgb(image)

                img = Image.fromarray(rgb)
                draw = ImageDraw.Draw(img)

                for tree in trees:
                    x = tree.pixel_x - int(window.col_off)
                    y = tree.pixel_y - int(window.row_off)
                    if 0 <= x < window.width and 0 <= y < window.height:
                        r = 3
                        draw.ellipse((x - r, y - r, x + r, y + r), outline='red', width=1)

                out_path = os.path.join(out_dir, f'overlay_{idx:02d}.png')
                img.save(out_path)

        # GeoJSON export
        features_out = []
        for tree in trees:
            features_out.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [tree.longitude, tree.latitude]},
                "properties": {
                    "id": tree.id,
                    "confidence": tree.confidence_score,
                    "ndvi": tree.ndvi_value,
                    "canopy_diameter_m": tree.canopy_diameter_m,
                },
            })

        geojson = {"type": "FeatureCollection", "features": features_out}
        geojson_path = os.path.join(out_dir, 'detections.geojson')
        with open(geojson_path, 'w', encoding='utf-8') as f:
            json.dump(geojson, f)

        # Summary stats
        field_area_acres = calculate_field_area_acres(field.boundary_geojson)
        field_area_ha = field_area_acres * 0.404686 if field_area_acres else None
        confidences = [t.confidence_score for t in trees]
        hist_bins = [0.0, 0.5, 0.7, 0.85, 1.0]
        hist = {f"{hist_bins[i]}-{hist_bins[i+1]}": 0 for i in range(len(hist_bins) - 1)}
        for c in confidences:
            for i in range(len(hist_bins) - 1):
                if hist_bins[i] <= c < hist_bins[i + 1]:
                    hist[f"{hist_bins[i]}-{hist_bins[i+1]}"] += 1
                    break

        summary = {
            "run_id": run.id,
            "field_id": field.id,
            "tree_count": len(trees),
            "trees_per_hectare": (len(trees) / field_area_ha) if field_area_ha else None,
            "avg_confidence": float(np.mean(confidences)) if confidences else None,
            "confidence_histogram": hist,
        }

        # Optional label evaluation
        labels_path = options['labels']
        if labels_path:
            with open(labels_path, 'r', encoding='utf-8') as f:
                label_geojson = json.load(f)

            label_points = []
            for feature in label_geojson.get('features', []):
                if feature.get('geometry', {}).get('type') != 'Point':
                    continue
                lon, lat = feature['geometry']['coordinates']
                label_points.append((lon, lat))

            if label_points:
                lons = [t.longitude for t in trees] + [p[0] for p in label_points]
                lats = [t.latitude for t in trees] + [p[1] for p in label_points]
                mean_lat = float(np.mean(lats))
                lat_m = 111000.0
                lon_m = 111000.0 * np.cos(np.radians(mean_lat))

                def to_xy(points):
                    return np.array([[p[0] * lon_m, p[1] * lat_m] for p in points], dtype=np.float32)

                pred_xy = to_xy([(t.longitude, t.latitude) for t in trees])
                label_xy = to_xy(label_points)

                tree_idx = cKDTree(pred_xy)
                label_idx = cKDTree(label_xy)

                match_radius = options['match_radius_m']
                matched_preds = set()
                matched_labels = set()

                for i, lp in enumerate(label_xy):
                    matches = tree_idx.query_ball_point(lp, r=match_radius)
                    if matches:
                        matched_labels.add(i)
                        matched_preds.add(matches[0])

                precision = len(matched_preds) / len(pred_xy) if len(pred_xy) else 0.0
                recall = len(matched_labels) / len(label_xy) if len(label_xy) else 0.0
                summary["label_evaluation"] = {
                    "labels": len(label_xy),
                    "predictions": len(pred_xy),
                    "matched": len(matched_preds),
                    "precision": precision,
                    "recall": recall,
                    "match_radius_m": match_radius,
                }

        summary_path = os.path.join(out_dir, 'summary.json')
        with open(summary_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)

        self.stdout.write(self.style.SUCCESS(f"QA pack exported to: {out_dir}"))
