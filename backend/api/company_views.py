"""
Company Management Views

Handles company information retrieval and updates.
Only company owners can update company information.

Place this file at: backend/api/company_views.py
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Company, CompanyMembership, Farm, Field, WaterSource, PesticideApplication
from .serializers import CompanySerializer
from .permissions import HasCompanyAccess


def is_company_owner(user, company):
    """
    Check if user is the owner of the company.
    Returns True if user has 'owner' role for this company.
    """
    try:
        membership = CompanyMembership.objects.get(
            user=user,
            company=company,
            is_active=True
        )
        return membership.role.codename == 'owner'
    except CompanyMembership.DoesNotExist:
        return False


def is_company_member(user, company):
    """
    Check if user is a member of the company.
    """
    return CompanyMembership.objects.filter(
        user=user,
        company=company,
        is_active=True
    ).exists()


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def get_company(request, company_id):
    """
    Get company details.
    
    Users can view their own company's information.
    
    GET /api/companies/<company_id>/
    """
    company = get_object_or_404(Company, pk=company_id)
    
    # Check if user is a member of this company
    if not is_company_member(request.user, company):
        return Response(
            {'detail': 'You do not have permission to view this company.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    serializer = CompanySerializer(company)
    data = serializer.data
    
    # Add user's role in the response
    try:
        membership = CompanyMembership.objects.select_related('role').get(
            user=request.user,
            company=company,
            is_active=True
        )
        
        # Handle case where role might be None
        if membership.role:
            data['user_role'] = membership.role.codename
            data['user_role_name'] = membership.role.name
            data['is_owner'] = membership.role.codename == 'owner'
        else:
            data['user_role'] = None
            data['user_role_name'] = None
            data['is_owner'] = False
            
    except CompanyMembership.DoesNotExist:
        data['user_role'] = None
        data['user_role_name'] = None
        data['is_owner'] = False
    
    return Response(data)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def update_company(request, company_id):
    """
    Update company information.
    
    Only company owners can update company information.
    
    PUT/PATCH /api/companies/<company_id>/
    """
    company = get_object_or_404(Company, pk=company_id)
    
    # Check if user is the owner
    if not is_company_owner(request.user, company):
        return Response(
            {'detail': 'Only company owners can update company information.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Fields that cannot be updated via this endpoint (admin only)
    protected_fields = [
        'uuid', 
        'subscription_tier', 'subscription_start', 'subscription_end',
        'max_farms', 'max_users', 
        'is_active', 
        'created_at', 'updated_at',
        'onboarding_completed', 'onboarding_step', 'onboarding_completed_at'
    ]
    
    # Remove protected fields from request data
    data = request.data.copy()
    for field in protected_fields:
        data.pop(field, None)
    
    serializer = CompanySerializer(company, data=data, partial=True)
    
    if serializer.is_valid():
        serializer.save()
        
        # Return updated data with user role info
        response_data = serializer.data
        response_data['is_owner'] = True
        
        return Response(response_data)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def get_company_stats(request, company_id):
    """
    Get company usage statistics.
    
    Returns counts of farms, fields, users, etc.
    
    GET /api/companies/<company_id>/stats/
    """
    company = get_object_or_404(Company, pk=company_id)
    
    # Check if user is a member of this company
    if not is_company_member(request.user, company):
        return Response(
            {'detail': 'You do not have permission to view this company.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Calculate statistics
    farm_count = Farm.objects.filter(company=company, active=True).count()
    field_count = Field.objects.filter(farm__company=company, active=True).count()
    user_count = CompanyMembership.objects.filter(company=company, is_active=True).count()
    water_source_count = WaterSource.objects.filter(farm__company=company, is_active=True).count()
    application_count = PesticideApplication.objects.filter(field__farm__company=company).count()
    
    # Calculate total acreage
    from django.db.models import Sum
    total_acreage = Field.objects.filter(
        farm__company=company, 
        active=True
    ).aggregate(total=Sum('total_acres'))['total'] or 0
    
    stats = {
        'farms': {
            'count': farm_count,
            'limit': company.max_farms,
            'remaining': company.max_farms - farm_count,
            'at_limit': farm_count >= company.max_farms,
        },
        'fields': {
            'count': field_count,
        },
        'users': {
            'count': user_count,
            'limit': company.max_users,
            'remaining': company.max_users - user_count,
            'at_limit': user_count >= company.max_users,
        },
        'water_sources': {
            'count': water_source_count,
        },
        'applications': {
            'count': application_count,
        },
        'total_acreage': float(total_acreage),
    }
    
    return Response(stats)


# =============================================================================
# California Counties Reference Data
# =============================================================================

CALIFORNIA_COUNTIES = [
    'Alameda', 'Alpine', 'Amador', 'Butte', 'Calaveras', 'Colusa',
    'Contra Costa', 'Del Norte', 'El Dorado', 'Fresno', 'Glenn',
    'Humboldt', 'Imperial', 'Inyo', 'Kern', 'Kings', 'Lake', 'Lassen',
    'Los Angeles', 'Madera', 'Marin', 'Mariposa', 'Mendocino', 'Merced',
    'Modoc', 'Mono', 'Monterey', 'Napa', 'Nevada', 'Orange', 'Placer',
    'Plumas', 'Riverside', 'Sacramento', 'San Benito', 'San Bernardino',
    'San Diego', 'San Francisco', 'San Joaquin', 'San Luis Obispo',
    'San Mateo', 'Santa Barbara', 'Santa Clara', 'Santa Cruz', 'Shasta',
    'Sierra', 'Siskiyou', 'Solano', 'Sonoma', 'Stanislaus', 'Sutter',
    'Tehama', 'Trinity', 'Tulare', 'Tuolumne', 'Ventura', 'Yolo', 'Yuba'
]


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def get_california_counties(request):
    """
    Get list of California counties.
    
    GET /api/reference/california-counties/
    """
    return Response(CALIFORNIA_COUNTIES)


# =============================================================================
# Primary Crop Options Reference Data  
# =============================================================================

PRIMARY_CROP_OPTIONS = [
    {'value': 'citrus_lemons', 'label': 'Citrus - Lemons'},
    {'value': 'citrus_oranges', 'label': 'Citrus - Oranges'},
    {'value': 'citrus_mandarins', 'label': 'Citrus - Mandarins'},
    {'value': 'citrus_grapefruit', 'label': 'Citrus - Grapefruit'},
    {'value': 'citrus_mixed', 'label': 'Citrus - Mixed'},
    {'value': 'avocados', 'label': 'Avocados'},
    {'value': 'almonds', 'label': 'Almonds'},
    {'value': 'walnuts', 'label': 'Walnuts'},
    {'value': 'pistachios', 'label': 'Pistachios'},
    {'value': 'grapes_wine', 'label': 'Grapes - Wine'},
    {'value': 'grapes_table', 'label': 'Grapes - Table'},
    {'value': 'strawberries', 'label': 'Strawberries'},
    {'value': 'tomatoes', 'label': 'Tomatoes'},
    {'value': 'lettuce', 'label': 'Lettuce'},
    {'value': 'other_row_crops', 'label': 'Other Row Crops'},
    {'value': 'mixed_diversified', 'label': 'Mixed/Diversified'},
]


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def get_primary_crop_options(request):
    """
    Get list of primary crop options.
    
    GET /api/reference/primary-crops/
    """
    return Response(PRIMARY_CROP_OPTIONS)
