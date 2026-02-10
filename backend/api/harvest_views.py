"""
Buyer, Labor Contractor, Harvest, Harvest Load, and Harvest Labor views.
"""
import csv
import io
from datetime import datetime, timedelta, date
from decimal import Decimal
from django.db.models import Sum, Avg, Count, F, Q, Min, Max, DecimalField
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from rest_framework import viewsets, filters, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .permissions import HasCompanyAccess
from .audit_utils import AuditLogMixin
from .view_helpers import get_user_company, require_company
from .models import (
    Buyer, LaborContractor, Harvest, HarvestLoad, HarvestLabor, Field,
    PesticideApplication, CROP_VARIETY_CHOICES, GRADE_CHOICES,
)
from .serializers import (
    BuyerSerializer, BuyerListSerializer,
    LaborContractorSerializer, LaborContractorListSerializer,
    HarvestSerializer, HarvestListSerializer,
    HarvestLoadSerializer, HarvestLaborSerializer,
    PHICheckSerializer, HarvestStatisticsSerializer,
)


# -----------------------------------------------------------------------------
# BUYER VIEWSET
# -----------------------------------------------------------------------------

class BuyerViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    CRUD operations for Buyers (packing houses, processors, etc.)

    RLS NOTES:
    - Buyers are scoped by company for multi-tenant isolation
    - Uses RLS policy: buyer_company_isolation
    """
    queryset = Buyer.objects.all()
    serializer_class = BuyerSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        queryset = Buyer.objects.all()

        # Filter by company (multi-tenancy)
        company = get_user_company(self.request.user)
        if company:
            queryset = queryset.filter(company=company)

        # Filter by active status
        active = self.request.query_params.get('active')
        if active is not None:
            queryset = queryset.filter(active=active.lower() == 'true')

        # Filter by buyer type
        buyer_type = self.request.query_params.get('buyer_type')
        if buyer_type:
            queryset = queryset.filter(buyer_type=buyer_type)

        # Search by name
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(name__icontains=search)

        return queryset.order_by('name')

    def perform_create(self, serializer):
        """Auto-assign company when creating buyer."""
        company = get_user_company(self.request.user)
        serializer.save(company=company)

    def get_serializer_class(self):
        if self.action == 'list' and self.request.query_params.get('simple') == 'true':
            return BuyerListSerializer
        return BuyerSerializer

    @action(detail=True, methods=['get'])
    def load_history(self, request, pk=None):
        """Get all loads sent to this buyer."""
        buyer = self.get_object()
        loads = HarvestLoad.objects.filter(buyer=buyer).select_related(
            'harvest', 'harvest__field', 'harvest__field__farm'
        ).order_by('-harvest__harvest_date')

        serializer = HarvestLoadSerializer(loads, many=True)

        # Calculate summary stats
        summary = loads.aggregate(
            total_loads=Count('id'),
            total_bins=Sum('bins'),
            total_revenue=Sum('total_revenue'),
            pending_revenue=Sum('total_revenue', filter=Q(payment_status='pending'))
        )

        return Response({
            'buyer': BuyerSerializer(buyer).data,
            'summary': summary,
            'loads': serializer.data
        })

    @action(detail=True, methods=['get'])
    def performance(self, request, pk=None):
        """
        Get performance metrics for this buyer.
        Returns: historical pricing, payment timeliness, quality grades, volume
        """
        from django.db.models import Avg, Count, Sum, Q, F, ExpressionWrapper, DurationField
        from django.db.models.functions import Coalesce
        from datetime import date

        buyer = self.get_object()

        # Get all loads for this buyer
        loads = HarvestLoad.objects.filter(buyer=buyer).select_related(
            'harvest', 'harvest__field'
        )

        # Overall statistics
        overall_stats = loads.aggregate(
            total_loads=Count('id'),
            total_bins=Sum('bins'),
            total_revenue=Sum('total_price'),
            avg_price_per_bin=Avg(F('total_price') / F('bins'), output_field=DecimalField()),
            paid_count=Count('id', filter=Q(payment_status='paid')),
            pending_count=Count('id', filter=Q(payment_status='pending')),
            late_count=Count('id', filter=Q(payment_status='pending', payment_due_date__lt=date.today())),
        )

        # Calculate payment timeliness for paid loads
        paid_loads = loads.filter(payment_status='paid', payment_due_date__isnull=False)

        # This is a simplified calculation - in production you'd track actual payment dates
        # For now, we'll use the updated_at timestamp as a proxy
        avg_days_to_pay = None
        if paid_loads.exists():
            # Calculate average days between harvest and payment
            payment_times = []
            for load in paid_loads:
                days_diff = (load.updated_at.date() - load.harvest.harvest_date).days
                payment_times.append(days_diff)
            avg_days_to_pay = sum(payment_times) / len(payment_times) if payment_times else None

        # Pricing by crop variety
        pricing_by_crop = []
        for crop_value, crop_label in CROP_VARIETY_CHOICES:
            crop_loads = loads.filter(harvest__crop_variety=crop_value)
            crop_stats = crop_loads.aggregate(
                load_count=Count('id'),
                total_bins=Sum('bins'),
                avg_price=Avg(F('total_price') / F('bins'), output_field=DecimalField()),
                min_price=Min(F('total_price') / F('bins'), output_field=DecimalField()),
                max_price=Max(F('total_price') / F('bins'), output_field=DecimalField()),
            )

            if crop_stats['load_count'] > 0:
                pricing_by_crop.append({
                    'crop_variety': crop_value,
                    'crop_variety_display': crop_label,
                    'load_count': crop_stats['load_count'],
                    'total_bins': crop_stats['total_bins'] or 0,
                    'avg_price_per_bin': float(crop_stats['avg_price'] or 0),
                    'min_price_per_bin': float(crop_stats['min_price'] or 0),
                    'max_price_per_bin': float(crop_stats['max_price'] or 0),
                })

        # Quality grade distribution
        quality_distribution = []
        for grade_value, grade_label in GRADE_CHOICES:
            grade_count = loads.filter(grade=grade_value).count()
            if grade_count > 0:
                quality_distribution.append({
                    'grade': grade_value,
                    'grade_display': grade_label,
                    'count': grade_count,
                    'percentage': (grade_count / overall_stats['total_loads']) * 100 if overall_stats['total_loads'] else 0
                })

        # Recent loads (last 10)
        recent_loads = loads.order_by('-harvest__harvest_date')[:10]
        recent_loads_data = HarvestLoadSerializer(recent_loads, many=True).data

        return Response({
            'buyer': BuyerSerializer(buyer).data,
            'overall_stats': {
                'total_loads': overall_stats['total_loads'],
                'total_bins': overall_stats['total_bins'] or 0,
                'total_revenue': float(overall_stats['total_revenue'] or 0),
                'avg_price_per_bin': float(overall_stats['avg_price_per_bin'] or 0),
                'paid_count': overall_stats['paid_count'],
                'pending_count': overall_stats['pending_count'],
                'late_count': overall_stats['late_count'],
                'payment_rate': (overall_stats['paid_count'] / overall_stats['total_loads'] * 100) if overall_stats['total_loads'] else 0,
                'avg_days_to_pay': avg_days_to_pay,
            },
            'pricing_by_crop': pricing_by_crop,
            'quality_distribution': quality_distribution,
            'recent_loads': recent_loads_data
        })


# -----------------------------------------------------------------------------
# LABOR CONTRACTOR VIEWSET
# -----------------------------------------------------------------------------

class LaborContractorViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    CRUD operations for Labor Contractors.

    RLS NOTES:
    - Labor contractors are scoped by company for multi-tenant isolation
    - Uses RLS policy: laborcontractor_company_isolation
    """
    queryset = LaborContractor.objects.all()
    serializer_class = LaborContractorSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        queryset = LaborContractor.objects.all()

        # Filter by company (multi-tenancy)
        company = get_user_company(self.request.user)
        if company:
            queryset = queryset.filter(company=company)

        # Filter by active status
        active = self.request.query_params.get('active')
        if active is not None:
            queryset = queryset.filter(active=active.lower() == 'true')

        # Filter by valid license
        valid_license = self.request.query_params.get('valid_license')
        if valid_license == 'true':
            queryset = queryset.filter(license_expiration__gte=date.today())

        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(company_name__icontains=search)

        return queryset.order_by('company_name')

    def perform_create(self, serializer):
        """Auto-assign company when creating labor contractor."""
        company = get_user_company(self.request.user)
        serializer.save(company=company)

    def get_serializer_class(self):
        if self.action == 'list' and self.request.query_params.get('simple') == 'true':
            return LaborContractorListSerializer
        return LaborContractorSerializer

    @action(detail=True, methods=['get'])
    def job_history(self, request, pk=None):
        """Get all harvest jobs for this contractor."""
        contractor = self.get_object()
        labor_records = HarvestLabor.objects.filter(
            contractor=contractor
        ).select_related(
            'harvest', 'harvest__field', 'harvest__field__farm'
        ).order_by('-harvest__harvest_date')

        serializer = HarvestLaborSerializer(labor_records, many=True)

        # Calculate summary stats
        summary = labor_records.aggregate(
            total_jobs=Count('id'),
            total_bins=Sum('bins_picked'),
            total_cost=Sum('total_labor_cost'),
            total_hours=Sum('total_hours')
        )

        return Response({
            'contractor': LaborContractorSerializer(contractor).data,
            'summary': summary,
            'jobs': serializer.data
        })

    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        """Get contractors with licenses/insurance expiring in next 30 days."""
        threshold = date.today() + timedelta(days=30)

        expiring = LaborContractor.objects.filter(
            Q(license_expiration__lte=threshold) |
            Q(insurance_expiration__lte=threshold) |
            Q(workers_comp_expiration__lte=threshold),
            active=True
        )

        serializer = LaborContractorSerializer(expiring, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def performance(self, request, pk=None):
        """
        Get performance metrics for this contractor.
        Returns: productivity (bins/hour), cost per bin, compliance history, reliability
        """
        from django.db.models import DecimalField

        contractor = self.get_object()

        # Get all labor records for this contractor
        labor_records = HarvestLabor.objects.filter(
            contractor=contractor
        ).select_related('harvest', 'harvest__field')

        # Overall statistics
        overall_stats = labor_records.aggregate(
            total_jobs=Count('id'),
            total_harvests=Count('harvest', distinct=True),
            total_bins=Sum('bins_picked'),
            total_hours=Sum('hours_worked'),
            total_cost=Sum('total_cost'),
            avg_bins_per_hour=Avg(F('bins_picked') / F('hours_worked'), output_field=DecimalField()),
            avg_cost_per_bin=Avg(F('total_cost') / F('bins_picked'), output_field=DecimalField()),
            avg_hourly_rate=Avg('rate', filter=Q(pay_type='hourly')),
            avg_piece_rate=Avg('rate', filter=Q(pay_type='piece_rate')),
        )

        # Performance by crop variety
        performance_by_crop = []
        for crop_value, crop_label in CROP_VARIETY_CHOICES:
            crop_choice = {'value': crop_value, 'label': crop_label}
            crop_records = labor_records.filter(harvest__crop_variety=crop_value)
            crop_stats = crop_records.aggregate(
                job_count=Count('id'),
                total_bins=Sum('bins_picked'),
                total_hours=Sum('hours_worked'),
                total_cost=Sum('total_cost'),
                avg_bins_per_hour=Avg(F('bins_picked') / F('hours_worked'), output_field=DecimalField()),
                avg_cost_per_bin=Avg(F('total_cost') / F('bins_picked'), output_field=DecimalField()),
            )

            if crop_stats['job_count'] > 0:
                performance_by_crop.append({
                    'crop_variety': crop_value,
                    'crop_variety_display': crop_choice['label'],
                    'job_count': crop_stats['job_count'],
                    'total_bins': crop_stats['total_bins'] or 0,
                    'total_hours': float(crop_stats['total_hours'] or 0),
                    'total_cost': float(crop_stats['total_cost'] or 0),
                    'avg_bins_per_hour': float(crop_stats['avg_bins_per_hour'] or 0),
                    'avg_cost_per_bin': float(crop_stats['avg_cost_per_bin'] or 0),
                })

        # Compliance status
        today = date.today()
        compliance_status = {
            'license_valid': contractor.license_expiration >= today if contractor.license_expiration else False,
            'license_expiration': contractor.license_expiration,
            'insurance_valid': contractor.insurance_expiration >= today if contractor.insurance_expiration else False,
            'insurance_expiration': contractor.insurance_expiration,
            'workers_comp_valid': contractor.workers_comp_expiration >= today if contractor.workers_comp_expiration else False,
            'workers_comp_expiration': contractor.workers_comp_expiration,
            'food_safety_training_current': contractor.food_safety_training_current,
            'overall_compliant': all([
                contractor.license_expiration >= today if contractor.license_expiration else False,
                contractor.insurance_expiration >= today if contractor.insurance_expiration else False,
                contractor.workers_comp_expiration >= today if contractor.workers_comp_expiration else False,
                contractor.food_safety_training_current
            ])
        }

        # Recent jobs (last 10)
        recent_jobs = labor_records.order_by('-harvest__harvest_date')[:10]
        recent_jobs_data = HarvestLaborSerializer(recent_jobs, many=True).data

        # Reliability metrics
        # Calculate consistency - standard deviation of bins per hour over recent jobs
        recent_productivity = []
        for record in labor_records.order_by('-harvest__harvest_date')[:20]:
            if record.hours_worked and record.hours_worked > 0:
                bins_per_hour = record.bins_picked / record.hours_worked
                recent_productivity.append(bins_per_hour)

        productivity_consistency = None
        if len(recent_productivity) > 1:
            import statistics
            avg = statistics.mean(recent_productivity)
            std_dev = statistics.stdev(recent_productivity)
            # Coefficient of variation (lower is more consistent)
            productivity_consistency = (std_dev / avg * 100) if avg > 0 else None

        return Response({
            'contractor': LaborContractorSerializer(contractor).data,
            'overall_stats': {
                'total_jobs': overall_stats['total_jobs'],
                'total_harvests': overall_stats['total_harvests'],
                'total_bins': overall_stats['total_bins'] or 0,
                'total_hours': float(overall_stats['total_hours'] or 0),
                'total_cost': float(overall_stats['total_cost'] or 0),
                'avg_bins_per_hour': float(overall_stats['avg_bins_per_hour'] or 0),
                'avg_cost_per_bin': float(overall_stats['avg_cost_per_bin'] or 0),
                'avg_hourly_rate': float(overall_stats['avg_hourly_rate'] or 0),
                'avg_piece_rate': float(overall_stats['avg_piece_rate'] or 0),
                'productivity_consistency': productivity_consistency,
            },
            'performance_by_crop': performance_by_crop,
            'compliance_status': compliance_status,
            'recent_jobs': recent_jobs_data
        })


# -----------------------------------------------------------------------------
# HARVEST VIEWSET
# -----------------------------------------------------------------------------

class HarvestViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    CRUD operations for Harvests with PHI checking and statistics.

    RLS NOTES:
    - Harvests inherit company through field->farm relationship
    - get_queryset filters by company
    """
    serializer_class = HarvestSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        from django.db.models import Prefetch

        # Optimize loads and labor_records prefetch with select_related
        loads_prefetch = Prefetch(
            'loads',
            queryset=HarvestLoad.objects.select_related('buyer').order_by('load_number')
        )
        labor_prefetch = Prefetch(
            'labor_records',
            queryset=HarvestLabor.objects.select_related('contractor').order_by('-start_time')
        )

        queryset = Harvest.objects.select_related(
            'field', 'field__farm'
        ).prefetch_related(loads_prefetch, labor_prefetch)

        # Filter by company
        company = get_user_company(self.request.user)
        if company:
            queryset = queryset.filter(field__farm__company=company)

        # Filter by field
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        # Filter by farm
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            queryset = queryset.filter(field__farm_id=farm_id)

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(harvest_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(harvest_date__lte=end_date)

        # Filter by crop variety
        crop = self.request.query_params.get('crop_variety')
        if crop:
            queryset = queryset.filter(crop_variety=crop)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by PHI compliance
        phi_compliant = self.request.query_params.get('phi_compliant')
        if phi_compliant == 'true':
            queryset = queryset.filter(phi_compliant=True)
        elif phi_compliant == 'false':
            queryset = queryset.filter(phi_compliant=False)

        # Season/date filter
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        season = self.request.query_params.get('season')

        if start_date and end_date:
            queryset = queryset.filter(harvest_date__gte=start_date, harvest_date__lte=end_date)
        elif season:
            if '-' in season:
                from .services.season_service import SeasonService
                try:
                    s_start, s_end = SeasonService().get_season_date_range(season, crop_category='citrus')
                    queryset = queryset.filter(harvest_date__gte=s_start, harvest_date__lte=s_end)
                except Exception:
                    pass
            else:
                try:
                    queryset = queryset.filter(harvest_date__year=int(season))
                except (ValueError, TypeError):
                    pass

        return queryset.order_by('-harvest_date', '-created_at')

    def get_serializer_class(self):
        if self.action == 'list':
            return HarvestListSerializer
        return HarvestSerializer

    @action(detail=False, methods=['post'])
    def check_phi(self, request):
        """
        Check PHI compliance before creating a harvest.
        POST: { "field_id": 1, "proposed_harvest_date": "2024-12-20" }
        """
        field_id = request.data.get('field_id')
        proposed_date_str = request.data.get('proposed_harvest_date')

        if not field_id or not proposed_date_str:
            return Response(
                {'error': 'field_id and proposed_harvest_date required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            proposed_date = datetime.strptime(proposed_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get most recent application
        last_app = PesticideApplication.objects.filter(
            field_id=field_id
        ).select_related('product').order_by('-application_date').first()

        if not last_app:
            return Response({
                'field_id': field_id,
                'proposed_harvest_date': proposed_date_str,
                'last_application_date': None,
                'last_application_product': None,
                'phi_required_days': None,
                'days_since_application': None,
                'is_compliant': True,
                'warning_message': 'No pesticide applications found for this field.'
            })

        days_since = (proposed_date - last_app.application_date).days
        phi_required = last_app.product.phi_days if last_app.product else None
        is_compliant = days_since >= phi_required if phi_required else None

        warning_message = None
        if is_compliant is False:
            warning_message = (
                f"PHI VIOLATION: Only {days_since} days since application of "
                f"{last_app.product.product_name}. Required: {phi_required} days. "
                f"Earliest safe harvest date: {last_app.application_date + timedelta(days=phi_required)}"
            )
        elif is_compliant is True:
            warning_message = f"PHI compliant. {days_since} days since last application (required: {phi_required})."

        return Response({
            'field_id': field_id,
            'proposed_harvest_date': proposed_date_str,
            'last_application_date': last_app.application_date,
            'last_application_product': last_app.product.product_name if last_app.product else None,
            'phi_required_days': phi_required,
            'days_since_application': days_since,
            'is_compliant': is_compliant,
            'warning_message': warning_message
        })

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """
        Get harvest statistics with optional filters.
        """
        queryset = self.get_queryset()

        # Base aggregations
        stats = queryset.aggregate(
            total_harvests=Count('id'),
            total_bins=Coalesce(Sum('total_bins'), 0),
            total_weight_lbs=Coalesce(Sum('estimated_weight_lbs'), Decimal('0')),
            total_acres_harvested=Coalesce(Sum('acres_harvested'), Decimal('0')),
        )

        # Revenue from loads
        load_stats = HarvestLoad.objects.filter(
            harvest__in=queryset
        ).aggregate(
            total_revenue=Coalesce(Sum('total_revenue'), Decimal('0')),
            pending_payments=Coalesce(
                Sum('total_revenue', filter=Q(payment_status='pending')),
                Decimal('0')
            ),
            avg_price_per_bin=Avg('price_per_unit', filter=Q(price_unit='per_bin'))
        )

        # Labor costs
        labor_stats = HarvestLabor.objects.filter(
            harvest__in=queryset
        ).aggregate(
            total_labor_cost=Coalesce(Sum('total_labor_cost'), Decimal('0'))
        )

        # PHI violations
        phi_violations = queryset.filter(phi_compliant=False).count()

        # Determine primary unit based on filtered crop variety
        from .services.season_service import get_primary_unit_for_crop_variety
        crop_filter = self.request.query_params.get('crop_variety', '')
        unit_info = get_primary_unit_for_crop_variety(crop_filter) if crop_filter else None
        if unit_info and unit_info['unit'] == 'LBS':
            primary_quantity = float(stats['total_weight_lbs'])
            primary_unit = 'LBS'
            primary_unit_label = 'Lbs'
        else:
            primary_quantity = stats['total_bins']
            primary_unit = 'BIN'
            primary_unit_label = 'Bins'

        # Calculate yield per acre
        if stats['total_acres_harvested'] and stats['total_acres_harvested'] > 0:
            avg_yield = float(primary_quantity) / float(stats['total_acres_harvested'])
        else:
            avg_yield = 0

        # By crop breakdown
        by_crop = list(queryset.values('crop_variety').annotate(
            count=Count('id'),
            bins=Sum('total_bins'),
            acres=Sum('acres_harvested')
        ).order_by('-bins'))

        # By buyer breakdown
        by_buyer = list(HarvestLoad.objects.filter(
            harvest__in=queryset
        ).values('buyer__name').annotate(
            loads=Count('id'),
            bins=Sum('bins'),
            revenue=Sum('total_revenue')
        ).order_by('-revenue'))

        return Response({
            'total_harvests': stats['total_harvests'],
            'total_bins': stats['total_bins'],
            'total_weight_lbs': stats['total_weight_lbs'],
            'total_acres_harvested': stats['total_acres_harvested'],
            'total_revenue': load_stats['total_revenue'],
            'total_labor_cost': labor_stats['total_labor_cost'],
            'avg_yield_per_acre': round(avg_yield, 1),
            'avg_price_per_bin': load_stats['avg_price_per_bin'],
            'pending_payments': load_stats['pending_payments'],
            'phi_violations': phi_violations,
            'by_crop': by_crop,
            'by_buyer': by_buyer,
            'primary_quantity': primary_quantity,
            'primary_unit': primary_unit,
            'primary_unit_label': primary_unit_label,
        })

    @action(detail=True, methods=['post'])
    def mark_complete(self, request, pk=None):
        """Mark harvest as complete."""
        harvest = self.get_object()
        harvest.status = 'complete'
        harvest.save()
        return Response(HarvestSerializer(harvest).data)

    @action(detail=True, methods=['post'])
    def mark_verified(self, request, pk=None):
        """Mark harvest as verified (for GAP/GHP)."""
        harvest = self.get_object()

        # Check GAP/GHP requirements
        warnings = []
        if not harvest.phi_verified:
            warnings.append("PHI verification not checked")
        if not harvest.equipment_cleaned:
            warnings.append("Equipment cleaning not verified")
        if not harvest.no_contamination_observed:
            warnings.append("Contamination check not verified")

        harvest.status = 'verified'
        harvest.save()

        return Response({
            'harvest': HarvestSerializer(harvest).data,
            'warnings': warnings
        })

    @action(detail=False, methods=['get'])
    def by_field(self, request):
        """Get harvests grouped by field."""
        queryset = self.get_queryset()

        fields_data = {}
        for harvest in queryset:
            field_id = harvest.field_id
            if field_id not in fields_data:
                fields_data[field_id] = {
                    'field_id': field_id,
                    'field_name': harvest.field.name,
                    'farm_name': harvest.field.farm.name if harvest.field.farm else None,
                    'harvests': []
                }
            fields_data[field_id]['harvests'].append(
                HarvestListSerializer(harvest).data
            )

        return Response(list(fields_data.values()))

    @action(detail=False, methods=['get'])
    def cost_analysis(self, request):
        """
        Get cost analysis metrics for harvests.
        Returns: cost per acre, cost per bin, revenue per acre, labor efficiency metrics
        Filters: season, field, crop_variety, start_date, end_date
        """
        from django.db.models import Sum, Avg, Count, F, Q, DecimalField
        from django.db.models.functions import Coalesce

        queryset = self.get_queryset()

        # Apply date/season filters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        season = request.query_params.get('season')

        if start_date and end_date:
            queryset = queryset.filter(harvest_date__gte=start_date, harvest_date__lte=end_date)
        elif season:
            if '-' in season:
                # Cross-year season (e.g. "2024-2025") - resolve via SeasonService
                from .services.season_service import SeasonService
                try:
                    s_start, s_end = SeasonService().get_season_date_range(season, crop_category='citrus')
                    queryset = queryset.filter(harvest_date__gte=s_start, harvest_date__lte=s_end)
                except Exception:
                    pass
            else:
                try:
                    queryset = queryset.filter(harvest_date__year=int(season))
                except (ValueError, TypeError):
                    pass

        # Get aggregated metrics
        harvests_with_metrics = queryset.annotate(
            total_revenue=Coalesce(Sum('loads__total_price'), 0, output_field=DecimalField()),
            total_labor_cost=Coalesce(Sum('labor_records__total_cost'), 0, output_field=DecimalField()),
            total_labor_hours=Coalesce(Sum('labor_records__hours_worked'), 0, output_field=DecimalField()),
        )

        # Calculate overall metrics
        total_harvests = harvests_with_metrics.count()
        if total_harvests == 0:
            return Response({
                'total_harvests': 0,
                'metrics': {},
                'by_crop': [],
                'by_field': [],
                'by_contractor': []
            })

        aggregates = harvests_with_metrics.aggregate(
            total_acres=Sum('acres_harvested'),
            total_bins=Sum('total_bins'),
            total_revenue=Sum('total_revenue'),
            total_labor_cost=Sum('total_labor_cost'),
            total_labor_hours=Sum('total_labor_hours'),
            avg_cost_per_acre=Avg(F('total_labor_cost') / F('acres_harvested'), output_field=DecimalField()),
            avg_cost_per_bin=Avg(F('total_labor_cost') / F('total_bins'), output_field=DecimalField()),
            avg_revenue_per_acre=Avg(F('total_revenue') / F('acres_harvested'), output_field=DecimalField()),
        )

        # Calculate derived metrics
        metrics = {
            'total_acres': float(aggregates['total_acres'] or 0),
            'total_bins': aggregates['total_bins'] or 0,
            'total_revenue': float(aggregates['total_revenue'] or 0),
            'total_labor_cost': float(aggregates['total_labor_cost'] or 0),
            'total_profit': float((aggregates['total_revenue'] or 0) - (aggregates['total_labor_cost'] or 0)),
            'total_labor_hours': float(aggregates['total_labor_hours'] or 0),
            'avg_cost_per_acre': float(aggregates['avg_cost_per_acre'] or 0),
            'avg_cost_per_bin': float(aggregates['avg_cost_per_bin'] or 0),
            'avg_revenue_per_acre': float(aggregates['avg_revenue_per_acre'] or 0),
            'avg_bins_per_hour': float(aggregates['total_bins'] / aggregates['total_labor_hours']) if aggregates['total_labor_hours'] else 0,
            'profit_margin': float(((aggregates['total_revenue'] or 0) - (aggregates['total_labor_cost'] or 0)) / (aggregates['total_revenue'] or 1)) * 100 if aggregates['total_revenue'] else 0,
        }

        # Breakdown by crop variety
        by_crop = []
        for crop_value, crop_label in CROP_VARIETY_CHOICES:
            crop_choice = {'value': crop_value, 'label': crop_label}
            crop_harvests = harvests_with_metrics.filter(crop_variety=crop_value)
            crop_aggregates = crop_harvests.aggregate(
                count=Count('id'),
                total_acres=Sum('acres_harvested'),
                total_bins=Sum('total_bins'),
                total_revenue=Sum('total_revenue'),
                total_labor_cost=Sum('total_labor_cost'),
                avg_cost_per_bin=Avg(F('total_labor_cost') / F('total_bins'), output_field=DecimalField()),
            )

            if crop_aggregates['count'] > 0:
                by_crop.append({
                    'crop_variety': crop_value,
                    'crop_variety_display': crop_choice['label'],
                    'harvest_count': crop_aggregates['count'],
                    'total_acres': float(crop_aggregates['total_acres'] or 0),
                    'total_bins': crop_aggregates['total_bins'] or 0,
                    'total_revenue': float(crop_aggregates['total_revenue'] or 0),
                    'total_labor_cost': float(crop_aggregates['total_labor_cost'] or 0),
                    'profit': float((crop_aggregates['total_revenue'] or 0) - (crop_aggregates['total_labor_cost'] or 0)),
                    'avg_cost_per_bin': float(crop_aggregates['avg_cost_per_bin'] or 0),
                })

        # Breakdown by field
        from collections import defaultdict
        by_field_data = defaultdict(lambda: {
            'total_revenue': 0,
            'total_labor_cost': 0,
            'total_acres': 0,
            'total_bins': 0,
            'harvest_count': 0
        })

        for harvest in harvests_with_metrics:
            field_id = harvest.field_id
            by_field_data[field_id]['field_id'] = field_id
            by_field_data[field_id]['field_name'] = harvest.field.name
            by_field_data[field_id]['farm_name'] = harvest.field.farm.name if harvest.field.farm else None
            by_field_data[field_id]['total_revenue'] += float(harvest.total_revenue)
            by_field_data[field_id]['total_labor_cost'] += float(harvest.total_labor_cost)
            by_field_data[field_id]['total_acres'] += float(harvest.acres_harvested or 0)
            by_field_data[field_id]['total_bins'] += harvest.total_bins or 0
            by_field_data[field_id]['harvest_count'] += 1

        by_field = []
        for field_data in by_field_data.values():
            field_data['profit'] = field_data['total_revenue'] - field_data['total_labor_cost']
            field_data['revenue_per_acre'] = field_data['total_revenue'] / field_data['total_acres'] if field_data['total_acres'] > 0 else 0
            field_data['cost_per_bin'] = field_data['total_labor_cost'] / field_data['total_bins'] if field_data['total_bins'] > 0 else 0
            by_field.append(field_data)

        # Sort by profit (descending)
        by_field.sort(key=lambda x: x['profit'], reverse=True)

        # Breakdown by contractor (labor efficiency)
        from .models import LaborContractor
        company = get_user_company(request.user)
        contractors = LaborContractor.objects.filter(company=company, active=True)

        by_contractor = []
        for contractor in contractors:
            contractor_labor = HarvestLabor.objects.filter(
                contractor=contractor,
                harvest__in=queryset
            ).aggregate(
                total_bins=Sum('bins_picked'),
                total_hours=Sum('hours_worked'),
                total_cost=Sum('total_cost'),
                harvest_count=Count('harvest', distinct=True)
            )

            if contractor_labor['harvest_count'] and contractor_labor['total_bins']:
                by_contractor.append({
                    'contractor_id': contractor.id,
                    'contractor_name': contractor.name,
                    'harvest_count': contractor_labor['harvest_count'],
                    'total_bins': contractor_labor['total_bins'] or 0,
                    'total_hours': float(contractor_labor['total_hours'] or 0),
                    'total_cost': float(contractor_labor['total_cost'] or 0),
                    'bins_per_hour': float(contractor_labor['total_bins'] / contractor_labor['total_hours']) if contractor_labor['total_hours'] else 0,
                    'cost_per_bin': float(contractor_labor['total_cost'] / contractor_labor['total_bins']) if contractor_labor['total_bins'] else 0,
                })

        # Sort by bins per hour (descending) - most efficient first
        by_contractor.sort(key=lambda x: x['bins_per_hour'], reverse=True)

        return Response({
            'total_harvests': total_harvests,
            'metrics': metrics,
            'by_crop': by_crop,
            'by_field': by_field,
            'by_contractor': by_contractor
        })


# -----------------------------------------------------------------------------
# HARVEST LOAD VIEWSET
# -----------------------------------------------------------------------------

class HarvestLoadViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    CRUD operations for Harvest Loads.

    RLS NOTES:
    - Loads inherit company through harvest->field->farm relationship
    """
    serializer_class = HarvestLoadSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        queryset = HarvestLoad.objects.select_related(
            'harvest', 'harvest__field', 'harvest__field__farm', 'buyer'
        )

        # Filter by company
        company = get_user_company(self.request.user)
        if company:
            queryset = queryset.filter(harvest__field__farm__company=company)

        # Filter by harvest
        harvest_id = self.request.query_params.get('harvest')
        if harvest_id:
            queryset = queryset.filter(harvest_id=harvest_id)

        # Filter by buyer
        buyer_id = self.request.query_params.get('buyer')
        if buyer_id:
            queryset = queryset.filter(buyer_id=buyer_id)

        # Filter by payment status
        payment_status = self.request.query_params.get('payment_status')
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)

        # Filter by grade
        grade = self.request.query_params.get('grade')
        if grade:
            queryset = queryset.filter(grade=grade)

        # Date range (based on harvest date)
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(harvest__harvest_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(harvest__harvest_date__lte=end_date)

        return queryset.order_by('-harvest__harvest_date', 'load_number')

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark load as paid."""
        load = self.get_object()
        load.payment_status = 'paid'
        load.payment_date = request.data.get('payment_date', date.today())
        load.save()
        return Response(HarvestLoadSerializer(load).data)

    @action(detail=False, methods=['get'])
    def pending_payments(self, request):
        """Get all loads with pending payments."""
        loads = self.get_queryset().filter(
            payment_status__in=['pending', 'invoiced']
        ).order_by('harvest__harvest_date')

        total_pending = loads.aggregate(total=Sum('total_revenue'))['total'] or 0

        return Response({
            'total_pending': total_pending,
            'loads': HarvestLoadSerializer(loads, many=True).data
        })

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get all loads with overdue payments."""
        from datetime import date

        loads = self.get_queryset().filter(
            payment_status__in=['pending', 'invoiced'],
            payment_due_date__isnull=False,
            payment_due_date__lt=date.today()
        ).order_by('payment_due_date')

        total_overdue = loads.aggregate(total=Sum('total_revenue'))['total'] or 0

        return Response({
            'total_overdue': total_overdue,
            'count': loads.count(),
            'loads': HarvestLoadSerializer(loads, many=True).data
        })


# -----------------------------------------------------------------------------
# HARVEST LABOR VIEWSET
# -----------------------------------------------------------------------------

class HarvestLaborViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    CRUD operations for Harvest Labor records.

    RLS NOTES:
    - Labor records inherit company through harvest->field->farm relationship
    """
    serializer_class = HarvestLaborSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        queryset = HarvestLabor.objects.select_related(
            'harvest', 'harvest__field', 'harvest__field__farm', 'contractor'
        )

        # Filter by company
        company = get_user_company(self.request.user)
        if company:
            queryset = queryset.filter(harvest__field__farm__company=company)

        # Filter by harvest
        harvest_id = self.request.query_params.get('harvest')
        if harvest_id:
            queryset = queryset.filter(harvest_id=harvest_id)

        # Filter by contractor
        contractor_id = self.request.query_params.get('contractor')
        if contractor_id:
            queryset = queryset.filter(contractor_id=contractor_id)

        # Date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(harvest__harvest_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(harvest__harvest_date__lte=end_date)

        return queryset.order_by('-harvest__harvest_date')

    @action(detail=False, methods=['get'])
    def cost_analysis(self, request):
        """Get labor cost analysis."""
        queryset = self.get_queryset()

        analysis = queryset.aggregate(
            total_cost=Sum('total_labor_cost'),
            total_hours=Sum('total_hours'),
            total_bins=Sum('bins_picked'),
            avg_hourly_rate=Avg('rate', filter=Q(pay_type='hourly')),
            avg_piece_rate=Avg('rate', filter=Q(pay_type='piece_rate'))
        )

        # Calculate cost per bin
        if analysis['total_bins'] and analysis['total_cost']:
            analysis['cost_per_bin'] = float(analysis['total_cost']) / analysis['total_bins']
        else:
            analysis['cost_per_bin'] = None

        # By contractor breakdown
        by_contractor = list(queryset.values(
            'contractor__company_name'
        ).annotate(
            jobs=Count('id'),
            bins=Sum('bins_picked'),
            cost=Sum('total_labor_cost'),
            hours=Sum('total_hours')
        ).order_by('-cost'))

        return Response({
            **analysis,
            'by_contractor': by_contractor
        })
