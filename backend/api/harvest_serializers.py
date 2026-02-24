from rest_framework import serializers
from .serializer_mixins import DynamicFieldsMixin
from .models import (
    Buyer, LaborContractor, Harvest, HarvestLoad, HarvestLabor,
    CROP_VARIETY_CHOICES, DEFAULT_BIN_WEIGHTS,
)


# -----------------------------------------------------------------------------
# BUYER SERIALIZER
# -----------------------------------------------------------------------------

class BuyerSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = ['id', 'name', 'buyer_type', 'buyer_type_display', 'active']

    buyer_type_display = serializers.CharField(
        source='get_buyer_type_display',
        read_only=True
    )
    full_address = serializers.SerializerMethodField()

    class Meta:
        model = Buyer
        fields = [
            'id', 'name', 'buyer_type', 'buyer_type_display',
            'contact_name', 'phone', 'email',
            'address', 'city', 'state', 'zip_code', 'full_address',
            'license_number', 'payment_terms',
            'active', 'notes',
            'created_at', 'updated_at'
        ]

    def get_full_address(self, obj):
        parts = [obj.address, obj.city, obj.state, obj.zip_code]
        return ', '.join(p for p in parts if p)


# Backward-compatible alias
BuyerListSerializer = BuyerSerializer


# -----------------------------------------------------------------------------
# LABOR CONTRACTOR SERIALIZER
# -----------------------------------------------------------------------------

class LaborContractorSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'company_name', 'contact_name',
        'default_hourly_rate', 'default_piece_rate',
        'is_license_valid', 'food_safety_training_current', 'active'
    ]

    is_license_valid = serializers.BooleanField(read_only=True)
    is_insurance_valid = serializers.BooleanField(read_only=True)
    full_address = serializers.SerializerMethodField()

    class Meta:
        model = LaborContractor
        fields = [
            'id', 'company_name',
            'contact_name', 'phone', 'email',
            'address', 'city', 'state', 'zip_code', 'full_address',
            'contractor_license', 'license_expiration', 'is_license_valid',
            'insurance_carrier', 'insurance_policy_number',
            'insurance_expiration', 'is_insurance_valid',
            'workers_comp_carrier', 'workers_comp_policy', 'workers_comp_expiration',
            'food_safety_training_current', 'training_expiration',
            'default_hourly_rate', 'default_piece_rate',
            'active', 'notes',
            'created_at', 'updated_at'
        ]

    def get_full_address(self, obj):
        parts = [obj.address, obj.city, obj.state, obj.zip_code]
        return ', '.join(p for p in parts if p)


# Backward-compatible alias
LaborContractorListSerializer = LaborContractorSerializer


# -----------------------------------------------------------------------------
# HARVEST LOAD SERIALIZER
# -----------------------------------------------------------------------------

class HarvestLoadSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source='buyer.name', read_only=True)
    grade_display = serializers.CharField(source='get_grade_display', read_only=True)
    size_grade_display = serializers.CharField(source='get_size_grade_display', read_only=True)
    price_unit_display = serializers.CharField(source='get_price_unit_display', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)
    days_overdue = serializers.IntegerField(read_only=True)

    class Meta:
        model = HarvestLoad
        fields = [
            'id', 'harvest', 'load_number',
            'bins', 'weight_lbs', 'weight_ticket_number',
            'buyer', 'buyer_name', 'destination_address',
            'grade', 'grade_display', 'size_grade', 'size_grade_display',
            'quality_notes',
            'price_per_unit', 'price_unit', 'price_unit_display', 'total_revenue',
            'payment_status', 'payment_status_display', 'payment_date',
            'payment_due_date', 'days_overdue', 'invoice_number',
            'truck_id', 'trailer_id', 'driver_name',
            'departure_time', 'arrival_time',
            'temperature_at_loading', 'seal_number',
            'notes', 'created_at', 'updated_at'
        ]

    def validate(self, data):
        """Validate load doesn't exceed harvest total bins."""
        harvest = data.get('harvest') or (self.instance.harvest if self.instance else None)
        bins = data.get('bins', 0)

        if harvest and bins:
            # Get existing loads for this harvest (excluding current instance if updating)
            from django.db.models import Sum
            existing_bins_query = harvest.loads.all()
            if self.instance:
                existing_bins_query = existing_bins_query.exclude(pk=self.instance.pk)

            existing_bins = existing_bins_query.aggregate(total=Sum('bins'))['total'] or 0
            total_bins_with_new = existing_bins + bins

            if total_bins_with_new > harvest.total_bins:
                raise serializers.ValidationError({
                    'bins': f'Total bins in loads ({total_bins_with_new}) would exceed harvest total ({harvest.total_bins}). '
                           f'Current loads: {existing_bins} bins, attempting to add: {bins} bins.'
                })

        return data


# -----------------------------------------------------------------------------
# HARVEST LABOR SERIALIZER
# -----------------------------------------------------------------------------

class HarvestLaborSerializer(serializers.ModelSerializer):
    contractor_name = serializers.CharField(
        source='contractor.company_name',
        read_only=True
    )
    pay_type_display = serializers.CharField(source='get_pay_type_display', read_only=True)
    cost_per_bin = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True
    )

    class Meta:
        model = HarvestLabor
        fields = [
            'id', 'harvest',
            'contractor', 'contractor_name', 'crew_name', 'foreman_name',
            'worker_count',
            'start_time', 'end_time', 'total_hours',
            'pay_type', 'pay_type_display', 'rate', 'bins_picked', 'total_labor_cost',
            'cost_per_bin',
            'training_verified', 'hygiene_facilities_available', 'illness_check_performed',
            'notes', 'created_at', 'updated_at'
        ]

    def validate(self, data):
        """Validate labor bins don't exceed harvest total bins (with warning)."""
        harvest = data.get('harvest') or (self.instance.harvest if self.instance else None)
        bins_picked = data.get('bins_picked')

        if harvest and bins_picked:
            # Get existing labor for this harvest (excluding current instance if updating)
            from django.db.models import Sum
            existing_bins_query = harvest.labor_records.all()
            if self.instance:
                existing_bins_query = existing_bins_query.exclude(pk=self.instance.pk)

            existing_bins = existing_bins_query.aggregate(total=Sum('bins_picked'))['total'] or 0
            total_bins_with_new = existing_bins + bins_picked

            if total_bins_with_new > harvest.total_bins:
                raise serializers.ValidationError({
                    'bins_picked': f'Total bins in labor records ({total_bins_with_new}) would exceed harvest total ({harvest.total_bins}). '
                                  f'Current labor records: {existing_bins} bins, attempting to add: {bins_picked} bins.'
                })

        return data


# -----------------------------------------------------------------------------
# HARVEST SERIALIZER (Main)
# -----------------------------------------------------------------------------

class HarvestSerializer(serializers.ModelSerializer):
    # Read-only computed fields
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_id = serializers.IntegerField(source='field.farm.id', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    crop_variety_display = serializers.CharField(source='get_crop_variety_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    # Nested related data (read-only)
    loads = HarvestLoadSerializer(many=True, read_only=True)
    labor_records = HarvestLaborSerializer(many=True, read_only=True)

    # Calculated aggregates
    total_revenue = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    total_labor_cost = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    yield_per_acre = serializers.FloatField(read_only=True)
    load_count = serializers.SerializerMethodField()

    # PHI warning flag
    phi_warning = serializers.SerializerMethodField()

    # Commodity-aware unit fields
    primary_quantity = serializers.SerializerMethodField()
    primary_unit = serializers.SerializerMethodField()
    primary_unit_label = serializers.SerializerMethodField()

    # Reconciliation fields
    total_bins_in_loads = serializers.SerializerMethodField()
    total_bins_picked_by_labor = serializers.SerializerMethodField()
    bins_reconciliation_status = serializers.SerializerMethodField()

    class Meta:
        model = Harvest
        fields = [
            'id',
            'field', 'field_name', 'farm_id', 'farm_name',
            'harvest_date', 'harvest_number',
            'crop_variety', 'crop_variety_display',
            'acres_harvested', 'total_bins', 'bin_weight_lbs', 'estimated_weight_lbs',
            'yield_per_acre',
            'primary_quantity', 'primary_unit', 'primary_unit_label',
            # PHI fields
            'phi_verified', 'last_application_date', 'last_application_product',
            'days_since_last_application', 'phi_required_days', 'phi_compliant',
            'phi_warning',
            # GAP/GHP
            'lot_number', 'field_conditions',
            'equipment_cleaned', 'no_contamination_observed',
            'supervisor_name',
            # Status
            'status', 'status_display', 'notes',
            # Nested data
            'loads', 'labor_records',
            'load_count', 'total_revenue', 'total_labor_cost',
            # Reconciliation
            'total_bins_in_loads', 'total_bins_picked_by_labor', 'bins_reconciliation_status',
            # Timestamps
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'lot_number', 'estimated_weight_lbs',
            'last_application_date', 'last_application_product',
            'days_since_last_application', 'phi_required_days', 'phi_compliant'
        ]

    def get_load_count(self, obj):
        return obj.loads.count()

    def get_phi_warning(self, obj):
        """Return warning message if PHI may be violated."""
        if obj.phi_compliant is False:
            return (
                f"WARNING: Only {obj.days_since_last_application} days since "
                f"last application of {obj.last_application_product}. "
                f"PHI requires {obj.phi_required_days} days."
            )
        elif obj.phi_compliant is None and obj.last_application_date:
            return "PHI compliance could not be determined. Please verify manually."
        return None

    def get_primary_quantity(self, obj):
        return obj.primary_quantity

    def get_primary_unit(self, obj):
        return obj.primary_unit

    def get_primary_unit_label(self, obj):
        return obj.primary_unit_label

    def get_total_bins_in_loads(self, obj):
        """Calculate total bins across all loads."""
        return sum(load.bins for load in obj.loads.all())

    def get_total_bins_picked_by_labor(self, obj):
        """Calculate total bins picked across all labor records."""
        return sum(labor.bins_picked or 0 for labor in obj.labor_records.all())

    def get_bins_reconciliation_status(self, obj):
        """
        Return reconciliation status for bins.
        Returns: {'status': 'match'|'under'|'over', 'message': str}
        """
        total_bins = obj.total_bins
        bins_in_loads = self.get_total_bins_in_loads(obj)
        bins_picked = self.get_total_bins_picked_by_labor(obj)

        result = {
            'total_harvest_bins': total_bins,
            'total_load_bins': bins_in_loads,
            'total_labor_bins': bins_picked,
            'loads_status': 'match',
            'labor_status': 'match',
            'loads_message': None,
            'labor_message': None
        }

        # Check loads reconciliation
        if bins_in_loads > total_bins:
            result['loads_status'] = 'over'
            result['loads_message'] = f'Loads exceed harvest total by {bins_in_loads - total_bins} bins'
        elif bins_in_loads < total_bins:
            result['loads_status'] = 'under'
            result['loads_message'] = f'{total_bins - bins_in_loads} bins not yet recorded in loads'

        # Check labor reconciliation
        if bins_picked > total_bins:
            result['labor_status'] = 'over'
            result['labor_message'] = f'Labor records exceed harvest total by {bins_picked - total_bins} bins'
        elif bins_picked < total_bins:
            result['labor_status'] = 'under'
            result['labor_message'] = f'{total_bins - bins_picked} bins not yet recorded in labor'

        return result

    def validate(self, data):
        """Custom validation for harvest data."""
        # Validate acres don't exceed field total
        field = data.get('field')
        acres = data.get('acres_harvested')

        if field and acres and field.total_acres:
            if acres > field.total_acres:
                raise serializers.ValidationError({
                    'acres_harvested': f"Cannot exceed field total of {field.total_acres} acres."
                })

        return data


class HarvestListSerializer(serializers.ModelSerializer):
    """Simplified serializer for list views."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    crop_variety_display = serializers.CharField(source='get_crop_variety_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    load_count = serializers.SerializerMethodField()
    phi_compliant = serializers.BooleanField(read_only=True)
    loads = HarvestLoadSerializer(many=True, read_only=True)
    labor_records = HarvestLaborSerializer(many=True, read_only=True)

    class Meta:
        model = Harvest
        fields = [
            'id', 'field', 'field_name', 'farm_name',
            'harvest_date', 'harvest_number',
            'crop_variety', 'crop_variety_display',
            'total_bins', 'acres_harvested',
            'lot_number', 'status', 'status_display',
            'phi_compliant', 'total_revenue', 'load_count',
            'loads', 'labor_records',
            'created_at'
        ]

    def get_load_count(self, obj):
        return obj.loads.count()


# -----------------------------------------------------------------------------
# PHI CHECK SERIALIZER (for pre-harvest validation)
# -----------------------------------------------------------------------------

class PHICheckSerializer(serializers.Serializer):
    """
    Returns PHI information for a field before creating a harvest.
    Used by frontend to warn users before they save.
    """
    field_id = serializers.IntegerField()
    proposed_harvest_date = serializers.DateField()

    # Response fields
    last_application_date = serializers.DateField(read_only=True)
    last_application_product = serializers.CharField(read_only=True)
    phi_required_days = serializers.IntegerField(read_only=True)
    days_since_application = serializers.IntegerField(read_only=True)
    is_compliant = serializers.BooleanField(read_only=True)
    warning_message = serializers.CharField(read_only=True)


# -----------------------------------------------------------------------------
# HARVEST STATISTICS SERIALIZER
# -----------------------------------------------------------------------------

class HarvestStatisticsSerializer(serializers.Serializer):
    """Statistics for dashboard and reports."""
    total_harvests = serializers.IntegerField()
    total_bins = serializers.IntegerField()
    total_weight_lbs = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_acres_harvested = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_revenue = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_labor_cost = serializers.DecimalField(max_digits=14, decimal_places=2)
    avg_yield_per_acre = serializers.FloatField()
    avg_price_per_bin = serializers.DecimalField(max_digits=10, decimal_places=2)
    pending_payments = serializers.DecimalField(max_digits=14, decimal_places=2)
    phi_violations = serializers.IntegerField()

    # By crop breakdown
    by_crop = serializers.ListField(child=serializers.DictField())

    # By buyer breakdown
    by_buyer = serializers.ListField(child=serializers.DictField())
