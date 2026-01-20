"""
Analytics API Views
===================
REST API endpoints for farm analytics and KPIs.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from collections import defaultdict

from django.db.models import Sum, Count, Avg, F, Q
from django.db.models.functions import TruncMonth, ExtractMonth
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .permissions import HasCompanyAccess

from .models import (
    PesticideApplication, Harvest, HarvestLoad, HarvestLabor,
    Field, Farm, WaterTest, WaterSource, LaborContractor
)


def get_company_from_user(user):
    """Get the current company for the user."""
    membership = user.company_memberships.first()
    return membership.company if membership else None


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def get_analytics_dashboard(request):
    """
    Get comprehensive analytics dashboard data.

    Query Parameters:
    - start_date: Start date filter (YYYY-MM-DD)
    - end_date: End date filter (YYYY-MM-DD)
    - farm_id: Filter by specific farm
    - year: Filter by year (defaults to current year)
    """
    import logging
    logger = logging.getLogger(__name__)

    company = get_company_from_user(request.user)
    if not company:
        return Response(
            {'error': 'No company associated with user'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        return _get_analytics_dashboard_impl(request, company)
    except Exception as e:
        logger.exception(f"Analytics dashboard error: {e}")
        # Return empty data on error instead of 500
        year = timezone.now().year
        return Response({
            'period': {
                'start_date': f'{year}-01-01',
                'end_date': f'{year}-12-31',
                'year': year,
            },
            'financial': {
                'total_revenue': 0, 'total_labor_cost': 0, 'net_profit': 0,
                'profit_margin': 0, 'cost_per_bin': 0, 'revenue_per_acre': 0,
                'total_labor_hours': 0,
            },
            'applications': {
                'total': 0, 'pending': 0, 'complete': 0, 'submitted_to_pur': 0,
                'pur_compliance_rate': 0, 'by_month': [], 'top_products': [],
            },
            'harvests': {
                'total_bins': 0, 'total_acres_harvested': 0, 'yield_per_acre': 0, 'by_crop': [],
            },
            'water': {
                'tests_total': 0, 'tests_passed': 0, 'tests_failed': 0,
                'pass_rate': 100, 'tests_due_soon': 0,
            },
            'fields': {
                'total': 0, 'with_harvests': 0, 'top_performers': [],
            },
            'contractors': [],
            '_error': str(e),
        })


def _get_analytics_dashboard_impl(request, company):
    """Internal implementation of analytics dashboard."""

    # Parse date filters
    year = request.query_params.get('year', timezone.now().year)
    try:
        year = int(year)
    except ValueError:
        year = timezone.now().year

    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    if start_date:
        try:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        except ValueError:
            start_date = datetime(year, 1, 1).date()
    else:
        start_date = datetime(year, 1, 1).date()

    if end_date:
        try:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        except ValueError:
            end_date = datetime(year, 12, 31).date()
    else:
        end_date = datetime(year, 12, 31).date()

    farm_id = request.query_params.get('farm_id')

    # Base querysets filtered by company and date
    farms = Farm.objects.filter(company=company)
    if farm_id:
        farms = farms.filter(id=farm_id)

    farm_ids = farms.values_list('id', flat=True)
    field_ids = Field.objects.filter(farm_id__in=farm_ids).values_list('id', flat=True)

    # ==========================================================================
    # APPLICATIONS DATA
    # ==========================================================================
    applications = PesticideApplication.objects.filter(
        field_id__in=field_ids,
        application_date__gte=start_date,
        application_date__lte=end_date
    )

    app_total = applications.count()
    app_pending = applications.filter(status='pending_signature').count()
    app_complete = applications.filter(status='complete').count()
    app_submitted = applications.filter(submitted_to_pur=True).count()

    # Applications by month
    apps_by_month = (
        applications
        .annotate(month=TruncMonth('application_date'))
        .values('month')
        .annotate(count=Count('id'))
        .order_by('month')
    )

    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    # Initialize all months with 0
    apps_monthly = {m: 0 for m in month_names}
    for item in apps_by_month:
        if item['month']:
            month_idx = item['month'].month - 1
            apps_monthly[month_names[month_idx]] = item['count']

    apps_by_month_list = [
        {'month': m, 'count': apps_monthly[m]} for m in month_names
    ]

    # PUR compliance rate
    pur_compliance_rate = 0
    if app_complete > 0:
        pur_compliance_rate = round((app_submitted / app_complete) * 100, 1)

    # Top products used
    top_products = (
        applications
        .values('product__name')
        .annotate(count=Count('id'))
        .order_by('-count')[:5]
    )

    # ==========================================================================
    # HARVEST DATA
    # ==========================================================================
    harvests = Harvest.objects.filter(
        field_id__in=field_ids,
        harvest_date__gte=start_date,
        harvest_date__lte=end_date
    )

    total_bins = harvests.aggregate(total=Sum('total_bins'))['total'] or 0
    total_acres_harvested = harvests.aggregate(total=Sum('acres_harvested'))['total'] or Decimal('0')

    yield_per_acre = 0
    if total_acres_harvested > 0:
        yield_per_acre = round(float(total_bins) / float(total_acres_harvested), 1)

    # Revenue from harvest loads
    harvest_ids = harvests.values_list('id', flat=True)
    loads = HarvestLoad.objects.filter(harvest_id__in=harvest_ids)

    total_revenue = loads.aggregate(total=Sum('total_revenue'))['total'] or Decimal('0')

    # Revenue by crop
    revenue_by_crop = (
        harvests
        .values('crop_variety')
        .annotate(
            bins=Sum('total_bins'),
            acres=Sum('acres_harvested')
        )
    )

    # Get revenue for each crop variety by joining with loads
    crop_revenue_data = []
    for crop in revenue_by_crop:
        crop_harvests = harvests.filter(crop_variety=crop['crop_variety'])
        crop_harvest_ids = crop_harvests.values_list('id', flat=True)
        crop_loads = HarvestLoad.objects.filter(harvest_id__in=crop_harvest_ids)
        crop_revenue = crop_loads.aggregate(total=Sum('total_revenue'))['total'] or Decimal('0')

        crop_revenue_data.append({
            'crop': crop['crop_variety'] or 'Unknown',
            'revenue': float(crop_revenue),
            'bins': crop['bins'] or 0,
            'acres': float(crop['acres'] or 0)
        })

    # Sort by revenue descending
    crop_revenue_data.sort(key=lambda x: x['revenue'], reverse=True)

    # ==========================================================================
    # LABOR DATA
    # ==========================================================================
    labor = HarvestLabor.objects.filter(harvest_id__in=harvest_ids)

    total_labor_cost = labor.aggregate(total=Sum('total_cost'))['total'] or Decimal('0')
    total_labor_hours = labor.aggregate(total=Sum('hours_worked'))['total'] or Decimal('0')

    cost_per_bin = 0
    if total_bins > 0:
        cost_per_bin = round(float(total_labor_cost) / float(total_bins), 2)

    # Net profit
    net_profit = float(total_revenue) - float(total_labor_cost)
    profit_margin = 0
    if float(total_revenue) > 0:
        profit_margin = round((net_profit / float(total_revenue)) * 100, 1)

    # Revenue per acre
    revenue_per_acre = 0
    if total_acres_harvested > 0:
        revenue_per_acre = round(float(total_revenue) / float(total_acres_harvested), 2)

    # Contractor performance
    contractor_stats = (
        labor
        .values('contractor__name')
        .annotate(
            total_cost=Sum('total_cost'),
            total_hours=Sum('hours_worked'),
            harvest_count=Count('harvest', distinct=True)
        )
        .order_by('-total_cost')
    )

    contractors = []
    for cs in contractor_stats:
        if cs['contractor__name']:
            # Get bins harvested by this contractor
            contractor_harvest_ids = labor.filter(
                contractor__name=cs['contractor__name']
            ).values_list('harvest_id', flat=True)
            contractor_bins = harvests.filter(
                id__in=contractor_harvest_ids
            ).aggregate(total=Sum('total_bins'))['total'] or 0

            contractor_cost_per_bin = 0
            if contractor_bins > 0:
                contractor_cost_per_bin = round(
                    float(cs['total_cost'] or 0) / float(contractor_bins), 2
                )

            bins_per_hour = 0
            if cs['total_hours'] and cs['total_hours'] > 0:
                bins_per_hour = round(float(contractor_bins) / float(cs['total_hours']), 1)

            contractors.append({
                'name': cs['contractor__name'],
                'bins': contractor_bins,
                'cost': float(cs['total_cost'] or 0),
                'hours': float(cs['total_hours'] or 0),
                'cost_per_bin': contractor_cost_per_bin,
                'bins_per_hour': bins_per_hour,
            })

    # ==========================================================================
    # WATER DATA
    # ==========================================================================
    water_sources = WaterSource.objects.filter(farm_id__in=farm_ids)
    water_source_ids = water_sources.values_list('id', flat=True)

    water_tests = WaterTest.objects.filter(
        water_source_id__in=water_source_ids,
        sample_date__gte=start_date,
        sample_date__lte=end_date
    )

    tests_total = water_tests.count()
    tests_passed = water_tests.filter(passed=True).count()
    tests_failed = water_tests.filter(passed=False).count()

    water_pass_rate = 0
    if tests_total > 0:
        water_pass_rate = round((tests_passed / tests_total) * 100, 1)

    # Tests due soon (within 30 days based on test frequency)
    tests_due_soon = 0
    for ws in water_sources.filter(active=True):
        if ws.test_frequency_days:
            last_test = water_tests.filter(water_source=ws).order_by('-sample_date').first()
            if last_test:
                next_due = last_test.sample_date + timedelta(days=ws.test_frequency_days)
                if next_due <= (timezone.now().date() + timedelta(days=30)):
                    tests_due_soon += 1
            else:
                tests_due_soon += 1  # Never tested

    # ==========================================================================
    # FIELD PERFORMANCE
    # ==========================================================================
    fields = Field.objects.filter(farm_id__in=farm_ids)

    field_performance = []
    for field in fields:
        field_harvests = harvests.filter(field=field)
        field_bins = field_harvests.aggregate(total=Sum('total_bins'))['total'] or 0
        field_acres = field_harvests.aggregate(total=Sum('acres_harvested'))['total'] or Decimal('0')

        field_harvest_ids = field_harvests.values_list('id', flat=True)
        field_loads = HarvestLoad.objects.filter(harvest_id__in=field_harvest_ids)
        field_revenue = field_loads.aggregate(total=Sum('total_revenue'))['total'] or Decimal('0')

        field_labor = HarvestLabor.objects.filter(harvest_id__in=field_harvest_ids)
        field_cost = field_labor.aggregate(total=Sum('total_cost'))['total'] or Decimal('0')

        field_yield = 0
        if field_acres > 0:
            field_yield = round(float(field_bins) / float(field_acres), 1)

        field_profit = float(field_revenue) - float(field_cost)

        if field_bins > 0 or float(field_revenue) > 0:
            field_performance.append({
                'id': field.id,
                'name': field.name,
                'farm_name': field.farm.name if field.farm else '',
                'bins': field_bins,
                'acres': float(field_acres),
                'yield_per_acre': field_yield,
                'revenue': float(field_revenue),
                'cost': float(field_cost),
                'profit': field_profit,
            })

    # Sort by profit descending
    field_performance.sort(key=lambda x: x['profit'], reverse=True)

    # Top performers and needs attention
    top_performers = field_performance[:5] if field_performance else []

    # Fields needing attention (low yield or negative profit)
    avg_yield = yield_per_acre
    needs_attention = []
    for fp in field_performance:
        issues = []
        if avg_yield > 0 and fp['yield_per_acre'] < (avg_yield * 0.7):
            issues.append(f"Low yield ({fp['yield_per_acre']} vs avg {avg_yield})")
        if fp['profit'] < 0:
            issues.append("Negative profit")

        if issues:
            needs_attention.append({
                'name': fp['name'],
                'issue': ', '.join(issues),
                'yield_per_acre': fp['yield_per_acre'],
                'profit': fp['profit']
            })

    # ==========================================================================
    # RESPONSE
    # ==========================================================================
    return Response({
        'period': {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'year': year,
        },
        'financial': {
            'total_revenue': float(total_revenue),
            'total_labor_cost': float(total_labor_cost),
            'net_profit': net_profit,
            'profit_margin': profit_margin,
            'cost_per_bin': cost_per_bin,
            'revenue_per_acre': revenue_per_acre,
            'total_labor_hours': float(total_labor_hours),
        },
        'applications': {
            'total': app_total,
            'pending': app_pending,
            'complete': app_complete,
            'submitted_to_pur': app_submitted,
            'pur_compliance_rate': pur_compliance_rate,
            'by_month': apps_by_month_list,
            'top_products': list(top_products),
        },
        'harvests': {
            'total_bins': total_bins,
            'total_acres_harvested': float(total_acres_harvested),
            'yield_per_acre': yield_per_acre,
            'by_crop': crop_revenue_data,
        },
        'water': {
            'tests_total': tests_total,
            'tests_passed': tests_passed,
            'tests_failed': tests_failed,
            'pass_rate': water_pass_rate,
            'tests_due_soon': tests_due_soon,
        },
        'fields': {
            'total': fields.count(),
            'with_harvests': len(field_performance),
            'top_performers': top_performers,
            'needs_attention': needs_attention[:5],
            'all_performance': field_performance,
        },
        'contractors': contractors,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def get_analytics_summary(request):
    """
    Get a quick summary of key metrics for the analytics widget.
    Lighter endpoint for dashboard widget.
    """
    import logging
    logger = logging.getLogger(__name__)

    company = get_company_from_user(request.user)
    if not company:
        return Response({'error': 'No company'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        return _get_analytics_summary_impl(request, company)
    except Exception as e:
        logger.exception(f"Analytics summary error: {e}")
        year = timezone.now().year
        return Response({
            'year': year,
            'revenue': 0, 'profit': 0, 'cost_per_bin': 0, 'yield_per_acre': 0,
            'applications': 0, 'pur_compliance': 0, 'water_pass_rate': 100, 'total_bins': 0,
            '_error': str(e),
        })


def _get_analytics_summary_impl(request, company):
    """Internal implementation of analytics summary."""
    year = timezone.now().year
    start_date = datetime(year, 1, 1).date()
    end_date = datetime(year, 12, 31).date()

    farms = Farm.objects.filter(company=company)
    farm_ids = farms.values_list('id', flat=True)
    field_ids = Field.objects.filter(farm_id__in=farm_ids).values_list('id', flat=True)

    # Applications
    applications = PesticideApplication.objects.filter(
        field_id__in=field_ids,
        application_date__gte=start_date,
        application_date__lte=end_date
    )
    app_total = applications.count()
    app_submitted = applications.filter(submitted_to_pur=True).count()
    app_complete = applications.filter(status='complete').count()

    pur_rate = round((app_submitted / app_complete) * 100, 1) if app_complete > 0 else 0

    # Harvests
    harvests = Harvest.objects.filter(
        field_id__in=field_ids,
        harvest_date__gte=start_date,
        harvest_date__lte=end_date
    )
    total_bins = harvests.aggregate(total=Sum('total_bins'))['total'] or 0
    total_acres = harvests.aggregate(total=Sum('acres_harvested'))['total'] or Decimal('0')
    yield_per_acre = round(float(total_bins) / float(total_acres), 1) if total_acres > 0 else 0

    # Revenue & Cost
    harvest_ids = harvests.values_list('id', flat=True)
    total_revenue = HarvestLoad.objects.filter(
        harvest_id__in=harvest_ids
    ).aggregate(total=Sum('total_revenue'))['total'] or Decimal('0')

    total_cost = HarvestLabor.objects.filter(
        harvest_id__in=harvest_ids
    ).aggregate(total=Sum('total_cost'))['total'] or Decimal('0')

    net_profit = float(total_revenue) - float(total_cost)
    cost_per_bin = round(float(total_cost) / float(total_bins), 2) if total_bins > 0 else 0

    # Water tests
    water_source_ids = WaterSource.objects.filter(farm_id__in=farm_ids).values_list('id', flat=True)
    water_tests = WaterTest.objects.filter(
        water_source_id__in=water_source_ids,
        sample_date__gte=start_date,
        sample_date__lte=end_date
    )
    tests_total = water_tests.count()
    tests_passed = water_tests.filter(passed=True).count()
    water_rate = round((tests_passed / tests_total) * 100, 1) if tests_total > 0 else 100

    return Response({
        'year': year,
        'revenue': float(total_revenue),
        'profit': net_profit,
        'cost_per_bin': cost_per_bin,
        'yield_per_acre': yield_per_acre,
        'applications': app_total,
        'pur_compliance': pur_rate,
        'water_pass_rate': water_rate,
        'total_bins': total_bins,
    })
