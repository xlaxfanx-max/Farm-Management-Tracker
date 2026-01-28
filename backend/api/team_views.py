# Additional views for team management
# Add these to your auth_views.py or create a new file and import them

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .permissions import HasCompanyAccess
from rest_framework import status


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def available_roles(request):
    """Get list of roles available for assignment"""
    from .models import Role
    
    # Exclude owner role - can't assign that
    roles = Role.objects.exclude(codename='owner').order_by('name')
    data = [{'id': r.id, 'name': r.name, 'codename': r.codename} for r in roles]
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
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
@permission_classes([IsAuthenticated, HasCompanyAccess])
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

    # Send invitation email
    from .email_service import EmailService
    email_sent = EmailService.send_invitation_email(invitation)

    return Response({
        'message': 'Invitation resent successfully',
        'email_sent': email_sent
    })


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
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
@permission_classes([IsAuthenticated, HasCompanyAccess])
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
@permission_classes([IsAuthenticated, HasCompanyAccess])
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
@permission_classes([IsAuthenticated, HasCompanyAccess])
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


@api_view(['POST'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def transfer_ownership(request, company_id):
    """
    Transfer company ownership to another member.
    Only the current owner can transfer ownership.
    """
    from .models import CompanyMembership, Company, Role
    from django.db import transaction

    new_owner_id = request.data.get('new_owner_id')
    if not new_owner_id:
        return Response({'error': 'new_owner_id is required'}, status=400)

    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        return Response({'error': 'Company not found'}, status=404)

    # Get current user's membership
    try:
        current_membership = CompanyMembership.objects.select_related('role').get(
            user=request.user,
            company=company
        )
    except CompanyMembership.DoesNotExist:
        return Response({'error': 'You are not a member of this company'}, status=403)

    # Only owner can transfer ownership
    if current_membership.role.codename != 'owner':
        return Response({'error': 'Only the owner can transfer ownership'}, status=403)

    # Get the new owner's membership
    try:
        new_owner_membership = CompanyMembership.objects.select_related('user', 'role').get(
            id=new_owner_id,
            company=company
        )
    except CompanyMembership.DoesNotExist:
        return Response({'error': 'New owner not found in company members'}, status=404)

    # Can't transfer to yourself
    if new_owner_membership.user == request.user:
        return Response({'error': 'You are already the owner'}, status=400)

    # Get the roles
    try:
        owner_role = Role.objects.get(codename='owner')
        admin_role = Role.objects.get(codename='admin')
    except Role.DoesNotExist:
        return Response({'error': 'Required roles not found'}, status=500)

    # Perform the transfer atomically
    with transaction.atomic():
        # Change current owner to admin
        current_membership.role = admin_role
        current_membership.save()

        # Change new owner to owner
        new_owner_membership.role = owner_role
        new_owner_membership.save()

    return Response({
        'message': 'Ownership transferred successfully',
        'new_owner': {
            'id': new_owner_membership.user.id,
            'email': new_owner_membership.user.email,
            'name': f"{new_owner_membership.user.first_name} {new_owner_membership.user.last_name}".strip() or new_owner_membership.user.email
        }
    })
