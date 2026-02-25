from django.urls import path, include
from django.http import JsonResponse
from django.db import connection
from rest_framework.routers import DefaultRouter
from .views import (
    FarmViewSet, FieldViewSet, PesticideProductViewSet,
    FarmParcelViewSet,
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
    load_water_data_api,
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
    company_members, update_company_member, remove_company_member, transfer_ownership,
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
    get_season_dashboard,
    get_multi_crop_season_dashboard,
)

# Import season views
from .season_views import (
    get_season_info,
    get_season_date_range,
    SeasonTemplateViewSet,
    GrowingCycleViewSet,
)

# Import tree detection views (YOLO/DeepForest)
from .tree_detection_views import TreeSurveyViewSet

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
    InspectorReportViewSet,
    NOISubmissionViewSet,
    WaterGMSTVViewSet,
    SGMAReportExportViewSet,
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
    size_distribution,
    size_pricing,
    packinghouse_dashboard,
    harvest_packing_pipeline,
    profitability_analysis,
    deduction_breakdown,
    season_comparison,
    # Settlement Intelligence
    commodity_roi_ranking,
    deduction_creep_analysis,
    grade_size_price_trends,
    packinghouse_report_card,
    pack_percent_impact,
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

# Import yield forecast views
from .yield_views import (
    YieldForecastViewSet,
    YieldFeatureSnapshotViewSet,
    ExternalDataSourceViewSet,
    SoilSurveyDataViewSet,
    yield_forecast_dashboard,
    field_forecast_detail,
    forecast_season_comparison,
)

# Import Primus GFS compliance views
from .primusgfs_views import (
    ControlledDocumentViewSet,
    InternalAuditViewSet,
    AuditFindingViewSet,
    CorrectiveActionViewSet,
    LandHistoryAssessmentViewSet,
    ApprovedSupplierViewSet,
    IncomingMaterialVerificationViewSet,
    MockRecallViewSet,
    FoodDefensePlanViewSet,
    FieldSanitationLogViewSet,
    EquipmentCalibrationViewSet,
    PestControlProgramViewSet,
    PestMonitoringLogViewSet,
    PreHarvestInspectionViewSet,
    PrimusGFSDashboardViewSet,
    # CAC Food Safety Manual V5.0 additions
    FoodSafetyProfileViewSet,
    FoodSafetyRoleAssignmentViewSet,
    FoodSafetyCommitteeMeetingViewSet,
    ManagementVerificationReviewViewSet,
    TrainingRecordViewSet,
    WorkerTrainingSessionViewSet,
    PerimeterMonitoringLogViewSet,
    PreSeasonChecklistViewSet,
    FieldRiskAssessmentViewSet,
    EmployeeNonConformanceViewSet,
    ProductHoldReleaseViewSet,
    SupplierVerificationLogViewSet,
    FoodFraudAssessmentViewSet,
    EmergencyContactViewSet,
    ChemicalInventoryLogViewSet,
    SanitationMaintenanceLogViewSet,
    CACManualPDFViewSet,
)

# Import CAC Audit Binder views
from .audit_binder_views import (
    CACBinderTemplateViewSet,
    AuditBinderInstanceViewSet,
    BinderSectionViewSet,
    BinderSupportingDocumentViewSet,
)

# Import PUR / Tank Mix views
from .pur_views import (
    ProductViewSet as UnifiedProductViewSet,
    ApplicatorViewSet,
    ApplicationEventViewSet,
    pur_import_upload,
    pur_import_confirm,
    pur_match_products,
    pur_match_farms,
    pur_import_batches,
    pur_import_batch_detail,
    pur_import_batch_pdf,
)

# Import FSMA Water Assessment views
from .fsma_water_views import (
    FSMAWaterAssessmentViewSet,
    FSMASourceAssessmentViewSet,
    FSMAFieldAssessmentViewSet,
    FSMAEnvironmentalAssessmentViewSet,
    FSMAMitigationActionViewSet,
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

# Season Management
router.register(r'season-templates', SeasonTemplateViewSet, basename='season-template')
router.register(r'growing-cycles', GrowingCycleViewSet, basename='growing-cycle')

# Tree Detection (YOLO/DeepForest)
router.register(r'tree-surveys', TreeSurveyViewSet, basename='tree-survey')

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
router.register(r'compliance/inspector-report', InspectorReportViewSet, basename='inspector-report')
router.register(r'compliance/noi-submissions', NOISubmissionViewSet, basename='noi-submission')
router.register(r'compliance/water-gm-stv', WaterGMSTVViewSet, basename='water-gm-stv')
router.register(r'compliance/sgma-export', SGMAReportExportViewSet, basename='sgma-export')
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

# FSMA Water Assessment Module
router.register(r'fsma/water-assessments', FSMAWaterAssessmentViewSet, basename='fsma-water-assessment')
router.register(r'fsma/source-assessments', FSMASourceAssessmentViewSet, basename='fsma-source-assessment')
router.register(r'fsma/field-assessments', FSMAFieldAssessmentViewSet, basename='fsma-field-assessment')
router.register(r'fsma/environmental-assessments', FSMAEnvironmentalAssessmentViewSet, basename='fsma-environmental-assessment')
router.register(r'fsma/mitigation-actions', FSMAMitigationActionViewSet, basename='fsma-mitigation-action')

# Primus GFS Compliance
router.register(r'primusgfs/documents', ControlledDocumentViewSet, basename='primusgfs-document')
router.register(r'primusgfs/audits', InternalAuditViewSet, basename='primusgfs-audit')
router.register(r'primusgfs/findings', AuditFindingViewSet, basename='primusgfs-finding')
router.register(r'primusgfs/corrective-actions', CorrectiveActionViewSet, basename='primusgfs-ca')
router.register(r'primusgfs/land-assessments', LandHistoryAssessmentViewSet, basename='primusgfs-land-assessment')
router.register(r'primusgfs/suppliers', ApprovedSupplierViewSet, basename='primusgfs-supplier')
router.register(r'primusgfs/material-verifications', IncomingMaterialVerificationViewSet, basename='primusgfs-material-verification')
router.register(r'primusgfs/mock-recalls', MockRecallViewSet, basename='primusgfs-mock-recall')
router.register(r'primusgfs/food-defense', FoodDefensePlanViewSet, basename='primusgfs-food-defense')
router.register(r'primusgfs/sanitation-logs', FieldSanitationLogViewSet, basename='primusgfs-sanitation-log')
router.register(r'primusgfs/calibrations', EquipmentCalibrationViewSet, basename='primusgfs-calibration')
router.register(r'primusgfs/pest-programs', PestControlProgramViewSet, basename='primusgfs-pest-program')
router.register(r'primusgfs/pest-logs', PestMonitoringLogViewSet, basename='primusgfs-pest-log')
router.register(r'primusgfs/pre-harvest', PreHarvestInspectionViewSet, basename='primusgfs-pre-harvest')
router.register(r'primusgfs/dashboard', PrimusGFSDashboardViewSet, basename='primusgfs-dashboard')
# CAC Food Safety Manual V5.0 additions
router.register(r'primusgfs/food-safety-profile', FoodSafetyProfileViewSet, basename='primusgfs-fs-profile')
router.register(r'primusgfs/org-roles', FoodSafetyRoleAssignmentViewSet, basename='primusgfs-org-role')
router.register(r'primusgfs/committee-meetings', FoodSafetyCommitteeMeetingViewSet, basename='primusgfs-committee-meeting')
router.register(r'primusgfs/management-reviews', ManagementVerificationReviewViewSet, basename='primusgfs-mgmt-review')
router.register(r'primusgfs/training-matrix', TrainingRecordViewSet, basename='primusgfs-training-record')
router.register(r'primusgfs/training-sessions', WorkerTrainingSessionViewSet, basename='primusgfs-training-session')
router.register(r'primusgfs/perimeter-logs', PerimeterMonitoringLogViewSet, basename='primusgfs-perimeter-log')
router.register(r'primusgfs/pre-season-checklists', PreSeasonChecklistViewSet, basename='primusgfs-pre-season')
router.register(r'primusgfs/field-risk-assessments', FieldRiskAssessmentViewSet, basename='primusgfs-field-risk')
router.register(r'primusgfs/non-conformances', EmployeeNonConformanceViewSet, basename='primusgfs-non-conformance')
router.register(r'primusgfs/product-holds', ProductHoldReleaseViewSet, basename='primusgfs-product-hold')
router.register(r'primusgfs/supplier-verifications', SupplierVerificationLogViewSet, basename='primusgfs-supplier-verification')
router.register(r'primusgfs/food-fraud-assessments', FoodFraudAssessmentViewSet, basename='primusgfs-food-fraud')
router.register(r'primusgfs/emergency-contacts', EmergencyContactViewSet, basename='primusgfs-emergency-contact')
router.register(r'primusgfs/chemical-inventory', ChemicalInventoryLogViewSet, basename='primusgfs-chemical-inventory')
router.register(r'primusgfs/sanitation-maintenance', SanitationMaintenanceLogViewSet, basename='primusgfs-sanitation-maintenance')
router.register(r'primusgfs/cac-pdf', CACManualPDFViewSet, basename='primusgfs-cac-pdf')

# CAC Audit Binder (PrimusGFS)
router.register(r'primusgfs/cac-templates', CACBinderTemplateViewSet, basename='primusgfs-cac-template')
router.register(r'primusgfs/audit-binders', AuditBinderInstanceViewSet, basename='primusgfs-audit-binder')
router.register(r'primusgfs/binder-sections', BinderSectionViewSet, basename='primusgfs-binder-section')
router.register(r'primusgfs/binder-documents', BinderSupportingDocumentViewSet, basename='primusgfs-binder-document')

# PUR / Tank Mix
router.register(r'unified-products', UnifiedProductViewSet, basename='unified-product')
router.register(r'applicators', ApplicatorViewSet, basename='applicator')
router.register(r'application-events', ApplicationEventViewSet, basename='application-event')

# Yield Forecast Module
router.register(r'yield-forecast/forecasts', YieldForecastViewSet, basename='yield-forecast')
router.register(r'yield-forecast/feature-snapshots', YieldFeatureSnapshotViewSet, basename='yield-feature-snapshot')
router.register(r'yield-forecast/external-sources', ExternalDataSourceViewSet, basename='external-data-source')
router.register(r'yield-forecast/soil-survey', SoilSurveyDataViewSet, basename='soil-survey')


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
    path('companies/<int:company_id>/transfer-ownership/', transfer_ownership, name='transfer-ownership'),

    # Company Management routes (NEW)
    path('companies/<int:company_id>/', get_company, name='company-detail'),
    path('companies/<int:company_id>/update/', update_company, name='company-update'),
    path('companies/<int:company_id>/stats/', get_company_stats, name='company-stats'),
    
    # Reference data routes (NEW)
    path('reference/california-counties/', get_california_counties, name='california-counties'),
    path('reference/primary-crops/', get_primary_crop_options, name='primary-crops'),

    path('sgma/dashboard/', sgma_dashboard, name='sgma-dashboard'),
    path('sgma/load-water-data/', load_water_data_api, name='load-water-data'),

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
    path('analytics/season-dashboard/', get_season_dashboard, name='analytics-season-dashboard'),
    path('analytics/multi-crop-seasons/', get_multi_crop_season_dashboard, name='analytics-multi-crop-seasons'),

    # Season management routes
    path('seasons/info/', get_season_info, name='season-info'),
    path('seasons/date-range/', get_season_date_range, name='season-date-range'),

    # Quarantine status routes
    path('quarantine/check/', check_quarantine_status, name='quarantine-check'),
    path('quarantine/boundaries/', get_quarantine_boundaries, name='quarantine-boundaries'),

    # Irrigation scheduling routes
    path('irrigation/dashboard/', irrigation_dashboard, name='irrigation-dashboard'),
    path('irrigation/cimis-stations/', cimis_stations, name='cimis-stations'),

    # Packinghouse Pool Tracking analytics routes
    path('packinghouse-analytics/block-performance/', block_performance, name='packinghouse-block-performance'),
    path('packinghouse-analytics/packout-trends/', packout_trends, name='packinghouse-packout-trends'),
    path('packinghouse-analytics/settlement-comparison/', settlement_comparison, name='packinghouse-settlement-comparison'),
    path('packinghouse-analytics/size-distribution/', size_distribution, name='packinghouse-size-distribution'),
    path('packinghouse-analytics/size-pricing/', size_pricing, name='packinghouse-size-pricing'),
    path('packinghouse-analytics/dashboard/', packinghouse_dashboard, name='packinghouse-dashboard'),
    path('harvest-packing/pipeline/', harvest_packing_pipeline, name='harvest-packing-pipeline'),

    # Settlement Intelligence analytics routes
    path('packinghouse-analytics/commodity-roi/', commodity_roi_ranking, name='packinghouse-commodity-roi'),
    path('packinghouse-analytics/deduction-creep/', deduction_creep_analysis, name='packinghouse-deduction-creep'),
    path('packinghouse-analytics/price-trends/', grade_size_price_trends, name='packinghouse-price-trends'),
    path('packinghouse-analytics/report-card/', packinghouse_report_card, name='packinghouse-report-card'),
    path('packinghouse-analytics/pack-impact/', pack_percent_impact, name='packinghouse-pack-impact'),

    # Profitability Analytics routes
    path('harvest-analytics/profitability/', profitability_analysis, name='harvest-profitability'),
    path('harvest-analytics/deductions/', deduction_breakdown, name='harvest-deductions'),
    path('harvest-analytics/seasons/', season_comparison, name='harvest-season-comparison'),

    # PUR Import pipeline
    path('pur-import/upload/', pur_import_upload, name='pur-import-upload'),
    path('pur-import/confirm/', pur_import_confirm, name='pur-import-confirm'),
    path('pur-import/match-products/', pur_match_products, name='pur-match-products'),
    path('pur-import/match-farms/', pur_match_farms, name='pur-match-farms'),
    path('pur-import/batches/', pur_import_batches, name='pur-import-batches'),
    path('pur-import/batches/<str:batch_id>/', pur_import_batch_detail, name='pur-import-batch-detail'),
    path('pur-import/batches/<str:batch_id>/pdf/', pur_import_batch_pdf, name='pur-import-batch-pdf'),

    # Yield Forecast analytics routes
    path('yield-forecast/dashboard/', yield_forecast_dashboard, name='yield-forecast-dashboard'),
    path('yield-forecast/fields/<int:field_id>/detail/', field_forecast_detail, name='yield-forecast-field-detail'),
    path('yield-forecast/season-comparison/', forecast_season_comparison, name='yield-forecast-season-comparison'),
]
