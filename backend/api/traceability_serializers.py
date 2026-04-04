"""
Serializers for FSMA Rule 204 Traceability Module.
"""

from rest_framework import serializers
from .serializer_mixins import DynamicFieldsMixin
from .models import (
    TraceabilityLot, TraceabilityEvent, LotDisposition,
    ContaminationIncident, IncidentCorrectiveAction,
    Harvest, HarvestLoad, PackinghouseDelivery, PackoutReport,
    PesticideApplication, NutrientApplication, VisitorLog,
    FacilityCleaningLog, WaterSource,
)


# =============================================================================
# TRACEABILITY LOT
# =============================================================================

class TraceabilityLotSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'lot_number', 'product_description', 'commodity',
        'harvest_date', 'status', 'status_display',
        'field_name', 'farm_name',
        'quantity_bins', 'quantity_weight_lbs',
        'phi_compliant', 'fda_response_ready',
        'completeness_score', 'event_count',
    ]

    status_display = serializers.CharField(source='get_status_display', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True, allow_null=True)
    farm_name = serializers.CharField(source='farm.name', read_only=True, allow_null=True)
    completeness_score = serializers.IntegerField(read_only=True)
    event_count = serializers.SerializerMethodField()

    class Meta:
        model = TraceabilityLot
        fields = [
            'id', 'company', 'lot_number', 'harvest',
            'product_description', 'commodity', 'variety',
            'field', 'field_name', 'farm', 'farm_name',
            'growing_cycle', 'harvest_date',
            'quantity_bins', 'quantity_weight_lbs',
            'status', 'status_display',
            'phi_compliant', 'water_assessment_status',
            'fda_response_ready',
            'completeness_score', 'event_count',
            'notes', 'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at', 'created_by']

    def get_event_count(self, obj):
        if hasattr(obj, '_event_count'):
            return obj._event_count
        return obj.events.count()


class TraceabilityLotCreateFromHarvestSerializer(serializers.Serializer):
    """Create a TraceabilityLot from an existing Harvest record."""
    harvest_id = serializers.IntegerField()
    product_description = serializers.CharField(max_length=200)

    def validate_harvest_id(self, value):
        try:
            harvest = Harvest.objects.get(pk=value)
        except Harvest.DoesNotExist:
            raise serializers.ValidationError("Harvest not found.")
        if hasattr(harvest, 'traceability_lot'):
            raise serializers.ValidationError(
                f"Harvest already linked to lot {harvest.traceability_lot.lot_number}."
            )
        return value


# =============================================================================
# TRACEABILITY EVENT
# =============================================================================

class TraceabilityEventSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'lot', 'event_type', 'event_type_display',
        'event_date', 'location_name',
        'quantity_bins', 'quantity_weight_lbs',
        'trading_partner_name', 'reference_document_number',
    ]

    event_type_display = serializers.CharField(source='get_event_type_display', read_only=True)
    lot_number = serializers.CharField(source='lot.lot_number', read_only=True)

    class Meta:
        model = TraceabilityEvent
        fields = [
            'id', 'lot', 'lot_number',
            'event_type', 'event_type_display', 'event_date',
            'location_name', 'location_address',
            'location_gps_lat', 'location_gps_lon',
            'quantity_bins', 'quantity_weight_lbs', 'quantity_unit',
            'trading_partner_name', 'trading_partner_type',
            'truck_id', 'trailer_id', 'driver_name', 'seal_number',
            'temperature_f', 'departure_time', 'arrival_time',
            'reference_document_type', 'reference_document_number',
            'harvest_load', 'packinghouse_delivery', 'packout_report',
            'notes', 'created_at', 'created_by',
        ]
        read_only_fields = ['id', 'created_at', 'created_by']


# =============================================================================
# LOT DISPOSITION
# =============================================================================

class LotDispositionSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'lot', 'disposition_type', 'disposition_type_display',
        'disposition_date', 'quantity_bins', 'quantity_weight_lbs',
        'buyer_name', 'processor_name',
    ]

    disposition_type_display = serializers.CharField(
        source='get_disposition_type_display', read_only=True
    )
    buyer_name = serializers.CharField(source='buyer.name', read_only=True, allow_null=True)

    class Meta:
        model = LotDisposition
        fields = [
            'id', 'lot', 'disposition_type', 'disposition_type_display',
            'disposition_date',
            'quantity_bins', 'quantity_weight_lbs',
            'buyer', 'buyer_name', 'invoice_number',
            'processor_name', 'method', 'witnessed_by',
            'documentation',
            'approved_by', 'approved_at',
            'notes', 'created_at', 'created_by',
        ]
        read_only_fields = ['id', 'created_at', 'created_by']


# =============================================================================
# CONTAMINATION INCIDENT
# =============================================================================

class IncidentCorrectiveActionSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = IncidentCorrectiveAction
        fields = [
            'id', 'incident',
            'action_description', 'assigned_to',
            'status', 'status_display',
            'planned_date', 'completed_date',
            'effectiveness_verified', 'verification_date',
            'verification_notes', 'verified_by',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ContaminationIncidentSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'incident_date', 'contamination_type', 'contamination_type_display',
        'contamination_location', 'contamination_location_display',
        'status', 'status_display',
        'recall_initiated', 'lot_count',
    ]

    contamination_type_display = serializers.CharField(
        source='get_contamination_type_display', read_only=True
    )
    contamination_location_display = serializers.CharField(
        source='get_contamination_location_display', read_only=True
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    corrective_actions = IncidentCorrectiveActionSerializer(many=True, read_only=True)
    lot_count = serializers.SerializerMethodField()

    class Meta:
        model = ContaminationIncident
        fields = [
            'id', 'company',
            'lots', 'lot_count',
            'incident_date', 'reported_date',
            'contamination_type', 'contamination_type_display',
            'contamination_location', 'contamination_location_display',
            'description',
            'status', 'status_display',
            'root_cause', 'investigation_notes',
            'fda_recall_number', 'recall_initiated', 'recall_initiated_date',
            'resolved_date', 'resolution_summary',
            'corrective_actions',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at', 'created_by']

    def get_lot_count(self, obj):
        return obj.lots.count()


# =============================================================================
# FULL TRACE REPORT (read-only assembly)
# =============================================================================

class FullTraceReportSerializer(serializers.Serializer):
    """
    Assembles the complete one-step-back / one-step-forward FDA report
    for a given TraceabilityLot. Read-only.
    """
    lot = TraceabilityLotSerializer()
    one_step_back = serializers.DictField()
    critical_tracking_events = TraceabilityEventSerializer(many=True)
    one_step_forward = serializers.DictField()
    compliance = serializers.DictField()
    incidents = ContaminationIncidentSerializer(many=True)
