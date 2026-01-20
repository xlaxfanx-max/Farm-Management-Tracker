"""
Management command to run tree detection on satellite imagery.

Usage:
    # Detect trees for all fields covered by an image:
    python manage.py run_tree_detection --image-id 1

    # Detect trees for specific fields:
    python manage.py run_tree_detection --image-id 1 --field-ids 1 2 3

    # Run synchronously (without Celery):
    python manage.py run_tree_detection --image-id 1 --sync

    # Custom parameters:
    python manage.py run_tree_detection --image-id 1 \
        --min-canopy 3.0 --max-canopy 8.0 --min-spacing 4.5
"""

import time
from django.core.management.base import BaseCommand, CommandError

from api.models import SatelliteImage, TreeDetectionRun, DetectedTree, Field
from api.services.tree_detection import detect_trees, DetectionParams


class Command(BaseCommand):
    help = 'Run tree detection on satellite imagery'

    def add_arguments(self, parser):
        parser.add_argument(
            '--image-id',
            type=int,
            required=True,
            help='ID of the satellite image to process'
        )
        parser.add_argument(
            '--field-ids',
            type=int,
            nargs='+',
            default=None,
            help='Specific field IDs to process (default: all covered fields with boundaries)'
        )
        parser.add_argument(
            '--sync',
            action='store_true',
            help='Run synchronously instead of using Celery'
        )
        parser.add_argument(
            '--min-canopy',
            type=float,
            default=3.0,
            help='Minimum canopy diameter in meters (default: 3.0)'
        )
        parser.add_argument(
            '--max-canopy',
            type=float,
            default=8.0,
            help='Maximum canopy diameter in meters (default: 8.0)'
        )
        parser.add_argument(
            '--min-spacing',
            type=float,
            default=4.5,
            help='Minimum tree spacing in meters (default: 4.5)'
        )
        parser.add_argument(
            '--veg-threshold',
            type=float,
            default=50.0,
            help='Vegetation threshold percentile (default: 50.0)'
        )

    def handle(self, *args, **options):
        image_id = options['image_id']
        field_ids = options['field_ids']
        run_sync = options['sync']

        # Get satellite image
        try:
            image = SatelliteImage.objects.select_related('farm').get(id=image_id)
        except SatelliteImage.DoesNotExist:
            raise CommandError(f'Satellite image with ID {image_id} not found')

        self.stdout.write(f'Image: {image.farm.name} - {image.capture_date} ({image.source})')
        self.stdout.write(f'Resolution: {image.resolution_m:.3f}m | Bands: {image.bands} | NIR: {image.has_nir}')

        # Get fields to process
        if field_ids:
            fields = Field.objects.filter(id__in=field_ids, farm=image.farm, active=True)
            if fields.count() != len(field_ids):
                found_ids = list(fields.values_list('id', flat=True))
                missing = set(field_ids) - set(found_ids)
                raise CommandError(f'Fields not found: {missing}')
        else:
            # Get all fields covered by image that have boundaries
            all_fields = Field.objects.filter(farm=image.farm, active=True)
            fields = [f for f in all_fields if f.boundary_geojson and image.covers_field(f)]

        if not fields:
            raise CommandError('No fields with boundaries found within image coverage')

        self.stdout.write(f'\nProcessing {len(fields)} field(s):')
        for field in fields:
            self.stdout.write(f'  - {field.name} ({field.total_acres} acres)')

        # Build parameters
        parameters = {
            'min_canopy_diameter_m': options['min_canopy'],
            'max_canopy_diameter_m': options['max_canopy'],
            'min_tree_spacing_m': options['min_spacing'],
            'vegetation_threshold_percentile': options['veg_threshold'],
        }

        self.stdout.write(f'\nDetection parameters:')
        for key, value in parameters.items():
            self.stdout.write(f'  {key}: {value}')

        # Create detection runs
        runs = []
        for field in fields:
            run = TreeDetectionRun.objects.create(
                satellite_image=image,
                field=field,
                parameters=parameters
            )
            runs.append(run)

        if run_sync:
            self.stdout.write(self.style.WARNING('\nRunning synchronously (this may take a while)...\n'))
            self._run_sync(runs, image, parameters)
        else:
            self._run_async(runs)

    def _run_async(self, runs):
        """Dispatch tasks to Celery."""
        try:
            from api.tasks.imagery_tasks import process_tree_detection

            self.stdout.write('\nDispatching to Celery workers...')
            for run in runs:
                process_tree_detection.delay(run.id)
                self.stdout.write(f'  Queued: {run.field.name} (run ID: {run.id})')

            self.stdout.write(self.style.SUCCESS('\nTasks queued successfully!'))
            self.stdout.write('Monitor progress with:')
            self.stdout.write('  celery -A pesticide_tracker inspect active')
            self.stdout.write('Or check the API:')
            for run in runs:
                self.stdout.write(f'  GET /api/detection-runs/{run.id}/')

        except ImportError:
            self.stdout.write(self.style.WARNING(
                '\nCelery not available. Running synchronously instead...\n'
            ))
            self._run_sync(runs, runs[0].satellite_image, runs[0].parameters)

    def _run_sync(self, runs, image, parameters):
        """Run detection synchronously."""
        from django.utils import timezone

        params = DetectionParams(**parameters)
        total_trees = 0

        for run in runs:
            field = run.field
            self.stdout.write(f'Processing: {field.name}...')

            start_time = time.time()

            try:
                run.status = 'processing'
                run.save()

                # Run detection
                result = detect_trees(
                    image_path=image.file.path,
                    field_boundary_geojson=field.boundary_geojson,
                    params=params
                )

                # Store trees
                tree_objects = []
                for tree_data in result.trees:
                    tree_objects.append(DetectedTree(
                        detection_run=run,
                        field=field,
                        latitude=tree_data['latitude'],
                        longitude=tree_data['longitude'],
                        pixel_x=tree_data['pixel_x'],
                        pixel_y=tree_data['pixel_y'],
                        ndvi_value=tree_data.get('ndvi_value'),
                        confidence_score=tree_data['confidence_score'],
                        canopy_diameter_m=tree_data.get('canopy_diameter_m'),
                    ))

                if tree_objects:
                    DetectedTree.objects.bulk_create(tree_objects, batch_size=1000)

                processing_time = time.time() - start_time

                # Update run
                run.status = 'completed'
                run.completed_at = timezone.now()
                run.tree_count = result.tree_count
                run.trees_per_acre = result.trees_per_acre
                run.avg_canopy_diameter_m = result.avg_canopy_diameter_m
                run.canopy_coverage_percent = result.canopy_coverage_percent
                run.vegetation_index = result.vegetation_index
                run.processing_time_seconds = processing_time
                run.save()

                total_trees += result.tree_count

                self.stdout.write(self.style.SUCCESS(
                    f'  Detected {result.tree_count} trees in {processing_time:.1f}s '
                    f'({result.trees_per_acre:.1f}/acre, {result.canopy_coverage_percent:.1f}% coverage)'
                ))

            except Exception as e:
                run.status = 'failed'
                run.error_message = str(e)
                run.save()
                self.stdout.write(self.style.ERROR(f'  FAILED: {e}'))

        self.stdout.write(self.style.SUCCESS(f'\nTotal trees detected: {total_trees}'))
        self.stdout.write('\nTo approve results and update field counts:')
        for run in runs:
            if run.status == 'completed':
                self.stdout.write(f'  POST /api/detection-runs/{run.id}/approve/')
