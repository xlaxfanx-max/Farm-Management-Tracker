"""
Nutrient management views: fertilizer products, nutrient applications, nutrient plans,
nitrogen summary and export.
"""
import csv
import io
from datetime import date
from decimal import Decimal
from django.db.models import Sum, Avg, Count, F, Q
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from rest_framework import viewsets, filters, status, serializers
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from openpyxl import Workbook
from .permissions import HasCompanyAccess
from .audit_utils import AuditLogMixin
from .view_helpers import get_user_company, require_company, CompanyFilteredViewSet
from .models import Farm, Field, FertilizerProduct, NutrientApplication, NutrientPlan
from .serializers import (
    FertilizerProductSerializer, FertilizerProductListSerializer,
    NutrientApplicationSerializer, NutrientApplicationListSerializer,
    NutrientPlanSerializer, NutrientPlanListSerializer,
)


class FertilizerProductViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """API endpoint for fertilizer products."""
    serializer_class = FertilizerProductSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'manufacturer', 'product_code']
    ordering_fields = ['name', 'nitrogen_pct', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        user = self.request.user
        company = getattr(user, 'current_company', None)
        queryset = FertilizerProduct.objects.filter(active=True)

        if company:
            queryset = queryset.filter(Q(company__isnull=True) | Q(company=company))
        else:
            queryset = queryset.filter(company__isnull=True)

        form = self.request.query_params.get('form')
        if form:
            queryset = queryset.filter(form=form)

        is_organic = self.request.query_params.get('is_organic')
        if is_organic is not None:
            queryset = queryset.filter(is_organic=is_organic.lower() == 'true')

        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return FertilizerProductListSerializer
        return FertilizerProductSerializer

    @action(detail=False, methods=['get'])
    def search(self, request):
        q = request.query_params.get('q', '')
        if len(q) < 2:
            return Response([])
        queryset = self.get_queryset().filter(
            Q(name__icontains=q) | Q(manufacturer__icontains=q)
        )[:20]
        return Response(FertilizerProductListSerializer(queryset, many=True).data)

    @action(detail=False, methods=['post'])
    def seed_common(self, request):
        from .models import get_common_fertilizers
        created, existing = 0, 0
        for data in get_common_fertilizers():
            _, was_created = FertilizerProduct.objects.get_or_create(name=data['name'], defaults=data)
            created += was_created
            existing += not was_created
        return Response({'created': created, 'existing': existing})


class NutrientApplicationViewSet(CompanyFilteredViewSet):
    """API endpoint for nutrient applications."""
    model = NutrientApplication
    serializer_class = NutrientApplicationSerializer
    company_field = 'field__farm__company'
    select_related_fields = ('field', 'field__farm', 'product', 'water_source')
    default_ordering = ('-application_date', '-created_at')
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product__name', 'field__name', 'notes']
    ordering_fields = ['application_date', 'created_at', 'total_lbs_nitrogen']
    ordering = ['-application_date', '-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return NutrientApplicationListSerializer
        return NutrientApplicationSerializer

    def filter_queryset_by_params(self, qs):
        field_id = self.request.query_params.get('field')
        if field_id:
            qs = qs.filter(field_id=field_id)

        farm_id = self.request.query_params.get('farm')
        if farm_id:
            qs = qs.filter(field__farm_id=farm_id)

        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(application_date__year=year)
        return qs

    @action(detail=False, methods=['get'])
    def by_field(self, request):
        year = request.query_params.get('year', date.today().year)
        queryset = self.get_queryset().filter(application_date__year=year)

        by_field = queryset.values(
            'field__id', 'field__name', 'field__farm__name', 'field__total_acres'
        ).annotate(
            application_count=Count('id'),
            total_lbs_nitrogen=Sum('total_lbs_nitrogen'),
            total_cost=Sum('total_cost')
        ).order_by('field__farm__name', 'field__name')

        results = []
        for item in by_field:
            acres = item['field__total_acres'] or Decimal('1')
            total_n = item['total_lbs_nitrogen'] or Decimal('0')
            results.append({
                'field_id': item['field__id'],
                'field_name': item['field__name'],
                'farm_name': item['field__farm__name'],
                'acres': float(acres),
                'application_count': item['application_count'],
                'total_lbs_nitrogen': float(total_n),
                'lbs_nitrogen_per_acre': float(total_n / acres) if acres else 0,
                'total_cost': float(item['total_cost']) if item['total_cost'] else None,
            })
        return Response(results)


class NutrientPlanViewSet(CompanyFilteredViewSet):
    """API endpoint for nitrogen management plans."""
    model = NutrientPlan
    serializer_class = NutrientPlanSerializer
    company_field = 'field__farm__company'
    select_related_fields = ('field', 'field__farm')
    default_ordering = ('-year', 'field__name')
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['year', 'field__name']
    ordering = ['-year', 'field__name']

    def get_serializer_class(self):
        if self.action == 'list':
            return NutrientPlanListSerializer
        return NutrientPlanSerializer

    def filter_queryset_by_params(self, qs):
        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(year=year)
        return qs


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def nitrogen_summary(request):
    """Annual nitrogen summary by field for ILRP compliance."""
    user = request.user
    company = getattr(user, 'current_company', None)
    year = int(request.query_params.get('year', date.today().year))

    fields = Field.objects.filter(active=True).select_related('farm')
    if company:
        fields = fields.filter(farm__company=company)

    summary = []
    for field in fields:
        apps = field.nutrient_applications.filter(application_date__year=year)
        total_n = apps.aggregate(total=Sum('total_lbs_nitrogen'))['total'] or Decimal('0')
        acres = field.total_acres or Decimal('1')
        plan = field.nutrient_plans.filter(year=year).first()

        summary.append({
            'field_id': field.id,
            'field_name': field.name,
            'farm_name': field.farm.name if field.farm else '',
            'acres': float(acres),
            'crop': field.current_crop,
            'total_applications': apps.count(),
            'total_lbs_nitrogen': float(total_n),
            'lbs_nitrogen_per_acre': float(total_n / acres),
            'has_plan': plan is not None,
            'planned_nitrogen_lbs_acre': float(plan.net_planned_nitrogen) if plan else None,
            'variance_lbs_acre': float(plan.nitrogen_variance_per_acre) if plan else None,
        })
    return Response(summary)


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def nitrogen_export(request):
    """Export nitrogen summary as Excel."""
    user = request.user
    company = getattr(user, 'current_company', None)
    year = int(request.query_params.get('year', date.today().year))

    fields = Field.objects.filter(active=True).select_related('farm')
    if company:
        fields = fields.filter(farm__company=company)

    wb = Workbook()
    ws = wb.active
    ws.title = f"Nitrogen Report {year}"

    headers = ['Field', 'Farm', 'Acres', 'Crop', 'Total N (lbs)', 'N/Acre (lbs)', 'Applications']
    ws.append(headers)

    for field in fields:
        apps = field.nutrient_applications.filter(application_date__year=year)
        total_n = apps.aggregate(total=Sum('total_lbs_nitrogen'))['total'] or 0
        acres = float(field.total_acres or 1)

        ws.append([
            field.name,
            field.farm.name if field.farm else '',
            acres,
            field.current_crop,
            round(float(total_n), 1),
            round(float(total_n) / acres, 1),
            apps.count(),
        ])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    response = HttpResponse(
        output.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="nitrogen_report_{year}.xlsx"'
    return response
