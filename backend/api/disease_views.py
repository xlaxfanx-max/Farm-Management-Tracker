"""
Disease Prevention Module Views

This module provides API endpoints for disease intelligence including:
- External Detections (CDFA, USDA data)
- Disease Alerts (proximity and health-based)
- Disease Alert Rules (configurable triggers)
- Disease Analysis Runs (field health analysis)
- Scouting Reports (crowdsourced observations)
- Regional Intelligence (aggregated threat data)
- Dashboard (summary view)
"""

from datetime import date, timedelta
from decimal import Decimal
from django.db.models import Count, Q, Avg
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import serializers as drf_serializers

from .permissions import HasCompanyAccess
from .audit_utils import AuditLogMixin

from .models import (
    ExternalDetection, DiseaseAlertRule, DiseaseAnalysisRun,
    DiseaseAlert, ScoutingReport, ScoutingPhoto, TreeHealthRecord,
    Company, Farm, Field
)

from .serializers import (
    ExternalDetectionSerializer, ExternalDetectionListSerializer,
    DiseaseAlertRuleSerializer,
    DiseaseAnalysisRunSerializer, DiseaseAnalysisRunListSerializer,
    DiseaseAlertSerializer, DiseaseAlertListSerializer,
    ScoutingReportSerializer, ScoutingReportListSerializer,
    ScoutingPhotoSerializer,
)

from .services.proximity_calculator import ProximityCalculator


from .view_helpers import get_user_company, require_company


# =============================================================================
# EXTERNAL DETECTION VIEWSET
# =============================================================================

class ExternalDetectionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing external disease detections.

    External detections are imported from CDFA, USDA, and other authorities.
    These are read-only for regular users - admin/system updates them.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['disease_name', 'county', 'city']
    ordering_fields = ['detection_date', 'county', 'disease_type']
    ordering = ['-detection_date']

    def get_queryset(self):
        queryset = ExternalDetection.objects.all()

        # Filter by disease type
        disease_type = self.request.query_params.get('disease_type')
        if disease_type:
            queryset = queryset.filter(disease_type=disease_type)

        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        # Filter by county
        county = self.request.query_params.get('county')
        if county:
            queryset = queryset.filter(county__icontains=county)

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(detection_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(detection_date__lte=end_date)

        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return ExternalDetectionListSerializer
        return ExternalDetectionSerializer

    @action(detail=False, methods=['get'])
    def near_company(self, request):
        """
        Get detections near the company's farms.

        Query params:
        - radius_miles: Search radius (default 15)
        - disease_type: Filter by disease type
        """
        company = require_company(request.user)
        radius = float(request.query_params.get('radius_miles', 15))
        disease_types = request.query_params.getlist('disease_type')

        calculator = ProximityCalculator()
        risks = calculator.get_proximity_risks_for_company(
            company_id=company.id,
            radius_miles=radius
        )

        return Response(risks)

    @action(detail=False, methods=['get'])
    def by_county(self, request):
        """
        Get detection counts grouped by county.
        """
        from django.db.models import Count

        county_data = ExternalDetection.objects.filter(
            is_active=True
        ).values('county').annotate(
            count=Count('id')
        ).order_by('-count')

        return Response(list(county_data))

    @action(detail=False, methods=['post'])
    def sync_cdfa(self, request):
        """
        Sync detection data from CDFA sources.

        This endpoint triggers a sync of:
        - HLB detections
        - ACP detections
        - Quarantine zone boundaries

        Requires staff/admin permissions.
        """
        # Check if user has permission to sync (staff only)
        if not request.user.is_staff:
            return Response(
                {'error': 'Only staff members can trigger CDFA sync'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            from api.services.cdfa_data_sync import CDFADataSync

            sync_service = CDFADataSync()
            results = sync_service.sync_all()

            return Response({
                'status': 'success',
                'message': 'CDFA data sync completed',
                'results': results
            })

        except Exception as e:
            return Response(
                {'status': 'error', 'message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def sync_status(self, request):
        """
        Get the current sync status and last sync time.
        """
        from api.models import ExternalDetection, QuarantineZone

        hlb_count = ExternalDetection.objects.filter(
            disease_type='hlb', is_active=True
        ).count()
        acp_count = ExternalDetection.objects.filter(
            disease_type='acp', is_active=True
        ).count()

        # Get last detection date as proxy for last sync
        last_detection = ExternalDetection.objects.order_by('-fetched_at').first()
        last_sync = last_detection.fetched_at if last_detection else None

        # Count quarantine zones
        try:
            zone_count = QuarantineZone.objects.filter(is_active=True).count()
        except Exception:
            zone_count = 0

        return Response({
            'hlb_detections': hlb_count,
            'acp_detections': acp_count,
            'quarantine_zones': zone_count,
            'last_sync': last_sync,
            'total_detections': hlb_count + acp_count,
        })


# =============================================================================
# DISEASE ALERT VIEWSET
# =============================================================================

class DiseaseAlertViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing disease alerts.

    Alerts are generated by the system based on:
    - Proximity to external detections (HLB, ACP)
    - Field health analysis anomalies
    - Verified scouting reports
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'priority']
    ordering = ['-created_at']
    http_method_names = ['get', 'patch', 'delete']  # No create - system generated

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return DiseaseAlert.objects.none()

        queryset = DiseaseAlert.objects.filter(company=company)

        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')

        # Filter by priority
        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)

        # Filter by alert type
        alert_type = self.request.query_params.get('alert_type')
        if alert_type:
            queryset = queryset.filter(alert_type=alert_type)

        # Filter by acknowledged status
        acknowledged = self.request.query_params.get('acknowledged')
        if acknowledged is not None:
            queryset = queryset.filter(is_acknowledged=acknowledged.lower() == 'true')

        return queryset.select_related('farm', 'field', 'related_detection')

    def get_serializer_class(self):
        if self.action == 'list':
            return DiseaseAlertListSerializer
        return DiseaseAlertSerializer

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active, unacknowledged alerts."""
        company = require_company(request.user)
        alerts = DiseaseAlert.objects.filter(
            company=company,
            is_active=True,
            is_acknowledged=False
        ).select_related('farm', 'field').order_by('-priority', '-created_at')

        serializer = DiseaseAlertListSerializer(alerts, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get alert summary counts."""
        company = require_company(request.user)
        alerts = DiseaseAlert.objects.filter(company=company, is_active=True)

        summary = {
            'total_active': alerts.count(),
            'unacknowledged': alerts.filter(is_acknowledged=False).count(),
            'by_priority': {
                'critical': alerts.filter(priority='critical').count(),
                'high': alerts.filter(priority='high').count(),
                'medium': alerts.filter(priority='medium').count(),
                'low': alerts.filter(priority='low').count(),
            },
            'by_type': {}
        }

        # Count by type
        type_counts = alerts.values('alert_type').annotate(count=Count('id'))
        for tc in type_counts:
            summary['by_type'][tc['alert_type']] = tc['count']

        return Response(summary)

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge an alert."""
        alert = self.get_object()
        alert.acknowledge(request.user)
        serializer = DiseaseAlertSerializer(alert)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        """Dismiss an alert (mark as inactive)."""
        alert = self.get_object()
        alert.dismiss()
        return Response({'status': 'dismissed'})

    @action(detail=False, methods=['post'])
    def acknowledge_all(self, request):
        """Acknowledge all active alerts."""
        company = require_company(request.user)
        updated = DiseaseAlert.objects.filter(
            company=company,
            is_active=True,
            is_acknowledged=False
        ).update(
            is_acknowledged=True,
            acknowledged_by=request.user,
            acknowledged_at=timezone.now()
        )
        return Response({'acknowledged': updated})


# =============================================================================
# DISEASE ALERT RULE VIEWSET
# =============================================================================

class DiseaseAlertRuleViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing disease alert rules.

    Rules define when alerts should be generated:
    - Proximity rules: Alert when detection is within X miles
    - NDVI rules: Alert when NDVI drops below threshold
    - Change rules: Alert when metrics change by certain percentage
    """
    serializer_class = DiseaseAlertRuleSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return DiseaseAlertRule.objects.none()
        return DiseaseAlertRule.objects.filter(company=company)

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company, created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def create_defaults(self, request):
        """Create default alert rules for a company."""
        company = require_company(request.user)

        default_rules = [
            {
                'name': 'HLB Proximity Alert (5 miles)',
                'rule_type': 'proximity',
                'conditions': {'disease_types': ['hlb'], 'radius_miles': 5},
                'alert_priority': 'critical',
                'send_email': True,
                'send_immediately': True,
            },
            {
                'name': 'HLB Proximity Alert (10 miles)',
                'rule_type': 'proximity',
                'conditions': {'disease_types': ['hlb'], 'radius_miles': 10},
                'alert_priority': 'high',
                'send_email': True,
            },
            {
                'name': 'ACP Activity Alert (5 miles)',
                'rule_type': 'proximity',
                'conditions': {'disease_types': ['acp'], 'radius_miles': 5},
                'alert_priority': 'high',
                'send_email': True,
            },
        ]

        created = []
        for rule_data in default_rules:
            # Check if similar rule exists
            exists = DiseaseAlertRule.objects.filter(
                company=company,
                name=rule_data['name']
            ).exists()

            if not exists:
                rule = DiseaseAlertRule.objects.create(
                    company=company,
                    created_by=request.user,
                    **rule_data
                )
                created.append(rule.name)

        return Response({
            'created': created,
            'message': f'Created {len(created)} default rules'
        })


# =============================================================================
# DISEASE ANALYSIS RUN VIEWSET
# =============================================================================

class DiseaseAnalysisRunViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for disease/health analysis runs.

    Analysis runs process satellite imagery to assess field health,
    detect anomalies, and generate health scores.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'health_score']
    ordering = ['-created_at']
    http_method_names = ['get', 'post', 'delete']

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return DiseaseAnalysisRun.objects.none()

        queryset = DiseaseAnalysisRun.objects.filter(company=company)

        # Filter by field
        field_id = self.request.query_params.get('field_id')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        # Filter by status
        run_status = self.request.query_params.get('status')
        if run_status:
            queryset = queryset.filter(status=run_status)

        # Filter by risk level
        risk_level = self.request.query_params.get('risk_level')
        if risk_level:
            queryset = queryset.filter(risk_level=risk_level)

        return queryset.select_related('field', 'field__farm')

    def get_serializer_class(self):
        if self.action == 'list':
            return DiseaseAnalysisRunListSerializer
        return DiseaseAnalysisRunSerializer

    def perform_create(self, serializer):
        """Create analysis run and trigger async processing."""
        company = require_company(self.request.user)
        field_id = self.request.data.get('field_id')

        # Verify field belongs to company
        field = Field.objects.filter(
            id=field_id,
            farm__company=company
        ).first()

        if not field:
            raise drf_serializers.ValidationError("Field not found or not accessible")

        analysis = serializer.save(
            company=company,
            field=field,
            status='pending'
        )

        # Trigger async analysis task
        from .tasks.disease_tasks import analyze_field_health
        analyze_field_health.delay(field_id=field.id, analysis_id=analysis.id)

        return analysis

    @action(detail=True, methods=['get'])
    def trees(self, request, pk=None):
        """Get tree-level health data for this analysis."""
        analysis = self.get_object()

        # Get tree health records for this field
        trees = TreeHealthRecord.objects.filter(
            field=analysis.field
        ).values(
            'tree_id', 'latitude', 'longitude',
            'current_ndvi', 'health_status', 'ndvi_trend',
            'flagged_for_inspection'
        )

        return Response(list(trees))


# =============================================================================
# SCOUTING REPORT VIEWSET
# =============================================================================

class ScoutingReportViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing scouting reports.

    Users can submit disease/pest observations which contribute
    to the crowdsourced disease monitoring network.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['notes']
    ordering_fields = ['created_at', 'observed_date', 'severity']
    ordering = ['-created_at']

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return ScoutingReport.objects.none()

        queryset = ScoutingReport.objects.filter(company=company)

        # Filter by status
        report_status = self.request.query_params.get('status')
        if report_status:
            queryset = queryset.filter(status=report_status)

        # Filter by report type
        report_type = self.request.query_params.get('report_type')
        if report_type:
            queryset = queryset.filter(report_type=report_type)

        # Filter by field
        field_id = self.request.query_params.get('field_id')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        # Filter by farm
        farm_id = self.request.query_params.get('farm_id')
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        return queryset.select_related('farm', 'field', 'reported_by').prefetch_related('photos')

    def get_serializer_class(self):
        if self.action == 'list':
            return ScoutingReportListSerializer
        return ScoutingReportSerializer

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(
            company=company,
            reported_by=self.request.user
        )

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Verify or mark a scouting report."""
        report = self.get_object()
        new_status = request.data.get('status')
        notes = request.data.get('notes', '')

        if new_status not in ['verified', 'false_alarm', 'inconclusive']:
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        report.status = new_status
        report.verified_by = request.user
        report.verification_notes = notes
        report.save()

        # If verified, potentially create alert
        if new_status == 'verified':
            self._create_scouting_alert(report)

        serializer = ScoutingReportSerializer(report)
        return Response(serializer.data)

    def _create_scouting_alert(self, report):
        """Create alert for verified scouting report if needed."""
        # Check if alert already exists
        existing = DiseaseAlert.objects.filter(
            company=report.company,
            alert_type='scouting_verified',
            is_active=True,
            field=report.field
        ).exists()

        if not existing and report.severity in ['medium', 'high']:
            DiseaseAlert.objects.create(
                company=report.company,
                farm=report.farm,
                field=report.field,
                alert_type='scouting_verified',
                priority='high' if report.severity == 'high' else 'medium',
                title=f"Verified {report.get_report_type_display()}",
                message=f"A {report.get_severity_display()} scouting report has been verified. {report.affected_tree_count or 'Multiple'} trees may be affected.",
                recommended_actions=[
                    "Investigate the affected area",
                    "Consider professional inspection",
                    "Monitor nearby trees for symptoms"
                ]
            )

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def add_photo(self, request, pk=None):
        """Add a photo to a scouting report."""
        report = self.get_object()

        if 'image' not in request.FILES:
            return Response(
                {'error': 'No image provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        photo = ScoutingPhoto.objects.create(
            report=report,
            image=request.FILES['image'],
            caption=request.data.get('caption', '')
        )

        serializer = ScoutingPhotoSerializer(photo)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def regional(self, request):
        """
        Get anonymized regional scouting reports for threat map.

        Returns public/anonymous reports without company-identifying info.
        """
        # Get reports marked for sharing
        reports = ScoutingReport.objects.filter(
            share_anonymously=True,
            status__in=['submitted', 'verified'],
            observed_date__gte=date.today() - timedelta(days=90)
        ).values(
            'latitude', 'longitude', 'report_type',
            'severity', 'observed_date', 'status'
        )

        return Response(list(reports))


# =============================================================================
# DASHBOARD VIEWSET
# =============================================================================

class DiseaseDashboardViewSet(viewsets.ViewSet):
    """
    API endpoint for disease intelligence dashboard data.

    Provides aggregated summary data for the main dashboard view.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def list(self, request):
        """Get dashboard summary data."""
        company = require_company(request.user)
        calculator = ProximityCalculator()

        # Get basic counts
        farms = Farm.objects.filter(company=company)
        fields = Field.objects.filter(farm__company=company, active=True)

        # Get health analysis summary - SQLite compatible approach
        # Get the most recent completed analysis per field
        from django.db.models import Max

        latest_analysis_ids = DiseaseAnalysisRun.objects.filter(
            company=company,
            status='completed'
        ).values('field_id').annotate(
            latest_id=Max('id')
        ).values_list('latest_id', flat=True)

        recent_analyses = DiseaseAnalysisRun.objects.filter(
            id__in=list(latest_analysis_ids)
        )

        health_scores = [a.health_score for a in recent_analyses if a.health_score]
        avg_health = sum(health_scores) / len(health_scores) if health_scores else None

        risk_distribution = {
            'low': 0,
            'moderate': 0,
            'high': 0,
            'critical': 0
        }
        for analysis in recent_analyses:
            if analysis.risk_level and analysis.risk_level in risk_distribution:
                risk_distribution[analysis.risk_level] += 1

        # Get alert summary
        alerts = DiseaseAlert.objects.filter(company=company, is_active=True)
        alert_summary = {
            'total_active': alerts.count(),
            'critical': alerts.filter(priority='critical').count(),
            'high': alerts.filter(priority='high').count(),
            'unacknowledged': alerts.filter(is_acknowledged=False).count()
        }

        # Get proximity risks
        risks = calculator.get_proximity_risks_for_company(company.id, radius_miles=15)
        risk_score = calculator.calculate_company_risk_score(company.id)

        # Recent alerts (last 5)
        recent_alerts = DiseaseAlert.objects.filter(
            company=company,
            is_active=True
        ).order_by('-created_at')[:5]

        # Pending analyses
        pending_analyses = DiseaseAnalysisRun.objects.filter(
            company=company,
            status__in=['pending', 'processing']
        ).count()

        # Count fields with monitoring enabled (with fallback)
        try:
            fields_monitored = fields.filter(disease_monitoring_enabled=True).count()
        except Exception:
            fields_monitored = fields.count()

        return Response({
            'summary': {
                'total_farms': farms.count(),
                'total_fields': fields.count(),
                'total_acres': sum(f.total_acres or 0 for f in fields),
                'fields_monitored': fields_monitored,
                'average_health_score': round(avg_health, 1) if avg_health else None,
            },
            'risk_distribution': risk_distribution,
            'risk_score': risk_score,
            'alerts': alert_summary,
            'recent_alerts': DiseaseAlertListSerializer(recent_alerts, many=True).data,
            'proximity_threats': risks['summary'],
            'farms_at_risk': risks['farms'],
            'pending_analyses': pending_analyses,
        })

    @action(detail=False, methods=['get'])
    def risk_score(self, request):
        """Get company risk score and proximity data."""
        company = require_company(request.user)
        calculator = ProximityCalculator()

        risk_score = calculator.calculate_company_risk_score(company.id)
        risks = calculator.get_proximity_risks_for_company(company.id, radius_miles=15)

        return Response({
            **risk_score,
            'nearest_hlb_miles': risks['summary'].get('nearest_hlb_miles'),
            'nearest_acp_miles': risks['summary'].get('nearest_acp_miles'),
        })

    @action(detail=False, methods=['get'])
    def field_health(self, request):
        """Get health summary for all fields."""
        company = require_company(request.user)

        try:
            fields = Field.objects.filter(
                farm__company=company,
                active=True,
                disease_monitoring_enabled=True
            ).select_related('farm', 'crop').values(
                'id', 'name', 'farm__name',
                'total_acres', 'current_health_score', 'current_risk_level',
                'last_health_analysis_date'
            )
        except Exception:
            # Fallback if disease_monitoring_enabled field doesn't exist
            fields = Field.objects.filter(
                farm__company=company,
                active=True
            ).select_related('farm', 'crop').values(
                'id', 'name', 'farm__name',
                'total_acres'
            )

        return Response(list(fields))

    @action(detail=False, methods=['get'])
    def threat_map_data(self, request):
        """
        Get data for regional threat map.

        Returns:
        - Company farms (with permission)
        - External detections (public)
        - Anonymous scouting reports
        """
        company = require_company(request.user)

        # Company farms (user's data)
        farms = Farm.objects.filter(
            company=company,
            gps_latitude__isnull=False
        ).values('id', 'name', 'gps_latitude', 'gps_longitude')

        # External detections (public data)
        detections = ExternalDetection.objects.filter(
            is_active=True
        ).values(
            'id', 'disease_type', 'disease_name',
            'latitude', 'longitude', 'county',
            'detection_date', 'location_type'
        )

        # Anonymous scouting reports
        scouting = ScoutingReport.objects.filter(
            share_anonymously=True,
            status__in=['submitted', 'verified'],
            observed_date__gte=date.today() - timedelta(days=90)
        ).values(
            'latitude', 'longitude', 'report_type',
            'severity', 'observed_date', 'status'
        )

        return Response({
            'farms': list(farms),
            'detections': list(detections),
            'scouting_reports': list(scouting)
        })

    @action(detail=False, methods=['get'])
    def map_data(self, request):
        """
        Get comprehensive data for ThreatMap component.

        Returns:
        - Company farms with GPS and risk data
        - Active external detections
        - Quarantine zone boundaries (when available)
        """
        company = require_company(request.user)

        # Company farms with risk info
        farms = Farm.objects.filter(
            company=company,
            gps_latitude__isnull=False,
            gps_longitude__isnull=False
        ).values(
            'id', 'name', 'gps_latitude', 'gps_longitude'
        )

        # Convert to list and add risk fields (if they exist in the future)
        farms_list = []
        for farm in farms:
            farm_data = dict(farm)
            # These fields will be populated once Farm model is extended
            farm_data['predicted_risk_score'] = None
            farm_data['predicted_risk_level'] = None
            farms_list.append(farm_data)

        # External detections (active only)
        detections = ExternalDetection.objects.filter(
            is_active=True
        ).values(
            'id', 'disease_type', 'disease_name',
            'latitude', 'longitude', 'county', 'city',
            'detection_date', 'location_type'
        )

        # Quarantine zones - check if model exists first
        quarantine_zones = []
        try:
            from .models import QuarantineZone
            zones = QuarantineZone.objects.filter(
                is_active=True
            ).values(
                'id', 'zone_type', 'name', 'boundary', 'established_date'
            )
            quarantine_zones = list(zones)
        except Exception:
            # QuarantineZone model doesn't exist yet
            pass

        return Response({
            'farms': farms_list,
            'detections': list(detections),
            'quarantine_zones': quarantine_zones,
        })
