"""
Primus GFS Compliance Views

Phase 1: Document Control, Internal Audits, Corrective Actions, Land History
Phase 2: Supplier Control, Mock Recall, Food Defense, Field Sanitation
Dashboard aggregation.
"""

import logging
from datetime import date, timedelta
from django.db.models import Count, Q

logger = logging.getLogger(__name__)
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .permissions import HasCompanyAccess
from .audit_utils import AuditLogMixin
from .view_helpers import get_user_company, require_company, CompanyFilteredViewSet

from .models import (
    ControlledDocument, DocumentRevisionHistory,
    InternalAudit, AuditFinding, CorrectiveAction,
    LandHistoryAssessment, ComplianceDeadline, ComplianceAlert, Field,
    ApprovedSupplier, IncomingMaterialVerification,
    MockRecall, FoodDefensePlan, FieldSanitationLog,
    EquipmentCalibration, PestControlProgram, PestMonitoringLog,
    PreHarvestInspection, Farm,
    CONTAMINATION_RISK_CHOICES,
    # CAC Food Safety Manual V5.0
    FoodSafetyProfile, FoodSafetyRoleAssignment,
    FoodSafetyCommitteeMeeting, ManagementVerificationReview,
    TrainingRecord, WorkerTrainingSession,
    PerimeterMonitoringLog, PreSeasonChecklist, FieldRiskAssessment,
    EmployeeNonConformance, ProductHoldRelease,
    SupplierVerificationLog, FoodFraudAssessment,
    EmergencyContact, ChemicalInventoryLog, SanitationMaintenanceLog,
    CACDocumentSignature,
)

from .primusgfs_serializers import (
    ControlledDocumentSerializer,
    DocumentRevisionHistorySerializer,
    InternalAuditSerializer,
    AuditFindingSerializer,
    CorrectiveActionSerializer,
    LandHistoryAssessmentSerializer,
    ApprovedSupplierSerializer,
    IncomingMaterialVerificationSerializer,
    MockRecallSerializer,
    FoodDefensePlanSerializer,
    FieldSanitationLogSerializer,
    EquipmentCalibrationSerializer,
    PestControlProgramSerializer,
    PestMonitoringLogSerializer,
    PreHarvestInspectionSerializer,
    # CAC Food Safety Manual V5.0
    FoodSafetyProfileSerializer,
    FoodSafetyRoleAssignmentSerializer,
    FoodSafetyCommitteeMeetingSerializer,
    ManagementVerificationReviewSerializer,
    TrainingRecordSerializer,
    WorkerTrainingSessionSerializer,
    PerimeterMonitoringLogSerializer,
    PreSeasonChecklistSerializer,
    FieldRiskAssessmentSerializer,
    EmployeeNonConformanceSerializer,
    ProductHoldReleaseSerializer,
    SupplierVerificationLogSerializer,
    FoodFraudAssessmentSerializer,
    EmergencyContactSerializer,
    ChemicalInventoryLogSerializer,
    SanitationMaintenanceLogSerializer,
    # CAC PDF & Signature
    CACDocumentSignatureSerializer,
    CACSignRequestSerializer,
)


# =============================================================================
# AUTO-NUMBER GENERATION UTILITIES
# =============================================================================

import json
from datetime import datetime


# Prefix mapping for document types
DOCUMENT_TYPE_PREFIX = {
    'sop': 'SOP',
    'policy': 'POL',
    'manual': 'MAN',
    'form': 'FRM',
    'record': 'REC',
    'plan': 'PLN',
    'work_instruction': 'WI',
    'external': 'EXT',
}


def _next_number(model, field_name, prefix, company, pad=3):
    """
    Generate the next sequential number for a given model/field/prefix.
    E.g. prefix='SOP' → 'SOP-001', 'SOP-002', ...
    Searches existing records for the highest number with this prefix.
    """
    existing = (
        model.objects.filter(company=company, **{f'{field_name}__startswith': f'{prefix}-'})
        .values_list(field_name, flat=True)
    )
    max_num = 0
    for val in existing:
        # Extract the numeric suffix after the last hyphen
        parts = val.rsplit('-', 1)
        if len(parts) == 2:
            try:
                max_num = max(max_num, int(parts[-1]))
            except ValueError:
                pass
    return f"{prefix}-{str(max_num + 1).zfill(pad)}"


def _generate_document_number(company, document_type):
    """Generate a document number like SOP-001, POL-002, etc."""
    prefix = DOCUMENT_TYPE_PREFIX.get(document_type, 'DOC')
    return _next_number(ControlledDocument, 'document_number', prefix, company)


def _generate_audit_number(company):
    """Generate an audit number like IA-2026-001."""
    year = datetime.now().year
    prefix = f"IA-{year}"
    return _next_number(InternalAudit, 'audit_number', prefix, company)


def _generate_ca_number(company):
    """Generate a corrective action number like CA-001."""
    return _next_number(CorrectiveAction, 'ca_number', 'CA', company)


def _generate_recall_number(company):
    """Generate a mock recall number like MR-2026-001."""
    year = datetime.now().year
    prefix = f"MR-{year}"
    return _next_number(MockRecall, 'recall_number', prefix, company)


def _generate_finding_number(audit):
    """Generate a finding number like F-001 within a specific audit."""
    existing = (
        AuditFinding.objects.filter(audit=audit)
        .values_list('finding_number', flat=True)
    )
    max_num = 0
    for val in existing:
        parts = val.rsplit('-', 1)
        if len(parts) == 2:
            try:
                max_num = max(max_num, int(parts[-1]))
            except ValueError:
                pass
    return f"F-{str(max_num + 1).zfill(3)}"


# =============================================================================
# MULTIPART JSON PARSING MIXIN
# =============================================================================


class MultipartJsonMixin:
    """
    Mixin for ViewSets that accept multipart/form-data with JSON fields.
    Automatically parses JSON string fields when the request is multipart.
    Subclasses should define `multipart_json_fields` as a list of field names.
    """
    multipart_json_fields = []

    def _parse_multipart_json(self, request):
        if (request.content_type and 'multipart' in request.content_type
                and self.multipart_json_fields):
            request.data._mutable = True
            for field in self.multipart_json_fields:
                if field in request.data and isinstance(request.data[field], str):
                    try:
                        request.data[field] = json.loads(request.data[field])
                    except (json.JSONDecodeError, TypeError):
                        pass
            request.data._mutable = False

    def create(self, request, *args, **kwargs):
        self._parse_multipart_json(request)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._parse_multipart_json(request)
        return super().update(request, *args, **kwargs)


# =============================================================================
# DOCUMENT CONTROL VIEWSET
# =============================================================================

class ControlledDocumentViewSet(MultipartJsonMixin, AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing controlled documents (SOPs, policies, manuals).
    Supports filtering by status, type, module, and review due date.
    Accepts multipart/form-data for file uploads.
    """
    multipart_json_fields = ['distribution_list', 'tags']
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
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
        extra = {'company': company, 'prepared_by': self.request.user}
        if not serializer.validated_data.get('document_number'):
            doc_type = serializer.validated_data.get('document_type', 'sop')
            extra['document_number'] = _generate_document_number(company, doc_type)
        serializer.save(**extra)

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

class InternalAuditViewSet(MultipartJsonMixin, AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing internal audits.
    Supports filtering by status, type, and date range.
    Accepts multipart/form-data for report file uploads.
    """
    multipart_json_fields = ['primus_modules_covered', 'farms_audited', 'audit_team']
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
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
        extra = {'company': company}
        if not serializer.validated_data.get('audit_number'):
            extra['audit_number'] = _generate_audit_number(company)
        serializer.save(**extra)

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

    def perform_create(self, serializer):
        if not serializer.validated_data.get('finding_number'):
            audit = serializer.validated_data.get('audit')
            serializer.save(finding_number=_generate_finding_number(audit))
        else:
            serializer.save()


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
        extra = {'company': company}
        if not serializer.validated_data.get('ca_number'):
            extra['ca_number'] = _generate_ca_number(company)
        serializer.save(**extra)

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

class LandHistoryAssessmentViewSet(MultipartJsonMixin, AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing land history assessments.
    Supports filtering by field, farm, and risk level.
    Accepts multipart/form-data for document uploads.
    """
    multipart_json_fields = ['land_use_history', 'soil_test_parameters_tested']
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
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
        extra = {'company': company, 'assessed_by': self.request.user}
        doc = self.request.FILES.get('supporting_document')
        if doc:
            extra['supporting_document_name'] = doc.name
        serializer.save(**extra)

    def perform_update(self, serializer):
        extra = {}
        doc = self.request.FILES.get('supporting_document')
        if doc:
            extra['supporting_document_name'] = doc.name
        serializer.save(**extra)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a land history assessment."""
        assessment = self.get_object()
        assessment.approved = True
        assessment.approved_by = request.user
        assessment.approved_at = timezone.now()
        assessment.save()

        return Response(LandHistoryAssessmentSerializer(assessment).data)

    @action(detail=True, methods=['post'], url_path='remove-document')
    def remove_document(self, request, pk=None):
        """Remove the supporting document from an assessment."""
        assessment = self.get_object()
        if assessment.supporting_document:
            assessment.supporting_document.delete(save=False)
        assessment.supporting_document_name = ''
        assessment.save(update_fields=['supporting_document', 'supporting_document_name'])
        return Response(LandHistoryAssessmentSerializer(
            assessment, context={'request': request}
        ).data)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Aggregated stats for the land history section header."""
        company = require_company(request.user)
        total_fields = Field.objects.filter(
            farm__company=company, farm__active=True
        ).count()

        assessments = LandHistoryAssessment.objects.filter(company=company)
        assessed_fields = assessments.values('field').distinct().count()
        approved_count = assessments.filter(approved=True).count()
        pending_count = assessments.filter(approved=False).count()

        risk_distribution = {}
        for choice_val, _ in CONTAMINATION_RISK_CHOICES:
            risk_distribution[choice_val] = assessments.filter(
                contamination_risk=choice_val
            ).count()

        remediation_needed = assessments.filter(
            remediation_required=True, remediation_verified=False
        ).count()

        return Response({
            'total_fields': total_fields,
            'assessed_fields': assessed_fields,
            'approved_count': approved_count,
            'pending_count': pending_count,
            'risk_distribution': risk_distribution,
            'fields_needing_assessment': max(total_fields - assessed_fields, 0),
            'remediation_pending': remediation_needed,
        })


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

class MockRecallViewSet(MultipartJsonMixin, AuditLogMixin, viewsets.ModelViewSet):
    """API endpoint for managing mock recall exercises.
    Accepts multipart/form-data for report file uploads."""
    multipart_json_fields = [
        'target_lot_numbers', 'lots_traced_forward',
        'lots_traced_backward', 'participants',
    ]
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
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
        extra = {'company': company}
        if not serializer.validated_data.get('recall_number'):
            extra['recall_number'] = _generate_recall_number(company)
        serializer.save(**extra)

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

class EquipmentCalibrationViewSet(MultipartJsonMixin, AuditLogMixin, viewsets.ModelViewSet):
    """API endpoint for managing equipment calibration records.
    Accepts multipart/form-data for certificate file uploads."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
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

        # =================================================================
        # CAC FOOD SAFETY MANUAL V5.0 — 16 NEW MODULE SCORES
        # =================================================================

        # --- [11] Food Safety Profile (CAC Doc 01) ---
        profile = FoodSafetyProfile.objects.filter(company=company).first()
        profile_score = 0
        profile_has_coordinator = False
        profile_has_policy = False
        profile_has_map = False
        if profile:
            if profile.coordinator_name and profile.coordinator_phone:
                profile_score += 33
                profile_has_coordinator = True
            if profile.policy_statement and profile.policy_effective_date:
                profile_score += 34
                profile_has_policy = True
            if profile.ranch_map_file:
                profile_score += 33
                profile_has_map = True
        scores.append(profile_score)

        # --- [12] Org Roles (CAC Doc 02) ---
        roles = FoodSafetyRoleAssignment.objects.filter(
            company=company, active=True
        )
        role_has_coordinator = roles.filter(role_category='coordinator').exists()
        role_has_owner = roles.filter(role_category='owner').exists()
        total_roles = roles.count()
        org_roles_score = 0
        if role_has_coordinator:
            org_roles_score += 40
        if role_has_owner:
            org_roles_score += 30
        if total_roles >= 3:
            org_roles_score += 30
        elif total_roles >= 1:
            org_roles_score += 15
        scores.append(org_roles_score)

        # --- [13] Committee Meetings (CAC Docs 03-04) ---
        committee_meetings_qs = FoodSafetyCommitteeMeeting.objects.filter(
            company=company, meeting_year=current_year, status='completed'
        )
        quarters_completed = committee_meetings_qs.values(
            'meeting_quarter'
        ).distinct().count()
        committee_score = min(quarters_completed * 25, 100)
        scores.append(committee_score)

        # --- [14] Management Review (CAC Doc 05) ---
        mgmt_review = ManagementVerificationReview.objects.filter(
            company=company, review_year=current_year
        ).first()
        mgmt_review_score = 0
        mgmt_review_sections = 0
        if mgmt_review:
            mgmt_review_sections = mgmt_review.sections_reviewed_count
            if mgmt_review.approved:
                mgmt_review_score = 100
            else:
                mgmt_review_score = min(
                    int((mgmt_review_sections / 12) * 80), 80
                )
        scores.append(mgmt_review_score)

        # --- [15] Training Matrix (CAC Doc 06) ---
        training_records = TrainingRecord.objects.filter(
            company=company, active=True
        )
        training_total = training_records.count()
        training_avg = 0.0
        if training_total > 0:
            training_avg = sum(
                r.compliance_percentage for r in training_records
            ) / training_total
            training_matrix_score = int(training_avg)
        else:
            training_matrix_score = 0
        scores.append(training_matrix_score)

        # --- [16] Training Sessions (CAC Doc 37) ---
        sessions_this_year = WorkerTrainingSession.objects.filter(
            company=company, training_date__year=current_year
        ).count()
        training_sessions_score = min(sessions_this_year * 25, 100)
        scores.append(training_sessions_score)

        # --- [17] Perimeter Monitoring (CAC Doc 24) ---
        perimeter_logs_30d = PerimeterMonitoringLog.objects.filter(
            company=company, log_date__gte=thirty_days_ago
        )
        perimeter_weeks_logged = perimeter_logs_30d.values(
            'week_number'
        ).distinct().count()
        perimeter_score = min(int((perimeter_weeks_logged / 4) * 100), 100)
        scores.append(perimeter_score)

        # --- [18] Pre-Season Checklist (CAC Doc 38) ---
        pre_season_qs = PreSeasonChecklist.objects.filter(
            company=company, season_year=current_year
        )
        pre_season_total = pre_season_qs.count()
        pre_season_approved = pre_season_qs.filter(
            approved_for_season=True
        ).count()
        farms_total = Farm.objects.filter(company=company, active=True).count()
        if farms_total > 0:
            pre_season_score = min(
                int((pre_season_approved / farms_total) * 100), 100
            )
        else:
            pre_season_score = 0
        scores.append(pre_season_score)

        # --- [19] Field Risk Assessment (CAC Doc 39) ---
        risk_assessments = FieldRiskAssessment.objects.filter(
            company=company, season_year=current_year
        )
        risk_total_farms = farms_total  # reuse from above
        risk_assessed = risk_assessments.values('farm').distinct().count()
        risk_approved = risk_assessments.filter(
            approved=True
        ).values('farm').distinct().count()
        if risk_total_farms > 0:
            field_risk_score = min(
                int((risk_approved / risk_total_farms) * 100), 100
            )
        else:
            field_risk_score = 0
        scores.append(field_risk_score)

        # --- [20] Employee Non-Conformance (CAC Doc 09A) ---
        non_conformances = EmployeeNonConformance.objects.filter(company=company)
        total_ncs = non_conformances.count()
        open_ncs = non_conformances.filter(resolved=False).count()
        if total_ncs > 0:
            nc_score = int(((total_ncs - open_ncs) / total_ncs) * 100)
        else:
            nc_score = 100  # No NCs is perfect compliance
        scores.append(nc_score)

        # --- [21] Product Holds (CAC Docs 11-12) ---
        product_holds_qs = ProductHoldRelease.objects.filter(company=company)
        total_holds = product_holds_qs.count()
        active_holds = product_holds_qs.filter(status='on_hold').count()
        if total_holds > 0:
            product_holds_score = int(
                ((total_holds - active_holds) / total_holds) * 100
            )
        else:
            product_holds_score = 100  # No holds is normal/good
        scores.append(product_holds_score)

        # --- [22] Supplier Verification (CAC Doc 15) ---
        verifications_this_year = SupplierVerificationLog.objects.filter(
            company=company, verification_date__year=current_year
        )
        suppliers_verified = verifications_this_year.values(
            'supplier'
        ).distinct().count()
        total_approved_suppliers = ApprovedSupplier.objects.filter(
            company=company, status__in=['approved', 'conditional']
        ).count()
        if total_approved_suppliers > 0:
            supplier_verify_score = min(
                int((suppliers_verified / total_approved_suppliers) * 100), 100
            )
        else:
            supplier_verify_score = 0
        scores.append(supplier_verify_score)

        # --- [23] Food Fraud Assessment (CAC Doc 18) ---
        fraud_assessment = FoodFraudAssessment.objects.filter(
            company=company, assessment_year=current_year
        ).first()
        if fraud_assessment:
            food_fraud_score = 100 if fraud_assessment.approved else 50
        else:
            food_fraud_score = 0
        scores.append(food_fraud_score)

        # --- [24] Emergency Contacts (CAC Doc 21) ---
        contacts = EmergencyContact.objects.filter(
            company=company, active=True
        )
        key_contact_types = [
            'fire', 'police', 'hospital', 'poison_control', 'county_ag'
        ]
        key_types_present = contacts.filter(
            contact_type__in=key_contact_types
        ).values('contact_type').distinct().count()
        emergency_score = min(int((key_types_present / 5) * 100), 100)
        scores.append(emergency_score)

        # --- [25] Chemical Inventory (CAC Doc 29) ---
        current_month = today.month
        chem_logs_this_month = ChemicalInventoryLog.objects.filter(
            company=company,
            inventory_year=current_year,
            inventory_month=current_month,
        ).count()
        if chem_logs_this_month > 0:
            chemical_inv_score = 100
        else:
            last_month = current_month - 1 if current_month > 1 else 12
            last_month_year = current_year if current_month > 1 else current_year - 1
            chem_logs_last_month = ChemicalInventoryLog.objects.filter(
                company=company,
                inventory_year=last_month_year,
                inventory_month=last_month,
            ).count()
            chemical_inv_score = 50 if chem_logs_last_month > 0 else 0
        scores.append(chemical_inv_score)

        # --- [26] Sanitation Maintenance (CAC Doc 34) ---
        san_maint_30d = SanitationMaintenanceLog.objects.filter(
            company=company, log_date__gte=thirty_days_ago
        )
        san_maint_count = san_maint_30d.count()
        san_maint_all_ok = san_maint_30d.filter(
            condition_acceptable=True
        ).count()
        if san_maint_count > 0:
            san_maint_score = int(
                (san_maint_all_ok / san_maint_count) * 100
            )
        else:
            san_maint_score = 0
        scores.append(san_maint_score)

        # =================================================================
        # OVERALL SCORE
        # =================================================================
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
                # Original 11 modules
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
                # CAC Food Safety Manual V5.0 modules
                'food_safety_profile': scores[11] if len(scores) > 11 else 0,
                'org_roles': scores[12] if len(scores) > 12 else 0,
                'committee_meetings': scores[13] if len(scores) > 13 else 0,
                'management_review': scores[14] if len(scores) > 14 else 0,
                'training_matrix': scores[15] if len(scores) > 15 else 0,
                'training_sessions': scores[16] if len(scores) > 16 else 0,
                'perimeter_monitoring': scores[17] if len(scores) > 17 else 0,
                'pre_season_checklist': scores[18] if len(scores) > 18 else 0,
                'field_risk_assessment': scores[19] if len(scores) > 19 else 0,
                'non_conformance': scores[20] if len(scores) > 20 else 0,
                'product_holds': scores[21] if len(scores) > 21 else 0,
                'supplier_verification': scores[22] if len(scores) > 22 else 0,
                'food_fraud': scores[23] if len(scores) > 23 else 0,
                'emergency_contacts': scores[24] if len(scores) > 24 else 0,
                'chemical_inventory': scores[25] if len(scores) > 25 else 0,
                'sanitation_maintenance': scores[26] if len(scores) > 26 else 0,
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
            # CAC Food Safety Manual V5.0 detail sections
            'food_safety_profile': {
                'has_coordinator': profile_has_coordinator,
                'has_policy': profile_has_policy,
                'has_map': profile_has_map,
            },
            'org_roles': {
                'has_coordinator': role_has_coordinator,
                'has_owner': role_has_owner,
                'total_roles': total_roles,
            },
            'committee_meetings': {
                'quarters_completed': quarters_completed,
                'target': 4,
            },
            'management_review': {
                'exists': mgmt_review is not None,
                'approved': mgmt_review.approved if mgmt_review else False,
                'sections_reviewed': mgmt_review_sections,
                'total_sections': 12,
            },
            'training_matrix': {
                'total_employees': training_total,
                'average_compliance': round(training_avg, 1),
            },
            'training_sessions': {
                'sessions_this_year': sessions_this_year,
                'target': 4,
            },
            'perimeter_monitoring': {
                'weeks_logged_30d': perimeter_weeks_logged,
                'target_weeks': 4,
            },
            'pre_season_checklist': {
                'farms_total': farms_total,
                'approved_count': pre_season_approved,
                'total_checklists': pre_season_total,
            },
            'field_risk_assessment': {
                'farms_total': risk_total_farms,
                'farms_assessed': risk_assessed,
                'farms_approved': risk_approved,
            },
            'non_conformance': {
                'total': total_ncs,
                'open': open_ncs,
                'resolved': total_ncs - open_ncs,
            },
            'product_holds': {
                'total': total_holds,
                'active': active_holds,
                'resolved': total_holds - active_holds,
            },
            'supplier_verification': {
                'suppliers_verified': suppliers_verified,
                'total_approved_suppliers': total_approved_suppliers,
            },
            'food_fraud': {
                'has_assessment': fraud_assessment is not None,
                'approved': fraud_assessment.approved if fraud_assessment else False,
            },
            'emergency_contacts': {
                'key_types_present': key_types_present,
                'target': 5,
                'total_contacts': contacts.count(),
            },
            'chemical_inventory': {
                'logged_this_month': chem_logs_this_month > 0,
                'entries_this_month': chem_logs_this_month,
            },
            'sanitation_maintenance': {
                'logs_30d': san_maint_count,
                'acceptable_30d': san_maint_all_ok,
            },
            'upcoming_deadlines': list(upcoming_deadlines),
        })

    # -----------------------------------------------------------------
    # Helper: compute module scores + detail data (shared by list & whats_next)
    # -----------------------------------------------------------------
    def _compute_module_scores(self, company):
        """
        Compute all 27 module scores and detail objects.
        Returns (scores_dict, details_dict) where:
          scores_dict = { module_key: int_score, ... }
          details_dict = { module_key: { ...detail... }, ... }
        """
        today = date.today()
        current_year = today.year
        thirty_days_ago = today - timedelta(days=30)
        farms_total = Farm.objects.filter(company=company, active=True).count()

        scores = {}
        details = {}

        # --- Documents ---
        docs = ControlledDocument.objects.filter(company=company)
        total_docs = docs.count()
        approved_docs = docs.filter(status='approved').count()
        overdue_reviews = docs.filter(
            status='approved', review_due_date__lt=today
        ).count()
        scores['document_control'] = int((approved_docs / total_docs) * 100) if total_docs > 0 else 0
        details['document_control'] = {
            'total': total_docs, 'approved': approved_docs,
            'overdue_reviews': overdue_reviews,
        }

        # --- Audits ---
        audits = InternalAudit.objects.filter(company=company)
        completed_this_year = audits.filter(
            planned_date__year=current_year, status='completed'
        ).count()
        scores['internal_audits'] = 100 if completed_this_year >= 1 else 0
        details['internal_audits'] = {
            'this_year': audits.filter(planned_date__year=current_year).count(),
            'completed_this_year': completed_this_year,
        }

        # --- Corrective Actions ---
        cas = CorrectiveAction.objects.filter(company=company)
        total_cas = cas.count()
        overdue_cas = cas.filter(
            status__in=['open', 'in_progress', 'overdue'],
            due_date__lt=today
        ).count()
        open_cas = cas.filter(status__in=['open', 'in_progress', 'overdue']).count()
        scores['corrective_actions'] = int(((total_cas - overdue_cas) / total_cas) * 100) if total_cas > 0 else 100
        details['corrective_actions'] = {
            'total': total_cas, 'open': open_cas, 'overdue': overdue_cas,
            'verified': cas.filter(status='verified').count(),
        }

        # --- Land ---
        land = LandHistoryAssessment.objects.filter(company=company)
        fields_total_all = Field.objects.filter(farm__company=company).count()
        fields_approved = land.filter(approved=True).values('field').distinct().count()
        scores['land_assessments'] = int((fields_approved / fields_total_all) * 100) if fields_total_all > 0 else 100
        details['land_assessments'] = {
            'fields_total': fields_total_all,
            'fields_assessed': land.values('field').distinct().count(),
            'fields_approved': fields_approved,
        }

        # --- Suppliers ---
        suppliers = ApprovedSupplier.objects.filter(company=company)
        total_suppliers = suppliers.count()
        approved_suppliers = suppliers.filter(status='approved').count()
        scores['suppliers'] = int((approved_suppliers / total_suppliers) * 100) if total_suppliers > 0 else 0
        details['suppliers'] = {
            'total': total_suppliers, 'approved': approved_suppliers,
            'review_overdue': suppliers.filter(
                status__in=['approved', 'conditional'],
                next_review_date__lt=today,
            ).count(),
        }

        # --- Mock Recalls ---
        recalls = MockRecall.objects.filter(company=company)
        passed_recalls = recalls.filter(
            exercise_date__year=current_year, passed=True
        ).count()
        scores['mock_recalls'] = 100 if passed_recalls >= 1 else 0
        details['mock_recalls'] = {
            'this_year': recalls.filter(exercise_date__year=current_year).count(),
            'passed_this_year': passed_recalls,
        }

        # --- Food Defense ---
        current_plan = FoodDefensePlan.objects.filter(
            company=company, plan_year=current_year
        ).first()
        has_plan = current_plan is not None
        plan_approved = current_plan.approved if current_plan else False
        scores['food_defense'] = 100 if plan_approved else (50 if has_plan else 0)
        details['food_defense'] = {
            'has_current_plan': has_plan,
            'plan_approved': plan_approved,
        }

        # --- Sanitation ---
        sanitation = FieldSanitationLog.objects.filter(
            company=company, log_date__gte=thirty_days_ago
        )
        san_total = sanitation.count()
        san_compliant = sanitation.filter(compliant=True).count()
        scores['sanitation'] = int((san_compliant / san_total) * 100) if san_total > 0 else 0
        details['sanitation'] = {
            'total_logs_30d': san_total, 'compliant_30d': san_compliant,
        }

        # --- Equipment Calibration ---
        calibrations = EquipmentCalibration.objects.filter(company=company)
        total_cal = calibrations.count()
        cal_current = calibrations.filter(
            status='passed', next_calibration_date__gte=today
        ).count()
        cal_overdue = calibrations.filter(
            next_calibration_date__lt=today,
            status__in=['scheduled', 'overdue'],
        ).count()
        scores['equipment_calibration'] = int((cal_current / total_cal) * 100) if total_cal > 0 else 0
        details['equipment_calibration'] = {
            'total': total_cal, 'current': cal_current, 'overdue': cal_overdue,
        }

        # --- Pest Control ---
        current_pest = PestControlProgram.objects.filter(
            company=company, program_year=current_year
        ).first()
        has_pest = current_pest is not None
        pest_approved = current_pest.approved if current_pest else False
        pest_logs = PestMonitoringLog.objects.filter(
            company=company, inspection_date__gte=thirty_days_ago
        ).count()
        pest_score = 0
        if pest_approved:
            pest_score += 60
        elif has_pest:
            pest_score += 30
        if pest_logs >= 1:
            pest_score += 40
        scores['pest_control'] = min(pest_score, 100)
        details['pest_control'] = {
            'has_program': has_pest, 'program_approved': pest_approved,
            'inspections_30d': pest_logs,
        }

        # --- Pre-Harvest ---
        pre_harvest = PreHarvestInspection.objects.filter(
            company=company, inspection_date__year=current_year
        )
        ph_total = pre_harvest.count()
        ph_passed = pre_harvest.filter(passed=True).count()
        scores['pre_harvest'] = int((ph_passed / ph_total) * 100) if ph_total > 0 else 0
        details['pre_harvest'] = {
            'this_year': ph_total, 'passed': ph_passed,
            'failed': pre_harvest.filter(passed=False).count(),
        }

        # --- Food Safety Profile ---
        profile = FoodSafetyProfile.objects.filter(company=company).first()
        ps = 0
        p_coord = p_policy = p_map = False
        if profile:
            if profile.coordinator_name and profile.coordinator_phone:
                ps += 33; p_coord = True
            if profile.policy_statement and profile.policy_effective_date:
                ps += 34; p_policy = True
            if profile.ranch_map_file:
                ps += 33; p_map = True
        scores['food_safety_profile'] = ps
        details['food_safety_profile'] = {
            'has_coordinator': p_coord, 'has_policy': p_policy, 'has_map': p_map,
        }

        # --- Org Roles ---
        roles = FoodSafetyRoleAssignment.objects.filter(company=company, active=True)
        r_coord = roles.filter(role_category='coordinator').exists()
        r_owner = roles.filter(role_category='owner').exists()
        r_total = roles.count()
        org_s = 0
        if r_coord: org_s += 40
        if r_owner: org_s += 30
        if r_total >= 3: org_s += 30
        elif r_total >= 1: org_s += 15
        scores['org_roles'] = org_s
        details['org_roles'] = {
            'has_coordinator': r_coord, 'has_owner': r_owner, 'total_roles': r_total,
        }

        # --- Committee Meetings ---
        committee = FoodSafetyCommitteeMeeting.objects.filter(
            company=company, meeting_year=current_year, status='completed'
        )
        quarters_done = committee.values('meeting_quarter').distinct().count()
        scores['committee_meetings'] = min(quarters_done * 25, 100)
        details['committee_meetings'] = {
            'quarters_completed': quarters_done, 'target': 4,
        }

        # --- Management Review ---
        mgmt = ManagementVerificationReview.objects.filter(
            company=company, review_year=current_year
        ).first()
        if mgmt:
            sections = mgmt.sections_reviewed_count
            if mgmt.approved:
                scores['management_review'] = 100
            else:
                scores['management_review'] = min(int((sections / 12) * 80), 80)
        else:
            sections = 0
            scores['management_review'] = 0
        details['management_review'] = {
            'exists': mgmt is not None,
            'approved': mgmt.approved if mgmt else False,
            'sections_reviewed': sections, 'total_sections': 12,
        }

        # --- Training Matrix ---
        training = TrainingRecord.objects.filter(company=company, active=True)
        t_total = training.count()
        t_avg = 0.0
        if t_total > 0:
            t_avg = sum(r.compliance_percentage for r in training) / t_total
        scores['training_matrix'] = int(t_avg)
        details['training_matrix'] = {
            'total_employees': t_total, 'average_compliance': round(t_avg, 1),
        }

        # --- Training Sessions ---
        sessions = WorkerTrainingSession.objects.filter(
            company=company, training_date__year=current_year
        ).count()
        scores['training_sessions'] = min(sessions * 25, 100)
        details['training_sessions'] = {
            'sessions_this_year': sessions, 'target': 4,
        }

        # --- Perimeter Monitoring ---
        peri = PerimeterMonitoringLog.objects.filter(
            company=company, log_date__gte=thirty_days_ago
        )
        peri_weeks = peri.values('week_number').distinct().count()
        scores['perimeter_monitoring'] = min(int((peri_weeks / 4) * 100), 100)
        details['perimeter_monitoring'] = {
            'weeks_logged_30d': peri_weeks, 'target_weeks': 4,
        }

        # --- Pre-Season Checklist ---
        psc = PreSeasonChecklist.objects.filter(
            company=company, season_year=current_year
        )
        psc_approved = psc.filter(approved_for_season=True).count()
        scores['pre_season_checklist'] = min(int((psc_approved / farms_total) * 100), 100) if farms_total > 0 else 0
        details['pre_season_checklist'] = {
            'farms_total': farms_total, 'approved_count': psc_approved,
            'total_checklists': psc.count(),
        }

        # --- Field Risk Assessment ---
        fra = FieldRiskAssessment.objects.filter(
            company=company, season_year=current_year
        )
        fra_approved = fra.filter(approved=True).values('farm').distinct().count()
        scores['field_risk_assessment'] = min(int((fra_approved / farms_total) * 100), 100) if farms_total > 0 else 0
        details['field_risk_assessment'] = {
            'farms_total': farms_total,
            'farms_assessed': fra.values('farm').distinct().count(),
            'farms_approved': fra_approved,
        }

        # --- Non-Conformance ---
        ncs = EmployeeNonConformance.objects.filter(company=company)
        nc_total = ncs.count()
        nc_open = ncs.filter(resolved=False).count()
        scores['non_conformance'] = int(((nc_total - nc_open) / nc_total) * 100) if nc_total > 0 else 100
        details['non_conformance'] = {
            'total': nc_total, 'open': nc_open, 'resolved': nc_total - nc_open,
        }

        # --- Product Holds ---
        holds = ProductHoldRelease.objects.filter(company=company)
        h_total = holds.count()
        h_active = holds.filter(status='on_hold').count()
        scores['product_holds'] = int(((h_total - h_active) / h_total) * 100) if h_total > 0 else 100
        details['product_holds'] = {
            'total': h_total, 'active': h_active, 'resolved': h_total - h_active,
        }

        # --- Supplier Verification ---
        sv = SupplierVerificationLog.objects.filter(
            company=company, verification_date__year=current_year
        )
        sv_done = sv.values('supplier').distinct().count()
        sv_target = ApprovedSupplier.objects.filter(
            company=company, status__in=['approved', 'conditional']
        ).count()
        scores['supplier_verification'] = min(int((sv_done / sv_target) * 100), 100) if sv_target > 0 else 0
        details['supplier_verification'] = {
            'suppliers_verified': sv_done, 'total_approved_suppliers': sv_target,
        }

        # --- Food Fraud ---
        fraud = FoodFraudAssessment.objects.filter(
            company=company, assessment_year=current_year
        ).first()
        if fraud:
            scores['food_fraud'] = 100 if fraud.approved else 50
        else:
            scores['food_fraud'] = 0
        details['food_fraud'] = {
            'has_assessment': fraud is not None,
            'approved': fraud.approved if fraud else False,
        }

        # --- Emergency Contacts ---
        contacts = EmergencyContact.objects.filter(company=company, active=True)
        key_types = ['fire', 'police', 'hospital', 'poison_control', 'county_ag']
        key_present = contacts.filter(
            contact_type__in=key_types
        ).values('contact_type').distinct().count()
        scores['emergency_contacts'] = min(int((key_present / 5) * 100), 100)
        details['emergency_contacts'] = {
            'key_types_present': key_present, 'target': 5,
            'total_contacts': contacts.count(),
        }

        # --- Chemical Inventory ---
        current_month = today.month
        chem_this = ChemicalInventoryLog.objects.filter(
            company=company, inventory_year=current_year,
            inventory_month=current_month,
        ).count()
        if chem_this > 0:
            scores['chemical_inventory'] = 100
        else:
            last_m = current_month - 1 if current_month > 1 else 12
            last_y = current_year if current_month > 1 else current_year - 1
            chem_last = ChemicalInventoryLog.objects.filter(
                company=company, inventory_year=last_y, inventory_month=last_m,
            ).count()
            scores['chemical_inventory'] = 50 if chem_last > 0 else 0
        details['chemical_inventory'] = {
            'logged_this_month': chem_this > 0,
            'entries_this_month': chem_this,
        }

        # --- Sanitation Maintenance ---
        sm = SanitationMaintenanceLog.objects.filter(
            company=company, log_date__gte=thirty_days_ago
        )
        sm_count = sm.count()
        sm_ok = sm.filter(condition_acceptable=True).count()
        scores['sanitation_maintenance'] = int((sm_ok / sm_count) * 100) if sm_count > 0 else 0
        details['sanitation_maintenance'] = {
            'logs_30d': sm_count, 'acceptable_30d': sm_ok,
        }

        return scores, details

    # -----------------------------------------------------------------
    # What's Next — prioritized action dashboard
    # -----------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='whats-next')
    def whats_next(self, request):
        """
        Return prioritized "what's next" actions based on module scores,
        cross-platform data availability, and quick wins.

        Response:
          needs_attention[] — modules <60 or with overdue items, sorted by urgency
          quick_wins[]      — modules close to 100% with small effort to complete
          auto_populated[]  — cross-data available from other platform modules
          progress_pipeline — { not_started, in_progress, compliant } counts
          upcoming_deadlines — next 5 Primus deadlines
        """
        company = require_company(request.user)
        today = date.today()
        current_year = today.year

        scores, details = self._compute_module_scores(company)

        # Module metadata: label, tab id, suggested action per state
        MODULE_META = {
            'food_safety_profile': {
                'label': 'Food Safety Profile', 'tab': 'profile',
                'action_zero': 'Set up your ranch food safety profile with coordinator, policy, and map.',
                'action_low': 'Complete missing profile fields (coordinator, policy, or ranch map).',
                'effort': '10 min',
            },
            'org_roles': {
                'label': 'Organization Roles', 'tab': 'org-roles',
                'action_zero': 'Define food safety roles: coordinator, owner/operator, and team leads.',
                'action_low': 'Add missing key roles (coordinator or owner/operator).',
                'effort': '5 min',
            },
            'emergency_contacts': {
                'label': 'Emergency Contacts', 'tab': 'emergency',
                'action_zero': 'Add emergency contacts: fire, police, hospital, poison control, county ag.',
                'action_low': 'Add remaining emergency contact types to reach all 5 required.',
                'effort': '10 min',
            },
            'pre_season_checklist': {
                'label': 'Pre-Season Checklist', 'tab': 'pre-season',
                'action_zero': 'Create pre-season checklists for each farm before the growing season.',
                'action_low': 'Complete and approve remaining farm pre-season checklists.',
                'effort': '20 min/farm',
            },
            'field_risk_assessment': {
                'label': 'Field Risk Assessment', 'tab': 'field-risk',
                'action_zero': 'Conduct field risk assessments for each farm this season.',
                'action_low': 'Complete risk assessments for remaining farms.',
                'effort': '15 min/farm',
            },
            'land_assessments': {
                'label': 'Land History', 'tab': 'land',
                'action_zero': 'Document land history assessments for your fields.',
                'action_low': 'Complete land history for unassessed fields.',
                'effort': '10 min/field',
            },
            'perimeter_monitoring': {
                'label': 'Perimeter Monitoring', 'tab': 'perimeter',
                'action_zero': 'Start weekly perimeter monitoring logs.',
                'action_low': 'Log perimeter inspections for missing weeks this month.',
                'effort': '5 min/week',
            },
            'chemical_inventory': {
                'label': 'Chemical Inventory', 'tab': 'chemical-inv',
                'action_zero': 'Log this month\'s chemical inventory.',
                'action_low': 'Update chemical inventory for the current month.',
                'effort': '15 min',
            },
            'pest_control': {
                'label': 'Pest Control', 'tab': 'pest-control',
                'action_zero': 'Create and approve a pest control program for this year.',
                'action_low': 'Approve your pest control program or log recent monitoring.',
                'effort': '20 min',
            },
            'sanitation': {
                'label': 'Field Sanitation', 'tab': 'sanitation',
                'action_zero': 'Begin logging daily field sanitation checks.',
                'action_low': 'Address non-compliant sanitation logs from the last 30 days.',
                'effort': '5 min/day',
            },
            'sanitation_maintenance': {
                'label': 'Sanitation Maintenance', 'tab': 'sanitation-maint',
                'action_zero': 'Start logging sanitation facility maintenance inspections.',
                'action_low': 'Resolve unacceptable sanitation maintenance findings.',
                'effort': '10 min',
            },
            'equipment_calibration': {
                'label': 'Equipment Calibration', 'tab': 'calibration',
                'action_zero': 'Register equipment and schedule calibrations.',
                'action_low': 'Complete overdue equipment calibrations.',
                'effort': '15 min/item',
            },
            'pre_harvest': {
                'label': 'Pre-Harvest Inspection', 'tab': 'pre-harvest',
                'action_zero': 'Conduct pre-harvest inspections before picking begins.',
                'action_low': 'Address failed pre-harvest inspections.',
                'effort': '30 min',
            },
            'training_matrix': {
                'label': 'Training Matrix', 'tab': 'training-matrix',
                'action_zero': 'Set up employee training records.',
                'action_low': 'Bring training compliance above 80% — schedule refresher courses.',
                'effort': '15 min',
            },
            'training_sessions': {
                'label': 'Training Sessions', 'tab': 'training-sessions',
                'action_zero': 'Schedule and conduct food safety training sessions.',
                'action_low': 'Conduct additional training sessions (target: 4/year).',
                'effort': '1 hr/session',
            },
            'non_conformance': {
                'label': 'Non-Conformance', 'tab': 'non-conformance',
                'action_zero': 'No action needed — no non-conformance events.',
                'action_low': 'Resolve open non-conformance events.',
                'effort': '10 min/event',
            },
            'committee_meetings': {
                'label': 'Committee Meetings', 'tab': 'committee',
                'action_zero': 'Schedule your first quarterly food safety committee meeting.',
                'action_low': 'Complete remaining quarterly committee meetings.',
                'effort': '1 hr/quarter',
            },
            'management_review': {
                'label': 'Management Review', 'tab': 'mgmt-review',
                'action_zero': 'Create the annual management verification review.',
                'action_low': 'Review remaining sections and get management approval.',
                'effort': '2 hrs',
            },
            'suppliers': {
                'label': 'Suppliers', 'tab': 'suppliers',
                'action_zero': 'Register and approve your material suppliers.',
                'action_low': 'Approve pending suppliers or address overdue reviews.',
                'effort': '10 min/supplier',
            },
            'supplier_verification': {
                'label': 'Supplier Verification', 'tab': 'supplier-verify',
                'action_zero': 'Verify approved suppliers for this year.',
                'action_low': 'Complete verification for remaining suppliers.',
                'effort': '10 min/supplier',
            },
            'product_holds': {
                'label': 'Product Holds', 'tab': 'product-holds',
                'action_zero': 'No action needed — no product holds.',
                'action_low': 'Resolve active product holds.',
                'effort': '15 min/hold',
            },
            'mock_recalls': {
                'label': 'Mock Recalls', 'tab': 'recalls',
                'action_zero': 'Conduct a mock recall exercise this year.',
                'action_low': 'Review and pass a mock recall exercise.',
                'effort': '2 hrs',
            },
            'document_control': {
                'label': 'Documents', 'tab': 'documents',
                'action_zero': 'Upload and register your food safety SOPs.',
                'action_low': 'Approve pending documents or complete overdue reviews.',
                'effort': '10 min/doc',
            },
            'internal_audits': {
                'label': 'Internal Audits', 'tab': 'audits',
                'action_zero': 'Schedule and complete an internal audit this year.',
                'action_low': 'Complete your scheduled internal audit.',
                'effort': '4 hrs',
            },
            'corrective_actions': {
                'label': 'Corrective Actions', 'tab': 'corrective-actions',
                'action_zero': 'No action needed — no corrective actions pending.',
                'action_low': 'Address overdue corrective actions.',
                'effort': '15 min/CA',
            },
            'food_defense': {
                'label': 'Food Defense', 'tab': 'food-defense',
                'action_zero': 'Create a food defense plan for this year.',
                'action_low': 'Get your food defense plan approved.',
                'effort': '30 min',
            },
            'food_fraud': {
                'label': 'Food Fraud', 'tab': 'food-fraud',
                'action_zero': 'Complete a food fraud vulnerability assessment.',
                'action_low': 'Get your food fraud assessment approved.',
                'effort': '30 min',
            },
        }

        # ----- Needs Attention: score < 60 or has overdue items -----
        needs_attention = []
        for key, score in scores.items():
            meta = MODULE_META.get(key, {})
            detail = details.get(key, {})
            urgency = 0

            # Overdue items get highest urgency
            has_overdue = (
                detail.get('overdue', 0) > 0 or
                detail.get('overdue_reviews', 0) > 0 or
                detail.get('open', 0) > 0 or
                detail.get('active', 0) > 0
            )

            if score < 60 or has_overdue:
                if score == 0:
                    urgency = 3  # Not started
                elif has_overdue:
                    urgency = 3  # Has overdue items
                elif score < 30:
                    urgency = 2  # Very low
                else:
                    urgency = 1  # Below threshold

                action_text = meta.get('action_zero', 'Get started on this module.') if score == 0 \
                    else meta.get('action_low', 'Improve this module\'s score.')

                needs_attention.append({
                    'module': key,
                    'label': meta.get('label', key.replace('_', ' ').title()),
                    'tab': meta.get('tab', key.replace('_', '-')),
                    'score': score,
                    'urgency': urgency,
                    'action': action_text,
                    'effort': meta.get('effort', ''),
                    'has_overdue': has_overdue,
                    'details': detail,
                })

        # Sort: highest urgency first, then lowest score
        needs_attention.sort(key=lambda x: (-x['urgency'], x['score']))

        # ----- Quick Wins: score 60-99 with small effort to complete -----
        quick_wins = []
        for key, score in scores.items():
            meta = MODULE_META.get(key, {})
            detail = details.get(key, {})
            if 60 <= score < 100:
                quick_wins.append({
                    'module': key,
                    'label': meta.get('label', key.replace('_', ' ').title()),
                    'tab': meta.get('tab', key.replace('_', '-')),
                    'score': score,
                    'action': meta.get('action_low', 'Finalize this module.'),
                    'effort': meta.get('effort', ''),
                    'details': detail,
                })
        # Sort by score descending (closest to 100 first = easiest wins)
        quick_wins.sort(key=lambda x: -x['score'])

        # ----- Auto-populated: cross-platform data availability -----
        auto_populated = []
        try:
            from .models import PesticideApplication, PesticideProduct
            pesticide_apps = PesticideApplication.objects.filter(
                field__farm__company=company
            ).count()
            if pesticide_apps > 0:
                auto_populated.append({
                    'module': 'chemical_inventory',
                    'tab': 'chemical-inv',
                    'source': 'Pesticide Records',
                    'message': f'{pesticide_apps} pesticide applications available for chemical inventory.',
                    'count': pesticide_apps,
                })

            unique_suppliers_from_products = PesticideProduct.objects.filter(
                pesticideapplication__field__farm__company=company
            ).values('manufacturer').distinct().count()
            if unique_suppliers_from_products > 0:
                auto_populated.append({
                    'module': 'suppliers',
                    'tab': 'suppliers',
                    'source': 'Product Suppliers',
                    'message': f'{unique_suppliers_from_products} unique manufacturers from pesticide products.',
                    'count': unique_suppliers_from_products,
                })
        except Exception:
            pass

        try:
            from .models import WPSTrainingRecord
            wps_records = WPSTrainingRecord.objects.filter(
                company=company
            ).count()
            if wps_records > 0:
                auto_populated.append({
                    'module': 'training_matrix',
                    'tab': 'training-matrix',
                    'source': 'WPS Training Records',
                    'message': f'{wps_records} WPS training records available for training matrix.',
                    'count': wps_records,
                })
        except Exception:
            pass

        try:
            from .models import LaborContractor
            contractors = LaborContractor.objects.filter(company=company).count()
            if contractors > 0:
                auto_populated.append({
                    'module': 'suppliers',
                    'tab': 'suppliers',
                    'source': 'Labor Contractors',
                    'message': f'{contractors} labor contractors available for supplier list.',
                    'count': contractors,
                })
        except Exception:
            pass

        try:
            from .models import IncidentReport
            incidents = IncidentReport.objects.filter(
                company=company, status__in=['open', 'investigating']
            ).count()
            if incidents > 0:
                auto_populated.append({
                    'module': 'non_conformance',
                    'tab': 'non-conformance',
                    'source': 'Incident Reports',
                    'message': f'{incidents} open incidents that may need non-conformance records.',
                    'count': incidents,
                })
        except Exception:
            pass

        try:
            from .models import WaterTest
            water_tests = WaterTest.objects.filter(
                water_source__farm__company=company,
                test_date__year=current_year,
            ).count()
            if water_tests > 0:
                auto_populated.append({
                    'module': 'pre_season_checklist',
                    'tab': 'pre-season',
                    'source': 'Water Tests',
                    'message': f'{water_tests} water test results available for pre-season review.',
                    'count': water_tests,
                })
        except Exception:
            pass

        # ----- Progress Pipeline -----
        not_started = sum(1 for s in scores.values() if s == 0)
        in_progress = sum(1 for s in scores.values() if 0 < s < 80)
        compliant = sum(1 for s in scores.values() if s >= 80)

        # ----- Upcoming Deadlines -----
        upcoming = ComplianceDeadline.objects.filter(
            company=company,
            regulation__icontains='Primus',
            status__in=['upcoming', 'due_soon'],
            due_date__gte=today,
            due_date__lte=today + timedelta(days=30),
        ).values('id', 'name', 'due_date', 'status', 'category')[:5]

        # ----- Overall score -----
        all_scores = list(scores.values())
        overall = int(sum(all_scores) / len(all_scores)) if all_scores else 0

        return Response({
            'overall_score': overall,
            'needs_attention': needs_attention[:10],
            'quick_wins': quick_wins[:8],
            'auto_populated': auto_populated,
            'progress_pipeline': {
                'not_started': not_started,
                'in_progress': in_progress,
                'compliant': compliant,
                'total': len(scores),
            },
            'upcoming_deadlines': list(upcoming),
        })

    # -----------------------------------------------------------------
    # Prefill — cross-platform data for auto-import
    # -----------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='prefill/(?P<module>[a-z_-]+)')
    def prefill(self, request, module=None):
        """
        Return cross-platform prefill data for a specific PrimusGFS module.

        Supported modules:
          chemical-inventory, training-records, suppliers,
          non-conformance, committee-agenda, pre-season,
          management-review
        """
        from api.services.primusgfs.cross_data_linker import CrossDataLinker

        company = require_company(request.user)
        linker = CrossDataLinker(company)

        module_map = {
            'chemical-inventory': linker.get_chemical_inventory_prefill,
            'training-records': linker.get_training_records_prefill,
            'suppliers': linker.get_supplier_prefill,
            'non-conformance': linker.get_non_conformance_prefill,
            'committee-agenda': lambda: linker.get_committee_agenda_data(
                request.query_params.get('quarter')
            ),
            'pre-season': lambda: linker.get_pre_season_prefill(
                request.query_params.get('farm_id')
            ),
            'management-review': linker.get_management_review_summary,
        }

        handler = module_map.get(module)
        if not handler:
            return Response(
                {'error': f'Unknown module: {module}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            data = handler()
            return Response(data)
        except Exception as e:
            logger.exception(f"Error generating prefill for {module}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # -----------------------------------------------------------------
    # Copy Forward — clone records from a previous season/year
    # -----------------------------------------------------------------
    @action(detail=False, methods=['post'], url_path='copy-forward')
    def copy_forward(self, request):
        """
        Clone PrimusGFS records from one year to another.

        POST body:
          source_year: int (year to copy from)
          target_year: int (year to copy to)
          modules: list[str] (module keys to copy)

        Returns per-module record counts of cloned items.
        """
        company = require_company(request.user)
        source_year = request.data.get('source_year')
        target_year = request.data.get('target_year')
        modules = request.data.get('modules', [])

        if not source_year or not target_year:
            return Response(
                {'error': 'source_year and target_year are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            source_year = int(source_year)
            target_year = int(target_year)
        except (ValueError, TypeError):
            return Response(
                {'error': 'source_year and target_year must be integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if source_year == target_year:
            return Response(
                {'error': 'Source and target years must be different.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not modules:
            return Response(
                {'error': 'At least one module must be selected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = {}

        # --- Food Defense Plan ---
        if 'food_defense' in modules:
            count = 0
            for plan in FoodDefensePlan.objects.filter(
                company=company, plan_year=source_year
            ):
                if FoodDefensePlan.objects.filter(
                    company=company, plan_year=target_year
                ).exists():
                    break
                plan.pk = None
                plan.plan_year = target_year
                plan.approved = False
                plan.approved_by = None
                plan.approved_at = None
                plan.created_at = None
                plan.updated_at = None
                plan.related_document = None
                plan.save()
                count += 1
            results['food_defense'] = count

        # --- Food Fraud Assessment ---
        if 'food_fraud' in modules:
            count = 0
            for assessment in FoodFraudAssessment.objects.filter(
                company=company, assessment_year=source_year
            ):
                if FoodFraudAssessment.objects.filter(
                    company=company, assessment_year=target_year
                ).exists():
                    break
                assessment.pk = None
                assessment.assessment_year = target_year
                assessment.approved = False
                assessment.reviewed_date = None
                assessment.related_document = None
                assessment.created_at = None
                assessment.updated_at = None
                assessment.save()
                count += 1
            results['food_fraud'] = count

        # --- Pest Control Program ---
        if 'pest_control' in modules:
            count = 0
            for program in PestControlProgram.objects.filter(
                company=company, program_year=source_year
            ):
                if PestControlProgram.objects.filter(
                    company=company, program_year=target_year
                ).exists():
                    break
                program.pk = None
                program.program_year = target_year
                program.approved = False
                program.approved_by = None
                program.approved_at = None
                program.related_document = None
                program.created_at = None
                program.updated_at = None
                program.save()
                count += 1
            results['pest_control'] = count

        # --- Pre-Season Checklist ---
        if 'pre_season' in modules:
            count = 0
            for checklist in PreSeasonChecklist.objects.filter(
                company=company, season_year=source_year
            ):
                if PreSeasonChecklist.objects.filter(
                    company=company, farm=checklist.farm,
                    season_year=target_year,
                ).exists():
                    continue
                checklist.pk = None
                checklist.season_year = target_year
                checklist.approved_for_season = False
                checklist.approved_by = ''
                checklist.approval_date = None
                checklist.deficiencies_found = False
                checklist.deficiency_list = []
                checklist.created_at = None
                checklist.updated_at = None
                checklist.save()
                count += 1
            results['pre_season'] = count

        # --- Field Risk Assessment ---
        if 'field_risk' in modules:
            count = 0
            for assessment in FieldRiskAssessment.objects.filter(
                company=company, season_year=source_year
            ):
                if FieldRiskAssessment.objects.filter(
                    company=company, farm=assessment.farm,
                    season_year=target_year,
                ).exists():
                    continue
                assessment.pk = None
                assessment.season_year = target_year
                assessment.approved = False
                assessment.review_date = None
                assessment.reviewed_by = ''
                assessment.report_file = None
                assessment.created_at = None
                assessment.updated_at = None
                assessment.save()
                count += 1
            results['field_risk'] = count

        # --- Emergency Contacts (not year-scoped, just clone missing types) ---
        if 'emergency_contacts' in modules:
            count = 0
            existing_types = set(
                EmergencyContact.objects.filter(
                    company=company, active=True
                ).values_list('contact_type', flat=True)
            )
            # Emergency contacts don't have a year — nothing to copy.
            # But we include it for completeness so the UI doesn't break.
            results['emergency_contacts'] = 0

        total_copied = sum(results.values())

        return Response({
            'source_year': source_year,
            'target_year': target_year,
            'results': results,
            'total_copied': total_copied,
        })

    # -----------------------------------------------------------------
    # Setup Status — guided wizard step completion
    # -----------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='setup-status')
    def setup_status(self, request):
        """
        Return 6 setup steps with completion status and prefill availability.
        Used by the SetupWizard to guide first-time configuration.
        """
        company = require_company(request.user)
        current_year = date.today().year

        steps = []

        # Step 1: Food Safety Profile
        profile = FoodSafetyProfile.objects.filter(company=company).first()
        profile_complete = bool(
            profile and profile.coordinator_name and
            profile.policy_statement and profile.ranch_map_file
        )
        steps.append({
            'key': 'profile',
            'label': 'Food Safety Profile',
            'description': 'Set up your ranch profile with coordinator info, food safety policy, and ranch map.',
            'tab': 'profile',
            'completed': profile_complete,
            'partial': bool(profile),
            'prefill_available': False,
        })

        # Step 2: Organization Roles
        roles = FoodSafetyRoleAssignment.objects.filter(
            company=company, active=True
        )
        has_coordinator = roles.filter(role_category='coordinator').exists()
        has_owner = roles.filter(role_category='owner').exists()
        roles_complete = has_coordinator and has_owner and roles.count() >= 3
        steps.append({
            'key': 'org-roles',
            'label': 'Organization Roles',
            'description': 'Define food safety roles: coordinator, owner/operator, and team leads.',
            'tab': 'org-roles',
            'completed': roles_complete,
            'partial': roles.exists(),
            'prefill_available': False,
        })

        # Step 3: Emergency Contacts
        contacts = EmergencyContact.objects.filter(
            company=company, active=True
        )
        key_types = ['fire', 'police', 'hospital', 'poison_control', 'county_ag']
        key_present = contacts.filter(
            contact_type__in=key_types
        ).values('contact_type').distinct().count()
        contacts_complete = key_present >= 5
        steps.append({
            'key': 'emergency',
            'label': 'Emergency Contacts',
            'description': 'Add emergency contacts: fire, police, hospital, poison control, county ag.',
            'tab': 'emergency',
            'completed': contacts_complete,
            'partial': contacts.exists(),
            'prefill_available': False,
        })

        # Step 4: Core Documents (SOPs uploaded)
        docs = ControlledDocument.objects.filter(company=company)
        approved_docs = docs.filter(status='approved').count()
        docs_complete = approved_docs >= 3
        steps.append({
            'key': 'documents',
            'label': 'Core Documents',
            'description': 'Upload and approve your food safety SOPs and procedures.',
            'tab': 'documents',
            'completed': docs_complete,
            'partial': docs.exists(),
            'prefill_available': False,
        })

        # Step 5: Approved Suppliers
        suppliers = ApprovedSupplier.objects.filter(company=company)
        approved_suppliers = suppliers.filter(status='approved').count()
        suppliers_complete = approved_suppliers >= 1

        # Check prefill availability
        supplier_prefill = False
        try:
            from api.models.farm import PesticideProduct
            supplier_prefill = PesticideProduct.objects.filter(
                pesticideapplication__field__farm__company=company,
                active=True,
            ).values('manufacturer').distinct().filter(
                manufacturer__gt=''
            ).exists()
        except Exception:
            pass

        steps.append({
            'key': 'suppliers',
            'label': 'Approved Suppliers',
            'description': 'Register and approve your material suppliers.',
            'tab': 'suppliers',
            'completed': suppliers_complete,
            'partial': suppliers.exists(),
            'prefill_available': supplier_prefill,
        })

        # Step 6: Food Defense Plan
        plan = FoodDefensePlan.objects.filter(
            company=company, plan_year=current_year
        ).first()
        plan_complete = bool(plan and plan.approved)
        steps.append({
            'key': 'food-defense',
            'label': 'Food Defense Plan',
            'description': 'Create and approve a food defense plan for this year.',
            'tab': 'food-defense',
            'completed': plan_complete,
            'partial': plan is not None,
            'prefill_available': False,
        })

        completed_count = sum(1 for s in steps if s['completed'])
        show_wizard = completed_count < 4

        return Response({
            'steps': steps,
            'completed_count': completed_count,
            'total_steps': len(steps),
            'show_wizard': show_wizard,
        })


# =============================================================================
# CAC DOC 01 — FOOD SAFETY PROFILE
# =============================================================================

class FoodSafetyProfileViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    Singleton per company — ranch food safety profile (CAC Doc 01).
    """
    serializer_class = FoodSafetyProfileSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    parsers = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FoodSafetyProfile.objects.none()
        return FoodSafetyProfile.objects.filter(company=company)

    def list(self, request, *args, **kwargs):
        """Return the single profile or empty object."""
        company = require_company(request.user)
        profile, _ = FoodSafetyProfile.objects.get_or_create(company=company)
        return Response(FoodSafetyProfileSerializer(profile).data)

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))


# =============================================================================
# CAC DOC 02 — ORG CHART ROLES
# =============================================================================

class FoodSafetyRoleAssignmentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Food safety org chart role assignments (CAC Doc 02)."""
    serializer_class = FoodSafetyRoleAssignmentSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FoodSafetyRoleAssignment.objects.none()
        return FoodSafetyRoleAssignment.objects.filter(company=company)

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))


# =============================================================================
# CAC DOCS 03-04 — COMMITTEE MEETINGS
# =============================================================================

class FoodSafetyCommitteeMeetingViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Quarterly food safety committee meeting log (CAC Docs 03-04)."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_serializer_class(self):
        if self.action == 'list':
            return FoodSafetyCommitteeMeetingListSerializer
        return FoodSafetyCommitteeMeetingSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FoodSafetyCommitteeMeeting.objects.none()
        qs = FoodSafetyCommitteeMeeting.objects.filter(company=company)
        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(meeting_year=year)
        return qs

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))

    @action(detail=False, methods=['get'])
    def quarterly_status(self, request):
        """Show which quarters have completed meetings for a given year."""
        company = require_company(request.user)
        year = int(request.query_params.get('year', date.today().year))
        meetings = FoodSafetyCommitteeMeeting.objects.filter(
            company=company, meeting_year=year
        ).values('meeting_quarter', 'status')
        quarters = {m['meeting_quarter']: m['status'] for m in meetings}
        return Response({
            'year': year,
            'Q1': quarters.get('Q1', 'missing'),
            'Q2': quarters.get('Q2', 'missing'),
            'Q3': quarters.get('Q3', 'missing'),
            'Q4': quarters.get('Q4', 'missing'),
        })


# =============================================================================
# CAC DOC 05 — MANAGEMENT VERIFICATION REVIEW
# =============================================================================

class ManagementVerificationReviewViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Annual management verification review (CAC Doc 05)."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    parsers = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.action == 'list':
            return ManagementVerificationReviewListSerializer
        return ManagementVerificationReviewSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return ManagementVerificationReview.objects.none()
        return ManagementVerificationReview.objects.filter(company=company)

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))

    @action(detail=False, methods=['get'])
    def current_year(self, request):
        """Get or report on the current year's review."""
        company = require_company(request.user)
        year = date.today().year
        try:
            review = ManagementVerificationReview.objects.get(
                company=company, review_year=year
            )
            return Response(ManagementVerificationReviewSerializer(review).data)
        except ManagementVerificationReview.DoesNotExist:
            return Response({'detail': 'No review for current year', 'year': year},
                            status=status.HTTP_404_NOT_FOUND)


# =============================================================================
# CAC DOC 06 — TRAINING MATRIX
# =============================================================================

class TrainingRecordViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Per-employee training matrix (CAC Doc 06)."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_serializer_class(self):
        if self.action == 'list':
            return TrainingRecordListSerializer
        return TrainingRecordSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return TrainingRecord.objects.none()
        qs = TrainingRecord.objects.filter(company=company)
        active = self.request.query_params.get('active')
        if active is not None:
            qs = qs.filter(active=active.lower() == 'true')
        return qs

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))

    @action(detail=False, methods=['get'])
    def matrix_summary(self, request):
        """Summary of training compliance across all employees."""
        company = require_company(request.user)
        records = TrainingRecord.objects.filter(company=company, active=True)
        total = records.count()
        fully_compliant = sum(1 for r in records if r.training_types_current == 8)
        avg_compliance = (
            sum(r.compliance_percentage for r in records) / total if total > 0 else 0
        )
        return Response({
            'total_employees': total,
            'fully_compliant': fully_compliant,
            'average_compliance': round(avg_compliance, 1),
        })

    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        """List training records with expirations within 30 days."""
        company = require_company(request.user)
        threshold = date.today() + timedelta(days=30)
        today = date.today()
        records = TrainingRecord.objects.filter(company=company, active=True)
        expiring = []
        for r in records:
            fields_expiring = []
            for field_name, label in [
                ('animal_intrusion_expiration', 'Animal Intrusion'),
                ('food_safety_expiration', 'Food Safety'),
                ('worker_hygiene_expiration', 'Worker Hygiene'),
                ('bleeding_illness_expiration', 'Bleeding/Illness'),
                ('inspections_expiration', 'Inspections'),
                ('crop_protection_expiration', 'Crop Protection'),
                ('applicator_license_expiration', 'Applicator License'),
            ]:
                exp = getattr(r, field_name)
                if exp and today <= exp <= threshold:
                    fields_expiring.append({
                        'training_type': label,
                        'expiration': exp.isoformat(),
                        'days_remaining': (exp - today).days,
                    })
            if fields_expiring:
                expiring.append({
                    'employee_name': r.employee_name,
                    'employee_id': r.employee_id,
                    'expiring_trainings': fields_expiring,
                })
        return Response(expiring)


# =============================================================================
# CAC DOC 37 — TRAINING SESSIONS
# =============================================================================

class WorkerTrainingSessionViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Per-session training log with attendee sign-in (CAC Doc 37)."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    parsers = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.action == 'list':
            return WorkerTrainingSessionListSerializer
        return WorkerTrainingSessionSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return WorkerTrainingSession.objects.none()
        qs = WorkerTrainingSession.objects.filter(company=company)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(training_category=category)
        return qs

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))


# =============================================================================
# CAC DOC 24 — PERIMETER MONITORING
# =============================================================================

class PerimeterMonitoringLogViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Weekly perimeter and water source monitoring (CAC Doc 24)."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_serializer_class(self):
        if self.action == 'list':
            return PerimeterMonitoringLogListSerializer
        return PerimeterMonitoringLogSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return PerimeterMonitoringLog.objects.none()
        qs = PerimeterMonitoringLog.objects.filter(company=company)
        farm_id = self.request.query_params.get('farm_id')
        if farm_id:
            qs = qs.filter(farm_id=farm_id)
        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(log_date__year=year)
        return qs

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))

    @action(detail=False, methods=['get'])
    def weekly_compliance(self, request):
        """52-week grid showing logged weeks for a farm and year."""
        company = require_company(request.user)
        farm_id = request.query_params.get('farm_id')
        year = int(request.query_params.get('year', date.today().year))
        if not farm_id:
            return Response({'detail': 'farm_id required'}, status=status.HTTP_400_BAD_REQUEST)
        logs = PerimeterMonitoringLog.objects.filter(
            company=company, farm_id=farm_id, log_date__year=year
        ).values_list('week_number', flat=True)
        logged_weeks = set(logs)
        weeks = []
        for w in range(1, 54):
            weeks.append({'week': w, 'logged': w in logged_weeks})
        return Response({
            'year': year,
            'farm_id': int(farm_id),
            'total_logged': len(logged_weeks),
            'weeks': weeks,
        })


# =============================================================================
# CAC DOC 38 — PRE-SEASON CHECKLIST
# =============================================================================

class PreSeasonChecklistViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Ranch-level pre-season self-assessment (CAC Doc 38)."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_serializer_class(self):
        if self.action == 'list':
            return PreSeasonChecklistListSerializer
        return PreSeasonChecklistSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return PreSeasonChecklist.objects.none()
        qs = PreSeasonChecklist.objects.filter(company=company)
        farm_id = self.request.query_params.get('farm_id')
        if farm_id:
            qs = qs.filter(farm_id=farm_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))

    @action(detail=False, methods=['get'])
    def current_season(self, request):
        """Get current season checklists."""
        company = require_company(request.user)
        year = date.today().year
        checklists = PreSeasonChecklist.objects.filter(
            company=company, season_year=year
        )
        return Response(PreSeasonChecklistListSerializer(checklists, many=True).data)


# =============================================================================
# CAC DOC 39 — FIELD RISK ASSESSMENT
# =============================================================================

class FieldRiskAssessmentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Comprehensive field risk assessment (CAC Doc 39)."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    parsers = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        if self.action == 'list':
            return FieldRiskAssessmentListSerializer
        return FieldRiskAssessmentSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FieldRiskAssessment.objects.none()
        qs = FieldRiskAssessment.objects.filter(company=company)
        farm_id = self.request.query_params.get('farm_id')
        if farm_id:
            qs = qs.filter(farm_id=farm_id)
        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(season_year=year)
        return qs

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))

    @action(detail=False, methods=['get'])
    def risk_summary(self, request):
        """Aggregate risk summary across all farms for current year."""
        company = require_company(request.user)
        year = int(request.query_params.get('year', date.today().year))
        assessments = FieldRiskAssessment.objects.filter(
            company=company, season_year=year
        )
        return Response({
            'year': year,
            'total_assessments': assessments.count(),
            'approved': assessments.filter(approved=True).count(),
            'by_risk_level': {
                'low': assessments.filter(overall_risk_level='low').count(),
                'medium': assessments.filter(overall_risk_level='medium').count(),
                'high': assessments.filter(overall_risk_level='high').count(),
                'critical': assessments.filter(overall_risk_level='critical').count(),
            },
        })


# =============================================================================
# CAC DOC 09A — EMPLOYEE NON-CONFORMANCE
# =============================================================================

class EmployeeNonConformanceViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Employee non-conformance tracking (CAC Doc 09A)."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_serializer_class(self):
        if self.action == 'list':
            return EmployeeNonConformanceListSerializer
        return EmployeeNonConformanceSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return EmployeeNonConformance.objects.none()
        return EmployeeNonConformance.objects.filter(company=company)

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))


# =============================================================================
# CAC DOCS 11-12 — PRODUCT HOLD/RELEASE
# =============================================================================

def _generate_hold_number(company):
    """Generate auto-incrementing hold number like PH-001."""
    last = ProductHoldRelease.objects.filter(
        company=company,
        hold_number__startswith='PH-'
    ).order_by('-hold_number').first()
    if last:
        try:
            num = int(last.hold_number.split('-')[1]) + 1
        except (ValueError, IndexError):
            num = 1
    else:
        num = 1
    return f"PH-{num:03d}"


class ProductHoldReleaseViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Product rejection and release (CAC Docs 11-12)."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_serializer_class(self):
        if self.action == 'list':
            return ProductHoldReleaseListSerializer
        return ProductHoldReleaseSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return ProductHoldRelease.objects.none()
        qs = ProductHoldRelease.objects.filter(company=company)
        s = self.request.query_params.get('status')
        if s:
            qs = qs.filter(status=s)
        return qs

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        hold_number = serializer.validated_data.get('hold_number', '')
        if not hold_number:
            hold_number = _generate_hold_number(company)
        serializer.save(company=company, hold_number=hold_number)

    @action(detail=False, methods=['get'])
    def active_holds(self, request):
        """List all currently active holds."""
        company = require_company(request.user)
        holds = ProductHoldRelease.objects.filter(company=company, status='on_hold')
        return Response(ProductHoldReleaseListSerializer(holds, many=True).data)


# =============================================================================
# CAC DOC 15 — SUPPLIER VERIFICATION
# =============================================================================

class SupplierVerificationLogViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Supplier control verification log (CAC Doc 15)."""
    serializer_class = SupplierVerificationLogSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return SupplierVerificationLog.objects.none()
        qs = SupplierVerificationLog.objects.filter(company=company)
        supplier_id = self.request.query_params.get('supplier_id')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))


# =============================================================================
# CAC DOC 18 — FOOD FRAUD ASSESSMENT
# =============================================================================

class FoodFraudAssessmentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Food fraud vulnerability assessment (CAC Doc 18)."""
    serializer_class = FoodFraudAssessmentSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FoodFraudAssessment.objects.none()
        return FoodFraudAssessment.objects.filter(company=company)

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))


# =============================================================================
# CAC DOC 21 — EMERGENCY CONTACTS
# =============================================================================

class EmergencyContactViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Emergency contacts list (CAC Doc 21)."""
    serializer_class = EmergencyContactSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return EmergencyContact.objects.none()
        return EmergencyContact.objects.filter(company=company, active=True)

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))


# =============================================================================
# CAC DOC 29 — CHEMICAL INVENTORY
# =============================================================================

class ChemicalInventoryLogViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Monthly chemical/pesticide inventory (CAC Doc 29)."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_serializer_class(self):
        if self.action == 'list':
            return ChemicalInventoryLogListSerializer
        return ChemicalInventoryLogSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return ChemicalInventoryLog.objects.none()
        qs = ChemicalInventoryLog.objects.filter(company=company)
        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(inventory_year=year)
        month = self.request.query_params.get('month')
        if month:
            qs = qs.filter(inventory_month=month)
        return qs

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))

    @action(detail=False, methods=['get'])
    def monthly_summary(self, request):
        """Summary of inventory counts by month for a given year."""
        company = require_company(request.user)
        year = int(request.query_params.get('year', date.today().year))
        logs = ChemicalInventoryLog.objects.filter(
            company=company, inventory_year=year
        ).order_by('inventory_month')
        months_logged = logs.values_list('inventory_month', flat=True).distinct()
        return Response({
            'year': year,
            'months_logged': sorted(set(months_logged)),
            'total_chemicals_tracked': logs.values('chemical_name').distinct().count(),
            'total_entries': logs.count(),
        })


# =============================================================================
# CAC DOC 34 — SANITATION MAINTENANCE
# =============================================================================

class SanitationMaintenanceLogViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """Toilet and hand wash station maintenance (CAC Doc 34)."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_serializer_class(self):
        if self.action == 'list':
            return SanitationMaintenanceLogListSerializer
        return SanitationMaintenanceLogSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return SanitationMaintenanceLog.objects.none()
        qs = SanitationMaintenanceLog.objects.filter(company=company)
        farm_id = self.request.query_params.get('farm_id')
        if farm_id:
            qs = qs.filter(farm_id=farm_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(company=require_company(self.request.user))


# =============================================================================
# CAC FOOD SAFETY MANUAL V5.0 — PDF GENERATION & SIGNATURES
# =============================================================================

from django.http import HttpResponse


class CACManualPDFViewSet(viewsets.ViewSet):
    """
    CAC Food Safety Manual V5.0 PDF generation and digital signature management.

    Endpoints:
      GET  /full/          - Download complete 120-page filled PDF
      GET  /section/       - Download a section (doc param)
      GET  /preview/       - Get PNG preview of a filled page
      GET  /status/        - Completion + signature status per doc
      POST /sign/          - Apply a signature to a doc page
      GET  /signatures/    - List all signatures for a season
      DELETE /signatures/{id}/ - Remove a signature
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def _get_generator(self, request):
        from .services.primusgfs.cac_pdf_generator import CACManualPDFGenerator
        company = require_company(request.user)
        farm_id = request.query_params.get('farm_id')
        farm = Farm.objects.filter(id=farm_id, company=company).first() if farm_id else None
        year = int(request.query_params.get('year', date.today().year))
        return CACManualPDFGenerator(company, farm=farm, season_year=year)

    @action(detail=False, methods=['get'])
    def full(self, request):
        """Generate and download the complete filled CAC manual PDF."""
        gen = self._get_generator(request)
        pdf_bytes = gen.generate_full()
        response = HttpResponse(pdf_bytes.read(), content_type='application/pdf')
        response['Content-Disposition'] = (
            f'attachment; filename="CAC_Food_Safety_Manual_{gen.season_year}.pdf"'
        )
        return response

    @action(detail=False, methods=['get'])
    def section(self, request):
        """
        Generate and download a specific document section.

        Accepts optional ``binder_section`` query param.  When provided,
        loads the BinderSection's ``pdf_field_data`` and applies those
        user overrides on top of the auto-filled data.
        """
        doc = request.query_params.get('doc')
        if not doc:
            return Response(
                {'error': 'doc parameter is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        gen = self._get_generator(request)

        # Check for binder section overrides
        binder_section_id = request.query_params.get('binder_section')
        field_overrides = None
        if binder_section_id:
            try:
                from .models import BinderSection
                company = require_company(request.user)
                bs = BinderSection.objects.get(
                    pk=binder_section_id,
                    binder__company=company,
                )
                field_overrides = bs.pdf_field_data
            except BinderSection.DoesNotExist:
                pass

        try:
            if field_overrides:
                pdf_bytes = gen.generate_section_with_overrides(doc, field_overrides)
            else:
                pdf_bytes = gen.generate_section(doc)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        response = HttpResponse(pdf_bytes.read(), content_type='application/pdf')
        # Use 'inline' so the PDF renders in embedded viewers (iframe)
        # instead of triggering a download.
        response['Content-Disposition'] = (
            f'inline; filename="CAC_Doc_{doc}_{gen.season_year}.pdf"'
        )
        return response

    @action(detail=False, methods=['get'], url_path='field-schema')
    def field_schema(self, request):
        """
        Discover all form fields for a document section and return
        their schema along with current values from auto-fill and user
        overrides.

        Query params:
            doc (required): Document number, e.g. '04'
            binder_section (optional): BinderSection ID for saved pdf_field_data

        Returns JSON::

            {
                "doc_number": "04",
                "pages": [15, 16],
                "fields": [
                    {
                        "name": "4-a-100",
                        "type": "text",
                        "page": 15,
                        "value": "Meeting Minutes",
                        "source": "auto_fill",
                        "label": "Meeting Date"
                    },
                    ...
                ]
            }
        """
        doc = request.query_params.get('doc')
        if not doc:
            return Response(
                {'error': 'doc parameter is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .services.primusgfs.cac_pdf_filler import CACPDFFieldFiller
        from .services.primusgfs.cac_data_mapper import CACDataMapper, DOC_PAGE_MAP
        from .services.primusgfs.cac_field_labels import get_field_label

        pages = DOC_PAGE_MAP.get(doc, [])
        if not pages:
            return Response(
                {'error': f'Unknown document number: {doc}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Discover all PDF form fields from the template
        fields_by_page = CACPDFFieldFiller.discover_fields()

        # Build auto-fill values layer
        company = require_company(request.user)
        farm_id = request.query_params.get('farm_id')
        farm = Farm.objects.filter(id=farm_id, company=company).first() if farm_id else None
        year = int(request.query_params.get('year', date.today().year))

        mapper = CACDataMapper(company, farm=farm, season_year=year)
        auto_text = mapper.resolve_positional_fields(fields_by_page)
        auto_checkboxes = mapper.resolve_positional_checkboxes(fields_by_page)

        # Load user override layer from BinderSection
        user_overrides = {}
        binder_section_id = request.query_params.get('binder_section')
        if binder_section_id:
            try:
                from .models import BinderSection
                bs = BinderSection.objects.get(
                    pk=binder_section_id,
                    binder__company=company,
                )
                user_overrides = bs.pdf_field_data or {}
            except BinderSection.DoesNotExist:
                pass

        # Build field list for the requested pages only
        doc_pages = set(pages)
        result_fields = []
        for page_num in sorted(doc_pages):
            page_fields = fields_by_page.get(page_num, [])
            for field_info in page_fields:
                name = field_info['name']
                ftype = field_info['type']

                # Determine effective value and source
                if name in user_overrides:
                    value = user_overrides[name]
                    source = 'user_override'
                elif ftype == 'checkbox' and name in auto_checkboxes:
                    value = auto_checkboxes[name]
                    source = 'auto_fill'
                elif name in auto_text:
                    value = auto_text[name]
                    source = 'auto_fill'
                else:
                    value = '' if ftype == 'text' else False
                    source = 'empty'

                result_fields.append({
                    'name': name,
                    'type': ftype,
                    'page': page_num,
                    'value': value,
                    'source': source,
                    'label': get_field_label(name),
                })

        return Response({
            'doc_number': doc,
            'pages': pages,
            'fields': result_fields,
        })

    @action(detail=False, methods=['get'])
    def preview(self, request):
        """Generate a PNG preview of a specific filled page."""
        doc = request.query_params.get('doc')
        page = request.query_params.get('page')
        if not doc:
            return Response(
                {'error': 'doc parameter is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        gen = self._get_generator(request)
        page_num = int(page) if page else None
        try:
            png_bytes = gen.generate_preview(doc, page=page_num)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if png_bytes is None:
            return Response(
                {'error': 'PyMuPDF required for PNG preview'},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )
        response = HttpResponse(png_bytes.read(), content_type='image/png')
        response['Content-Disposition'] = (
            f'inline; filename="CAC_Doc_{doc}_p{page or "1"}.png"'
        )
        return response

    @action(detail=False, methods=['get'], url_path='status')
    def completion_status(self, request):
        """Return completion and signature status for each CAC document."""
        gen = self._get_generator(request)
        return Response(gen.get_completion_status())

    @action(detail=False, methods=['post'])
    def sign(self, request):
        """Apply a digital signature to a specific CAC document page."""
        serializer = CACSignRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        company = require_company(request.user)
        year = int(request.data.get('season_year', date.today().year))

        sig, created = CACDocumentSignature.objects.update_or_create(
            company=company,
            doc_number=data['doc_number'],
            page_number=data['page_number'],
            signer_role=data['signer_role'],
            signer_order=data.get('signer_order', 0),
            season_year=year,
            defaults={
                'signer_name': data['signer_name'],
                'signer_user': request.user,
                'signed': True,
                'signature_data': data['signature_data'],
                'signed_at': timezone.now(),
                'source_model': data.get('source_model', ''),
                'source_id': data.get('source_id'),
            }
        )
        return Response(
            CACDocumentSignatureSerializer(sig).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=['get'])
    def signatures(self, request):
        """List all CAC document signatures for the current season."""
        company = require_company(request.user)
        year = int(request.query_params.get('season_year',
                   request.query_params.get('year', date.today().year)))
        doc = request.query_params.get('doc_number',
              request.query_params.get('doc'))
        qs = CACDocumentSignature.objects.filter(
            company=company, season_year=year
        )
        if doc:
            qs = qs.filter(doc_number=doc)
        serializer = CACDocumentSignatureListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['delete'], url_path='signatures')
    def delete_signature(self, request, pk=None):
        """Remove a signature to allow re-signing."""
        company = require_company(request.user)
        try:
            sig = CACDocumentSignature.objects.get(pk=pk, company=company)
        except CACDocumentSignature.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        sig.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
