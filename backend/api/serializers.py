from rest_framework import serializers
from .models import Farm, Field, PesticideProduct, PesticideApplication, WaterSource, WaterTest

class FarmSerializer(serializers.ModelSerializer):
    field_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Farm
        fields = [
            'id', 'name', 'farm_number', 'owner_name', 'operator_name',
            'address', 'county', 'phone', 'email', 'active',
            'created_at', 'updated_at', 'field_count'
        ]
    
    def get_field_count(self, obj):
        return obj.fields.count()

class FieldSerializer(serializers.ModelSerializer):
    application_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Field
        fields = [
            'id', 'name', 'field_number', 'county', 'section', 'township', 
            'range_value', 'gps_lat', 'gps_long', 'total_acres', 'current_crop',
            'planting_date', 'active', 'created_at', 'updated_at', 'application_count'
        ]
    
    def get_application_count(self, obj):
        return obj.applications.count()


class PesticideProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = PesticideProduct
        fields = [
            'id', 'epa_registration_number', 'product_name', 'manufacturer',
            'active_ingredients', 'formulation_type', 'restricted_use',
            'created_at', 'updated_at'
        ]


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