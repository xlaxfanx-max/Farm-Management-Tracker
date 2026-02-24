from rest_framework import serializers
from .serializer_mixins import DynamicFieldsMixin
from .models import (
    ComplianceProfile, ComplianceDeadline, ComplianceAlert,
    License, WPSTrainingRecord, CentralPostingLocation, REIPostingRecord,
    ComplianceReport, IncidentReport, NotificationPreference, NotificationLog
)


# -----------------------------------------------------------------------------
# COMPLIANCE PROFILE SERIALIZERS
# -----------------------------------------------------------------------------

class ComplianceProfileSerializer(serializers.ModelSerializer):
    """Serializer for company compliance profile."""
    company_name = serializers.CharField(source='company.name', read_only=True)
    active_regulations = serializers.ListField(read_only=True)

    class Meta:
        model = ComplianceProfile
        fields = [
            'id', 'company', 'company_name',
            'primary_state', 'additional_states',
            'requires_pur_reporting', 'requires_wps_compliance',
            'requires_fsma_compliance', 'requires_sgma_reporting',
            'requires_ilrp_reporting',
            'organic_certified', 'organic_certifier',
            'globalgap_certified', 'primus_certified', 'sqf_certified',
            'buyer_requirements', 'deadline_reminder_days',
            'active_regulations',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['company', 'created_at', 'updated_at']


# -----------------------------------------------------------------------------
# COMPLIANCE DEADLINE SERIALIZERS
# -----------------------------------------------------------------------------

class ComplianceDeadlineSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for compliance deadlines (dynamic list/detail)."""
    list_fields = [
        'id', 'name', 'category', 'category_display',
        'regulation', 'due_date', 'status', 'status_display',
        'days_until_due', 'is_overdue', 'action_url',
    ]

    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    days_until_due = serializers.IntegerField(read_only=True)
    completed_by_name = serializers.CharField(source='completed_by.get_full_name', read_only=True)
    related_farm_name = serializers.CharField(source='related_farm.name', read_only=True)
    related_field_name = serializers.CharField(source='related_field.name', read_only=True)

    class Meta:
        model = ComplianceDeadline
        fields = [
            'id', 'company', 'name', 'description',
            'category', 'category_display',
            'regulation', 'due_date', 'frequency', 'frequency_display',
            'warning_days', 'status', 'status_display',
            'is_overdue', 'days_until_due',
            'completed_at', 'completed_by', 'completed_by_name',
            'completion_notes', 'auto_generated', 'source_deadline',
            'related_farm', 'related_farm_name',
            'related_field', 'related_field_name',
            'action_url', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['company', 'completed_at', 'completed_by', 'auto_generated', 'created_at', 'updated_at']


# Backward-compatible alias for manual serialization in dashboard/actions
ComplianceDeadlineListSerializer = ComplianceDeadlineSerializer


class ComplianceDeadlineCompleteSerializer(serializers.Serializer):
    """Serializer for marking deadline complete."""
    notes = serializers.CharField(required=False, allow_blank=True)


# -----------------------------------------------------------------------------
# COMPLIANCE ALERT SERIALIZERS
# -----------------------------------------------------------------------------

class ComplianceAlertSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for compliance alerts (dynamic list/detail)."""
    list_fields = [
        'id', 'alert_type', 'alert_type_display',
        'priority', 'priority_display', 'title', 'message',
        'is_acknowledged', 'action_url', 'action_label',
        'created_at',
    ]

    alert_type_display = serializers.CharField(source='get_alert_type_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    acknowledged_by_name = serializers.CharField(source='acknowledged_by.get_full_name', read_only=True)

    class Meta:
        model = ComplianceAlert
        fields = [
            'id', 'company', 'alert_type', 'alert_type_display',
            'priority', 'priority_display', 'title', 'message',
            'related_deadline', 'related_object_type', 'related_object_id',
            'is_active', 'is_acknowledged',
            'acknowledged_by', 'acknowledged_by_name', 'acknowledged_at',
            'action_url', 'action_label', 'expires_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['company', 'acknowledged_by', 'acknowledged_at', 'created_at', 'updated_at']


ComplianceAlertListSerializer = ComplianceAlertSerializer


# -----------------------------------------------------------------------------
# LICENSE SERIALIZERS
# -----------------------------------------------------------------------------

class LicenseSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for licenses (dynamic list/detail)."""
    list_fields = [
        'id', 'license_type', 'license_type_display',
        'license_number', 'holder_name',
        'expiration_date', 'status', 'status_display',
        'days_until_expiration',
    ]

    license_type_display = serializers.CharField(source='get_license_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    holder_name = serializers.CharField(read_only=True)
    is_valid = serializers.BooleanField(read_only=True)
    days_until_expiration = serializers.IntegerField(read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = License
        fields = [
            'id', 'company', 'user', 'user_email',
            'license_type', 'license_type_display',
            'license_number', 'name_on_license',
            'issuing_authority', 'issuing_state',
            'issue_date', 'expiration_date',
            'status', 'status_display',
            'holder_name', 'is_valid', 'days_until_expiration',
            'categories', 'endorsements',
            'renewal_reminder_days', 'renewal_in_progress',
            'renewal_submitted_date', 'renewal_notes',
            'ce_credits_required', 'ce_credits_earned',
            'document', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['company', 'status', 'created_at', 'updated_at']


LicenseListSerializer = LicenseSerializer


# -----------------------------------------------------------------------------
# WPS TRAINING SERIALIZERS
# -----------------------------------------------------------------------------

class WPSTrainingRecordSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for WPS training records (dynamic list/detail)."""
    list_fields = [
        'id', 'trainee_name', 'training_type', 'training_type_display',
        'training_date', 'expiration_date',
        'status', 'days_until_expiration', 'verified',
    ]

    training_type_display = serializers.CharField(source='get_training_type_display', read_only=True)
    is_valid = serializers.BooleanField(read_only=True)
    days_until_expiration = serializers.IntegerField(read_only=True)
    status = serializers.CharField(read_only=True)
    trainee_user_email = serializers.EmailField(source='trainee_user.email', read_only=True)
    trainer_user_email = serializers.EmailField(source='trainer_user.email', read_only=True)
    farm_name = serializers.CharField(source='farm.name', read_only=True)

    class Meta:
        model = WPSTrainingRecord
        fields = [
            'id', 'company',
            'trainee_name', 'trainee_employee_id', 'trainee_user', 'trainee_user_email',
            'training_type', 'training_type_display',
            'training_date', 'expiration_date',
            'is_valid', 'days_until_expiration', 'status',
            'training_program', 'training_language',
            'trainer_name', 'trainer_certification', 'trainer_user', 'trainer_user_email',
            'verified', 'verification_method', 'quiz_score',
            'certificate_document',
            'training_location', 'farm', 'farm_name',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company', 'created_at', 'updated_at']

    def validate(self, data):
        """Auto-calculate expiration if not provided."""
        if 'expiration_date' not in data or not data.get('expiration_date'):
            from datetime import timedelta
            training_type = data.get('training_type')
            training_date = data.get('training_date')
            if training_type and training_date:
                days = WPSTrainingRecord.VALIDITY_PERIODS.get(training_type, 365)
                data['expiration_date'] = training_date + timedelta(days=days)
        return data


WPSTrainingRecordListSerializer = WPSTrainingRecordSerializer


# -----------------------------------------------------------------------------
# CENTRAL POSTING LOCATION SERIALIZERS
# -----------------------------------------------------------------------------

class CentralPostingLocationSerializer(serializers.ModelSerializer):
    """Full serializer for central posting locations."""
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    is_compliant = serializers.BooleanField(read_only=True)
    compliance_score = serializers.IntegerField(read_only=True)
    last_verified_by_name = serializers.CharField(source='last_verified_by.get_full_name', read_only=True)

    class Meta:
        model = CentralPostingLocation
        fields = [
            'id', 'company', 'farm', 'farm_name',
            'location_name', 'location_description',
            'has_wps_poster', 'has_emergency_info',
            'has_sds_available', 'has_application_info',
            'has_decontamination_supplies',
            'is_compliant', 'compliance_score',
            'last_verified_date', 'last_verified_by', 'last_verified_by_name',
            'verification_notes', 'photo', 'active', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['company', 'last_verified_date', 'last_verified_by', 'created_at', 'updated_at']


# -----------------------------------------------------------------------------
# REI POSTING SERIALIZERS
# -----------------------------------------------------------------------------

class REIPostingRecordSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for REI posting records (dynamic list/detail)."""
    list_fields = [
        'id', 'field_name', 'product_name',
        'rei_hours', 'rei_end_datetime', 'is_active',
        'posted_at', 'posting_compliant',
    ]

    application_date = serializers.DateField(source='application.application_date', read_only=True)
    field_name = serializers.CharField(source='application.field.name', read_only=True)
    product_name = serializers.CharField(source='application.product.product_name', read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    time_remaining = serializers.DurationField(read_only=True)
    posted_by_name = serializers.CharField(source='posted_by.get_full_name', read_only=True)
    removed_by_name = serializers.CharField(source='removed_by.get_full_name', read_only=True)

    class Meta:
        model = REIPostingRecord
        fields = [
            'id', 'application', 'application_date',
            'field_name', 'product_name',
            'rei_hours', 'rei_end_datetime',
            'is_active', 'time_remaining',
            'posted_at', 'posted_by', 'posted_by_name',
            'removed_at', 'removed_by', 'removed_by_name',
            'posting_compliant', 'removal_compliant',
            'early_entry_occurred', 'early_entry_reason', 'early_entry_ppe',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'application', 'rei_hours', 'rei_end_datetime',
            'posted_at', 'posted_by', 'removed_at', 'removed_by',
            'posting_compliant', 'removal_compliant',
            'created_at', 'updated_at',
        ]


REIPostingRecordListSerializer = REIPostingRecordSerializer


# -----------------------------------------------------------------------------
# COMPLIANCE REPORT SERIALIZERS
# -----------------------------------------------------------------------------

class ComplianceReportSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for compliance reports (dynamic list/detail)."""
    list_fields = [
        'id', 'report_type', 'report_type_display', 'title',
        'reporting_period_start', 'reporting_period_end', 'period_display',
        'status', 'status_display', 'record_count', 'is_valid',
        'submitted_at', 'created_at',
    ]

    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    period_display = serializers.CharField(read_only=True)
    can_submit = serializers.BooleanField(read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.get_full_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = ComplianceReport
        fields = [
            'id', 'company', 'report_type', 'report_type_display',
            'title', 'reporting_period_start', 'reporting_period_end',
            'period_display', 'status', 'status_display',
            'report_data', 'record_count', 'report_file',
            'validation_run_at', 'validation_errors', 'validation_warnings',
            'is_valid', 'can_submit',
            'submitted_at', 'submitted_by', 'submitted_by_name',
            'submission_method', 'submission_reference',
            'response_received_at', 'response_notes',
            'related_deadline', 'notes',
            'created_at', 'updated_at', 'created_by', 'created_by_name',
        ]
        read_only_fields = [
            'company', 'report_data', 'record_count', 'report_file',
            'validation_run_at', 'validation_errors', 'validation_warnings',
            'is_valid', 'submitted_at', 'submitted_by',
            'response_received_at', 'created_at', 'updated_at', 'created_by',
        ]


ComplianceReportListSerializer = ComplianceReportSerializer


# -----------------------------------------------------------------------------
# INCIDENT REPORT SERIALIZERS
# -----------------------------------------------------------------------------

class IncidentReportSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for incident reports (dynamic list/detail)."""
    list_fields = [
        'id', 'incident_type', 'incident_type_display',
        'severity', 'severity_display',
        'incident_date', 'title', 'status', 'status_display',
    ]

    incident_type_display = serializers.CharField(source='get_incident_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    days_since_incident = serializers.IntegerField(read_only=True)
    requires_authority_report = serializers.BooleanField(read_only=True)
    reported_by_name = serializers.CharField(source='reported_by.get_full_name', read_only=True)
    investigator_name = serializers.CharField(source='investigator.get_full_name', read_only=True)
    resolved_by_name = serializers.CharField(source='resolved_by.get_full_name', read_only=True)
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)

    class Meta:
        model = IncidentReport
        fields = [
            'id', 'company',
            'incident_type', 'incident_type_display',
            'severity', 'severity_display',
            'incident_date', 'reported_date',
            'days_since_incident', 'requires_authority_report',
            'farm', 'farm_name', 'field', 'field_name', 'location_description',
            'reported_by', 'reported_by_name',
            'affected_persons', 'witnesses',
            'title', 'description', 'immediate_actions',
            'related_application', 'products_involved',
            'status', 'status_display',
            'investigator', 'investigator_name',
            'root_cause', 'contributing_factors',
            'corrective_actions', 'preventive_measures',
            'reported_to_authorities', 'authority_name',
            'authority_report_date', 'authority_report_reference',
            'resolved_date', 'resolved_by', 'resolved_by_name',
            'resolution_summary', 'documents', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['company', 'reported_by', 'reported_date', 'created_at', 'updated_at']


IncidentReportListSerializer = IncidentReportSerializer


# -----------------------------------------------------------------------------
# NOTIFICATION SERIALIZERS
# -----------------------------------------------------------------------------

class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """Serializer for user notification preferences."""

    class Meta:
        model = NotificationPreference
        fields = [
            'id', 'user',
            'email_enabled', 'email_digest_frequency',
            'notify_deadlines', 'notify_licenses', 'notify_training',
            'notify_reports', 'notify_incidents', 'notify_rei',
            'deadline_reminder_days', 'license_reminder_days',
            'quiet_hours_enabled', 'quiet_hours_start', 'quiet_hours_end',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']


class NotificationLogSerializer(serializers.ModelSerializer):
    """Serializer for notification logs."""
    channel_display = serializers.CharField(source='get_channel_display', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = NotificationLog
        fields = [
            'id', 'company', 'user', 'user_email',
            'notification_type', 'channel', 'channel_display',
            'subject', 'message',
            'sent_at', 'delivered', 'delivery_error', 'read_at',
            'related_object_type', 'related_object_id',
        ]
        read_only_fields = '__all__'


# -----------------------------------------------------------------------------
# COMPLIANCE DASHBOARD SERIALIZERS
# -----------------------------------------------------------------------------

class ComplianceDashboardSerializer(serializers.Serializer):
    """Serializer for the compliance dashboard overview."""
    overall_status = serializers.CharField()
    score = serializers.IntegerField()

    summary = serializers.DictField(child=serializers.IntegerField())
    by_category = serializers.DictField()

    upcoming_deadlines = ComplianceDeadlineSerializer(many=True)
    active_alerts = ComplianceAlertSerializer(many=True)
    expiring_licenses = LicenseSerializer(many=True)
    expiring_training = WPSTrainingRecordSerializer(many=True)


class ComplianceCalendarSerializer(serializers.Serializer):
    """Serializer for calendar view data."""
    date = serializers.DateField()
    deadlines = ComplianceDeadlineSerializer(many=True)
    reports_due = ComplianceReportSerializer(many=True)
