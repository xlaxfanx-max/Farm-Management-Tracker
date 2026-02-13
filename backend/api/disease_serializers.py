from rest_framework import serializers
from .models import (
    ExternalDetection, DiseaseAlertRule, DiseaseAnalysisRun,
    DiseaseAlert, ScoutingReport, ScoutingPhoto, TreeHealthRecord
)


class ExternalDetectionListSerializer(serializers.ModelSerializer):
    """List serializer for external detections."""
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    disease_type_display = serializers.CharField(source='get_disease_type_display', read_only=True)
    location_type_display = serializers.CharField(source='get_location_type_display', read_only=True)

    class Meta:
        model = ExternalDetection
        fields = [
            'id', 'source', 'source_display', 'source_id',
            'disease_type', 'disease_type_display', 'disease_name',
            'latitude', 'longitude', 'county', 'city',
            'location_type', 'location_type_display',
            'detection_date', 'is_active'
        ]


class ExternalDetectionSerializer(serializers.ModelSerializer):
    """Detail serializer for external detections."""
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    disease_type_display = serializers.CharField(source='get_disease_type_display', read_only=True)
    location_type_display = serializers.CharField(source='get_location_type_display', read_only=True)

    class Meta:
        model = ExternalDetection
        fields = [
            'id', 'source', 'source_display', 'source_id',
            'disease_type', 'disease_type_display', 'disease_name',
            'latitude', 'longitude', 'county', 'city',
            'location_type', 'location_type_display',
            'detection_date', 'reported_date', 'fetched_at',
            'is_active', 'eradication_date',
            'notes', 'raw_data'
        ]


class DiseaseAlertRuleSerializer(serializers.ModelSerializer):
    """Serializer for disease alert rules."""
    rule_type_display = serializers.CharField(source='get_rule_type_display', read_only=True)
    alert_priority_display = serializers.CharField(source='get_alert_priority_display', read_only=True)
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)

    class Meta:
        model = DiseaseAlertRule
        fields = [
            'id', 'company', 'name', 'description',
            'rule_type', 'rule_type_display',
            'conditions', 'alert_priority', 'alert_priority_display',
            'send_email', 'send_sms', 'send_immediately',
            'is_active', 'created_at', 'created_by', 'created_by_email'
        ]
        read_only_fields = ['company', 'created_at', 'created_by']


class DiseaseAnalysisRunListSerializer(serializers.ModelSerializer):
    """List serializer for disease analysis runs."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)

    class Meta:
        model = DiseaseAnalysisRun
        fields = [
            'id', 'field', 'field_name', 'farm_name',
            'status', 'status_display',
            'health_score', 'risk_level', 'risk_level_display',
            'total_trees_analyzed',
            'created_at', 'completed_at'
        ]


class DiseaseAnalysisRunSerializer(serializers.ModelSerializer):
    """Detail serializer for disease analysis runs."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    analysis_type_display = serializers.CharField(source='get_analysis_type_display', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    reviewed_by_email = serializers.EmailField(source='reviewed_by.email', read_only=True)

    class Meta:
        model = DiseaseAnalysisRun
        fields = [
            'id', 'company', 'field', 'field_name', 'farm_name',
            'status', 'status_display', 'error_message',
            'analysis_type', 'analysis_type_display', 'parameters',
            'avg_ndvi', 'ndvi_change_30d', 'ndvi_change_90d',
            'canopy_coverage_percent', 'canopy_change_30d',
            'total_trees_analyzed', 'trees_healthy', 'trees_mild_stress',
            'trees_moderate_stress', 'trees_severe_stress', 'trees_declining',
            'health_score', 'risk_level', 'risk_level_display',
            'risk_factors', 'anomaly_zones', 'anomaly_count', 'recommendations',
            'created_at', 'completed_at',
            'reviewed_by', 'reviewed_by_email', 'review_notes'
        ]
        read_only_fields = [
            'company', 'status', 'error_message', 'avg_ndvi',
            'ndvi_change_30d', 'ndvi_change_90d', 'canopy_coverage_percent',
            'canopy_change_30d', 'total_trees_analyzed', 'trees_healthy',
            'trees_mild_stress', 'trees_moderate_stress', 'trees_severe_stress',
            'trees_declining', 'health_score', 'risk_level', 'risk_factors',
            'anomaly_zones', 'anomaly_count', 'recommendations',
            'created_at', 'completed_at'
        ]


class DiseaseAlertListSerializer(serializers.ModelSerializer):
    """List serializer for disease alerts."""
    alert_type_display = serializers.CharField(source='get_alert_type_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)

    class Meta:
        model = DiseaseAlert
        fields = [
            'id', 'alert_type', 'alert_type_display',
            'priority', 'priority_display',
            'title', 'message',
            'farm', 'farm_name', 'field', 'field_name',
            'distance_miles',
            'is_active', 'is_acknowledged',
            'created_at'
        ]


class DiseaseAlertSerializer(serializers.ModelSerializer):
    """Detail serializer for disease alerts."""
    alert_type_display = serializers.CharField(source='get_alert_type_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    acknowledged_by_email = serializers.EmailField(source='acknowledged_by.email', read_only=True)
    related_detection_data = ExternalDetectionListSerializer(source='related_detection', read_only=True)

    class Meta:
        model = DiseaseAlert
        fields = [
            'id', 'company', 'farm', 'farm_name', 'field', 'field_name',
            'alert_type', 'alert_type_display',
            'priority', 'priority_display',
            'title', 'message',
            'distance_miles', 'related_detection', 'related_detection_data',
            'related_analysis',
            'recommended_actions', 'action_url', 'action_label',
            'is_active', 'is_acknowledged',
            'acknowledged_by', 'acknowledged_by_email', 'acknowledged_at',
            'email_sent', 'email_sent_at', 'sms_sent', 'sms_sent_at',
            'created_at', 'expires_at'
        ]
        read_only_fields = [
            'company', 'alert_type', 'priority', 'title', 'message',
            'distance_miles', 'related_detection', 'related_analysis',
            'recommended_actions', 'email_sent', 'email_sent_at',
            'sms_sent', 'sms_sent_at', 'created_at'
        ]


class ScoutingPhotoSerializer(serializers.ModelSerializer):
    """Serializer for scouting photos."""

    class Meta:
        model = ScoutingPhoto
        fields = ['id', 'image', 'caption', 'uploaded_at']
        read_only_fields = ['uploaded_at']


class ScoutingReportListSerializer(serializers.ModelSerializer):
    """List serializer for scouting reports."""
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    reported_by_name = serializers.CharField(source='reported_by.get_full_name', read_only=True)
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    photo_count = serializers.IntegerField(source='photos.count', read_only=True)

    class Meta:
        model = ScoutingReport
        fields = [
            'id', 'report_type', 'report_type_display',
            'severity', 'severity_display',
            'status', 'status_display',
            'latitude', 'longitude',
            'farm', 'farm_name', 'field', 'field_name',
            'observed_date', 'created_at',
            'reported_by', 'reported_by_name',
            'photo_count'
        ]


class ScoutingReportSerializer(serializers.ModelSerializer):
    """Detail serializer for scouting reports."""
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    ai_analysis_status_display = serializers.CharField(source='get_ai_analysis_status_display', read_only=True)
    reported_by_name = serializers.CharField(source='reported_by.get_full_name', read_only=True)
    verified_by_name = serializers.CharField(source='verified_by.get_full_name', read_only=True)
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    photos = ScoutingPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = ScoutingReport
        fields = [
            'id', 'company', 'reported_by', 'reported_by_name',
            'farm', 'farm_name', 'field', 'field_name',
            'latitude', 'longitude',
            'report_type', 'report_type_display',
            'symptoms', 'severity', 'severity_display',
            'affected_tree_count', 'notes',
            'ai_analysis_status', 'ai_analysis_status_display', 'ai_diagnosis',
            'status', 'status_display',
            'verified_by', 'verified_by_name', 'verification_notes',
            'share_anonymously', 'is_public',
            'observed_date', 'created_at', 'updated_at',
            'photos'
        ]
        read_only_fields = [
            'company', 'reported_by', 'ai_analysis_status', 'ai_diagnosis',
            'status', 'verified_by', 'verification_notes',
            'created_at', 'updated_at'
        ]


class TreeHealthRecordSerializer(serializers.ModelSerializer):
    """Serializer for tree health records."""
    health_status_display = serializers.CharField(source='get_health_status_display', read_only=True)
    ndvi_trend_display = serializers.CharField(source='get_ndvi_trend_display', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)

    class Meta:
        model = TreeHealthRecord
        fields = [
            'id', 'company', 'field', 'field_name',
            'tree_id', 'latitude', 'longitude',
            'current_ndvi', 'current_canopy_diameter_m',
            'last_updated',
            'ndvi_history', 'canopy_history',
            'ndvi_trend', 'ndvi_trend_display',
            'health_status', 'health_status_display',
            'flagged_for_inspection', 'flag_reason',
            'inspected', 'inspection_date', 'inspection_notes'
        ]
        read_only_fields = [
            'company', 'tree_id', 'latitude', 'longitude',
            'current_ndvi', 'current_canopy_diameter_m',
            'last_updated',
            'ndvi_history', 'canopy_history', 'ndvi_trend', 'health_status'
        ]
