from rest_framework import serializers
from .models import (
    Company, Farm, FarmParcel, Field, PesticideProduct, PesticideApplication, WaterSource, WaterTest,
    Buyer, LaborContractor, Harvest, HarvestLoad, HarvestLabor,
    CROP_VARIETY_CHOICES, DEFAULT_BIN_WEIGHTS,
    WellReading, MeterCalibration, WaterAllocation,
    ExtractionReport, IrrigationEvent,
    FertilizerProduct, NutrientApplication, NutrientPlan,
    QuarantineStatus,
    IrrigationZone, CropCoefficientProfile, CIMISDataCache,
    IrrigationRecommendation, SoilMoistureReading,
    Crop, Rootstock, CropCategory, CropType,
    SatelliteImage, TreeDetectionRun, DetectedTree,
    LiDARDataset, LiDARProcessingRun, LiDARDetectedTree, TerrainAnalysis,
    Tree, TreeObservation, TreeMatchingRun, TreeFeedback,
    # Packinghouse Pool Tracking
    Packinghouse, Pool, PackinghouseDelivery,
    PackoutReport, PackoutGradeLine,
    PoolSettlement, SettlementGradeLine, SettlementDeduction,
    GrowerLedgerEntry, PackinghouseStatement,
)

# =============================================================================
# CROP & ROOTSTOCK SERIALIZERS
# =============================================================================

class CropListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for crop dropdowns/lists."""
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Crop
        fields = ['id', 'name', 'variety', 'display_name', 'category', 'crop_type']

    def get_display_name(self, obj):
        if obj.variety:
            return f"{obj.name} ({obj.variety})"
        return obj.name


class CropSerializer(serializers.ModelSerializer):
    """Full serializer for Crop model."""
    is_system_default = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    crop_type_display = serializers.CharField(source='get_crop_type_display', read_only=True)

    class Meta:
        model = Crop
        fields = [
            'id', 'name', 'scientific_name', 'variety',
            'category', 'category_display', 'crop_type', 'crop_type_display',
            'typical_spacing_row_ft', 'typical_spacing_tree_ft',
            'typical_root_depth_inches', 'years_to_maturity',
            'productive_lifespan_years',
            'kc_mature', 'kc_young',
            'typical_harvest_months', 'default_bin_weight_lbs',
            'company', 'active', 'notes',
            'is_system_default',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_is_system_default(self, obj):
        return obj.company is None


class RootstockListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for rootstock dropdowns."""
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = Rootstock
        fields = ['id', 'name', 'code', 'display_name', 'primary_category', 'vigor']

    def get_display_name(self, obj):
        if obj.code:
            return f"{obj.name} ({obj.code})"
        return obj.name


class RootstockSerializer(serializers.ModelSerializer):
    """Full serializer for Rootstock model."""
    compatible_crop_ids = serializers.PrimaryKeyRelatedField(
        source='compatible_crops',
        queryset=Crop.objects.all(),
        many=True,
        required=False
    )
    is_system_default = serializers.SerializerMethodField()
    primary_category_display = serializers.CharField(source='get_primary_category_display', read_only=True)

    class Meta:
        model = Rootstock
        fields = [
            'id', 'name', 'code', 'primary_category', 'primary_category_display',
            'vigor', 'disease_resistance', 'soil_tolerance',
            'cold_hardiness', 'drought_tolerance',
            'compatible_crop_ids',
            'company', 'active', 'notes',
            'is_system_default',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_is_system_default(self, obj):
        return obj.company is None


# =============================================================================
# COMPANY SERIALIZERS
# =============================================================================

class CompanySerializer(serializers.ModelSerializer):
    """
    Serializer for Company model.
    Used for company settings page and company management.
    """
    
    # Computed fields
    farm_count = serializers.ReadOnlyField()
    user_count = serializers.ReadOnlyField()
    county_display = serializers.ReadOnlyField()
    
    class Meta:
        model = Company
        fields = [
            # Identification
            'id', 'uuid', 'name', 'legal_name',
            
            # Contact Information
            'primary_contact_name', 'phone', 'email',
            
            # Address
            'address', 'city', 'county', 'county_display', 'state', 'zip_code',
            
            # Business/Regulatory IDs
            'operator_id', 'business_license',
            'pca_license', 'qal_license', 'qac_license',
            'federal_tax_id', 'state_tax_id',
            
            # Additional info
            'website', 'notes',
            'primary_crop', 'estimated_total_acres',
            
            # Subscription
            'subscription_tier', 'subscription_start', 'subscription_end',
            'max_farms', 'max_users',
            
            # Computed counts
            'farm_count', 'user_count',
            
            # Onboarding
            'onboarding_completed', 'onboarding_step', 'onboarding_completed_at',
            
            # Status
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'uuid', 
            'farm_count', 'user_count', 'county_display',
            'subscription_tier', 'subscription_start', 'subscription_end',
            'max_farms', 'max_users',
            'onboarding_completed', 'onboarding_step', 'onboarding_completed_at',
            'is_active', 'created_at', 'updated_at',
        ]


class CompanyListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for company listings.
    Used when showing list of companies user belongs to.
    """
    
    farm_count = serializers.ReadOnlyField()
    user_count = serializers.ReadOnlyField()
    
    class Meta:
        model = Company
        fields = [
            'id', 'uuid', 'name', 'county', 
            'subscription_tier', 'farm_count', 'user_count',
            'is_active',
        ]

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

    # Crop/Rootstock nested data
    crop_name = serializers.CharField(source='crop.name', read_only=True, allow_null=True)
    crop_detail = CropListSerializer(source='crop', read_only=True)
    rootstock_name = serializers.CharField(source='rootstock.name', read_only=True, allow_null=True)
    rootstock_detail = RootstockListSerializer(source='rootstock', read_only=True)

    # Computed properties
    crop_age_years = serializers.ReadOnlyField()
    calculated_trees_per_acre = serializers.ReadOnlyField()

    # Display fields for choices
    row_orientation_display = serializers.CharField(source='get_row_orientation_display', read_only=True)
    trellis_system_display = serializers.CharField(source='get_trellis_system_display', read_only=True)
    soil_type_display = serializers.CharField(source='get_soil_type_display', read_only=True)
    irrigation_type_display = serializers.CharField(source='get_irrigation_type_display', read_only=True)
    organic_status_display = serializers.CharField(source='get_organic_status_display', read_only=True)

    class Meta:
        model = Field
        fields = [
            'id', 'name', 'farm', 'farm_name', 'field_number', 'county',
            'plss_section', 'plss_township', 'plss_range', 'plss_meridian',
            'gps_latitude', 'gps_longitude',
            'has_coordinates', 'has_plss', 'plss_display',
            'boundary_geojson', 'calculated_acres',
            'total_acres',
            # Legacy crop field (for backward compatibility)
            'current_crop',
            # New crop fields
            'crop', 'crop_name', 'crop_detail',
            'rootstock', 'rootstock_name', 'rootstock_detail',
            # Planting data
            'planting_date', 'year_planted',
            # Spacing & density
            'row_spacing_ft', 'tree_spacing_ft', 'tree_count', 'trees_per_acre',
            'crop_age_years', 'calculated_trees_per_acre',
            # Orientation & trellis
            'row_orientation', 'row_orientation_display',
            'trellis_system', 'trellis_system_display',
            # Soil & irrigation
            'soil_type', 'soil_type_display',
            'irrigation_type', 'irrigation_type_display',
            # Production
            'expected_yield_per_acre', 'yield_unit',
            # Certification
            'organic_status', 'organic_status_display',
            'organic_certifier', 'organic_cert_number', 'organic_cert_expiration',
            # Satellite tree detection data
            'latest_satellite_tree_count', 'latest_satellite_trees_per_acre',
            'satellite_canopy_coverage_percent', 'latest_detection_date',
            'latest_detection_run',
            # Notes & status
            'notes', 'active',
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


# =============================================================================
# QUARANTINE STATUS SERIALIZERS
# =============================================================================

class QuarantineStatusSerializer(serializers.ModelSerializer):
    """
    Full serializer for QuarantineStatus model.
    Used for quarantine check results.
    """
    # Read-only computed fields
    target_name = serializers.ReadOnlyField()
    target_type = serializers.ReadOnlyField()
    status_display = serializers.ReadOnlyField()
    is_stale = serializers.ReadOnlyField()
    quarantine_type_display = serializers.CharField(
        source='get_quarantine_type_display',
        read_only=True
    )

    # Related names
    farm_name = serializers.CharField(source='farm.name', read_only=True, allow_null=True)
    field_name = serializers.CharField(source='field.name', read_only=True, allow_null=True)

    class Meta:
        model = QuarantineStatus
        fields = [
            'id',
            'farm', 'farm_name',
            'field', 'field_name',
            'quarantine_type', 'quarantine_type_display',
            'in_quarantine', 'zone_name',
            'last_checked', 'last_changed',
            'check_latitude', 'check_longitude',
            'error_message',
            'target_name', 'target_type', 'status_display', 'is_stale',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'last_checked', 'last_changed',
            'created_at', 'updated_at',
        ]


class QuarantineStatusListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for quarantine status listings.
    """
    target_name = serializers.ReadOnlyField()
    target_type = serializers.ReadOnlyField()
    status_display = serializers.ReadOnlyField()
    quarantine_type_display = serializers.CharField(
        source='get_quarantine_type_display',
        read_only=True
    )

    class Meta:
        model = QuarantineStatus
        fields = [
            'id',
            'farm', 'field',
            'target_name', 'target_type',
            'quarantine_type', 'quarantine_type_display',
            'in_quarantine', 'zone_name',
            'status_display', 'last_checked',
            'error_message',
        ]


# =============================================================================
# IRRIGATION SCHEDULING SERIALIZERS
# =============================================================================

class CropCoefficientProfileSerializer(serializers.ModelSerializer):
    """Serializer for crop coefficient (Kc) profiles."""

    zone_name = serializers.CharField(source='zone.name', read_only=True, allow_null=True)
    is_default = serializers.SerializerMethodField()

    class Meta:
        model = CropCoefficientProfile
        fields = [
            'id', 'zone', 'zone_name', 'crop_type', 'growth_stage',
            'kc_jan', 'kc_feb', 'kc_mar', 'kc_apr', 'kc_may', 'kc_jun',
            'kc_jul', 'kc_aug', 'kc_sep', 'kc_oct', 'kc_nov', 'kc_dec',
            'notes', 'is_default',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_is_default(self, obj):
        """Check if this is a system default profile (no zone assigned)."""
        return obj.zone is None


class CIMISDataSerializer(serializers.ModelSerializer):
    """Serializer for cached CIMIS weather data."""

    class Meta:
        model = CIMISDataCache
        fields = [
            'id', 'date', 'source_id', 'data_source',
            'eto', 'precipitation',
            'air_temp_avg', 'air_temp_max', 'air_temp_min',
            'eto_qc', 'fetched_at',
        ]
        read_only_fields = ['id', 'fetched_at']


class SoilMoistureReadingSerializer(serializers.ModelSerializer):
    """Serializer for soil moisture sensor readings."""

    zone_name = serializers.CharField(source='zone.name', read_only=True)
    field_name = serializers.CharField(source='zone.field.name', read_only=True)
    depletion_pct = serializers.SerializerMethodField()

    class Meta:
        model = SoilMoistureReading
        fields = [
            'id', 'zone', 'zone_name', 'field_name',
            'reading_datetime', 'sensor_id', 'sensor_depth_inches',
            'volumetric_water_content', 'soil_tension_cb',
            'depletion_pct', 'notes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_depletion_pct(self, obj):
        """Calculate depletion percentage if VWC is available."""
        if obj.volumetric_water_content and obj.zone:
            # Assume field capacity is around 35% VWC for typical soils
            field_capacity = 35.0
            wilting_point = 15.0
            vwc = float(obj.volumetric_water_content)
            if vwc >= field_capacity:
                return 0.0
            elif vwc <= wilting_point:
                return 100.0
            return round(((field_capacity - vwc) / (field_capacity - wilting_point)) * 100, 1)
        return None


class IrrigationRecommendationSerializer(serializers.ModelSerializer):
    """Serializer for irrigation recommendations."""

    zone_name = serializers.CharField(source='zone.name', read_only=True)
    field_name = serializers.CharField(source='zone.field.name', read_only=True)
    farm_name = serializers.CharField(source='zone.field.farm.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    satellite_adjustment = serializers.SerializerMethodField()

    class Meta:
        model = IrrigationRecommendation
        fields = [
            'id', 'zone', 'zone_name', 'field_name', 'farm_name',
            'recommended_date', 'recommended_depth_inches', 'recommended_duration_hours',
            'days_since_last_irrigation', 'cumulative_etc', 'effective_rainfall',
            'soil_moisture_depletion_pct',
            'status', 'status_display',
            'calculation_details', 'satellite_adjustment',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_satellite_adjustment(self, obj):
        """Extract satellite adjustment details from calculation_details."""
        if not obj.calculation_details:
            return None
        return obj.calculation_details.get('satellite_adjustment')


class IrrigationRecommendationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for recommendation listings."""

    zone_name = serializers.CharField(source='zone.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = IrrigationRecommendation
        fields = [
            'id', 'zone', 'zone_name',
            'recommended_date', 'recommended_depth_inches', 'recommended_duration_hours',
            'soil_moisture_depletion_pct', 'status', 'status_display',
            'created_at',
        ]


class IrrigationZoneSerializer(serializers.ModelSerializer):
    """Full serializer for irrigation zones."""

    # Related object names
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_id = serializers.IntegerField(source='field.farm.id', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    water_source_name = serializers.CharField(source='water_source.name', read_only=True, allow_null=True)

    # Computed fields
    soil_capacity_inches = serializers.SerializerMethodField()
    mad_threshold_inches = serializers.SerializerMethodField()

    class Meta:
        model = IrrigationZone
        fields = [
            'id', 'name', 'field', 'field_name', 'farm_id', 'farm_name',
            'water_source', 'water_source_name',
            'acres', 'crop_type', 'tree_age', 'tree_spacing_ft',
            'irrigation_method', 'emitters_per_tree', 'emitter_gph',
            'application_rate', 'distribution_uniformity',
            'soil_type', 'soil_water_holding_capacity', 'root_depth_inches',
            'management_allowable_depletion',
            'cimis_target', 'cimis_target_type',
            # Satellite Kc adjustment configuration
            'use_satellite_kc_adjustment', 'reference_canopy_coverage',
            'ndvi_stress_modifier_enabled', 'ndvi_healthy_threshold', 'ndvi_stress_multiplier',
            'soil_capacity_inches', 'mad_threshold_inches',
            'active', 'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_soil_capacity_inches(self, obj):
        """Calculate total soil water holding capacity in inches."""
        whc = float(obj.soil_water_holding_capacity or 1.5)
        root_depth = float(obj.root_depth_inches or 36)
        return whc * (root_depth / 12)

    def get_mad_threshold_inches(self, obj):
        """Calculate MAD threshold in inches."""
        capacity = self.get_soil_capacity_inches(obj)
        mad_pct = obj.management_allowable_depletion or 50
        return float(capacity * (mad_pct / 100))


class IrrigationZoneListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for zone listings."""

    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)

    class Meta:
        model = IrrigationZone
        fields = [
            'id', 'name', 'field', 'field_name', 'farm_name',
            'acres', 'crop_type', 'irrigation_method',
            'cimis_target', 'active',
        ]


class IrrigationZoneDetailSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for irrigation zone with nested relationships.
    Includes recent events, current recommendation, and Kc profile.
    """

    # Related object names
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_id = serializers.IntegerField(source='field.farm.id', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    water_source_name = serializers.CharField(source='water_source.name', read_only=True, allow_null=True)

    # Nested relationships
    kc_profiles = CropCoefficientProfileSerializer(many=True, read_only=True)
    recent_events = serializers.SerializerMethodField()
    recent_recommendations = serializers.SerializerMethodField()
    current_recommendation = serializers.SerializerMethodField()

    # Computed status
    zone_status = serializers.SerializerMethodField()
    soil_capacity_inches = serializers.SerializerMethodField()
    mad_threshold_inches = serializers.SerializerMethodField()

    class Meta:
        model = IrrigationZone
        fields = [
            'id', 'name', 'field', 'field_name', 'farm_id', 'farm_name',
            'water_source', 'water_source_name',
            'acres', 'crop_type', 'tree_age', 'tree_spacing_ft',
            'irrigation_method', 'emitters_per_tree', 'emitter_gph',
            'application_rate', 'distribution_uniformity',
            'soil_type', 'soil_water_holding_capacity', 'root_depth_inches',
            'management_allowable_depletion',
            'cimis_target', 'cimis_target_type',
            'soil_capacity_inches', 'mad_threshold_inches',
            'active', 'notes',
            # Nested data
            'kc_profiles', 'recent_events', 'recent_recommendations', 'current_recommendation',
            'zone_status',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_soil_capacity_inches(self, obj):
        """Calculate total soil water holding capacity in inches."""
        whc = float(obj.soil_water_holding_capacity or 1.5)
        root_depth = float(obj.root_depth_inches or 36)
        return whc * (root_depth / 12)

    def get_mad_threshold_inches(self, obj):
        """Calculate MAD threshold in inches."""
        capacity = self.get_soil_capacity_inches(obj)
        mad_pct = obj.management_allowable_depletion or 50
        return float(capacity * (mad_pct / 100))

    def get_recent_events(self, obj):
        """Get last 5 irrigation events for this zone."""
        events = obj.irrigation_events.order_by('-date')[:5]
        return IrrigationZoneEventSerializer(events, many=True).data

    def get_recent_recommendations(self, obj):
        """Get last 5 recommendations for this zone."""
        recs = obj.recommendations.order_by('-created_at')[:5]
        return IrrigationRecommendationListSerializer(recs, many=True).data

    def get_current_recommendation(self, obj):
        """Get the current pending recommendation if any."""
        rec = obj.recommendations.filter(status='pending').order_by('-created_at').first()
        if rec:
            return IrrigationRecommendationSerializer(rec).data
        return None

    def get_zone_status(self, obj):
        """Calculate current irrigation status for the zone."""
        from .services.irrigation_scheduler import IrrigationScheduler
        try:
            scheduler = IrrigationScheduler(obj)
            return scheduler.get_zone_status_summary()
        except Exception as e:
            return {
                'status': 'error',
                'status_label': 'Unable to calculate',
                'error': str(e),
            }


class IrrigationZoneEventSerializer(serializers.ModelSerializer):
    """
    Serializer for irrigation events linked to a zone.
    Used for zone-based irrigation tracking.
    """

    zone_name = serializers.CharField(source='zone.name', read_only=True, allow_null=True)
    field_name = serializers.CharField(source='zone.field.name', read_only=True, allow_null=True)
    method_display = serializers.CharField(source='get_method_display', read_only=True)

    class Meta:
        model = IrrigationEvent
        fields = [
            'id', 'zone', 'zone_name', 'field_name',
            'date', 'depth_inches', 'duration_hours',
            'method', 'method_display',
            'source', 'notes',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class IrrigationZoneEventCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating irrigation events on a zone."""

    class Meta:
        model = IrrigationEvent
        fields = [
            'zone', 'date', 'depth_inches', 'duration_hours',
            'method', 'source', 'notes',
        ]

    def validate(self, data):
        """Validate zone is provided and calculate depth if needed."""
        zone = data.get('zone')
        if not zone:
            raise serializers.ValidationError({
                'zone': 'Irrigation zone is required.'
            })

        # If duration provided but not depth, calculate from application rate
        if data.get('duration_hours') and not data.get('depth_inches'):
            if zone.application_rate:
                from decimal import Decimal
                data['depth_inches'] = Decimal(str(data['duration_hours'])) * zone.application_rate

        return data


class IrrigationDashboardSerializer(serializers.Serializer):
    """Serializer for irrigation dashboard summary data."""

    # Zone summary
    total_zones = serializers.IntegerField()
    active_zones = serializers.IntegerField()
    zones_needing_irrigation = serializers.IntegerField()
    zones_irrigation_soon = serializers.IntegerField()

    # Aggregate stats
    total_acres = serializers.DecimalField(max_digits=10, decimal_places=2)
    avg_depletion_pct = serializers.DecimalField(max_digits=5, decimal_places=1)

    # Weather data
    recent_eto_total = serializers.DecimalField(max_digits=6, decimal_places=3, allow_null=True)
    recent_rainfall_total = serializers.DecimalField(max_digits=6, decimal_places=3, allow_null=True)

    # Zone statuses
    zones = IrrigationZoneListSerializer(many=True)
    zones_by_status = serializers.DictField()

    # Upcoming recommendations
    pending_recommendations = IrrigationRecommendationListSerializer(many=True)

    # Recent irrigation events
    recent_events = IrrigationZoneEventSerializer(many=True)


# =============================================================================
# SATELLITE IMAGERY & TREE DETECTION SERIALIZERS
# =============================================================================

class SatelliteImageListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for satellite image listings."""
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    detection_run_count = serializers.SerializerMethodField()

    class Meta:
        model = SatelliteImage
        fields = [
            'id', 'farm', 'farm_name', 'capture_date', 'source',
            'resolution_m', 'bands', 'has_nir', 'file_size_mb',
            'uploaded_at', 'detection_run_count'
        ]

    def get_detection_run_count(self, obj):
        return obj.detection_runs.count()


class SatelliteImageSerializer(serializers.ModelSerializer):
    """Full serializer for satellite image details."""
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.email', read_only=True, allow_null=True)
    bounds_geojson = serializers.ReadOnlyField()
    center_coordinates = serializers.ReadOnlyField()
    detection_run_count = serializers.SerializerMethodField()
    covered_fields = serializers.SerializerMethodField()

    class Meta:
        model = SatelliteImage
        fields = [
            'id', 'company', 'farm', 'farm_name',
            'file', 'file_size_mb',
            'capture_date', 'resolution_m', 'bands', 'has_nir',
            'source', 'source_product_id',
            'bounds_west', 'bounds_east', 'bounds_south', 'bounds_north',
            'bounds_geojson', 'center_coordinates', 'crs',
            'metadata_json',
            'uploaded_at', 'uploaded_by', 'uploaded_by_name',
            'detection_run_count', 'covered_fields'
        ]
        read_only_fields = [
            'id', 'company', 'file_size_mb', 'resolution_m', 'bands', 'has_nir',
            'bounds_west', 'bounds_east', 'bounds_south', 'bounds_north', 'crs',
            'uploaded_at', 'uploaded_by'
        ]

    def get_detection_run_count(self, obj):
        return obj.detection_runs.count()

    def get_covered_fields(self, obj):
        """Get list of fields that fall within this image's coverage."""
        fields = Field.objects.filter(farm=obj.farm, active=True)
        covered = []
        for field in fields:
            if obj.covers_field(field):
                covered.append({
                    'id': field.id,
                    'name': field.name,
                    'has_boundary': bool(field.boundary_geojson),
                    'total_acres': float(field.total_acres) if field.total_acres else None,
                })
        return covered


class SatelliteImageUploadSerializer(serializers.ModelSerializer):
    """Serializer for uploading satellite imagery with auto-metadata extraction."""

    class Meta:
        model = SatelliteImage
        fields = [
            'id', 'farm', 'file', 'capture_date', 'source', 'source_product_id', 'metadata_json'
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        from .services.tree_detection import extract_geotiff_metadata
        import os
        import tempfile

        request = self.context.get('request')

        # Get metadata from file
        file_obj = validated_data['file']

        # Save temporarily to extract metadata (cross-platform temp directory)
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, file_obj.name)
        with open(temp_path, 'wb') as f:
            for chunk in file_obj.chunks():
                f.write(chunk)

        try:
            metadata = extract_geotiff_metadata(temp_path)
        finally:
            # Reset file pointer
            file_obj.seek(0)
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)

        # Create the image with extracted metadata
        satellite_image = SatelliteImage.objects.create(
            company=request.user.current_company,
            farm=validated_data['farm'],
            file=validated_data['file'],
            capture_date=validated_data['capture_date'],
            source=validated_data.get('source', 'Unknown'),
            source_product_id=validated_data.get('source_product_id', ''),
            file_size_mb=metadata['file_size_mb'],
            resolution_m=metadata['resolution_m'],
            bands=metadata['bands'],
            has_nir=metadata['has_nir'],
            bounds_west=metadata['bounds_west'],
            bounds_east=metadata['bounds_east'],
            bounds_south=metadata['bounds_south'],
            bounds_north=metadata['bounds_north'],
            crs=metadata['crs'],
            metadata_json={
                **validated_data.get('metadata_json', {}),
                'width': metadata['width'],
                'height': metadata['height'],
                'dtype': metadata['dtype'],
            },
            uploaded_by=request.user,
        )

        return satellite_image


class TreeDetectionRunListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for detection run listings."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    image_capture_date = serializers.DateField(source='satellite_image.capture_date', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = TreeDetectionRun
        fields = [
            'id', 'field', 'field_name', 'satellite_image', 'image_capture_date',
            'status', 'status_display', 'tree_count', 'trees_per_acre',
            'canopy_coverage_percent', 'is_approved', 'created_at', 'completed_at'
        ]


class TreeDetectionRunSerializer(serializers.ModelSerializer):
    """Full serializer for detection run details."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    field_acres = serializers.DecimalField(
        source='field.total_acres', max_digits=10, decimal_places=2, read_only=True
    )
    image_capture_date = serializers.DateField(source='satellite_image.capture_date', read_only=True)
    image_source = serializers.CharField(source='satellite_image.source', read_only=True)
    image_resolution = serializers.FloatField(source='satellite_image.resolution_m', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.email', read_only=True, allow_null=True)
    is_latest_for_field = serializers.ReadOnlyField()

    class Meta:
        model = TreeDetectionRun
        fields = [
            'id', 'satellite_image', 'field', 'field_name', 'field_acres',
            'image_capture_date', 'image_source', 'image_resolution',
            'status', 'status_display', 'error_message',
            'algorithm_version', 'vegetation_index', 'parameters',
            'tree_count', 'trees_per_acre', 'avg_canopy_diameter_m',
            'canopy_coverage_percent', 'processing_time_seconds',
            'created_at', 'completed_at',
            'reviewed_by', 'reviewed_by_name', 'review_notes', 'is_approved',
            'is_latest_for_field'
        ]
        read_only_fields = [
            'id', 'status', 'error_message', 'algorithm_version',
            'tree_count', 'trees_per_acre', 'avg_canopy_diameter_m',
            'canopy_coverage_percent', 'processing_time_seconds',
            'created_at', 'completed_at'
        ]


class TreeDetectionRunCreateSerializer(serializers.Serializer):
    """Serializer for triggering tree detection on fields."""
    field_ids = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="List of field IDs to run detection on"
    )
    parameters = serializers.DictField(
        required=False,
        default=dict,
        help_text="Optional detection parameters"
    )

    def validate_field_ids(self, value):
        if not value:
            raise serializers.ValidationError("At least one field ID is required.")
        return value


class DetectedTreeSerializer(serializers.ModelSerializer):
    """Serializer for individual detected trees."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    location_geojson = serializers.ReadOnlyField()

    class Meta:
        model = DetectedTree
        fields = [
            'id', 'detection_run', 'field', 'field_name',
            'latitude', 'longitude', 'pixel_x', 'pixel_y',
            'canopy_diameter_m', 'ndvi_value', 'confidence_score',
            'status', 'status_display', 'is_verified', 'notes',
            'location_geojson'
        ]
        read_only_fields = [
            'id', 'detection_run', 'field', 'latitude', 'longitude',
            'pixel_x', 'pixel_y', 'canopy_diameter_m', 'ndvi_value',
            'confidence_score'
        ]


class DetectedTreeGeoJSONSerializer(serializers.Serializer):
    """Serializer for trees as GeoJSON FeatureCollection for map display."""

    def to_representation(self, queryset):
        features = []
        for tree in queryset:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [tree.longitude, tree.latitude]
                },
                "properties": {
                    "id": tree.id,
                    "ndvi_value": tree.ndvi_value,
                    "confidence_score": tree.confidence_score,
                    "canopy_diameter_m": tree.canopy_diameter_m,
                    "status": tree.status,
                    "is_verified": tree.is_verified,
                }
            })

        return {
            "type": "FeatureCollection",
            "features": features
        }


class FieldTreeSummarySerializer(serializers.Serializer):
    """Serializer for field tree summary data."""
    field_id = serializers.IntegerField()
    field_name = serializers.CharField()
    total_acres = serializers.FloatField(allow_null=True)

    # Manual tree count (from Field model)
    manual_tree_count = serializers.IntegerField(allow_null=True)
    manual_trees_per_acre = serializers.FloatField(allow_null=True)

    # Satellite detection data
    satellite_tree_count = serializers.IntegerField(allow_null=True)
    satellite_trees_per_acre = serializers.FloatField(allow_null=True)
    canopy_coverage_percent = serializers.FloatField(allow_null=True)
    detection_date = serializers.DateField(allow_null=True)
    detection_run_id = serializers.IntegerField(allow_null=True)

    # Comparison
    count_difference = serializers.IntegerField(allow_null=True)
    count_difference_percent = serializers.FloatField(allow_null=True)


# =============================================================================
# LIDAR SERIALIZERS
# =============================================================================

class LiDARDatasetListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for LiDAR dataset listings."""
    farm_name = serializers.CharField(source='farm.name', read_only=True, allow_null=True)
    processing_run_count = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = LiDARDataset
        fields = [
            'id', 'name', 'farm', 'farm_name', 'source', 'capture_date',
            'status', 'status_display', 'point_count', 'point_density_per_sqm',
            'file_size_mb', 'uploaded_at', 'processing_run_count'
        ]

    def get_processing_run_count(self, obj):
        return obj.processing_runs.count()


class LiDARDatasetSerializer(serializers.ModelSerializer):
    """Full serializer for LiDAR dataset details."""
    farm_name = serializers.CharField(source='farm.name', read_only=True, allow_null=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.email', read_only=True, allow_null=True)
    bounds_geojson = serializers.ReadOnlyField()
    center_coordinates = serializers.ReadOnlyField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    processing_run_count = serializers.SerializerMethodField()
    covered_fields = serializers.SerializerMethodField()

    class Meta:
        model = LiDARDataset
        fields = [
            'id', 'company', 'farm', 'farm_name',
            'file', 'file_size_mb', 'name',
            'source', 'source_display', 'capture_date',
            'point_count', 'point_density_per_sqm',
            'crs', 'has_classification',
            'bounds_west', 'bounds_east', 'bounds_south', 'bounds_north',
            'bounds_geojson', 'center_coordinates',
            'status', 'status_display', 'error_message',
            'metadata_json',
            'uploaded_at', 'uploaded_by', 'uploaded_by_name',
            'processing_run_count', 'covered_fields'
        ]
        read_only_fields = [
            'id', 'company', 'file_size_mb', 'point_count', 'point_density_per_sqm',
            'crs', 'has_classification',
            'bounds_west', 'bounds_east', 'bounds_south', 'bounds_north',
            'status', 'error_message', 'metadata_json',
            'uploaded_at', 'uploaded_by'
        ]

    def get_processing_run_count(self, obj):
        return obj.processing_runs.count()

    def get_covered_fields(self, obj):
        """Get list of fields that fall within this LiDAR dataset's coverage."""
        if not obj.farm:
            return []

        fields = Field.objects.filter(farm=obj.farm, active=True)
        covered = []
        for field in fields:
            if obj.covers_field(field):
                covered.append({
                    'id': field.id,
                    'name': field.name,
                    'has_boundary': bool(field.boundary_geojson),
                    'total_acres': float(field.total_acres) if field.total_acres else None,
                })
        return covered


class LiDARDatasetUploadSerializer(serializers.ModelSerializer):
    """Serializer for uploading LiDAR data with validation."""

    class Meta:
        model = LiDARDataset
        fields = [
            'id', 'farm', 'file', 'name', 'source', 'capture_date'
        ]
        read_only_fields = ['id']

    def validate_file(self, value):
        """Validate that the uploaded file is a LAZ or LAS file."""
        filename = value.name.lower()
        if not (filename.endswith('.laz') or filename.endswith('.las')):
            raise serializers.ValidationError(
                "Only LAZ or LAS point cloud files are supported."
            )
        return value

    def create(self, validated_data):
        import os
        request = self.context.get('request')

        # Get file size
        file_obj = validated_data['file']
        file_size_mb = file_obj.size / (1024 * 1024)

        # Create the dataset (validation happens async via Celery task)
        dataset = LiDARDataset.objects.create(
            company=request.user.current_company,
            farm=validated_data.get('farm'),
            file=file_obj,
            name=validated_data['name'],
            source=validated_data.get('source', 'COMMERCIAL'),
            capture_date=validated_data.get('capture_date'),
            file_size_mb=file_size_mb,
            uploaded_by=request.user,
            status='uploaded',
        )

        # Try async validation first, fall back to sync
        try:
            from .tasks.lidar_tasks import validate_lidar_dataset
            validate_lidar_dataset.delay(dataset.id)
        except Exception as e:
            # Celery not available - do sync validation
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to queue validation task: {e}")

            # Perform synchronous metadata extraction
            try:
                from .services.lidar_processing import extract_laz_metadata, transform_bounds_to_wgs84
                metadata = extract_laz_metadata(dataset.file.path)

                # Transform bounds to WGS84
                bounds_sp = (metadata.bounds_west, metadata.bounds_south,
                           metadata.bounds_east, metadata.bounds_north)
                bounds_wgs84 = transform_bounds_to_wgs84(bounds_sp, metadata.crs)

                # Update dataset
                dataset.point_count = metadata.point_count
                dataset.point_density_per_sqm = metadata.point_density_per_sqm
                dataset.crs = 'EPSG:3498' if '3498' in metadata.crs else metadata.crs[:100]
                dataset.has_classification = metadata.has_classification
                dataset.bounds_west = bounds_wgs84[0]
                dataset.bounds_east = bounds_wgs84[2]
                dataset.bounds_south = bounds_wgs84[1]
                dataset.bounds_north = bounds_wgs84[3]
                dataset.status = 'validated'
                dataset.save()
                logger.info(f"LiDAR dataset {dataset.id} validated synchronously")
            except Exception as val_err:
                logger.error(f"Failed to validate LiDAR dataset: {val_err}")

        return dataset


class LiDARProcessingRunListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for processing run listings."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    dataset_name = serializers.CharField(source='lidar_dataset.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    processing_type_display = serializers.CharField(source='get_processing_type_display', read_only=True)

    class Meta:
        model = LiDARProcessingRun
        fields = [
            'id', 'lidar_dataset', 'dataset_name', 'field', 'field_name',
            'processing_type', 'processing_type_display',
            'status', 'status_display',
            'tree_count', 'trees_per_acre', 'avg_tree_height_m',
            'is_approved', 'created_at', 'completed_at', 'processing_time_seconds'
        ]


class LiDARProcessingRunSerializer(serializers.ModelSerializer):
    """Full serializer for processing run details."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    dataset_name = serializers.CharField(source='lidar_dataset.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    processing_type_display = serializers.CharField(source='get_processing_type_display', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.email', read_only=True, allow_null=True)
    detected_tree_count = serializers.SerializerMethodField()
    has_terrain_analysis = serializers.SerializerMethodField()
    is_latest_for_field = serializers.ReadOnlyField()

    class Meta:
        model = LiDARProcessingRun
        fields = [
            'id', 'lidar_dataset', 'dataset_name', 'field', 'field_name',
            'processing_type', 'processing_type_display', 'parameters',
            'status', 'status_display', 'error_message',
            # Tree results
            'tree_count', 'trees_per_acre',
            'avg_tree_height_m', 'max_tree_height_m', 'min_tree_height_m',
            'avg_canopy_diameter_m', 'canopy_coverage_percent',
            # Terrain results
            'avg_slope_degrees', 'max_slope_degrees', 'elevation_range_m',
            # Generated files
            'dtm_file', 'dsm_file', 'chm_file',
            # Approval
            'is_approved', 'approved_by', 'approved_by_name', 'approved_at', 'review_notes',
            # Timestamps
            'created_at', 'completed_at', 'processing_time_seconds',
            # Computed
            'detected_tree_count', 'has_terrain_analysis', 'is_latest_for_field'
        ]
        read_only_fields = [
            'id', 'status', 'error_message',
            'tree_count', 'trees_per_acre',
            'avg_tree_height_m', 'max_tree_height_m', 'min_tree_height_m',
            'avg_canopy_diameter_m', 'canopy_coverage_percent',
            'avg_slope_degrees', 'max_slope_degrees', 'elevation_range_m',
            'dtm_file', 'dsm_file', 'chm_file',
            'approved_by', 'approved_at',
            'created_at', 'completed_at', 'processing_time_seconds'
        ]

    def get_detected_tree_count(self, obj):
        return obj.detected_trees.count()

    def get_has_terrain_analysis(self, obj):
        return hasattr(obj, 'terrain_analysis') and obj.terrain_analysis is not None


class LiDARProcessingRunCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new processing runs."""

    class Meta:
        model = LiDARProcessingRun
        fields = ['id', 'lidar_dataset', 'field', 'processing_type', 'parameters']
        read_only_fields = ['id']

    def validate(self, attrs):
        """Validate that the LiDAR dataset covers the field."""
        lidar_dataset = attrs.get('lidar_dataset')
        field = attrs.get('field')

        if lidar_dataset.status != 'ready':
            raise serializers.ValidationError({
                'lidar_dataset': f"Dataset is not ready for processing (status: {lidar_dataset.status})"
            })

        if not field.boundary_geojson:
            raise serializers.ValidationError({
                'field': "Field has no boundary defined. Please draw a boundary first."
            })

        if not lidar_dataset.covers_field(field):
            raise serializers.ValidationError({
                'field': "The LiDAR dataset does not cover this field's boundary."
            })

        return attrs

    def create(self, validated_data):
        # Create the processing run
        run = LiDARProcessingRun.objects.create(**validated_data)

        # Trigger async processing task
        try:
            from .tasks.lidar_tasks import process_lidar_for_field
            process_lidar_for_field.delay(run.id)
        except Exception as e:
            # Update run with error if task queue fails
            run.status = 'failed'
            run.error_message = f"Failed to queue processing task: {str(e)}"
            run.save()
            import logging
            logging.getLogger(__name__).error(f"Failed to queue LiDAR processing task: {e}")

        return run


class LiDARDetectedTreeSerializer(serializers.ModelSerializer):
    """Full serializer for LiDAR detected trees."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    location_geojson = serializers.ReadOnlyField()

    class Meta:
        model = LiDARDetectedTree
        fields = [
            'id', 'processing_run', 'field', 'field_name',
            'latitude', 'longitude',
            'height_m', 'canopy_diameter_m', 'canopy_area_sqm', 'ground_elevation_m',
            'status', 'status_display', 'is_verified', 'notes',
            'location_geojson'
        ]
        read_only_fields = [
            'id', 'processing_run', 'field',
            'latitude', 'longitude',
            'height_m', 'canopy_diameter_m', 'canopy_area_sqm', 'ground_elevation_m'
        ]


class LiDARDetectedTreeGeoJSONSerializer(serializers.Serializer):
    """Serializer for LiDAR trees as GeoJSON FeatureCollection for map display."""

    def to_representation(self, queryset):
        features = []
        for tree in queryset:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [tree.longitude, tree.latitude]
                },
                "properties": {
                    "id": tree.id,
                    "height_m": tree.height_m,
                    "canopy_diameter_m": tree.canopy_diameter_m,
                    "canopy_area_sqm": tree.canopy_area_sqm,
                    "ground_elevation_m": tree.ground_elevation_m,
                    "status": tree.status,
                    "is_verified": tree.is_verified,
                }
            })

        return {
            "type": "FeatureCollection",
            "features": features
        }


class TerrainAnalysisSerializer(serializers.ModelSerializer):
    """Full serializer for terrain analysis results."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    slope_aspect_display = serializers.CharField(source='get_slope_aspect_dominant_display', read_only=True)
    drainage_direction_display = serializers.CharField(
        source='get_drainage_direction_display',
        read_only=True,
        allow_null=True
    )

    class Meta:
        model = TerrainAnalysis
        fields = [
            'id', 'processing_run', 'field', 'field_name',
            # Elevation
            'min_elevation_m', 'max_elevation_m', 'mean_elevation_m',
            # Slope
            'mean_slope_degrees', 'max_slope_degrees',
            'slope_aspect_dominant', 'slope_aspect_display',
            # Slope distribution
            'slope_0_2_percent', 'slope_2_5_percent',
            'slope_5_10_percent', 'slope_over_10_percent',
            # Frost risk
            'frost_risk_zones', 'frost_risk_summary',
            # Drainage
            'drainage_direction', 'drainage_direction_display', 'low_spot_count'
        ]
        read_only_fields = '__all__'


class FieldLiDARSummarySerializer(serializers.Serializer):
    """Serializer for field LiDAR summary comparing satellite vs LiDAR."""
    field_id = serializers.IntegerField()
    field_name = serializers.CharField()
    total_acres = serializers.FloatField(allow_null=True)

    # Manual tree count (from Field model)
    manual_tree_count = serializers.IntegerField(allow_null=True)
    manual_trees_per_acre = serializers.FloatField(allow_null=True)

    # Satellite detection data
    satellite_tree_count = serializers.IntegerField(allow_null=True)
    satellite_trees_per_acre = serializers.FloatField(allow_null=True)
    satellite_canopy_coverage_percent = serializers.FloatField(allow_null=True)
    satellite_detection_date = serializers.DateField(allow_null=True)

    # LiDAR detection data
    lidar_tree_count = serializers.IntegerField(allow_null=True)
    lidar_trees_per_acre = serializers.FloatField(allow_null=True)
    lidar_avg_tree_height_m = serializers.FloatField(allow_null=True)
    lidar_canopy_coverage_percent = serializers.FloatField(allow_null=True)
    lidar_detection_date = serializers.DateField(allow_null=True)

    # Terrain data
    avg_slope_degrees = serializers.FloatField(allow_null=True)
    primary_aspect = serializers.CharField(allow_null=True)
    frost_risk_level = serializers.CharField(allow_null=True)

    # Comparisons
    satellite_vs_lidar_diff = serializers.IntegerField(allow_null=True)
    satellite_vs_lidar_diff_percent = serializers.FloatField(allow_null=True)


# =============================================================================
# UNIFIED TREE IDENTITY SERIALIZERS
# =============================================================================

class TreeObservationSerializer(serializers.ModelSerializer):
    """Serializer for tree observations - links to satellite/LiDAR detections."""
    source_type_display = serializers.CharField(source='get_source_type_display', read_only=True)
    match_method_display = serializers.CharField(source='get_match_method_display', read_only=True)

    class Meta:
        model = TreeObservation
        fields = [
            'id', 'tree', 'source_type', 'source_type_display',
            'satellite_detection', 'lidar_detection',
            'match_method', 'match_method_display',
            'match_distance_m', 'match_confidence',
            'observation_date',
            'observed_latitude', 'observed_longitude',
            'observed_height_m', 'observed_canopy_diameter_m',
            'observed_canopy_area_sqm', 'observed_ndvi',
            'observed_status',
            'created_at',
        ]
        read_only_fields = '__all__'


class TreeListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for tree lists and map display."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    confidence_display = serializers.CharField(source='get_identity_confidence_display', read_only=True)
    observation_count = serializers.SerializerMethodField()

    class Meta:
        model = Tree
        fields = [
            'id', 'uuid', 'latitude', 'longitude',
            'height_m', 'canopy_diameter_m', 'latest_ndvi',
            'status', 'status_display',
            'identity_confidence', 'confidence_display',
            'observation_count',
            'is_verified', 'tree_label',
            'first_observed', 'last_observed',
        ]

    def get_observation_count(self, obj):
        return obj.satellite_observation_count + obj.lidar_observation_count


class TreeDetailSerializer(serializers.ModelSerializer):
    """Full serializer for tree detail view with observations."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    confidence_display = serializers.CharField(source='get_identity_confidence_display', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    verified_by_name = serializers.SerializerMethodField()
    observations = TreeObservationSerializer(many=True, read_only=True)
    observation_count = serializers.SerializerMethodField()

    class Meta:
        model = Tree
        fields = [
            'id', 'uuid', 'field', 'field_name',
            'latitude', 'longitude',
            'height_m', 'canopy_diameter_m', 'canopy_area_sqm',
            'latest_ndvi', 'ground_elevation_m',
            'status', 'status_display',
            'identity_confidence', 'confidence_display',
            'satellite_observation_count', 'lidar_observation_count',
            'observation_count',
            'first_observed', 'last_observed',
            'is_verified', 'verified_by', 'verified_by_name', 'verified_at',
            'tree_label', 'notes',
            'observations',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'uuid', 'satellite_observation_count', 'lidar_observation_count',
            'first_observed', 'last_observed', 'created_at', 'updated_at',
        ]

    def get_verified_by_name(self, obj):
        if obj.verified_by:
            return obj.verified_by.get_full_name() or obj.verified_by.username
        return None

    def get_observation_count(self, obj):
        return obj.satellite_observation_count + obj.lidar_observation_count


class TreeGeoJSONSerializer(serializers.Serializer):
    """GeoJSON Feature serializer for trees."""
    type = serializers.SerializerMethodField()
    geometry = serializers.SerializerMethodField()
    properties = serializers.SerializerMethodField()

    def get_type(self, obj):
        return "Feature"

    def get_geometry(self, obj):
        return {
            "type": "Point",
            "coordinates": [obj.longitude, obj.latitude]
        }

    def get_properties(self, obj):
        return {
            "id": obj.id,
            "uuid": str(obj.uuid),
            "height_m": obj.height_m,
            "canopy_diameter_m": obj.canopy_diameter_m,
            "canopy_area_sqm": obj.canopy_area_sqm,
            "latest_ndvi": obj.latest_ndvi,
            "status": obj.status,
            "identity_confidence": obj.identity_confidence,
            "satellite_observations": obj.satellite_observation_count,
            "lidar_observations": obj.lidar_observation_count,
            "is_verified": obj.is_verified,
            "tree_label": obj.tree_label,
            "first_observed": obj.first_observed.isoformat() if obj.first_observed else None,
            "last_observed": obj.last_observed.isoformat() if obj.last_observed else None,
        }


class TreeMatchingRunSerializer(serializers.ModelSerializer):
    """Serializer for tree matching run records."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    triggered_by_name = serializers.SerializerMethodField()
    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = TreeMatchingRun
        fields = [
            'id', 'field', 'field_name',
            'satellite_run', 'lidar_run',
            'match_distance_threshold_m',
            'canopy_weight', 'ndvi_weight', 'distance_weight',
            'status', 'status_display',
            'started_at', 'completed_at', 'duration_seconds',
            'trees_matched', 'new_trees_created', 'trees_marked_missing',
            'error_message',
            'triggered_by', 'triggered_by_name',
            'created_at',
        ]
        read_only_fields = '__all__'

    def get_triggered_by_name(self, obj):
        if obj.triggered_by:
            return obj.triggered_by.get_full_name() or obj.triggered_by.username
        return None

    def get_duration_seconds(self, obj):
        if obj.started_at and obj.completed_at:
            return (obj.completed_at - obj.started_at).total_seconds()
        return None


class TreeVerifySerializer(serializers.Serializer):
    """Serializer for tree verification action."""
    is_verified = serializers.BooleanField(required=True)
    tree_label = serializers.CharField(max_length=50, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)


class TreeMergeSerializer(serializers.Serializer):
    """Serializer for merging duplicate trees."""
    source_tree_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        help_text="IDs of trees to merge into the target tree"
    )


class TreeMatchingTriggerSerializer(serializers.Serializer):
    """Serializer for triggering tree matching."""
    satellite_run_id = serializers.IntegerField(required=False, allow_null=True)
    lidar_run_id = serializers.IntegerField(required=False, allow_null=True)
    prefer_lidar = serializers.BooleanField(
        default=False,
        help_text="If true, LiDAR runs are treated as primary; otherwise satellite is primary"
    )
    match_all_existing = serializers.BooleanField(
        default=False,
        help_text="If true, match all existing unmatched detections"
    )
    match_distance_threshold_m = serializers.FloatField(
        default=3.0,
        min_value=0.5,
        max_value=10.0,
        help_text="Maximum distance in meters for matching"
    )


class FieldUnifiedTreeSummarySerializer(serializers.Serializer):
    """Summary of unified trees for a field."""
    field_id = serializers.IntegerField()
    field_name = serializers.CharField()

    # Tree counts by status
    total_trees = serializers.IntegerField()
    active_trees = serializers.IntegerField()
    missing_trees = serializers.IntegerField()
    dead_trees = serializers.IntegerField()
    uncertain_trees = serializers.IntegerField()

    # Confidence breakdown
    high_confidence_count = serializers.IntegerField()
    medium_confidence_count = serializers.IntegerField()
    low_confidence_count = serializers.IntegerField()

    # Observation coverage
    trees_with_satellite = serializers.IntegerField()
    trees_with_lidar = serializers.IntegerField()
    trees_with_both = serializers.IntegerField()
    verified_trees = serializers.IntegerField()

    # Aggregated metrics
    avg_height_m = serializers.FloatField(allow_null=True)
    avg_canopy_diameter_m = serializers.FloatField(allow_null=True)
    avg_ndvi = serializers.FloatField(allow_null=True)

    # Recent activity
    last_matching_run = serializers.DateTimeField(allow_null=True)
    total_observations = serializers.IntegerField()


# =============================================================================
# TREE FEEDBACK SERIALIZERS
# =============================================================================

class TreeFeedbackSerializer(serializers.ModelSerializer):
    """Full serializer for tree feedback with user info."""
    feedback_type_display = serializers.CharField(source='get_feedback_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    resolved_by_name = serializers.SerializerMethodField()
    tree_uuid = serializers.UUIDField(source='tree.uuid', read_only=True)
    field_id = serializers.IntegerField(source='tree.field_id', read_only=True)
    field_name = serializers.CharField(source='tree.field.name', read_only=True)

    class Meta:
        model = TreeFeedback
        fields = [
            'id', 'tree', 'tree_uuid', 'field_id', 'field_name',
            'observation',
            'feedback_type', 'feedback_type_display',
            'notes',
            'suggested_latitude', 'suggested_longitude',
            'suggested_corrections',
            'status', 'status_display',
            'resolution_notes',
            'resolved_by', 'resolved_by_name', 'resolved_at',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
            'exported_for_training', 'exported_at',
        ]
        read_only_fields = [
            'id', 'tree_uuid', 'field_id', 'field_name',
            'created_by', 'created_at', 'updated_at',
            'resolved_by', 'resolved_at',
            'exported_for_training', 'exported_at',
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_resolved_by_name(self, obj):
        if obj.resolved_by:
            return obj.resolved_by.get_full_name() or obj.resolved_by.username
        return None


class TreeFeedbackCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new feedback."""

    class Meta:
        model = TreeFeedback
        fields = [
            'tree', 'observation',
            'feedback_type', 'notes',
            'suggested_latitude', 'suggested_longitude',
            'suggested_corrections',
        ]

    def validate(self, data):
        # Validate location corrections if feedback type is location_error
        if data.get('feedback_type') == 'location_error':
            if not data.get('suggested_latitude') and not data.get('suggested_longitude'):
                raise serializers.ValidationError(
                    "Location corrections must include suggested_latitude and/or suggested_longitude"
                )
        return data

    def create(self, validated_data):
        # Set created_by from request user
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class TreeFeedbackUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating feedback status (admin review)."""

    class Meta:
        model = TreeFeedback
        fields = ['status', 'resolution_notes']

    def update(self, instance, validated_data):
        from django.utils import timezone

        # If status is changing to accepted or rejected, set resolution fields
        new_status = validated_data.get('status')
        if new_status in ['accepted', 'rejected'] and instance.status == 'pending':
            instance.resolved_by = self.context['request'].user
            instance.resolved_at = timezone.now()

        return super().update(instance, validated_data)


class TreeFeedbackExportSerializer(serializers.ModelSerializer):
    """Serializer for exporting feedback for ML training."""
    tree_uuid = serializers.UUIDField(source='tree.uuid')
    latitude = serializers.FloatField(source='tree.latitude')
    longitude = serializers.FloatField(source='tree.longitude')
    original_source = serializers.SerializerMethodField()
    original_confidence = serializers.CharField(source='tree.identity_confidence')
    resolution = serializers.CharField(source='status')

    class Meta:
        model = TreeFeedback
        fields = [
            'tree_uuid', 'latitude', 'longitude',
            'feedback_type', 'notes',
            'suggested_latitude', 'suggested_longitude',
            'suggested_corrections',
            'original_source', 'original_confidence',
            'resolution', 'resolution_notes',
            'created_at', 'resolved_at',
        ]

    def get_original_source(self, obj):
        tree = obj.tree
        if tree.satellite_observation_count > 0 and tree.lidar_observation_count > 0:
            return 'both'
        elif tree.lidar_observation_count > 0:
            return 'lidar'
        else:
            return 'satellite'


class TreeFeedbackStatisticsSerializer(serializers.Serializer):
    """Statistics about tree feedback."""
    total_feedback = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    accepted_count = serializers.IntegerField()
    rejected_count = serializers.IntegerField()

    # By type
    false_positive_count = serializers.IntegerField()
    false_negative_count = serializers.IntegerField()
    misidentification_count = serializers.IntegerField()
    location_error_count = serializers.IntegerField()
    attribute_error_count = serializers.IntegerField()
    verified_correct_count = serializers.IntegerField()

    # Export status
    exported_count = serializers.IntegerField()
    unexported_accepted_count = serializers.IntegerField()


# =============================================================================
# COMPLIANCE MODULE SERIALIZERS
# =============================================================================

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

class ComplianceDeadlineSerializer(serializers.ModelSerializer):
    """Full serializer for compliance deadlines."""
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


class ComplianceDeadlineListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for deadline lists."""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    days_until_due = serializers.IntegerField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = ComplianceDeadline
        fields = [
            'id', 'name', 'category', 'category_display',
            'regulation', 'due_date', 'status', 'status_display',
            'days_until_due', 'is_overdue', 'action_url',
        ]


class ComplianceDeadlineCompleteSerializer(serializers.Serializer):
    """Serializer for marking deadline complete."""
    notes = serializers.CharField(required=False, allow_blank=True)


# -----------------------------------------------------------------------------
# COMPLIANCE ALERT SERIALIZERS
# -----------------------------------------------------------------------------

class ComplianceAlertSerializer(serializers.ModelSerializer):
    """Full serializer for compliance alerts."""
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


class ComplianceAlertListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for alert lists."""
    alert_type_display = serializers.CharField(source='get_alert_type_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)

    class Meta:
        model = ComplianceAlert
        fields = [
            'id', 'alert_type', 'alert_type_display',
            'priority', 'priority_display', 'title', 'message',
            'is_acknowledged', 'action_url', 'action_label',
            'created_at',
        ]


# -----------------------------------------------------------------------------
# LICENSE SERIALIZERS
# -----------------------------------------------------------------------------

class LicenseSerializer(serializers.ModelSerializer):
    """Full serializer for licenses."""
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


class LicenseListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for license lists."""
    license_type_display = serializers.CharField(source='get_license_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    holder_name = serializers.CharField(read_only=True)
    days_until_expiration = serializers.IntegerField(read_only=True)

    class Meta:
        model = License
        fields = [
            'id', 'license_type', 'license_type_display',
            'license_number', 'holder_name',
            'expiration_date', 'status', 'status_display',
            'days_until_expiration',
        ]


# -----------------------------------------------------------------------------
# WPS TRAINING SERIALIZERS
# -----------------------------------------------------------------------------

class WPSTrainingRecordSerializer(serializers.ModelSerializer):
    """Full serializer for WPS training records."""
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


class WPSTrainingRecordListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for training lists."""
    training_type_display = serializers.CharField(source='get_training_type_display', read_only=True)
    status = serializers.CharField(read_only=True)
    days_until_expiration = serializers.IntegerField(read_only=True)

    class Meta:
        model = WPSTrainingRecord
        fields = [
            'id', 'trainee_name', 'training_type', 'training_type_display',
            'training_date', 'expiration_date',
            'status', 'days_until_expiration', 'verified',
        ]


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

class REIPostingRecordSerializer(serializers.ModelSerializer):
    """Full serializer for REI posting records."""
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


class REIPostingRecordListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for REI posting lists."""
    field_name = serializers.CharField(source='application.field.name', read_only=True)
    product_name = serializers.CharField(source='application.product.product_name', read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = REIPostingRecord
        fields = [
            'id', 'field_name', 'product_name',
            'rei_hours', 'rei_end_datetime', 'is_active',
            'posted_at', 'posting_compliant',
        ]


# -----------------------------------------------------------------------------
# COMPLIANCE REPORT SERIALIZERS
# -----------------------------------------------------------------------------

class ComplianceReportSerializer(serializers.ModelSerializer):
    """Full serializer for compliance reports."""
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


class ComplianceReportListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for report lists."""
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    period_display = serializers.CharField(read_only=True)

    class Meta:
        model = ComplianceReport
        fields = [
            'id', 'report_type', 'report_type_display', 'title',
            'reporting_period_start', 'reporting_period_end', 'period_display',
            'status', 'status_display', 'record_count', 'is_valid',
            'submitted_at', 'created_at',
        ]


# -----------------------------------------------------------------------------
# INCIDENT REPORT SERIALIZERS
# -----------------------------------------------------------------------------

class IncidentReportSerializer(serializers.ModelSerializer):
    """Full serializer for incident reports."""
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


class IncidentReportListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for incident lists."""
    incident_type_display = serializers.CharField(source='get_incident_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = IncidentReport
        fields = [
            'id', 'incident_type', 'incident_type_display',
            'severity', 'severity_display',
            'incident_date', 'title', 'status', 'status_display',
        ]


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

    upcoming_deadlines = ComplianceDeadlineListSerializer(many=True)
    active_alerts = ComplianceAlertListSerializer(many=True)
    expiring_licenses = LicenseListSerializer(many=True)
    expiring_training = WPSTrainingRecordListSerializer(many=True)


class ComplianceCalendarSerializer(serializers.Serializer):
    """Serializer for calendar view data."""
    date = serializers.DateField()
    deadlines = ComplianceDeadlineListSerializer(many=True)
    reports_due = ComplianceReportListSerializer(many=True)


# =============================================================================
# DISEASE PREVENTION SERIALIZERS
# =============================================================================

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
            'satellite_image', 'tree_detection_run',
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
            'last_detection_run', 'last_updated',
            'ndvi_history', 'canopy_history',
            'ndvi_trend', 'ndvi_trend_display',
            'health_status', 'health_status_display',
            'flagged_for_inspection', 'flag_reason',
            'inspected', 'inspection_date', 'inspection_notes'
        ]
        read_only_fields = [
            'company', 'tree_id', 'latitude', 'longitude',
            'current_ndvi', 'current_canopy_diameter_m',
            'last_detection_run', 'last_updated',
            'ndvi_history', 'canopy_history', 'ndvi_trend', 'health_status'
        ]


# =============================================================================
# PACKINGHOUSE POOL TRACKING SERIALIZERS
# =============================================================================

class PackinghouseListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for packinghouse listings."""
    pool_count = serializers.SerializerMethodField()

    class Meta:
        model = Packinghouse
        fields = [
            'id', 'name', 'short_code', 'grower_id',
            'city', 'state', 'is_active', 'pool_count'
        ]

    def get_pool_count(self, obj):
        return obj.pools.count()


class PackinghouseSerializer(serializers.ModelSerializer):
    """Full serializer for Packinghouse model."""
    pool_count = serializers.SerializerMethodField()
    active_pools_count = serializers.SerializerMethodField()

    class Meta:
        model = Packinghouse
        fields = [
            'id', 'company', 'name', 'short_code',
            'address', 'city', 'state', 'zip_code',
            'contact_name', 'contact_phone', 'contact_email',
            'grower_id', 'notes', 'is_active',
            'pool_count', 'active_pools_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at']

    def get_pool_count(self, obj):
        return obj.pools.count()

    def get_active_pools_count(self, obj):
        return obj.pools.filter(status='active').count()


class PoolListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for pool listings."""
    packinghouse_name = serializers.CharField(source='packinghouse.name', read_only=True)
    packinghouse_short_code = serializers.CharField(source='packinghouse.short_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    pool_type_display = serializers.CharField(source='get_pool_type_display', read_only=True)
    total_bins = serializers.ReadOnlyField()
    delivery_count = serializers.ReadOnlyField()

    class Meta:
        model = Pool
        fields = [
            'id', 'pool_id', 'name', 'packinghouse',
            'packinghouse_name', 'packinghouse_short_code',
            'commodity', 'variety', 'season',
            'pool_type', 'pool_type_display',
            'status', 'status_display',
            'total_bins', 'delivery_count'
        ]


class PoolSerializer(serializers.ModelSerializer):
    """Full serializer for Pool model."""
    packinghouse_name = serializers.CharField(source='packinghouse.name', read_only=True)
    packinghouse_short_code = serializers.CharField(source='packinghouse.short_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    pool_type_display = serializers.CharField(source='get_pool_type_display', read_only=True)
    total_bins = serializers.ReadOnlyField()
    delivery_count = serializers.ReadOnlyField()

    class Meta:
        model = Pool
        fields = [
            'id', 'packinghouse', 'packinghouse_name', 'packinghouse_short_code',
            'pool_id', 'name', 'commodity', 'variety', 'season',
            'pool_type', 'pool_type_display',
            'status', 'status_display',
            'open_date', 'close_date',
            'notes', 'total_bins', 'delivery_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PackinghouseDeliveryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for delivery listings."""
    pool_name = serializers.CharField(source='pool.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    harvest_date = serializers.DateField(source='harvest.harvest_date', read_only=True)
    harvest_lot = serializers.CharField(source='harvest.lot_number', read_only=True)

    class Meta:
        model = PackinghouseDelivery
        fields = [
            'id', 'pool', 'pool_name', 'field', 'field_name',
            'ticket_number', 'delivery_date', 'bins', 'weight_lbs',
            'harvest', 'harvest_date', 'harvest_lot'
        ]


class PackinghouseDeliverySerializer(serializers.ModelSerializer):
    """Full serializer for PackinghouseDelivery model."""
    pool_name = serializers.CharField(source='pool.name', read_only=True)
    pool_commodity = serializers.CharField(source='pool.commodity', read_only=True)
    packinghouse_name = serializers.CharField(source='pool.packinghouse.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    harvest_date = serializers.DateField(source='harvest.harvest_date', read_only=True)

    class Meta:
        model = PackinghouseDelivery
        fields = [
            'id', 'pool', 'pool_name', 'pool_commodity', 'packinghouse_name',
            'field', 'field_name', 'farm_name',
            'ticket_number', 'delivery_date',
            'bins', 'field_boxes', 'weight_lbs',
            'harvest', 'harvest_date',
            'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PackoutGradeLineSerializer(serializers.ModelSerializer):
    """Serializer for packout grade line items."""
    unit_display = serializers.CharField(source='get_unit_of_measure_display', read_only=True)

    class Meta:
        model = PackoutGradeLine
        fields = [
            'id', 'grade', 'size', 'unit_of_measure', 'unit_display',
            'quantity_this_period', 'percent_this_period',
            'quantity_cumulative', 'percent_cumulative',
            'house_avg_percent'
        ]


class PackoutReportListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for packout report listings."""
    pool_name = serializers.CharField(source='pool.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)

    class Meta:
        model = PackoutReport
        fields = [
            'id', 'pool', 'pool_name', 'field', 'field_name',
            'report_date', 'period_start', 'period_end',
            'bins_this_period', 'bins_cumulative',
            'total_packed_percent', 'house_avg_packed_percent'
        ]


class PackoutReportSerializer(serializers.ModelSerializer):
    """Full serializer for PackoutReport with nested grade lines."""
    pool_name = serializers.CharField(source='pool.name', read_only=True)
    pool_commodity = serializers.CharField(source='pool.commodity', read_only=True)
    packinghouse_name = serializers.CharField(source='pool.packinghouse.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    grade_lines = PackoutGradeLineSerializer(many=True, read_only=True)

    class Meta:
        model = PackoutReport
        fields = [
            'id', 'pool', 'pool_name', 'pool_commodity', 'packinghouse_name',
            'field', 'field_name', 'farm_name',
            'report_date', 'period_start', 'period_end', 'run_numbers',
            'bins_this_period', 'bins_cumulative',
            'total_packed_percent', 'house_avg_packed_percent',
            'juice_percent', 'cull_percent',
            'quality_notes', 'grade_data_json',
            'grade_lines',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PackoutReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating packout reports with nested grade lines."""
    grade_lines = PackoutGradeLineSerializer(many=True, required=False)

    class Meta:
        model = PackoutReport
        fields = [
            'pool', 'field', 'report_date', 'period_start', 'period_end',
            'run_numbers', 'bins_this_period', 'bins_cumulative',
            'total_packed_percent', 'house_avg_packed_percent',
            'juice_percent', 'cull_percent', 'quality_notes',
            'grade_data_json', 'grade_lines'
        ]

    def create(self, validated_data):
        grade_lines_data = validated_data.pop('grade_lines', [])
        packout_report = PackoutReport.objects.create(**validated_data)

        for grade_line_data in grade_lines_data:
            PackoutGradeLine.objects.create(
                packout_report=packout_report,
                **grade_line_data
            )

        return packout_report


class SettlementGradeLineSerializer(serializers.ModelSerializer):
    """Serializer for settlement grade line items."""
    unit_display = serializers.CharField(source='get_unit_of_measure_display', read_only=True)

    class Meta:
        model = SettlementGradeLine
        fields = [
            'id', 'grade', 'size', 'unit_of_measure', 'unit_display',
            'quantity', 'percent_of_total', 'fob_rate', 'total_amount'
        ]


class SettlementDeductionSerializer(serializers.ModelSerializer):
    """Serializer for settlement deduction items."""
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = SettlementDeduction
        fields = [
            'id', 'category', 'category_display', 'description',
            'quantity', 'unit_of_measure', 'rate', 'amount'
        ]


class PoolSettlementListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for settlement listings."""
    pool_name = serializers.CharField(source='pool.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True, allow_null=True)
    variance_vs_house_per_bin = serializers.ReadOnlyField()

    class Meta:
        model = PoolSettlement
        fields = [
            'id', 'pool', 'pool_name', 'field', 'field_name',
            'statement_date', 'total_bins',
            'net_return', 'amount_due',
            'net_per_bin', 'house_avg_per_bin', 'variance_vs_house_per_bin'
        ]


class PoolSettlementSerializer(serializers.ModelSerializer):
    """Full serializer for PoolSettlement with nested grade lines and deductions."""
    pool_name = serializers.CharField(source='pool.name', read_only=True)
    pool_commodity = serializers.CharField(source='pool.commodity', read_only=True)
    packinghouse_name = serializers.CharField(source='pool.packinghouse.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True, allow_null=True)
    farm_name = serializers.SerializerMethodField()
    grade_lines = SettlementGradeLineSerializer(many=True, read_only=True)
    deductions = SettlementDeductionSerializer(many=True, read_only=True)
    variance_vs_house_per_bin = serializers.ReadOnlyField()
    source_pdf_url = serializers.SerializerMethodField()
    source_pdf_filename = serializers.SerializerMethodField()

    class Meta:
        model = PoolSettlement
        fields = [
            'id', 'pool', 'pool_name', 'pool_commodity', 'packinghouse_name',
            'field', 'field_name', 'farm_name',
            'statement_date',
            'total_bins', 'total_cartons', 'total_weight_lbs',
            'total_credits', 'total_deductions',
            'net_return', 'prior_advances', 'amount_due',
            'net_per_bin', 'net_per_carton', 'net_per_lb', 'net_per_acre',
            'house_avg_per_bin', 'house_avg_per_carton', 'variance_vs_house_per_bin',
            'fresh_fruit_percent', 'products_percent',
            'settlement_data_json',
            'grade_lines', 'deductions',
            'source_pdf_url', 'source_pdf_filename',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_farm_name(self, obj):
        if obj.field:
            return obj.field.farm.name
        return None

    def get_source_pdf_url(self, obj):
        if obj.source_statement and obj.source_statement.pdf_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.source_statement.pdf_file.url)
            return obj.source_statement.pdf_file.url
        return None

    def get_source_pdf_filename(self, obj):
        if obj.source_statement:
            return obj.source_statement.original_filename
        return None


class PoolSettlementCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating settlements with nested grade lines and deductions."""
    grade_lines = SettlementGradeLineSerializer(many=True, required=False)
    deductions = SettlementDeductionSerializer(many=True, required=False)

    class Meta:
        model = PoolSettlement
        fields = [
            'pool', 'field', 'statement_date',
            'total_bins', 'total_cartons', 'total_weight_lbs',
            'total_credits', 'total_deductions',
            'net_return', 'prior_advances', 'amount_due',
            'net_per_bin', 'net_per_carton', 'net_per_lb', 'net_per_acre',
            'house_avg_per_bin', 'house_avg_per_carton',
            'fresh_fruit_percent', 'products_percent',
            'settlement_data_json',
            'grade_lines', 'deductions'
        ]

    def create(self, validated_data):
        grade_lines_data = validated_data.pop('grade_lines', [])
        deductions_data = validated_data.pop('deductions', [])

        settlement = PoolSettlement.objects.create(**validated_data)

        for grade_line_data in grade_lines_data:
            SettlementGradeLine.objects.create(
                settlement=settlement,
                **grade_line_data
            )

        for deduction_data in deductions_data:
            SettlementDeduction.objects.create(
                settlement=settlement,
                **deduction_data
            )

        return settlement


class GrowerLedgerEntryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for ledger entry listings."""
    packinghouse_name = serializers.CharField(source='packinghouse.name', read_only=True)
    pool_name = serializers.CharField(source='pool.name', read_only=True, allow_null=True)
    entry_type_display = serializers.CharField(source='get_entry_type_display', read_only=True)
    net_amount = serializers.ReadOnlyField()

    class Meta:
        model = GrowerLedgerEntry
        fields = [
            'id', 'packinghouse', 'packinghouse_name',
            'pool', 'pool_name',
            'entry_date', 'entry_type', 'entry_type_display',
            'reference', 'description',
            'debit', 'credit', 'net_amount', 'balance'
        ]


class GrowerLedgerEntrySerializer(serializers.ModelSerializer):
    """Full serializer for GrowerLedgerEntry model."""
    packinghouse_name = serializers.CharField(source='packinghouse.name', read_only=True)
    packinghouse_short_code = serializers.CharField(source='packinghouse.short_code', read_only=True)
    pool_name = serializers.CharField(source='pool.name', read_only=True, allow_null=True)
    pool_commodity = serializers.SerializerMethodField()
    entry_type_display = serializers.CharField(source='get_entry_type_display', read_only=True)
    net_amount = serializers.ReadOnlyField()

    class Meta:
        model = GrowerLedgerEntry
        fields = [
            'id', 'packinghouse', 'packinghouse_name', 'packinghouse_short_code',
            'pool', 'pool_name', 'pool_commodity',
            'entry_date', 'posted_date',
            'entry_type', 'entry_type_display',
            'reference', 'description',
            'debit', 'credit', 'net_amount', 'balance',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_pool_commodity(self, obj):
        if obj.pool:
            return obj.pool.commodity
        return None


# =============================================================================
# PACKINGHOUSE ANALYTICS SERIALIZERS
# =============================================================================

class BlockPerformanceSerializer(serializers.Serializer):
    """Serializer for block performance comparison."""
    field_id = serializers.IntegerField()
    field_name = serializers.CharField()
    pool_name = serializers.CharField()
    total_bins = serializers.DecimalField(max_digits=10, decimal_places=2)
    pack_percent = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    house_avg_pack_percent = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    pack_variance = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    net_per_bin = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    house_avg_per_bin = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    return_variance = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)


class PackoutTrendSerializer(serializers.Serializer):
    """Serializer for packout percentage trends."""
    report_date = serializers.DateField()
    field_name = serializers.CharField()
    total_packed_percent = serializers.DecimalField(max_digits=5, decimal_places=2)
    house_avg_packed_percent = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)


class SettlementComparisonSerializer(serializers.Serializer):
    """Serializer for packinghouse settlement comparison."""
    packinghouse_id = serializers.IntegerField()
    packinghouse_name = serializers.CharField()
    season = serializers.CharField()
    commodity = serializers.CharField()
    total_bins = serializers.DecimalField(max_digits=10, decimal_places=2)
    net_return = serializers.DecimalField(max_digits=12, decimal_places=2)
    net_per_bin = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    fresh_fruit_percent = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)


# =============================================================================
# PACKINGHOUSE STATEMENT SERIALIZERS
# =============================================================================

class PackinghouseStatementListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for statement listings."""
    packinghouse_name = serializers.CharField(source='packinghouse.name', read_only=True)
    packinghouse_short_code = serializers.CharField(source='packinghouse.short_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    statement_type_display = serializers.CharField(source='get_statement_type_display', read_only=True)
    format_display = serializers.CharField(source='get_packinghouse_format_display', read_only=True)
    pool_name = serializers.CharField(source='pool.name', read_only=True, allow_null=True)
    field_name = serializers.CharField(source='field.name', read_only=True, allow_null=True)
    uploaded_by_name = serializers.SerializerMethodField()
    is_processed = serializers.ReadOnlyField()

    class Meta:
        model = PackinghouseStatement
        fields = [
            'id', 'packinghouse', 'packinghouse_name', 'packinghouse_short_code',
            'original_filename', 'file_size_bytes',
            'statement_type', 'statement_type_display',
            'packinghouse_format', 'format_display',
            'status', 'status_display',
            'extraction_confidence',
            'pool', 'pool_name', 'field', 'field_name',
            'uploaded_by', 'uploaded_by_name',
            'is_processed',
            'created_at'
        ]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.email
        return None


class PackinghouseStatementSerializer(serializers.ModelSerializer):
    """Full serializer for PackinghouseStatement with all details."""
    packinghouse_name = serializers.CharField(source='packinghouse.name', read_only=True)
    packinghouse_short_code = serializers.CharField(source='packinghouse.short_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    statement_type_display = serializers.CharField(source='get_statement_type_display', read_only=True)
    format_display = serializers.CharField(source='get_packinghouse_format_display', read_only=True)
    pool_name = serializers.CharField(source='pool.name', read_only=True, allow_null=True)
    field_name = serializers.CharField(source='field.name', read_only=True, allow_null=True)
    uploaded_by_name = serializers.SerializerMethodField()
    is_processed = serializers.ReadOnlyField()
    has_packout_report = serializers.ReadOnlyField()
    has_pool_settlement = serializers.ReadOnlyField()
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = PackinghouseStatement
        fields = [
            'id', 'packinghouse', 'packinghouse_name', 'packinghouse_short_code',
            'pdf_file', 'pdf_url', 'original_filename', 'file_size_bytes',
            'statement_type', 'statement_type_display',
            'packinghouse_format', 'format_display',
            'status', 'status_display',
            'extracted_data', 'extraction_confidence', 'extraction_error',
            'pool', 'pool_name', 'field', 'field_name',
            'uploaded_by', 'uploaded_by_name',
            'is_processed', 'has_packout_report', 'has_pool_settlement',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'pdf_file', 'original_filename', 'file_size_bytes',
            'extracted_data', 'extraction_confidence', 'extraction_error',
            'uploaded_by', 'created_at', 'updated_at'
        ]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.email
        return None

    def get_pdf_url(self, obj):
        if obj.pdf_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None


class PackinghouseStatementUploadSerializer(serializers.Serializer):
    """Serializer for uploading a new PDF statement."""
    pdf_file = serializers.FileField(
        help_text='PDF file to upload (max 50MB)'
    )
    packinghouse = serializers.PrimaryKeyRelatedField(
        queryset=Packinghouse.objects.all(),
        help_text='Packinghouse ID this statement is from'
    )
    packinghouse_format = serializers.ChoiceField(
        choices=[('', 'Auto-detect'), ('vpoa', 'VPOA'), ('sla', 'SLA'), ('generic', 'Generic')],
        required=False,
        allow_blank=True,
        default='',
        help_text='Format hint (optional, will auto-detect if not specified)'
    )

    def validate_pdf_file(self, value):
        # Check file size (50MB max)
        max_size = 50 * 1024 * 1024  # 50MB
        if value.size > max_size:
            raise serializers.ValidationError(
                f'File too large. Maximum size is 50MB, got {value.size / (1024*1024):.1f}MB'
            )

        # Check file type
        if not value.name.lower().endswith('.pdf'):
            raise serializers.ValidationError('Only PDF files are allowed')

        # Check content type if available
        content_type = getattr(value, 'content_type', None)
        if content_type and content_type != 'application/pdf':
            raise serializers.ValidationError('File must be a PDF')

        return value

    def validate_packinghouse(self, value):
        # Ensure packinghouse belongs to user's company
        request = self.context.get('request')
        if request and request.user.current_company:
            if value.company != request.user.current_company:
                raise serializers.ValidationError('Invalid packinghouse')
        return value
