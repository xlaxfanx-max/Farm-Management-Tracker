# Additional views for team management
# Add these to your auth_views.py or create a new file and import them

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_roles(request):
    """Get list of roles available for assignment"""
    from .models import Role
    
    # Exclude owner role - can't assign that
    roles = Role.objects.exclude(codename='owner').order_by('name')
    data = [{'id': r.id, 'name': r.name, 'codename': r.codename} for r in roles]
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_invitations(request):
    """List invitations for current company"""
    from .models import Invitation
    
    company = request.user.current_company
    if not company:
        return Response({'error': 'No company selected'}, status=400)
    
    invitations = Invitation.objects.filter(company=company).select_related('role', 'invited_by')
    data = []
    for inv in invitations:
        data.append({
            'id': inv.id,
            'email': inv.email,
            'token': str(inv.token),  # Added for copy link feature
            'role': {'id': inv.role.id, 'name': inv.role.name, 'codename': inv.role.codename} if inv.role else None,
            'status': inv.status,
            'invited_by': inv.invited_by.email if inv.invited_by else None,
            'created_at': inv.created_at.isoformat() if inv.created_at else None,
            'expires_at': inv.expires_at.isoformat() if inv.expires_at else None,
        })
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resend_invitation(request, invitation_id):
    """Resend an invitation"""
    from .models import Invitation
    from django.utils import timezone
    from datetime import timedelta
    
    try:
        invitation = Invitation.objects.get(id=invitation_id, company=request.user.current_company)
    except Invitation.DoesNotExist:
        return Response({'error': 'Invitation not found'}, status=404)
    
    # Extend expiration
    invitation.expires_at = timezone.now() + timedelta(days=7)
    invitation.save()
    
    # In production, send email here
    
    return Response({'message': 'Invitation resent successfully'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def revoke_invitation(request, invitation_id):
    """Revoke/delete an invitation"""
    from .models import Invitation
    
    try:
        invitation = Invitation.objects.get(id=invitation_id, company=request.user.current_company)
    except Invitation.DoesNotExist:
        return Response({'error': 'Invitation not found'}, status=404)
    
    invitation.delete()
    return Response({'message': 'Invitation revoked'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def company_members(request, company_id):
    """Get members of a company"""
    from .models import CompanyMembership, Company
    
    # Verify user has access to this company
    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        return Response({'error': 'Company not found'}, status=404)
    
    # Check if user is member of this company
    if not CompanyMembership.objects.filter(user=request.user, company=company).exists():
        return Response({'error': 'Access denied'}, status=403)
    
    memberships = CompanyMembership.objects.filter(company=company).select_related('user', 'role')
    data = []
    for m in memberships:
        data.append({
            'id': m.id,
            'user': {
                'id': m.user.id,
                'email': m.user.email,
                'first_name': m.user.first_name,
                'last_name': m.user.last_name,
            },
            'role': {'id': m.role.id, 'name': m.role.name, 'codename': m.role.codename} if m.role else None,
            'joined_at': m.created_at.isoformat() if m.created_at else None,
        })
    return Response(data)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_company_member(request, company_id, member_id):
    """Update a member's role"""
    from .models import CompanyMembership, Company, Role
    
    try:
        company = Company.objects.get(id=company_id)
        membership = CompanyMembership.objects.get(id=member_id, company=company)
    except (Company.DoesNotExist, CompanyMembership.DoesNotExist):
        return Response({'error': 'Not found'}, status=404)
    
    # Check if user has permission to update
    user_membership = CompanyMembership.objects.filter(user=request.user, company=company).first()
    if not user_membership or user_membership.role.codename not in ['owner', 'admin']:
        return Response({'error': 'Permission denied'}, status=403)
    
    # Can't change owner's role
    if membership.role.codename == 'owner':
        return Response({'error': 'Cannot change owner role'}, status=400)
    
    new_role_id = request.data.get('role')
    if new_role_id:
        try:
            new_role = Role.objects.get(id=new_role_id)
            membership.role = new_role
            membership.save()
        except Role.DoesNotExist:
            return Response({'error': 'Role not found'}, status=404)
    
    return Response({'message': 'Member updated'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_company_member(request, company_id, member_id):
    """Remove a member from company"""
    from .models import CompanyMembership, Company
    
    try:
        company = Company.objects.get(id=company_id)
        membership = CompanyMembership.objects.get(id=member_id, company=company)
    except (Company.DoesNotExist, CompanyMembership.DoesNotExist):
        return Response({'error': 'Not found'}, status=404)
    
    # Check if user has permission
    user_membership = CompanyMembership.objects.filter(user=request.user, company=company).first()
    if not user_membership or user_membership.role.codename not in ['owner', 'admin']:
        return Response({'error': 'Permission denied'}, status=403)
    
    # Can't remove owner
    if membership.role.codename == 'owner':
        return Response({'error': 'Cannot remove owner'}, status=400)
    
    # Can't remove yourself
    if membership.user == request.user:
        return Response({'error': 'Cannot remove yourself'}, status=400)
    
    membership.delete()
    return Response({'message': 'Member removed'})
