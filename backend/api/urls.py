from django.urls import path, include
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
)

# Import auth views
from .auth_views import (
    register, login, logout, refresh_token,
    me, update_profile, change_password, switch_company,
    invite_user, accept_invitation, validate_invitation,
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


urlpatterns = [
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
    path('auth/invitation/<uuid:token>/', validate_invitation, name='auth-validate-invitation'),
    
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
]