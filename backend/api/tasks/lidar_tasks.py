"""
Celery tasks for LiDAR point cloud processing.

These tasks run asynchronously to handle the computationally intensive
process of generating DTM/DSM/CHM and detecting trees from LiDAR data.
"""

import logging
import time
import os
import tempfile
from pathlib import Path

from celery import shared_task
from django.utils import timezone
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_lidar_for_field(self, run_id: int):
    """
    Async task to process LiDAR data for a field.

    This task:
    1. Loads the LiDAR dataset and field boundary
    2. Generates DTM, DSM, and CHM rasters
    3. Runs tree detection from CHM
    4. Performs terrain analysis
    5. Stores results in the database

    Args:
        run_id: ID of the LiDARProcessingRun to process

    Raises:
        self.retry: On transient failures (up to max_retries)
    """
    from api.models import LiDARProcessingRun, LiDARDetectedTree, TerrainAnalysis
    from api.services.lidar_processing import (
        run_full_analysis,
        LiDARProcessingParams,
    )

    start_time = time.time()

    try:
        # Load the processing run with related objects
        run = LiDARProcessingRun.objects.select_related(
            'lidar_dataset',
            'field',
            'field__farm'
        ).get(id=run_id)

        logger.info(f"Starting LiDAR processing for run {run.id}, field: {run.field.name}")

        # Mark as processing
        run.status = 'processing'
        run.save(update_fields=['status'])

        # Validate inputs
        field = run.field
        if not field.boundary_geojson:
            raise ValueError(f"Field {field.name} has no boundary defined")

        lidar_dataset = run.lidar_dataset
        if lidar_dataset.status != 'ready':
            raise ValueError(f"LiDAR dataset is not ready (status: {lidar_dataset.status})")

        # Get LiDAR file path
        laz_path = lidar_dataset.file.path
        if not os.path.exists(laz_path):
            raise FileNotFoundError(f"LiDAR file not found: {laz_path}")

        logger.info(f"Processing LiDAR file: {laz_path}")

        # Parse processing parameters
        params = LiDARProcessingParams()
        if run.parameters:
            # Update params with any custom values
            for key, value in run.parameters.items():
                if hasattr(params, key):
                    setattr(params, key, value)

        logger.info(f"Parameters: resolution={params.chm_resolution_m}m, "
                   f"min_height={params.min_tree_height_m}m, "
                   f"min_spacing={params.min_tree_spacing_m}m")

        # Create output directory
        output_dir = os.path.join(
            settings.MEDIA_ROOT,
            'lidar_products',
            timezone.now().strftime('%Y/%m'),
            f"run_{run.id}"
        )
        os.makedirs(output_dir, exist_ok=True)

        # Run the full analysis pipeline
        result = run_full_analysis(
            laz_path=laz_path,
            field=field,
            output_dir=output_dir,
            params=params,
            processing_type=run.processing_type,
        )

        logger.info(f"Processing complete. Found {result.tree_count} trees.")

        # Store detected trees
        if result.trees:
            tree_objects = []
            for tree_data in result.trees:
                tree_objects.append(LiDARDetectedTree(
                    processing_run=run,
                    field=field,
                    latitude=tree_data['latitude'],
                    longitude=tree_data['longitude'],
                    height_m=tree_data['height_m'],
                    canopy_diameter_m=tree_data.get('canopy_diameter_m'),
                    canopy_area_sqm=tree_data.get('canopy_area_sqm'),
                    ground_elevation_m=tree_data.get('ground_elevation_m'),
                ))

            # Bulk create trees for efficiency
            LiDARDetectedTree.objects.bulk_create(tree_objects, batch_size=1000)
            logger.info(f"Stored {len(tree_objects)} detected trees")

        # Store terrain analysis
        if result.terrain and run.processing_type in ['TERRAIN_ANALYSIS', 'FULL']:
            terrain = result.terrain
            TerrainAnalysis.objects.create(
                processing_run=run,
                field=field,
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
            logger.info("Stored terrain analysis")

        # Calculate processing time
        processing_time = time.time() - start_time

        # Save generated files to model (using relative paths for FileField)
        if result.dtm_path and os.path.exists(result.dtm_path):
            relative_path = os.path.relpath(result.dtm_path, settings.MEDIA_ROOT)
            run.dtm_file.name = relative_path

        if result.dsm_path and os.path.exists(result.dsm_path):
            relative_path = os.path.relpath(result.dsm_path, settings.MEDIA_ROOT)
            run.dsm_file.name = relative_path

        if result.chm_path and os.path.exists(result.chm_path):
            relative_path = os.path.relpath(result.chm_path, settings.MEDIA_ROOT)
            run.chm_file.name = relative_path

        # Update run with results
        run.status = 'completed'
        run.completed_at = timezone.now()
        run.processing_time_seconds = int(processing_time)

        # Tree detection results
        run.tree_count = result.tree_count
        run.trees_per_acre = result.trees_per_acre
        run.avg_tree_height_m = result.avg_tree_height_m
        run.max_tree_height_m = result.max_tree_height_m
        run.min_tree_height_m = result.min_tree_height_m
        run.avg_canopy_diameter_m = result.avg_canopy_diameter_m
        run.canopy_coverage_percent = result.canopy_coverage_percent

        # Terrain results (summary)
        if result.terrain:
            run.avg_slope_degrees = result.terrain.mean_slope_degrees
            run.max_slope_degrees = result.terrain.max_slope_degrees
            run.elevation_range_m = result.terrain.max_elevation_m - result.terrain.min_elevation_m

        run.save()

        logger.info(f"LiDAR processing run {run.id} completed in {processing_time:.2f}s")

        return {
            'run_id': run.id,
            'tree_count': result.tree_count,
            'processing_time': processing_time,
            'status': 'completed'
        }

    except LiDARProcessingRun.DoesNotExist:
        logger.error(f"LiDAR processing run {run_id} not found")
        raise

    except Exception as e:
        logger.error(f"LiDAR processing failed for run {run_id}: {str(e)}", exc_info=True)

        # Try to update the run with error status
        try:
            run = LiDARProcessingRun.objects.get(id=run_id)
            run.status = 'failed'
            run.error_message = str(e)
            run.processing_time_seconds = int(time.time() - start_time)
            run.save()
        except Exception as save_error:
            logger.error(f"Failed to save error status: {save_error}")

        # Retry on certain transient errors
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying task (attempt {self.request.retries + 1}/{self.max_retries})")
            raise self.retry(exc=e)

        # Final failure
        raise


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def validate_lidar_dataset(self, dataset_id: int):
    """
    Async task to validate an uploaded LiDAR dataset.

    This task:
    1. Reads the LAZ/LAS file header
    2. Extracts metadata (bounds, CRS, point count, etc.)
    3. Updates the dataset record with metadata
    4. Sets status to 'ready' or 'error'

    Args:
        dataset_id: ID of the LiDARDataset to validate

    Returns:
        Dictionary with validation results
    """
    from api.models import LiDARDataset
    from api.services.lidar_processing import (
        extract_laz_metadata,
        transform_bounds_to_wgs84,
    )

    try:
        dataset = LiDARDataset.objects.get(id=dataset_id)

        logger.info(f"Validating LiDAR dataset {dataset.id}: {dataset.name}")

        # Mark as validating
        dataset.status = 'validating'
        dataset.save(update_fields=['status'])

        # Get file path
        file_path = dataset.file.path
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"LiDAR file not found: {file_path}")

        # Extract metadata
        metadata = extract_laz_metadata(file_path)

        logger.info(f"Extracted metadata: {metadata.point_count} points, "
                   f"density={metadata.point_density_per_sqm:.1f} pts/m²")

        # Transform bounds to WGS84 if needed
        bounds_wgs84 = (
            metadata.bounds_west,
            metadata.bounds_south,
            metadata.bounds_east,
            metadata.bounds_north
        )

        # If CRS is not geographic, try to transform
        if metadata.crs and 'EPSG:4326' not in metadata.crs.upper():
            try:
                transformed = transform_bounds_to_wgs84(
                    (metadata.bounds_west, metadata.bounds_south,
                     metadata.bounds_east, metadata.bounds_north),
                    metadata.crs
                )
                bounds_wgs84 = transformed
            except Exception as e:
                logger.warning(f"Could not transform bounds to WGS84: {e}")

        # Update dataset with metadata
        dataset.point_count = metadata.point_count
        dataset.point_density_per_sqm = metadata.point_density_per_sqm
        dataset.crs = metadata.crs
        dataset.bounds_west = bounds_wgs84[0]
        dataset.bounds_south = bounds_wgs84[1]
        dataset.bounds_east = bounds_wgs84[2]
        dataset.bounds_north = bounds_wgs84[3]
        dataset.has_classification = metadata.has_classification
        dataset.file_size_mb = metadata.file_size_mb
        dataset.metadata_json = {
            'min_z': metadata.min_z,
            'max_z': metadata.max_z,
            'classification_counts': metadata.classification_counts,
            'original_crs': metadata.crs,
        }
        dataset.status = 'ready'
        dataset.error_message = ''
        dataset.save()

        logger.info(f"LiDAR dataset {dataset.id} validated successfully")

        return {
            'dataset_id': dataset.id,
            'status': 'ready',
            'point_count': metadata.point_count,
            'has_classification': metadata.has_classification,
        }

    except LiDARDataset.DoesNotExist:
        logger.error(f"LiDAR dataset {dataset_id} not found")
        raise

    except Exception as e:
        logger.error(f"LiDAR validation failed for dataset {dataset_id}: {str(e)}", exc_info=True)

        # Update dataset with error status
        try:
            dataset = LiDARDataset.objects.get(id=dataset_id)
            dataset.status = 'error'
            dataset.error_message = str(e)
            dataset.save()
        except Exception as save_error:
            logger.error(f"Failed to save error status: {save_error}")

        # Retry on transient errors
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying validation (attempt {self.request.retries + 1}/{self.max_retries})")
            raise self.retry(exc=e)

        raise


@shared_task
def cleanup_old_lidar_runs(days_old: int = 90):
    """
    Periodic task to clean up old unapproved LiDAR processing runs.

    Removes runs that:
    - Are older than specified days
    - Were never approved
    - Are in 'failed' or 'completed' status

    Also cleans up associated files (DTM, DSM, CHM).

    Args:
        days_old: Number of days after which to consider runs for cleanup

    Returns:
        Dictionary with cleanup statistics
    """
    from api.models import LiDARProcessingRun
    from datetime import timedelta

    cutoff_date = timezone.now() - timedelta(days=days_old)

    # Find old unapproved runs
    old_runs = LiDARProcessingRun.objects.filter(
        created_at__lt=cutoff_date,
        is_approved=False,
        status__in=['completed', 'failed']
    )

    count = old_runs.count()
    files_deleted = 0

    for run in old_runs:
        # Delete associated files
        for file_field in [run.dtm_file, run.dsm_file, run.chm_file]:
            if file_field and file_field.name:
                try:
                    file_path = file_field.path
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        files_deleted += 1
                except Exception as e:
                    logger.warning(f"Failed to delete file: {e}")

    if count > 0:
        logger.info(f"Cleaning up {count} old LiDAR runs (older than {days_old} days)")
        # Delete will cascade to LiDARDetectedTree and TerrainAnalysis
        old_runs.delete()

    return {
        'deleted_runs': count,
        'deleted_files': files_deleted,
    }


@shared_task
def approve_lidar_run_and_update_field(run_id: int, user_id: int, review_notes: str = ''):
    """
    Approve a LiDAR processing run and update the field with results.

    This task:
    1. Marks the run as approved
    2. Updates the field model with LiDAR-derived stats
    3. Sets the latest_lidar_run reference

    Args:
        run_id: ID of the LiDARProcessingRun to approve
        user_id: ID of the user approving the run
        review_notes: Optional reviewer notes

    Returns:
        Dictionary with approval results
    """
    from api.models import LiDARProcessingRun, Field, User

    try:
        run = LiDARProcessingRun.objects.select_related(
            'lidar_dataset',
            'field'
        ).get(id=run_id)

        if run.status != 'completed':
            raise ValueError(f"Cannot approve run with status: {run.status}")

        user = User.objects.get(id=user_id)
        field = run.field

        # Approve the run
        run.is_approved = True
        run.approved_by = user
        run.approved_at = timezone.now()
        run.review_notes = review_notes
        run.save()

        # Update field with LiDAR results
        field.lidar_tree_count = run.tree_count
        field.lidar_trees_per_acre = run.trees_per_acre
        field.lidar_avg_tree_height_m = run.avg_tree_height_m
        field.lidar_canopy_coverage_percent = run.canopy_coverage_percent
        field.lidar_detection_date = run.lidar_dataset.capture_date
        field.latest_lidar_run = run

        # Update terrain fields if available
        if run.avg_slope_degrees is not None:
            field.avg_slope_degrees = run.avg_slope_degrees

        # Get terrain analysis for aspect and frost risk
        try:
            terrain = run.terrain_analysis
            if terrain:
                field.primary_aspect = terrain.slope_aspect_dominant

                # Determine frost risk level from summary
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
        except Exception:
            pass  # TerrainAnalysis may not exist

        field.save()

        logger.info(f"Approved LiDAR run {run.id} and updated field {field.name}")

        return {
            'run_id': run.id,
            'field_id': field.id,
            'tree_count': run.tree_count,
            'status': 'approved'
        }

    except LiDARProcessingRun.DoesNotExist:
        logger.error(f"LiDAR processing run {run_id} not found")
        raise

    except User.DoesNotExist:
        logger.error(f"User {user_id} not found")
        raise

    except Exception as e:
        logger.error(f"Failed to approve LiDAR run {run_id}: {str(e)}")
        raise
