"""
Tree API Views - Endpoints for unified tree identity management.

Provides REST API endpoints for:
- Listing and filtering unified trees
- Tree detail with observation history
- Tree verification and labeling
- Merging duplicate trees
- Triggering tree matching
- GeoJSON export for map display
"""

from django.db import transaction
from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import (
    Field, Tree, TreeObservation, TreeMatchingRun,
    TreeDetectionRun, LiDARProcessingRun, TreeFeedback,
)
from .view_helpers import get_user_company
from .serializers import (
    TreeListSerializer, TreeDetailSerializer, TreeGeoJSONSerializer,
    TreeObservationSerializer, TreeMatchingRunSerializer,
    TreeVerifySerializer, TreeMergeSerializer, TreeMatchingTriggerSerializer,
    FieldUnifiedTreeSummarySerializer,
    TreeFeedbackSerializer, TreeFeedbackCreateSerializer,
    TreeFeedbackUpdateSerializer, TreeFeedbackExportSerializer,
    TreeFeedbackStatisticsSerializer,
)
from .services.tree_matching import run_tree_matching, match_all_existing_detections


class TreeViewSet(viewsets.ModelViewSet):
    """
    ViewSet for unified Tree records.

    list: Get all trees (supports filtering by field, status, confidence)
    retrieve: Get tree detail with observation history
    verify: Mark tree identity as verified
    merge: Merge duplicate trees into one
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TreeDetailSerializer

    def get_queryset(self):
        """Filter trees by company and optional query parameters."""
        user = self.request.user
        queryset = Tree.objects.filter(field__farm__company=get_user_company(user))

        # Filter by field
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by confidence
        confidence = self.request.query_params.get('confidence')
        if confidence:
            queryset = queryset.filter(identity_confidence=confidence)

        # Filter by verified
        verified = self.request.query_params.get('verified')
        if verified is not None:
            queryset = queryset.filter(is_verified=verified.lower() == 'true')

        # Filter by observation source
        source = self.request.query_params.get('source')
        if source == 'satellite':
            queryset = queryset.filter(satellite_observation_count__gt=0)
        elif source == 'lidar':
            queryset = queryset.filter(lidar_observation_count__gt=0)
        elif source == 'both':
            queryset = queryset.filter(
                satellite_observation_count__gt=0,
                lidar_observation_count__gt=0
            )

        return queryset.select_related('field', 'verified_by').order_by('-last_observed', 'id')

    def get_serializer_class(self):
        if self.action == 'list':
            return TreeListSerializer
        return TreeDetailSerializer

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """
        Mark a tree identity as verified (or unverified).

        POST /api/trees/{id}/verify/
        {
            "is_verified": true,
            "tree_label": "Row 5, Tree 23",  // optional
            "notes": "Confirmed via field visit"  // optional
        }
        """
        tree = self.get_object()
        serializer = TreeVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tree.is_verified = serializer.validated_data['is_verified']
        if tree.is_verified:
            tree.verified_by = request.user
            tree.verified_at = timezone.now()
            tree.identity_confidence = 'high'
        else:
            tree.verified_by = None
            tree.verified_at = None

        if 'tree_label' in serializer.validated_data:
            tree.tree_label = serializer.validated_data['tree_label']
        if 'notes' in serializer.validated_data:
            tree.notes = serializer.validated_data['notes']

        tree.save()
        return Response(TreeDetailSerializer(tree).data)

    @action(detail=True, methods=['post'])
    def merge(self, request, pk=None):
        """
        Merge other trees into this tree.

        All observations from source trees are transferred to the target tree.
        Source trees are deleted after merge.

        POST /api/trees/{id}/merge/
        {
            "source_tree_ids": [123, 456]
        }
        """
        target_tree = self.get_object()
        serializer = TreeMergeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        source_ids = serializer.validated_data['source_tree_ids']

        # Get source trees (must belong to same field)
        source_trees = Tree.objects.filter(
            id__in=source_ids,
            field=target_tree.field
        )

        if source_trees.count() != len(source_ids):
            return Response(
                {"error": "Some source tree IDs not found or belong to different field"},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            merged_count = 0
            for source_tree in source_trees:
                # Transfer observations
                TreeObservation.objects.filter(tree=source_tree).update(tree=target_tree)

                # Update observation counts
                target_tree.satellite_observation_count += source_tree.satellite_observation_count
                target_tree.lidar_observation_count += source_tree.lidar_observation_count

                # Update first/last observed
                if source_tree.first_observed < target_tree.first_observed:
                    target_tree.first_observed = source_tree.first_observed
                if source_tree.last_observed > target_tree.last_observed:
                    target_tree.last_observed = source_tree.last_observed

                # Delete source tree
                source_tree.delete()
                merged_count += 1

            # Boost confidence after merge
            if target_tree.satellite_observation_count > 0 and target_tree.lidar_observation_count > 0:
                target_tree.identity_confidence = 'high'

            target_tree.save()

        return Response({
            "message": f"Merged {merged_count} trees into tree {target_tree.id}",
            "tree": TreeDetailSerializer(target_tree).data
        })

    @action(detail=True, methods=['get'])
    def observations(self, request, pk=None):
        """
        Get all observations for a tree.

        GET /api/trees/{id}/observations/
        """
        tree = self.get_object()
        observations = tree.observations.all().order_by('-observation_date')
        serializer = TreeObservationSerializer(observations, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'])
    def feedback(self, request, pk=None):
        """
        Get or submit feedback for a tree.

        GET /api/trees/{id}/feedback/ - List all feedback for this tree
        POST /api/trees/{id}/feedback/ - Submit new feedback
        {
            "feedback_type": "false_positive",  // required
            "notes": "This appears to be a shadow",  // optional
            "observation": 123,  // optional - link to specific observation
            "suggested_latitude": 36.123,  // optional for location corrections
            "suggested_longitude": -119.456,  // optional
            "suggested_corrections": {"canopy_diameter_m": 5.5}  // optional
        }
        """
        tree = self.get_object()

        if request.method == 'GET':
            feedback = tree.feedback.all().order_by('-created_at')
            serializer = TreeFeedbackSerializer(feedback, many=True)
            return Response(serializer.data)

        elif request.method == 'POST':
            data = request.data.copy()
            data['tree'] = tree.id
            serializer = TreeFeedbackCreateSerializer(
                data=data,
                context={'request': request}
            )
            serializer.is_valid(raise_exception=True)
            feedback = serializer.save()
            return Response(
                TreeFeedbackSerializer(feedback).data,
                status=status.HTTP_201_CREATED
            )


class TreeFeedbackViewSet(viewsets.ModelViewSet):
    """
    ViewSet for tree feedback management (admin review).

    list: Get all feedback (filterable by status, type, field)
    retrieve: Get feedback detail
    partial_update: Update feedback status (accept/reject)
    export: Export feedback for ML training
    statistics: Get feedback statistics
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TreeFeedbackSerializer

    def get_queryset(self):
        """Filter feedback by company and optional query parameters."""
        user = self.request.user
        queryset = TreeFeedback.objects.filter(
            tree__field__farm__company=get_user_company(user)
        )

        # Filter by field
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(tree__field_id=field_id)

        # Filter by tree
        tree_id = self.request.query_params.get('tree')
        if tree_id:
            queryset = queryset.filter(tree_id=tree_id)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by feedback type
        feedback_type = self.request.query_params.get('feedback_type')
        if feedback_type:
            queryset = queryset.filter(feedback_type=feedback_type)

        # Filter by exported status
        exported = self.request.query_params.get('exported')
        if exported is not None:
            queryset = queryset.filter(exported_for_training=exported.lower() == 'true')

        return queryset.select_related(
            'tree', 'tree__field', 'observation',
            'created_by', 'resolved_by'
        ).order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'partial_update':
            return TreeFeedbackUpdateSerializer
        return TreeFeedbackSerializer

    def partial_update(self, request, *args, **kwargs):
        """Update feedback status (accept/reject)."""
        instance = self.get_object()
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(TreeFeedbackSerializer(instance).data)

    @action(detail=False, methods=['get'])
    def export(self, request):
        """
        Export feedback for ML training.

        GET /api/tree-feedback/export/
        Query params:
        - status: 'accepted' (default), 'rejected', 'all'
        - field: filter by field ID
        - feedback_type: filter by type
        - mark_exported: if 'true', mark records as exported
        """
        queryset = self.get_queryset()

        # Default to accepted feedback only
        status_filter = request.query_params.get('status', 'accepted')
        if status_filter != 'all':
            queryset = queryset.filter(status=status_filter)

        # Additional filters
        field_id = request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(tree__field_id=field_id)

        feedback_type = request.query_params.get('feedback_type')
        if feedback_type:
            queryset = queryset.filter(feedback_type=feedback_type)

        # Serialize
        serializer = TreeFeedbackExportSerializer(queryset, many=True)

        # Optionally mark as exported
        if request.query_params.get('mark_exported', '').lower() == 'true':
            queryset.update(
                exported_for_training=True,
                exported_at=timezone.now()
            )

        return Response({
            'export_metadata': {
                'total_records': queryset.count(),
                'status_filter': status_filter,
                'exported_at': timezone.now().isoformat(),
            },
            'feedback_records': serializer.data
        })

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """
        Get feedback statistics.

        GET /api/tree-feedback/statistics/
        Query params:
        - field: filter by field ID
        """
        queryset = self.get_queryset()

        # Filter by field if specified
        field_id = request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(tree__field_id=field_id)

        # Status counts
        status_counts = queryset.values('status').annotate(count=Count('id'))
        status_dict = {item['status']: item['count'] for item in status_counts}

        # Type counts
        type_counts = queryset.values('feedback_type').annotate(count=Count('id'))
        type_dict = {item['feedback_type']: item['count'] for item in type_counts}

        # Export counts
        exported_count = queryset.filter(exported_for_training=True).count()
        unexported_accepted = queryset.filter(
            status='accepted',
            exported_for_training=False
        ).count()

        stats = {
            'total_feedback': queryset.count(),
            'pending_count': status_dict.get('pending', 0),
            'accepted_count': status_dict.get('accepted', 0),
            'rejected_count': status_dict.get('rejected', 0),
            'false_positive_count': type_dict.get('false_positive', 0),
            'false_negative_count': type_dict.get('false_negative', 0),
            'misidentification_count': type_dict.get('misidentification', 0),
            'location_error_count': type_dict.get('location_error', 0),
            'attribute_error_count': type_dict.get('attribute_error', 0),
            'verified_correct_count': type_dict.get('verified_correct', 0),
            'exported_count': exported_count,
            'unexported_accepted_count': unexported_accepted,
        }

        serializer = TreeFeedbackStatisticsSerializer(stats)
        return Response(serializer.data)


class FieldTreeViewSet(viewsets.ViewSet):
    """
    Field-scoped tree endpoints.

    Provides endpoints nested under fields for unified tree management.
    """
    permission_classes = [IsAuthenticated]

    def _get_field(self, field_id, user):
        """Get field with permission check."""
        return get_object_or_404(
            Field.objects.filter(farm__company=get_user_company(user)),
            pk=field_id
        )

    def _get_unified_trees_queryset(self, field):
        """Return strong-candidate unified trees for a field."""
        return Tree.objects.filter(field=field).filter(
            Q(is_verified=True) | Q(identity_confidence__in=['medium', 'high'])
        )

    @action(detail=True, methods=['get'], url_path='unified-trees')
    def unified_trees(self, request, pk=None):
        """
        Get unified trees for a field.

        GET /api/fields/{id}/unified-trees/
        Query params:
        - format: 'json' (default) or 'geojson'
        - status: filter by status
        - confidence: filter by confidence level
        """
        field = self._get_field(pk, request.user)

        trees = self._get_unified_trees_queryset(field)

        # Apply filters
        status_filter = request.query_params.get('status')
        if status_filter:
            trees = trees.filter(status=status_filter)

        confidence = request.query_params.get('confidence')
        if confidence:
            trees = trees.filter(identity_confidence=confidence)

        output_format = request.query_params.get('format', 'json')

        if output_format == 'geojson':
            serializer = TreeGeoJSONSerializer(trees, many=True)
            return Response({
                "type": "FeatureCollection",
                "features": serializer.data
            })
        else:
            serializer = TreeListSerializer(trees, many=True)
            return Response({
                "field_id": field.id,
                "field_name": field.name,
                "count": trees.count(),
                "trees": serializer.data
            })

    @action(detail=True, methods=['get'], url_path='tree-summary')
    def tree_summary(self, request, pk=None):
        """
        Get unified tree summary statistics for a field.

        GET /api/fields/{id}/tree-summary/
        """
        field = self._get_field(pk, request.user)

        trees = self._get_unified_trees_queryset(field)

        # Status counts
        status_counts = trees.values('status').annotate(count=Count('id'))
        status_dict = {item['status']: item['count'] for item in status_counts}

        # Confidence counts
        confidence_counts = trees.values('identity_confidence').annotate(count=Count('id'))
        confidence_dict = {item['identity_confidence']: item['count'] for item in confidence_counts}

        # Observation coverage
        trees_with_satellite = trees.filter(satellite_observation_count__gt=0).count()
        trees_with_lidar = trees.filter(lidar_observation_count__gt=0).count()
        trees_with_both = trees.filter(
            satellite_observation_count__gt=0,
            lidar_observation_count__gt=0
        ).count()

        # Aggregates
        aggregates = trees.filter(status='active').aggregate(
            avg_height=Avg('height_m'),
            avg_canopy=Avg('canopy_diameter_m'),
            avg_ndvi=Avg('latest_ndvi'),
        )

        # Last matching run
        last_run = TreeMatchingRun.objects.filter(
            field=field,
            status='completed'
        ).order_by('-completed_at').first()

        # Total observations
        total_observations = TreeObservation.objects.filter(tree__field=field).count()

        summary_data = {
            'field_id': field.id,
            'field_name': field.name,
            'total_trees': trees.count(),
            'active_trees': status_dict.get('active', 0),
            'missing_trees': status_dict.get('missing', 0),
            'dead_trees': status_dict.get('dead', 0),
            'uncertain_trees': status_dict.get('uncertain', 0),
            'high_confidence_count': confidence_dict.get('high', 0),
            'medium_confidence_count': confidence_dict.get('medium', 0),
            'low_confidence_count': confidence_dict.get('low', 0),
            'trees_with_satellite': trees_with_satellite,
            'trees_with_lidar': trees_with_lidar,
            'trees_with_both': trees_with_both,
            'verified_trees': trees.filter(is_verified=True).count(),
            'avg_height_m': aggregates['avg_height'],
            'avg_canopy_diameter_m': aggregates['avg_canopy'],
            'avg_ndvi': aggregates['avg_ndvi'],
            'last_matching_run': last_run.completed_at if last_run else None,
            'total_observations': total_observations,
        }

        serializer = FieldUnifiedTreeSummarySerializer(summary_data)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='tree-timeline')
    def tree_timeline(self, request, pk=None):
        """
        Get observation timeline for a field's trees.

        Returns observations grouped by date for timeline visualization.

        GET /api/fields/{id}/tree-timeline/
        """
        field = self._get_field(pk, request.user)

        # Get observations grouped by date and source
        observations = TreeObservation.objects.filter(
            tree__field=field
        ).values('observation_date', 'source_type').annotate(
            count=Count('id')
        ).order_by('observation_date')

        # Structure the timeline
        timeline = {}
        for obs in observations:
            date_str = obs['observation_date'].isoformat()
            if date_str not in timeline:
                timeline[date_str] = {'satellite': 0, 'lidar': 0, 'manual': 0}
            timeline[date_str][obs['source_type']] = obs['count']

        # Convert to list
        timeline_list = [
            {
                'date': date,
                'satellite_observations': data['satellite'],
                'lidar_observations': data['lidar'],
                'manual_observations': data['manual'],
                'total': data['satellite'] + data['lidar'] + data['manual']
            }
            for date, data in sorted(timeline.items())
        ]

        return Response({
            'field_id': field.id,
            'field_name': field.name,
            'timeline': timeline_list
        })

    @action(detail=True, methods=['post'], url_path='match-trees')
    def match_trees(self, request, pk=None):
        """
        Trigger tree matching for a field.

        POST /api/fields/{id}/match-trees/
        {
            "satellite_run_id": 123,  // optional
            "lidar_run_id": 456,  // optional
            "match_all_existing": false,  // if true, match all unmatched detections
            "prefer_lidar": false,  // if true, LiDAR is treated as primary
            "match_distance_threshold_m": 3.0  // optional, default 3m
        }
        """
        field = self._get_field(pk, request.user)

        serializer = TreeMatchingTriggerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        satellite_run = None
        lidar_run = None

        if serializer.validated_data.get('satellite_run_id'):
            satellite_run = get_object_or_404(
                TreeDetectionRun.objects.filter(field=field),
                pk=serializer.validated_data['satellite_run_id']
            )

        if serializer.validated_data.get('lidar_run_id'):
            lidar_run = get_object_or_404(
                LiDARProcessingRun.objects.filter(field=field),
                pk=serializer.validated_data['lidar_run_id']
            )

        match_all = serializer.validated_data.get('match_all_existing', False)
        threshold = serializer.validated_data.get('match_distance_threshold_m', 3.0)
        prefer_lidar = serializer.validated_data.get('prefer_lidar', False)

        try:
            if match_all:
                matching_run = match_all_existing_detections(
                    field=field,
                    triggered_by=request.user,
                    prefer_lidar=prefer_lidar,
                )
            else:
                matching_run = run_tree_matching(
                    field=field,
                    satellite_run=satellite_run,
                    lidar_run=lidar_run,
                    triggered_by=request.user,
                    match_distance_threshold_m=threshold,
                    prefer_lidar=prefer_lidar,
                )

            return Response(TreeMatchingRunSerializer(matching_run).data)

        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TreeMatchingRunViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for tree matching run records (read-only).

    list: Get all matching runs for user's company
    retrieve: Get matching run detail
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TreeMatchingRunSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = TreeMatchingRun.objects.filter(
            field__farm__company=get_user_company(user)
        )

        # Filter by field
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.select_related(
            'field', 'satellite_run', 'lidar_run', 'triggered_by'
        ).order_by('-created_at')
