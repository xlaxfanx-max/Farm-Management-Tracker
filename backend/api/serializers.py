from rest_framework import serializers
from .models import (
    Farm, Field, PesticideProduct, PesticideApplication, WaterSource, WaterTest,
    Buyer, LaborContractor, Harvest, HarvestLoad, HarvestLabor,
    CROP_VARIETY_CHOICES, DEFAULT_BIN_WEIGHTS
)

class FarmSerializer(serializers.ModelSerializer):
    field_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Farm
        fields = [
            'id', 'name', 'farm_number', 'owner_name', 'operator_name',
            'address', 'county',  'gps_lat', 'gps_long', 
            'phone', 'email', 'active',
            'created_at', 'updated_at', 'field_count'
        ]
    
    def get_field_count(self, obj):
        return obj.fields.count()

class FieldSerializer(serializers.ModelSerializer):
    application_count = serializers.SerializerMethodField()
    farm_name = serializers.CharField(source='farm.name', read_only=True)  # ADDED
    
    class Meta:
        model = Field
        fields = [
            'id', 'name', 'farm', 'farm_name', 'field_number', 'county', 
            'section', 'township', 'range_value', 'gps_lat', 'gps_long', 
            'boundary_geojson', 'calculated_acres',
            'total_acres', 'current_crop', 'planting_date', 'active', 
            'created_at', 'updated_at', 'application_count'
        ]
    
    def get_application_count(self, obj):
        return obj.applications.count()


class PesticideProductSerializer(serializers.ModelSerializer):
    rei_display = serializers.SerializerMethodField()
    requires_license = serializers.BooleanField(read_only=True)
    is_high_toxicity = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = PesticideProduct
        fields = '__all__'
    
    def get_rei_display(self, obj):
        """Get REI formatted for display"""
        rei_hours = obj.get_rei_display_hours()
        if rei_hours:
            if rei_hours >= 24:
                days = int(rei_hours / 24)
                return f"{days} day{'s' if days != 1 else ''}"
            return f"{int(rei_hours)} hour{'s' if rei_hours != 1 else ''}"
        return None


class PesticideApplicationSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)
    field_crop = serializers.CharField(source='field.current_crop', read_only=True)
    field_acres = serializers.DecimalField(source='field.total_acres', max_digits=10, decimal_places=2, read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    product_epa = serializers.CharField(source='product.epa_registration_number', read_only=True)
    
    class Meta:
        model = PesticideApplication
        fields = [
            'id', 'application_date', 'start_time', 'end_time',
            'field', 'field_name', 'field_crop', 'field_acres',
            'acres_treated', 'product', 'product_name', 'product_epa',
            'amount_used', 'unit_of_measure', 'application_method',
            'target_pest', 'applicator_name',
            'temperature', 'wind_speed', 'wind_direction',
            'notes', 'status', 'submitted_to_pur', 'pur_submission_date',
            'created_at', 'updated_at'
        ]

class WaterSourceSerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    test_count = serializers.SerializerMethodField()
    next_test_due = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    latest_test_status = serializers.SerializerMethodField()
    
    class Meta:
        model = WaterSource
        fields = [
            'id', 'farm', 'farm_name', 'name', 'source_type',
            'location_description', 'used_for_irrigation', 'used_for_washing',
            'used_for_pesticide_mixing', 'fields_served', 'test_frequency_days',
            'active', 'created_at', 'updated_at', 'test_count',
            'next_test_due', 'is_overdue', 'latest_test_status'
        ]
    
    def get_test_count(self, obj):
        return obj.water_tests.count()
    
    def get_next_test_due(self, obj):
        next_due = obj.next_test_due()
        return next_due.isoformat() if next_due else None
    
    def get_is_overdue(self, obj):
        return obj.is_test_overdue()
    
    def get_latest_test_status(self, obj):
        latest = obj.water_tests.first()
        return latest.status if latest else None


class WaterTestSerializer(serializers.ModelSerializer):
    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    
    class Meta:
        model = WaterTest
        fields = [
            'id', 'water_source', 'water_source_name', 'test_date', 'test_type',
            'lab_name', 'lab_certification_number', 'ecoli_result',
            'total_coliform_result', 'ph_level', 'nitrate_level',
            'status', 'corrective_actions', 'retest_date',
            'lab_report_file', 'notes', 'recorded_by',
            'created_at', 'updated_at'
        ]
# -----------------------------------------------------------------------------
# BUYER SERIALIZER
# -----------------------------------------------------------------------------

class BuyerSerializer(serializers.ModelSerializer):
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


class BuyerListSerializer(serializers.ModelSerializer):
    """Simplified serializer for dropdowns."""
    buyer_type_display = serializers.CharField(
        source='get_buyer_type_display', 
        read_only=True
    )
    
    class Meta:
        model = Buyer
        fields = ['id', 'name', 'buyer_type', 'buyer_type_display', 'active']


# -----------------------------------------------------------------------------
# LABOR CONTRACTOR SERIALIZER
# -----------------------------------------------------------------------------

class LaborContractorSerializer(serializers.ModelSerializer):
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


class LaborContractorListSerializer(serializers.ModelSerializer):
    """Simplified serializer for dropdowns."""
    is_license_valid = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = LaborContractor
        fields = [
            'id', 'company_name', 'contact_name', 
            'default_hourly_rate', 'default_piece_rate',
            'is_license_valid', 'food_safety_training_current', 'active'
        ]


# -----------------------------------------------------------------------------
# HARVEST LOAD SERIALIZER
# -----------------------------------------------------------------------------

class HarvestLoadSerializer(serializers.ModelSerializer):
    buyer_name = serializers.CharField(source='buyer.name', read_only=True)
    grade_display = serializers.CharField(source='get_grade_display', read_only=True)
    size_grade_display = serializers.CharField(source='get_size_grade_display', read_only=True)
    price_unit_display = serializers.CharField(source='get_price_unit_display', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)
    
    class Meta:
        model = HarvestLoad
        fields = [
            'id', 'harvest', 'load_number',
            'bins', 'weight_lbs', 'weight_ticket_number',
            'buyer', 'buyer_name', 'destination_address',
            'grade', 'grade_display', 'size_grade', 'size_grade_display',
            'quality_notes',
            'price_per_unit', 'price_unit', 'price_unit_display', 'total_revenue',
            'payment_status', 'payment_status_display', 'payment_date', 'invoice_number',
            'truck_id', 'trailer_id', 'driver_name',
            'departure_time', 'arrival_time',
            'temperature_at_loading', 'seal_number',
            'notes', 'created_at', 'updated_at'
        ]


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
    
    class Meta:
        model = Harvest
        fields = [
            'id', 
            'field', 'field_name', 'farm_id', 'farm_name',
            'harvest_date', 'harvest_number',
            'crop_variety', 'crop_variety_display',
            'acres_harvested', 'total_bins', 'bin_weight_lbs', 'estimated_weight_lbs',
            'yield_per_acre',
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
    
    class Meta:
        model = Harvest
        fields = [
            'id', 'field', 'field_name', 'farm_name',
            'harvest_date', 'harvest_number',
            'crop_variety', 'crop_variety_display',
            'total_bins', 'acres_harvested',
            'lot_number', 'status', 'status_display',
            'phi_compliant', 'total_revenue', 'load_count',
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
