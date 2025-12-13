from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Farm, Field, PesticideProduct, PesticideApplication, WaterSource, WaterTest
from .serializers import FarmSerializer, FieldSerializer, PesticideProductSerializer, PesticideApplicationSerializer, WaterSourceSerializer, WaterTestSerializer

class FarmViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing farms
    """
    queryset = Farm.objects.filter(active=True)
    serializer_class = FarmSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'farm_number', 'owner_name', 'county']
    ordering_fields = ['name', 'created_at']
    
    @action(detail=True, methods=['get'])
    def fields(self, request, pk=None):
        """Get all fields for a specific farm"""
        farm = self.get_object()
        fields = farm.fields.all()
        serializer = FieldSerializer(fields, many=True)
        return Response(serializer.data)
    
class FieldViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing fields
    """
    queryset = Field.objects.filter(active=True)
    serializer_class = FieldSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'field_number', 'current_crop', 'county']
    ordering_fields = ['name', 'total_acres', 'created_at']
    
    @action(detail=True, methods=['get'])
    def applications(self, request, pk=None):
        """Get all applications for a specific field"""
        field = self.get_object()
        applications = field.applications.all()
        serializer = PesticideApplicationSerializer(applications, many=True)
        return Response(serializer.data)


class PesticideProductViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing pesticide products
    """
    queryset = PesticideProduct.objects.all()
    serializer_class = PesticideProductSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product_name', 'epa_registration_number', 'manufacturer', 'active_ingredients']
    ordering_fields = ['product_name', 'created_at']


class PesticideApplicationViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing pesticide applications
    """
    queryset = PesticideApplication.objects.all()
    serializer_class = PesticideApplicationSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['field__name', 'product__product_name', 'applicator_name']
    ordering_fields = ['application_date', 'created_at']
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get all pending applications"""
        pending = self.queryset.filter(status='pending_signature')
        serializer = self.get_serializer(pending, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def ready_for_pur(self, request):
        """Get all complete applications ready for PUR submission"""
        ready = self.queryset.filter(status='complete', submitted_to_pur=False)
        serializer = self.get_serializer(ready, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_complete(self, request, pk=None):
        """Mark an application as complete"""
        application = self.get_object()
        application.status = 'complete'
        application.save()
        serializer = self.get_serializer(application)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_submitted(self, request, pk=None):
        """Mark an application as submitted to PUR"""
        application = self.get_object()
        application.submitted_to_pur = True
        application.status = 'submitted'
        from django.utils import timezone
        application.pur_submission_date = timezone.now().date()
        application.save()
        serializer = self.get_serializer(application)
        return Response(serializer.data)

class WaterSourceViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing water sources
    """
    queryset = WaterSource.objects.filter(active=True)
    serializer_class = WaterSourceSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'source_type', 'farm__name']
    ordering_fields = ['name', 'created_at']
    
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
        overdue_sources = [ws for ws in self.queryset if ws.is_test_overdue()]
        serializer = self.get_serializer(overdue_sources, many=True)
        return Response(serializer.data)


class WaterTestViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing water tests
    """
    queryset = WaterTest.objects.all()
    serializer_class = WaterTestSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['water_source__name', 'lab_name', 'status']
    ordering_fields = ['test_date', 'created_at']

    def get_queryset(self):
        """Allow filtering by water_source"""
        queryset = super().get_queryset()
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
        failed = self.queryset.filter(status='fail')
        serializer = self.get_serializer(failed, many=True)
        return Response(serializer.data)