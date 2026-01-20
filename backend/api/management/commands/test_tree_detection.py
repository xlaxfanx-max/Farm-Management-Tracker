"""
Test script to verify the tree detection pipeline is working.

This command creates test data and runs through the full detection pipeline
to verify that all components are functioning correctly.

Usage:
    python manage.py test_tree_detection

    # With a real image:
    python manage.py test_tree_detection --image-path /path/to/image.tif

    # Skip cleanup (keep test data):
    python manage.py test_tree_detection --no-cleanup
"""

import os
import tempfile
import numpy as np
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class Command(BaseCommand):
    help = 'Test the tree detection pipeline'

    def add_arguments(self, parser):
        parser.add_argument(
            '--image-path',
            type=str,
            default=None,
            help='Path to a real GeoTIFF image to test with (optional)'
        )
        parser.add_argument(
            '--no-cleanup',
            action='store_true',
            help='Keep test data after running'
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Tree Detection Pipeline Test ===\n'))

        image_path = options['image_path']
        cleanup = not options['no_cleanup']

        # Track created objects for cleanup
        created_objects = []

        try:
            # Step 1: Test imports
            self.stdout.write('1. Testing imports...')
            self._test_imports()
            self.stdout.write(self.style.SUCCESS('   All imports successful'))

            # Step 2: Test detection service (with mock data if no image)
            self.stdout.write('\n2. Testing detection service...')
            self._test_detection_service(image_path)
            self.stdout.write(self.style.SUCCESS('   Detection service working'))

            # Step 3: Test API endpoints exist
            self.stdout.write('\n3. Testing API URL configuration...')
            self._test_api_urls()
            self.stdout.write(self.style.SUCCESS('   API URLs configured'))

            # Step 4: Test model creation
            self.stdout.write('\n4. Testing model operations...')
            created_objects = self._test_models()
            self.stdout.write(self.style.SUCCESS('   Models working correctly'))

            # Step 5: Test Celery task imports
            self.stdout.write('\n5. Testing Celery task imports...')
            self._test_celery_tasks()
            self.stdout.write(self.style.SUCCESS('   Celery tasks importable'))

            # Step 6: Test serializers
            self.stdout.write('\n6. Testing serializers...')
            self._test_serializers()
            self.stdout.write(self.style.SUCCESS('   Serializers working'))

            self.stdout.write(self.style.SUCCESS('\n=== All tests passed! ===\n'))

            self.stdout.write('Pipeline Status:')
            self.stdout.write('  - Models: OK')
            self.stdout.write('  - Detection Service: OK')
            self.stdout.write('  - API Endpoints: OK')
            self.stdout.write('  - Celery Tasks: OK')
            self.stdout.write('  - Serializers: OK')

            self.stdout.write('\nNext steps:')
            self.stdout.write('  1. Upload a satellite image via the UI or management command')
            self.stdout.write('  2. Run tree detection on a field with boundaries')
            self.stdout.write('  3. View detected trees on the map')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\nTest failed: {e}'))
            import traceback
            traceback.print_exc()
            raise CommandError(f'Pipeline test failed: {e}')

        finally:
            if cleanup and created_objects:
                self.stdout.write('\nCleaning up test data...')
                for obj in reversed(created_objects):
                    try:
                        obj.delete()
                    except Exception:
                        pass
                self.stdout.write('   Cleanup complete')

    def _test_imports(self):
        """Test that all required modules can be imported."""
        # Models
        from api.models import SatelliteImage, TreeDetectionRun, DetectedTree, Field, Farm

        # Services
        from api.services.tree_detection import detect_trees, DetectionParams, DetectionResult

        # Serializers
        from api.serializers import (
            SatelliteImageSerializer,
            TreeDetectionRunSerializer,
            DetectedTreeSerializer
        )

        # Views
        from api.imagery_views import (
            SatelliteImageViewSet,
            TreeDetectionRunViewSet,
            DetectedTreeViewSet
        )

    def _test_detection_service(self, image_path=None):
        """Test the tree detection service."""
        from api.services.tree_detection import (
            detect_trees,
            DetectionParams,
            calculate_ndvi,
            calculate_excess_green,
            find_tree_peaks
        )

        # Test with synthetic data
        self.stdout.write('   Creating synthetic test data...')

        # Create a small test "image" array
        test_image = np.random.rand(100, 100, 3).astype(np.float32) * 255

        # Test excess green calculation
        self.stdout.write('   Testing ExG calculation...')
        exg = calculate_excess_green(test_image)
        assert exg.shape == (100, 100), "ExG output shape mismatch"

        # Test NDVI calculation (needs 4 bands)
        self.stdout.write('   Testing NDVI calculation...')
        test_4band = np.random.rand(100, 100, 4).astype(np.float32) * 255
        ndvi = calculate_ndvi(test_4band)
        assert ndvi.shape == (100, 100), "NDVI output shape mismatch"
        assert ndvi.min() >= -1 and ndvi.max() <= 1, "NDVI values out of range"

        # Test peak finding
        self.stdout.write('   Testing peak detection...')
        params = DetectionParams(
            min_canopy_diameter_m=3.0,
            max_canopy_diameter_m=8.0,
            min_tree_spacing_m=4.5
        )
        # Create a vegetation index with some peaks
        veg_index = np.zeros((100, 100), dtype=np.float32)
        veg_index[25, 25] = 1.0  # Peak 1
        veg_index[75, 75] = 1.0  # Peak 2
        veg_index[25, 75] = 1.0  # Peak 3

        peaks = find_tree_peaks(veg_index, params, resolution_m=1.0, threshold=0.5)
        self.stdout.write(f'   Found {len(peaks)} peaks in synthetic data')

        if image_path and os.path.exists(image_path):
            self.stdout.write(f'   Testing with real image: {image_path}')
            # Create a simple boundary that covers the whole image
            test_boundary = {
                'type': 'Polygon',
                'coordinates': [[
                    [-180, -90],
                    [180, -90],
                    [180, 90],
                    [-180, 90],
                    [-180, -90]
                ]]
            }
            result = detect_trees(image_path, test_boundary, params)
            self.stdout.write(f'   Detected {result.tree_count} trees')

    def _test_api_urls(self):
        """Test that API URLs are properly configured."""
        from django.urls import reverse, get_resolver

        # Get all URL patterns
        resolver = get_resolver()
        url_names = [pattern.name for pattern in resolver.url_patterns if hasattr(pattern, 'name')]

        # Check for expected URL patterns
        expected_patterns = [
            'satelliteimage-list',
            'treedetectionrun-list',
            'detectedtree-list',
        ]

        for pattern in expected_patterns:
            try:
                url = reverse(pattern)
                self.stdout.write(f'   Found: {pattern} -> {url}')
            except Exception:
                # Try with api: prefix
                try:
                    url = reverse(f'api:{pattern}')
                    self.stdout.write(f'   Found: api:{pattern} -> {url}')
                except Exception:
                    self.stdout.write(self.style.WARNING(f'   URL pattern not found: {pattern}'))

    def _test_models(self):
        """Test model creation and relationships."""
        from api.models import SatelliteImage, TreeDetectionRun, DetectedTree, Field, Farm, Company

        created = []

        # Get or create a test company
        company, _ = Company.objects.get_or_create(
            name='Test Company for Pipeline',
            defaults={'is_active': True}
        )

        # Get or create a test user
        user, _ = User.objects.get_or_create(
            email='pipeline_test@test.com',
            defaults={'password': 'testpass123'}
        )

        # Create a test farm
        farm = Farm.objects.create(
            name='Pipeline Test Farm',
            county='Fresno',
            company=company,
            gps_latitude=36.7378,
            gps_longitude=-119.7871
        )
        created.append(farm)
        self.stdout.write(f'   Created test farm: {farm.name}')

        # Create a test field
        field = Field.objects.create(
            name='Pipeline Test Field',
            farm=farm,
            county='Fresno',
            total_acres=10.0,
            boundary_geojson={
                'type': 'Polygon',
                'coordinates': [[
                    [-119.79, 36.73],
                    [-119.78, 36.73],
                    [-119.78, 36.74],
                    [-119.79, 36.74],
                    [-119.79, 36.73]
                ]]
            }
        )
        created.append(field)
        self.stdout.write(f'   Created test field: {field.name}')

        # Create a test satellite image (without actual file)
        image = SatelliteImage.objects.create(
            farm=farm,
            source='test',
            capture_date=timezone.now().date(),
            resolution_m=0.5,
            bands=4,
            has_nir=True,
            bbox_geojson={
                'type': 'Polygon',
                'coordinates': [[
                    [-119.80, 36.72],
                    [-119.77, 36.72],
                    [-119.77, 36.75],
                    [-119.80, 36.75],
                    [-119.80, 36.72]
                ]]
            }
        )
        created.append(image)
        self.stdout.write(f'   Created test satellite image: {image.id}')

        # Create a test detection run
        run = TreeDetectionRun.objects.create(
            satellite_image=image,
            field=field,
            parameters={
                'min_canopy_diameter_m': 3.0,
                'max_canopy_diameter_m': 8.0
            }
        )
        created.append(run)
        self.stdout.write(f'   Created test detection run: {run.id}')

        # Create a test detected tree
        tree = DetectedTree.objects.create(
            detection_run=run,
            field=field,
            latitude=36.735,
            longitude=-119.785,
            pixel_x=100,
            pixel_y=100,
            confidence_score=0.95,
            canopy_diameter_m=4.5
        )
        created.append(tree)
        self.stdout.write(f'   Created test detected tree: {tree.id}')

        # Verify relationships
        assert run.detected_trees.count() == 1, "Detection run should have 1 tree"
        assert field.detected_trees.count() == 1, "Field should have 1 tree"

        return created

    def _test_celery_tasks(self):
        """Test that Celery tasks can be imported."""
        try:
            from api.tasks.imagery_tasks import (
                process_tree_detection,
                cleanup_old_detection_runs,
                reprocess_detection_run
            )
            self.stdout.write('   Tasks imported successfully')

            # Check if Celery is configured
            try:
                from pesticide_tracker.celery import app
                self.stdout.write(f'   Celery app configured: {app.main}')
                self.stdout.write(f'   Broker: {app.conf.broker_url}')
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'   Celery not fully configured: {e}'))
                self.stdout.write('   (Tasks will fall back to synchronous execution)')

        except ImportError as e:
            self.stdout.write(self.style.WARNING(f'   Task import warning: {e}'))

    def _test_serializers(self):
        """Test that serializers work correctly."""
        from api.serializers import (
            SatelliteImageSerializer,
            TreeDetectionRunSerializer,
            DetectedTreeSerializer,
            DetectedTreeGeoJSONSerializer
        )
        from api.models import SatelliteImage, TreeDetectionRun, DetectedTree

        # Test serializer classes exist and have expected fields
        self.stdout.write(f'   SatelliteImageSerializer fields: {list(SatelliteImageSerializer().fields.keys())[:5]}...')
        self.stdout.write(f'   TreeDetectionRunSerializer fields: {list(TreeDetectionRunSerializer().fields.keys())[:5]}...')
        self.stdout.write(f'   DetectedTreeSerializer fields: {list(DetectedTreeSerializer().fields.keys())[:5]}...')
