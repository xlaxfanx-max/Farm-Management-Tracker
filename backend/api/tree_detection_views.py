"""
API ViewSet for TreeSurvey YOLO detection pipeline.

Endpoints:
- GET    /api/tree-surveys/                      List surveys (filter: ?field=X)
- POST   /api/tree-surveys/                      Upload image (multipart)
- GET    /api/tree-surveys/{id}/                  Detail with summary
- DELETE /api/tree-surveys/{id}/                  Delete survey + trees
- POST   /api/tree-surveys/{id}/detect/           Trigger YOLO detection (202)
- GET    /api/tree-surveys/{id}/trees/            Detected trees (filter: ?health_category=X&min_confidence=Y)
- GET    /api/tree-surveys/{id}/trees/geojson/    GeoJSON FeatureCollection
- GET    /api/tree-surveys/{id}/health-summary/   Health category breakdown
"""

import logging

from django.db.models import Avg, Count, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import TreeSurvey, DetectedTree
from .view_helpers import get_user_company
from .tree_detection_serializers import (
    TreeSurveyListSerializer,
    TreeSurveyDetailSerializer,
    TreeSurveyUploadSerializer,
    DetectedTreeSerializer,
    DetectedTreeGeoJSONSerializer,
    HealthSummarySerializer,
)

logger = logging.getLogger(__name__)


class TreeSurveyViewSet(viewsets.ModelViewSet):
    """
    CRUD + custom actions for tree-survey image uploads and YOLO detection.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    # ------------------------------------------------------------------
    # Serializer routing
    # ------------------------------------------------------------------
    def get_serializer_class(self):
        if self.action == 'list':
            return TreeSurveyListSerializer
        if self.action == 'create':
            return TreeSurveyUploadSerializer
        return TreeSurveyDetailSerializer

    # ------------------------------------------------------------------
    # Queryset — company-scoped with select_related
    # ------------------------------------------------------------------
    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return TreeSurvey.objects.none()

        queryset = TreeSurvey.objects.filter(
            company=company
        ).select_related('field', 'uploaded_by')

        # Optional field filter
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        return queryset

    # ------------------------------------------------------------------
    # Create — handled entirely by TreeSurveyUploadSerializer.create()
    # ------------------------------------------------------------------
    def perform_create(self, serializer):
        serializer.save()

    # ------------------------------------------------------------------
    # Delete — cascade removes detected trees via FK on_delete=CASCADE
    # ------------------------------------------------------------------
    def perform_destroy(self, instance):
        logger.info(
            "Deleting TreeSurvey %s (field=%s, trees=%d)",
            instance.id,
            instance.field_id,
            instance.detected_trees.count(),
        )
        instance.delete()

    # ==================================================================
    # CUSTOM ACTIONS
    # ==================================================================

    @action(detail=True, methods=['post'], url_path='detect', url_name='detect')
    def detect(self, request, pk=None):
        """
        Trigger YOLO / DeepForest detection on an uploaded survey image.

        Returns HTTP 202 Accepted immediately; detection runs in the
        background via Celery (preferred) or a daemon thread (fallback).
        """
        survey = self.get_object()

        # Guard: only pending or failed surveys can be (re-)detected
        if survey.status not in ('pending', 'failed'):
            return Response(
                {'error': f'Cannot run detection on a survey with status "{survey.status}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Mark as processing so the client can poll
        survey.status = 'processing'
        survey.error_message = ''
        survey.save(update_fields=['status', 'error_message'])

        # Try Celery first; fall back to a daemon thread
        try:
            from .tasks.tree_detection_tasks import run_tree_detection_task
            run_tree_detection_task.delay(survey.id)
            logger.info("Queued Celery task for TreeSurvey %s", survey.id)
        except (ImportError, Exception) as exc:
            logger.info(
                "Celery unavailable (%s), falling back to threading for TreeSurvey %s",
                exc, survey.id,
            )
            import threading
            from .services.yolo_tree_detection import run_tree_detection
            thread = threading.Thread(
                target=run_tree_detection,
                args=(survey.id,),
            )
            thread.daemon = True
            thread.start()

        return Response(
            {
                'message': 'Detection started.',
                'survey_id': survey.id,
                'status': 'processing',
            },
            status=status.HTTP_202_ACCEPTED,
        )

    # ------------------------------------------------------------------
    @action(detail=True, methods=['get'], url_path='trees', url_name='trees')
    def trees(self, request, pk=None):
        """
        Return detected trees for this survey.

        Query params:
            health_category  - filter by health (healthy|moderate|stressed|critical|unknown)
            min_confidence   - float, lower-bound confidence filter
        """
        survey = self.get_object()
        trees_qs = survey.detected_trees.all()

        # Filter: health category
        health = request.query_params.get('health_category')
        if health:
            trees_qs = trees_qs.filter(health_category=health)

        # Filter: minimum confidence
        min_conf = request.query_params.get('min_confidence')
        if min_conf:
            try:
                trees_qs = trees_qs.filter(confidence__gte=float(min_conf))
            except (ValueError, TypeError):
                pass

        serializer = DetectedTreeSerializer(trees_qs, many=True)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    @action(
        detail=True,
        methods=['get'],
        url_path='trees/geojson',
        url_name='trees-geojson',
    )
    def trees_geojson(self, request, pk=None):
        """
        Return detected trees as a GeoJSON FeatureCollection (for map layers).
        """
        survey = self.get_object()
        trees_qs = survey.detected_trees.all()

        # Respect the same filters as the trees endpoint
        health = request.query_params.get('health_category')
        if health:
            trees_qs = trees_qs.filter(health_category=health)

        min_conf = request.query_params.get('min_confidence')
        if min_conf:
            try:
                trees_qs = trees_qs.filter(confidence__gte=float(min_conf))
            except (ValueError, TypeError):
                pass

        serializer = DetectedTreeGeoJSONSerializer()
        return Response(serializer.to_representation(trees_qs))

    # ------------------------------------------------------------------
    @action(
        detail=True,
        methods=['get'],
        url_path='health-summary',
        url_name='health-summary',
    )
    def health_summary(self, request, pk=None):
        """
        Return a breakdown of tree health categories for this survey.
        """
        survey = self.get_object()
        trees_qs = survey.detected_trees.all()

        total = trees_qs.count()

        def _count(category):
            return trees_qs.filter(health_category=category).count()

        def _pct(count_val):
            if total == 0:
                return 0.0
            return round((count_val / total) * 100, 2)

        healthy_count = _count('healthy')
        moderate_count = _count('moderate')
        stressed_count = _count('stressed')
        critical_count = _count('critical')
        unknown_count = _count('unknown')

        aggregates = trees_qs.aggregate(
            avg_ndvi=Avg('ndvi_mean'),
            avg_confidence=Avg('confidence'),
        )

        summary_data = {
            'total_trees': total,
            'healthy_count': healthy_count,
            'healthy_percent': _pct(healthy_count),
            'moderate_count': moderate_count,
            'moderate_percent': _pct(moderate_count),
            'stressed_count': stressed_count,
            'stressed_percent': _pct(stressed_count),
            'critical_count': critical_count,
            'critical_percent': _pct(critical_count),
            'unknown_count': unknown_count,
            'unknown_percent': _pct(unknown_count),
            'avg_ndvi': (
                round(aggregates['avg_ndvi'], 4)
                if aggregates['avg_ndvi'] is not None
                else None
            ),
            'avg_confidence': (
                round(aggregates['avg_confidence'], 4)
                if aggregates['avg_confidence'] is not None
                else None
            ),
        }

        serializer = HealthSummarySerializer(summary_data)
        return Response(serializer.data)
