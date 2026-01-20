"""
Tree Matching Service - Correlates LiDAR and satellite detections into unified tree identities.

This service matches new tree detections (from satellite or LiDAR processing runs)
to existing Tree records or creates new ones. It uses spatial proximity via KD-trees
and attribute similarity to determine matches.
"""

import logging
from datetime import date, timedelta
from typing import Optional, List, Tuple, Dict, Any
import numpy as np
from scipy.spatial import cKDTree
from django.db import transaction
from django.utils import timezone

from api.models import (
    Field, Tree, TreeObservation, TreeMatchingRun,
    DetectedTree, LiDARDetectedTree,
    TreeDetectionRun, LiDARProcessingRun
)

logger = logging.getLogger(__name__)


# Constants
EARTH_RADIUS_M = 6371000  # Earth radius in meters
DEFAULT_MATCH_THRESHOLD_M = 3.0  # Default match distance threshold
MISSING_THRESHOLD_DAYS = 180  # Days without observation before marking missing
STRONG_SATELLITE_NDVI_MIN = 0.35
STRONG_SATELLITE_CONFIDENCE_MIN = 0.60


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two points in meters."""
    lat1_rad = np.radians(lat1)
    lat2_rad = np.radians(lat2)
    delta_lat = np.radians(lat2 - lat1)
    delta_lon = np.radians(lon2 - lon1)

    a = np.sin(delta_lat / 2) ** 2 + \
        np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(delta_lon / 2) ** 2
    c = 2 * np.arcsin(np.sqrt(a))

    return EARTH_RADIUS_M * c


def lat_lon_to_cartesian(lat: float, lon: float, ref_lat: float, ref_lon: float) -> Tuple[float, float]:
    """
    Convert lat/lon to local Cartesian coordinates (meters) relative to a reference point.
    Uses equirectangular projection for small areas (works well for individual fields).
    """
    lat_rad = np.radians(lat)
    ref_lat_rad = np.radians(ref_lat)

    # X distance (east-west)
    x = EARTH_RADIUS_M * np.radians(lon - ref_lon) * np.cos(ref_lat_rad)

    # Y distance (north-south)
    y = EARTH_RADIUS_M * np.radians(lat - ref_lat)

    return x, y


class TreeMatcher:
    """
    Matches tree detections to canonical Tree records using spatial proximity
    and attribute similarity.
    """

    def __init__(
        self,
        field: Field,
        match_distance_threshold_m: float = DEFAULT_MATCH_THRESHOLD_M,
        distance_weight: float = 0.4,
        canopy_weight: float = 0.3,
        ndvi_weight: float = 0.3,
    ):
        self.field = field
        self.match_distance_threshold_m = match_distance_threshold_m
        self.distance_weight = distance_weight
        self.canopy_weight = canopy_weight
        self.ndvi_weight = ndvi_weight

        # Reference point for coordinate conversion (field centroid)
        self.ref_lat = None
        self.ref_lon = None

        # KD-tree for existing trees
        self.existing_trees: List[Tree] = []
        self.tree_coords: Optional[np.ndarray] = None
        self.kdtree: Optional[cKDTree] = None

    def _build_kdtree(self) -> None:
        """Build KD-tree from existing active/uncertain trees in the field."""
        # Get trees that could be matched (not removed/dead)
        self.existing_trees = list(
            Tree.objects.filter(
                field=self.field,
                status__in=['active', 'uncertain', 'missing']
            ).order_by('id')
        )

        if not self.existing_trees:
            logger.info(f"No existing trees for field {self.field.id}")
            return

        # Calculate reference point (centroid of existing trees)
        lats = [t.latitude for t in self.existing_trees]
        lons = [t.longitude for t in self.existing_trees]
        self.ref_lat = np.mean(lats)
        self.ref_lon = np.mean(lons)

        # Convert to local Cartesian coordinates
        coords = []
        for tree in self.existing_trees:
            x, y = lat_lon_to_cartesian(
                tree.latitude, tree.longitude,
                self.ref_lat, self.ref_lon
            )
            coords.append([x, y])

        self.tree_coords = np.array(coords)
        self.kdtree = cKDTree(self.tree_coords)

        logger.info(
            f"Built KD-tree with {len(self.existing_trees)} trees for field {self.field.id}"
        )

    def _find_nearest_tree(
        self,
        lat: float,
        lon: float
    ) -> Tuple[Optional[Tree], Optional[float]]:
        """
        Find nearest existing tree to given coordinates.

        Returns:
            Tuple of (nearest_tree, distance_meters) or (None, None) if no tree within threshold
        """
        if self.kdtree is None or len(self.existing_trees) == 0:
            return None, None

        # Set reference point if not set
        if self.ref_lat is None:
            self.ref_lat = lat
            self.ref_lon = lon

        # Convert to local Cartesian
        x, y = lat_lon_to_cartesian(lat, lon, self.ref_lat, self.ref_lon)
        point = np.array([x, y])

        # Query KD-tree
        distance, idx = self.kdtree.query(point, k=1)

        # Check if within threshold
        if distance <= self.match_distance_threshold_m:
            return self.existing_trees[idx], distance

        return None, None

    def _calculate_match_confidence(
        self,
        distance_m: float,
        detection_canopy: Optional[float],
        tree_canopy: Optional[float],
        detection_ndvi: Optional[float],
        tree_ndvi: Optional[float],
    ) -> float:
        """
        Calculate match confidence (0.0 to 1.0) based on multiple factors.
        """
        scores = []
        weights = []

        # Distance score (closer = higher score)
        # Score of 1.0 at 0m, 0.5 at threshold, approaches 0 beyond
        distance_score = max(0, 1.0 - (distance_m / (self.match_distance_threshold_m * 2)))
        scores.append(distance_score)
        weights.append(self.distance_weight)

        # Canopy similarity score (if both have canopy data)
        if detection_canopy and tree_canopy and tree_canopy > 0:
            canopy_ratio = min(detection_canopy, tree_canopy) / max(detection_canopy, tree_canopy)
            scores.append(canopy_ratio)
            weights.append(self.canopy_weight)

        # NDVI similarity score (if both have NDVI data)
        if detection_ndvi is not None and tree_ndvi is not None:
            # NDVI ranges from -1 to 1, so max difference is 2
            ndvi_diff = abs(detection_ndvi - tree_ndvi)
            ndvi_score = max(0, 1.0 - (ndvi_diff / 0.5))  # 0.5 diff = 0 score
            scores.append(ndvi_score)
            weights.append(self.ndvi_weight)

        # Weighted average
        if not scores:
            return 0.5

        total_weight = sum(weights)
        weighted_sum = sum(s * w for s, w in zip(scores, weights))

        return weighted_sum / total_weight

    def _update_tree_from_observation(
        self,
        tree: Tree,
        observation: TreeObservation,
        source_type: str,
    ) -> None:
        """Update tree's canonical attributes from a new observation."""
        # Update last observed
        if observation.observation_date > tree.last_observed:
            tree.last_observed = observation.observation_date

        # Update first observed if earlier
        if observation.observation_date < tree.first_observed:
            tree.first_observed = observation.observation_date

        # Increment observation count
        if source_type == 'satellite':
            tree.satellite_observation_count += 1
        elif source_type == 'lidar':
            tree.lidar_observation_count += 1

        # Update canonical location (weighted average, LiDAR preferred)
        # LiDAR gets 70% weight for location accuracy
        if source_type == 'lidar':
            weight = 0.7
        else:
            weight = 0.3

        total_obs = tree.satellite_observation_count + tree.lidar_observation_count
        if total_obs <= 1:
            # First observation, use directly
            tree.latitude = observation.observed_latitude
            tree.longitude = observation.observed_longitude
        else:
            # Weighted update toward new observation
            tree.latitude = tree.latitude * (1 - weight/total_obs) + \
                           observation.observed_latitude * (weight/total_obs)
            tree.longitude = tree.longitude * (1 - weight/total_obs) + \
                            observation.observed_longitude * (weight/total_obs)

        # Update attributes based on source
        if source_type == 'lidar':
            # LiDAR is authoritative for 3D measurements
            if observation.observed_height_m:
                tree.height_m = observation.observed_height_m
            if observation.observed_canopy_area_sqm:
                tree.canopy_area_sqm = observation.observed_canopy_area_sqm
            if observation.observed_canopy_diameter_m:
                tree.canopy_diameter_m = observation.observed_canopy_diameter_m
        elif source_type == 'satellite':
            # Satellite is authoritative for NDVI
            if observation.observed_ndvi is not None:
                tree.latest_ndvi = observation.observed_ndvi
            # Only use satellite canopy if we don't have LiDAR data
            if tree.lidar_observation_count == 0:
                if observation.observed_canopy_diameter_m:
                    tree.canopy_diameter_m = observation.observed_canopy_diameter_m

        # Update status based on observation
        if observation.observed_status:
            # Trust the observation's status assessment
            if observation.observed_status in ['dead', 'removed']:
                tree.status = observation.observed_status
            elif tree.status == 'missing':
                # Tree was found again
                tree.status = 'active'

        # Boost confidence if we have both data sources
        if tree.satellite_observation_count > 0 and tree.lidar_observation_count > 0:
            tree.identity_confidence = 'high'
        elif tree.satellite_observation_count + tree.lidar_observation_count >= 2:
            tree.identity_confidence = 'medium'

    def _create_tree_from_detection(
        self,
        detection: Any,
        source_type: str,
        observation_date: date,
    ) -> Tree:
        """Create a new Tree record from a detection."""
        status = 'active'
        identity_confidence = 'low'
        if source_type == 'satellite':
            if self._is_strong_satellite_detection(detection) or getattr(detection, 'is_verified', False):
                identity_confidence = 'medium'
            else:
                status = 'uncertain'
        elif source_type == 'lidar':
            identity_confidence = 'medium'

        tree = Tree(
            field=self.field,
            latitude=detection.latitude,
            longitude=detection.longitude,
            first_observed=observation_date,
            last_observed=observation_date,
            status=status,
            identity_confidence=identity_confidence,
        )

        if source_type == 'lidar':
            tree.lidar_observation_count = 1
            tree.height_m = getattr(detection, 'height_m', None)
            tree.canopy_diameter_m = getattr(detection, 'canopy_diameter_m', None)
            tree.canopy_area_sqm = getattr(detection, 'canopy_area_sqm', None)
            tree.ground_elevation_m = getattr(detection, 'ground_elevation_m', None)
        elif source_type == 'satellite':
            tree.satellite_observation_count = 1
            tree.canopy_diameter_m = getattr(detection, 'canopy_diameter_m', None)
            tree.latest_ndvi = getattr(detection, 'ndvi_value', None)

        tree.save()
        return tree

    def _create_observation(
        self,
        tree: Tree,
        detection: Any,
        source_type: str,
        observation_date: date,
        match_distance_m: Optional[float],
        match_confidence: Optional[float],
        matching_run: Optional[TreeMatchingRun],
        match_method: str = 'spatial',
    ) -> TreeObservation:
        """Create TreeObservation linking tree to detection."""
        observation = TreeObservation(
            tree=tree,
            source_type=source_type,
            match_method=match_method,
            match_distance_m=match_distance_m,
            match_confidence=match_confidence,
            observation_date=observation_date,
            observed_latitude=detection.latitude,
            observed_longitude=detection.longitude,
            matching_run=matching_run,
        )

        if source_type == 'lidar':
            observation.lidar_detection = detection
            observation.observed_height_m = getattr(detection, 'height_m', None)
            observation.observed_canopy_diameter_m = getattr(detection, 'canopy_diameter_m', None)
            observation.observed_canopy_area_sqm = getattr(detection, 'canopy_area_sqm', None)
            observation.observed_status = getattr(detection, 'status', 'active')
        elif source_type == 'satellite':
            observation.satellite_detection = detection
            observation.observed_canopy_diameter_m = getattr(detection, 'canopy_diameter_m', None)
            observation.observed_ndvi = getattr(detection, 'ndvi_value', None)
            observation.observed_status = getattr(detection, 'status', 'active')

        observation.save()
        return observation

    def match_lidar_run(
        self,
        lidar_run: LiDARProcessingRun,
        matching_run: Optional[TreeMatchingRun] = None,
        create_new_trees: bool = True,
    ) -> Dict[str, int]:
        """
        Match LiDAR detections from a processing run to Tree records.

        Returns:
            Dict with counts: trees_matched, new_trees_created
        """
        stats = {'trees_matched': 0, 'new_trees_created': 0}

        # Get detections from this run
        detections = LiDARDetectedTree.objects.filter(
            processing_run=lidar_run
        ).exclude(
            tree_observation__isnull=False  # Skip already-matched detections
        )

        if not detections.exists():
            logger.info(f"No unmatched LiDAR detections for run {lidar_run.id}")
            return stats

        # Build KD-tree from existing trees
        self._build_kdtree()

        # Determine observation date
        observation_date = lidar_run.completed_at.date() if lidar_run.completed_at else date.today()

        with transaction.atomic():
            for detection in detections:
                # Find nearest existing tree
                nearest_tree, distance = self._find_nearest_tree(
                    detection.latitude, detection.longitude
                )

                if nearest_tree and distance is not None:
                    # Calculate match confidence
                    confidence = self._calculate_match_confidence(
                        distance_m=distance,
                        detection_canopy=detection.canopy_diameter_m,
                        tree_canopy=nearest_tree.canopy_diameter_m,
                        detection_ndvi=None,  # LiDAR doesn't have NDVI
                        tree_ndvi=nearest_tree.latest_ndvi,
                    )

                    if confidence >= 0.5:
                        # Match to existing tree
                        observation = self._create_observation(
                            tree=nearest_tree,
                            detection=detection,
                            source_type='lidar',
                            observation_date=observation_date,
                            match_distance_m=distance,
                            match_confidence=confidence,
                            matching_run=matching_run,
                        )
                        self._update_tree_from_observation(nearest_tree, observation, 'lidar')
                        nearest_tree.save()
                        stats['trees_matched'] += 1
                        continue

                # No match found - optionally create new tree
                if not create_new_trees:
                    continue

                new_tree = self._create_tree_from_detection(
                    detection=detection,
                    source_type='lidar',
                    observation_date=observation_date,
                )
                self._create_observation(
                    tree=new_tree,
                    detection=detection,
                    source_type='lidar',
                    observation_date=observation_date,
                    match_distance_m=None,
                    match_confidence=1.0,
                    matching_run=matching_run,
                    match_method='initial',
                )
                stats['new_trees_created'] += 1

                # Add to KD-tree for subsequent matches in this run
                if self.kdtree is not None:
                    x, y = lat_lon_to_cartesian(
                        new_tree.latitude, new_tree.longitude,
                        self.ref_lat, self.ref_lon
                    )
                    self.existing_trees.append(new_tree)
                    self.tree_coords = np.vstack([self.tree_coords, [x, y]])
                    self.kdtree = cKDTree(self.tree_coords)
                else:
                    # First tree - initialize KD-tree
                    self.ref_lat = new_tree.latitude
                    self.ref_lon = new_tree.longitude
                    self.existing_trees = [new_tree]
                    self.tree_coords = np.array([[0.0, 0.0]])
                    self.kdtree = cKDTree(self.tree_coords)

        logger.info(
            f"LiDAR run {lidar_run.id}: matched {stats['trees_matched']}, "
            f"created {stats['new_trees_created']} new trees"
        )
        return stats

    def match_satellite_run(
        self,
        satellite_run: TreeDetectionRun,
        matching_run: Optional[TreeMatchingRun] = None,
    ) -> Dict[str, int]:
        """
        Match satellite detections from a detection run to Tree records.

        Returns:
            Dict with counts: trees_matched, new_trees_created
        """
        stats = {'trees_matched': 0, 'new_trees_created': 0}

        # Get detections from this run
        detections = DetectedTree.objects.filter(
            detection_run=satellite_run
        ).exclude(
            tree_observation__isnull=False  # Skip already-matched detections
        )

        if not detections.exists():
            logger.info(f"No unmatched satellite detections for run {satellite_run.id}")
            return stats

        # Build KD-tree from existing trees
        self._build_kdtree()

        # Determine observation date
        observation_date = satellite_run.image_date if satellite_run.image_date else date.today()

        with transaction.atomic():
            for detection in detections:
                # Find nearest existing tree
                nearest_tree, distance = self._find_nearest_tree(
                    detection.latitude, detection.longitude
                )

                if nearest_tree and distance is not None:
                    # Calculate match confidence
                    confidence = self._calculate_match_confidence(
                        distance_m=distance,
                        detection_canopy=detection.canopy_diameter_m,
                        tree_canopy=nearest_tree.canopy_diameter_m,
                        detection_ndvi=detection.ndvi_value,
                        tree_ndvi=nearest_tree.latest_ndvi,
                    )

                    if confidence >= 0.5:
                        # Match to existing tree
                        observation = self._create_observation(
                            tree=nearest_tree,
                            detection=detection,
                            source_type='satellite',
                            observation_date=observation_date,
                            match_distance_m=distance,
                            match_confidence=confidence,
                            matching_run=matching_run,
                        )
                        self._update_tree_from_observation(nearest_tree, observation, 'satellite')
                        nearest_tree.save()
                        stats['trees_matched'] += 1
                        continue

                strong_candidate = self._is_strong_satellite_detection(detection) or detection.is_verified
                if not strong_candidate:
                    continue

                # No match found - create new tree
                new_tree = self._create_tree_from_detection(
                    detection=detection,
                    source_type='satellite',
                    observation_date=observation_date,
                )
                self._create_observation(
                    tree=new_tree,
                    detection=detection,
                    source_type='satellite',
                    observation_date=observation_date,
                    match_distance_m=None,
                    match_confidence=1.0,
                    matching_run=matching_run,
                    match_method='initial',
                )
                stats['new_trees_created'] += 1

                # Add to KD-tree for subsequent matches
                if self.kdtree is not None:
                    x, y = lat_lon_to_cartesian(
                        new_tree.latitude, new_tree.longitude,
                        self.ref_lat, self.ref_lon
                    )
                    self.existing_trees.append(new_tree)
                    self.tree_coords = np.vstack([self.tree_coords, [x, y]])
                    self.kdtree = cKDTree(self.tree_coords)
                else:
                    self.ref_lat = new_tree.latitude
                    self.ref_lon = new_tree.longitude
                    self.existing_trees = [new_tree]
                    self.tree_coords = np.array([[0.0, 0.0]])
                    self.kdtree = cKDTree(self.tree_coords)

        logger.info(
            f"Satellite run {satellite_run.id}: matched {stats['trees_matched']}, "
            f"created {stats['new_trees_created']} new trees"
        )
        return stats

    def _is_strong_satellite_detection(self, detection: Any) -> bool:
        """Check if satellite detection meets strong candidate thresholds."""
        ndvi_value = getattr(detection, 'ndvi_value', None)
        confidence_score = getattr(detection, 'confidence_score', None)
        if ndvi_value is None or confidence_score is None:
            return False
        return (
            ndvi_value >= STRONG_SATELLITE_NDVI_MIN and
            confidence_score >= STRONG_SATELLITE_CONFIDENCE_MIN
        )

    def mark_missing_trees(self) -> int:
        """
        Mark trees as 'missing' if not observed for MISSING_THRESHOLD_DAYS.

        Returns:
            Number of trees marked as missing
        """
        cutoff_date = date.today() - timedelta(days=MISSING_THRESHOLD_DAYS)

        count = Tree.objects.filter(
            field=self.field,
            status='active',
            last_observed__lt=cutoff_date,
        ).update(status='missing')

        if count > 0:
            logger.info(f"Marked {count} trees as missing for field {self.field.id}")

        return count


def run_tree_matching(
    field: Field,
    satellite_run: Optional[TreeDetectionRun] = None,
    lidar_run: Optional[LiDARProcessingRun] = None,
    triggered_by=None,
    match_distance_threshold_m: float = DEFAULT_MATCH_THRESHOLD_M,
    prefer_lidar: bool = False,
) -> TreeMatchingRun:
    """
    Run tree matching for a field with optional satellite and/or LiDAR runs.

    Args:
        field: Field to match trees for
        satellite_run: Optional satellite detection run to process
        lidar_run: Optional LiDAR processing run to process
        triggered_by: User who triggered the run (optional)
        match_distance_threshold_m: Distance threshold for matching

    Returns:
        TreeMatchingRun record with results
    """
    # Create matching run record
    matching_run = TreeMatchingRun.objects.create(
        field=field,
        satellite_run=satellite_run,
        lidar_run=lidar_run,
        triggered_by=triggered_by,
        match_distance_threshold_m=match_distance_threshold_m,
        status='running',
        started_at=timezone.now(),
    )

    try:
        matcher = TreeMatcher(
            field=field,
            match_distance_threshold_m=match_distance_threshold_m,
        )

        total_matched = 0
        total_created = 0

        if prefer_lidar:
            # LiDAR first when it is considered the primary source
            if lidar_run:
                stats = matcher.match_lidar_run(lidar_run, matching_run, create_new_trees=True)
                total_matched += stats['trees_matched']
                total_created += stats['new_trees_created']
            if satellite_run:
                stats = matcher.match_satellite_run(satellite_run, matching_run)
                total_matched += stats['trees_matched']
                total_created += stats['new_trees_created']
        else:
            # Satellite primary: LiDAR only enriches existing trees
            if satellite_run:
                stats = matcher.match_satellite_run(satellite_run, matching_run)
                total_matched += stats['trees_matched']
                total_created += stats['new_trees_created']
            if lidar_run:
                stats = matcher.match_lidar_run(lidar_run, matching_run, create_new_trees=False)
                total_matched += stats['trees_matched']
                total_created += stats['new_trees_created']

        # Mark missing trees
        trees_missing = matcher.mark_missing_trees()

        # Update matching run record
        matching_run.status = 'completed'
        matching_run.completed_at = timezone.now()
        matching_run.trees_matched = total_matched
        matching_run.new_trees_created = total_created
        matching_run.trees_marked_missing = trees_missing
        matching_run.save()

        logger.info(
            f"Tree matching completed for field {field.id}: "
            f"{total_matched} matched, {total_created} new, {trees_missing} missing"
        )

    except Exception as e:
        logger.exception(f"Tree matching failed for field {field.id}")
        matching_run.status = 'failed'
        matching_run.error_message = str(e)
        matching_run.completed_at = timezone.now()
        matching_run.save()
        raise

    return matching_run


def match_all_existing_detections(
    field: Field,
    triggered_by=None,
    prefer_lidar: bool = True
) -> TreeMatchingRun:
    """
    Match all existing (unmatched) detections for a field to create initial tree identities.
    Processes LiDAR first by default to leverage higher spatial accuracy.

    Args:
        field: Field to process
        triggered_by: User who triggered the operation

    Returns:
        TreeMatchingRun record with results
    """
    # Create matching run
    matching_run = TreeMatchingRun.objects.create(
        field=field,
        triggered_by=triggered_by,
        match_distance_threshold_m=DEFAULT_MATCH_THRESHOLD_M,
        status='running',
        started_at=timezone.now(),
    )

    try:
        matcher = TreeMatcher(field=field)

        total_matched = 0
        total_created = 0

        if prefer_lidar:
            # Process all LiDAR runs first (chronologically)
            lidar_runs = LiDARProcessingRun.objects.filter(
                field=field,
                status='completed',
            ).order_by('completed_at')

            for run in lidar_runs:
                stats = matcher.match_lidar_run(run, matching_run, create_new_trees=True)
                total_matched += stats['trees_matched']
                total_created += stats['new_trees_created']

            # Process all satellite runs (chronologically)
            satellite_runs = TreeDetectionRun.objects.filter(
                field=field,
                status='completed',
            ).order_by('image_date')

            for run in satellite_runs:
                stats = matcher.match_satellite_run(run, matching_run)
                total_matched += stats['trees_matched']
                total_created += stats['new_trees_created']
        else:
            # Satellite primary: process satellite first, LiDAR only enriches
            satellite_runs = TreeDetectionRun.objects.filter(
                field=field,
                status='completed',
            ).order_by('image_date')

            for run in satellite_runs:
                stats = matcher.match_satellite_run(run, matching_run)
                total_matched += stats['trees_matched']
                total_created += stats['new_trees_created']

            lidar_runs = LiDARProcessingRun.objects.filter(
                field=field,
                status='completed',
            ).order_by('completed_at')

            for run in lidar_runs:
                stats = matcher.match_lidar_run(run, matching_run, create_new_trees=False)
                total_matched += stats['trees_matched']
                total_created += stats['new_trees_created']

        # Mark missing trees
        trees_missing = matcher.mark_missing_trees()

        # Update matching run
        matching_run.status = 'completed'
        matching_run.completed_at = timezone.now()
        matching_run.trees_matched = total_matched
        matching_run.new_trees_created = total_created
        matching_run.trees_marked_missing = trees_missing
        matching_run.save()

        logger.info(
            f"Bulk tree matching completed for field {field.id}: "
            f"{total_matched} matched, {total_created} new, {trees_missing} missing"
        )

    except Exception as e:
        logger.exception(f"Bulk tree matching failed for field {field.id}")
        matching_run.status = 'failed'
        matching_run.error_message = str(e)
        matching_run.completed_at = timezone.now()
        matching_run.save()
        raise

    return matching_run
