from django.urls import path, include
from django.http import JsonResponse
from django.db import connection
from rest_framework.routers import DefaultRouter
from .views import (
    FarmViewSet, FieldViewSet, PesticideProductViewSet,
    FieldViewSet, FarmParcelViewSet,
    PesticideApplicationViewSet, WaterSourceViewSet, WaterTestViewSet,
    report_statistics,
    BuyerViewSet, LaborContractorViewSet, HarvestViewSet,
    HarvestLoadViewSet, HarvestLaborViewSet,
    geocode_address, update_field_boundary, get_plss,
    WellViewSet, WellReadingViewSet, MeterCalibrationViewSet,
    WaterAllocationViewSet, ExtractionReportViewSet, IrrigationEventViewSet,
    sgma_dashboard,
    FertilizerProductViewSet, NutrientApplicationViewSet, NutrientPlanViewSet,
    nitrogen_summary, nitrogen_export,
    check_quarantine_status, get_quarantine_boundaries,
    IrrigationZoneViewSet, IrrigationRecommendationViewSet,
    CropCoefficientProfileViewSet, SoilMoistureReadingViewSet,
    irrigation_dashboard, cimis_stations,
    CropViewSet, RootstockViewSet,
)

from .audit_views import (
    audit_log_list,
    audit_log_detail,
    audit_log_filters,
    audit_log_export,
    audit_log_statistics,
)

# Import auth views
from .auth_views import (
    register, login, logout, refresh_token,
    me, update_profile, change_password, switch_company,
    invite_user, accept_invitation, accept_invitation_existing, validate_invitation,
    request_password_reset, reset_password, validate_reset_token,
)

# Import team views
from .team_views import (
    available_roles, list_invitations, resend_invitation, revoke_invitation,
    company_members, update_company_member, remove_company_member,
)

from .onboarding_views import (
    get_onboarding_status,
    update_onboarding_step,
    complete_onboarding,
    skip_onboarding,
    reset_onboarding,
)

# Import company views (NEW)
from .company_views import (
    get_company,
    update_company,
    get_company_stats,
    get_california_counties,
    get_primary_crop_options,
)

# Import weather views
from .weather_views import (
    get_current_weather,
    get_weather_forecast,
    get_spray_conditions,
    get_spray_thresholds,
    get_all_farms_weather,
)

# Import analytics views
from .analytics_views import (
    get_analytics_dashboard,
    get_analytics_summary,
)

# Import imagery/tree detection views
from .imagery_views import (
    SatelliteImageViewSet,
    TreeDetectionRunViewSet,
    DetectedTreeViewSet,
    field_trees,
    field_tree_summary,
    field_detection_history,
    export_trees_geojson,
)

# Import LiDAR views
from .lidar_views import (
    LiDARDatasetViewSet,
    LiDARProcessingRunViewSet,
    LiDARDetectedTreeViewSet,
    field_lidar_trees,
    field_lidar_summary,
    field_terrain,
    field_frost_risk,
    field_lidar_history,
    export_lidar_trees_geojson,
)

# Import unified tree identity views
from .tree_views import (
    TreeViewSet,
    FieldTreeViewSet,
    TreeMatchingRunViewSet,
    TreeFeedbackViewSet,
)

# Import compliance views
from .compliance_views import (
    ComplianceProfileViewSet,
    ComplianceDeadlineViewSet,
    ComplianceAlertViewSet,
    LicenseViewSet,
    WPSTrainingRecordViewSet,
    CentralPostingLocationViewSet,
    REIPostingRecordViewSet,
    ComplianceReportViewSet,
    IncidentReportViewSet,
    NotificationPreferenceViewSet,
    ComplianceDashboardViewSet,
)

# Import disease prevention views
from .disease_views import (
    ExternalDetectionViewSet,
    DiseaseAlertViewSet,
    DiseaseAlertRuleViewSet,
    DiseaseAnalysisRunViewSet,
    ScoutingReportViewSet,
    DiseaseDashboardViewSet,
)

# Import packinghouse pool tracking views
from .packinghouse_views import (
    PackinghouseViewSet,
    PoolViewSet,
    PackinghouseDeliveryViewSet,
    PackoutReportViewSet,
    PoolSettlementViewSet,
    GrowerLedgerEntryViewSet,
    PackinghouseStatementViewSet,
    block_performance,
    packout_trends,
    settlement_comparison,
    packinghouse_dashboard,
    harvest_packing_pipeline,
    profitability_analysis,
    deduction_breakdown,
    season_comparison,
)

# Import FSMA compliance views
from .fsma_views import (
    UserSignatureViewSet,
    FacilityLocationViewSet,
    FacilityCleaningLogViewSet,
    VisitorLogViewSet,
    SafetyMeetingViewSet,
    SafetyMeetingAttendeeViewSet,
    FertilizerInventoryViewSet,
    FertilizerInventoryTransactionViewSet,
    MonthlyInventorySnapshotViewSet,
    PHIComplianceCheckViewSet,
    AuditBinderViewSet,
    FSMADashboardViewSet,
)

def health_check(request):
    """Health check endpoint for Railway/container orchestration."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "healthy", "database": "connected"})
    except Exception as e:
        return JsonResponse({"status": "unhealthy", "error": str(e)}, status=503)


router = DefaultRouter()
router.register(r'farms', FarmViewSet, basename='farm')
router.register(r'fields', FieldViewSet, basename='field')
router.register(r'farm-parcels', FarmParcelViewSet, basename='farm-parcel')
router.register(r'products', PesticideProductViewSet, basename='product')
router.register(r'applications', PesticideApplicationViewSet, basename='application')
router.register(r'water-sources', WaterSourceViewSet, basename='watersource')
router.register(r'water-tests', WaterTestViewSet, basename='watertest')
router.register(r'buyers', BuyerViewSet, basename='buyer')
router.register(r'labor-contractors', LaborContractorViewSet, basename='laborcontractor')
router.register(r'harvests', HarvestViewSet, basename='harvest')
router.register(r'harvest-loads', HarvestLoadViewSet, basename='harvestload')
router.register(r'harvest-labor', HarvestLaborViewSet, basename='harvestlabor')
router.register(r'wells', WellViewSet, basename='well')
router.register(r'well-readings', WellReadingViewSet, basename='well-reading')
router.register(r'meter-calibrations', MeterCalibrationViewSet, basename='meter-calibration')
router.register(r'water-allocations', WaterAllocationViewSet, basename='water-allocation')
router.register(r'extraction-reports', ExtractionReportViewSet, basename='extraction-report')
router.register(r'irrigation-events', IrrigationEventViewSet, basename='irrigation-event')
router.register(r'fertilizer-products', FertilizerProductViewSet, basename='fertilizer-product')
router.register(r'nutrient-applications', NutrientApplicationViewSet, basename='nutrient-application')
router.register(r'nutrient-plans', NutrientPlanViewSet, basename='nutrient-plan')
router.register(r'irrigation-zones', IrrigationZoneViewSet, basename='irrigation-zone')
router.register(r'irrigation-recommendations', IrrigationRecommendationViewSet, basename='irrigation-recommendation')
router.register(r'kc-profiles', CropCoefficientProfileViewSet, basename='kc-profile')
router.register(r'soil-moisture-readings', SoilMoistureReadingViewSet, basename='soil-moisture-reading')
router.register(r'crops', CropViewSet, basename='crop')
router.register(r'rootstocks', RootstockViewSet, basename='rootstock')

# Satellite Imagery & Tree Detection
router.register(r'satellite-images', SatelliteImageViewSet, basename='satellite-image')
router.register(r'detection-runs', TreeDetectionRunViewSet, basename='detection-run')
router.register(r'detected-trees', DetectedTreeViewSet, basename='detected-tree')

# LiDAR Processing
router.register(r'lidar-datasets', LiDARDatasetViewSet, basename='lidar-dataset')
router.register(r'lidar-runs', LiDARProcessingRunViewSet, basename='lidar-run')
router.register(r'lidar-trees', LiDARDetectedTreeViewSet, basename='lidar-tree')

# Unified Tree Identity
router.register(r'trees', TreeViewSet, basename='tree')
router.register(r'tree-matching-runs', TreeMatchingRunViewSet, basename='tree-matching-run')
router.register(r'tree-feedback', TreeFeedbackViewSet, basename='tree-feedback')

# Compliance Management
router.register(r'compliance/profile', ComplianceProfileViewSet, basename='compliance-profile')
router.register(r'compliance/deadlines', ComplianceDeadlineViewSet, basename='compliance-deadline')
router.register(r'compliance/alerts', ComplianceAlertViewSet, basename='compliance-alert')
router.register(r'compliance/licenses', LicenseViewSet, basename='license')
router.register(r'compliance/wps-training', WPSTrainingRecordViewSet, basename='wps-training')
router.register(r'compliance/posting-locations', CentralPostingLocationViewSet, basename='posting-location')
router.register(r'compliance/rei-postings', REIPostingRecordViewSet, basename='rei-posting')
router.register(r'compliance/reports', ComplianceReportViewSet, basename='compliance-report')
router.register(r'compliance/incidents', IncidentReportViewSet, basename='incident')
router.register(r'compliance/notification-preferences', NotificationPreferenceViewSet, basename='notification-preference')
router.register(r'compliance/dashboard', ComplianceDashboardViewSet, basename='compliance-dashboard')

# Disease Prevention
router.register(r'disease/external-detections', ExternalDetectionViewSet, basename='external-detection')
router.register(r'disease/alerts', DiseaseAlertViewSet, basename='disease-alert')
router.register(r'disease/alert-rules', DiseaseAlertRuleViewSet, basename='disease-alert-rule')
router.register(r'disease/analyses', DiseaseAnalysisRunViewSet, basename='disease-analysis')
router.register(r'disease/scouting', ScoutingReportViewSet, basename='scouting-report')
router.register(r'disease/dashboard', DiseaseDashboardViewSet, basename='disease-dashboard')

# Packinghouse Pool Tracking
router.register(r'packinghouses', PackinghouseViewSet, basename='packinghouse')
router.register(r'pools', PoolViewSet, basename='pool')
router.register(r'packinghouse-deliveries', PackinghouseDeliveryViewSet, basename='packinghouse-delivery')
router.register(r'packout-reports', PackoutReportViewSet, basename='packout-report')
router.register(r'pool-settlements', PoolSettlementViewSet, basename='pool-settlement')
router.register(r'grower-ledger', GrowerLedgerEntryViewSet, basename='grower-ledger')
router.register(r'packinghouse-statements', PackinghouseStatementViewSet, basename='packinghouse-statement')

# FSMA Compliance Module
router.register(r'fsma/user-signature', UserSignatureViewSet, basename='fsma-user-signature')
router.register(r'fsma/facilities', FacilityLocationViewSet, basename='fsma-facility')
router.register(r'fsma/cleaning-logs', FacilityCleaningLogViewSet, basename='fsma-cleaning-log')
router.register(r'fsma/visitor-logs', VisitorLogViewSet, basename='fsma-visitor-log')
router.register(r'fsma/safety-meetings', SafetyMeetingViewSet, basename='fsma-safety-meeting')
router.register(r'fsma/meeting-attendees', SafetyMeetingAttendeeViewSet, basename='fsma-meeting-attendee')
router.register(r'fsma/fertilizer-inventory', FertilizerInventoryViewSet, basename='fsma-fertilizer-inventory')
router.register(r'fsma/inventory-transactions', FertilizerInventoryTransactionViewSet, basename='fsma-inventory-transaction')
router.register(r'fsma/inventory-snapshots', MonthlyInventorySnapshotViewSet, basename='fsma-inventory-snapshot')
router.register(r'fsma/phi-checks', PHIComplianceCheckViewSet, basename='fsma-phi-check')
router.register(r'fsma/audit-binders', AuditBinderViewSet, basename='fsma-audit-binder')
router.register(r'fsma/dashboard', FSMADashboardViewSet, basename='fsma-dashboard')


urlpatterns = [
    # Health check (no auth required) - must be first for Railway
    path('health/', health_check, name='health-check'),

    path('', include(router.urls)),
    path('reports/statistics/', report_statistics, name='report-statistics'),
    path('geocode/', geocode_address, name='geocode-address'),  
    path('fields/<int:field_id>/boundary/', update_field_boundary, name='update-field-boundary'), 
    path('plss/', get_plss, name='get-plss'),
    
    # Auth routes
    path('auth/register/', register, name='auth-register'),
    path('auth/login/', login, name='auth-login'),
    path('auth/logout/', logout, name='auth-logout'),
    path('auth/refresh/', refresh_token, name='auth-refresh'),
    path('auth/me/', me, name='auth-me'),
    path('auth/profile/', update_profile, name='auth-profile'),
    path('auth/change-password/', change_password, name='auth-change-password'),
    path('auth/switch-company/', switch_company, name='auth-switch-company'),
    path('auth/invite/', invite_user, name='auth-invite'),
    path('auth/accept-invitation/', accept_invitation, name='auth-accept-invitation'),
    path('auth/accept-invitation-existing/', accept_invitation_existing, name='auth-accept-invitation-existing'),
    path('auth/invitation/<uuid:token>/', validate_invitation, name='auth-validate-invitation'),

    # Password reset routes
    path('auth/forgot-password/', request_password_reset, name='auth-forgot-password'),
    path('auth/reset-password/', reset_password, name='auth-reset-password'),
    path('auth/reset-password/<str:token>/', validate_reset_token, name='auth-validate-reset-token'),

    # Team/Roles routes
    path('roles/available/', available_roles, name='available-roles'),
    path('invitations/', list_invitations, name='list-invitations'),
    path('invitations/<int:invitation_id>/resend/', resend_invitation, name='resend-invitation'),
    path('invitations/<int:invitation_id>/', revoke_invitation, name='revoke-invitation'),
    path('companies/<int:company_id>/members/', company_members, name='company-members'),
    path('companies/<int:company_id>/members/<int:member_id>/', update_company_member, name='update-company-member'),
    path('companies/<int:company_id>/members/<int:member_id>/remove/', remove_company_member, name='remove-company-member'),

    # Company Management routes (NEW)
    path('companies/<int:company_id>/', get_company, name='company-detail'),
    path('companies/<int:company_id>/update/', update_company, name='company-update'),
    path('companies/<int:company_id>/stats/', get_company_stats, name='company-stats'),
    
    # Reference data routes (NEW)
    path('reference/california-counties/', get_california_counties, name='california-counties'),
    path('reference/primary-crops/', get_primary_crop_options, name='primary-crops'),

    path('sgma/dashboard/', sgma_dashboard, name='sgma-dashboard'),

    path('reports/nitrogen-summary/', nitrogen_summary, name='nitrogen-summary'),
    path('reports/nitrogen-export/', nitrogen_export, name='nitrogen-export'),

    # Onboarding routes
    path('onboarding/status/', get_onboarding_status, name='onboarding-status'),
    path('onboarding/step/', update_onboarding_step, name='onboarding-step'),
    path('onboarding/complete/', complete_onboarding, name='onboarding-complete'),
    path('onboarding/skip/', skip_onboarding, name='onboarding-skip'),
    path('onboarding/reset/', reset_onboarding, name='onboarding-reset'),

    path('audit-logs/', audit_log_list, name='audit-log-list'),
    path('audit-logs/filters/', audit_log_filters, name='audit-log-filters'),
    path('audit-logs/export/', audit_log_export, name='audit-log-export'),
    path('audit-logs/statistics/', audit_log_statistics, name='audit-log-statistics'),
    path('audit-logs/<int:pk>/', audit_log_detail, name='audit-log-detail'),

    # Weather routes
    path('weather/current/<int:farm_id>/', get_current_weather, name='weather-current'),
    path('weather/forecast/<int:farm_id>/', get_weather_forecast, name='weather-forecast'),
    path('weather/spray-conditions/<int:farm_id>/', get_spray_conditions, name='weather-spray-conditions'),
    path('weather/thresholds/', get_spray_thresholds, name='weather-thresholds'),
    path('weather/farms/', get_all_farms_weather, name='weather-all-farms'),

    # Analytics routes
    path('analytics/dashboard/', get_analytics_dashboard, name='analytics-dashboard'),
    path('analytics/summary/', get_analytics_summary, name='analytics-summary'),

    # Quarantine status routes
    path('quarantine/check/', check_quarantine_status, name='quarantine-check'),
    path('quarantine/boundaries/', get_quarantine_boundaries, name='quarantine-boundaries'),

    # Irrigation scheduling routes
    path('irrigation/dashboard/', irrigation_dashboard, name='irrigation-dashboard'),
    path('irrigation/cimis-stations/', cimis_stations, name='cimis-stations'),

    # Tree detection routes (field-centric)
    path('fields/<int:field_id>/trees/', field_trees, name='field-trees'),
    path('fields/<int:field_id>/tree-summary/', field_tree_summary, name='field-tree-summary'),
    path('fields/<int:field_id>/detection-history/', field_detection_history, name='field-detection-history'),
    path('fields/<int:field_id>/trees/export/', export_trees_geojson, name='field-trees-export'),

    # LiDAR routes (field-centric)
    path('fields/<int:field_id>/lidar-trees/', field_lidar_trees, name='field-lidar-trees'),
    path('fields/<int:field_id>/lidar-summary/', field_lidar_summary, name='field-lidar-summary'),
    path('fields/<int:field_id>/terrain/', field_terrain, name='field-terrain'),
    path('fields/<int:field_id>/frost-risk/', field_frost_risk, name='field-frost-risk'),
    path('fields/<int:field_id>/lidar-history/', field_lidar_history, name='field-lidar-history'),
    path('fields/<int:field_id>/lidar-trees/export/', export_lidar_trees_geojson, name='field-lidar-trees-export'),

    # Unified Tree Identity routes (field-centric)
    path('fields/<int:pk>/unified-trees/', FieldTreeViewSet.as_view({'get': 'unified_trees'}), name='field-unified-trees'),
    path('fields/<int:pk>/tree-summary/', FieldTreeViewSet.as_view({'get': 'tree_summary'}), name='field-tree-summary-unified'),
    path('fields/<int:pk>/tree-timeline/', FieldTreeViewSet.as_view({'get': 'tree_timeline'}), name='field-tree-timeline'),
    path('fields/<int:pk>/match-trees/', FieldTreeViewSet.as_view({'post': 'match_trees'}), name='field-match-trees'),

    # Packinghouse Pool Tracking analytics routes
    path('packinghouse-analytics/block-performance/', block_performance, name='packinghouse-block-performance'),
    path('packinghouse-analytics/packout-trends/', packout_trends, name='packinghouse-packout-trends'),
    path('packinghouse-analytics/settlement-comparison/', settlement_comparison, name='packinghouse-settlement-comparison'),
    path('packinghouse-analytics/dashboard/', packinghouse_dashboard, name='packinghouse-dashboard'),
    path('harvest-packing/pipeline/', harvest_packing_pipeline, name='harvest-packing-pipeline'),

    # Profitability Analytics routes
    path('harvest-analytics/profitability/', profitability_analysis, name='harvest-profitability'),
    path('harvest-analytics/deductions/', deduction_breakdown, name='harvest-deductions'),
    path('harvest-analytics/seasons/', season_comparison, name='harvest-season-comparison'),
]
