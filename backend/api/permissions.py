# =============================================================================
# PERMISSIONS AND MIDDLEWARE FOR MULTI-TENANCY
# =============================================================================
#
# This file contains:
# 1. Custom permission classes for DRF
# 2. Middleware for automatic company filtering
# 3. Mixins for ViewSets
#
# INSTALLATION:
# 1. Add to backend/api/permissions.py (new file)
# 2. Add middleware to settings.py MIDDLEWARE list
# 3. Update your ViewSets to use the mixins
#
# =============================================================================

from rest_framework import permissions
from functools import wraps


# =============================================================================
# CUSTOM PERMISSION CLASSES
# =============================================================================

class IsAuthenticated(permissions.BasePermission):
    """
    Custom authenticated permission that also checks for active company.
    """
    message = "Authentication required."
    
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated
        )


class HasCompanyAccess(permissions.BasePermission):
    """
    Checks that user has an active company selected.
    """
    message = "No company selected. Please select a company first."
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return bool(request.user.current_company)


class HasPermission(permissions.BasePermission):
    """
    Generic permission class that checks for a specific permission.
    
    Usage in ViewSet:
        permission_classes = [HasPermission]
        required_permission = 'view_farms'
    
    Or with action-specific permissions:
        permission_map = {
            'list': 'view_farms',
            'create': 'create_farms',
            'update': 'edit_farms',
            'destroy': 'delete_farms',
        }
    """
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        # Get required permission
        required_permission = getattr(view, 'required_permission', None)
        
        # Check for action-specific permissions
        permission_map = getattr(view, 'permission_map', {})
        action = getattr(view, 'action', None)
        
        if action and action in permission_map:
            required_permission = permission_map[action]
        
        if not required_permission:
            # No permission required, allow access
            return True
        
        return request.user.has_permission(required_permission)


class IsCompanyOwnerOrAdmin(permissions.BasePermission):
    """
    Only allows company owners and admins.
    """
    message = "Only company owners and administrators can perform this action."
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        company = request.user.current_company
        if not company:
            return False
        
        role = request.user.get_role_in_company(company)
        return role and role.codename in ['owner', 'admin']


class IsCompanyOwner(permissions.BasePermission):
    """
    Only allows company owners.
    """
    message = "Only the company owner can perform this action."
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        if request.user.is_superuser:
            return True
        
        company = request.user.current_company
        if not company:
            return False
        
        role = request.user.get_role_in_company(company)
        return role and role.codename == 'owner'


# =============================================================================
# PERMISSION DECORATOR FOR FUNCTION-BASED VIEWS
# =============================================================================

def require_permission(permission_codename):
    """
    Decorator for function-based views to check permissions.
    
    Usage:
        @api_view(['POST'])
        @require_permission('create_applications')
        def create_application(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                from rest_framework.response import Response
                from rest_framework import status
                return Response(
                    {'error': 'Authentication required'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            if not request.user.is_superuser:
                if not request.user.has_permission(permission_codename):
                    from rest_framework.response import Response
                    from rest_framework import status
                    return Response(
                        {'error': f'Permission denied: {permission_codename} required'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            
            return view_func(request, *args, **kwargs)
        return wrapped_view
    return decorator


# =============================================================================
# VIEWSET MIXIN FOR COMPANY FILTERING
# =============================================================================

class CompanyFilterMixin:
    """
    Mixin for ViewSets that automatically filters querysets by company.
    
    Usage:
        class FarmViewSet(CompanyFilterMixin, viewsets.ModelViewSet):
            queryset = Farm.objects.all()
            serializer_class = FarmSerializer
            company_field = 'company'  # Field name that links to Company
    
    For nested models (e.g., Field -> Farm -> Company):
        company_field = 'farm__company'
    
    For models that don't belong to a company (e.g., PesticideProduct):
        company_field = None
    """
    
    company_field = 'company'  # Override this in your ViewSet
    
    def get_queryset(self):
        """Filter queryset by user's current company."""
        queryset = super().get_queryset()
        
        # Skip filtering for superusers or if no company field
        if self.request.user.is_superuser:
            return queryset
        
        if self.company_field is None:
            return queryset
        
        company = self.request.user.current_company
        if not company:
            return queryset.none()
        
        # Apply company filter
        filter_kwargs = {self.company_field: company}
        return queryset.filter(**filter_kwargs)
    
    def perform_create(self, serializer):
        """Automatically set company on create."""
        if self.company_field and self.company_field == 'company':
            serializer.save(company=self.request.user.current_company)
        else:
            serializer.save()


class FarmFilterMixin:
    """
    Mixin for models that belong to a Farm (and thus to a Company).
    Filters by farms the user has access to.
    
    Usage:
        class FieldViewSet(FarmFilterMixin, viewsets.ModelViewSet):
            queryset = Field.objects.all()
            farm_field = 'farm'  # Field name that links to Farm
    """
    
    farm_field = 'farm'
    
    def get_queryset(self):
        """Filter queryset by user's accessible farms."""
        queryset = super().get_queryset()
        
        if self.request.user.is_superuser:
            return queryset
        
        company = self.request.user.current_company
        if not company:
            return queryset.none()
        
        # Get user's membership
        try:
            membership = self.request.user.company_memberships.get(
                company=company,
                is_active=True
            )
        except:
            return queryset.none()
        
        # Check if user is restricted to specific farms
        allowed_farms = membership.allowed_farms.all()
        
        if allowed_farms.exists():
            # User is restricted to specific farms
            filter_kwargs = {f'{self.farm_field}__in': allowed_farms}
        else:
            # User has access to all farms in company
            filter_kwargs = {f'{self.farm_field}__company': company}
        
        return queryset.filter(**filter_kwargs)


# =============================================================================
# MIDDLEWARE FOR COMPANY CONTEXT
# =============================================================================

class CompanyMiddleware:
    """
    Middleware that adds company context to the request.
    
    Add to settings.py MIDDLEWARE:
        'api.permissions.CompanyMiddleware',
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Add company to request for easy access
        request.company = None
        
        if hasattr(request, 'user') and request.user.is_authenticated:
            # Single source of truth: user's current_company
            request.company = request.user.current_company
        
        response = self.get_response(request)
        return response


# =============================================================================
# AUDIT LOG MIXIN
# =============================================================================

class AuditLogMixin:
    """
    Mixin that automatically creates audit logs for create/update/delete.
    
    Usage:
        class FarmViewSet(AuditLogMixin, CompanyFilterMixin, viewsets.ModelViewSet):
            ...
    """
    
    def perform_create(self, serializer):
        instance = serializer.save()
        self._create_audit_log('create', instance)
    
    def perform_update(self, serializer):
        # Capture old values
        old_values = {}
        instance = self.get_object()
        for field in serializer.validated_data.keys():
            old_values[field] = str(getattr(instance, field, ''))
        
        instance = serializer.save()
        
        # Capture new values and find changes
        changes = {}
        for field, old_value in old_values.items():
            new_value = str(getattr(instance, field, ''))
            if old_value != new_value:
                changes[field] = {'old': old_value, 'new': new_value}
        
        self._create_audit_log('update', instance, changes)
    
    def perform_destroy(self, instance):
        self._create_audit_log('delete', instance)
        instance.delete()
    
    def _create_audit_log(self, action, instance, changes=None):
        from .models import AuditLog
        
        if not self.request.user.is_authenticated:
            return
        
        company = self.request.user.current_company
        if not company:
            return
        
        AuditLog.objects.create(
            user=self.request.user,
            company=company,
            action=action,
            model_name=instance.__class__.__name__,
            object_id=str(instance.pk),
            object_repr=str(instance)[:200],
            changes=changes or {},
            ip_address=self._get_client_ip(),
            user_agent=self.request.META.get('HTTP_USER_AGENT', '')[:500],
        )
    
    def _get_client_ip(self):
        x_forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return self.request.META.get('REMOTE_ADDR')
