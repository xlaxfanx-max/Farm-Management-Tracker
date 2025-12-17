from rest_framework import serializers
from .models import (
    Farm, FarmParcel, Field, PesticideProduct, PesticideApplication, WaterSource, WaterTest,
    Buyer, LaborContractor, Harvest, HarvestLoad, HarvestLabor,
    CROP_VARIETY_CHOICES, DEFAULT_BIN_WEIGHTS,
    WellReading, MeterCalibration, WaterAllocation,
    ExtractionReport, IrrigationEvent,
    FertilizerProduct, NutrientApplication, NutrientPlan
)

class FarmParcelSerializer(serializers.ModelSerializer):
    """Full serializer for farm parcel/APN data."""
    
    class Meta:
        model = FarmParcel
        fields = [
            'id', 'farm', 'apn', 'acreage', 
            'ownership_type', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class FarmParcelListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for parcel listings."""
    
    class Meta:
        model = FarmParcel
        fields = ['id', 'apn', 'acreage', 'ownership_type']

class FarmSerializer(serializers.ModelSerializer):
    field_count = serializers.SerializerMethodField()
    parcels = FarmParcelListSerializer(many=True, read_only=True)
    apn_list = serializers.ReadOnlyField()
    parcel_count = serializers.ReadOnlyField()
    total_parcel_acreage = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    # Add properties from LocationMixin
    has_coordinates = serializers.ReadOnlyField()
    has_plss = serializers.ReadOnlyField()
    plss_display = serializers.ReadOnlyField()
    
    class Meta:
        model = Farm
        fields = [
            'id', 'name', 'farm_number', 'owner_name', 'operator_name',
            'address', 'county', 'gps_latitude', 'gps_longitude',
            'plss_section', 'plss_township', 'plss_range', 'plss_meridian',
            'has_coordinates', 'has_plss', 'plss_display',
            'phone', 'email', 'active',
            'parcels', 'apn_list', 'parcel_count', 'total_parcel_acreage',
            'created_at', 'updated_at', 'field_count'
        ]
    
    def get_field_count(self, obj):
        return obj.fields.count()

class FieldSerializer(serializers.ModelSerializer):
    application_count = serializers.SerializerMethodField()
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    # Add properties from LocationMixin
    has_coordinates = serializers.ReadOnlyField()
    has_plss = serializers.ReadOnlyField()
    plss_display = serializers.ReadOnlyField()
    
    class Meta:
        model = Field
        fields = [
            'id', 'name', 'farm', 'farm_name', 'field_number', 'county', 
            'plss_section', 'plss_township', 'plss_range', 'plss_meridian',
            'gps_latitude', 'gps_longitude',
            'has_coordinates', 'has_plss', 'plss_display',
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
    """
    Full serializer for unified WaterSource model (includes well data).
    """
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    test_count = serializers.SerializerMethodField()
    next_test_due = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    latest_test_status = serializers.SerializerMethodField()
    
    # Well-specific computed fields (only populated for source_type='well')
    is_well = serializers.ReadOnlyField()
    gsa_display = serializers.CharField(source='get_gsa_display', read_only=True)
    basin_display = serializers.CharField(source='get_basin_display', read_only=True)
    well_status_display = serializers.CharField(source='get_well_status_display', read_only=True)
    ytd_extraction_af = serializers.SerializerMethodField()
    current_year_allocation_af = serializers.SerializerMethodField()
    allocation_remaining_af = serializers.SerializerMethodField()
    latest_reading = serializers.SerializerMethodField()
    calibration_status = serializers.SerializerMethodField()
    
    # Location fields from LocationMixin
    has_coordinates = serializers.ReadOnlyField()
    has_plss = serializers.ReadOnlyField()
    plss_display = serializers.ReadOnlyField()
    effective_location = serializers.ReadOnlyField()
    effective_plss = serializers.ReadOnlyField()
    
    class Meta:
        model = WaterSource
        fields = '__all__'
    
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
    
    def get_ytd_extraction_af(self, obj):
        if obj.is_well:
            return float(obj.get_ytd_extraction_af())
        return None
    
    def get_current_year_allocation_af(self, obj):
        if obj.is_well:
            return float(obj.get_allocation_for_year())
        return None
    
    def get_allocation_remaining_af(self, obj):
        if obj.is_well:
            allocation = obj.get_allocation_for_year()
            extraction = obj.get_ytd_extraction_af()
            return float(allocation - extraction)
        return None
    
    def get_latest_reading(self, obj):
        if obj.is_well:
            reading = obj.get_latest_reading()
            if reading:
                return {
                    'date': reading.reading_date,
                    'meter_reading': float(reading.meter_reading),
                    'extraction_af': float(reading.extraction_acre_feet) if reading.extraction_acre_feet else None
                }
        return None
    
    def get_calibration_status(self, obj):
        if obj.is_well:
            return {
                'is_current': obj.meter_calibration_current,
                'next_due': obj.next_calibration_due,
                'is_due_soon': obj.is_calibration_due(days_warning=30)
            }
        return None


class WaterSourceListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for WaterSource listings."""
    
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    is_well = serializers.ReadOnlyField()
    gsa_display = serializers.CharField(source='get_gsa_display', read_only=True)
    basin_display = serializers.CharField(source='get_basin_display', read_only=True)
    well_status_display = serializers.CharField(source='get_well_status_display', read_only=True)
    ytd_extraction_af = serializers.SerializerMethodField()
    calibration_due_soon = serializers.SerializerMethodField()
    
    class Meta:
        model = WaterSource
        fields = [
            'id', 'name', 'farm', 'farm_name', 'source_type', 'is_well',
            'gsa', 'gsa_display', 'basin', 'basin_display', 
            'well_status', 'well_status_display',
            'has_flowmeter', 'flowmeter_units', 'meter_calibration_current',
            'next_calibration_due', 'calibration_due_soon', 'ytd_extraction_af',
            'registered_with_gsa', 'is_de_minimis', 'active'
        ]
    
    def get_ytd_extraction_af(self, obj):
        if obj.is_well:
            return float(obj.get_ytd_extraction_af())
        return None
    
    def get_calibration_due_soon(self, obj):
        if obj.is_well:
            return obj.is_calibration_due(days_warning=30)
        return None


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

# -----------------------------------------------------------------------------
# WELL READING SERIALIZERS (Now reference WaterSource instead of Well)
# -----------------------------------------------------------------------------

class WellReadingSerializer(serializers.ModelSerializer):
    """Full serializer for WellReading model."""
    
    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    farm_name = serializers.CharField(source='water_source.farm.name', read_only=True)
    flowmeter_units = serializers.CharField(source='water_source.flowmeter_units', read_only=True)
    reading_type_display = serializers.CharField(source='get_reading_type_display', read_only=True)
    
    class Meta:
        model = WellReading
        fields = '__all__'
        read_only_fields = [
            'previous_reading', 'previous_reading_date',
            'extraction_native_units', 'extraction_acre_feet', 'extraction_gallons'
        ]


class WellReadingCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating meter readings."""
    
    class Meta:
        model = WellReading
        fields = [
            'water_source', 'reading_date', 'reading_time', 'meter_reading',
            'reading_type', 'meter_photo', 'pump_hours', 'water_level_ft',
            'recorded_by', 'notes'
        ]
    
    def validate(self, data):
        """Validate reading is greater than previous."""
        water_source = data.get('water_source')
        meter_reading = data.get('meter_reading')
        reading_date = data.get('reading_date')
        
        if water_source and meter_reading:
            # Get the previous reading
            prev = WellReading.objects.filter(
                water_source=water_source,
                reading_date__lte=reading_date
            ).exclude(
                id=self.instance.id if self.instance else None
            ).order_by('-reading_date', '-reading_time').first()
            
            if prev and meter_reading < prev.meter_reading:
                # Allow if reading_type is 'initial' (meter replacement)
                if data.get('reading_type') != 'initial':
                    raise serializers.ValidationError({
                        'meter_reading': f'Reading ({meter_reading}) cannot be less than previous reading ({prev.meter_reading}). '
                                        f'Use reading_type "initial" if meter was replaced.'
                    })
        
        return data


class WellReadingListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for reading listings."""
    
    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    reading_type_display = serializers.CharField(source='get_reading_type_display', read_only=True)
    
    class Meta:
        model = WellReading
        fields = [
            'id', 'water_source', 'water_source_name', 'reading_date', 'reading_time',
            'meter_reading', 'extraction_acre_feet', 'extraction_gallons',
            'reading_type', 'reading_type_display', 'recorded_by'
        ]


# -----------------------------------------------------------------------------
# METER CALIBRATION SERIALIZERS (Now reference WaterSource)
# -----------------------------------------------------------------------------

class MeterCalibrationSerializer(serializers.ModelSerializer):
    """Full serializer for MeterCalibration model."""
    
    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    farm_name = serializers.CharField(source='water_source.farm.name', read_only=True)
    calibration_type_display = serializers.CharField(
        source='get_calibration_type_display', read_only=True
    )
    days_until_due = serializers.SerializerMethodField()
    
    class Meta:
        model = MeterCalibration
        fields = '__all__'
    
    def get_days_until_due(self, obj):
        if obj.next_calibration_due:
            from datetime import date
            delta = obj.next_calibration_due - date.today()
            return delta.days
        return None


class MeterCalibrationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating calibration records."""
    
    class Meta:
        model = MeterCalibration
        fields = '__all__'
    
    def validate(self, data):
        """Auto-set next_calibration_due if not provided."""
        if not data.get('next_calibration_due') and data.get('calibration_date'):
            from datetime import timedelta
            # Default to 3 years from calibration date
            data['next_calibration_due'] = data['calibration_date'] + timedelta(days=365*3)
        
        # Auto-determine passed status
        if data.get('post_calibration_accuracy') is not None:
            accuracy = abs(data['post_calibration_accuracy'])
            data['passed'] = accuracy <= 5.0  # Within +/- 5%
        
        return data


# -----------------------------------------------------------------------------
# WATER ALLOCATION SERIALIZERS
# -----------------------------------------------------------------------------

class WaterAllocationSerializer(serializers.ModelSerializer):
    """Full serializer for WaterAllocation model."""
    
    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    farm_name = serializers.CharField(source='water_source.farm.name', read_only=True)
    allocation_type_display = serializers.CharField(
        source='get_allocation_type_display', read_only=True
    )
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    
    class Meta:
        model = WaterAllocation
        fields = '__all__'


class WaterAllocationSummarySerializer(serializers.Serializer):
    """Serializer for allocation summary data."""
    
    water_year = serializers.CharField()
    water_source_id = serializers.IntegerField()
    water_source_name = serializers.CharField()
    total_allocated_af = serializers.DecimalField(max_digits=10, decimal_places=4)
    total_extracted_af = serializers.DecimalField(max_digits=10, decimal_places=4)
    remaining_af = serializers.DecimalField(max_digits=10, decimal_places=4)
    percent_used = serializers.DecimalField(max_digits=5, decimal_places=2)
    is_over_allocation = serializers.BooleanField()


# -----------------------------------------------------------------------------
# EXTRACTION REPORT SERIALIZERS (Now reference WaterSource)
# -----------------------------------------------------------------------------

class ExtractionReportSerializer(serializers.ModelSerializer):
    """Full serializer for ExtractionReport model."""
    
    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    farm_name = serializers.CharField(source='water_source.farm.name', read_only=True)
    gsa = serializers.CharField(source='water_source.gsa', read_only=True)
    gsa_display = serializers.CharField(source='water_source.get_gsa_display', read_only=True)
    period_type_display = serializers.CharField(source='get_period_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_status_display = serializers.CharField(
        source='get_payment_status_display', read_only=True
    )
    
    class Meta:
        model = ExtractionReport
        fields = '__all__'


class ExtractionReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating extraction reports."""
    
    class Meta:
        model = ExtractionReport
        fields = '__all__'
    
    def validate(self, data):
        """Validate period dates and readings."""
        water_source = data.get('water_source')
        period_start = data.get('period_start_date')
        period_end = data.get('period_end_date')
        
        if period_start and period_end and period_start >= period_end:
            raise serializers.ValidationError({
                'period_end_date': 'End date must be after start date'
            })
        
        # Auto-generate reporting_period if not provided
        if not data.get('reporting_period') and period_start:
            year = period_start.year
            if period_start.month >= 10:
                # Oct-Mar = Period 1 of next year
                data['reporting_period'] = f"{year + 1}-1"
            elif period_start.month >= 4:
                # Apr-Sep = Period 2
                data['reporting_period'] = f"{year}-2"
            else:
                # Jan-Mar = Period 1
                data['reporting_period'] = f"{year}-1"
        
        return data


class ExtractionReportListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for report listings."""
    
    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    gsa_display = serializers.CharField(source='water_source.get_gsa_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_status_display = serializers.CharField(
        source='get_payment_status_display', read_only=True
    )
    
    class Meta:
        model = ExtractionReport
        fields = [
            'id', 'water_source', 'water_source_name', 'gsa_display', 'reporting_period',
            'period_type', 'period_start_date', 'period_end_date',
            'total_extraction_af', 'period_allocation_af', 'over_allocation',
            'total_fees_due', 'status', 'status_display',
            'payment_status', 'payment_status_display', 'payment_due_date'
        ]


# -----------------------------------------------------------------------------
# IRRIGATION EVENT SERIALIZERS (Now only reference WaterSource)
# -----------------------------------------------------------------------------

class IrrigationEventSerializer(serializers.ModelSerializer):
    """Full serializer for IrrigationEvent model."""
    
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    irrigation_method_display = serializers.CharField(
        source='get_irrigation_method_display', read_only=True
    )
    measurement_method_display = serializers.CharField(
        source='get_measurement_method_display', read_only=True
    )
    
    class Meta:
        model = IrrigationEvent
        fields = '__all__'
        read_only_fields = ['duration_hours', 'acre_inches']


class IrrigationEventCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating irrigation events."""
    
    class Meta:
        model = IrrigationEvent
        fields = '__all__'
    
    def validate(self, data):
        """Ensure water_source is provided."""
        if not data.get('water_source'):
            raise serializers.ValidationError(
                'water_source must be specified'
            )
        return data


class IrrigationEventListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for irrigation event listings."""
    
    field_name = serializers.CharField(source='field.name', read_only=True)
    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    irrigation_method_display = serializers.CharField(
        source='get_irrigation_method_display', read_only=True
    )
    
    class Meta:
        model = IrrigationEvent
        fields = [
            'id', 'field', 'field_name', 'water_source', 'water_source_name',
            'irrigation_date', 'duration_hours', 'water_applied_af',
            'water_applied_gallons', 'irrigation_method', 'irrigation_method_display',
            'acres_irrigated', 'acre_inches'
        ]


# -----------------------------------------------------------------------------
# SGMA DASHBOARD SERIALIZER
# -----------------------------------------------------------------------------

class SGMADashboardSerializer(serializers.Serializer):
    """Serializer for SGMA compliance dashboard data."""
    
    # Summary stats
    total_wells = serializers.IntegerField()
    active_wells = serializers.IntegerField()
    wells_with_ami = serializers.IntegerField()
    
    # Extraction summary
    ytd_extraction_af = serializers.DecimalField(max_digits=12, decimal_places=4)
    ytd_allocation_af = serializers.DecimalField(max_digits=12, decimal_places=4)
    allocation_remaining_af = serializers.DecimalField(max_digits=12, decimal_places=4)
    percent_allocation_used = serializers.DecimalField(max_digits=5, decimal_places=2)
    
    # Current period
    current_period = serializers.CharField()
    current_period_extraction_af = serializers.DecimalField(max_digits=12, decimal_places=4)
    current_period_start = serializers.DateField()
    current_period_end = serializers.DateField()
    
    # Compliance status
    calibrations_current = serializers.IntegerField()
    calibrations_due_soon = serializers.IntegerField()
    calibrations_overdue = serializers.IntegerField()
    
    # Upcoming deadlines
    next_report_due = serializers.DateField(allow_null=True)
    next_calibration_due = serializers.DateField(allow_null=True)
    
    # Alerts
    alerts = serializers.ListField(child=serializers.DictField())
    
    # Wells by GSA
    wells_by_gsa = serializers.ListField(child=serializers.DictField())
    
    # Recent readings
    recent_readings = WellReadingListSerializer(many=True)

# =============================================================================
# NUTRIENT MANAGEMENT SERIALIZERS
# =============================================================================

class FertilizerProductSerializer(serializers.ModelSerializer):
    npk_display = serializers.ReadOnlyField()
    lbs_n_per_100lbs = serializers.ReadOnlyField()
    is_nitrogen_source = serializers.ReadOnlyField()
    
    class Meta:
        model = FertilizerProduct
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class FertilizerProductListSerializer(serializers.ModelSerializer):
    npk_display = serializers.ReadOnlyField()
    
    class Meta:
        model = FertilizerProduct
        fields = ['id', 'name', 'npk_display', 'form', 'nitrogen_pct', 'is_organic', 'active']


class NutrientApplicationSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_id = serializers.IntegerField(source='field.farm.id', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_npk = serializers.CharField(source='product.npk_display', read_only=True)
    water_source_name = serializers.CharField(source='water_source.name', read_only=True, allow_null=True)
    effective_acres = serializers.ReadOnlyField()
    rate_unit_display = serializers.CharField(source='get_rate_unit_display', read_only=True)
    application_method_display = serializers.CharField(source='get_application_method_display', read_only=True)
    
    class Meta:
        model = NutrientApplication
        fields = '__all__'
        read_only_fields = [
            'id', 'created_at', 'updated_at',
            'rate_lbs_per_acre', 'total_product_applied',
            'lbs_nitrogen_per_acre', 'total_lbs_nitrogen',
            'lbs_phosphorus_per_acre', 'lbs_potassium_per_acre',
        ]


class NutrientApplicationListSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_npk = serializers.CharField(source='product.npk_display', read_only=True)
    application_method_display = serializers.CharField(source='get_application_method_display', read_only=True)
    
    class Meta:
        model = NutrientApplication
        fields = [
            'id', 'application_date', 'field', 'field_name', 'farm_name',
            'product', 'product_name', 'product_npk', 'rate', 'rate_unit',
            'lbs_nitrogen_per_acre', 'total_lbs_nitrogen',
            'application_method', 'application_method_display', 'total_cost',
        ]


class NutrientPlanSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    field_acres = serializers.DecimalField(source='field.total_acres', max_digits=10, decimal_places=2, read_only=True)
    total_n_credits = serializers.ReadOnlyField()
    net_planned_nitrogen = serializers.ReadOnlyField()
    actual_nitrogen_applied_per_acre = serializers.ReadOnlyField()
    actual_nitrogen_applied_total = serializers.ReadOnlyField()
    nitrogen_variance_per_acre = serializers.ReadOnlyField()
    percent_of_plan_applied = serializers.ReadOnlyField()
    application_count = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = NutrientPlan
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class NutrientPlanListSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    actual_nitrogen_applied_per_acre = serializers.ReadOnlyField()
    percent_of_plan_applied = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = NutrientPlan
        fields = [
            'id', 'year', 'crop', 'field', 'field_name', 'farm_name',
            'planned_nitrogen_lbs_acre', 'actual_nitrogen_applied_per_acre',
            'percent_of_plan_applied', 'status', 'status_display',
        ]
