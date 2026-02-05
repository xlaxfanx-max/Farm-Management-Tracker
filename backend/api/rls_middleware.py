"""
Middleware to set the current company ID for Row-Level Security.

This middleware runs on every request and tells PostgreSQL which company
the current user belongs to. RLS policies then use this to filter data.

NOTE: Uses set_config() function which works in PostgreSQL 9.2+ without
needing custom_variable_classes configuration.
"""

from django.db import connection


def _is_postgresql():
    """Check if the default database is PostgreSQL."""
    return connection.vendor == 'postgresql'


class RowLevelSecurityMiddleware:
    """
    Sets the PostgreSQL session variable for RLS on each request.

    This must run AFTER authentication middleware so request.user is available.
    Silently skips on non-PostgreSQL databases (e.g. SQLite during tests).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not _is_postgresql():
            return self.get_response(request)

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
        """Set the RLS context variable in PostgreSQL using set_config()."""
        with connection.cursor() as cursor:
            # Use set_config() function - works without custom_variable_classes
            # Third parameter 'false' means it's session-level (not just current transaction)
            cursor.execute(
                "SELECT set_config('app.current_company_id', %s, false)",
                [str(company_id)]
            )

    def _clear_company_context(self):
        """Clear the RLS context variable."""
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('app.current_company_id', '', false)")


class RLSContextManager:
    """
    Context manager for setting RLS company context in non-request scenarios.
    
    Useful for:
    - Management commands
    - Background tasks (Celery)
    - Django shell operations
    
    Usage:
        from api.rls_middleware import RLSContextManager
        
        with RLSContextManager(company_id=123):
            # All queries here are filtered to company 123
            farms = Farm.objects.all()
    """
    
    def __init__(self, company_id):
        self.company_id = company_id
    
    def __enter__(self):
        if _is_postgresql():
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT set_config('app.current_company_id', %s, false)",
                    [str(self.company_id)]
                )
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if _is_postgresql():
            with connection.cursor() as cursor:
                cursor.execute("SELECT set_config('app.current_company_id', '', false)")
        return False


def set_rls_company(company_id):
    """
    Manually set the RLS company context.

    Call this in management commands or background tasks before making queries.
    Remember to call clear_rls_company() when done.
    """
    if not _is_postgresql():
        return
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT set_config('app.current_company_id', %s, false)",
            [str(company_id)]
        )


def clear_rls_company():
    """Clear the RLS company context."""
    if not _is_postgresql():
        return
    with connection.cursor() as cursor:
        cursor.execute("SELECT set_config('app.current_company_id', '', false)")
