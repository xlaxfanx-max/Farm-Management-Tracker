"""
Water source and water test views.
"""
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .permissions import HasCompanyAccess
from .view_helpers import CompanyFilteredViewSet, get_user_company
from .audit_utils import AuditLogMixin
from .models import WaterSource, WaterTest
from .serializers import WaterSourceSerializer, WaterTestSerializer


class WaterSourceViewSet(CompanyFilteredViewSet):
    """
    API endpoint for managing water sources.

    RLS NOTES:
    - Water sources belong to farms, which have company FK
    - get_queryset filters by company through farm
    """
    model = WaterSource
    serializer_class = WaterSourceSerializer
    company_field = 'farm__company'
    select_related_fields = ('farm',)
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'source_type', 'farm__name']
    ordering_fields = ['name', 'created_at']

    def filter_queryset_by_params(self, qs):
        return qs.filter(active=True)

    @action(detail=True, methods=['get'])
    def tests(self, request, pk=None):
        """Get all tests for a specific water source"""
        water_source = self.get_object()
        tests = water_source.water_tests.all()
        serializer = WaterTestSerializer(tests, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get all water sources with overdue tests"""
        overdue_sources = [ws for ws in self.get_queryset() if ws.is_test_overdue()]
        serializer = self.get_serializer(overdue_sources, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def gsa_fee_defaults(self, request):
        """Get default fee rates for each GSA."""
        from .models import GSA_FEE_DEFAULTS, GSA_CHOICES
        # Convert Decimal to float for JSON serialization
        result = {}
        for gsa_code, defaults in GSA_FEE_DEFAULTS.items():
            result[gsa_code] = {
                k: float(v) if v is not None else None
                for k, v in defaults.items()
            }
        # Add GSA display names
        gsa_names = dict(GSA_CHOICES)
        for gsa_code in result:
            result[gsa_code]['display_name'] = gsa_names.get(gsa_code, gsa_code)
        return Response(result)


class WaterTestViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing water tests.

    RLS NOTES:
    - Water tests inherit company through water_source->farm relationship
    """
    serializer_class = WaterTestSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['water_source__name', 'lab_name', 'status']
    ordering_fields = ['test_date', 'created_at']

    def get_queryset(self):
        """Filter water tests by company through water_source->farm."""
        queryset = WaterTest.objects.select_related('water_source', 'water_source__farm')
        company = get_user_company(self.request.user)
        if company:
            queryset = queryset.filter(water_source__farm__company=company)

        water_source_id = self.request.query_params.get('water_source', None)
        if water_source_id:
            queryset = queryset.filter(water_source_id=water_source_id)
        return queryset

    def perform_create(self, serializer):
        """Auto-determine status when creating"""
        instance = serializer.save()
        if instance.status == 'pending' and instance.ecoli_result is not None:
            instance.status = instance.auto_determine_status()
            instance.save()

    @action(detail=False, methods=['get'])
    def failed(self, request):
        """Get all failed tests"""
        failed = self.get_queryset().filter(status='fail')
        serializer = self.get_serializer(failed, many=True)
        return Response(serializer.data)
