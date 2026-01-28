from django.contrib import admin
from django.contrib import messages
from .models import (
    Farm, Field, PesticideProduct, PesticideApplication, WaterSource, WaterTest,
    FertilizerProduct, NutrientApplication, NutrientPlan,
    Crop, Rootstock,
    ExternalDetection, QuarantineZone, DiseaseAlertRule, DiseaseAnalysisRun,
    DiseaseAlert, ScoutingReport, ScoutingPhoto,
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
# DISEASE PREVENTION ADMIN
# =============================================================================

@admin.register(ExternalDetection)
class ExternalDetectionAdmin(admin.ModelAdmin):
    """Admin interface for external disease detections (CDFA, etc.)."""
    list_display = [
        'disease_name', 'disease_type', 'county', 'city',
        'detection_date', 'location_type', 'source', 'is_active'
    ]
    list_filter = ['disease_type', 'source', 'location_type', 'is_active', 'county']
    search_fields = ['disease_name', 'county', 'city', 'notes']
    date_hierarchy = 'detection_date'
    ordering = ['-detection_date']
    actions = ['sync_cdfa_data']

    @admin.action(description="Sync data from CDFA (detections & quarantine zones)")
    def sync_cdfa_data(self, request, queryset):
        """Admin action to trigger CDFA data sync."""
        try:
            from api.services.cdfa_data_sync import CDFADataSync
            sync = CDFADataSync()
            results = sync.sync_all()

            summary = results.get('summary', {})
            self.message_user(
                request,
                f"CDFA sync completed: {summary.get('total_created', 0)} created, "
                f"{summary.get('total_updated', 0)} updated, "
                f"{summary.get('total_errors', 0)} errors",
                messages.SUCCESS
            )
        except Exception as e:
            self.message_user(
                request,
                f"CDFA sync failed: {str(e)}",
                messages.ERROR
            )

    fieldsets = (
        ('Disease Information', {
            'fields': ('disease_type', 'disease_name')
        }),
        ('Location', {
            'fields': ('latitude', 'longitude', 'county', 'city', 'location_type')
        }),
        ('Source & Dates', {
            'fields': ('source', 'source_id', 'detection_date', 'reported_date')
        }),
        ('Status', {
            'fields': ('is_active', 'eradication_date', 'notes')
        }),
        ('Raw Data', {
            'fields': ('raw_data',),
            'classes': ('collapse',)
        }),
    )


@admin.register(QuarantineZone)
class QuarantineZoneAdmin(admin.ModelAdmin):
    """Admin interface for quarantine zone boundaries."""
    list_display = [
        'name', 'zone_type', 'county', 'established_date', 'is_active'
    ]
    list_filter = ['zone_type', 'is_active', 'county', 'state']
    search_fields = ['name', 'description', 'county']
    date_hierarchy = 'established_date'
    ordering = ['-established_date']
    actions = ['sync_cdfa_zones']

    @admin.action(description="Sync quarantine zones from CDFA")
    def sync_cdfa_zones(self, request, queryset):
        """Admin action to trigger CDFA quarantine zone sync."""
        try:
            from api.services.cdfa_data_sync import CDFADataSync
            sync = CDFADataSync()

            # Sync both ACP and HLB zones
            acp_results = sync.sync_acp_quarantine_zones()
            hlb_results = sync.sync_hlb_quarantine_zones()

            total_created = acp_results.get('created', 0) + hlb_results.get('created', 0)
            total_updated = acp_results.get('updated', 0) + hlb_results.get('updated', 0)

            self.message_user(
                request,
                f"Quarantine zone sync completed: {total_created} created, {total_updated} updated. "
                f"(ACP: {acp_results.get('total_fetched', 0)} from CDFA API)",
                messages.SUCCESS
            )
        except Exception as e:
            self.message_user(
                request,
                f"Zone sync failed: {str(e)}",
                messages.ERROR
            )

    fieldsets = (
        ('Zone Information', {
            'fields': ('zone_type', 'name', 'description')
        }),
        ('Geographic Boundary', {
            'fields': ('boundary', 'county', 'state'),
            'description': 'Enter GeoJSON Polygon geometry for the quarantine boundary.'
        }),
        ('Source & Dates', {
            'fields': ('source', 'source_url', 'source_id', 'established_date', 'expires_date')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )


@admin.register(DiseaseAlertRule)
class DiseaseAlertRuleAdmin(admin.ModelAdmin):
    """Admin interface for disease alert rules."""
    list_display = [
        'name', 'company', 'rule_type', 'alert_priority',
        'send_email', 'send_sms', 'is_active'
    ]
    list_filter = ['rule_type', 'alert_priority', 'is_active', 'company']
    search_fields = ['name', 'description']
    ordering = ['company', 'name']

    fieldsets = (
        ('Rule Definition', {
            'fields': ('company', 'name', 'description', 'rule_type')
        }),
        ('Conditions', {
            'fields': ('conditions', 'alert_priority')
        }),
        ('Notification Settings', {
            'fields': ('send_email', 'send_sms', 'send_immediately')
        }),
        ('Status', {
            'fields': ('is_active', 'created_by')
        }),
    )


@admin.register(DiseaseAnalysisRun)
class DiseaseAnalysisRunAdmin(admin.ModelAdmin):
    """Admin interface for disease analysis runs."""
    list_display = [
        'field', 'status', 'health_score', 'risk_level',
        'total_trees_analyzed', 'created_at'
    ]
    list_filter = ['status', 'risk_level', 'analysis_type']
    search_fields = ['field__name', 'field__farm__name']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    readonly_fields = [
        'avg_ndvi', 'ndvi_change_30d', 'ndvi_change_90d',
        'canopy_coverage_percent', 'canopy_change_30d',
        'total_trees_analyzed', 'trees_healthy', 'trees_mild_stress',
        'trees_moderate_stress', 'trees_severe_stress', 'trees_declining',
        'health_score', 'risk_level', 'risk_factors', 'anomaly_zones',
        'anomaly_count', 'recommendations', 'created_at', 'completed_at'
    ]


@admin.register(DiseaseAlert)
class DiseaseAlertAdmin(admin.ModelAdmin):
    """Admin interface for disease alerts."""
    list_display = [
        'title', 'company', 'alert_type', 'priority',
        'farm', 'distance_miles', 'is_active', 'is_acknowledged', 'created_at'
    ]
    list_filter = ['alert_type', 'priority', 'is_active', 'is_acknowledged', 'company']
    search_fields = ['title', 'message', 'farm__name', 'field__name']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']

    fieldsets = (
        ('Alert Details', {
            'fields': ('company', 'farm', 'field', 'alert_type', 'priority', 'title', 'message')
        }),
        ('Context', {
            'fields': ('distance_miles', 'related_detection', 'related_analysis')
        }),
        ('Actions', {
            'fields': ('recommended_actions', 'action_url', 'action_label')
        }),
        ('Status', {
            'fields': ('is_active', 'is_acknowledged', 'acknowledged_by', 'acknowledged_at', 'expires_at')
        }),
        ('Notifications', {
            'fields': ('email_sent', 'email_sent_at', 'sms_sent', 'sms_sent_at'),
            'classes': ('collapse',)
        }),
    )


class ScoutingPhotoInline(admin.TabularInline):
    """Inline admin for scouting photos."""
    model = ScoutingPhoto
    extra = 0
    readonly_fields = ['uploaded_at']


@admin.register(ScoutingReport)
class ScoutingReportAdmin(admin.ModelAdmin):
    """Admin interface for scouting reports."""
    list_display = [
        'report_type', 'company', 'farm', 'severity',
        'status', 'observed_date', 'reported_by'
    ]
    list_filter = ['report_type', 'severity', 'status', 'company']
    search_fields = ['notes', 'farm__name', 'field__name']
    date_hierarchy = 'observed_date'
    ordering = ['-created_at']
    inlines = [ScoutingPhotoInline]

    fieldsets = (
        ('Report Details', {
            'fields': ('company', 'reported_by', 'farm', 'field', 'report_type')
        }),
        ('Location', {
            'fields': ('latitude', 'longitude')
        }),
        ('Observations', {
            'fields': ('symptoms', 'severity', 'affected_tree_count', 'notes', 'observed_date')
        }),
        ('Verification', {
            'fields': ('status', 'verified_by', 'verification_notes')
        }),
        ('AI Analysis', {
            'fields': ('ai_analysis_status', 'ai_diagnosis'),
            'classes': ('collapse',)
        }),
        ('Sharing', {
            'fields': ('share_anonymously', 'is_public')
        }),
    )


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