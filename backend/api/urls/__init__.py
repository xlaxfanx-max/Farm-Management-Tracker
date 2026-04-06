from django.urls import path, include
from django.http import JsonResponse
from django.db import connection

from ..audit_views import (
    audit_log_list,
    audit_log_detail,
    audit_log_filters,
    audit_log_export,
    audit_log_statistics,
)

from ..auth_views import (
    register, login, logout, refresh_token,
    me, update_profile, change_password, switch_company,
    invite_user, accept_invitation, accept_invitation_existing, validate_invitation,
    request_password_reset, reset_password, validate_reset_token,
)

from ..team_views import (
    available_roles, list_invitations, resend_invitation, revoke_invitation,
    company_members, update_company_member, remove_company_member, transfer_ownership,
)

from ..onboarding_views import (
    get_onboarding_status,
    update_onboarding_step,
    complete_onboarding,
    skip_onboarding,
    reset_onboarding,
)

from ..company_views import (
    get_company,
    update_company,
    get_company_stats,
    get_california_counties,
    get_primary_crop_options,
)


def health_check(request):
    """Health check endpoint for Railway/container orchestration."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "healthy", "database": "connected"})
    except Exception as e:
        return JsonResponse({"status": "unhealthy", "error": str(e)}, status=503)


urlpatterns = [
    # Health check (no auth required) - must be first for Railway
    path('health/', health_check, name='health-check'),

    # Domain-specific URL modules
    path('', include('api.urls.farm_urls')),
    path('', include('api.urls.water_urls')),
    path('', include('api.urls.harvest_urls')),
    path('', include('api.urls.compliance_urls')),
    path('', include('api.urls.fsma_urls')),
    path('', include('api.urls.packinghouse_urls')),
    path('', include('api.urls.primusgfs_urls')),
    path('', include('api.urls.other_urls')),

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

    # Company Management routes
    path('companies/<int:company_id>/', get_company, name='company-detail'),
    path('companies/<int:company_id>/update/', update_company, name='company-update'),
    path('companies/<int:company_id>/stats/', get_company_stats, name='company-stats'),

    # Reference data routes
    path('reference/california-counties/', get_california_counties, name='california-counties'),
    path('reference/primary-crops/', get_primary_crop_options, name='primary-crops'),

    # Onboarding routes
    path('onboarding/status/', get_onboarding_status, name='onboarding-status'),
    path('onboarding/step/', update_onboarding_step, name='onboarding-step'),
    path('onboarding/complete/', complete_onboarding, name='onboarding-complete'),
    path('onboarding/skip/', skip_onboarding, name='onboarding-skip'),
    path('onboarding/reset/', reset_onboarding, name='onboarding-reset'),

    # Audit log routes
    path('audit-logs/', audit_log_list, name='audit-log-list'),
    path('audit-logs/filters/', audit_log_filters, name='audit-log-filters'),
    path('audit-logs/export/', audit_log_export, name='audit-log-export'),
    path('audit-logs/statistics/', audit_log_statistics, name='audit-log-statistics'),
    path('audit-logs/<int:pk>/', audit_log_detail, name='audit-log-detail'),
]
