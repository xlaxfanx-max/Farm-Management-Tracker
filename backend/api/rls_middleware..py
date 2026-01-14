"""
Middleware to set the current company ID for Row-Level Security.

This middleware runs on every request and tells PostgreSQL which company
the current user belongs to. RLS policies then use this to filter data.
"""

from django.db import connection


class RowLevelSecurityMiddleware:
    """
    Sets the PostgreSQL session variable for RLS on each request.
    
    This must run AFTER authentication middleware so request.user is available.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Set company context if user is authenticated and has a company
        if hasattr(request, 'user') and request.user.is_authenticated:
            company_id = getattr(request.user, 'current_company_id', None)
            
            if company_id:
                self._set_company_context(company_id)
            else:
                # Clear any previous context
                self._clear_company_context()
        else:
            self._clear_company_context()
        
        response = self.get_response(request)
        return response
    
    def _set_company_context(self, company_id):
        """Set the RLS context variable in PostgreSQL."""
        with connection.cursor() as cursor:
            cursor.execute(
                "SET app.current_company_id = %s",
                [str(company_id)]
            )
    
    def _clear_company_context(self):
        """Clear the RLS context variable."""
        with connection.cursor() as cursor:
            cursor.execute("SET app.current_company_id = ''")


class RLSContextManager:
    """
    Context manager for setting RLS company context in non-request scenarios.
    
    Useful for:
    - Management commands
    - Background tasks (Celery)
    - Django shell operations
    
    Usage:
        from api.middleware import RLSContextManager
        
        with RLSContextManager(company_id=123):
            # All queries here are filtered to company 123
            farms = Farm.objects.all()
    """
    
    def __init__(self, company_id):
        self.company_id = company_id
    
    def __enter__(self):
        with connection.cursor() as cursor:
            cursor.execute(
                "SET app.current_company_id = %s",
                [str(self.company_id)]
            )
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        with connection.cursor() as cursor:
            cursor.execute("SET app.current_company_id = ''")
        return False


def set_rls_company(company_id):
    """
    Manually set the RLS company context.
    
    Call this in management commands or background tasks before making queries.
    Remember to call clear_rls_company() when done.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "SET app.current_company_id = %s",
            [str(company_id)]
        )


def clear_rls_company():
    """Clear the RLS company context."""
    with connection.cursor() as cursor:
        cursor.execute("SET app.current_company_id = ''")
