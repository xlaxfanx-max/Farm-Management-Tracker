"""
Minimal smoke run for tree detection on a synthetic GeoTIFF.

Usage:
  python manage.py smoke_tree_detection
  python manage.py smoke_tree_detection --size 256 --trees 12
"""

import tempfile
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Run a smoke test of the tree detection pipeline on a synthetic GeoTIFF.'

    def add_arguments(self, parser):
        parser.add_argument('--size', type=int, default=256, help='Raster width/height in pixels')
        parser.add_argument('--trees', type=int, default=10, help='Number of synthetic tree blobs')

    def handle(self, *args, **options):
        import numpy as np
        import rasterio
        from rasterio.transform import from_origin
        from api.services.tree_detection import detect_trees, DetectionParams

        size = options['size']
        tree_count = options['trees']

        rng = np.random.default_rng(42)
        img = np.zeros((4, size, size), dtype=np.float32)

        # Add synthetic Gaussian "canopies"
        for _ in range(tree_count):
            cx = rng.integers(20, size - 20)
            cy = rng.integers(20, size - 20)
            sigma = rng.uniform(2.0, 4.0)
            yy, xx = np.meshgrid(np.arange(size), np.arange(size), indexing='ij')
            blob = np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * sigma ** 2))
            img[1] += blob * 0.6  # Green
            img[2] += blob * 0.3  # Red
            img[3] += blob * 0.8  # NIR

        img = np.clip(img, 0, 1)

        # Geo setup (small patch in CA)
        pixel_size = 0.00001
        left = -119.0
        top = 34.0
        transform = from_origin(left, top, pixel_size, pixel_size)
        right = left + size * pixel_size
        bottom = top - size * pixel_size

        boundary = {
            "type": "Polygon",
            "coordinates": [[
                [left, top],
                [right, top],
                [right, bottom],
                [left, bottom],
                [left, top],
            ]]
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            path = f"{tmpdir}/synthetic.tif"
            with rasterio.open(
                path,
                'w',
                driver='GTiff',
                height=size,
                width=size,
                count=4,
                dtype='float32',
                crs='EPSG:4326',
                transform=transform,
            ) as dst:
                dst.write(img)

            params = DetectionParams(tile_size_px=128, tile_overlap_px=16)
            result = detect_trees(path, boundary, params)

        self.stdout.write(self.style.SUCCESS(
            f"Smoke run complete: detected {result.tree_count} trees "
            f"(expected ~{tree_count})"
        ))
