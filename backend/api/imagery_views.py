"""
API ViewSets for satellite imagery and tree detection.

Endpoints:
- /api/satellite-images/           - CRUD for satellite imagery
- /api/satellite-images/{id}/detect-trees/  - Trigger tree detection
- /api/detection-runs/             - View detection run status/results
- /api/detection-runs/{id}/trees/  - Get detected trees for a run
- /api/fields/{id}/trees/          - Get trees for a field
- /api/fields/{id}/tree-summary/   - Get tree count summary
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from .permissions import HasCompanyAccess

from .models import SatelliteImage, TreeDetectionRun, DetectedTree, Field
from .serializers import (
    SatelliteImageSerializer,
    SatelliteImageListSerializer,
    SatelliteImageUploadSerializer,
    TreeDetectionRunSerializer,
    TreeDetectionRunListSerializer,
    TreeDetectionRunCreateSerializer,
    DetectedTreeSerializer,
    DetectedTreeGeoJSONSerializer,
    FieldTreeSummarySerializer,
)


class SatelliteImageViewSet(viewsets.ModelViewSet):
    """
    API endpoints for satellite imagery management.

    list:   GET    /api/satellite-images/
    create: POST   /api/satellite-images/
    detail: GET    /api/satellite-images/{id}/
    delete: DELETE /api/satellite-images/{id}/
    """
    permission_classes = [permissions.IsAuthenticated, HasCompanyAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.action == 'list':
            return SatelliteImageListSerializer
        if self.action == 'create':
            return SatelliteImageUploadSerializer
        return SatelliteImageSerializer

    def get_queryset(self):
        queryset = SatelliteImage.objects.filter(
            company=self.request.user.current_company
        ).select_related('farm', 'uploaded_by')

        # Filter by farm if provided
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        return queryset

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=['post'], url_path='detect-trees', url_name='detect-trees')
    def detect_trees(self, request, pk=None):
        """
        Start tree detection for specified fields.

        POST /api/satellite-images/{id}/detect-trees/
        Body: {"field_ids": [1, 2, 3], "parameters": {...}}

        Returns run IDs for tracking status.
        """
        import logging
        logger = logging.getLogger(__name__)

        try:
            image = self.get_object()
            logger.info(f"[detect_trees] Image {image.id} bounds: W={image.bounds_west}, E={image.bounds_east}, S={image.bounds_south}, N={image.bounds_north}")

            # Validate input
            create_serializer = TreeDetectionRunCreateSerializer(data=request.data)
            create_serializer.is_valid(raise_exception=True)

            field_ids = create_serializer.validated_data['field_ids']
            parameters = create_serializer.validated_data.get('parameters', {})
            logger.info(f"[detect_trees] Requested field_ids: {field_ids}")

            # Validate fields belong to user's company and have boundaries
            fields = Field.objects.filter(
                id__in=field_ids,
                farm__company=request.user.current_company,
                active=True
            )
            logger.info(f"[detect_trees] Found {fields.count()} fields")

            if fields.count() != len(field_ids):
                return Response(
                    {'error': 'One or more fields not found or not accessible.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check fields have boundaries
            fields_without_boundary = [f.name for f in fields if not f.boundary_geojson]
            if fields_without_boundary:
                return Response(
                    {
                        'error': 'Fields missing boundaries',
                        'fields': fields_without_boundary
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check fields are covered by image (skip if bounds not set properly)
            fields_not_covered = []
            for f in fields:
                try:
                    if not image.covers_field(f):
                        fields_not_covered.append(f.name)
                        logger.warning(f"[detect_trees] Field '{f.name}' not covered by image")
                except Exception as e:
                    logger.warning(f"[detect_trees] Error checking coverage for field '{f.name}': {e}")
                    # Don't block detection if coverage check fails

            if fields_not_covered:
                # Log warning but allow detection to proceed
                logger.warning(f"[detect_trees] Fields not fully covered: {fields_not_covered}")

            # Create detection runs
            runs = []
            for field in fields:
                run = TreeDetectionRun.objects.create(
                    satellite_image=image,
                    field=field,
                    parameters=parameters
                )
                runs.append(run)
                logger.info(f"[detect_trees] Created run {run.id} for field '{field.name}'")

                # Trigger async processing - try Celery first, fall back to threading
                use_threading = False
                try:
                    from .tasks.imagery_tasks import process_tree_detection
                    process_tree_detection.delay(run.id)
                    logger.info(f"[detect_trees] Started Celery task for run {run.id}")
                except ImportError:
                    logger.info("[detect_trees] Celery not installed, using threading")
                    use_threading = True
                except Exception as celery_err:
                    # Celery installed but not working (Redis not running, etc.)
                    logger.warning(f"[detect_trees] Celery failed ({celery_err}), using threading")
                    use_threading = True

                if use_threading:
                    import threading
                    thread = threading.Thread(
                        target=self._run_detection_sync,
                        args=(run.id, image.id, field.id, parameters)
                    )
                    thread.daemon = True
                    thread.start()
                    logger.info(f"[detect_trees] Started thread for run {run.id}")

            return Response({
                'message': f'Started detection for {len(runs)} field(s)',
                'run_ids': [r.id for r in runs]
            }, status=status.HTTP_202_ACCEPTED)

        except Exception as e:
            logger.exception(f"[detect_trees] Error: {e}")
            return Response(
                {'error': f'Failed to start detection: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _run_detection_sync(self, run_id, image_id, field_id, parameters):
        """Synchronous detection for development/testing when Celery unavailable."""
        from .services.tree_detection import detect_trees, build_detection_params
        from django.utils import timezone
        from django.db import connection
        import time
        import logging
        logger = logging.getLogger(__name__)

        start_time = time.time()
        logger.info(f"[_run_detection_sync] Starting detection for run {run_id}")

        try:
            # Close any stale connection from parent thread
            connection.close()

            # Fetch fresh objects in this thread
            run = TreeDetectionRun.objects.get(id=run_id)
            image = SatelliteImage.objects.get(id=image_id)
            field = Field.objects.get(id=field_id)
            logger.info(f"[_run_detection_sync] Processing field '{field.name}' with image {image.file.path}")

            run.status = 'processing'
            run.save()

            # Parse parameters (field-specific defaults + overrides)
            params = build_detection_params(field, parameters)

            # Run detection
            result = detect_trees(
                image_path=image.file.path,
                field_boundary_geojson=field.boundary_geojson,
                params=params
            )

            # Store detected trees
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
            DetectedTree.objects.bulk_create(tree_objects)

            # Update run with results
            run.status = 'completed'
            run.completed_at = timezone.now()
            run.tree_count = result.tree_count
            run.trees_per_acre = result.trees_per_acre
            run.avg_canopy_diameter_m = result.avg_canopy_diameter_m
            run.canopy_coverage_percent = result.canopy_coverage_percent
            run.vegetation_index = result.vegetation_index
            run.processing_time_seconds = time.time() - start_time
            run.save()
            logger.info(f"[_run_detection_sync] Completed! Found {result.tree_count} trees in {run.processing_time_seconds:.1f}s")

            # Update field with satellite detection data
            field.latest_satellite_tree_count = result.tree_count
            field.latest_satellite_trees_per_acre = result.trees_per_acre
            field.satellite_canopy_coverage_percent = result.canopy_coverage_percent
            field.latest_detection_date = image.capture_date
            field.latest_detection_run = run
            field.save(update_fields=[
                'latest_satellite_tree_count',
                'latest_satellite_trees_per_acre',
                'satellite_canopy_coverage_percent',
                'latest_detection_date',
                'latest_detection_run',
                'updated_at'
            ])
            logger.info(f"[_run_detection_sync] Updated field '{field.name}' with detection results")

        except Exception as e:
            logger.exception(f"[_run_detection_sync] Failed for run {run_id}: {e}")
            run.status = 'failed'
            run.error_message = str(e)
            run.save()
        finally:
            # Close database connection when thread completes
            connection.close()


class TreeDetectionRunViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoints for detection run status and results.

    list:   GET /api/detection-runs/
    detail: GET /api/detection-runs/{id}/
    trees:  GET /api/detection-runs/{id}/trees/
    """
    permission_classes = [permissions.IsAuthenticated, HasCompanyAccess]

    def get_serializer_class(self):
        if self.action == 'list':
            return TreeDetectionRunListSerializer
        return TreeDetectionRunSerializer

    def get_queryset(self):
        queryset = TreeDetectionRun.objects.filter(
            satellite_image__company=self.request.user.current_company
        ).select_related('satellite_image', 'field', 'reviewed_by')

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by field
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        # Filter by image
        image_id = self.request.query_params.get('satellite_image')
        if image_id:
            queryset = queryset.filter(satellite_image_id=image_id)

        return queryset

    @action(detail=True, methods=['get'])
    def trees(self, request, pk=None):
        """
        Get all detected trees for a detection run.

        GET /api/detection-runs/{id}/trees/
        Query params:
        - format=geojson  - Return as GeoJSON FeatureCollection
        - status=active   - Filter by tree status
        """
        run = self.get_object()
        trees = run.trees.all()

        # Filter by status if provided
        status_filter = request.query_params.get('status')
        if status_filter:
            trees = trees.filter(status=status_filter)

        # Return as GeoJSON if requested
        if request.query_params.get('format') == 'geojson':
            serializer = DetectedTreeGeoJSONSerializer()
            return Response(serializer.to_representation(trees))

        serializer = DetectedTreeSerializer(trees, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Approve detection run results and update field with counts.

        POST /api/detection-runs/{id}/approve/
        Body: {"review_notes": "Optional notes"}
        """
        run = self.get_object()

        if run.status != 'completed':
            return Response(
                {'error': 'Can only approve completed detection runs.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        run.is_approved = True
        run.reviewed_by = request.user
        run.review_notes = request.data.get('review_notes', '')
        run.save()

        # Update field with latest detection data
        field = run.field
        field.latest_satellite_tree_count = run.tree_count
        field.latest_satellite_trees_per_acre = run.trees_per_acre
        field.satellite_canopy_coverage_percent = run.canopy_coverage_percent
        field.latest_detection_date = run.satellite_image.capture_date
        field.latest_detection_run = run
        field.save()

        return Response({
            'message': 'Detection run approved and field updated.',
            'tree_count': run.tree_count
        })


class DetectedTreeViewSet(viewsets.ModelViewSet):
    """
    API endpoints for individual detected trees.

    Primarily for updating tree status (marking false positives, etc.)
    """
    permission_classes = [permissions.IsAuthenticated, HasCompanyAccess]
    serializer_class = DetectedTreeSerializer

    def get_queryset(self):
        return DetectedTree.objects.filter(
            field__farm__company=self.request.user.current_company
        ).select_related('detection_run', 'field')

    def update(self, request, *args, **kwargs):
        """Only allow updating status, is_verified, and notes."""
        instance = self.get_object()

        # Only allow specific field updates
        allowed_fields = {'status', 'is_verified', 'notes'}
        update_data = {k: v for k, v in request.data.items() if k in allowed_fields}

        for attr, value in update_data.items():
            setattr(instance, attr, value)
        instance.save()

        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# =============================================================================
# FIELD TREE ENDPOINTS (Function-based views for field-centric access)
# =============================================================================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasCompanyAccess])
def field_trees(request, field_id):
    """
    Get current trees for a field from the latest approved detection run.

    GET /api/fields/{field_id}/trees/
    Query params:
    - format=geojson  - Return as GeoJSON FeatureCollection
    - status=active   - Filter by tree status
    - run_id=123      - Get trees from specific run (not just latest)
    """
    field = get_object_or_404(
        Field,
        id=field_id,
        farm__company=request.user.current_company
    )

    # Get specific run or latest approved/completed
    run_id = request.query_params.get('run_id')
    if run_id:
        run = get_object_or_404(TreeDetectionRun, id=run_id, field=field)
    else:
        # First try the approved run
        run = field.latest_detection_run
        # If no approved run, get the latest completed run
        if not run:
            run = TreeDetectionRun.objects.filter(
                field=field,
                status='completed'
            ).order_by('-completed_at').first()

    if not run:
        return Response({'trees': [], 'message': 'No detection runs for this field.'})

    trees = run.trees.all()

    # Filter by status
    status_filter = request.query_params.get('status')
    if status_filter:
        trees = trees.filter(status=status_filter)

    # Return as GeoJSON if requested
    if request.query_params.get('format') == 'geojson':
        serializer = DetectedTreeGeoJSONSerializer()
        return Response(serializer.to_representation(trees))

    serializer = DetectedTreeSerializer(trees, many=True)
    return Response({
        'trees': serializer.data,
        'detection_run_id': run.id,
        'capture_date': run.satellite_image.capture_date,
        'tree_count': run.tree_count
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasCompanyAccess])
def field_tree_summary(request, field_id):
    """
    Get tree count summary for a field, comparing manual vs satellite data.

    GET /api/fields/{field_id}/tree-summary/
    """
    field = get_object_or_404(
        Field,
        id=field_id,
        farm__company=request.user.current_company
    )

    # Calculate count difference if both manual and satellite data exist
    count_diff = None
    count_diff_pct = None
    if field.tree_count and field.latest_satellite_tree_count:
        count_diff = field.latest_satellite_tree_count - field.tree_count
        if field.tree_count > 0:
            count_diff_pct = (count_diff / field.tree_count) * 100

    summary_data = {
        'field_id': field.id,
        'field_name': field.name,
        'total_acres': float(field.total_acres) if field.total_acres else None,

        # Manual data
        'manual_tree_count': field.tree_count,
        'manual_trees_per_acre': float(field.trees_per_acre) if field.trees_per_acre else None,

        # Satellite data
        'satellite_tree_count': field.latest_satellite_tree_count,
        'satellite_trees_per_acre': field.latest_satellite_trees_per_acre,
        'canopy_coverage_percent': field.satellite_canopy_coverage_percent,
        'detection_date': field.latest_detection_date,
        'detection_run_id': field.latest_detection_run_id,

        # Comparison
        'count_difference': count_diff,
        'count_difference_percent': round(count_diff_pct, 1) if count_diff_pct else None,
    }

    serializer = FieldTreeSummarySerializer(summary_data)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasCompanyAccess])
def field_detection_history(request, field_id):
    """
    Get all detection runs for a field.

    GET /api/fields/{field_id}/detection-history/
    """
    field = get_object_or_404(
        Field,
        id=field_id,
        farm__company=request.user.current_company
    )

    runs = TreeDetectionRun.objects.filter(
        field=field
    ).select_related('satellite_image').order_by('-created_at')

    serializer = TreeDetectionRunListSerializer(runs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasCompanyAccess])
def export_trees_geojson(request, field_id):
    """
    Export field trees as GeoJSON file for download.

    GET /api/fields/{field_id}/trees/export/
    """
    field = get_object_or_404(
        Field,
        id=field_id,
        farm__company=request.user.current_company
    )

    run = field.latest_detection_run
    if not run:
        return Response(
            {'error': 'No detection data for this field.'},
            status=status.HTTP_404_NOT_FOUND
        )

    trees = run.trees.filter(status='active')
    serializer = DetectedTreeGeoJSONSerializer()
    geojson = serializer.to_representation(trees)

    # Add metadata to GeoJSON
    geojson['properties'] = {
        'field_name': field.name,
        'field_id': field.id,
        'detection_date': str(run.satellite_image.capture_date),
        'tree_count': run.tree_count,
        'generated_at': str(run.completed_at),
    }

    response = Response(geojson, content_type='application/geo+json')
    response['Content-Disposition'] = f'attachment; filename="{field.name}_trees.geojson"'
    return response
