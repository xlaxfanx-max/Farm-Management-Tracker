"""
Primus GFS Compliance Views

Phase 1: Document Control, Internal Audits, Corrective Actions, Land History
Phase 2: Supplier Control, Mock Recall, Food Defense, Field Sanitation
Dashboard aggregation.
"""

from datetime import date, timedelta
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .permissions import HasCompanyAccess
from .audit_utils import AuditLogMixin
from .view_helpers import get_user_company, require_company

from .models import (
    ControlledDocument, DocumentRevisionHistory,
    InternalAudit, AuditFinding, CorrectiveAction,
    LandHistoryAssessment, ComplianceDeadline, ComplianceAlert, Field,
    ApprovedSupplier, IncomingMaterialVerification,
    MockRecall, FoodDefensePlan, FieldSanitationLog,
    EquipmentCalibration, PestControlProgram, PestMonitoringLog,
    PreHarvestInspection, Farm,
)

from .primusgfs_serializers import (
    ControlledDocumentSerializer, ControlledDocumentListSerializer,
    DocumentRevisionHistorySerializer,
    InternalAuditSerializer, InternalAuditListSerializer,
    AuditFindingSerializer,
    CorrectiveActionSerializer, CorrectiveActionListSerializer,
    LandHistoryAssessmentSerializer, LandHistoryAssessmentListSerializer,
    ApprovedSupplierSerializer, ApprovedSupplierListSerializer,
    IncomingMaterialVerificationSerializer, IncomingMaterialVerificationListSerializer,
    MockRecallSerializer, MockRecallListSerializer,
    FoodDefensePlanSerializer, FoodDefensePlanListSerializer,
    FieldSanitationLogSerializer, FieldSanitationLogListSerializer,
    EquipmentCalibrationSerializer, EquipmentCalibrationListSerializer,
    PestControlProgramSerializer, PestControlProgramListSerializer,
    PestMonitoringLogSerializer, PestMonitoringLogListSerializer,
    PreHarvestInspectionSerializer, PreHarvestInspectionListSerializer,
)


# =============================================================================
# DOCUMENT CONTROL VIEWSET
# =============================================================================

class ControlledDocumentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing controlled documents (SOPs, policies, manuals).
    Supports filtering by status, type, module, and review due date.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['document_number', 'title', 'description', 'content_text']
    ordering_fields = ['document_number', 'title', 'review_due_date', 'status', 'updated_at']
    ordering = ['document_number']

    def get_serializer_class(self):
        if self.action == 'list':
            return ControlledDocumentListSerializer
        return ControlledDocumentSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return ControlledDocument.objects.none()

        queryset = ControlledDocument.objects.filter(company=company)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by document type
        doc_type = self.request.query_params.get('document_type')
        if doc_type:
            queryset = queryset.filter(document_type=doc_type)

        # Filter by primus module
        module = self.request.query_params.get('primus_module')
        if module:
            queryset = queryset.filter(primus_module=module)

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company, prepared_by=self.request.user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a document and set it as active."""
        document = self.get_object()
        document.status = 'approved'
        document.approved_by = request.user
        document.approved_at = timezone.now()
        document.save()

        return Response(ControlledDocumentSerializer(document).data)

    @action(detail=True, methods=['post'])
    def new_revision(self, request, pk=None):
        """
        Create a new revision of an existing document.
        Archives current version in revision history.
        """
        original = self.get_object()

        # Save revision history
        DocumentRevisionHistory.objects.create(
            document=original,
            version=original.version,
            change_description=request.data.get('change_description', ''),
            changed_by=request.user,
            previous_file=original.file if original.file else None,
        )

        # Update document with new version
        new_version = request.data.get('version', '')
        if not new_version:
            # Auto-increment: "1.0" -> "1.1", "2.3" -> "2.4"
            parts = original.version.split('.')
            try:
                parts[-1] = str(int(parts[-1]) + 1)
                new_version = '.'.join(parts)
            except (ValueError, IndexError):
                new_version = original.version + '.1'

        original.version = new_version
        original.revision_date = date.today()
        original.status = 'draft'
        original.approved_by = None
        original.approved_at = None
        original.prepared_by = request.user
        original.save()

        return Response(ControlledDocumentSerializer(original).data)

    @action(detail=False, methods=['get'])
    def overdue_reviews(self, request):
        """List all documents with overdue review dates."""
        company = require_company(request.user)
        queryset = ControlledDocument.objects.filter(
            company=company,
            status='approved',
            review_due_date__lt=date.today(),
        )
        serializer = ControlledDocumentListSerializer(queryset, many=True)
        return Response(serializer.data)


# =============================================================================
# INTERNAL AUDIT VIEWSET
# =============================================================================

class InternalAuditViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing internal audits.
    Supports filtering by status, type, and date range.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['audit_number', 'title', 'scope_description']
    ordering_fields = ['planned_date', 'actual_date', 'status', 'created_at']
    ordering = ['-planned_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return InternalAuditListSerializer
        return InternalAuditSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return InternalAudit.objects.none()

        queryset = InternalAudit.objects.filter(company=company)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by audit type
        audit_type = self.request.query_params.get('audit_type')
        if audit_type:
            queryset = queryset.filter(audit_type=audit_type)

        # Filter by year
        year = self.request.query_params.get('year')
        if year:
            queryset = queryset.filter(planned_date__year=year)

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark an audit as completed with results."""
        audit = self.get_object()
        audit.status = 'completed'
        audit.actual_date = request.data.get('actual_date', date.today())
        audit.overall_score = request.data.get('overall_score', audit.overall_score)
        audit.executive_summary = request.data.get(
            'executive_summary', audit.executive_summary
        )
        audit.save()

        return Response(InternalAuditSerializer(audit).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Return audit statistics for the company."""
        company = require_company(request.user)
        current_year = date.today().year
        audits = InternalAudit.objects.filter(company=company)

        return Response({
            'total': audits.count(),
            'this_year': audits.filter(planned_date__year=current_year).count(),
            'completed_this_year': audits.filter(
                planned_date__year=current_year, status='completed'
            ).count(),
            'planned': audits.filter(status='planned').count(),
            'in_progress': audits.filter(status='in_progress').count(),
            'by_type': list(
                audits.values('audit_type').annotate(count=Count('id'))
            ),
        })


# =============================================================================
# AUDIT FINDING VIEWSET
# =============================================================================

class AuditFindingViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing audit findings.
    Always filtered by audit_id.
    """
    serializer_class = AuditFindingSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return AuditFinding.objects.none()

        queryset = AuditFinding.objects.filter(audit__company=company)

        # Filter by specific audit
        audit_id = self.request.query_params.get('audit_id')
        if audit_id:
            queryset = queryset.filter(audit_id=audit_id)

        # Filter by severity
        severity = self.request.query_params.get('severity')
        if severity:
            queryset = queryset.filter(severity=severity)

        return queryset


# =============================================================================
# CORRECTIVE ACTION VIEWSET
# =============================================================================

class CorrectiveActionViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing corrective actions.
    Supports filtering by status, source type, and due date.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['ca_number', 'description', 'root_cause']
    ordering_fields = ['due_date', 'status', 'created_at']
    ordering = ['due_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return CorrectiveActionListSerializer
        return CorrectiveActionSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return CorrectiveAction.objects.none()

        queryset = CorrectiveAction.objects.filter(company=company)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by source type
        source_type = self.request.query_params.get('source_type')
        if source_type:
            queryset = queryset.filter(source_type=source_type)

        # Filter by finding
        finding_id = self.request.query_params.get('finding_id')
        if finding_id:
            queryset = queryset.filter(finding_id=finding_id)

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=True, methods=['post'])
    def implement(self, request, pk=None):
        """Mark a corrective action as implemented."""
        ca = self.get_object()
        ca.status = 'implemented'
        ca.implemented_date = request.data.get('implemented_date', date.today())
        ca.notes = request.data.get('notes', ca.notes)
        ca.save()

        return Response(CorrectiveActionSerializer(ca).data)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Verify and close a corrective action."""
        ca = self.get_object()
        ca.status = 'verified'
        ca.verified_date = request.data.get('verified_date', date.today())
        ca.verified_by = request.user
        ca.verification_notes = request.data.get('verification_notes', '')
        ca.save()

        return Response(CorrectiveActionSerializer(ca).data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """List all overdue corrective actions."""
        company = require_company(request.user)
        queryset = CorrectiveAction.objects.filter(
            company=company,
            status__in=['open', 'in_progress', 'overdue'],
            due_date__lt=date.today(),
        )
        serializer = CorrectiveActionListSerializer(queryset, many=True)
        return Response(serializer.data)


# =============================================================================
# LAND HISTORY ASSESSMENT VIEWSET
# =============================================================================

class LandHistoryAssessmentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing land history assessments.
    Supports filtering by field, farm, and risk level.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['field__name', 'risk_justification']
    ordering_fields = ['assessment_date', 'contamination_risk', 'created_at']
    ordering = ['-assessment_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return LandHistoryAssessmentListSerializer
        return LandHistoryAssessmentSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return LandHistoryAssessment.objects.none()

        queryset = LandHistoryAssessment.objects.filter(
            company=company
        ).select_related('field', 'field__farm')

        # Filter by field
        field_id = self.request.query_params.get('field_id')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        # Filter by farm
        farm_id = self.request.query_params.get('farm_id')
        if farm_id:
            queryset = queryset.filter(field__farm_id=farm_id)

        # Filter by risk level
        risk = self.request.query_params.get('contamination_risk')
        if risk:
            queryset = queryset.filter(contamination_risk=risk)

        # Filter approved/unapproved
        approved = self.request.query_params.get('approved')
        if approved is not None:
            queryset = queryset.filter(approved=approved.lower() == 'true')

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company, assessed_by=self.request.user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a land history assessment."""
        assessment = self.get_object()
        assessment.approved = True
        assessment.approved_by = request.user
        assessment.approved_at = timezone.now()
        assessment.save()

        return Response(LandHistoryAssessmentSerializer(assessment).data)


# =============================================================================
# PHASE 2 — SUPPLIER CONTROL VIEWSETS
# =============================================================================

class ApprovedSupplierViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """API endpoint for managing approved suppliers."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['supplier_name', 'supplier_code', 'contact_name']
    ordering_fields = ['supplier_name', 'status', 'next_review_date', 'created_at']
    ordering = ['supplier_name']

    def get_serializer_class(self):
        if self.action == 'list':
            return ApprovedSupplierListSerializer
        return ApprovedSupplierSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return ApprovedSupplier.objects.none()

        queryset = ApprovedSupplier.objects.filter(company=company)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a supplier."""
        supplier = self.get_object()
        supplier.status = 'approved'
        supplier.approved_by = request.user
        supplier.approved_date = date.today()
        if not supplier.next_review_date:
            supplier.next_review_date = date.today() + timedelta(days=365)
        supplier.save()
        return Response(ApprovedSupplierSerializer(supplier).data)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """Suspend a supplier."""
        supplier = self.get_object()
        supplier.status = 'suspended'
        supplier.save()
        return Response(ApprovedSupplierSerializer(supplier).data)

    @action(detail=False, methods=['get'])
    def due_for_review(self, request):
        """List suppliers due for review within 30 days."""
        company = require_company(request.user)
        cutoff = date.today() + timedelta(days=30)
        queryset = ApprovedSupplier.objects.filter(
            company=company,
            status__in=['approved', 'conditional'],
            next_review_date__lte=cutoff,
        )
        serializer = ApprovedSupplierListSerializer(queryset, many=True)
        return Response(serializer.data)


class IncomingMaterialVerificationViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """API endpoint for managing incoming material verifications."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['receipt_date', 'created_at']
    ordering = ['-receipt_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return IncomingMaterialVerificationListSerializer
        return IncomingMaterialVerificationSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return IncomingMaterialVerification.objects.none()

        queryset = IncomingMaterialVerification.objects.filter(
            company=company
        ).select_related('supplier')

        supplier_id = self.request.query_params.get('supplier_id')
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)

        accepted = self.request.query_params.get('accepted')
        if accepted is not None:
            queryset = queryset.filter(accepted=accepted.lower() == 'true')

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company, verified_by=self.request.user)


# =============================================================================
# PHASE 2 — MOCK RECALL VIEWSET
# =============================================================================

class MockRecallViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """API endpoint for managing mock recall exercises."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['recall_number', 'target_product', 'scenario_description']
    ordering_fields = ['exercise_date', 'status', 'created_at']
    ordering = ['-exercise_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return MockRecallListSerializer
        return MockRecallSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return MockRecall.objects.none()

        queryset = MockRecall.objects.filter(company=company)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        year = self.request.query_params.get('year')
        if year:
            queryset = queryset.filter(exercise_date__year=year)

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start the mock recall timer."""
        recall = self.get_object()
        recall.status = 'in_progress'
        recall.trace_start_time = timezone.now()
        recall.save()
        return Response(MockRecallSerializer(recall).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete the mock recall with results."""
        recall = self.get_object()
        recall.trace_end_time = timezone.now()
        recall.status = request.data.get('status', 'completed')
        recall.product_accounted_percent = request.data.get('product_accounted_percent')
        recall.lots_traced_forward = request.data.get('lots_traced_forward', [])
        recall.lots_traced_backward = request.data.get('lots_traced_backward', [])
        recall.effectiveness_score = request.data.get('effectiveness_score')
        recall.passed = request.data.get('passed')
        recall.save()
        return Response(MockRecallSerializer(recall).data)

    @action(detail=True, methods=['post'])
    def score(self, request, pk=None):
        """Auto-score a mock recall based on results."""
        recall = self.get_object()
        score = 0

        # Time component (40 points): full marks if <= 240 min
        if recall.trace_duration_minutes is not None:
            if recall.trace_duration_minutes <= 240:
                score += 40
            elif recall.trace_duration_minutes <= 360:
                score += 20
            else:
                score += 0

        # Traceability component (40 points): based on % accounted
        if recall.product_accounted_percent is not None:
            score += int(float(recall.product_accounted_percent) * 0.4)

        # Completeness component (20 points): forward + backward trace
        if recall.lots_traced_forward:
            score += 10
        if recall.lots_traced_backward:
            score += 10

        recall.effectiveness_score = score
        recall.passed = score >= 70
        recall.save()

        return Response(MockRecallSerializer(recall).data)


# =============================================================================
# PHASE 2 — FOOD DEFENSE PLAN VIEWSET
# =============================================================================

class FoodDefensePlanViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """API endpoint for managing food defense plans."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    ordering = ['-plan_year']

    def get_serializer_class(self):
        if self.action == 'list':
            return FoodDefensePlanListSerializer
        return FoodDefensePlanSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FoodDefensePlan.objects.none()

        return FoodDefensePlan.objects.filter(company=company)

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a food defense plan."""
        plan = self.get_object()
        plan.approved = True
        plan.approved_by = request.user
        plan.approved_at = timezone.now()
        plan.save()
        return Response(FoodDefensePlanSerializer(plan).data)


# =============================================================================
# PHASE 2 — FIELD SANITATION VIEWSET
# =============================================================================

class FieldSanitationLogViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """API endpoint for managing field sanitation logs."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['log_date', 'compliant', 'created_at']
    ordering = ['-log_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return FieldSanitationLogListSerializer
        return FieldSanitationLogSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FieldSanitationLog.objects.none()

        queryset = FieldSanitationLog.objects.filter(
            company=company
        ).select_related('farm', 'field')

        farm_id = self.request.query_params.get('farm_id')
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        compliant = self.request.query_params.get('compliant')
        if compliant is not None:
            queryset = queryset.filter(compliant=compliant.lower() == 'true')

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(log_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(log_date__lte=end_date)

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company, checked_by=self.request.user)

    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get today's sanitation logs."""
        company = require_company(request.user)
        queryset = FieldSanitationLog.objects.filter(
            company=company, log_date=date.today()
        ).select_related('farm', 'field')
        serializer = FieldSanitationLogSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def compliance_summary(self, request):
        """Return sanitation compliance summary for last 30 days."""
        company = require_company(request.user)
        cutoff = date.today() - timedelta(days=30)
        logs = FieldSanitationLog.objects.filter(
            company=company, log_date__gte=cutoff
        )
        total = logs.count()
        compliant_count = logs.filter(compliant=True).count()

        return Response({
            'period_days': 30,
            'total_logs': total,
            'compliant': compliant_count,
            'non_compliant': total - compliant_count,
            'compliance_rate': round(
                (compliant_count / total * 100) if total > 0 else 0, 1
            ),
        })


# =============================================================================
# PHASE 3 — EQUIPMENT CALIBRATION VIEWSET
# =============================================================================

class EquipmentCalibrationViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """API endpoint for managing equipment calibration records."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['equipment_name', 'equipment_id', 'location']
    ordering_fields = ['calibration_date', 'next_calibration_date', 'status', 'equipment_name']
    ordering = ['-calibration_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return EquipmentCalibrationListSerializer
        return EquipmentCalibrationSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return EquipmentCalibration.objects.none()

        queryset = EquipmentCalibration.objects.filter(company=company)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        equipment_type = self.request.query_params.get('equipment_type')
        if equipment_type:
            queryset = queryset.filter(equipment_type=equipment_type)

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Record calibration completion with results."""
        calibration = self.get_object()
        calibration.status = 'passed' if request.data.get('within_tolerance', True) else 'failed'
        calibration.reading_before = request.data.get('reading_before', calibration.reading_before)
        calibration.reading_after = request.data.get('reading_after', calibration.reading_after)
        calibration.within_tolerance = request.data.get('within_tolerance')
        calibration.calibrated_by = request.data.get('calibrated_by', calibration.calibrated_by)
        calibration.save()
        return Response(EquipmentCalibrationSerializer(calibration).data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """List overdue calibrations."""
        company = require_company(request.user)
        queryset = EquipmentCalibration.objects.filter(
            company=company,
            next_calibration_date__lt=date.today(),
            status__in=['scheduled', 'overdue'],
        )
        serializer = EquipmentCalibrationListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """List calibrations due within 30 days."""
        company = require_company(request.user)
        cutoff = date.today() + timedelta(days=30)
        queryset = EquipmentCalibration.objects.filter(
            company=company,
            next_calibration_date__lte=cutoff,
            next_calibration_date__gte=date.today(),
            status='scheduled',
        )
        serializer = EquipmentCalibrationListSerializer(queryset, many=True)
        return Response(serializer.data)


# =============================================================================
# PHASE 3 — PEST CONTROL VIEWSETS
# =============================================================================

class PestControlProgramViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """API endpoint for managing pest control programs."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    ordering = ['-program_year']

    def get_serializer_class(self):
        if self.action == 'list':
            return PestControlProgramListSerializer
        return PestControlProgramSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return PestControlProgram.objects.none()

        return PestControlProgram.objects.filter(company=company)

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a pest control program."""
        program = self.get_object()
        program.approved = True
        program.approved_by = request.user
        program.approved_at = timezone.now()
        program.save()
        return Response(PestControlProgramSerializer(program).data)


class PestMonitoringLogViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """API endpoint for managing pest monitoring logs."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['inspection_date', 'overall_activity_level', 'created_at']
    ordering = ['-inspection_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return PestMonitoringLogListSerializer
        return PestMonitoringLogSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return PestMonitoringLog.objects.none()

        queryset = PestMonitoringLog.objects.filter(
            company=company
        ).select_related('farm', 'program')

        farm_id = self.request.query_params.get('farm_id')
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        program_id = self.request.query_params.get('program_id')
        if program_id:
            queryset = queryset.filter(program_id=program_id)

        activity_level = self.request.query_params.get('activity_level')
        if activity_level:
            queryset = queryset.filter(overall_activity_level=activity_level)

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=False, methods=['get'])
    def trend(self, request):
        """Return pest activity trend over last 12 months."""
        company = require_company(request.user)
        twelve_months_ago = date.today() - timedelta(days=365)
        logs = PestMonitoringLog.objects.filter(
            company=company,
            inspection_date__gte=twelve_months_ago,
        ).order_by('inspection_date')

        # Group by month
        from collections import defaultdict
        monthly = defaultdict(lambda: {'total': 0, 'with_activity': 0})
        for log in logs:
            key = log.inspection_date.strftime('%Y-%m')
            monthly[key]['total'] += 1
            if log.stations_with_activity > 0:
                monthly[key]['with_activity'] += 1

        return Response({
            'period': '12_months',
            'monthly_data': dict(monthly),
            'total_inspections': logs.count(),
            'inspections_with_activity': logs.filter(
                stations_with_activity__gt=0
            ).count(),
        })


# =============================================================================
# PHASE 3 — PRE-HARVEST INSPECTION VIEWSET
# =============================================================================

class PreHarvestInspectionViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """API endpoint for managing pre-harvest inspections."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['field__name', 'crop', 'inspector_name']
    ordering_fields = ['inspection_date', 'planned_harvest_date', 'status']
    ordering = ['-inspection_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return PreHarvestInspectionListSerializer
        return PreHarvestInspectionSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return PreHarvestInspection.objects.none()

        queryset = PreHarvestInspection.objects.filter(
            company=company
        ).select_related('farm', 'field')

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        farm_id = self.request.query_params.get('farm_id')
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        field_id = self.request.query_params.get('field_id')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        passed = self.request.query_params.get('passed')
        if passed is not None:
            queryset = queryset.filter(passed=passed.lower() == 'true')

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company, inspector=self.request.user)

    @action(detail=True, methods=['post'])
    def complete_inspection(self, request, pk=None):
        """Complete the inspection and auto-calculate pass/fail."""
        inspection = self.get_object()
        # Update all check fields from request data
        for field_name in [
            'animal_intrusion', 'animal_droppings_found',
            'adjacent_animal_operations', 'water_source_contamination',
            'phi_respected', 'drift_risk', 'chemical_spill_evidence',
            'foreign_material_found', 'glass_metal_debris', 'equipment_condition_ok',
            'field_condition_acceptable', 'drainage_adequate',
            'sanitation_units_in_place', 'hand_wash_available',
            'workers_trained', 'harvest_containers_clean', 'transport_vehicles_clean',
        ]:
            if field_name in request.data:
                setattr(inspection, field_name, request.data[field_name])

        for notes_field in [
            'biological_hazard_notes', 'chemical_hazard_notes',
            'physical_hazard_notes', 'field_condition_notes',
            'worker_readiness_notes', 'overall_notes',
        ]:
            if notes_field in request.data:
                setattr(inspection, notes_field, request.data[notes_field])

        inspection.status = 'completed'
        inspection.save()  # save() auto-calculates passed
        return Response(PreHarvestInspectionSerializer(inspection).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a completed pre-harvest inspection."""
        inspection = self.get_object()
        inspection.approved_by = request.user
        inspection.approved_at = timezone.now()
        inspection.save()
        return Response(PreHarvestInspectionSerializer(inspection).data)

    @action(detail=False, methods=['get'])
    def upcoming_harvests(self, request):
        """List fields with upcoming harvests that need inspection."""
        company = require_company(request.user)
        cutoff = date.today() + timedelta(days=14)
        queryset = PreHarvestInspection.objects.filter(
            company=company,
            planned_harvest_date__lte=cutoff,
            planned_harvest_date__gte=date.today(),
            status__in=['scheduled', 'in_progress'],
        ).select_related('farm', 'field')
        serializer = PreHarvestInspectionListSerializer(queryset, many=True)
        return Response(serializer.data)


# =============================================================================
# PRIMUS GFS DASHBOARD VIEWSET
# =============================================================================

class PrimusGFSDashboardViewSet(viewsets.ViewSet):
    """
    Aggregate dashboard data for Primus GFS compliance.
    Returns overview scores and status summaries.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def list(self, request):
        """Return the Primus GFS compliance dashboard."""
        company = require_company(request.user)
        today = date.today()
        current_year = today.year

        # --- Documents ---
        docs = ControlledDocument.objects.filter(company=company)
        total_docs = docs.count()
        approved_docs = docs.filter(status='approved').count()
        overdue_reviews = docs.filter(
            status='approved', review_due_date__lt=today
        ).count()

        # --- Audits ---
        audits = InternalAudit.objects.filter(company=company)
        audits_this_year = audits.filter(planned_date__year=current_year).count()
        completed_audits_this_year = audits.filter(
            planned_date__year=current_year, status='completed'
        ).count()

        # --- Corrective Actions ---
        cas = CorrectiveAction.objects.filter(company=company)
        total_cas = cas.count()
        open_cas = cas.filter(status__in=['open', 'in_progress', 'overdue']).count()
        overdue_cas = cas.filter(
            status__in=['open', 'in_progress', 'overdue'],
            due_date__lt=today
        ).count()
        verified_cas = cas.filter(status='verified').count()

        # --- Land Assessments ---
        fields_total = Field.objects.filter(farm__company=company).count()
        land = LandHistoryAssessment.objects.filter(company=company)
        fields_assessed = land.values('field').distinct().count()
        fields_approved = land.filter(approved=True).values('field').distinct().count()

        # --- Suppliers ---
        suppliers = ApprovedSupplier.objects.filter(company=company)
        total_suppliers = suppliers.count()
        approved_suppliers = suppliers.filter(status='approved').count()
        review_overdue_suppliers = suppliers.filter(
            status__in=['approved', 'conditional'],
            next_review_date__lt=today,
        ).count()

        # --- Mock Recalls ---
        recalls = MockRecall.objects.filter(company=company)
        recalls_this_year = recalls.filter(exercise_date__year=current_year).count()
        passed_recalls = recalls.filter(
            exercise_date__year=current_year, passed=True
        ).count()

        # --- Food Defense ---
        food_defense = FoodDefensePlan.objects.filter(company=company)
        current_plan = food_defense.filter(plan_year=current_year).first()
        has_current_plan = current_plan is not None
        plan_approved = current_plan.approved if current_plan else False

        # --- Sanitation ---
        thirty_days_ago = today - timedelta(days=30)
        sanitation = FieldSanitationLog.objects.filter(
            company=company, log_date__gte=thirty_days_ago
        )
        sanitation_total = sanitation.count()
        sanitation_compliant = sanitation.filter(compliant=True).count()

        # --- Calculate overall score (0-100) ---
        scores = []

        # Document score: % approved (no docs = 0)
        if total_docs > 0:
            scores.append(int((approved_docs / total_docs) * 100))
        else:
            scores.append(0)

        # Audit score: did at least 1 this year?
        scores.append(100 if completed_audits_this_year >= 1 else 0)

        # CA score: inverse of overdue percentage
        if total_cas > 0:
            scores.append(int(((total_cas - overdue_cas) / total_cas) * 100))
        else:
            scores.append(100)

        # Land assessment score: % of fields with approved assessments
        if fields_total > 0:
            scores.append(int((fields_approved / fields_total) * 100))
        else:
            scores.append(100)

        # Supplier score: % approved
        if total_suppliers > 0:
            scores.append(int((approved_suppliers / total_suppliers) * 100))
        else:
            scores.append(0)

        # Mock recall score: passed this year?
        scores.append(100 if passed_recalls >= 1 else 0)

        # Food defense score: has approved current plan?
        scores.append(100 if plan_approved else (50 if has_current_plan else 0))

        # Sanitation score: compliance rate last 30 days
        if sanitation_total > 0:
            scores.append(int((sanitation_compliant / sanitation_total) * 100))
        else:
            scores.append(0)

        # --- Equipment Calibration ---
        calibrations = EquipmentCalibration.objects.filter(company=company)
        total_calibrations = calibrations.count()
        calibrations_current = calibrations.filter(
            status='passed', next_calibration_date__gte=today
        ).count()
        calibrations_overdue = calibrations.filter(
            next_calibration_date__lt=today,
            status__in=['scheduled', 'overdue'],
        ).count()

        # Equipment calibration score: % current
        if total_calibrations > 0:
            scores.append(int((calibrations_current / total_calibrations) * 100))
        else:
            scores.append(0)

        # --- Pest Control ---
        pest_programs = PestControlProgram.objects.filter(company=company)
        current_pest_program = pest_programs.filter(program_year=current_year).first()
        has_pest_program = current_pest_program is not None
        pest_program_approved = current_pest_program.approved if current_pest_program else False
        pest_logs_30d = PestMonitoringLog.objects.filter(
            company=company, inspection_date__gte=thirty_days_ago
        ).count()

        # Pest control score: has approved program + regular monitoring?
        pest_score = 0
        if pest_program_approved:
            pest_score += 60
        elif has_pest_program:
            pest_score += 30
        if pest_logs_30d >= 1:
            pest_score += 40
        scores.append(min(pest_score, 100))

        # --- Pre-Harvest Inspections ---
        pre_harvest = PreHarvestInspection.objects.filter(company=company)
        pre_harvest_this_year = pre_harvest.filter(
            inspection_date__year=current_year
        ).count()
        pre_harvest_passed = pre_harvest.filter(
            inspection_date__year=current_year, passed=True
        ).count()
        pre_harvest_failed = pre_harvest.filter(
            inspection_date__year=current_year, passed=False
        ).count()

        # Pre-harvest score: % passed this year
        if pre_harvest_this_year > 0:
            scores.append(int((pre_harvest_passed / pre_harvest_this_year) * 100))
        else:
            scores.append(0)

        overall_score = int(sum(scores) / len(scores)) if scores else 0

        # --- Upcoming deadlines ---
        upcoming_deadlines = ComplianceDeadline.objects.filter(
            company=company,
            regulation__icontains='Primus',
            status__in=['upcoming', 'due_soon'],
            due_date__gte=today,
            due_date__lte=today + timedelta(days=30),
        ).values('id', 'name', 'due_date', 'status', 'category')[:5]

        return Response({
            'overall_score': overall_score,
            'module_scores': {
                'document_control': scores[0] if len(scores) > 0 else 0,
                'internal_audits': scores[1] if len(scores) > 1 else 0,
                'corrective_actions': scores[2] if len(scores) > 2 else 0,
                'land_assessments': scores[3] if len(scores) > 3 else 0,
                'suppliers': scores[4] if len(scores) > 4 else 0,
                'mock_recalls': scores[5] if len(scores) > 5 else 0,
                'food_defense': scores[6] if len(scores) > 6 else 0,
                'sanitation': scores[7] if len(scores) > 7 else 0,
                'equipment_calibration': scores[8] if len(scores) > 8 else 0,
                'pest_control': scores[9] if len(scores) > 9 else 0,
                'pre_harvest': scores[10] if len(scores) > 10 else 0,
            },
            'documents': {
                'total': total_docs,
                'approved': approved_docs,
                'overdue_reviews': overdue_reviews,
            },
            'audits': {
                'total': audits.count(),
                'this_year': audits_this_year,
                'completed_this_year': completed_audits_this_year,
            },
            'corrective_actions': {
                'total': total_cas,
                'open': open_cas,
                'overdue': overdue_cas,
                'verified': verified_cas,
            },
            'land_assessments': {
                'fields_total': fields_total,
                'fields_assessed': fields_assessed,
                'fields_approved': fields_approved,
            },
            'suppliers': {
                'total': total_suppliers,
                'approved': approved_suppliers,
                'review_overdue': review_overdue_suppliers,
            },
            'mock_recalls': {
                'total': recalls.count(),
                'this_year': recalls_this_year,
                'passed_this_year': passed_recalls,
            },
            'food_defense': {
                'has_current_plan': has_current_plan,
                'plan_approved': plan_approved,
            },
            'sanitation': {
                'total_logs_30d': sanitation_total,
                'compliant_30d': sanitation_compliant,
                'compliance_rate': round(
                    (sanitation_compliant / sanitation_total * 100)
                    if sanitation_total > 0 else 0, 1
                ),
            },
            'equipment_calibration': {
                'total': total_calibrations,
                'current': calibrations_current,
                'overdue': calibrations_overdue,
            },
            'pest_control': {
                'has_program': has_pest_program,
                'program_approved': pest_program_approved,
                'inspections_30d': pest_logs_30d,
            },
            'pre_harvest': {
                'this_year': pre_harvest_this_year,
                'passed': pre_harvest_passed,
                'failed': pre_harvest_failed,
            },
            'upcoming_deadlines': list(upcoming_deadlines),
        })
