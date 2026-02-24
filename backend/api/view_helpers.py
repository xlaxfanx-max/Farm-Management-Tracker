"""
Shared helper functions and base classes for views across the API.

These functions are used by multiple view files for company validation (RLS).
"""
from django.core.exceptions import ImproperlyConfigured
from rest_framework import serializers, viewsets
from .audit_utils import AuditLogMixin
from .permissions import IsAuthenticated, HasCompanyAccess


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


class CompanyFilteredViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    Base ViewSet that handles company-scoped filtering and creation.

    Eliminates the repeated get_queryset() / perform_create() boilerplate
    found across 80+ ViewSets. Subclasses only need to set:

        model = MyModel
        serializer_class = MySerializer

    Optional overrides:
        company_field       - FK field name to filter on (default: 'company')
        select_related_fields - tuple for select_related optimization
        prefetch_related_fields - tuple for prefetch_related optimization
        default_ordering    - tuple for default queryset ordering

    If you need custom filtering (query params, etc.), override
    filter_queryset_by_params(qs) instead of rewriting get_queryset().
    """
    model = None
    company_field = 'company'
    select_related_fields = ()
    prefetch_related_fields = ()
    default_ordering = ('-id',)
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_model(self):
        if self.model:
            return self.model
        if self.queryset is not None:
            return self.queryset.model
        raise ImproperlyConfigured(
            f"{self.__class__.__name__} must set 'model' or 'queryset'."
        )

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return self.get_model().objects.none()

        qs = self.get_model().objects.filter(**{self.company_field: company})

        if self.default_ordering:
            qs = qs.order_by(*self.default_ordering)
        if self.select_related_fields:
            qs = qs.select_related(*self.select_related_fields)
        if self.prefetch_related_fields:
            qs = qs.prefetch_related(*self.prefetch_related_fields)

        return self.filter_queryset_by_params(qs)

    def filter_queryset_by_params(self, queryset):
        """Override in subclasses to add query-param based filtering."""
        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        # Pass company and created_by if the serializer/model accepts them
        save_kwargs = {self.company_field: company}
        model = self.get_model()
        if hasattr(model, 'created_by'):
            save_kwargs['created_by'] = self.request.user
        instance = serializer.save(**save_kwargs)
        # Delegate to AuditLogMixin for logging (call super to keep audit trail)
        return instance
