"""
Compliance Module Views

This module provides API endpoints for compliance management including:
- Compliance Profile (company settings)
- Compliance Deadlines (tracking and management)
- Compliance Alerts (system-generated notifications)
- Licenses (tracking and renewal)
- WPS Training Records
- Central Posting Locations
- REI Posting Records
- Compliance Reports
- Incident Reports
- Notification Preferences
"""

from datetime import date, timedelta, datetime
from decimal import Decimal
from django.db.models import Count, Q, Sum, Avg
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.http import HttpResponse
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers as drf_serializers

from .permissions import HasCompanyAccess
from .audit_utils import AuditLogMixin

from .models import (
    ComplianceProfile, ComplianceDeadline, ComplianceAlert,
    License, WPSTrainingRecord, CentralPostingLocation, REIPostingRecord,
    ComplianceReport, IncidentReport, NotificationPreference, NotificationLog,
    Company, PesticideApplication
)

from .serializers import (
    ComplianceProfileSerializer,
    ComplianceDeadlineSerializer, ComplianceDeadlineListSerializer, ComplianceDeadlineCompleteSerializer,
    ComplianceAlertSerializer, ComplianceAlertListSerializer,
    LicenseSerializer, LicenseListSerializer,
    WPSTrainingRecordSerializer, WPSTrainingRecordListSerializer,
    CentralPostingLocationSerializer,
    REIPostingRecordSerializer, REIPostingRecordListSerializer,
    ComplianceReportSerializer, ComplianceReportListSerializer,
    IncidentReportSerializer, IncidentReportListSerializer,
    NotificationPreferenceSerializer, NotificationLogSerializer,
    ComplianceDashboardSerializer,
)


from .view_helpers import get_user_company, require_company


# =============================================================================
# COMPLIANCE PROFILE VIEWSET
# =============================================================================

class ComplianceProfileViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing company compliance profiles.

    Each company has exactly one compliance profile that defines
    which regulatory frameworks apply to them.
    """
    serializer_class = ComplianceProfileSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    http_method_names = ['get', 'put', 'patch']  # No create/delete - auto-created with company

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if company:
            return ComplianceProfile.objects.filter(company=company)
        return ComplianceProfile.objects.none()

    def get_object(self):
        """Get or create profile for current company."""
        company = require_company(self.request.user)
        profile, created = ComplianceProfile.objects.get_or_create(company=company)
        return profile

    def list(self, request, *args, **kwargs):
        """Return the single profile for the current company."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def generate_deadlines(self, request):
        """
        Generate recurring deadlines based on compliance profile settings.
        Creates deadlines for the next 12 months.
        """
        profile = self.get_object()
        company = profile.company
        created_count = 0
        today = date.today()

        # PUR Monthly Reports (CA only)
        if profile.requires_pur_reporting:
            for month_offset in range(12):
                # Due on 10th of each month for previous month's applications
                due_month = today.month + month_offset
                due_year = today.year + (due_month - 1) // 12
                due_month = ((due_month - 1) % 12) + 1
                due_date = date(due_year, due_month, 10)

                if due_date > today:
                    _, created = ComplianceDeadline.objects.get_or_create(
                        company=company,
                        name=f"PUR Report - {due_date.strftime('%B %Y')}",
                        due_date=due_date,
                        defaults={
                            'description': f"Submit Pesticide Use Report for {(due_date.replace(day=1) - timedelta(days=1)).strftime('%B %Y')}",
                            'category': 'reporting',
                            'regulation': 'CA PUR',
                            'frequency': 'monthly',
                            'warning_days': 7,
                            'auto_generated': True,
                            'action_url': '/reports/pur',
                        }
                    )
                    if created:
                        created_count += 1

        # WPS Annual Training Renewal Reminder (if WPS compliance required)
        if profile.requires_wps_compliance:
            annual_due = date(today.year + 1, 1, 1)
            _, created = ComplianceDeadline.objects.get_or_create(
                company=company,
                name="WPS Training Review",
                due_date=annual_due,
                defaults={
                    'description': "Review all WPS training records and schedule renewals for expiring certifications",
                    'category': 'training',
                    'regulation': 'EPA WPS',
                    'frequency': 'annual',
                    'warning_days': 30,
                    'auto_generated': True,
                    'action_url': '/compliance/wps',
                }
            )
            if created:
                created_count += 1

        # SGMA Semi-Annual Reports
        if profile.requires_sgma_reporting:
            # Oct-Mar report due April 1, Apr-Sep report due October 1
            sgma_dates = [
                (date(today.year, 4, 1), "Oct-Mar"),
                (date(today.year, 10, 1), "Apr-Sep"),
                (date(today.year + 1, 4, 1), "Oct-Mar"),
            ]
            for due_date, period in sgma_dates:
                if due_date > today:
                    _, created = ComplianceDeadline.objects.get_or_create(
                        company=company,
                        name=f"SGMA Extraction Report - {period}",
                        due_date=due_date,
                        defaults={
                            'description': f"Submit groundwater extraction report for {period} period",
                            'category': 'reporting',
                            'regulation': 'SGMA',
                            'frequency': 'semi_annual',
                            'warning_days': 30,
                            'auto_generated': True,
                            'action_url': '/water/sgma',
                        }
                    )
                    if created:
                        created_count += 1

        # ILRP Annual Report
        if profile.requires_ilrp_reporting:
            ilrp_due = date(today.year + 1, 3, 1)  # Typically due March 1
            _, created = ComplianceDeadline.objects.get_or_create(
                company=company,
                name=f"ILRP Nitrogen Report - {today.year}",
                due_date=ilrp_due,
                defaults={
                    'description': f"Submit Irrigated Lands Regulatory Program nitrogen management report for {today.year}",
                    'category': 'reporting',
                    'regulation': 'ILRP',
                    'frequency': 'annual',
                    'warning_days': 30,
                    'auto_generated': True,
                    'action_url': '/reports/nitrogen',
                }
            )
            if created:
                created_count += 1

        return Response({
            'message': f'Generated {created_count} new compliance deadlines',
            'created_count': created_count,
        })


# =============================================================================
# COMPLIANCE DEADLINE VIEWSET
# =============================================================================

class ComplianceDeadlineViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing compliance deadlines.

    Supports filtering by status, category, date range, and regulation.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description', 'regulation']
    ordering_fields = ['due_date', 'status', 'category', 'created_at']
    ordering = ['due_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return ComplianceDeadlineListSerializer
        return ComplianceDeadlineSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return ComplianceDeadline.objects.none()

        queryset = ComplianceDeadline.objects.filter(company=company)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        # Filter by regulation
        regulation = self.request.query_params.get('regulation')
        if regulation:
            queryset = queryset.filter(regulation__icontains=regulation)

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(due_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(due_date__lte=end_date)

        # Filter overdue only
        overdue_only = self.request.query_params.get('overdue')
        if overdue_only and overdue_only.lower() == 'true':
            queryset = queryset.filter(status='overdue')

        # Filter due soon only
        due_soon = self.request.query_params.get('due_soon')
        if due_soon and due_soon.lower() == 'true':
            queryset = queryset.filter(status='due_soon')

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark a deadline as completed."""
        deadline = self.get_object()
        serializer = ComplianceDeadlineCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        deadline.mark_complete(
            user=request.user,
            notes=serializer.validated_data.get('notes', '')
        )

        # Deactivate any related alerts
        ComplianceAlert.objects.filter(
            related_deadline=deadline,
            is_active=True
        ).update(is_active=False)

        return Response(ComplianceDeadlineSerializer(deadline).data)

    @action(detail=True, methods=['post'])
    def skip(self, request, pk=None):
        """Mark a deadline as skipped/not applicable."""
        deadline = self.get_object()
        deadline.status = 'skipped'
        deadline.completion_notes = request.data.get('notes', 'Marked as not applicable')
        deadline.save()

        return Response(ComplianceDeadlineSerializer(deadline).data)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get deadlines due in the next 30 days."""
        company = require_company(request.user)
        end_date = date.today() + timedelta(days=30)

        deadlines = ComplianceDeadline.objects.filter(
            company=company,
            due_date__lte=end_date,
            status__in=['upcoming', 'due_soon']
        ).order_by('due_date')[:20]

        serializer = ComplianceDeadlineListSerializer(deadlines, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get all overdue deadlines."""
        company = require_company(request.user)

        deadlines = ComplianceDeadline.objects.filter(
            company=company,
            status='overdue'
        ).order_by('due_date')

        serializer = ComplianceDeadlineListSerializer(deadlines, many=True)
        return Response(serializer.data)


# =============================================================================
# COMPLIANCE ALERT VIEWSET
# =============================================================================

class ComplianceAlertViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing compliance alerts.

    Alerts are system-generated notifications about compliance issues.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    http_method_names = ['get', 'post']  # No direct create/update/delete
    filter_backends = [filters.OrderingFilter]
    ordering = ['-priority', '-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ComplianceAlertListSerializer
        return ComplianceAlertSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return ComplianceAlert.objects.none()

        queryset = ComplianceAlert.objects.filter(company=company)

        # By default, only show active alerts
        active_only = self.request.query_params.get('active', 'true')
        if active_only.lower() == 'true':
            queryset = queryset.filter(is_active=True)

        # Filter by priority
        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)

        # Filter by type
        alert_type = self.request.query_params.get('type')
        if alert_type:
            queryset = queryset.filter(alert_type=alert_type)

        # Filter acknowledged
        acknowledged = self.request.query_params.get('acknowledged')
        if acknowledged:
            queryset = queryset.filter(is_acknowledged=acknowledged.lower() == 'true')

        return queryset

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge an alert."""
        alert = self.get_object()
        alert.acknowledge(request.user)
        return Response(ComplianceAlertSerializer(alert).data)

    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        """Dismiss/deactivate an alert."""
        alert = self.get_object()
        alert.dismiss()
        return Response(ComplianceAlertSerializer(alert).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get alert summary counts by priority and type."""
        company = require_company(request.user)

        active_alerts = ComplianceAlert.objects.filter(
            company=company,
            is_active=True
        )

        summary = {
            'total_active': active_alerts.count(),
            'by_priority': {
                'critical': active_alerts.filter(priority='critical').count(),
                'high': active_alerts.filter(priority='high').count(),
                'medium': active_alerts.filter(priority='medium').count(),
                'low': active_alerts.filter(priority='low').count(),
            },
            'unacknowledged': active_alerts.filter(is_acknowledged=False).count(),
        }

        return Response(summary)


# =============================================================================
# LICENSE VIEWSET
# =============================================================================

class LicenseViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing licenses and certificates.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['license_number', 'name_on_license', 'issuing_authority']
    ordering_fields = ['expiration_date', 'license_type', 'status', 'created_at']
    ordering = ['expiration_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return LicenseListSerializer
        return LicenseSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return License.objects.none()

        queryset = License.objects.filter(company=company)

        # Filter by license type
        license_type = self.request.query_params.get('type')
        if license_type:
            queryset = queryset.filter(license_type=license_type)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by user
        user_id = self.request.query_params.get('user')
        if user_id:
            if user_id == 'company':
                queryset = queryset.filter(user__isnull=True)
            else:
                queryset = queryset.filter(user_id=user_id)

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=False, methods=['get'])
    def expiring(self, request):
        """Get licenses expiring within 90 days."""
        company = require_company(request.user)
        cutoff = date.today() + timedelta(days=90)

        licenses = License.objects.filter(
            company=company,
            expiration_date__lte=cutoff,
            status__in=['active', 'expiring_soon']
        ).order_by('expiration_date')

        serializer = LicenseListSerializer(licenses, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def start_renewal(self, request, pk=None):
        """Mark that renewal process has started."""
        license_obj = self.get_object()
        license_obj.renewal_in_progress = True
        license_obj.renewal_submitted_date = request.data.get('submitted_date')
        license_obj.renewal_notes = request.data.get('notes', '')
        license_obj.save()
        return Response(LicenseSerializer(license_obj).data)


# =============================================================================
# WPS TRAINING VIEWSET
# =============================================================================

class WPSTrainingRecordViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing WPS training records.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['trainee_name', 'trainer_name', 'trainee_employee_id']
    ordering_fields = ['training_date', 'expiration_date', 'training_type']
    ordering = ['-training_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return WPSTrainingRecordListSerializer
        return WPSTrainingRecordSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return WPSTrainingRecord.objects.none()

        queryset = WPSTrainingRecord.objects.filter(company=company)

        # Filter by training type
        training_type = self.request.query_params.get('type')
        if training_type:
            queryset = queryset.filter(training_type=training_type)

        # Filter by trainee name
        trainee = self.request.query_params.get('trainee')
        if trainee:
            queryset = queryset.filter(trainee_name__icontains=trainee)

        # Filter by valid/expired
        valid_only = self.request.query_params.get('valid')
        if valid_only and valid_only.lower() == 'true':
            queryset = queryset.filter(expiration_date__gte=date.today())
        elif valid_only and valid_only.lower() == 'false':
            queryset = queryset.filter(expiration_date__lt=date.today())

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=False, methods=['get'])
    def expiring(self, request):
        """Get training records expiring within 90 days."""
        company = require_company(request.user)
        cutoff = date.today() + timedelta(days=90)

        records = WPSTrainingRecord.objects.filter(
            company=company,
            expiration_date__lte=cutoff,
            expiration_date__gte=date.today()
        ).order_by('expiration_date')

        serializer = WPSTrainingRecordListSerializer(records, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_worker(self, request):
        """Get training records grouped by worker."""
        company = require_company(request.user)

        # Get unique workers with their latest training per type
        workers = WPSTrainingRecord.objects.filter(
            company=company
        ).values('trainee_name').annotate(
            total_trainings=Count('id'),
            latest_training=Max('training_date'),
            next_expiration=Min('expiration_date', filter=Q(expiration_date__gte=date.today()))
        ).order_by('trainee_name')

        return Response(list(workers))

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get WPS compliance dashboard data."""
        company = require_company(request.user)
        today = date.today()

        total_records = WPSTrainingRecord.objects.filter(company=company)
        valid_records = total_records.filter(expiration_date__gte=today)
        expired_records = total_records.filter(expiration_date__lt=today)
        expiring_soon = total_records.filter(
            expiration_date__gte=today,
            expiration_date__lte=today + timedelta(days=90)
        )

        # Unique workers
        unique_workers = total_records.values('trainee_name').distinct().count()
        workers_with_valid = valid_records.values('trainee_name').distinct().count()

        return Response({
            'total_records': total_records.count(),
            'valid_records': valid_records.count(),
            'expired_records': expired_records.count(),
            'expiring_soon': expiring_soon.count(),
            'unique_workers': unique_workers,
            'workers_with_valid_training': workers_with_valid,
            'by_type': list(
                valid_records.values('training_type').annotate(
                    count=Count('id')
                ).order_by('training_type')
            ),
        })


# =============================================================================
# CENTRAL POSTING LOCATION VIEWSET
# =============================================================================

class CentralPostingLocationViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing WPS central posting locations.
    """
    serializer_class = CentralPostingLocationSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return CentralPostingLocation.objects.none()

        queryset = CentralPostingLocation.objects.filter(
            company=company,
            active=True
        ).select_related('farm', 'last_verified_by')

        # Filter by farm
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Mark location as verified."""
        location = self.get_object()
        notes = request.data.get('notes', '')
        location.verify(request.user, notes)
        return Response(CentralPostingLocationSerializer(location).data)


# =============================================================================
# REI POSTING RECORD VIEWSET
# =============================================================================

class REIPostingRecordViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing REI posting records.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    http_method_names = ['get', 'post']

    def get_serializer_class(self):
        if self.action == 'list':
            return REIPostingRecordListSerializer
        return REIPostingRecordSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return REIPostingRecord.objects.none()

        queryset = REIPostingRecord.objects.filter(
            application__field__farm__company=company
        ).select_related(
            'application', 'application__field', 'application__product',
            'posted_by', 'removed_by'
        )

        # Filter active only
        active_only = self.request.query_params.get('active')
        if active_only and active_only.lower() == 'true':
            queryset = queryset.filter(rei_end_datetime__gt=timezone.now())

        return queryset.order_by('-rei_end_datetime')

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get currently active REIs."""
        company = require_company(request.user)

        active_reis = REIPostingRecord.objects.filter(
            application__field__farm__company=company,
            rei_end_datetime__gt=timezone.now()
        ).select_related(
            'application', 'application__field', 'application__product'
        ).order_by('rei_end_datetime')

        serializer = REIPostingRecordListSerializer(active_reis, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_posted(self, request, pk=None):
        """Mark REI signs as posted."""
        record = self.get_object()
        record.mark_posted(request.user)
        return Response(REIPostingRecordSerializer(record).data)

    @action(detail=True, methods=['post'])
    def mark_removed(self, request, pk=None):
        """Mark REI signs as removed."""
        record = self.get_object()
        record.mark_removed(request.user)
        return Response(REIPostingRecordSerializer(record).data)


# =============================================================================
# COMPLIANCE REPORT VIEWSET
# =============================================================================

class ComplianceReportViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing compliance reports.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.OrderingFilter]
    ordering = ['-reporting_period_end', '-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ComplianceReportListSerializer
        return ComplianceReportSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return ComplianceReport.objects.none()

        queryset = ComplianceReport.objects.filter(company=company)

        # Filter by report type
        report_type = self.request.query_params.get('type')
        if report_type:
            queryset = queryset.filter(report_type=report_type)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company, created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        """Run validation on a report."""
        report = self.get_object()

        # TODO: Implement actual validation logic based on report type
        # For now, just mark as validated
        report.validation_run_at = timezone.now()
        report.validation_errors = []
        report.validation_warnings = []
        report.is_valid = True
        report.status = 'ready'
        report.save()

        return Response(ComplianceReportSerializer(report).data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Mark report as submitted."""
        report = self.get_object()

        if not report.can_submit:
            return Response(
                {'error': 'Report is not ready for submission. Please validate first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        report.status = 'submitted'
        report.submitted_at = timezone.now()
        report.submitted_by = request.user
        report.submission_method = request.data.get('method', '')
        report.submission_reference = request.data.get('reference', '')
        report.save()

        # Mark related deadline as complete if exists
        if report.related_deadline:
            report.related_deadline.mark_complete(request.user, f"Report submitted: {report.submission_reference}")

        return Response(ComplianceReportSerializer(report).data)


# =============================================================================
# INCIDENT REPORT VIEWSET
# =============================================================================

class IncidentReportViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing incident reports.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'location_description']
    ordering_fields = ['incident_date', 'severity', 'status']
    ordering = ['-incident_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return IncidentReportListSerializer
        return IncidentReportSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return IncidentReport.objects.none()

        queryset = IncidentReport.objects.filter(company=company)

        # Filter by type
        incident_type = self.request.query_params.get('type')
        if incident_type:
            queryset = queryset.filter(incident_type=incident_type)

        # Filter by severity
        severity = self.request.query_params.get('severity')
        if severity:
            queryset = queryset.filter(severity=severity)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company, reported_by=self.request.user)

    @action(detail=True, methods=['post'])
    def start_investigation(self, request, pk=None):
        """Start investigation on an incident."""
        incident = self.get_object()
        incident.status = 'investigating'
        incident.investigator = request.user
        incident.save()
        return Response(IncidentReportSerializer(incident).data)

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Mark incident as resolved."""
        incident = self.get_object()
        incident.status = 'resolved'
        incident.resolved_date = date.today()
        incident.resolved_by = request.user
        incident.resolution_summary = request.data.get('summary', '')
        incident.corrective_actions = request.data.get('corrective_actions', incident.corrective_actions)
        incident.preventive_measures = request.data.get('preventive_measures', incident.preventive_measures)
        incident.save()
        return Response(IncidentReportSerializer(incident).data)


# =============================================================================
# NOTIFICATION PREFERENCE VIEWSET
# =============================================================================

class NotificationPreferenceViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing user notification preferences.
    """
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'put', 'patch']

    def get_queryset(self):
        return NotificationPreference.objects.filter(user=self.request.user)

    def get_object(self):
        """Get or create preferences for current user."""
        prefs, created = NotificationPreference.objects.get_or_create(user=self.request.user)
        return prefs

    def list(self, request, *args, **kwargs):
        """Return the single preference object for current user."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


# =============================================================================
# COMPLIANCE DASHBOARD VIEW
# =============================================================================

class ComplianceDashboardViewSet(viewsets.ViewSet):
    """
    API endpoint for the compliance dashboard overview.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def list(self, request):
        """Get comprehensive compliance dashboard data."""
        company = require_company(request.user)
        today = date.today()

        # Deadline statistics
        deadlines = ComplianceDeadline.objects.filter(company=company)
        deadlines_this_month = deadlines.filter(
            due_date__year=today.year,
            due_date__month=today.month,
            status__in=['upcoming', 'due_soon']
        ).count()
        overdue_deadlines = deadlines.filter(status='overdue').count()

        # License statistics
        licenses = License.objects.filter(company=company)
        expiring_licenses = licenses.filter(
            expiration_date__lte=today + timedelta(days=90),
            status__in=['active', 'expiring_soon']
        ).count()

        # Alert statistics
        active_alerts = ComplianceAlert.objects.filter(
            company=company,
            is_active=True
        ).count()

        # Training statistics
        training = WPSTrainingRecord.objects.filter(company=company)
        expiring_training = training.filter(
            expiration_date__lte=today + timedelta(days=90),
            expiration_date__gte=today
        ).count()

        # Calculate overall status and score
        critical_issues = overdue_deadlines + licenses.filter(status='expired').count()
        warning_issues = expiring_licenses + expiring_training

        if critical_issues > 0:
            overall_status = 'critical'
            score = max(0, 100 - (critical_issues * 20) - (warning_issues * 5))
        elif warning_issues > 0:
            overall_status = 'warning'
            score = max(50, 100 - (warning_issues * 10))
        else:
            overall_status = 'good'
            score = 100

        # Compliance by category
        by_category = {}
        for category, _ in ComplianceDeadline.CATEGORY_CHOICES:
            cat_deadlines = deadlines.filter(category=category)
            by_category[category] = {
                'pending': cat_deadlines.filter(status__in=['upcoming', 'due_soon']).count(),
                'overdue': cat_deadlines.filter(status='overdue').count(),
                'completed': cat_deadlines.filter(status='completed').count(),
            }
            # Determine category status
            if by_category[category]['overdue'] > 0:
                by_category[category]['status'] = 'critical'
            elif by_category[category]['pending'] > 5:
                by_category[category]['status'] = 'warning'
            else:
                by_category[category]['status'] = 'good'

        # Get upcoming deadlines
        upcoming_deadlines = deadlines.filter(
            due_date__lte=today + timedelta(days=30),
            status__in=['upcoming', 'due_soon']
        ).order_by('due_date')[:10]

        # Get active alerts
        alerts = ComplianceAlert.objects.filter(
            company=company,
            is_active=True
        ).order_by('-priority', '-created_at')[:10]

        # Get expiring licenses
        exp_licenses = licenses.filter(
            expiration_date__lte=today + timedelta(days=90),
            status__in=['active', 'expiring_soon']
        ).order_by('expiration_date')[:5]

        # Get expiring training
        exp_training = training.filter(
            expiration_date__lte=today + timedelta(days=90),
            expiration_date__gte=today
        ).order_by('expiration_date')[:5]

        data = {
            'overall_status': overall_status,
            'score': score,
            'summary': {
                'deadlines_this_month': deadlines_this_month,
                'overdue_items': overdue_deadlines,
                'expiring_licenses': expiring_licenses,
                'active_alerts': active_alerts,
                'expiring_training': expiring_training,
            },
            'by_category': by_category,
            'upcoming_deadlines': ComplianceDeadlineListSerializer(upcoming_deadlines, many=True).data,
            'active_alerts': ComplianceAlertListSerializer(alerts, many=True).data,
            'expiring_licenses': LicenseListSerializer(exp_licenses, many=True).data,
            'expiring_training': WPSTrainingRecordListSerializer(exp_training, many=True).data,
        }

        return Response(data)

    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """Get calendar view of compliance deadlines."""
        company = require_company(request.user)

        # Get date range from params (default to current month)
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        else:
            start_date = date.today().replace(day=1)

        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        else:
            # End of next month
            if start_date.month == 12:
                end_date = date(start_date.year + 1, 2, 1) - timedelta(days=1)
            else:
                end_date = date(start_date.year, start_date.month + 2, 1) - timedelta(days=1)

        deadlines = ComplianceDeadline.objects.filter(
            company=company,
            due_date__gte=start_date,
            due_date__lte=end_date
        ).order_by('due_date')

        # Group by date
        calendar_data = {}
        for deadline in deadlines:
            date_key = deadline.due_date.isoformat()
            if date_key not in calendar_data:
                calendar_data[date_key] = {
                    'date': date_key,
                    'deadlines': [],
                }
            calendar_data[date_key]['deadlines'].append(
                ComplianceDeadlineListSerializer(deadline).data
            )

        return Response(list(calendar_data.values()))
