from rest_framework import serializers
from .models import WaterSource, WaterTest
from .serializer_mixins import DynamicFieldsMixin


class WaterSourceSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
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
    calibration_due_soon = serializers.SerializerMethodField()

    # Location fields from LocationMixin
    has_coordinates = serializers.ReadOnlyField()
    has_plss = serializers.ReadOnlyField()
    plss_display = serializers.ReadOnlyField()
    effective_location = serializers.ReadOnlyField()
    effective_plss = serializers.ReadOnlyField()

    list_fields = [
        'id', 'name', 'farm', 'farm_name', 'source_type', 'is_well',
        'gsa', 'gsa_display', 'basin', 'basin_display',
        'well_status', 'well_status_display',
        'has_flowmeter', 'flowmeter_units', 'meter_calibration_current',
        'next_calibration_due', 'calibration_due_soon', 'ytd_extraction_af',
        'registered_with_gsa', 'is_de_minimis', 'active'
    ]

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

    def get_calibration_due_soon(self, obj):
        if obj.is_well:
            return obj.is_calibration_due(days_warning=30)
        return None


# Alias for backward compatibility
WaterSourceListSerializer = WaterSourceSerializer


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
