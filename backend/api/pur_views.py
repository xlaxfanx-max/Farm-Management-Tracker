"""
PUR views — ViewSets for Product, Applicator, ApplicationEvent, and PUR import pipeline.
"""
import csv
import io
import uuid
import logging
from decimal import Decimal
from django.db.models import Q, Sum, Count
from django.db.models.functions import TruncMonth
from django.http import HttpResponse
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from .models import (
    Product, Applicator, ApplicationEvent, TankMixItem, Farm, Field,
)
from .pur_serializers import (
    ProductSerializer, ProductListSerializer,
    ApplicatorSerializer, ApplicatorListSerializer,
    ApplicationEventListSerializer, ApplicationEventDetailSerializer,
    ApplicationEventCreateSerializer,
)
from .view_helpers import get_user_company, require_company
from .audit_utils import AuditLogMixin
from .permissions import HasCompanyAccess

logger = logging.getLogger(__name__)


# =============================================================================
# PRODUCT VIEWSET
# =============================================================================

class ProductViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    Unified product endpoint — replaces both old PesticideProduct and
    FertilizerProduct endpoints for the tank-mix architecture.

    Supports ?product_type=pesticide and ?search=timectin filters.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product_name', 'manufacturer', 'epa_registration_number', 'active_ingredient']
    ordering_fields = ['product_name', 'product_type', 'created_at']
    ordering = ['product_name']

    def get_queryset(self):
        company = get_user_company(self.request.user)
        qs = Product.objects.filter(is_active=True)
        if company:
            qs = qs.filter(Q(company__isnull=True) | Q(company=company))
        else:
            qs = qs.filter(company__isnull=True)

        product_type = self.request.query_params.get('product_type')
        if product_type:
            qs = qs.filter(product_type=product_type)

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return ProductListSerializer
        return ProductSerializer

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=False, methods=['get'])
    def search(self, request):
        """Quick search for product matching (used by import pipeline)."""
        q = request.query_params.get('q', '')
        epa = request.query_params.get('epa', '')

        if epa:
            qs = self.get_queryset().filter(epa_registration_number=epa)
            if qs.exists():
                return Response(ProductListSerializer(qs.first()).data)

        if len(q) < 2:
            return Response([])

        qs = self.get_queryset().filter(
            Q(product_name__icontains=q) | Q(epa_registration_number__icontains=q)
        )[:20]
        return Response(ProductListSerializer(qs, many=True).data)


# =============================================================================
# APPLICATOR VIEWSET
# =============================================================================

class ApplicatorViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """CRUD for licensed applicator businesses."""
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'applicator_id', 'license_number']
    ordering = ['name']

    def get_queryset(self):
        company = get_user_company(self.request.user)
        qs = Applicator.objects.filter(is_active=True)
        if company:
            qs = qs.filter(Q(company__isnull=True) | Q(company=company))
        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return ApplicatorListSerializer
        return ApplicatorSerializer

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)


# =============================================================================
# APPLICATION EVENT VIEWSET
# =============================================================================

class ApplicationEventViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    Application events (PUR reports) with nested tank mix items.

    List returns summary; detail returns full data with tank mix items.
    Create/update accepts nested tank_mix_items array.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['pur_number', 'farm__name', 'field__name', 'commodity_name', 'applied_by']
    ordering_fields = ['date_started', 'created_at', 'pur_number']
    ordering = ['-date_started']

    def get_queryset(self):
        company = get_user_company(self.request.user)
        qs = ApplicationEvent.objects.select_related(
            'farm', 'field', 'applicator'
        ).prefetch_related('tank_mix_items', 'tank_mix_items__product')

        if company:
            qs = qs.filter(company=company)

        # Filters
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            qs = qs.filter(farm_id=farm_id)

        field_id = self.request.query_params.get('field')
        if field_id:
            qs = qs.filter(field_id=field_id)

        pur_status = self.request.query_params.get('pur_status')
        if pur_status:
            qs = qs.filter(pur_status=pur_status)

        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(date_started__date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(date_started__date__lte=date_to)

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return ApplicationEventListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return ApplicationEventCreateSerializer
        return ApplicationEventDetailSerializer

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    # -----------------------------------------------------------------
    # PUR Reporting Actions
    # -----------------------------------------------------------------

    @action(detail=False, methods=['post'])
    def validate_pur(self, request):
        """Validate application events for PUR compliance."""
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        farm_id = request.data.get('farm_id')

        queryset = self.get_queryset()
        if start_date:
            queryset = queryset.filter(date_started__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date_started__date__lte=end_date)
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        errors = []
        warnings = []

        for evt in queryset:
            evt_label = f"Event #{evt.id} (PUR {evt.pur_number or 'no PUR#'})"
            items = evt.tank_mix_items.select_related('product').all()

            if not evt.date_started:
                errors.append(f"{evt_label}: Missing application date")
            if not evt.farm_id:
                errors.append(f"{evt_label}: Missing farm")
            if not items.exists():
                errors.append(f"{evt_label}: No products in tank mix")
            for item in items:
                if not item.product.epa_registration_number:
                    warnings.append(f"{evt_label}: Product '{item.product.product_name}' missing EPA reg#")
                if item.product.restricted_use and not evt.applied_by:
                    errors.append(f"{evt_label}: Restricted use product requires applicator name")
            if not evt.treated_area_acres or evt.treated_area_acres <= 0:
                errors.append(f"{evt_label}: Missing or invalid treated acres")
            if not evt.applied_by:
                warnings.append(f"{evt_label}: Missing applicator name")

        return Response({
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'applications_count': queryset.count(),
            'ready_for_export': len(errors) == 0,
        })

    @action(detail=False, methods=['post'])
    def pur_summary(self, request):
        """Generate PUR summary statistics for the date range."""
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        farm_id = request.data.get('farm_id')

        queryset = self.get_queryset()
        if start_date:
            queryset = queryset.filter(date_started__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date_started__date__lte=end_date)
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        total_acres = queryset.aggregate(
            total=Sum('treated_area_acres')
        )['total'] or Decimal('0')

        # Product breakdown via TankMixItems
        items = TankMixItem.objects.filter(
            application_event__in=queryset
        ).select_related('product')

        product_stats = items.values(
            'product__product_name', 'product__epa_registration_number'
        ).annotate(
            applications=Count('application_event', distinct=True),
            total_amount=Sum('total_amount'),
        ).order_by('-applications')

        restricted_count = queryset.filter(
            tank_mix_items__product__restricted_use=True
        ).distinct().count()

        by_county = queryset.values('county').annotate(
            applications=Count('id'),
            acres=Sum('treated_area_acres'),
        ).order_by('-applications')

        return Response({
            'summary': {
                'total_applications': queryset.count(),
                'total_acres_treated': float(total_acres),
                'unique_products': items.values('product').distinct().count(),
                'restricted_use_applications': restricted_count,
                'by_county': [
                    {
                        'county': c['county'] or 'Unknown',
                        'applications': c['applications'],
                        'acres': float(c['acres'] or 0),
                    }
                    for c in by_county
                ],
                'by_product': [
                    {
                        'product_name': p['product__product_name'],
                        'epa_reg_no': p['product__epa_registration_number'] or '',
                        'applications': p['applications'],
                        'total_amount': float(p['total_amount'] or 0),
                    }
                    for p in product_stats[:20]
                ],
            }
        })

    @action(detail=False, methods=['post'])
    def export_pur_csv(self, request):
        """Export application events as PUR-formatted CSV."""
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        farm_id = request.data.get('farm_id')

        queryset = self.get_queryset()
        if start_date:
            queryset = queryset.filter(date_started__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date_started__date__lte=end_date)
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = (
            f'attachment; filename="PUR_Report_{start_date}_to_{end_date}.csv"'
        )

        writer = csv.writer(response)
        writer.writerow([
            'PUR Number', 'Application Date', 'Farm Name', 'Site ID',
            'County', 'Section', 'Township', 'Range',
            'Applicator', 'Applicator ID',
            'Product Name', 'EPA Reg Number', 'Active Ingredient',
            'Amount Applied', 'Amount Unit', 'Rate', 'Rate Unit',
            'Treated Acres', 'Application Method',
            'Commodity', 'Permit Number',
            'Wind MPH', 'Temperature F',
            'Comments',
        ])

        for evt in queryset:
            items = evt.tank_mix_items.select_related('product').all()
            if not items.exists():
                # Write a row even with no products
                writer.writerow([
                    evt.pur_number or '',
                    evt.date_started.strftime('%m/%d/%Y') if evt.date_started else '',
                    evt.farm.name if evt.farm else '',
                    evt.site_id or '',
                    evt.county or '',
                    evt.section or '', evt.township or '', evt.range_field or '',
                    evt.applied_by or '',
                    evt.applicator.applicator_id if evt.applicator else '',
                    '', '', '',
                    '', '', '', '',
                    float(evt.treated_area_acres or 0),
                    evt.application_method or '',
                    evt.commodity_name or '',
                    evt.permit_number or '',
                    evt.wind_velocity_mph or '',
                    evt.temperature_start_f or '',
                    evt.comments or '',
                ])
            else:
                for item in items:
                    writer.writerow([
                        evt.pur_number or '',
                        evt.date_started.strftime('%m/%d/%Y') if evt.date_started else '',
                        evt.farm.name if evt.farm else '',
                        evt.site_id or '',
                        evt.county or '',
                        evt.section or '', evt.township or '', evt.range_field or '',
                        evt.applied_by or '',
                        evt.applicator.applicator_id if evt.applicator else '',
                        item.product.product_name,
                        item.product.epa_registration_number or '',
                        item.product.active_ingredient or '',
                        float(item.total_amount or 0),
                        item.amount_unit or '',
                        float(item.rate or 0),
                        item.rate_unit or '',
                        float(evt.treated_area_acres or 0),
                        evt.application_method or '',
                        evt.commodity_name or '',
                        evt.permit_number or '',
                        evt.wind_velocity_mph or '',
                        evt.temperature_start_f or '',
                        evt.comments or '',
                    ])

        return response


# =============================================================================
# PUR IMPORT PIPELINE
# =============================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def pur_import_upload(request):
    """
    Upload a PUR PDF, parse it, and return structured data for review.
    Does NOT save to database.

    Accepts multipart/form-data with 'file' field.
    Returns parsed PUR reports as JSON.
    """
    from .services.pur_parser import parse_pur_pdf
    import tempfile
    import os

    if 'file' not in request.FILES:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

    pdf_file = request.FILES['file']

    if not pdf_file.name.lower().endswith('.pdf'):
        return Response({'error': 'File must be a PDF'}, status=status.HTTP_400_BAD_REQUEST)

    # Write to temp file for pdfplumber
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        for chunk in pdf_file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        results = parse_pur_pdf(tmp_path)
    except Exception as e:
        logger.error(f"PUR PDF parsing failed: {e}", exc_info=True)
        return Response(
            {'error': f'Failed to parse PDF: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    finally:
        os.unlink(tmp_path)

    # Enrich with product/field matching info
    company = get_user_company(request.user)
    enriched = []
    for r in results:
        r['_match_info'] = _enrich_with_matches(r, company)
        enriched.append(r)

    return Response({
        'filename': pdf_file.name,
        'report_count': len(enriched),
        'reports': enriched,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def pur_import_confirm(request):
    """
    Confirm and save parsed PUR data to the database.

    Accepts a list of parsed PUR reports (potentially edited by the user).
    Creates ApplicationEvent + TankMixItem records.
    Auto-creates Product and Applicator records for unrecognized entities.
    """
    company = require_company(request.user)
    reports = request.data.get('reports', [])
    source_filename = request.data.get('filename', '')

    if not reports:
        return Response({'error': 'No reports to import'}, status=status.HTTP_400_BAD_REQUEST)

    batch_id = str(uuid.uuid4())[:12]
    created_events = []
    created_products = 0
    created_applicators = 0
    errors = []

    for idx, report in enumerate(reports):
        try:
            if report.get('_skip', False):
                continue

            # 1. Resolve farm
            farm_id = report.get('_farm_id')
            if not farm_id:
                errors.append(f"Report #{idx+1} ({report.get('pur_number', '?')}): No farm selected")
                continue

            try:
                farm = Farm.objects.get(id=farm_id, company=company)
            except Farm.DoesNotExist:
                errors.append(f"Report #{idx+1}: Farm not found (id={farm_id})")
                continue

            # Save pur_site_id on farm if requested
            if report.get('_save_site_mapping') and report.get('site_id'):
                farm.pur_site_id = report['site_id']
                farm.save(update_fields=['pur_site_id'])

            # 2. Resolve applicator
            applicator = _resolve_applicator(report, company)
            if applicator and not applicator.pk:
                applicator.save()
                created_applicators += 1

            # 3. Create ApplicationEvent
            from datetime import datetime as dt
            event = ApplicationEvent.objects.create(
                company=company,
                farm=farm,
                applicator=applicator,
                pur_number=report.get('pur_number', ''),
                pur_status=report.get('pur_status', 'draft'),
                recommendation_number=report.get('recommendation_number', ''),
                county=report.get('county', 'Ventura'),
                section=report.get('section', ''),
                township=report.get('township', ''),
                range_field=report.get('range', ''),
                baseline=report.get('baseline', 'S'),
                permit_number=report.get('permit_number', ''),
                site_id=report.get('site_id', ''),
                date_started=report.get('date_started') or dt.now().isoformat(),
                date_completed=report.get('date_completed') or None,
                planted_area_acres=report.get('planted_area_acres'),
                treated_area_acres=report.get('treated_area_acres') or 0,
                commodity_name=report.get('commodity_name', ''),
                commodity_code=report.get('commodity_code', ''),
                application_method=report.get('application_method', 'ground'),
                comments=report.get('comments', ''),
                restrictions=report.get('restrictions', ''),
                wind_direction_degrees=report.get('wind_direction_degrees'),
                wind_velocity_mph=report.get('wind_velocity_mph'),
                temperature_start_f=report.get('temperature_start_f'),
                temperature_finish_f=report.get('temperature_finish_f'),
                rei_hours=report.get('rei_hours'),
                phi_days=report.get('phi_days'),
                applied_by=report.get('applied_by', ''),
                is_organic=report.get('is_organic', False),
                is_nursery=report.get('is_nursery', False),
                is_pre_plant=report.get('is_pre_plant', False),
                imported_from='telus_pdf',
                import_batch_id=batch_id,
                source_pdf_filename=source_filename,
            )

            # 4. Create TankMixItems
            for prod_data in report.get('products', []):
                product = _resolve_product(prod_data, company)
                if product and not product.pk:
                    product.save()
                    created_products += 1

                if product:
                    TankMixItem.objects.create(
                        application_event=event,
                        product=product,
                        total_amount=prod_data.get('total_amount', 0),
                        amount_unit=prod_data.get('amount_unit', 'Ga'),
                        rate=prod_data.get('rate', 0),
                        rate_unit=prod_data.get('rate_unit', 'Ga/A'),
                        dilution_gallons=prod_data.get('dilution_gallons'),
                        sort_order=prod_data.get('sort_order', 0),
                    )

            event.update_compliance_from_items()
            created_events.append(event.id)

        except Exception as e:
            logger.error(f"Failed to import PUR #{idx+1}: {e}", exc_info=True)
            errors.append(f"Report #{idx+1}: {str(e)}")

    return Response({
        'success': len(errors) == 0,
        'batch_id': batch_id,
        'created_events': len(created_events),
        'event_ids': created_events,
        'created_products': created_products,
        'created_applicators': created_applicators,
        'errors': errors,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def pur_match_products(request):
    """Match a product name + EPA reg# to existing Product records."""
    company = get_user_company(request.user)
    epa = request.query_params.get('epa', '')
    name = request.query_params.get('name', '')

    qs = Product.objects.filter(is_active=True)
    if company:
        qs = qs.filter(Q(company__isnull=True) | Q(company=company))

    # 1. Exact EPA match
    if epa and epa != '-':
        match = qs.filter(epa_registration_number=epa).first()
        if match:
            return Response({
                'match_type': 'exact_epa',
                'product': ProductListSerializer(match).data,
            })

    # 2. Fuzzy name match
    if name and len(name) >= 3:
        candidates = qs.filter(product_name__icontains=name)[:5]
        if candidates.exists():
            return Response({
                'match_type': 'fuzzy_name',
                'candidates': ProductListSerializer(candidates, many=True).data,
            })

    return Response({'match_type': 'none', 'product': None})


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def pur_match_farms(request):
    """Match a PUR site_id / location to existing Farm records."""
    company = get_user_company(request.user)
    site_id = request.query_params.get('site_id', '')
    location = request.query_params.get('location', '')

    qs = Farm.objects.filter(active=True)
    if company:
        qs = qs.filter(company=company)

    results = []

    # 1. Exact pur_site_id match
    if site_id:
        exact = qs.filter(pur_site_id=site_id).first()
        if exact:
            results.append({
                'match_type': 'exact_site_id',
                'farm_id': exact.id,
                'farm_name': exact.name,
            })

    # 2. Fuzzy name match
    if location:
        parts = location.replace('/', ' ').split()
        for part in parts:
            if len(part) >= 3:
                matches = qs.filter(
                    Q(name__icontains=part) | Q(farm_number__icontains=part)
                )[:5]
                for m in matches:
                    if not any(r['farm_id'] == m.id for r in results):
                        results.append({
                            'match_type': 'fuzzy_location',
                            'farm_id': m.id,
                            'farm_name': m.name,
                        })

    # 3. If no matches, return all farms for manual selection
    if not results:
        all_farms = qs[:50]
        results = [{
            'match_type': 'none',
            'farm_id': f.id,
            'farm_name': f.name,
        } for f in all_farms]

    return Response(results)


# Keep old name as alias for backward compatibility
pur_match_fields = pur_match_farms


# =============================================================================
# HELPERS
# =============================================================================

def _enrich_with_matches(report, company):
    """Add product and field match info to a parsed report."""
    match_info = {
        'farm_matches': [],
        'product_matches': [],
    }

    qs_farms = Farm.objects.filter(active=True)
    qs_products = Product.objects.filter(is_active=True)
    if company:
        qs_farms = qs_farms.filter(company=company)
        qs_products = qs_products.filter(Q(company__isnull=True) | Q(company=company))

    # Farm matching
    site_id = report.get('site_id', '')
    if site_id:
        exact = qs_farms.filter(pur_site_id=site_id).first()
        if exact:
            match_info['farm_matches'].append({
                'match_type': 'exact_site_id',
                'farm_id': exact.id,
                'farm_name': exact.name,
            })

    # Product matching
    for prod in report.get('products', []):
        epa = prod.get('epa_registration_number', '')
        name = prod.get('product_name', '')
        match = {'product_name': name, 'epa': epa, 'match_type': 'none', 'product_id': None}

        if epa:
            existing = qs_products.filter(epa_registration_number=epa).first()
            if existing:
                match['match_type'] = 'exact_epa'
                match['product_id'] = existing.id
                match['matched_name'] = existing.product_name

        if match['match_type'] == 'none' and name and len(name) >= 3:
            fuzzy = qs_products.filter(product_name__icontains=name).first()
            if fuzzy:
                match['match_type'] = 'fuzzy_name'
                match['product_id'] = fuzzy.id
                match['matched_name'] = fuzzy.product_name

        match_info['product_matches'].append(match)

    return match_info


def _resolve_applicator(report, company):
    """Find or create an Applicator from parsed report data."""
    name = report.get('applicator_name', '').strip()
    if not name:
        return None

    applicator_id = report.get('applicator_id', '').strip()

    # Try matching by applicator_id first
    if applicator_id:
        existing = Applicator.objects.filter(
            Q(company=company) | Q(company__isnull=True),
            applicator_id=applicator_id
        ).first()
        if existing:
            return existing

    # Try matching by name
    existing = Applicator.objects.filter(
        Q(company=company) | Q(company__isnull=True),
        name__iexact=name
    ).first()
    if existing:
        return existing

    # Determine type from context
    app_type = 'pco'
    if 'aerial' in name.lower() or 'helicopter' in name.lower():
        app_type = 'aerial'

    # Create new (unsaved — caller saves)
    return Applicator(
        company=company,
        name=name,
        applicator_type=app_type,
        applicator_id=applicator_id,
        address=report.get('applicator_address', ''),
    )


def _resolve_product(prod_data, company):
    """Find or create a Product from parsed product data."""
    epa = prod_data.get('epa_registration_number', '').strip()
    name = prod_data.get('product_name', '').strip()

    if not name:
        return None

    # Check if user explicitly mapped to an existing product
    mapped_id = prod_data.get('_product_id')
    if mapped_id:
        try:
            return Product.objects.get(id=mapped_id)
        except Product.DoesNotExist:
            pass

    # Try EPA match
    if epa:
        existing = Product.objects.filter(
            Q(company=company) | Q(company__isnull=True),
            epa_registration_number=epa
        ).first()
        if existing:
            return existing

    # Try exact name match
    existing = Product.objects.filter(
        Q(company=company) | Q(company__isnull=True),
        product_name__iexact=name
    ).first()
    if existing:
        return existing

    # Determine product type
    product_type = _infer_product_type(name, epa, prod_data)

    # Create new (unsaved — caller saves)
    return Product(
        company=company,
        product_name=name,
        product_type=product_type,
        manufacturer=prod_data.get('manufacturer', ''),
        epa_registration_number=epa,
        active_ingredient=prod_data.get('active_ingredient', ''),
        active_ingredient_percent=prod_data.get('active_ingredient_percent'),
        active_ingredients=[{
            'name': prod_data.get('active_ingredient', ''),
            'percent': prod_data.get('active_ingredient_percent'),
        }] if prod_data.get('active_ingredient') else [],
    )


def _infer_product_type(name, epa, prod_data):
    """Infer product type from name and EPA info."""
    name_lower = name.lower()

    # Fertilizers typically have no EPA reg or NPK in name
    if not epa:
        if re.search(r'\d+-\d+-\d+', name):  # NPK pattern like "46-0-0"
            return 'fertilizer'
        # Common fertilizer keywords
        if any(kw in name_lower for kw in ['urea', 'potassium', 'phosph', 'nitrate', 'calcium']):
            return 'fertilizer'

    # Common adjuvant/surfactant keywords
    if any(kw in name_lower for kw in ['oil', 'sticker', 'surfactant', 'adjuvant', 'spreader']):
        return 'adjuvant'

    # Growth regulators
    if any(kw in name_lower for kw in ['gibberell', 'growth regul']):
        return 'growth_regulator'

    # Biologicals
    if any(kw in name_lower for kw in ['zyme', 'seaweed', 'biolog', 'microbial']):
        return 'biological'

    # Default to pesticide
    return 'pesticide'


# Need re module for _infer_product_type
import re
