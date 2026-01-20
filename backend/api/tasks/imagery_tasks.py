"""
Celery tasks for satellite imagery processing and tree detection.

These tasks run asynchronously to handle the computationally intensive
process of analyzing satellite imagery for tree detection.
"""

import logging
import time

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_tree_detection(self, detection_run_id: int):
    """
    Async task to run tree detection on a field.

    This task:
    1. Loads the satellite image and field boundary
    2. Runs the tree detection algorithm
    3. Stores detected trees in the database
    4. Updates the detection run with results

    Args:
        detection_run_id: ID of the TreeDetectionRun to process

    Raises:
        self.retry: On transient failures (up to max_retries)
    """
    from api.models import TreeDetectionRun, DetectedTree
    from api.services.tree_detection import detect_trees, build_detection_params

    start_time = time.time()

    try:
        # Load the detection run with related objects
        run = TreeDetectionRun.objects.select_related(
            'satellite_image',
            'field',
            'field__farm'
        ).get(id=detection_run_id)

        logger.info(f"Starting tree detection for run {run.id}, field: {run.field.name}")

        # Mark as processing
        run.status = 'processing'
        run.save(update_fields=['status'])

        # Get field boundary as GeoJSON
        field_boundary = run.field.boundary_geojson
        if not field_boundary:
            raise ValueError(f"Field {run.field.name} has no boundary defined")

        # Parse detection parameters (field-specific defaults + overrides)
        params = build_detection_params(run.field, run.parameters)

        # Get image file path
        image_path = run.satellite_image.file.path

        logger.info(f"Processing image: {image_path}")
        logger.info(f"Parameters: {params}")

        # Run the detection algorithm
        result = detect_trees(
            image_path=image_path,
            field_boundary_geojson=field_boundary,
            params=params
        )

        logger.info(f"Detection complete. Found {result.tree_count} trees.")

        # Store detected trees
        tree_objects = []
        for tree_data in result.trees:
            tree_objects.append(DetectedTree(
                detection_run=run,
                field=run.field,
                latitude=tree_data['latitude'],
                longitude=tree_data['longitude'],
                pixel_x=tree_data['pixel_x'],
                pixel_y=tree_data['pixel_y'],
                ndvi_value=tree_data.get('ndvi_value'),
                confidence_score=tree_data['confidence_score'],
                canopy_diameter_m=tree_data.get('canopy_diameter_m'),
            ))

        # Bulk create trees for efficiency
        if tree_objects:
            DetectedTree.objects.bulk_create(tree_objects, batch_size=1000)
            logger.info(f"Stored {len(tree_objects)} detected trees")

        # Calculate processing time
        processing_time = time.time() - start_time

        # Update run with results
        run.status = 'completed'
        run.completed_at = timezone.now()
        run.tree_count = result.tree_count
        run.trees_per_acre = result.trees_per_acre
        run.avg_canopy_diameter_m = result.avg_canopy_diameter_m
        run.canopy_coverage_percent = result.canopy_coverage_percent
        run.vegetation_index = result.vegetation_index
        run.processing_time_seconds = processing_time
        run.save()

        logger.info(f"Detection run {run.id} completed in {processing_time:.2f}s")

        return {
            'run_id': run.id,
            'tree_count': result.tree_count,
            'processing_time': processing_time,
            'status': 'completed'
        }

    except TreeDetectionRun.DoesNotExist:
        logger.error(f"Detection run {detection_run_id} not found")
        raise

    except Exception as e:
        logger.error(f"Tree detection failed for run {detection_run_id}: {str(e)}")

        # Try to update the run with error status
        try:
            run = TreeDetectionRun.objects.get(id=detection_run_id)
            run.status = 'failed'
            run.error_message = str(e)
            run.processing_time_seconds = time.time() - start_time
            run.save()
        except Exception as save_error:
            logger.error(f"Failed to save error status: {save_error}")

        # Retry on certain transient errors
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying task (attempt {self.request.retries + 1}/{self.max_retries})")
            raise self.retry(exc=e)

        # Final failure
        raise


@shared_task
def cleanup_old_detection_runs(days_old: int = 90):
    """
    Periodic task to clean up old unapproved detection runs.

    Removes detection runs that:
    - Are older than specified days
    - Were never approved
    - Are in 'failed' or 'completed' status

    This helps manage storage by removing results that users
    never acted upon.

    Args:
        days_old: Number of days after which to consider runs for cleanup
    """
    from api.models import TreeDetectionRun
    from datetime import timedelta

    cutoff_date = timezone.now() - timedelta(days=days_old)

    # Find old unapproved runs
    old_runs = TreeDetectionRun.objects.filter(
        created_at__lt=cutoff_date,
        is_approved=False,
        status__in=['completed', 'failed']
    )

    count = old_runs.count()

    if count > 0:
        logger.info(f"Cleaning up {count} old detection runs (older than {days_old} days)")
        # Delete will cascade to DetectedTree records
        old_runs.delete()

    return {'deleted_count': count}


@shared_task
def reprocess_detection_run(detection_run_id: int, new_parameters: dict = None):
    """
    Reprocess a detection run with optionally updated parameters.

    Creates a new detection run based on an existing one, allowing
    users to try different parameters without losing the original results.

    Args:
        detection_run_id: ID of the original detection run
        new_parameters: Optional new detection parameters

    Returns:
        New detection run ID
    """
    from api.models import TreeDetectionRun

    # Get original run
    original_run = TreeDetectionRun.objects.select_related(
        'satellite_image', 'field'
    ).get(id=detection_run_id)

    # Create new run with potentially different parameters
    new_run = TreeDetectionRun.objects.create(
        satellite_image=original_run.satellite_image,
        field=original_run.field,
        parameters=new_parameters if new_parameters else original_run.parameters,
    )

    # Trigger processing
    process_tree_detection.delay(new_run.id)

    return {'new_run_id': new_run.id}
