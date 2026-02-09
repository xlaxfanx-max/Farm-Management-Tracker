from rest_framework import serializers
from .models import FertilizerProduct, NutrientApplication, NutrientPlan


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
