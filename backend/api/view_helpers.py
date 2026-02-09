"""
Shared helper functions for views across the API.

These functions are used by multiple view files for company validation (RLS).
"""
from rest_framework import serializers


def get_user_company(user):
    """Helper to safely get user's current company."""
    if hasattr(user, 'current_company') and user.current_company:
        return user.current_company
    return None


def require_company(user):
    """Raise validation error if user has no company."""
    company = get_user_company(user)
    if not company:
        raise serializers.ValidationError(
            "You must be associated with a company to perform this action."
        )
    return company
