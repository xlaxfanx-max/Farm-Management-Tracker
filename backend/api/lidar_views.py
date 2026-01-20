"""
API ViewSets for LiDAR point cloud processing.

Endpoints:
- /api/lidar-datasets/                 - CRUD for LiDAR datasets
- /api/lidar-datasets/{id}/coverage/   - Get covered fields
- /api/lidar-datasets/{id}/process/    - Trigger processing for fields
- /api/lidar-runs/                     - View processing run status/results
- /api/lidar-runs/{id}/trees/          - Get detected trees for a run
- /api/lidar-runs/{id}/terrain/        - Get terrain analysis
- /api/lidar-runs/{id}/approve/        - Approve run and update field
- /api/fields/{id}/lidar-trees/        - Get LiDAR trees for a field
- /api/fields/{id}/lidar-summary/      - Compare satellite vs LiDAR
- /api/fields/{id}/terrain/            - Get terrain analysis for field
- /api/fields/{id}/frost-risk/         - Get frost risk zones
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .permissions import HasCompanyAccess
from .models import (
    LiDARDataset, LiDARProcessingRun, LiDARDetectedTree, TerrainAnalysis, Field
)
from .serializers import (
    LiDARDatasetSerializer,
    LiDARDatasetListSerializer,
    LiDARDatasetUploadSerializer,
    LiDARProcessingRunSerializer,
    LiDARProcessingRunListSerializer,
    LiDARProcessingRunCreateSerializer,
    LiDARDetectedTreeSerializer,
    LiDARDetectedTreeGeoJSONSerializer,
    TerrainAnalysisSerializer,
    FieldLiDARSummarySerializer,
)


class LiDARDatasetViewSet(viewsets.ModelViewSet):
    """
    API endpoints for LiDAR dataset management.

    list:   GET    /api/lidar-datasets/
    create: POST   /api/lidar-datasets/
    detail: GET    /api/lidar-datasets/{id}/
    delete: DELETE /api/lidar-datasets/{id}/
    """
    permission_classes = [permissions.IsAuthenticated, HasCompanyAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.action == 'list':
            return LiDARDatasetListSerializer
        if self.action == 'create':
            return LiDARDatasetUploadSerializer
        return LiDARDatasetSerializer

    def get_queryset(self):
        queryset = LiDARDataset.objects.filter(
            company=self.request.user.current_company
        ).select_related('farm', 'uploaded_by')

        # Filter by farm if provided
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        # Filter by status if provided
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=['get'])
    def coverage(self, request, pk=None):
        """
        Get list of fields covered by this LiDAR dataset.

        GET /api/lidar-datasets/{id}/coverage/
        """
        dataset = self.get_object()

        if not dataset.farm:
            return Response({
                'covered_fields': [],
                'message': 'No farm associated with this dataset.'
            })

        fields = Field.objects.filter(farm=dataset.farm, active=True)
        covered = []

        for field in fields:
            is_covered = dataset.covers_field(field)
            covered.append({
                'id': field.id,
                'name': field.name,
                'has_boundary': bool(field.boundary_geojson),
                'total_acres': float(field.total_acres) if field.total_acres else None,
                'is_covered': is_covered,
            })

        return Response({
            'dataset_id': dataset.id,
            'dataset_name': dataset.name,
            'covered_fields': [f for f in covered if f['is_covered']],
            'all_fields': covered,
        })

    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """
        Start LiDAR processing for specified fields.

        POST /api/lidar-datasets/{id}/process/
        Body: {
            "field_ids": [1, 2, 3],
            "processing_type": "FULL",  // TREE_DETECTION, TERRAIN_ANALYSIS, or FULL
            "parameters": {}
        }

        Returns run IDs for tracking status.
        """
        import logging
        logger = logging.getLogger(__name__)

        try:
            dataset = self.get_object()

            if dataset.status not in ['ready', 'validated', 'uploaded']:
                return Response(
                    {'error': f'Dataset is not ready for processing (status: {dataset.status})'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate input
            field_ids = request.data.get('field_ids', [])
            processing_type = request.data.get('processing_type', 'FULL')
            parameters = request.data.get('parameters', {})

            if not field_ids:
                return Response(
                    {'error': 'field_ids is required.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate processing type
            valid_types = ['TREE_DETECTION', 'TERRAIN_ANALYSIS', 'FULL']
            if processing_type not in valid_types:
                return Response(
                    {'error': f'Invalid processing_type. Must be one of: {valid_types}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate fields belong to user's company and have boundaries
            fields = Field.objects.filter(
                id__in=field_ids,
                farm__company=request.user.current_company,
                active=True
            )

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

            # Check fields are covered by dataset
            fields_not_covered = [f.name for f in fields if not dataset.covers_field(f)]
            if fields_not_covered:
                return Response(
                    {
                        'error': 'Fields not covered by this LiDAR dataset',
                        'fields': fields_not_covered
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create processing runs
            runs = []
            for field in fields:
                run = LiDARProcessingRun.objects.create(
                    lidar_dataset=dataset,
                    field=field,
                    processing_type=processing_type,
                    parameters=parameters,
                )
                runs.append(run)
                logger.info(f"Created LiDAR processing run {run.id} for field '{field.name}'")

                # Trigger async processing - try Celery first, fall back to threading
                use_threading = False
                try:
                    from .tasks.lidar_tasks import process_lidar_for_field
                    process_lidar_for_field.delay(run.id)
                    logger.info(f"Started Celery task for LiDAR run {run.id}")
                except ImportError:
                    logger.info("Celery not installed, using threading for LiDAR")
                    use_threading = True
                except Exception as celery_err:
                    logger.warning(f"Celery failed ({celery_err}), using threading for LiDAR")
                    use_threading = True

                if use_threading:
                    import threading
                    thread = threading.Thread(
                        target=self._run_lidar_processing_sync,
                        args=(run.id,)
                    )
                    thread.daemon = True
                    thread.start()
                    logger.info(f"Started thread for LiDAR run {run.id}")

            return Response({
                'message': f'Started LiDAR processing for {len(runs)} field(s)',
                'run_ids': [r.id for r in runs]
            }, status=status.HTTP_202_ACCEPTED)

        except Exception as e:
            import logging
            logging.getLogger(__name__).exception(f"Error starting LiDAR processing: {e}")
            return Response(
                {'error': f'Failed to start processing: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _run_lidar_processing_sync(self, run_id):
        """Synchronous LiDAR processing for development/testing when Celery unavailable."""
        from .services.lidar_processing import run_full_analysis, LiDARProcessingParams
        from django.conf import settings
        from django.db import connection
        import time
        import os
        import logging
        logger = logging.getLogger(__name__)

        start_time = time.time()
        logger.info(f"[_run_lidar_processing_sync] Starting processing for run {run_id}")

        try:
            # Close any stale connection from parent thread
            connection.close()

            # Fetch fresh objects in this thread
            run = LiDARProcessingRun.objects.select_related(
                'lidar_dataset', 'field', 'field__farm'
            ).get(id=run_id)

            run.status = 'processing'
            run.save()

            # Parse parameters
            params = LiDARProcessingParams()
            if run.parameters:
                for key, value in run.parameters.items():
                    if hasattr(params, key):
                        setattr(params, key, value)

            # Create output directory
            output_dir = os.path.join(
                settings.MEDIA_ROOT,
                'lidar_products',
                timezone.now().strftime('%Y/%m'),
                f"run_{run.id}"
            )
            os.makedirs(output_dir, exist_ok=True)

            # Run processing
            result = run_full_analysis(
                laz_path=run.lidar_dataset.file.path,
                field=run.field,
                output_dir=output_dir,
                params=params,
                processing_type=run.processing_type,
            )

            # Store detected trees
            if result.trees:
                tree_objects = [
                    LiDARDetectedTree(
                        processing_run=run,
                        field=run.field,
                        latitude=t['latitude'],
                        longitude=t['longitude'],
                        height_m=t['height_m'],
                        canopy_diameter_m=t.get('canopy_diameter_m'),
                        canopy_area_sqm=t.get('canopy_area_sqm'),
                        ground_elevation_m=t.get('ground_elevation_m'),
                    )
                    for t in result.trees
                ]
                LiDARDetectedTree.objects.bulk_create(tree_objects, batch_size=1000)

            # Store terrain analysis
            if result.terrain:
                terrain = result.terrain
                TerrainAnalysis.objects.create(
                    processing_run=run,
                    field=run.field,
                    min_elevation_m=terrain.min_elevation_m,
                    max_elevation_m=terrain.max_elevation_m,
                    mean_elevation_m=terrain.mean_elevation_m,
                    mean_slope_degrees=terrain.mean_slope_degrees,
                    max_slope_degrees=terrain.max_slope_degrees,
                    slope_aspect_dominant=terrain.slope_aspect_dominant,
                    slope_0_2_percent=terrain.slope_distribution.get('slope_0_2_percent'),
                    slope_2_5_percent=terrain.slope_distribution.get('slope_2_5_percent'),
                    slope_5_10_percent=terrain.slope_distribution.get('slope_5_10_percent'),
                    slope_over_10_percent=terrain.slope_distribution.get('slope_over_10_percent'),
                    frost_risk_zones=terrain.frost_risk_zones,
                    frost_risk_summary=terrain.frost_risk_summary,
                    drainage_direction=terrain.drainage_direction,
                    low_spot_count=terrain.low_spot_count,
                )

            # Save generated files
            if result.dtm_path and os.path.exists(result.dtm_path):
                run.dtm_file.name = os.path.relpath(result.dtm_path, settings.MEDIA_ROOT)
            if result.dsm_path and os.path.exists(result.dsm_path):
                run.dsm_file.name = os.path.relpath(result.dsm_path, settings.MEDIA_ROOT)
            if result.chm_path and os.path.exists(result.chm_path):
                run.chm_file.name = os.path.relpath(result.chm_path, settings.MEDIA_ROOT)

            # Update run with results
            run.status = 'completed'
            run.completed_at = timezone.now()
            run.processing_time_seconds = int(time.time() - start_time)
            run.tree_count = result.tree_count
            run.trees_per_acre = result.trees_per_acre
            run.avg_tree_height_m = result.avg_tree_height_m
            run.max_tree_height_m = result.max_tree_height_m
            run.min_tree_height_m = result.min_tree_height_m
            run.avg_canopy_diameter_m = result.avg_canopy_diameter_m
            run.canopy_coverage_percent = result.canopy_coverage_percent

            if result.terrain:
                run.avg_slope_degrees = result.terrain.mean_slope_degrees
                run.max_slope_degrees = result.terrain.max_slope_degrees
                run.elevation_range_m = result.terrain.max_elevation_m - result.terrain.min_elevation_m

            run.save()
            logger.info(f"[_run_lidar_processing_sync] Completed! Found {result.tree_count} trees")

        except Exception as e:
            logger.exception(f"[_run_lidar_processing_sync] Failed for run {run_id}: {e}")
            try:
                run = LiDARProcessingRun.objects.get(id=run_id)
                run.status = 'failed'
                run.error_message = str(e)
                run.save()
            except Exception:
                pass
        finally:
            connection.close()

    @action(detail=True, methods=['post'])
    def revalidate(self, request, pk=None):
        """
        Re-run validation on a dataset (useful if validation failed).

        POST /api/lidar-datasets/{id}/revalidate/
        """
        dataset = self.get_object()

        # Reset status
        dataset.status = 'uploaded'
        dataset.error_message = ''
        dataset.save()

        # Trigger validation task
        try:
            from .tasks.lidar_tasks import validate_lidar_dataset
            validate_lidar_dataset.delay(dataset.id)
            return Response({
                'message': 'Validation restarted',
                'dataset_id': dataset.id
            })
        except Exception as e:
            return Response(
                {'error': f'Failed to start validation: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LiDARProcessingRunViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoints for LiDAR processing run status and results.

    list:   GET /api/lidar-runs/
    detail: GET /api/lidar-runs/{id}/
    trees:  GET /api/lidar-runs/{id}/trees/
    terrain: GET /api/lidar-runs/{id}/terrain/
    approve: POST /api/lidar-runs/{id}/approve/
    """
    permission_classes = [permissions.IsAuthenticated, HasCompanyAccess]

    def get_serializer_class(self):
        if self.action == 'list':
            return LiDARProcessingRunListSerializer
        return LiDARProcessingRunSerializer

    def get_queryset(self):
        queryset = LiDARProcessingRun.objects.filter(
            lidar_dataset__company=self.request.user.current_company
        ).select_related('lidar_dataset', 'field', 'approved_by')

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by field
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        # Filter by dataset
        dataset_id = self.request.query_params.get('lidar_dataset')
        if dataset_id:
            queryset = queryset.filter(lidar_dataset_id=dataset_id)

        return queryset

    @action(detail=True, methods=['get'])
    def trees(self, request, pk=None):
        """
        Get all detected trees for a processing run.

        GET /api/lidar-runs/{id}/trees/
        Query params:
        - format=geojson  - Return as GeoJSON FeatureCollection
        - status=active   - Filter by tree status
        """
        run = self.get_object()
        trees = run.detected_trees.all()

        # Filter by status if provided
        status_filter = request.query_params.get('status')
        if status_filter:
            trees = trees.filter(status=status_filter)

        # Return as GeoJSON if requested
        if request.query_params.get('format') == 'geojson':
            serializer = LiDARDetectedTreeGeoJSONSerializer()
            return Response(serializer.to_representation(trees))

        serializer = LiDARDetectedTreeSerializer(trees, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def terrain(self, request, pk=None):
        """
        Get terrain analysis for a processing run.

        GET /api/lidar-runs/{id}/terrain/
        """
        run = self.get_object()

        try:
            terrain = run.terrain_analysis
            serializer = TerrainAnalysisSerializer(terrain)
            return Response(serializer.data)
        except TerrainAnalysis.DoesNotExist:
            return Response(
                {'error': 'No terrain analysis for this run.'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Approve processing run results and update field with counts.

        POST /api/lidar-runs/{id}/approve/
        Body: {"review_notes": "Optional notes"}
        """
        run = self.get_object()

        if run.status != 'completed':
            return Response(
                {'error': 'Can only approve completed processing runs.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if run.is_approved:
            return Response(
                {'error': 'This run is already approved.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mark as approved
        run.is_approved = True
        run.approved_by = request.user
        run.approved_at = timezone.now()
        run.review_notes = request.data.get('review_notes', '')
        run.save()

        # Update field with LiDAR data
        field = run.field
        field.lidar_tree_count = run.tree_count
        field.lidar_trees_per_acre = run.trees_per_acre
        field.lidar_avg_tree_height_m = run.avg_tree_height_m
        field.lidar_canopy_coverage_percent = run.canopy_coverage_percent
        field.lidar_detection_date = run.lidar_dataset.capture_date
        field.latest_lidar_run = run

        # Update terrain fields if available
        if run.avg_slope_degrees is not None:
            field.avg_slope_degrees = run.avg_slope_degrees

        try:
            terrain = run.terrain_analysis
            if terrain:
                field.primary_aspect = terrain.slope_aspect_dominant

                # Determine frost risk level
                summary = terrain.frost_risk_summary
                if summary:
                    high_pct = summary.get('high_percent', 0)
                    medium_pct = summary.get('medium_percent', 0)

                    if high_pct > 30:
                        field.frost_risk_level = 'high'
                    elif high_pct > 10 or medium_pct > 50:
                        field.frost_risk_level = 'medium'
                    else:
                        field.frost_risk_level = 'low'
        except TerrainAnalysis.DoesNotExist:
            pass

        field.save()

        return Response({
            'message': 'LiDAR processing run approved and field updated.',
            'tree_count': run.tree_count,
            'avg_height_m': run.avg_tree_height_m,
        })


class LiDARDetectedTreeViewSet(viewsets.ModelViewSet):
    """
    API endpoints for individual LiDAR-detected trees.

    Primarily for updating tree status (marking false positives, etc.)
    """
    permission_classes = [permissions.IsAuthenticated, HasCompanyAccess]
    serializer_class = LiDARDetectedTreeSerializer

    def get_queryset(self):
        return LiDARDetectedTree.objects.filter(
            field__farm__company=self.request.user.current_company
        ).select_related('processing_run', 'field')

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
# FIELD LIDAR ENDPOINTS (Function-based views for field-centric access)
# =============================================================================

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasCompanyAccess])
def field_lidar_trees(request, field_id):
    """
    Get LiDAR-detected trees for a field from the latest approved run.

    GET /api/fields/{field_id}/lidar-trees/
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
        run = get_object_or_404(LiDARProcessingRun, id=run_id, field=field)
    else:
        # First try the approved run
        run = field.latest_lidar_run
        # If no approved run, get the latest completed run
        if not run:
            run = LiDARProcessingRun.objects.filter(
                field=field,
                status='completed'
            ).order_by('-completed_at').first()

    if not run:
        return Response({
            'trees': [],
            'message': 'No LiDAR processing runs for this field.'
        })

    trees = run.detected_trees.all()

    # Filter by status
    status_filter = request.query_params.get('status')
    if status_filter:
        trees = trees.filter(status=status_filter)

    # Return as GeoJSON if requested
    if request.query_params.get('format') == 'geojson':
        serializer = LiDARDetectedTreeGeoJSONSerializer()
        return Response(serializer.to_representation(trees))

    serializer = LiDARDetectedTreeSerializer(trees, many=True)
    return Response({
        'trees': serializer.data,
        'processing_run_id': run.id,
        'capture_date': run.lidar_dataset.capture_date,
        'tree_count': run.tree_count,
        'avg_height_m': run.avg_tree_height_m,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasCompanyAccess])
def field_lidar_summary(request, field_id):
    """
    Get comprehensive tree/terrain summary comparing satellite vs LiDAR data.

    GET /api/fields/{field_id}/lidar-summary/
    """
    field = get_object_or_404(
        Field,
        id=field_id,
        farm__company=request.user.current_company
    )

    # Calculate satellite vs LiDAR difference
    sat_vs_lidar_diff = None
    sat_vs_lidar_diff_pct = None

    if field.latest_satellite_tree_count and field.lidar_tree_count:
        sat_vs_lidar_diff = field.lidar_tree_count - field.latest_satellite_tree_count
        if field.latest_satellite_tree_count > 0:
            sat_vs_lidar_diff_pct = (sat_vs_lidar_diff / field.latest_satellite_tree_count) * 100

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
        'satellite_canopy_coverage_percent': field.satellite_canopy_coverage_percent,
        'satellite_detection_date': field.latest_detection_date,

        # LiDAR data
        'lidar_tree_count': field.lidar_tree_count,
        'lidar_trees_per_acre': field.lidar_trees_per_acre,
        'lidar_avg_tree_height_m': field.lidar_avg_tree_height_m,
        'lidar_canopy_coverage_percent': field.lidar_canopy_coverage_percent,
        'lidar_detection_date': field.lidar_detection_date,

        # Terrain data
        'avg_slope_degrees': field.avg_slope_degrees,
        'primary_aspect': field.primary_aspect,
        'frost_risk_level': field.frost_risk_level,

        # Comparison
        'satellite_vs_lidar_diff': sat_vs_lidar_diff,
        'satellite_vs_lidar_diff_percent': round(sat_vs_lidar_diff_pct, 1) if sat_vs_lidar_diff_pct else None,
    }

    serializer = FieldLiDARSummarySerializer(summary_data)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasCompanyAccess])
def field_terrain(request, field_id):
    """
    Get terrain analysis for a field.

    GET /api/fields/{field_id}/terrain/
    """
    field = get_object_or_404(
        Field,
        id=field_id,
        farm__company=request.user.current_company
    )

    # Get terrain from latest approved LiDAR run
    run = field.latest_lidar_run
    if not run:
        run = LiDARProcessingRun.objects.filter(
            field=field,
            status='completed'
        ).order_by('-completed_at').first()

    if not run:
        return Response(
            {'error': 'No LiDAR processing runs for this field.'},
            status=status.HTTP_404_NOT_FOUND
        )

    try:
        terrain = run.terrain_analysis
        serializer = TerrainAnalysisSerializer(terrain)
        return Response(serializer.data)
    except TerrainAnalysis.DoesNotExist:
        return Response(
            {'error': 'No terrain analysis available for this field.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasCompanyAccess])
def field_frost_risk(request, field_id):
    """
    Get frost risk zones for a field as GeoJSON.

    GET /api/fields/{field_id}/frost-risk/
    """
    field = get_object_or_404(
        Field,
        id=field_id,
        farm__company=request.user.current_company
    )

    # Get terrain from latest approved LiDAR run
    run = field.latest_lidar_run
    if not run:
        run = LiDARProcessingRun.objects.filter(
            field=field,
            status='completed'
        ).order_by('-completed_at').first()

    if not run:
        return Response(
            {'error': 'No LiDAR processing runs for this field.'},
            status=status.HTTP_404_NOT_FOUND
        )

    try:
        terrain = run.terrain_analysis

        return Response({
            'field_id': field.id,
            'field_name': field.name,
            'frost_risk_level': field.frost_risk_level,
            'frost_risk_zones': terrain.frost_risk_zones,
            'frost_risk_summary': terrain.frost_risk_summary,
            'mean_elevation_m': terrain.mean_elevation_m,
            'elevation_range_m': terrain.max_elevation_m - terrain.min_elevation_m,
        })
    except TerrainAnalysis.DoesNotExist:
        return Response(
            {'error': 'No terrain analysis available for frost risk.'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasCompanyAccess])
def field_lidar_history(request, field_id):
    """
    Get all LiDAR processing runs for a field.

    GET /api/fields/{field_id}/lidar-history/
    """
    field = get_object_or_404(
        Field,
        id=field_id,
        farm__company=request.user.current_company
    )

    runs = LiDARProcessingRun.objects.filter(
        field=field
    ).select_related('lidar_dataset').order_by('-created_at')

    serializer = LiDARProcessingRunListSerializer(runs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, HasCompanyAccess])
def export_lidar_trees_geojson(request, field_id):
    """
    Export LiDAR-detected field trees as GeoJSON file for download.

    GET /api/fields/{field_id}/lidar-trees/export/
    """
    field = get_object_or_404(
        Field,
        id=field_id,
        farm__company=request.user.current_company
    )

    run = field.latest_lidar_run
    if not run:
        return Response(
            {'error': 'No LiDAR detection data for this field.'},
            status=status.HTTP_404_NOT_FOUND
        )

    trees = run.detected_trees.filter(status='active')
    serializer = LiDARDetectedTreeGeoJSONSerializer()
    geojson = serializer.to_representation(trees)

    # Add metadata to GeoJSON
    geojson['properties'] = {
        'field_name': field.name,
        'field_id': field.id,
        'detection_date': str(run.lidar_dataset.capture_date) if run.lidar_dataset.capture_date else None,
        'tree_count': run.tree_count,
        'avg_height_m': run.avg_tree_height_m,
        'generated_at': str(run.completed_at),
        'data_source': 'LiDAR',
    }

    response = Response(geojson, content_type='application/geo+json')
    response['Content-Disposition'] = f'attachment; filename="{field.name}_lidar_trees.geojson"'
    return response
