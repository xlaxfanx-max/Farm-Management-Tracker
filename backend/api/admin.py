from django.contrib import admin
from .models import Farm, Field, PesticideProduct, PesticideApplication, WaterSource, WaterTest, FertilizerProduct, NutrientApplication, NutrientPlan

@admin.register(Farm)
class FarmAdmin(admin.ModelAdmin):
    list_display = ['name', 'farm_number', 'county', 'owner_name', 'active']
    list_filter = ['active', 'county']
    search_fields = ['name', 'farm_number', 'owner_name', 'county']
    ordering = ['name']

@admin.register(Field)
class FieldAdmin(admin.ModelAdmin):
    list_display = ['name', 'farm', 'field_number', 'current_crop', 'total_acres', 'county', 'active']
    list_filter = ['active', 'current_crop', 'county']
    search_fields = ['name', 'field_number', 'county']
    ordering = ['name']

@admin.register(PesticideProduct)
class PesticideProductAdmin(admin.ModelAdmin):
    list_display = ['product_name', 'epa_registration_number', 'manufacturer', 'restricted_use']
    list_filter = ['restricted_use', 'formulation_type']
    search_fields = ['product_name', 'epa_registration_number', 'manufacturer']
    ordering = ['product_name']

@admin.register(PesticideApplication)
class PesticideApplicationAdmin(admin.ModelAdmin):
    list_display = ['application_date', 'field', 'product', 'applicator_name', 'status', 'submitted_to_pur']
    list_filter = ['status', 'submitted_to_pur', 'application_date']
    search_fields = ['field__name', 'product__product_name', 'applicator_name']
    date_hierarchy = 'application_date'
    ordering = ['-application_date']

@admin.register(WaterSource)
class WaterSourceAdmin(admin.ModelAdmin):
    list_display = ['name', 'farm', 'source_type', 'test_frequency_days', 'active']
    list_filter = ['active', 'source_type', 'farm']
    search_fields = ['name', 'farm__name']
    filter_horizontal = ['fields_served']
    ordering = ['farm', 'name']

@admin.register(WaterTest)
class WaterTestAdmin(admin.ModelAdmin):
    list_display = ['water_source', 'test_date', 'test_type', 'status', 'ecoli_result']
    list_filter = ['status', 'test_type', 'test_date']
    search_fields = ['water_source__name', 'lab_name']
    date_hierarchy = 'test_date'
    ordering = ['-test_date']

@admin.register(FertilizerProduct)
class FertilizerProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'npk_display', 'form', 'is_organic', 'active']
    list_filter = ['active', 'form', 'is_organic']
    search_fields = ['name', 'manufacturer']
    ordering = ['name']


@admin.register(NutrientApplication)
class NutrientApplicationAdmin(admin.ModelAdmin):
    list_display = ['application_date', 'field', 'product', 'lbs_nitrogen_per_acre', 'application_method']
    list_filter = ['application_method', 'application_date']
    search_fields = ['field__name', 'product__name']
    date_hierarchy = 'application_date'
    ordering = ['-application_date']


@admin.register(NutrientPlan)
class NutrientPlanAdmin(admin.ModelAdmin):
    list_display = ['field', 'year', 'crop', 'planned_nitrogen_lbs_acre', 'status']
    list_filter = ['status', 'year']
    search_fields = ['field__name', 'crop']
    ordering = ['-year', 'field__name']