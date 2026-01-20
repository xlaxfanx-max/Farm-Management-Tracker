# Data migration to populate unified tree identities from existing detections

from django.db import migrations


def populate_tree_identities(apps, schema_editor):
    """
    Populate Tree records from existing LiDAR and satellite detections.

    Strategy:
    1. Process each field that has detections
    2. For each field, process LiDAR trees first (more accurate locations)
    3. Then process satellite trees, matching to existing Trees or creating new ones
    4. Uses simple spatial matching (within 3m = same tree)
    """
    import math
    from datetime import date

    Field = apps.get_model('api', 'Field')
    Tree = apps.get_model('api', 'Tree')
    TreeObservation = apps.get_model('api', 'TreeObservation')
    LiDARDetectedTree = apps.get_model('api', 'LiDARDetectedTree')
    DetectedTree = apps.get_model('api', 'DetectedTree')
    LiDARProcessingRun = apps.get_model('api', 'LiDARProcessingRun')
    TreeDetectionRun = apps.get_model('api', 'TreeDetectionRun')

    # Distance threshold in meters
    MATCH_THRESHOLD_M = 3.0
    EARTH_RADIUS_M = 6371000

    def haversine_distance(lat1, lon1, lat2, lon2):
        """Calculate distance between two points in meters."""
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = math.sin(delta_lat / 2) ** 2 + \
            math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
        c = 2 * math.asin(math.sqrt(a))

        return EARTH_RADIUS_M * c

    def find_nearest_tree(lat, lon, trees, threshold):
        """Find nearest tree within threshold distance."""
        nearest = None
        min_distance = float('inf')

        for tree in trees:
            dist = haversine_distance(lat, lon, tree.latitude, tree.longitude)
            if dist < min_distance and dist <= threshold:
                min_distance = dist
                nearest = tree

        return nearest, min_distance if nearest else None

    # Get all fields with detections
    fields_with_lidar = set(
        LiDARDetectedTree.objects.values_list('field_id', flat=True).distinct()
    )
    fields_with_satellite = set(
        DetectedTree.objects.values_list('field_id', flat=True).distinct()
    )
    all_fields = fields_with_lidar | fields_with_satellite

    print(f"Processing {len(all_fields)} fields with detections...")

    for field_id in all_fields:
        try:
            field = Field.objects.get(pk=field_id)
        except Field.DoesNotExist:
            continue

        existing_trees = []
        trees_created = 0
        observations_created = 0

        # Process LiDAR detections first (more accurate)
        lidar_detections = LiDARDetectedTree.objects.filter(
            field_id=field_id
        ).select_related('processing_run').order_by('processing_run__completed_at', 'id')

        for detection in lidar_detections:
            # Get observation date from processing run
            obs_date = date.today()
            if detection.processing_run and detection.processing_run.completed_at:
                obs_date = detection.processing_run.completed_at.date()

            # Find existing tree or create new one
            nearest, distance = find_nearest_tree(
                detection.latitude, detection.longitude,
                existing_trees, MATCH_THRESHOLD_M
            )

            if nearest:
                # Update existing tree
                tree = nearest
                tree.lidar_observation_count += 1
                if obs_date > tree.last_observed:
                    tree.last_observed = obs_date
                if obs_date < tree.first_observed:
                    tree.first_observed = obs_date

                # Update metrics from LiDAR (authoritative for 3D)
                if detection.height_m:
                    tree.height_m = detection.height_m
                if detection.canopy_diameter_m:
                    tree.canopy_diameter_m = detection.canopy_diameter_m
                if detection.canopy_area_sqm:
                    tree.canopy_area_sqm = detection.canopy_area_sqm
                if detection.ground_elevation_m:
                    tree.ground_elevation_m = detection.ground_elevation_m

                tree.save()
            else:
                # Create new tree
                import uuid
                tree = Tree.objects.create(
                    uuid=uuid.uuid4(),
                    field=field,
                    latitude=detection.latitude,
                    longitude=detection.longitude,
                    height_m=detection.height_m,
                    canopy_diameter_m=detection.canopy_diameter_m,
                    canopy_area_sqm=detection.canopy_area_sqm,
                    ground_elevation_m=detection.ground_elevation_m,
                    status='active',
                    identity_confidence='low',
                    satellite_observation_count=0,
                    lidar_observation_count=1,
                    first_observed=obs_date,
                    last_observed=obs_date,
                )
                existing_trees.append(tree)
                trees_created += 1

            # Create observation
            TreeObservation.objects.create(
                tree=tree,
                source_type='lidar',
                lidar_detection=detection,
                match_method='initial',
                match_distance_m=distance,
                match_confidence=1.0 if distance is None else max(0, 1.0 - (distance / MATCH_THRESHOLD_M)),
                observation_date=obs_date,
                observed_latitude=detection.latitude,
                observed_longitude=detection.longitude,
                observed_height_m=detection.height_m,
                observed_canopy_diameter_m=detection.canopy_diameter_m,
                observed_canopy_area_sqm=detection.canopy_area_sqm,
                observed_status=detection.status or 'active',
            )
            observations_created += 1

        # Process satellite detections
        satellite_detections = DetectedTree.objects.filter(
            field_id=field_id
        ).select_related('detection_run', 'detection_run__satellite_image').order_by('detection_run__satellite_image__capture_date', 'id')

        for detection in satellite_detections:
            # Get observation date from satellite image
            obs_date = date.today()
            if detection.detection_run and detection.detection_run.satellite_image and detection.detection_run.satellite_image.capture_date:
                obs_date = detection.detection_run.satellite_image.capture_date

            # Find existing tree or create new one
            nearest, distance = find_nearest_tree(
                detection.latitude, detection.longitude,
                existing_trees, MATCH_THRESHOLD_M
            )

            if nearest:
                # Update existing tree
                tree = nearest
                tree.satellite_observation_count += 1
                if obs_date > tree.last_observed:
                    tree.last_observed = obs_date
                if obs_date < tree.first_observed:
                    tree.first_observed = obs_date

                # Update NDVI from satellite (authoritative for spectral)
                if detection.ndvi_value is not None:
                    tree.latest_ndvi = detection.ndvi_value

                # Only use satellite canopy if we don't have LiDAR data
                if tree.lidar_observation_count == 0 and detection.canopy_diameter_m:
                    tree.canopy_diameter_m = detection.canopy_diameter_m

                # Boost confidence if we have both sources
                if tree.lidar_observation_count > 0:
                    tree.identity_confidence = 'high'
                elif tree.satellite_observation_count >= 2:
                    tree.identity_confidence = 'medium'

                tree.save()
            else:
                # Create new tree
                import uuid
                tree = Tree.objects.create(
                    uuid=uuid.uuid4(),
                    field=field,
                    latitude=detection.latitude,
                    longitude=detection.longitude,
                    canopy_diameter_m=detection.canopy_diameter_m,
                    latest_ndvi=detection.ndvi_value,
                    status='active',
                    identity_confidence='low',
                    satellite_observation_count=1,
                    lidar_observation_count=0,
                    first_observed=obs_date,
                    last_observed=obs_date,
                )
                existing_trees.append(tree)
                trees_created += 1

            # Create observation
            TreeObservation.objects.create(
                tree=tree,
                source_type='satellite',
                satellite_detection=detection,
                match_method='initial',
                match_distance_m=distance,
                match_confidence=1.0 if distance is None else max(0, 1.0 - (distance / MATCH_THRESHOLD_M)),
                observation_date=obs_date,
                observed_latitude=detection.latitude,
                observed_longitude=detection.longitude,
                observed_canopy_diameter_m=detection.canopy_diameter_m,
                observed_ndvi=detection.ndvi_value,
                observed_status=detection.status or 'active',
            )
            observations_created += 1

        print(f"  Field {field.name}: {trees_created} trees created, {observations_created} observations")


def reverse_populate(apps, schema_editor):
    """Reverse migration - delete all Tree and TreeObservation records."""
    Tree = apps.get_model('api', 'Tree')
    TreeObservation = apps.get_model('api', 'TreeObservation')

    TreeObservation.objects.all().delete()
    Tree.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0020_unified_tree_identity'),
    ]

    operations = [
        migrations.RunPython(populate_tree_identities, reverse_populate),
    ]
