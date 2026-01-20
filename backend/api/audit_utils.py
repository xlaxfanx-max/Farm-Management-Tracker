"""
Audit Logging Utilities for Grove Master

Add this file to: backend/api/audit_utils.py

Provides helper functions and decorators for consistent audit logging
across all views and operations.
"""

import json
from functools import wraps
from django.forms.models import model_to_dict
from .models import AuditLog


def get_client_ip(request):
    """Extract client IP address from request, handling proxies."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def get_user_agent(request):
    """Extract user agent from request."""
    return request.META.get('HTTP_USER_AGENT', '')[:500]


def log_action(user, company, action, model_name, object_id=None, 
               object_repr=None, changes=None, request=None):
    """
    Create an audit log entry.
    
    Args:
        user: The User object performing the action (can be None for system actions)
        company: The Company object (required)
        action: Action type string (create, update, delete, etc.)
        model_name: Name of the model being acted upon
        object_id: ID of the object (optional)
        object_repr: Human-readable representation (optional)
        changes: Dictionary of changes made (optional)
        request: HTTP request object for IP/user agent (optional)
    
    Returns:
        The created AuditLog instance
    """
    log_entry = AuditLog(
        user=user,
        company=company,
        action=action,
        model_name=model_name,
        object_id=str(object_id) if object_id else '',
        object_repr=object_repr or '',
        changes=changes or {},
    )
    
    if request:
        log_entry.ip_address = get_client_ip(request)
        log_entry.user_agent = get_user_agent(request)
    
    log_entry.save()
    return log_entry


def compute_changes(old_instance, new_instance, fields=None, exclude=None):
    """
    Compute the differences between two model instances.
    
    Args:
        old_instance: The original model instance (or dict)
        new_instance: The updated model instance (or dict)
        fields: List of fields to compare (None = all fields)
        exclude: List of fields to exclude from comparison
    
    Returns:
        Dictionary of {field_name: {'old': old_value, 'new': new_value}}
    """
    changes = {}
    exclude = exclude or ['id', 'created_at', 'updated_at', 'password']
    
    # Convert to dicts if they're model instances
    if hasattr(old_instance, '_meta'):
        old_dict = model_to_dict(old_instance)
    else:
        old_dict = old_instance or {}
    
    if hasattr(new_instance, '_meta'):
        new_dict = model_to_dict(new_instance)
    else:
        new_dict = new_instance or {}
    
    # Determine which fields to compare
    if fields:
        compare_fields = fields
    else:
        compare_fields = set(old_dict.keys()) | set(new_dict.keys())
    
    # Remove excluded fields
    compare_fields = [f for f in compare_fields if f not in exclude]
    
    for field in compare_fields:
        old_value = old_dict.get(field)
        new_value = new_dict.get(field)
        
        # Convert to comparable format
        old_str = serialize_value(old_value)
        new_str = serialize_value(new_value)
        
        if old_str != new_str:
            changes[field] = {
                'old': old_str,
                'new': new_str
            }
    
    return changes


def serialize_value(value):
    """Convert a value to a string representation for comparison/storage."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    if hasattr(value, 'pk'):  # Foreign key
        return str(value.pk)
    if hasattr(value, 'isoformat'):  # DateTime
        return value.isoformat()
    try:
        return str(value)
    except:
        return repr(value)


class AuditLogMixin:
    """
    Mixin for Django REST Framework ViewSets to automatically log actions.
    
    Usage:
        class FarmViewSet(AuditLogMixin, viewsets.ModelViewSet):
            queryset = Farm.objects.all()
            serializer_class = FarmSerializer
            audit_model_name = 'Farm'  # Optional, defaults to model name
    
    This will automatically log create, update, and delete actions.
    """
    
    audit_model_name = None  # Override in subclass if needed
    
    def get_audit_model_name(self):
        """Get the model name for audit logs."""
        if self.audit_model_name:
            return self.audit_model_name
        if hasattr(self, 'queryset') and self.queryset is not None:
            return self.queryset.model.__name__
        return 'Unknown'
    
    def get_object_repr(self, instance):
        """Get a human-readable representation of the object."""
        if hasattr(instance, 'name'):
            return instance.name
        return str(instance)

    def _serialize_for_audit(self, data):
        """
        Convert data to a JSON-serializable format for audit logging.
        Handles model instances, querysets, and other non-serializable types.
        """
        if data is None:
            return None

        if isinstance(data, dict):
            return {key: self._serialize_for_audit(value) for key, value in data.items()}

        if isinstance(data, (list, tuple)):
            return [self._serialize_for_audit(item) for item in data]

        # Handle Django model instances (ForeignKey, OneToOne)
        if hasattr(data, 'pk'):
            return data.pk

        # Handle datetime/date objects
        if hasattr(data, 'isoformat'):
            return data.isoformat()

        # Handle Decimal
        if hasattr(data, '__float__'):
            try:
                return float(data)
            except (TypeError, ValueError):
                pass

        # Handle primitive types (str, int, float, bool)
        if isinstance(data, (str, int, float, bool, type(None))):
            return data

        # Fallback: convert to string
        try:
            return str(data)
        except:
            return repr(data)
    
    def perform_create(self, serializer):
        """Log creation after saving."""
        instance = serializer.save()

        user = self.request.user
        company = getattr(user, 'current_company', None)

        if company:
            # Serialize validated_data to make it JSON serializable
            changes = self._serialize_for_audit(serializer.validated_data)

            log_action(
                user=user,
                company=company,
                action='create',
                model_name=self.get_audit_model_name(),
                object_id=instance.pk,
                object_repr=self.get_object_repr(instance),
                changes=changes,
                request=self.request
            )

        return instance
    
    def perform_update(self, serializer):
        """Log update with changes."""
        old_instance = self.get_object()
        old_data = model_to_dict(old_instance)
        
        instance = serializer.save()
        
        changes = compute_changes(old_data, instance)
        
        user = self.request.user
        company = getattr(user, 'current_company', None)
        
        if company and changes:
            log_action(
                user=user,
                company=company,
                action='update',
                model_name=self.get_audit_model_name(),
                object_id=instance.pk,
                object_repr=self.get_object_repr(instance),
                changes=changes,
                request=self.request
            )
        
        return instance
    
    def perform_destroy(self, instance):
        """Log deletion before destroying."""
        user = self.request.user
        company = getattr(user, 'current_company', None)
        
        object_id = instance.pk
        object_repr = self.get_object_repr(instance)
        
        # Store some data before deletion
        preserved_data = {}
        if hasattr(instance, 'name'):
            preserved_data['name'] = instance.name
        
        instance.delete()
        
        if company:
            log_action(
                user=user,
                company=company,
                action='delete',
                model_name=self.get_audit_model_name(),
                object_id=object_id,
                object_repr=object_repr,
                changes={'deleted_record': preserved_data},
                request=self.request
            )


def audit_action(action, model_name=None, get_object_repr=None):
    """
    Decorator for function-based views to log actions.
    
    Usage:
        @api_view(['POST'])
        @audit_action('submit', 'PUR Report')
        def submit_pur_report(request):
            # ... your view logic
            return Response(...)
    
    Args:
        action: Action type string
        model_name: Name of the model/operation being logged
        get_object_repr: Optional function(request, response) -> str
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped_view(request, *args, **kwargs):
            # Call the original view
            response = view_func(request, *args, **kwargs)
            
            # Log if successful (2xx status)
            if hasattr(response, 'status_code') and 200 <= response.status_code < 300:
                user = request.user if request.user.is_authenticated else None
                company = getattr(user, 'current_company', None) if user else None
                
                if company:
                    obj_repr = ''
                    if get_object_repr:
                        try:
                            obj_repr = get_object_repr(request, response)
                        except:
                            pass
                    
                    log_action(
                        user=user,
                        company=company,
                        action=action,
                        model_name=model_name or view_func.__name__,
                        object_repr=obj_repr,
                        request=request
                    )
            
            return response
        return wrapped_view
    return decorator


# Convenience functions for common actions
def log_login(user, company, request=None):
    """Log a user login."""
    return log_action(
        user=user,
        company=company,
        action='login',
        model_name='User',
        object_id=user.pk,
        object_repr=user.email,
        request=request
    )


def log_logout(user, company, request=None):
    """Log a user logout."""
    return log_action(
        user=user,
        company=company,
        action='logout',
        model_name='User',
        object_id=user.pk,
        object_repr=user.email,
        request=request
    )


def log_export(user, company, export_type, record_count=None, request=None):
    """Log a data export."""
    return log_action(
        user=user,
        company=company,
        action='export',
        model_name=export_type,
        object_repr=f'Exported {record_count} records' if record_count else f'Exported {export_type}',
        changes={'record_count': record_count} if record_count else {},
        request=request
    )


def log_report_submission(user, company, report_type, report_period=None, request=None):
    """Log a report submission."""
    return log_action(
        user=user,
        company=company,
        action='submit',
        model_name=report_type,
        object_repr=f'{report_type} - {report_period}' if report_period else report_type,
        request=request
    )


def log_invitation(user, company, invited_email, role=None, request=None):
    """Log a team invitation."""
    return log_action(
        user=user,
        company=company,
        action='invite',
        model_name='Invitation',
        object_repr=f'Invited {invited_email}',
        changes={'email': invited_email, 'role': role} if role else {'email': invited_email},
        request=request
    )
