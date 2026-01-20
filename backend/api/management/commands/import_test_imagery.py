"""
Management command to import test satellite imagery.

Usage:
    python manage.py import_test_imagery /path/to/image.tif --farm-id 1

    # With all options:
    python manage.py import_test_imagery /path/to/image.tif \
        --farm-id 1 \
        --capture-date 2025-11-01 \
        --source SkyWatch \
        --product-id "25NOV01185851-S3DS-200011317312"
"""

import os
import shutil
from datetime import date
from django.core.management.base import BaseCommand, CommandError
from django.core.files import File
from django.conf import settings

from api.models import SatelliteImage, Farm, Company
from api.services.tree_detection import extract_geotiff_metadata


class Command(BaseCommand):
    help = 'Import a satellite image (GeoTIFF) for testing tree detection'

    def add_arguments(self, parser):
        parser.add_argument(
            'image_path',
            type=str,
            help='Path to the GeoTIFF file to import'
        )
        parser.add_argument(
            '--farm-id',
            type=int,
            required=True,
            help='ID of the farm this image covers'
        )
        parser.add_argument(
            '--capture-date',
            type=str,
            default=None,
            help='Date image was captured (YYYY-MM-DD). Defaults to today.'
        )
        parser.add_argument(
            '--source',
            type=str,
            default='SkyWatch',
            help='Imagery source/provider (default: SkyWatch)'
        )
        parser.add_argument(
            '--product-id',
            type=str,
            default='',
            help='Provider product/order ID'
        )

    def handle(self, *args, **options):
        image_path = options['image_path']
        farm_id = options['farm_id']
        capture_date_str = options['capture_date']
        source = options['source']
        product_id = options['product_id']

        # Validate file exists
        if not os.path.exists(image_path):
            raise CommandError(f'File not found: {image_path}')

        if not image_path.lower().endswith(('.tif', '.tiff')):
            raise CommandError('File must be a GeoTIFF (.tif or .tiff)')

        # Get farm
        try:
            farm = Farm.objects.select_related('company').get(id=farm_id)
        except Farm.DoesNotExist:
            raise CommandError(f'Farm with ID {farm_id} not found')

        self.stdout.write(f'Importing image for farm: {farm.name}')

        # Parse capture date
        if capture_date_str:
            try:
                capture_date = date.fromisoformat(capture_date_str)
            except ValueError:
                raise CommandError('Invalid date format. Use YYYY-MM-DD')
        else:
            capture_date = date.today()

        # Extract metadata from GeoTIFF
        self.stdout.write('Extracting image metadata...')
        try:
            metadata = extract_geotiff_metadata(image_path)
        except Exception as e:
            raise CommandError(f'Failed to read GeoTIFF metadata: {e}')

        self.stdout.write(self.style.SUCCESS(f'  Resolution: {metadata["resolution_m"]:.3f}m'))
        self.stdout.write(f'  Bands: {metadata["bands"]} (NIR: {metadata["has_nir"]})')
        self.stdout.write(f'  Size: {metadata["file_size_mb"]:.1f} MB')
        self.stdout.write(f'  Bounds: W:{metadata["bounds_west"]:.4f} E:{metadata["bounds_east"]:.4f}')
        self.stdout.write(f'          S:{metadata["bounds_south"]:.4f} N:{metadata["bounds_north"]:.4f}')

        # Create media directory if needed
        media_dir = os.path.join(settings.MEDIA_ROOT, 'imagery', str(capture_date.year), f'{capture_date.month:02d}')
        os.makedirs(media_dir, exist_ok=True)

        # Copy file to media directory
        filename = os.path.basename(image_path)
        dest_path = os.path.join(media_dir, filename)

        # Handle if file already exists
        if os.path.exists(dest_path):
            base, ext = os.path.splitext(filename)
            counter = 1
            while os.path.exists(dest_path):
                filename = f'{base}_{counter}{ext}'
                dest_path = os.path.join(media_dir, filename)
                counter += 1

        self.stdout.write(f'Copying file to media directory...')
        shutil.copy2(image_path, dest_path)

        # Create the SatelliteImage record
        relative_path = os.path.relpath(dest_path, settings.MEDIA_ROOT)

        satellite_image = SatelliteImage.objects.create(
            company=farm.company,
            farm=farm,
            file=relative_path,
            file_size_mb=metadata['file_size_mb'],
            capture_date=capture_date,
            resolution_m=metadata['resolution_m'],
            bands=metadata['bands'],
            has_nir=metadata['has_nir'],
            source=source,
            source_product_id=product_id,
            bounds_west=metadata['bounds_west'],
            bounds_east=metadata['bounds_east'],
            bounds_south=metadata['bounds_south'],
            bounds_north=metadata['bounds_north'],
            crs=metadata['crs'],
            metadata_json={
                'width': metadata['width'],
                'height': metadata['height'],
                'dtype': metadata['dtype'],
            }
        )

        self.stdout.write(self.style.SUCCESS(f'\nSuccessfully imported satellite image!'))
        self.stdout.write(f'  Image ID: {satellite_image.id}')
        self.stdout.write(f'  Farm: {farm.name}')
        self.stdout.write(f'  Capture Date: {capture_date}')
        self.stdout.write(f'  Source: {source}')

        # Check which fields are covered
        covered_fields = []
        for field in farm.fields.filter(active=True):
            if satellite_image.covers_field(field):
                covered_fields.append(field)

        if covered_fields:
            self.stdout.write(f'\n  Covers {len(covered_fields)} field(s):')
            for field in covered_fields:
                has_boundary = 'with boundary' if field.boundary_geojson else 'NO BOUNDARY'
                self.stdout.write(f'    - {field.name} ({has_boundary})')
        else:
            self.stdout.write(self.style.WARNING('\n  No fields found within image coverage area'))

        self.stdout.write(f'\nNext steps:')
        self.stdout.write(f'  1. Ensure fields have boundaries drawn on the map')
        self.stdout.write(f'  2. Run tree detection:')
        self.stdout.write(f'     python manage.py run_tree_detection --image-id {satellite_image.id}')
        self.stdout.write(f'  Or use the API:')
        self.stdout.write(f'     POST /api/satellite-images/{satellite_image.id}/detect-trees/')
