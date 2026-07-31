from django.contrib import admin
from django.contrib import messages
from .models import (
    Farm, Field, PesticideProduct, PesticideApplication, WaterSource, WaterTest,
    FertilizerProduct, NutrientApplication, NutrientPlan,
    Crop, Rootstock,
    SeasonTemplate, GrowingCycle,
)

@admin.register(Farm)
class FarmAdmin(admin.ModelAdmin):
    list_display = ['name', 'farm_number', 'county', 'owner_name', 'active']
    list_filter = ['active', 'county']
    search_fields = ['name', 'farm_number', 'owner_name', 'county']
    ordering = ['name']

@admin.register(Crop)
class CropAdmin(admin.ModelAdmin):
    list_display = ['name', 'variety', 'category', 'crop_type', 'company', 'active']
    list_filter = ['active', 'category', 'crop_type', 'company']
    search_fields = ['name', 'variety', 'scientific_name']
    ordering = ['category', 'name']

    fieldsets = (
        ('Identification', {
            'fields': ('name', 'scientific_name', 'variety')
        }),
        ('Classification', {
            'fields': ('category', 'crop_type')
        }),
        ('Agronomic Characteristics', {
            'fields': (
                'typical_spacing_row_ft', 'typical_spacing_tree_ft',
                'typical_root_depth_inches', 'years_to_maturity',
                'productive_lifespan_years'
            ),
            'classes': ('collapse',)
        }),
        ('Water/Irrigation', {
            'fields': ('kc_mature', 'kc_young'),
            'classes': ('collapse',)
        }),
        ('Harvest', {
            'fields': ('typical_harvest_months', 'default_bin_weight_lbs'),
            'classes': ('collapse',)
        }),
        ('Ownership & Status', {
            'fields': ('company', 'active', 'notes')
        }),
    )


@admin.register(Rootstock)
class RootstockAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'primary_category', 'vigor', 'company', 'active']
    list_filter = ['active', 'primary_category', 'vigor', 'company']
    search_fields = ['name', 'code']
    filter_horizontal = ['compatible_crops']
    ordering = ['primary_category', 'name']


@admin.register(Field)
class FieldAdmin(admin.ModelAdmin):
    list_display = ['name', 'farm', 'field_number', 'crop', 'rootstock', 'total_acres', 'county', 'active']
    list_filter = ['active', 'crop__category', 'organic_status', 'county']
    search_fields = ['name', 'field_number', 'county', 'crop__name']
    autocomplete_fields = ['crop', 'rootstock']
    ordering = ['name']

    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'farm', 'field_number', 'county', 'total_acres')
        }),
        ('Crop Information', {
            'fields': ('crop', 'rootstock', 'current_crop', 'planting_date', 'year_planted')
        }),
        ('Spacing & Density', {
            'fields': ('row_spacing_ft', 'tree_spacing_ft', 'tree_count', 'trees_per_acre', 'row_orientation', 'trellis_system'),
            'classes': ('collapse',)
        }),
        ('Soil & Irrigation', {
            'fields': ('soil_type', 'irrigation_type'),
            'classes': ('collapse',)
        }),
        ('Production', {
            'fields': ('expected_yield_per_acre', 'yield_unit'),
            'classes': ('collapse',)
        }),
        ('Certification', {
            'fields': ('organic_status', 'organic_certifier', 'organic_cert_number', 'organic_cert_expiration'),
            'classes': ('collapse',)
        }),
        ('Location', {
            'fields': ('gps_latitude', 'gps_longitude', 'plss_section', 'plss_township', 'plss_range', 'plss_meridian', 'boundary_geojson'),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('active', 'notes')
        }),
    )

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


# =============================================================================
# SEASON MANAGEMENT ADMIN
# =============================================================================

@admin.register(SeasonTemplate)
class SeasonTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'season_type', 'start_month', 'duration_months', 'crosses_calendar_year', 'company', 'active']
    list_filter = ['active', 'season_type', 'crosses_calendar_year', 'company']
    search_fields = ['name']
    ordering = ['name']

    fieldsets = (
        ('Identification', {
            'fields': ('name', 'season_type')
        }),
        ('Date Configuration', {
            'fields': ('start_month', 'start_day', 'duration_months', 'crosses_calendar_year')
        }),
        ('Display', {
            'fields': ('label_format', 'applicable_categories')
        }),
        ('Ownership', {
            'fields': ('company', 'active')
        }),
    )


@admin.register(GrowingCycle)
class GrowingCycleAdmin(admin.ModelAdmin):
    list_display = ['field', 'year', 'cycle_number', 'crop', 'status', 'planting_date', 'expected_harvest_end']
    list_filter = ['status', 'year', 'field__farm__company']
    search_fields = ['field__name', 'crop__name']
    ordering = ['-year', 'cycle_number']
    raw_id_fields = ['field', 'crop']

    fieldsets = (
        ('Identification', {
            'fields': ('field', 'year', 'cycle_number', 'crop')
        }),
        ('Dates', {
            'fields': ('planting_date', 'expected_harvest_start', 'expected_harvest_end', 'actual_harvest_date')
        }),
        ('Growing Parameters', {
            'fields': ('days_to_maturity', 'status')
        }),
        ('Notes', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
    )