from decimal import Decimal
from rest_framework import serializers
from .serializer_mixins import DynamicFieldsMixin
from .models import (
    UserSignature, FacilityLocation, FacilityCleaningLog,
    VisitorLog, SafetyMeeting, SafetyMeetingAttendee,
    FertilizerInventory, FertilizerInventoryTransaction, MonthlyInventorySnapshot,
    PHIComplianceCheck, AuditBinder,
    Farm, FertilizerProduct,
)


class UserSignatureSerializer(serializers.ModelSerializer):
    """Serializer for user digital signatures."""
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = UserSignature
        fields = [
            'id', 'user', 'user_email', 'user_name',
            'signature_data', 'signature_hash',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'user', 'signature_hash', 'created_at', 'updated_at']

    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.email


class FacilityLocationSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for facility locations (list fields restricted automatically)."""
    list_fields = [
        'id', 'name', 'facility_type', 'facility_type_display',
        'cleaning_frequency', 'cleaning_frequency_display',
        'farm', 'farm_name', 'is_active',
    ]

    facility_type_display = serializers.CharField(source='get_facility_type_display', read_only=True)
    cleaning_frequency_display = serializers.CharField(source='get_cleaning_frequency_display', read_only=True)
    farm_name = serializers.CharField(source='farm.name', read_only=True, allow_null=True)

    class Meta:
        model = FacilityLocation
        fields = [
            'id', 'company', 'farm', 'farm_name',
            'name', 'facility_type', 'facility_type_display',
            'description', 'cleaning_frequency', 'cleaning_frequency_display',
            'is_active', 'gps_latitude', 'gps_longitude',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at']


# Backward-compatible alias
FacilityLocationListSerializer = FacilityLocationSerializer


class FacilityCleaningLogSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for facility cleaning logs (list fields restricted automatically)."""
    list_fields = [
        'id', 'facility', 'facility_name',
        'cleaning_date', 'cleaning_time',
        'cleaned_by', 'cleaned_by_display',
        'is_signed', 'verified_at',
    ]

    facility_name = serializers.CharField(source='facility.name', read_only=True)
    cleaned_by_display = serializers.SerializerMethodField()
    verified_by_display = serializers.SerializerMethodField()
    is_signed = serializers.BooleanField(read_only=True)

    class Meta:
        model = FacilityCleaningLog
        fields = [
            'id', 'facility', 'facility_name',
            'cleaning_date', 'cleaning_time',
            'cleaned_by', 'cleaned_by_display', 'cleaned_by_name',
            'surfaces_cleaned', 'floors_cleaned', 'trash_removed',
            'sanitizer_applied', 'supplies_restocked', 'equipment_cleaned',
            'additional_checklist', 'notes',
            'signature_data', 'signature_timestamp', 'is_signed',
            'verified_by', 'verified_by_display', 'verified_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_cleaned_by_display(self, obj):
        if obj.cleaned_by:
            return f"{obj.cleaned_by.first_name} {obj.cleaned_by.last_name}".strip() or obj.cleaned_by.email
        return obj.cleaned_by_name or "Unknown"

    def get_verified_by_display(self, obj):
        if obj.verified_by:
            return f"{obj.verified_by.first_name} {obj.verified_by.last_name}".strip() or obj.verified_by.email
        return None


# Backward-compatible alias
FacilityCleaningLogListSerializer = FacilityCleaningLogSerializer


class VisitorLogSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for visitor logs (list fields restricted automatically)."""
    list_fields = [
        'id', 'farm', 'farm_name',
        'visitor_name', 'visitor_company',
        'visitor_type', 'visitor_type_display',
        'visit_date', 'time_in', 'time_out', 'duration_minutes',
        'linked_harvest', 'is_signed',
    ]

    visitor_type_display = serializers.CharField(source='get_visitor_type_display', read_only=True)
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    logged_by_display = serializers.SerializerMethodField()
    is_signed = serializers.BooleanField(read_only=True)
    duration_minutes = serializers.IntegerField(read_only=True)
    fields_visited_names = serializers.SerializerMethodField()

    class Meta:
        model = VisitorLog
        fields = [
            'id', 'company', 'farm', 'farm_name',
            'visitor_name', 'visitor_company',
            'visitor_type', 'visitor_type_display',
            'visitor_phone', 'visitor_email',
            'visit_date', 'time_in', 'time_out', 'duration_minutes',
            'purpose', 'fields_visited', 'fields_visited_names', 'areas_visited',
            'vehicle_info', 'linked_harvest', 'auto_linked',
            'health_screening_passed', 'screening_notes',
            'signature_data', 'signature_timestamp', 'is_signed',
            'logged_by', 'logged_by_display', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'logged_by', 'created_at', 'updated_at']

    def get_logged_by_display(self, obj):
        if obj.logged_by:
            return f"{obj.logged_by.first_name} {obj.logged_by.last_name}".strip() or obj.logged_by.email
        return None

    def get_fields_visited_names(self, obj):
        return [f.name for f in obj.fields_visited.all()]


# Backward-compatible alias
VisitorLogListSerializer = VisitorLogSerializer


class VisitorQuickEntrySerializer(serializers.Serializer):
    """Serializer for quick visitor entry (sign-in kiosk mode)."""
    farm = serializers.PrimaryKeyRelatedField(queryset=Farm.objects.all())
    visitor_name = serializers.CharField(max_length=150)
    visitor_company = serializers.CharField(max_length=150, required=False, allow_blank=True)
    visitor_type = serializers.ChoiceField(
        choices=[
            ('harvester', 'Harvest Crew'),
            ('buyer', 'Buyer/Inspector'),
            ('contractor', 'Contractor'),
            ('vendor', 'Vendor/Supplier'),
            ('government', 'Government Inspector'),
            ('auditor', 'Auditor'),
            ('consultant', 'Consultant/PCA'),
            ('delivery', 'Delivery Personnel'),
            ('maintenance', 'Maintenance'),
            ('visitor', 'General Visitor'),
            ('other', 'Other'),
        ]
    )
    purpose = serializers.CharField(required=False, allow_blank=True)
    signature_data = serializers.CharField(required=False, allow_blank=True)


class SafetyMeetingAttendeeSerializer(serializers.ModelSerializer):
    """Serializer for meeting attendees."""
    is_signed = serializers.BooleanField(read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True, allow_null=True)

    class Meta:
        model = SafetyMeetingAttendee
        fields = [
            'id', 'meeting', 'user', 'user_email',
            'attendee_name', 'employee_id', 'department',
            'signature_data', 'signed_at', 'is_signed',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SafetyMeetingSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for safety meetings (list fields restricted automatically)."""
    list_fields = [
        'id', 'meeting_type', 'meeting_type_display',
        'meeting_date', 'meeting_time', 'location',
        'quarter', 'year', 'trainer_name',
        'attendee_count', 'signed_count',
    ]

    meeting_type_display = serializers.CharField(source='get_meeting_type_display', read_only=True)
    conducted_by_display = serializers.SerializerMethodField()
    attendees = SafetyMeetingAttendeeSerializer(many=True, read_only=True)
    attendee_count = serializers.SerializerMethodField()
    signed_count = serializers.SerializerMethodField()

    class Meta:
        model = SafetyMeeting
        fields = [
            'id', 'company', 'meeting_type', 'meeting_type_display',
            'meeting_date', 'meeting_time', 'location',
            'topics_covered', 'description', 'duration_minutes',
            'quarter', 'year',
            'trainer_name', 'trainer_credentials', 'materials_provided',
            'conducted_by', 'conducted_by_display',
            'attendees', 'attendee_count', 'signed_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'conducted_by', 'created_at', 'updated_at']

    def get_conducted_by_display(self, obj):
        if obj.conducted_by:
            return f"{obj.conducted_by.first_name} {obj.conducted_by.last_name}".strip() or obj.conducted_by.email
        return None

    def get_attendee_count(self, obj):
        return obj.attendees.count()

    def get_signed_count(self, obj):
        return obj.attendees.exclude(signature_data='').count()


# Backward-compatible alias
SafetyMeetingListSerializer = SafetyMeetingSerializer


class FertilizerInventorySerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for fertilizer inventory (list fields restricted automatically)."""
    list_fields = [
        'id', 'product', 'product_name',
        'quantity_on_hand', 'unit', 'reorder_point',
        'is_low_stock', 'storage_location',
    ]

    product_name = serializers.CharField(source='product.name', read_only=True)
    product_npk = serializers.SerializerMethodField()
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = FertilizerInventory
        fields = [
            'id', 'company', 'product', 'product_name', 'product_npk',
            'quantity_on_hand', 'unit', 'reorder_point',
            'storage_location', 'lot_number', 'expiration_date',
            'is_low_stock', 'last_updated', 'created_at'
        ]
        read_only_fields = ['id', 'company', 'last_updated', 'created_at']

    def get_product_npk(self, obj):
        p = obj.product
        return f"{p.nitrogen_pct}-{p.phosphorus_pct}-{p.potassium_pct}"


# Backward-compatible alias
FertilizerInventoryListSerializer = FertilizerInventorySerializer


class FertilizerInventoryTransactionSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for inventory transactions (list fields restricted automatically)."""
    list_fields = [
        'id', 'inventory', 'product_name',
        'transaction_type', 'transaction_type_display',
        'quantity', 'balance_after', 'transaction_date',
    ]

    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)
    product_name = serializers.CharField(source='inventory.product.name', read_only=True)
    created_by_display = serializers.SerializerMethodField()

    class Meta:
        model = FertilizerInventoryTransaction
        fields = [
            'id', 'inventory', 'product_name',
            'transaction_type', 'transaction_type_display',
            'quantity', 'balance_after', 'transaction_date',
            'nutrient_application', 'supplier', 'invoice_number',
            'cost_per_unit', 'total_cost', 'notes',
            'created_by', 'created_by_display', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_created_by_display(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.email
        return None


# Backward-compatible alias
FertilizerInventoryTransactionListSerializer = FertilizerInventoryTransactionSerializer


class InventoryPurchaseSerializer(serializers.Serializer):
    """Serializer for recording a fertilizer purchase."""
    product = serializers.PrimaryKeyRelatedField(queryset=FertilizerProduct.objects.all())
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    unit = serializers.CharField(max_length=20, default='lbs')
    supplier = serializers.CharField(max_length=150, required=False, allow_blank=True)
    invoice_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    cost_per_unit = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    lot_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    expiration_date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class InventoryAdjustmentSerializer(serializers.Serializer):
    """Serializer for manual inventory adjustments."""
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2)
    reason = serializers.CharField(max_length=500)


class MonthlyInventorySnapshotSerializer(serializers.ModelSerializer):
    """Serializer for monthly inventory snapshots."""

    class Meta:
        model = MonthlyInventorySnapshot
        fields = [
            'id', 'company', 'month', 'year',
            'inventory_data', 'total_products', 'total_value', 'low_stock_count',
            'generated_at'
        ]
        read_only_fields = ['id', 'company', 'generated_at']


class PHIComplianceCheckSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for PHI compliance checks (list fields restricted automatically)."""
    list_fields = [
        'id', 'harvest', 'harvest_date', 'field_name',
        'status', 'status_display',
        'earliest_safe_harvest', 'warning_count', 'checked_at',
    ]

    status_display = serializers.CharField(source='get_status_display', read_only=True)
    harvest_date = serializers.DateField(source='harvest.harvest_date', read_only=True)
    field_name = serializers.CharField(source='harvest.field.name', read_only=True)
    warning_count = serializers.SerializerMethodField()
    override_by_display = serializers.SerializerMethodField()

    class Meta:
        model = PHIComplianceCheck
        fields = [
            'id', 'harvest', 'harvest_date', 'field_name',
            'status', 'status_display',
            'applications_checked', 'warnings', 'earliest_safe_harvest',
            'warning_count',
            'override_reason', 'override_by', 'override_by_display', 'override_at',
            'checked_at', 'updated_at'
        ]
        read_only_fields = ['id', 'harvest', 'checked_at', 'updated_at']

    def get_warning_count(self, obj):
        return len(obj.warnings) if obj.warnings else 0

    def get_override_by_display(self, obj):
        if obj.override_by:
            return f"{obj.override_by.first_name} {obj.override_by.last_name}".strip() or obj.override_by.email
        return None


# Backward-compatible alias
PHIComplianceCheckListSerializer = PHIComplianceCheckSerializer


class PHIPreCheckSerializer(serializers.Serializer):
    """Serializer for pre-harvest PHI check request."""
    field_id = serializers.IntegerField()
    proposed_harvest_date = serializers.DateField()


class AuditBinderSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """Serializer for audit binders (list fields restricted automatically)."""
    list_fields = [
        'id', 'date_range_start', 'date_range_end',
        'status', 'status_display',
        'page_count', 'file_size',
        'generated_by', 'generated_by_display', 'created_at',
    ]

    status_display = serializers.CharField(source='get_status_display', read_only=True)
    generated_by_display = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    generation_duration_seconds = serializers.FloatField(read_only=True)

    class Meta:
        model = AuditBinder
        fields = [
            'id', 'company', 'date_range_start', 'date_range_end',
            'include_visitor_logs', 'include_cleaning_logs',
            'include_safety_meetings', 'include_fertilizer_inventory',
            'include_phi_reports', 'include_harvest_records',
            'include_primus_audits', 'include_primus_findings',
            'farm_ids', 'pdf_file', 'pdf_url', 'file_size', 'page_count',
            'status', 'status_display', 'error_message',
            'generation_started', 'generation_completed', 'generation_duration_seconds',
            'generated_by', 'generated_by_display', 'notes', 'created_at'
        ]
        read_only_fields = [
            'id', 'company', 'pdf_file', 'file_size', 'page_count',
            'status', 'error_message', 'generation_started', 'generation_completed',
            'generated_by', 'created_at'
        ]

    def get_generated_by_display(self, obj):
        if obj.generated_by:
            return f"{obj.generated_by.first_name} {obj.generated_by.last_name}".strip() or obj.generated_by.email
        return None

    def get_pdf_url(self, obj):
        if obj.pdf_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None


# Backward-compatible alias
AuditBinderListSerializer = AuditBinderSerializer


class AuditBinderGenerateSerializer(serializers.Serializer):
    """Serializer for audit binder generation request."""
    date_range_start = serializers.DateField()
    date_range_end = serializers.DateField()
    include_visitor_logs = serializers.BooleanField(default=True)
    include_cleaning_logs = serializers.BooleanField(default=True)
    include_safety_meetings = serializers.BooleanField(default=True)
    include_fertilizer_inventory = serializers.BooleanField(default=True)
    include_phi_reports = serializers.BooleanField(default=True)
    include_harvest_records = serializers.BooleanField(default=True)
    include_primus_audits = serializers.BooleanField(default=True)
    include_primus_findings = serializers.BooleanField(default=True)
    farm_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list
    )
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if data['date_range_start'] > data['date_range_end']:
            raise serializers.ValidationError(
                {'date_range_end': 'End date must be after start date'}
            )
        return data


class FSMADashboardSerializer(serializers.Serializer):
    """Serializer for FSMA compliance dashboard data."""
    overall_compliance_score = serializers.IntegerField()
    overall_status = serializers.CharField()

    # Today's status
    facilities_cleaned_today = serializers.IntegerField()
    facilities_requiring_cleaning = serializers.IntegerField()
    visitors_logged_today = serializers.IntegerField()
    phi_issues_pending = serializers.IntegerField()

    # Compliance metrics
    quarterly_meeting_status = serializers.DictField()
    cleaning_compliance_rate = serializers.FloatField()
    visitor_log_compliance_rate = serializers.FloatField()

    # Alerts
    low_inventory_count = serializers.IntegerField()
    upcoming_expirations = serializers.ListField()
    recent_activity = serializers.ListField()
