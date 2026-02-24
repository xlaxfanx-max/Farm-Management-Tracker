"""
PUR views — ViewSets for Product, Applicator, ApplicationEvent, and PUR import pipeline.
"""
import uuid
import logging
from django.db.models import Q
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from .models import (
    Product, Applicator, ApplicationEvent, TankMixItem, Field,
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
    search_fields = ['pur_number', 'field__name', 'commodity_name', 'applied_by']
    ordering_fields = ['date_started', 'created_at', 'pur_number']
    ordering = ['-date_started']

    def get_queryset(self):
        company = get_user_company(self.request.user)
        qs = ApplicationEvent.objects.select_related(
            'field', 'field__farm', 'applicator'
        ).prefetch_related('tank_mix_items', 'tank_mix_items__product')

        if company:
            qs = qs.filter(company=company)

        # Filters
        field_id = self.request.query_params.get('field')
        if field_id:
            qs = qs.filter(field_id=field_id)

        farm_id = self.request.query_params.get('farm')
        if farm_id:
            qs = qs.filter(field__farm_id=farm_id)

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

            # 1. Resolve field
            field_id = report.get('_field_id')
            if not field_id:
                errors.append(f"Report #{idx+1} ({report.get('pur_number', '?')}): No field selected")
                continue

            try:
                field = Field.objects.get(id=field_id, farm__company=company)
            except Field.DoesNotExist:
                errors.append(f"Report #{idx+1}: Field not found (id={field_id})")
                continue

            # Save pur_site_id if requested
            if report.get('_save_site_mapping') and report.get('site_id'):
                field.pur_site_id = report['site_id']
                field.save(update_fields=['pur_site_id'])

            # 2. Resolve applicator
            applicator = _resolve_applicator(report, company)
            if applicator and not applicator.pk:
                applicator.save()
                created_applicators += 1

            # 3. Create ApplicationEvent
            from datetime import datetime as dt
            event = ApplicationEvent.objects.create(
                company=company,
                field=field,
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
def pur_match_fields(request):
    """Match a PUR site_id / location to existing Field records."""
    company = get_user_company(request.user)
    site_id = request.query_params.get('site_id', '')
    location = request.query_params.get('location', '')

    qs = Field.objects.filter(active=True)
    if company:
        qs = qs.filter(farm__company=company)

    results = []

    # 1. Exact pur_site_id match
    if site_id:
        exact = qs.filter(pur_site_id=site_id).first()
        if exact:
            results.append({
                'match_type': 'exact_site_id',
                'field_id': exact.id,
                'field_name': exact.name,
                'farm_name': exact.farm.name if exact.farm else '',
            })

    # 2. Fuzzy location/name match
    if location:
        # Try matching by field name containing location keywords
        parts = location.replace('/', ' ').split()
        for part in parts:
            if len(part) >= 3:
                matches = qs.filter(
                    Q(name__icontains=part) | Q(field_number__icontains=part)
                )[:5]
                for m in matches:
                    if not any(r['field_id'] == m.id for r in results):
                        results.append({
                            'match_type': 'fuzzy_location',
                            'field_id': m.id,
                            'field_name': m.name,
                            'farm_name': m.farm.name if m.farm else '',
                        })

    # 3. If no matches, return all fields for manual selection
    if not results:
        all_fields = qs.select_related('farm')[:50]
        results = [{
            'match_type': 'none',
            'field_id': f.id,
            'field_name': f.name,
            'farm_name': f.farm.name if f.farm else '',
        } for f in all_fields]

    return Response(results)


# =============================================================================
# HELPERS
# =============================================================================

def _enrich_with_matches(report, company):
    """Add product and field match info to a parsed report."""
    match_info = {
        'field_matches': [],
        'product_matches': [],
    }

    qs_fields = Field.objects.filter(active=True)
    qs_products = Product.objects.filter(is_active=True)
    if company:
        qs_fields = qs_fields.filter(farm__company=company)
        qs_products = qs_products.filter(Q(company__isnull=True) | Q(company=company))

    # Field matching
    site_id = report.get('site_id', '')
    if site_id:
        exact = qs_fields.filter(pur_site_id=site_id).first()
        if exact:
            match_info['field_matches'].append({
                'match_type': 'exact_site_id',
                'field_id': exact.id,
                'field_name': exact.name,
                'farm_name': exact.farm.name if exact.farm else '',
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
