"""
Primus GFS Compliance Serializers

Phase 1: Document Control, Internal Audits, Corrective Actions, Land History
"""

from rest_framework import serializers
from .models import (
    ControlledDocument, DocumentRevisionHistory,
    InternalAudit, AuditFinding, CorrectiveAction,
    LandHistoryAssessment,
    ApprovedSupplier, IncomingMaterialVerification,
    MockRecall, FoodDefensePlan, FieldSanitationLog,
    EquipmentCalibration, PestControlProgram, PestMonitoringLog,
    PreHarvestInspection,
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


class ControlledDocumentSerializer(serializers.ModelSerializer):
    """Full serializer for controlled documents."""
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

    class Meta:
        model = ControlledDocument
        fields = [
            'id', 'company', 'document_number', 'title',
            'document_type', 'document_type_display',
            'primus_module', 'primus_module_display',
            'version', 'revision_date', 'effective_date', 'review_due_date',
            'description', 'file', 'file_url', 'file_name', 'content_text',
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


class ControlledDocumentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for document lists."""
    document_type_display = serializers.CharField(
        source='get_document_type_display', read_only=True
    )
    primus_module_display = serializers.CharField(
        source='get_primus_module_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    is_review_overdue = serializers.BooleanField(read_only=True)
    days_until_review = serializers.IntegerField(read_only=True)
    has_file = serializers.SerializerMethodField()

    class Meta:
        model = ControlledDocument
        fields = [
            'id', 'document_number', 'title',
            'document_type', 'document_type_display',
            'primus_module', 'primus_module_display',
            'version', 'status', 'status_display',
            'review_due_date', 'is_review_overdue', 'days_until_review',
            'effective_date', 'has_file',
        ]

    def get_has_file(self, obj):
        return bool(obj.file)


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


class InternalAuditSerializer(serializers.ModelSerializer):
    """Full serializer for internal audits."""
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
            'report_file', 'report_file_url', 'report_file_name',
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


class InternalAuditListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for audit lists."""
    audit_type_display = serializers.CharField(
        source='get_audit_type_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    total_findings = serializers.IntegerField(read_only=True)
    open_findings = serializers.IntegerField(read_only=True)
    has_report = serializers.SerializerMethodField()

    class Meta:
        model = InternalAudit
        fields = [
            'id', 'audit_number', 'title',
            'audit_type', 'audit_type_display',
            'planned_date', 'actual_date',
            'status', 'status_display',
            'overall_score', 'total_findings', 'open_findings',
            'has_report',
        ]

    def get_has_report(self, obj):
        return bool(obj.report_file)


# =============================================================================
# CORRECTIVE ACTION SERIALIZERS
# =============================================================================

class CorrectiveActionSerializer(serializers.ModelSerializer):
    """Full serializer for corrective actions."""
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


class CorrectiveActionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for corrective action lists."""
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    is_overdue = serializers.BooleanField(read_only=True)
    days_until_due = serializers.IntegerField(read_only=True)

    class Meta:
        model = CorrectiveAction
        fields = [
            'id', 'ca_number', 'description', 'source_type',
            'due_date', 'status', 'status_display',
            'is_overdue', 'days_until_due',
            'assigned_to_name',
        ]


# =============================================================================
# LAND HISTORY ASSESSMENT SERIALIZERS
# =============================================================================

class LandHistoryAssessmentSerializer(serializers.ModelSerializer):
    """Full serializer for land history assessments."""
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
            'supporting_document_url',
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


class LandHistoryAssessmentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for land assessment lists."""
    contamination_risk_display = serializers.CharField(
        source='get_contamination_risk_display', read_only=True
    )
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(
        source='field.farm.name', read_only=True
    )
    risk_factor_count = serializers.IntegerField(read_only=True)
    has_document = serializers.SerializerMethodField()

    class Meta:
        model = LandHistoryAssessment
        fields = [
            'id', 'field', 'field_name', 'farm_name',
            'assessment_date', 'contamination_risk',
            'contamination_risk_display', 'approved',
            'risk_factor_count',
            'buffer_period_adequate', 'previous_animal_operations',
            'remediation_required', 'remediation_verified',
            'information_source', 'has_document',
            'supporting_document_name',
        ]

    def get_has_document(self, obj):
        return bool(obj.supporting_document)


# =============================================================================
# DASHBOARD SERIALIZER
# =============================================================================

# =============================================================================
# SUPPLIER CONTROL SERIALIZERS
# =============================================================================

class ApprovedSupplierSerializer(serializers.ModelSerializer):
    """Full serializer for approved suppliers."""
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


class ApprovedSupplierListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for supplier lists."""
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    is_review_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = ApprovedSupplier
        fields = [
            'id', 'supplier_name', 'supplier_code',
            'material_types', 'status', 'status_display',
            'approved_date', 'next_review_date', 'is_review_overdue',
        ]


class IncomingMaterialVerificationSerializer(serializers.ModelSerializer):
    """Full serializer for material verifications."""
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


class IncomingMaterialVerificationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for verification lists."""
    material_type_display = serializers.CharField(
        source='get_material_type_display', read_only=True
    )
    supplier_name = serializers.CharField(
        source='supplier.supplier_name', read_only=True
    )

    class Meta:
        model = IncomingMaterialVerification
        fields = [
            'id', 'supplier', 'supplier_name', 'receipt_date',
            'material_type', 'material_type_display',
            'material_description', 'accepted',
        ]


# =============================================================================
# MOCK RECALL SERIALIZERS
# =============================================================================

class MockRecallSerializer(serializers.ModelSerializer):
    """Full serializer for mock recall exercises."""
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    led_by_name = serializers.CharField(
        source='led_by.get_full_name', read_only=True
    )
    within_time_limit = serializers.BooleanField(read_only=True)
    report_file_url = serializers.SerializerMethodField()
    report_file_name = serializers.SerializerMethodField()

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
            'report_file', 'report_file_url', 'report_file_name',
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


class MockRecallListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for mock recall lists."""
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    within_time_limit = serializers.BooleanField(read_only=True)
    has_report = serializers.SerializerMethodField()

    class Meta:
        model = MockRecall
        fields = [
            'id', 'recall_number', 'exercise_date',
            'target_product', 'status', 'status_display',
            'trace_duration_minutes', 'effectiveness_score',
            'passed', 'within_time_limit', 'has_report',
        ]

    def get_has_report(self, obj):
        return bool(obj.report_file)


# =============================================================================
# FOOD DEFENSE PLAN SERIALIZERS
# =============================================================================

class FoodDefensePlanSerializer(serializers.ModelSerializer):
    """Full serializer for food defense plans."""
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


class FoodDefensePlanListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for food defense plan lists."""
    overall_threat_level_display = serializers.CharField(
        source='get_overall_threat_level_display', read_only=True
    )
    is_review_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = FoodDefensePlan
        fields = [
            'id', 'plan_year', 'effective_date', 'review_date',
            'overall_threat_level', 'overall_threat_level_display',
            'approved', 'is_review_overdue',
        ]


# =============================================================================
# FIELD SANITATION SERIALIZERS
# =============================================================================

class FieldSanitationLogSerializer(serializers.ModelSerializer):
    """Full serializer for field sanitation logs."""
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


class FieldSanitationLogListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for sanitation log lists."""
    farm_name = serializers.CharField(source='farm.name', read_only=True)

    class Meta:
        model = FieldSanitationLog
        fields = [
            'id', 'farm', 'farm_name', 'log_date',
            'worker_count', 'units_required', 'units_deployed',
            'compliant',
        ]


# =============================================================================
# EQUIPMENT CALIBRATION SERIALIZERS
# =============================================================================

class EquipmentCalibrationSerializer(serializers.ModelSerializer):
    """Full serializer for equipment calibration records."""
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
            'certificate_file_url', 'certificate_file_name',
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


class EquipmentCalibrationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for calibration lists."""
    equipment_type_display = serializers.CharField(
        source='get_equipment_type_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    is_overdue = serializers.BooleanField(read_only=True)
    days_until_due = serializers.IntegerField(read_only=True)
    has_certificate = serializers.SerializerMethodField()

    class Meta:
        model = EquipmentCalibration
        fields = [
            'id', 'equipment_name', 'equipment_type',
            'equipment_type_display', 'equipment_id',
            'calibration_date', 'next_calibration_date',
            'status', 'status_display',
            'within_tolerance', 'is_overdue', 'days_until_due',
            'has_certificate',
        ]

    def get_has_certificate(self, obj):
        return bool(obj.certificate_file)


# =============================================================================
# PEST CONTROL SERIALIZERS
# =============================================================================

class PestControlProgramSerializer(serializers.ModelSerializer):
    """Full serializer for pest control programs."""
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


class PestControlProgramListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for pest control program lists."""
    is_review_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = PestControlProgram
        fields = [
            'id', 'program_year', 'effective_date', 'review_date',
            'pco_company', 'total_stations',
            'approved', 'is_review_overdue',
        ]


class PestMonitoringLogSerializer(serializers.ModelSerializer):
    """Full serializer for pest monitoring logs."""
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


class PestMonitoringLogListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for pest monitoring log lists."""
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    overall_activity_level_display = serializers.CharField(
        source='get_overall_activity_level_display', read_only=True
    )

    class Meta:
        model = PestMonitoringLog
        fields = [
            'id', 'farm', 'farm_name', 'inspection_date',
            'is_pco_visit', 'total_stations_checked',
            'stations_with_activity', 'overall_activity_level',
            'overall_activity_level_display',
            'corrective_actions_needed',
        ]


# =============================================================================
# PRE-HARVEST INSPECTION SERIALIZERS
# =============================================================================

class PreHarvestInspectionSerializer(serializers.ModelSerializer):
    """Full serializer for pre-harvest inspections."""
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


class PreHarvestInspectionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for pre-harvest inspection lists."""
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)

    class Meta:
        model = PreHarvestInspection
        fields = [
            'id', 'farm', 'farm_name', 'field', 'field_name',
            'inspection_date', 'planned_harvest_date', 'crop',
            'status', 'status_display', 'passed',
        ]


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
