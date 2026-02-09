"""
Report statistics views.
"""
from datetime import datetime, timedelta
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Count
from .permissions import HasCompanyAccess
from .models import PesticideApplication, Farm, Field
from .view_helpers import get_user_company


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def report_statistics(request):
    """Get statistics for the reports dashboard"""
    from django.db.models import Sum, Count

    # Get query parameters
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    farm_id = request.query_params.get('farm_id')

    # Build base queryset with company filter
    company = get_user_company(request.user)
    queryset = PesticideApplication.objects.all()
    if company:
        queryset = queryset.filter(field__farm__company=company)

    if start_date:
        queryset = queryset.filter(application_date__gte=start_date)
    if end_date:
        queryset = queryset.filter(application_date__lte=end_date)
    if farm_id:
        queryset = queryset.filter(field__farm_id=farm_id)

    # Calculate statistics
    stats = {
        'total_applications': queryset.count(),
        'total_acres': float(queryset.aggregate(Sum('acres_treated'))['acres_treated__sum'] or 0),
        'unique_farms': queryset.values('field__farm').distinct().count(),
        'unique_fields': queryset.values('field').distinct().count(),
        'unique_products': queryset.values('product').distinct().count(),
        'status_breakdown': {},
        'by_county': {},
        'by_month': {},
        'restricted_use_count': 0,
        'submitted_to_pur': queryset.filter(submitted_to_pur=True).count(),
        'pending_signature': queryset.filter(status='pending_signature').count(),
    }

    # Status breakdown
    status_counts = queryset.values('status').annotate(count=Count('id'))
    for item in status_counts:
        stats['status_breakdown'][item['status']] = item['count']

    # By county
    county_counts = queryset.values('field__county').annotate(
        count=Count('id'),
        acres=Sum('acres_treated')
    ).order_by('-count')[:10]

    for item in county_counts:
        county = item['field__county'] or 'Unknown'
        stats['by_county'][county] = {
            'applications': item['count'],
            'acres': float(item['acres'] or 0)
        }

    # By month (last 12 months)
    twelve_months_ago = datetime.now() - timedelta(days=365)
    monthly_data = queryset.filter(
        application_date__gte=twelve_months_ago
    ).extra(
        select={'month': "strftime('%%Y-%%m', application_date)"}
    ).values('month').annotate(
        count=Count('id'),
        acres=Sum('acres_treated')
    ).order_by('month')

    for item in monthly_data:
        if item['month']:
            stats['by_month'][item['month']] = {
                'applications': item['count'],
                'acres': float(item['acres'] or 0)
            }

    # Restricted use products
    stats['restricted_use_count'] = queryset.filter(
        product__restricted_use=True
    ).count()

    return Response(stats)
