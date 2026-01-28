"""
Season API Views - Endpoints for season management and queries.

Provides:
- Season info endpoint for getting current/available seasons
- Season date range endpoint for resolving season labels to dates
- SeasonTemplate and GrowingCycle CRUD operations
"""

from datetime import datetime

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import SeasonTemplate, GrowingCycle, Field, Crop
from .serializers import SeasonTemplateSerializer, GrowingCycleSerializer
from .services.season_service import SeasonService


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_season_info(request):
    """
    Get season information for current context.

    Query params:
    - field_id: Optional field for context
    - crop_category: Optional category if no field
    - date: Optional target date (default: today)

    Returns:
    {
        "current_season": { label, start_date, end_date, ... },
        "available_seasons": [ ... ]
    }
    """
    field_id = request.query_params.get('field_id')
    crop_category = request.query_params.get('crop_category')
    target_date_str = request.query_params.get('date')

    target_date = None
    if target_date_str:
        try:
            target_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )

    # Get company from user
    company_id = None
    if hasattr(request.user, 'current_company_id'):
        company_id = request.user.current_company_id

    service = SeasonService(company_id=company_id)

    current = service.get_current_season(
        field_id=int(field_id) if field_id else None,
        crop_category=crop_category,
        target_date=target_date
    )

    available = service.get_available_seasons(
        field_id=int(field_id) if field_id else None,
        crop_category=crop_category
    )

    return Response({
        'current_season': current.to_dict(),
        'available_seasons': [s.to_dict() for s in available],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_season_date_range(request):
    """
    Get date range for a specific season.

    Query params:
    - season: Season label (e.g., "2024-2025") - REQUIRED
    - field_id: Optional field for context
    - crop_category: Optional category

    Returns:
    {
        "season": "2024-2025",
        "start_date": "2024-10-01",
        "end_date": "2025-09-30"
    }
    """
    season_label = request.query_params.get('season')
    if not season_label:
        return Response(
            {'error': 'season parameter required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    field_id = request.query_params.get('field_id')
    crop_category = request.query_params.get('crop_category')

    company_id = None
    if hasattr(request.user, 'current_company_id'):
        company_id = request.user.current_company_id

    service = SeasonService(company_id=company_id)

    try:
        start_date, end_date = service.get_season_date_range(
            season_label=season_label,
            field_id=int(field_id) if field_id else None,
            crop_category=crop_category
        )
    except (ValueError, TypeError) as e:
        return Response(
            {'error': f'Invalid season label: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    return Response({
        'season': season_label,
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
    })


class SeasonTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing SeasonTemplate CRUD operations.

    Endpoints:
    - GET /season-templates/ - List templates (system + company)
    - POST /season-templates/ - Create company template
    - GET /season-templates/{id}/ - Retrieve template
    - PUT/PATCH /season-templates/{id}/ - Update template
    - DELETE /season-templates/{id}/ - Delete template
    - GET /season-templates/for_category/?category=citrus - Get template for category
    """
    serializer_class = SeasonTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Return system templates plus company-specific templates.
        """
        user = self.request.user
        company = getattr(user, 'current_company', None)

        # Get system defaults (company=null) and company-specific
        if company:
            return SeasonTemplate.objects.filter(
                models__Q(company__isnull=True) | models__Q(company=company),
                active=True
            ).order_by('name')
        else:
            return SeasonTemplate.objects.filter(
                company__isnull=True,
                active=True
            ).order_by('name')

    def get_queryset(self):
        """
        Return system templates plus company-specific templates.
        """
        from django.db.models import Q

        user = self.request.user
        company = getattr(user, 'current_company', None)

        # Get system defaults (company=null) and company-specific
        if company:
            return SeasonTemplate.objects.filter(
                Q(company__isnull=True) | Q(company=company),
                active=True
            ).order_by('name')
        else:
            return SeasonTemplate.objects.filter(
                company__isnull=True,
                active=True
            ).order_by('name')

    def perform_create(self, serializer):
        """Assign company to new templates."""
        user = self.request.user
        company = getattr(user, 'current_company', None)
        serializer.save(company=company)

    def perform_destroy(self, instance):
        """Soft-delete company templates; prevent deleting system templates."""
        if instance.company is None:
            return Response(
                {'error': 'Cannot delete system templates'},
                status=status.HTTP_403_FORBIDDEN
            )
        instance.active = False
        instance.save()

    @action(detail=False, methods=['get'])
    def for_category(self, request):
        """
        Get the best matching template for a crop category.

        Query params:
        - category: Crop category (required)
        """
        category = request.query_params.get('category')
        if not category:
            return Response(
                {'error': 'category parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        company = getattr(request.user, 'current_company', None)
        template = SeasonTemplate.get_for_category(category, company)

        if template:
            serializer = self.get_serializer(template)
            return Response(serializer.data)
        else:
            return Response(
                {'error': f'No template found for category: {category}'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def system_defaults(self, request):
        """Get all system default templates."""
        templates = SeasonTemplate.get_system_defaults()
        serializer = self.get_serializer(templates, many=True)
        return Response(serializer.data)


class GrowingCycleViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing GrowingCycle CRUD operations.

    Endpoints:
    - GET /growing-cycles/ - List cycles (filtered by field/year)
    - POST /growing-cycles/ - Create new cycle
    - GET /growing-cycles/{id}/ - Retrieve cycle
    - PUT/PATCH /growing-cycles/{id}/ - Update cycle
    - DELETE /growing-cycles/{id}/ - Delete cycle
    - GET /growing-cycles/active/ - Get active cycles
    - POST /growing-cycles/{id}/complete/ - Mark cycle as complete
    """
    serializer_class = GrowingCycleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Return growing cycles for user's company farms.
        Supports filtering by field_id, year, and status.
        """
        user = self.request.user
        company = getattr(user, 'current_company', None)

        queryset = GrowingCycle.objects.select_related(
            'field', 'field__farm', 'crop'
        )

        # Filter by company
        if company:
            queryset = queryset.filter(field__farm__company=company)

        # Filter by query params
        field_id = self.request.query_params.get('field_id')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        year = self.request.query_params.get('year')
        if year:
            queryset = queryset.filter(year=year)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.order_by('-year', 'cycle_number')

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all currently active growing cycles."""
        from .models import GrowingCycleStatus

        queryset = self.get_queryset().filter(
            status__in=[
                GrowingCycleStatus.PLANTED,
                GrowingCycleStatus.GROWING,
                GrowingCycleStatus.HARVESTING,
            ]
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark a growing cycle as complete."""
        from datetime import date
        from .models import GrowingCycleStatus

        cycle = self.get_object()
        cycle.status = GrowingCycleStatus.COMPLETE
        if not cycle.actual_harvest_date:
            cycle.actual_harvest_date = date.today()
        cycle.save()

        serializer = self.get_serializer(cycle)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Mark a planned cycle as planted/started."""
        from .models import GrowingCycleStatus

        cycle = self.get_object()
        if cycle.status == GrowingCycleStatus.PLANNED:
            cycle.status = GrowingCycleStatus.PLANTED
            cycle.save()

        serializer = self.get_serializer(cycle)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def for_field(self, request):
        """
        Get growing cycles for a specific field.

        Query params:
        - field_id: Field ID (required)
        - year: Optional year filter
        """
        field_id = request.query_params.get('field_id')
        if not field_id:
            return Response(
                {'error': 'field_id parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        queryset = self.get_queryset().filter(field_id=field_id)

        year = request.query_params.get('year')
        if year:
            queryset = queryset.filter(year=year)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
