# =============================================================================
# backend/api/onboarding_views.py
# =============================================================================
# Create this new file in backend/api/
# =============================================================================

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from .models import Farm, Field, WaterSource


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_onboarding_status(request):
    """Get the current onboarding status for the user's company."""
    company = request.user.current_company
    
    if not company:
        return Response(
            {'error': 'No company associated with user'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if company has any farms (indicates some setup has been done)
    has_farms = Farm.objects.filter(company=company).exists()
    has_fields = Field.objects.filter(farm__company=company).exists()
    has_water_sources = WaterSource.objects.filter(farm__company=company).exists()
    
    return Response({
        'onboarding_completed': company.onboarding_completed,
        'onboarding_step': company.onboarding_step,
        'onboarding_completed_at': company.onboarding_completed_at,
        'has_farms': has_farms,
        'has_fields': has_fields,
        'has_water_sources': has_water_sources,
        'company_id': company.id,
        'company_name': company.name,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_onboarding_step(request):
    """Update the current onboarding step."""
    company = request.user.current_company
    
    if not company:
        return Response(
            {'error': 'No company associated with user'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    step = request.data.get('step')
    valid_steps = ['company_info', 'boundary', 'fields', 'water', 'complete', 'skipped']
    
    if step not in valid_steps:
        return Response(
            {'error': f'Invalid step. Must be one of: {valid_steps}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    company.onboarding_step = step
    company.save(update_fields=['onboarding_step'])
    
    return Response({
        'onboarding_step': company.onboarding_step,
        'message': f'Onboarding step updated to {step}'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_onboarding(request):
    """Mark onboarding as complete."""
    company = request.user.current_company
    
    if not company:
        return Response(
            {'error': 'No company associated with user'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    company.onboarding_completed = True
    company.onboarding_step = 'complete'
    company.onboarding_completed_at = timezone.now()
    company.save(update_fields=['onboarding_completed', 'onboarding_step', 'onboarding_completed_at'])
    
    return Response({
        'onboarding_completed': True,
        'onboarding_completed_at': company.onboarding_completed_at,
        'message': 'Onboarding completed successfully'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def skip_onboarding(request):
    """Allow user to skip onboarding."""
    company = request.user.current_company
    
    if not company:
        return Response(
            {'error': 'No company associated with user'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    company.onboarding_completed = True
    company.onboarding_step = 'skipped'
    company.onboarding_completed_at = timezone.now()
    company.save(update_fields=['onboarding_completed', 'onboarding_step', 'onboarding_completed_at'])
    
    return Response({
        'onboarding_completed': True,
        'skipped': True,
        'message': 'Onboarding skipped'
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_onboarding(request):
    """Reset onboarding (for testing or re-doing setup)."""
    company = request.user.current_company
    
    if not company:
        return Response(
            {'error': 'No company associated with user'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    company.onboarding_completed = False
    company.onboarding_step = 'company_info'
    company.onboarding_completed_at = None
    company.save(update_fields=['onboarding_completed', 'onboarding_step', 'onboarding_completed_at'])
    
    return Response({
        'onboarding_completed': False,
        'onboarding_step': 'company_info',
        'message': 'Onboarding reset successfully'
    })
