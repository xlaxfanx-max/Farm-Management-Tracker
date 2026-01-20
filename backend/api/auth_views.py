# =============================================================================
# AUTHENTICATION VIEWS FOR GROVE MASTER
# =============================================================================
#
# This file contains all authentication-related API endpoints.
#
# INSTALLATION:
# 1. Add to backend/api/auth_views.py (new file)
# 2. Update backend/api/urls.py to include these routes
# 3. Install required packages: pip install djangorestframework-simplejwt
# 4. Update settings.py with JWT configuration
#
# =============================================================================

from django.contrib.auth import authenticate, get_user_model
from django.utils import timezone
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta

from .models import (
    Company, CompanyMembership, Role, Invitation, AuditLog
)

User = get_user_model()


# =============================================================================
# AUTHENTICATION ENDPOINTS
# =============================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Register a new user and create their company.
    
    POST /api/auth/register/
    {
        "email": "user@example.com",
        "password": "securepassword",
        "first_name": "John",
        "last_name": "Doe",
        "company_name": "Smith Family Farms",
        "phone": "555-123-4567"
    }
    """
    email = request.data.get('email', '').lower().strip()
    password = request.data.get('password')
    first_name = request.data.get('first_name', '')
    last_name = request.data.get('last_name', '')
    company_name = request.data.get('company_name', '')
    phone = request.data.get('phone', '')
    
    # Validation
    errors = {}
    
    if not email:
        errors['email'] = 'Email is required'
    elif User.objects.filter(email=email).exists():
        errors['email'] = 'An account with this email already exists'
    
    if not password:
        errors['password'] = 'Password is required'
    elif len(password) < 8:
        errors['password'] = 'Password must be at least 8 characters'
    
    if not company_name:
        errors['company_name'] = 'Company name is required'
    
    if errors:
        return Response({'errors': errors}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            # Create user
            user = User.objects.create_user(
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
            )
            
            # Create company
            company = Company.objects.create(
                name=company_name,
                primary_contact_name=f"{first_name} {last_name}".strip(),
                email=email,
                phone=phone,
            )
            
            # Get or create owner role
            owner_role, _ = Role.objects.get_or_create(
                codename='owner',
                defaults={'name': 'Owner', 'is_system_role': True}
            )
            
            # Create membership (user is owner of their company)
            CompanyMembership.objects.create(
                user=user,
                company=company,
                role=owner_role,
                accepted_at=timezone.now(),
            )
            
            # Set current company
            user.current_company = company
            user.save()
            
            # Generate tokens
            refresh = RefreshToken.for_user(user)
            
            # Audit log
            AuditLog.objects.create(
                user=user,
                company=company,
                action='create',
                model_name='User',
                object_id=str(user.id),
                object_repr=user.email,
                changes={'event': 'user_registered'},
                ip_address=get_client_ip(request),
            )
            
            return Response({
                'message': 'Registration successful',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                },
                'company': {
                    'id': company.id,
                    'uuid': str(company.uuid),
                    'name': company.name,
                },
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            }, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        return Response(
            {'error': f'Registration failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """
    Authenticate user and return tokens.
    
    POST /api/auth/login/
    {
        "email": "user@example.com",
        "password": "securepassword"
    }
    """
    email = request.data.get('email', '').lower().strip()
    password = request.data.get('password')
    
    if not email or not password:
        return Response(
            {'error': 'Email and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = authenticate(request, username=email, password=password)
    
    if user is None:
        return Response(
            {'error': 'Invalid email or password'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    if not user.is_active:
        return Response(
            {'error': 'This account has been deactivated'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Update last activity
    user.last_activity = timezone.now()
    user.save(update_fields=['last_activity'])
    
    # Generate tokens
    refresh = RefreshToken.for_user(user)
    
    # Get user's companies
    memberships = user.company_memberships.filter(is_active=True).select_related('company', 'role')
    companies = [{
        'id': m.company.id,
        'uuid': str(m.company.uuid),
        'name': m.company.name,
        'role': m.role.name,
        'role_codename': m.role.codename,
    } for m in memberships]
    
    # Set current company if not set
    if not user.current_company and companies:
        user.current_company_id = companies[0]['id']
        user.save(update_fields=['current_company'])
    
    # Audit log
    if user.current_company:
        AuditLog.objects.create(
            user=user,
            company=user.current_company,
            action='login',
            model_name='User',
            object_id=str(user.id),
            object_repr=user.email,
            ip_address=get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
        )
    
    current_membership = memberships.filter(company=user.current_company).first()
    
    return Response({
        'user': {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone': user.phone,
        },
        'current_company': {
            'id': user.current_company.id if user.current_company else None,
            'uuid': str(user.current_company.uuid) if user.current_company else None,
            'name': user.current_company.name if user.current_company else None,
            'role': current_membership.role.name if current_membership else None,
            'role_codename': current_membership.role.codename if current_membership else None,
        } if user.current_company else None,
        'companies': companies,
        'tokens': {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """
    Logout user and blacklist refresh token.
    
    POST /api/auth/logout/
    {
        "refresh": "refresh_token_here"
    }
    """
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        
        # Audit log
        if request.user.current_company:
            AuditLog.objects.create(
                user=request.user,
                company=request.user.current_company,
                action='logout',
                model_name='User',
                object_id=str(request.user.id),
                object_repr=request.user.email,
                ip_address=get_client_ip(request),
            )
        
        return Response({'message': 'Logged out successfully'})
    except Exception:
        return Response({'message': 'Logged out'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refresh_token(request):
    """
    Refresh access token.
    
    POST /api/auth/refresh/
    {
        "refresh": "refresh_token_here"
    }
    """
    refresh_token = request.data.get('refresh')
    if not refresh_token:
        return Response(
            {'error': 'Refresh token is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        refresh = RefreshToken(refresh_token)
        return Response({
            'access': str(refresh.access_token),
        })
    except Exception as e:
        return Response(
            {'error': 'Invalid or expired refresh token'},
            status=status.HTTP_401_UNAUTHORIZED
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """
    Get current user profile.
    
    GET /api/auth/me/
    """
    user = request.user
    
    memberships = user.company_memberships.filter(is_active=True).select_related('company', 'role')
    companies = [{
        'id': m.company.id,
        'uuid': str(m.company.uuid),
        'name': m.company.name,
        'role': m.role.name,
        'role_codename': m.role.codename,
    } for m in memberships]
    
    current_membership = memberships.filter(company=user.current_company).first() if user.current_company else None
    
    # Get permissions for current company
    permissions = []
    if current_membership:
        permissions = list(current_membership.role.permissions.values_list('codename', flat=True))
    
    return Response({
        'id': user.id,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'phone': user.phone,
        'job_title': user.job_title,
        'applicator_license': user.applicator_license,
        'license_expiration': user.license_expiration,
        'current_company': {
            'id': user.current_company.id,
            'uuid': str(user.current_company.uuid),
            'name': user.current_company.name,
            'role': current_membership.role.name if current_membership else None,
            'role_codename': current_membership.role.codename if current_membership else None,
        } if user.current_company else None,
        'companies': companies,
        'permissions': permissions,
    })


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """
    Update current user profile.
    
    PUT /api/auth/me/
    {
        "first_name": "John",
        "last_name": "Doe",
        "phone": "555-123-4567",
        "job_title": "Farm Manager"
    }
    """
    user = request.user
    
    # Fields that can be updated
    updatable_fields = ['first_name', 'last_name', 'phone', 'job_title', 
                        'applicator_license', 'license_expiration']
    
    for field in updatable_fields:
        if field in request.data:
            setattr(user, field, request.data[field])
    
    user.save()
    
    return Response({
        'message': 'Profile updated successfully',
        'user': {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone': user.phone,
            'job_title': user.job_title,
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """
    Change user password.
    
    POST /api/auth/change-password/
    {
        "current_password": "oldpassword",
        "new_password": "newpassword"
    }
    """
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    
    if not current_password or not new_password:
        return Response(
            {'error': 'Current password and new password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if len(new_password) < 8:
        return Response(
            {'error': 'New password must be at least 8 characters'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not request.user.check_password(current_password):
        return Response(
            {'error': 'Current password is incorrect'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    request.user.set_password(new_password)
    request.user.save()
    
    return Response({'message': 'Password changed successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def switch_company(request):
    """
    Switch to a different company (for users in multiple companies).
    
    POST /api/auth/switch-company/
    {
        "company_id": 2
    }
    """
    company_id = request.data.get('company_id')
    
    if not company_id:
        return Response(
            {'error': 'Company ID is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verify user has access to this company
    try:
        membership = request.user.company_memberships.get(
            company_id=company_id,
            is_active=True
        )
    except CompanyMembership.DoesNotExist:
        return Response(
            {'error': 'You do not have access to this company'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Update current company
    request.user.current_company = membership.company
    request.user.save(update_fields=['current_company'])
    
    # Get permissions for new company
    permissions = list(membership.role.permissions.values_list('codename', flat=True))
    
    return Response({
        'message': f'Switched to {membership.company.name}',
        'current_company': {
            'id': membership.company.id,
            'uuid': str(membership.company.uuid),
            'name': membership.company.name,
            'role': membership.role.name,
            'role_codename': membership.role.codename,
        },
        'permissions': permissions,
    })


# =============================================================================
# INVITATION ENDPOINTS
# =============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_user(request):
    """
    Invite a new user to the company.
    
    POST /api/auth/invite/
    {
        "email": "newuser@example.com",
        "role": "manager",
        "message": "Welcome to our team!"
    }
    """
    user = request.user
    company = user.current_company
    
    if not company:
        return Response(
            {'error': 'No company selected'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check permission
    if not user.has_permission('invite_users'):
        return Response(
            {'error': 'You do not have permission to invite users'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Check company user limit
    if not company.can_add_user():
        return Response(
            {'error': f'Company has reached the maximum of {company.max_users} users'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    email = request.data.get('email', '').lower().strip()
    role_codename = request.data.get('role', 'viewer')
    message = request.data.get('message', '')
    
    if not email:
        return Response(
            {'error': 'Email is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if user already exists in this company
    if CompanyMembership.objects.filter(
        user__email=email,
        company=company,
        is_active=True
    ).exists():
        return Response(
            {'error': 'This user is already a member of your company'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check for pending invitation
    if Invitation.objects.filter(
        email=email,
        company=company,
        status='pending'
    ).exists():
        return Response(
            {'error': 'An invitation has already been sent to this email'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get role
    try:
        # Try as ID first
        if str(role_codename).isdigit():
            role = Role.objects.get(id=int(role_codename))
        else:
            role = Role.objects.get(codename=role_codename)
    except Role.DoesNotExist:
        return Response(
            {'error': 'Invalid role'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Create invitation
    invitation = Invitation.objects.create(
        email=email,
        company=company,
        role=role,
        invited_by=user,
        message=message,
        expires_at=timezone.now() + timedelta(days=7),
    )
    
    # Audit log
    AuditLog.objects.create(
        user=user,
        company=company,
        action='invite',
        model_name='Invitation',
        object_id=str(invitation.id),
        object_repr=email,
        changes={'role': role_codename},
        ip_address=get_client_ip(request),
    )

    # Send invitation email
    from .email_service import EmailService
    email_sent = EmailService.send_invitation_email(invitation)

    return Response({
        'message': f'Invitation sent to {email}',
        'email_sent': email_sent,
        'invitation': {
            'id': invitation.id,
            'email': invitation.email,
            'role': role.name,
            'token': str(invitation.token) if not email_sent else None,  # Only expose token if email failed
            'expires_at': invitation.expires_at,
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def accept_invitation(request):
    """
    Accept an invitation and create account (or add to existing account).
    
    POST /api/auth/accept-invitation/
    {
        "token": "invitation-uuid-token",
        "password": "newpassword",
        "first_name": "Jane",
        "last_name": "Smith"
    }
    """
    token = request.data.get('token')
    password = request.data.get('password')
    first_name = request.data.get('first_name', '')
    last_name = request.data.get('last_name', '')
    
    if not token:
        return Response(
            {'error': 'Invitation token is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Find invitation
    try:
        invitation = Invitation.objects.get(token=token, status='pending')
    except Invitation.DoesNotExist:
        return Response(
            {'error': 'Invalid or expired invitation'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if invitation.is_expired:
        invitation.status = 'expired'
        invitation.save()
        return Response(
            {'error': 'This invitation has expired'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        with transaction.atomic():
            # Check if user already exists
            user = User.objects.filter(email=invitation.email).first()
            
            if user:
                # Existing user - just add to company
                pass
            else:
                # New user - create account
                if not password or len(password) < 8:
                    return Response(
                        {'error': 'Password must be at least 8 characters'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                user = User.objects.create_user(
                    email=invitation.email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                )
            
            # Create membership
            membership = CompanyMembership.objects.create(
                user=user,
                company=invitation.company,
                role=invitation.role,
                invited_by=invitation.invited_by,
                invited_at=invitation.created_at,
                accepted_at=timezone.now(),
            )
            
            # Update invitation status
            invitation.status = 'accepted'
            invitation.accepted_at = timezone.now()
            invitation.save()
            
            # Set current company if not set
            if not user.current_company:
                user.current_company = invitation.company
                user.save(update_fields=['current_company'])
            
            # Generate tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'message': f'Welcome to {invitation.company.name}!',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                },
                'company': {
                    'id': invitation.company.id,
                    'name': invitation.company.name,
                    'role': invitation.role.name,
                },
                'tokens': {
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
            })
            
    except Exception as e:
        return Response(
            {'error': f'Failed to accept invitation: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def validate_invitation(request, token):
    """
    Validate an invitation token and return details.
    
    GET /api/auth/invitation/{token}/
    """
    try:
        invitation = Invitation.objects.get(token=token)
    except Invitation.DoesNotExist:
        return Response(
            {'error': 'Invalid invitation token'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if invitation.status != 'pending':
        return Response(
            {'error': f'This invitation has been {invitation.status}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if invitation.is_expired:
        return Response(
            {'error': 'This invitation has expired'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if user already exists
    existing_user = User.objects.filter(email=invitation.email).exists()
    
    return Response({
        'valid': True,
        'email': invitation.email,
        'company_name': invitation.company.name,
        'role': invitation.role.name,
        'invited_by': invitation.invited_by.full_name if invitation.invited_by else None,
        'message': invitation.message,
        'expires_at': invitation.expires_at,
        'existing_user': existing_user,
    })


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_client_ip(request):
    """Get client IP address from request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_roles(request):
    """Get list of roles available for assignment"""
    from .models import Role

    roles = Role.objects.exclude(codename='owner').order_by('name')
    data = [{'id': r.id, 'name': r.name, 'codename': r.codename} for r in roles]
    return Response(data)


# =============================================================================
# PASSWORD RESET ENDPOINTS
# =============================================================================

import secrets
from django.core.cache import cache


@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset(request):
    """
    Request a password reset email.

    POST /api/auth/forgot-password/
    {
        "email": "user@example.com"
    }
    """
    email = request.data.get('email', '').lower().strip()

    if not email:
        return Response(
            {'error': 'Email is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Always return success to prevent email enumeration
    user = User.objects.filter(email=email).first()

    if user:
        # Generate secure token
        reset_token = secrets.token_urlsafe(32)

        # Store token in cache with 24 hour expiry
        cache_key = f'password_reset_{reset_token}'
        cache.set(cache_key, user.id, timeout=86400)  # 24 hours

        # Send email
        from .email_service import EmailService
        EmailService.send_password_reset_email(user, reset_token)

    return Response({
        'message': 'If an account exists with this email, you will receive a password reset link.'
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    """
    Reset password using token from email.

    POST /api/auth/reset-password/
    {
        "token": "reset-token-from-email",
        "password": "newpassword"
    }
    """
    token = request.data.get('token')
    password = request.data.get('password')

    if not token or not password:
        return Response(
            {'error': 'Token and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if len(password) < 8:
        return Response(
            {'error': 'Password must be at least 8 characters'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Look up token in cache
    cache_key = f'password_reset_{token}'
    user_id = cache.get(cache_key)

    if not user_id:
        return Response(
            {'error': 'Invalid or expired reset token'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Update password
    user.set_password(password)
    user.save()

    # Delete used token
    cache.delete(cache_key)

    # Send confirmation email
    from .email_service import EmailService
    EmailService.send_password_changed_email(user)

    return Response({
        'message': 'Password has been reset successfully. You can now log in with your new password.'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def validate_reset_token(request, token):
    """
    Validate a password reset token.

    GET /api/auth/reset-password/{token}/
    """
    cache_key = f'password_reset_{token}'
    user_id = cache.get(cache_key)

    if not user_id:
        return Response(
            {'valid': False, 'error': 'Invalid or expired reset token'},
            status=status.HTTP_400_BAD_REQUEST
        )

    return Response({'valid': True})