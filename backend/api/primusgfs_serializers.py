"""
Primus GFS Compliance Serializers

Phase 1: Document Control, Internal Audits, Corrective Actions, Land History

Uses DynamicFieldsMixin to consolidate List/Detail serializer pairs into
a single serializer with `list_fields`.  Backward-compatible aliases
(e.g. ControlledDocumentListSerializer) are retained at module scope.
"""

from rest_framework import serializers
from .serializer_mixins import DynamicFieldsMixin
from .models import (
    ControlledDocument, DocumentRevisionHistory,
    InternalAudit, AuditFinding, CorrectiveAction,
    LandHistoryAssessment,
    ApprovedSupplier, IncomingMaterialVerification,
    MockRecall, FoodDefensePlan, FieldSanitationLog,
    EquipmentCalibration, PestControlProgram, PestMonitoringLog,
    PreHarvestInspection,
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


# =============================================================================
# DOCUMENT CONTROL SERIALIZERS
# =============================================================================

class DocumentRevisionHistorySerializer(serializers.ModelSerializer):
    """Serializer for document revision audit trail."""
    changed_by_name = serializers.CharField(
        source='changed_by.get_full_name', read_only=True
    )

    class Meta:
        model = DocumentRevisionHistory
        fields = [
            'id', 'document', 'version', 'change_description',
            'changed_by', 'changed_by_name', 'changed_at', 'previous_file',
        ]
        read_only_fields = ['changed_by', 'changed_at']


class ControlledDocumentSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for controlled documents."""
    list_fields = [
        'id', 'document_number', 'title',
        'document_type', 'document_type_display',
        'primus_module', 'primus_module_display',
        'version', 'status', 'status_display',
        'review_due_date', 'is_review_overdue', 'days_until_review',
        'effective_date', 'has_file',
    ]

    document_type_display = serializers.CharField(
        source='get_document_type_display', read_only=True
    )
    primus_module_display = serializers.CharField(
        source='get_primus_module_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    prepared_by_name = serializers.CharField(
        source='prepared_by.get_full_name', read_only=True
    )
    reviewed_by_name = serializers.CharField(
        source='reviewed_by.get_full_name', read_only=True
    )
    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name', read_only=True
    )
    is_review_overdue = serializers.BooleanField(read_only=True)
    days_until_review = serializers.IntegerField(read_only=True)
    revision_history = DocumentRevisionHistorySerializer(
        many=True, read_only=True
    )
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    has_file = serializers.SerializerMethodField()

    class Meta:
        model = ControlledDocument
        fields = [
            'id', 'company', 'document_number', 'title',
            'document_type', 'document_type_display',
            'primus_module', 'primus_module_display',
            'version', 'revision_date', 'effective_date', 'review_due_date',
            'description', 'file', 'file_url', 'file_name', 'has_file',
            'content_text',
            'status', 'status_display',
            'prepared_by', 'prepared_by_name',
            'reviewed_by', 'reviewed_by_name',
            'approved_by', 'approved_by_name', 'approved_at',
            'supersedes', 'distribution_list', 'tags',
            'is_review_overdue', 'days_until_review',
            'revision_history', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'company', 'approved_at', 'created_at', 'updated_at',
        ]

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None

    def get_file_name(self, obj):
        if obj.file:
            return obj.file.name.split('/')[-1]
        return None

    def get_has_file(self, obj):
        return bool(obj.file)


ControlledDocumentListSerializer = ControlledDocumentSerializer


# =============================================================================
# INTERNAL AUDIT SERIALIZERS
# =============================================================================

class AuditFindingSerializer(serializers.ModelSerializer):
    """Full serializer for audit findings."""
    severity_display = serializers.CharField(
        source='get_severity_display', read_only=True
    )
    primus_module_display = serializers.CharField(
        source='get_primus_module_display', read_only=True
    )
    corrective_action_count = serializers.SerializerMethodField()

    class Meta:
        model = AuditFinding
        fields = [
            'id', 'audit', 'finding_number',
            'primus_module', 'primus_module_display',
            'primus_clause', 'severity', 'severity_display',
            'description', 'evidence', 'area_location', 'photos',
            'corrective_action_count',
            'created_at', 'updated_at',
        ]

    def get_corrective_action_count(self, obj):
        return obj.corrective_actions.count()


class InternalAuditSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for internal audits."""
    list_fields = [
        'id', 'audit_number', 'title',
        'audit_type', 'audit_type_display',
        'planned_date', 'actual_date',
        'status', 'status_display',
        'overall_score', 'total_findings', 'open_findings',
        'has_report',
    ]

    audit_type_display = serializers.CharField(
        source='get_audit_type_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    lead_auditor_name = serializers.CharField(
        source='lead_auditor.get_full_name', read_only=True
    )
    total_findings = serializers.IntegerField(read_only=True)
    open_findings = serializers.IntegerField(read_only=True)
    findings = AuditFindingSerializer(many=True, read_only=True)
    report_file_url = serializers.SerializerMethodField()
    report_file_name = serializers.SerializerMethodField()
    has_report = serializers.SerializerMethodField()

    class Meta:
        model = InternalAudit
        fields = [
            'id', 'company', 'audit_number', 'title',
            'audit_type', 'audit_type_display',
            'primus_modules_covered',
            'planned_date', 'actual_date',
            'scope_description', 'farms_audited',
            'lead_auditor', 'lead_auditor_name',
            'auditor_name', 'audit_team',
            'status', 'status_display',
            'overall_score', 'executive_summary',
            'report_file', 'report_file_url', 'report_file_name', 'has_report',
            'related_documents',
            'total_findings', 'open_findings', 'findings',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company', 'created_at', 'updated_at']

    def get_report_file_url(self, obj):
        if obj.report_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.report_file.url)
            return obj.report_file.url
        return None

    def get_report_file_name(self, obj):
        if obj.report_file:
            return obj.report_file.name.split('/')[-1]
        return None

    def get_has_report(self, obj):
        return bool(obj.report_file)


InternalAuditListSerializer = InternalAuditSerializer


# =============================================================================
# CORRECTIVE ACTION SERIALIZERS
# =============================================================================

class CorrectiveActionSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for corrective actions."""
    list_fields = [
        'id', 'ca_number', 'description', 'source_type',
        'due_date', 'status', 'status_display',
        'is_overdue', 'days_until_due',
        'assigned_to_name',
    ]

    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    assigned_to_display = serializers.SerializerMethodField()
    verified_by_name = serializers.CharField(
        source='verified_by.get_full_name', read_only=True
    )
    is_overdue = serializers.BooleanField(read_only=True)
    days_until_due = serializers.IntegerField(read_only=True)

    class Meta:
        model = CorrectiveAction
        fields = [
            'id', 'company', 'finding', 'source_type', 'source_id',
            'ca_number', 'description', 'root_cause',
            'corrective_steps', 'preventive_steps',
            'assigned_to', 'assigned_to_name', 'assigned_to_display',
            'due_date', 'status', 'status_display',
            'implemented_date',
            'verified_date', 'verified_by', 'verified_by_name',
            'verification_notes',
            'evidence_files', 'is_overdue', 'days_until_due',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'company', 'verified_by', 'created_at', 'updated_at',
        ]

    def get_assigned_to_display(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name()
        return obj.assigned_to_name or ''


CorrectiveActionListSerializer = CorrectiveActionSerializer


# =============================================================================
# LAND HISTORY ASSESSMENT SERIALIZERS
# =============================================================================

class LandHistoryAssessmentSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for land history assessments."""
    list_fields = [
        'id', 'field', 'field_name', 'farm_name',
        'assessment_date', 'contamination_risk',
        'contamination_risk_display', 'approved',
        'risk_factor_count',
        'buffer_period_adequate', 'previous_animal_operations',
        'remediation_required', 'remediation_verified',
        'information_source', 'has_document',
        'supporting_document_name',
    ]

    contamination_risk_display = serializers.CharField(
        source='get_contamination_risk_display', read_only=True
    )
    assessed_by_name = serializers.CharField(
        source='assessed_by.get_full_name', read_only=True
    )
    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name', read_only=True
    )
    field_name = serializers.CharField(
        source='field.name', read_only=True
    )
    farm_name = serializers.CharField(
        source='field.farm.name', read_only=True
    )
    risk_factor_count = serializers.IntegerField(read_only=True)
    supporting_document_url = serializers.SerializerMethodField()
    has_document = serializers.SerializerMethodField()

    class Meta:
        model = LandHistoryAssessment
        fields = [
            'id', 'company', 'field', 'field_name', 'farm_name',
            'assessment_date', 'assessed_by', 'assessed_by_name',
            'land_use_history',
            'previous_pesticide_use', 'previous_chemical_storage',
            'previous_waste_disposal', 'previous_mining',
            'flood_zone', 'adjacent_contamination_risk',
            'information_source',
            'buffer_period_months', 'buffer_period_adequate',
            'previous_animal_operations', 'animal_operation_details',
            'soil_testing_conducted', 'soil_test_date',
            'soil_test_results', 'soil_test_passed',
            'soil_test_lab', 'soil_test_parameters_tested',
            'remediation_required', 'remediation_description',
            'remediation_completion_date', 'remediation_verified',
            'contamination_risk', 'contamination_risk_display',
            'risk_justification', 'mitigation_measures',
            'approved', 'approved_by', 'approved_by_name', 'approved_at',
            'supporting_document', 'supporting_document_name',
            'supporting_document_url', 'has_document',
            'related_document', 'risk_factor_count',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'company', 'approved_by', 'approved_at',
            'created_at', 'updated_at',
        ]

    def get_supporting_document_url(self, obj):
        if obj.supporting_document:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.supporting_document.url)
            return obj.supporting_document.url
        return None

    def get_has_document(self, obj):
        return bool(obj.supporting_document)


LandHistoryAssessmentListSerializer = LandHistoryAssessmentSerializer


# =============================================================================
# DASHBOARD SERIALIZER
# =============================================================================

# =============================================================================
# SUPPLIER CONTROL SERIALIZERS
# =============================================================================

class ApprovedSupplierSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for approved suppliers."""
    list_fields = [
        'id', 'supplier_name', 'supplier_code',
        'material_types', 'status', 'status_display',
        'approved_date', 'next_review_date', 'is_review_overdue',
    ]

    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name', read_only=True
    )
    is_review_overdue = serializers.BooleanField(read_only=True)
    verification_count = serializers.SerializerMethodField()

    class Meta:
        model = ApprovedSupplier
        fields = [
            'id', 'company', 'supplier_name', 'supplier_code',
            'contact_name', 'contact_email', 'contact_phone', 'address',
            'material_types', 'status', 'status_display',
            'approved_by', 'approved_by_name', 'approved_date',
            'next_review_date', 'certifications',
            'last_audit_date', 'last_audit_score',
            'is_review_overdue', 'verification_count',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'company', 'approved_by', 'created_at', 'updated_at',
        ]

    def get_verification_count(self, obj):
        return obj.material_verifications.count()


ApprovedSupplierListSerializer = ApprovedSupplierSerializer


class IncomingMaterialVerificationSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for material verifications."""
    list_fields = [
        'id', 'supplier', 'supplier_name', 'receipt_date',
        'material_type', 'material_type_display',
        'material_description', 'accepted',
    ]

    material_type_display = serializers.CharField(
        source='get_material_type_display', read_only=True
    )
    supplier_name = serializers.CharField(
        source='supplier.supplier_name', read_only=True
    )
    verified_by_name = serializers.CharField(
        source='verified_by.get_full_name', read_only=True
    )

    class Meta:
        model = IncomingMaterialVerification
        fields = [
            'id', 'company', 'supplier', 'supplier_name',
            'receipt_date', 'material_type', 'material_type_display',
            'material_description', 'lot_number', 'quantity',
            'condition_acceptable', 'labeling_correct',
            'certificate_verified', 'temperature_acceptable',
            'accepted', 'rejection_reason',
            'verified_by', 'verified_by_name',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'company', 'verified_by', 'created_at', 'updated_at',
        ]


IncomingMaterialVerificationListSerializer = IncomingMaterialVerificationSerializer


# =============================================================================
# MOCK RECALL SERIALIZERS
# =============================================================================

class MockRecallSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for mock recall exercises."""
    list_fields = [
        'id', 'recall_number', 'exercise_date',
        'target_product', 'status', 'status_display',
        'trace_duration_minutes', 'effectiveness_score',
        'passed', 'within_time_limit', 'has_report',
    ]

    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    led_by_name = serializers.CharField(
        source='led_by.get_full_name', read_only=True
    )
    within_time_limit = serializers.BooleanField(read_only=True)
    report_file_url = serializers.SerializerMethodField()
    report_file_name = serializers.SerializerMethodField()
    has_report = serializers.SerializerMethodField()

    class Meta:
        model = MockRecall
        fields = [
            'id', 'company', 'recall_number', 'exercise_date',
            'scenario_description', 'trigger_reason',
            'target_product', 'target_lot_numbers',
            'status', 'status_display',
            'trace_start_time', 'trace_end_time', 'trace_duration_minutes',
            'product_accounted_percent',
            'lots_traced_forward', 'lots_traced_backward',
            'effectiveness_score', 'passed', 'within_time_limit',
            'led_by', 'led_by_name', 'participants',
            'report_file', 'report_file_url', 'report_file_name', 'has_report',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'company', 'trace_duration_minutes',
            'created_at', 'updated_at',
        ]

    def get_report_file_url(self, obj):
        if obj.report_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.report_file.url)
            return obj.report_file.url
        return None

    def get_report_file_name(self, obj):
        if obj.report_file:
            return obj.report_file.name.split('/')[-1]
        return None

    def get_has_report(self, obj):
        return bool(obj.report_file)


MockRecallListSerializer = MockRecallSerializer


# =============================================================================
# FOOD DEFENSE PLAN SERIALIZERS
# =============================================================================

class FoodDefensePlanSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for food defense plans."""
    list_fields = [
        'id', 'plan_year', 'effective_date', 'review_date',
        'overall_threat_level', 'overall_threat_level_display',
        'approved', 'is_review_overdue',
    ]

    overall_threat_level_display = serializers.CharField(
        source='get_overall_threat_level_display', read_only=True
    )
    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name', read_only=True
    )
    is_review_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = FoodDefensePlan
        fields = [
            'id', 'company', 'plan_year', 'effective_date', 'review_date',
            'vulnerability_assessment', 'overall_threat_level',
            'overall_threat_level_display',
            'security_measures',
            'perimeter_security', 'access_points', 'key_control_procedure',
            'food_defense_coordinator', 'emergency_contacts',
            'tampering_response_procedure', 'reporting_procedure',
            'approved', 'approved_by', 'approved_by_name', 'approved_at',
            'related_document', 'is_review_overdue',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'company', 'approved_by', 'approved_at',
            'created_at', 'updated_at',
        ]


FoodDefensePlanListSerializer = FoodDefensePlanSerializer


# =============================================================================
# FIELD SANITATION SERIALIZERS
# =============================================================================

class FieldSanitationLogSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for field sanitation logs."""
    list_fields = [
        'id', 'farm', 'farm_name', 'log_date',
        'worker_count', 'units_required', 'units_deployed',
        'compliant',
    ]

    farm_name = serializers.CharField(source='farm.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    checked_by_name = serializers.CharField(
        source='checked_by.get_full_name', read_only=True
    )

    class Meta:
        model = FieldSanitationLog
        fields = [
            'id', 'company', 'farm', 'farm_name', 'field', 'field_name',
            'log_date', 'worker_count', 'units_required', 'units_deployed',
            'hand_wash_stations',
            'soap_available', 'paper_towels_available',
            'potable_water_available', 'sanitizer_available',
            'units_clean', 'service_needed', 'service_requested_date',
            'compliant', 'deficiency_notes',
            'checked_by', 'checked_by_name',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'company', 'units_required', 'compliant',
            'checked_by', 'created_at', 'updated_at',
        ]


FieldSanitationLogListSerializer = FieldSanitationLogSerializer


# =============================================================================
# EQUIPMENT CALIBRATION SERIALIZERS
# =============================================================================

class EquipmentCalibrationSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for equipment calibration records."""
    list_fields = [
        'id', 'equipment_name', 'equipment_type',
        'equipment_type_display', 'equipment_id',
        'calibration_date', 'next_calibration_date',
        'status', 'status_display',
        'within_tolerance', 'is_overdue', 'days_until_due',
        'has_certificate',
    ]

    equipment_type_display = serializers.CharField(
        source='get_equipment_type_display', read_only=True
    )
    calibration_method_display = serializers.CharField(
        source='get_calibration_method_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    is_overdue = serializers.BooleanField(read_only=True)
    days_until_due = serializers.IntegerField(read_only=True)
    certificate_file_url = serializers.SerializerMethodField()
    certificate_file_name = serializers.SerializerMethodField()
    has_certificate = serializers.SerializerMethodField()

    class Meta:
        model = EquipmentCalibration
        fields = [
            'id', 'company', 'equipment_name', 'equipment_type',
            'equipment_type_display', 'equipment_id', 'location',
            'manufacturer', 'model_number',
            'calibration_date', 'next_calibration_date',
            'calibration_method', 'calibration_method_display',
            'calibrated_by', 'calibration_standard',
            'status', 'status_display',
            'reading_before', 'reading_after', 'tolerance',
            'within_tolerance',
            'corrective_action_taken', 'corrective_action_ref',
            'certificate_number', 'certificate_file',
            'certificate_file_url', 'certificate_file_name', 'has_certificate',
            'is_overdue', 'days_until_due',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'company', 'created_at', 'updated_at',
        ]

    def get_certificate_file_url(self, obj):
        if obj.certificate_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.certificate_file.url)
            return obj.certificate_file.url
        return None

    def get_certificate_file_name(self, obj):
        if obj.certificate_file:
            return obj.certificate_file.name.split('/')[-1]
        return None

    def get_has_certificate(self, obj):
        return bool(obj.certificate_file)


EquipmentCalibrationListSerializer = EquipmentCalibrationSerializer


# =============================================================================
# PEST CONTROL SERIALIZERS
# =============================================================================

class PestControlProgramSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for pest control programs."""
    list_fields = [
        'id', 'program_year', 'effective_date', 'review_date',
        'pco_company', 'total_stations',
        'approved', 'is_review_overdue',
    ]

    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name', read_only=True
    )
    is_review_overdue = serializers.BooleanField(read_only=True)
    monitoring_log_count = serializers.SerializerMethodField()

    class Meta:
        model = PestControlProgram
        fields = [
            'id', 'company', 'program_year', 'effective_date', 'review_date',
            'pco_company', 'pco_license_number',
            'pco_contact_name', 'pco_contact_phone',
            'service_frequency',
            'monitoring_stations', 'total_stations',
            'target_pests', 'products_used',
            'approved', 'approved_by', 'approved_by_name', 'approved_at',
            'related_document', 'is_review_overdue', 'monitoring_log_count',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'company', 'approved_by', 'approved_at',
            'created_at', 'updated_at',
        ]

    def get_monitoring_log_count(self, obj):
        return obj.monitoring_logs.count()


PestControlProgramListSerializer = PestControlProgramSerializer


class PestMonitoringLogSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for pest monitoring logs."""
    list_fields = [
        'id', 'farm', 'farm_name', 'inspection_date',
        'is_pco_visit', 'total_stations_checked',
        'stations_with_activity', 'overall_activity_level',
        'overall_activity_level_display',
        'corrective_actions_needed',
    ]

    farm_name = serializers.CharField(source='farm.name', read_only=True)
    overall_activity_level_display = serializers.CharField(
        source='get_overall_activity_level_display', read_only=True
    )

    class Meta:
        model = PestMonitoringLog
        fields = [
            'id', 'company', 'program', 'farm', 'farm_name',
            'inspection_date', 'inspector_name', 'is_pco_visit',
            'station_results',
            'total_stations_checked', 'stations_with_activity',
            'pest_types_found', 'overall_activity_level',
            'overall_activity_level_display',
            'treatments_applied',
            'corrective_actions_needed', 'corrective_action_description',
            'corrective_action_ref',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'company', 'created_at', 'updated_at',
        ]


PestMonitoringLogListSerializer = PestMonitoringLogSerializer


# =============================================================================
# PRE-HARVEST INSPECTION SERIALIZERS
# =============================================================================

class PreHarvestInspectionSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for pre-harvest inspections."""
    list_fields = [
        'id', 'farm', 'farm_name', 'field', 'field_name',
        'inspection_date', 'planned_harvest_date', 'crop',
        'status', 'status_display', 'passed',
    ]

    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    inspector_display = serializers.SerializerMethodField()
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name', read_only=True
    )

    class Meta:
        model = PreHarvestInspection
        fields = [
            'id', 'company', 'farm', 'farm_name', 'field', 'field_name',
            'inspection_date', 'planned_harvest_date',
            'inspector', 'inspector_name', 'inspector_display', 'crop',
            'status', 'status_display',
            'animal_intrusion', 'animal_droppings_found',
            'adjacent_animal_operations', 'water_source_contamination',
            'biological_hazard_notes',
            'phi_respected', 'last_pesticide_date', 'last_pesticide_product',
            'drift_risk', 'chemical_spill_evidence', 'chemical_hazard_notes',
            'foreign_material_found', 'glass_metal_debris',
            'equipment_condition_ok', 'physical_hazard_notes',
            'field_condition_acceptable', 'drainage_adequate',
            'sanitation_units_in_place', 'hand_wash_available',
            'field_condition_notes',
            'workers_trained', 'harvest_containers_clean',
            'transport_vehicles_clean', 'worker_readiness_notes',
            'passed', 'overall_notes',
            'corrective_action_ref',
            'approved_by', 'approved_by_name', 'approved_at',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'company', 'approved_by', 'approved_at',
            'created_at', 'updated_at',
        ]

    def get_inspector_display(self, obj):
        if obj.inspector:
            return obj.inspector.get_full_name()
        return obj.inspector_name or ''


PreHarvestInspectionListSerializer = PreHarvestInspectionSerializer


# =============================================================================
# DASHBOARD SERIALIZER
# =============================================================================

class PrimusGFSDashboardSerializer(serializers.Serializer):
    """Non-model serializer for Primus GFS dashboard aggregate data."""
    overall_score = serializers.IntegerField()
    module_scores = serializers.DictField()
    documents = serializers.DictField()
    audits = serializers.DictField()
    corrective_actions = serializers.DictField()
    land_assessments = serializers.DictField()
    suppliers = serializers.DictField()
    mock_recalls = serializers.DictField()
    food_defense = serializers.DictField()
    sanitation = serializers.DictField()
    equipment_calibration = serializers.DictField()
    pest_control = serializers.DictField()
    pre_harvest = serializers.DictField()
    upcoming_deadlines = serializers.ListField()
    recent_alerts = serializers.ListField()


# =============================================================================
# CAC DOC 01 — FOOD SAFETY PROFILE
# =============================================================================

class FoodSafetyProfileSerializer(serializers.ModelSerializer):
    ranch_map_url = serializers.SerializerMethodField()

    class Meta:
        model = FoodSafetyProfile
        fields = [
            'id', 'company',
            'coordinator_name', 'coordinator_title', 'coordinator_phone', 'coordinator_email',
            'alternate_coordinator_name', 'alternate_coordinator_phone',
            'policy_statement', 'policy_effective_date', 'policy_reviewed_date',
            'policy_approved_by', 'policy_approved_title',
            'commodities_grown', 'total_planted_acres',
            'ranch_map_file', 'ranch_map_url',
            'last_reviewed_date', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company']

    def get_ranch_map_url(self, obj):
        if obj.ranch_map_file:
            return obj.ranch_map_file.url
        return None


# =============================================================================
# CAC DOC 02 — ORG CHART ROLES
# =============================================================================

class FoodSafetyRoleAssignmentSerializer(serializers.ModelSerializer):
    role_category_display = serializers.CharField(
        source='get_role_category_display', read_only=True
    )

    class Meta:
        model = FoodSafetyRoleAssignment
        fields = [
            'id', 'company', 'role_category', 'role_category_display',
            'role_title', 'person_name', 'person_user',
            'alternate_name', 'responsibilities', 'active', 'display_order',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['company']


# =============================================================================
# CAC DOCS 03-04 — COMMITTEE MEETING
# =============================================================================

class FoodSafetyCommitteeMeetingSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'meeting_date', 'meeting_quarter', 'quarter_display',
        'meeting_year', 'status', 'all_sections_reviewed',
        'attendees',
    ]

    quarter_display = serializers.CharField(
        source='get_meeting_quarter_display', read_only=True
    )
    all_sections_reviewed = serializers.BooleanField(read_only=True)
    farm_name = serializers.CharField(source='farm.name', read_only=True, default='')

    class Meta:
        model = FoodSafetyCommitteeMeeting
        fields = [
            'id', 'company', 'meeting_date', 'meeting_time',
            'meeting_quarter', 'quarter_display', 'meeting_year',
            'location', 'farm', 'farm_name', 'attendees',
            'animal_activity_reviewed', 'animal_activity_notes',
            'pesticide_apps_reviewed', 'pesticide_apps_notes',
            'pesticide_records_in_binder', 'phi_followed',
            'fertilizer_apps_reviewed', 'fertilizer_apps_notes',
            'fertilizer_records_in_binder',
            'water_testing_reviewed', 'water_testing_notes',
            'last_irrigation_water_test', 'last_handwash_water_test', 'water_records_current',
            'worker_training_reviewed', 'worker_training_notes',
            'last_pesticide_training', 'last_food_safety_training',
            'additional_topics', 'action_items',
            'status', 'coordinator_signature_date', 'next_meeting_date',
            'all_sections_reviewed', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company']


FoodSafetyCommitteeMeetingListSerializer = FoodSafetyCommitteeMeetingSerializer


# =============================================================================
# CAC DOC 05 — MANAGEMENT VERIFICATION REVIEW
# =============================================================================

class ManagementVerificationReviewSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'review_year', 'review_date', 'conducted_by',
        'approved', 'all_sections_reviewed', 'sections_reviewed_count',
    ]

    all_sections_reviewed = serializers.BooleanField(read_only=True)
    sections_reviewed_count = serializers.IntegerField(read_only=True)
    report_file_url = serializers.SerializerMethodField()

    class Meta:
        model = ManagementVerificationReview
        fields = [
            'id', 'company', 'review_year', 'review_date',
            'conducted_by', 'conducted_by_title',
            'internal_audits_reviewed', 'internal_audits_analysis', 'internal_audits_comments',
            'external_audits_reviewed', 'external_audits_analysis', 'external_audits_comments',
            'incidents_reviewed', 'incidents_analysis', 'incidents_comments',
            'complaints_reviewed', 'complaints_analysis', 'complaints_comments',
            'objectives_reviewed', 'objectives_analysis', 'objectives_comments',
            'org_structure_reviewed', 'org_structure_analysis', 'org_structure_comments',
            'sops_reviewed', 'sops_analysis', 'sops_comments',
            'training_reviewed', 'training_analysis', 'training_comments',
            'equipment_reviewed', 'equipment_analysis', 'equipment_comments',
            'job_roles_reviewed', 'job_roles_analysis', 'job_roles_comments',
            'supplier_program_reviewed', 'supplier_program_analysis', 'supplier_program_comments',
            'committee_reviewed', 'committee_analysis', 'committee_comments',
            'resources_adequate', 'resource_gaps', 'resource_allocation_plan',
            'overall_assessment', 'action_items', 'attendees',
            'approved', 'approved_by', 'approved_date', 'next_review_date',
            'report_file', 'report_file_url',
            'all_sections_reviewed', 'sections_reviewed_count',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company']

    def get_report_file_url(self, obj):
        if obj.report_file:
            return obj.report_file.url
        return None


ManagementVerificationReviewListSerializer = ManagementVerificationReviewSerializer


# =============================================================================
# CAC DOC 06 — TRAINING MATRIX
# =============================================================================

class TrainingRecordSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'employee_name', 'employee_role', 'active',
        'training_types_current', 'compliance_percentage',
    ]

    training_types_current = serializers.IntegerField(read_only=True)
    compliance_percentage = serializers.IntegerField(read_only=True)

    class Meta:
        model = TrainingRecord
        fields = [
            'id', 'company', 'employee_name', 'employee_id', 'employee_role',
            'employee_user',
            'psa_training_date', 'psa_certificate_number',
            'animal_intrusion_date', 'animal_intrusion_expiration',
            'food_safety_date', 'food_safety_expiration',
            'worker_hygiene_date', 'worker_hygiene_expiration',
            'bleeding_illness_date', 'bleeding_illness_expiration',
            'inspections_date', 'inspections_expiration',
            'crop_protection_date', 'crop_protection_expiration',
            'applicator_license_number', 'applicator_license_expiration',
            'additional_training',
            'training_types_current', 'compliance_percentage',
            'active', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company']


TrainingRecordListSerializer = TrainingRecordSerializer


# =============================================================================
# CAC DOC 37 — TRAINING SESSIONS
# =============================================================================

class WorkerTrainingSessionSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'training_date', 'training_topic',
        'training_category', 'category_display',
        'farm_name', 'instructor_name', 'attendee_count',
    ]

    category_display = serializers.CharField(
        source='get_training_category_display', read_only=True
    )
    language_display = serializers.CharField(
        source='get_language_display', read_only=True
    )
    farm_name = serializers.CharField(source='farm.name', read_only=True, default='')
    sign_in_sheet_url = serializers.SerializerMethodField()

    class Meta:
        model = WorkerTrainingSession
        fields = [
            'id', 'company', 'farm', 'farm_name',
            'training_date', 'training_topic',
            'training_category', 'category_display',
            'language', 'language_display',
            'instructor_name', 'instructor_title',
            'duration_minutes', 'location', 'materials_used',
            'attendees', 'attendee_count',
            'quiz_administered', 'average_score',
            'sign_in_sheet', 'sign_in_sheet_url', 'related_document',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company', 'attendee_count']

    def get_sign_in_sheet_url(self, obj):
        if obj.sign_in_sheet:
            return obj.sign_in_sheet.url
        return None


WorkerTrainingSessionListSerializer = WorkerTrainingSessionSerializer


# =============================================================================
# CAC DOC 24 — PERIMETER MONITORING
# =============================================================================

class PerimeterMonitoringLogSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'farm_name', 'log_date', 'week_number',
        'inspector_name', 'animal_activity_found',
        'corrective_action_needed',
    ]

    farm_name = serializers.CharField(source='farm.name', read_only=True)

    class Meta:
        model = PerimeterMonitoringLog
        fields = [
            'id', 'company', 'farm', 'farm_name',
            'log_date', 'week_number', 'inspector_name', 'inspector',
            'perimeter_intact', 'gates_secured', 'signage_in_place',
            'animal_activity_found', 'animal_species_observed',
            'fecal_matter_found', 'fecal_matter_action',
            'animal_carcass_found', 'crop_damage_from_animals', 'buffer_zones_clear',
            'water_sources_checked', 'water_source_integrity_ok',
            'unauthorized_access_found', 'unauthorized_access_notes',
            'trespassing_evidence', 'trash_found',
            'corrective_action_needed', 'corrective_action_description',
            'corrective_action_ref', 'findings_summary',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company', 'week_number']


PerimeterMonitoringLogListSerializer = PerimeterMonitoringLogSerializer


# =============================================================================
# CAC DOC 38 — PRE-SEASON CHECKLIST
# =============================================================================

class PreSeasonChecklistSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'farm_name', 'season_year', 'assessment_date',
        'assessed_by', 'approved_for_season', 'deficiencies_found',
    ]

    farm_name = serializers.CharField(source='farm.name', read_only=True)

    class Meta:
        model = PreSeasonChecklist
        fields = [
            'id', 'company', 'farm', 'farm_name', 'season_year',
            'assessment_date', 'assessed_by', 'assessed_by_user',
            # Ground History
            'non_ag_previous_use', 'animal_husbandry_previous', 'waste_storage_previous',
            'animal_activity_evidence', 'flooding_occurred', 'new_purchase_or_lease',
            'ground_history_notes',
            # Adjacent Land
            'adjacent_livestock', 'adjacent_manure_storage', 'adjacent_land_notes',
            # Fertilizer
            'raw_manure_used', 'biosolids_used', 'composted_manure_used',
            'heat_treated_manure_used', 'soil_amendments_used',
            'nonsynthetic_treatments_used', 'fertilizer_storage_safe', 'fertilizer_notes',
            # Water
            'water_sources', 'microbial_tests_conducted', 'backflow_prevention_in_use',
            'water_delivery_good_condition', 'water_risk_factors_identified',
            'water_risk_factors_detail', 'water_notes',
            # Worker Hygiene
            'toilet_facilities_available', 'toilet_facilities_maintained',
            'workers_trained', 'first_aid_current', 'access_roads_safe',
            'toilet_location_suitable', 'service_company_procedures', 'hygiene_notes',
            # Records
            'pca_qal_license_current', 'letters_of_guarantee_current',
            'pesticide_use_reports_current', 'water_tests_current',
            'perimeter_monitoring_log_current', 'restroom_maintenance_log_current',
            'training_log_current', 'committee_log_current',
            'management_review_current', 'fertilizer_log_current',
            'nuoca_forms_current', 'chemical_inventory_current', 'records_notes',
            # Overall
            'deficiencies_found', 'deficiency_list',
            'approved_for_season', 'approved_by', 'approval_date',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company']


PreSeasonChecklistListSerializer = PreSeasonChecklistSerializer


# =============================================================================
# CAC DOC 39 — FIELD RISK ASSESSMENT
# =============================================================================

class FieldRiskAssessmentSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'farm_name', 'season_year', 'assessment_date',
        'overall_risk_level', 'risk_level_display',
        'critical_risks_count', 'high_risks_count', 'approved',
    ]

    farm_name = serializers.CharField(source='farm.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True, default='')
    risk_level_display = serializers.CharField(
        source='get_overall_risk_level_display', read_only=True
    )
    report_file_url = serializers.SerializerMethodField()

    class Meta:
        model = FieldRiskAssessment
        fields = [
            'id', 'company', 'farm', 'farm_name', 'field', 'field_name',
            'assessment_date', 'season_year', 'assessed_by', 'assessed_by_user',
            'total_acres', 'crops_grown', 'structures_on_property',
            'previous_land_use', 'recent_flood_event', 'adjacent_land_use',
            'land_contamination_risks', 'water_source_risks',
            'agricultural_input_risks', 'worker_hygiene_risks', 'labor_harvesting_risks',
            'water_sources_description', 'water_tests_conducted',
            'fertilizer_suppliers', 'pesticide_suppliers', 'animal_amendments_used',
            'toilet_type', 'maintenance_provider', 'labor_hired_by',
            'harvest_arranged_by', 'harvest_crew_certified',
            'overall_risk_level', 'risk_level_display',
            'critical_risks_count', 'high_risks_count',
            'reviewed_by', 'review_date', 'approved',
            'report_file', 'report_file_url',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company']

    def get_report_file_url(self, obj):
        if obj.report_file:
            return obj.report_file.url
        return None


FieldRiskAssessmentListSerializer = FieldRiskAssessmentSerializer


# =============================================================================
# CAC DOC 09A — EMPLOYEE NON-CONFORMANCE
# =============================================================================

class EmployeeNonConformanceSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'employee_name', 'violation_date',
        'violation_type', 'violation_type_display',
        'warning_level', 'resolved',
    ]

    violation_type_display = serializers.CharField(
        source='get_violation_type_display', read_only=True
    )

    class Meta:
        model = EmployeeNonConformance
        fields = [
            'id', 'company', 'employee_name', 'employee_id', 'employee_user',
            'violation_date', 'violation_type', 'violation_type_display',
            'violation_description',
            'supervisor_name', 'supervisor_user',
            'warning_level', 'warning_description',
            'employee_acknowledged', 'employee_signature_date',
            'follow_up_required', 'follow_up_date', 'follow_up_notes', 'resolved',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company']


EmployeeNonConformanceListSerializer = EmployeeNonConformanceSerializer


# =============================================================================
# CAC DOCS 11-12 — PRODUCT HOLD/RELEASE
# =============================================================================

class ProductHoldReleaseSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'hold_number', 'hold_date', 'product_description',
        'status', 'status_display', 'hold_reason',
    ]

    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    hold_reason_display = serializers.CharField(
        source='get_hold_reason_display', read_only=True
    )
    farm_name = serializers.CharField(source='farm.name', read_only=True, default='')

    class Meta:
        model = ProductHoldRelease
        fields = [
            'id', 'company', 'farm', 'farm_name',
            'hold_number', 'hold_date', 'hold_time',
            'product_type', 'product_description', 'lot_numbers', 'quantity',
            'hold_reason', 'hold_reason_display', 'hold_reason_detail',
            'hold_initiated_by', 'segregation_method',
            'status', 'status_display',
            'investigation_notes',
            'release_date', 'release_time', 'release_authorized_by', 'disposition',
            'corrective_action_ref',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company']


ProductHoldReleaseListSerializer = ProductHoldReleaseSerializer


# =============================================================================
# CAC DOC 15 — SUPPLIER VERIFICATION LOG
# =============================================================================

class SupplierVerificationLogSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(
        source='supplier.supplier_name', read_only=True
    )
    verification_type_display = serializers.CharField(
        source='get_verification_type_display', read_only=True
    )

    class Meta:
        model = SupplierVerificationLog
        fields = [
            'id', 'company', 'supplier', 'supplier_name',
            'verification_date', 'verification_type', 'verification_type_display',
            'verified_by', 'verified_by_user',
            'checklist_items', 'overall_result', 'deficiencies',
            'corrective_action_required', 'corrective_action_ref',
            'nuoca_filed', 'next_verification_date', 'satisfied_with_service',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company']


# =============================================================================
# CAC DOC 18 — FOOD FRAUD ASSESSMENT
# =============================================================================

class FoodFraudAssessmentSerializer(serializers.ModelSerializer):
    vulnerability_display = serializers.CharField(
        source='get_overall_vulnerability_display', read_only=True
    )

    class Meta:
        model = FoodFraudAssessment
        fields = [
            'id', 'company', 'assessment_year', 'assessment_date', 'assessed_by',
            'fraud_assessments', 'overall_vulnerability', 'vulnerability_display',
            'mitigation_summary', 'reviewed_date', 'approved', 'related_document',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company']


# =============================================================================
# CAC DOC 21 — EMERGENCY CONTACTS
# =============================================================================

class EmergencyContactSerializer(serializers.ModelSerializer):
    contact_type_display = serializers.CharField(
        source='get_contact_type_display', read_only=True
    )

    class Meta:
        model = EmergencyContact
        fields = [
            'id', 'company', 'contact_type', 'contact_type_display',
            'organization', 'contact_name',
            'phone_primary', 'phone_secondary', 'address',
            'notes', 'display_order', 'active', 'last_verified_date',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['company']


# =============================================================================
# CAC DOC 29 — CHEMICAL INVENTORY
# =============================================================================

class ChemicalInventoryLogSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'chemical_name', 'chemical_type',
        'inventory_date', 'stock_on_hand', 'unit_of_measure',
    ]

    chemical_type_display = serializers.CharField(
        source='get_chemical_type_display', read_only=True
    )

    class Meta:
        model = ChemicalInventoryLog
        fields = [
            'id', 'company', 'chemical_name', 'epa_registration_number',
            'chemical_type', 'chemical_type_display',
            'storage_location', 'unit_of_measure',
            'inventory_date', 'inventory_month', 'inventory_year',
            'stock_on_hand', 'counted_by',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company']


ChemicalInventoryLogListSerializer = ChemicalInventoryLogSerializer


# =============================================================================
# CAC DOC 34 — SANITATION MAINTENANCE
# =============================================================================

class SanitationMaintenanceLogSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'farm_name', 'log_date', 'unit_identifier',
        'condition_acceptable', 'repairs_needed',
    ]

    farm_name = serializers.CharField(source='farm.name', read_only=True)

    class Meta:
        model = SanitationMaintenanceLog
        fields = [
            'id', 'company', 'farm', 'farm_name',
            'log_date', 'log_time', 'unit_identifier',
            'paper_towels_stocked', 'toilet_paper_stocked',
            'soap_available', 'potable_water_available',
            'trash_removed', 'restroom_cleaned',
            'condition_acceptable', 'repairs_needed', 'repairs_description',
            'serviced_by', 'serviced_by_user',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company']


SanitationMaintenanceLogListSerializer = SanitationMaintenanceLogSerializer


# =============================================================================
# CAC FOOD SAFETY MANUAL — PDF & SIGNATURE SERIALIZERS
# =============================================================================

class CACDocumentSignatureSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Full serializer for CAC document signatures."""
    list_fields = [
        'id', 'doc_number', 'page_number',
        'signer_role', 'signer_role_display',
        'signer_name', 'signed', 'signed_at',
        'season_year', 'signer_order',
    ]

    signer_role_display = serializers.CharField(
        source='get_signer_role_display', read_only=True
    )
    signer_user_name = serializers.SerializerMethodField()

    class Meta:
        model = CACDocumentSignature
        fields = [
            'id', 'company', 'doc_number', 'page_number',
            'signer_role', 'signer_role_display',
            'signer_name', 'signer_user', 'signer_user_name', 'signer_order',
            'signed', 'signature_data', 'signed_at',
            'season_year', 'source_model', 'source_id',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['company', 'created_at', 'updated_at']

    def get_signer_user_name(self, obj):
        if obj.signer_user:
            return obj.signer_user.get_full_name() or obj.signer_user.email
        return None


CACDocumentSignatureListSerializer = CACDocumentSignatureSerializer


class CACSignRequestSerializer(serializers.Serializer):
    """Serializer for the sign endpoint."""
    doc_number = serializers.CharField(max_length=10)
    page_number = serializers.IntegerField()
    signer_role = serializers.CharField(max_length=50)
    signer_name = serializers.CharField(max_length=200)
    signer_order = serializers.IntegerField(default=0)
    signature_data = serializers.CharField()
    source_model = serializers.CharField(max_length=100, required=False, default='')
    source_id = serializers.IntegerField(required=False, allow_null=True)
