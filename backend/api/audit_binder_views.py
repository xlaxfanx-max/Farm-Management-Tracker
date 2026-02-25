"""
CAC Audit Binder Views

ViewSets for managing CAC Food Safety Manual audit binders,
sections, and supporting documents.
"""

from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .permissions import HasCompanyAccess
from .audit_utils import AuditLogMixin
from .view_helpers import get_user_company, require_company

from .models import (
    CACBinderTemplate,
    AuditBinderInstance,
    BinderSection,
    BinderSupportingDocument,
    Farm,
    CAC_V5_SECTION_DEFINITIONS,
)

from .audit_binder_serializers import (
    CACBinderTemplateSerializer,
    AuditBinderInstanceSerializer, AuditBinderInstanceDetailSerializer,
    CreateAuditBinderSerializer,
    BinderSectionSerializer, BinderSectionDetailSerializer,
    BinderSupportingDocumentSerializer,
)


# =============================================================================
# CAC BINDER TEMPLATE VIEWSET
# =============================================================================

class CACBinderTemplateViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for CAC Food Safety Manual templates.
    Templates define the 39 document sections and store the fillable PDF.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    serializer_class = CACBinderTemplateSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return CACBinderTemplate.objects.none()
        return CACBinderTemplate.objects.filter(company=company)

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        # If no section_definitions provided, use V5.0 defaults
        if not serializer.validated_data.get('section_definitions'):
            serializer.save(
                company=company,
                section_definitions=CACBinderTemplate.get_default_section_definitions(),
            )
        else:
            serializer.save(company=company)

    @action(detail=False, methods=['get'])
    def default_sections(self, request):
        """Return the default V5.0 section definitions for reference."""
        return Response(CACBinderTemplate.get_default_section_definitions())


# =============================================================================
# AUDIT BINDER INSTANCE VIEWSET
# =============================================================================

class AuditBinderInstanceViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for audit binder instances.
    Each instance represents a specific audit preparation (e.g. '2026 Pre-Season').
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'notes']
    ordering_fields = ['name', 'season_year', 'status', 'created_at']
    ordering = ['-created_at']

    serializer_class = AuditBinderInstanceSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return AuditBinderInstance.objects.none()

        queryset = AuditBinderInstance.objects.filter(
            company=company
        ).select_related('template', 'farm', 'created_by').prefetch_related('sections')

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by season year
        year_filter = self.request.query_params.get('season_year')
        if year_filter:
            queryset = queryset.filter(season_year=year_filter)

        # Filter by farm
        farm_filter = self.request.query_params.get('farm')
        if farm_filter:
            queryset = queryset.filter(farm_id=farm_filter)

        return queryset

    @action(detail=False, methods=['post'])
    def create_from_template(self, request):
        """
        Create a new binder instance from a template.
        Automatically creates all 39 BinderSection records.
        """
        serializer = CreateAuditBinderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        company = require_company(request.user)

        # Validate template belongs to this company
        try:
            template = CACBinderTemplate.objects.get(
                id=serializer.validated_data['template_id'],
                company=company,
                is_active=True,
            )
        except CACBinderTemplate.DoesNotExist:
            return Response(
                {'error': 'Template not found or inactive'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Validate farm if provided
        farm = None
        farm_id = serializer.validated_data.get('farm_id')
        if farm_id:
            try:
                farm = Farm.objects.get(id=farm_id, company=company)
            except Farm.DoesNotExist:
                return Response(
                    {'error': 'Farm not found'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # Create the binder instance
        binder = AuditBinderInstance.objects.create(
            company=company,
            template=template,
            name=serializer.validated_data['name'],
            season_year=serializer.validated_data['season_year'],
            farm=farm,
            notes=serializer.validated_data.get('notes', ''),
            status='draft',
            created_by=request.user,
        )

        # Create all sections from template definitions
        binder.create_sections_from_template()

        return Response(
            AuditBinderInstanceDetailSerializer(
                binder, context={'request': request}
            ).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['get'])
    def readiness_summary(self, request, pk=None):
        """
        Return completion stats grouped by section_group.
        Used by the readiness dashboard.
        """
        binder = self.get_object()
        sections = binder.sections.all()

        # Group by section_group
        from .models.audit_binder import SECTION_GROUP_CHOICES
        groups = {}
        for key, label in SECTION_GROUP_CHOICES:
            group_sections = sections.filter(section_group=key)
            total = group_sections.count()
            if total == 0:
                continue
            complete = group_sections.filter(status='complete').count()
            na = group_sections.filter(status='not_applicable').count()
            in_progress = group_sections.filter(status='in_progress').count()
            not_started = group_sections.filter(status='not_started').count()
            applicable = total - na
            percent = round((complete / applicable * 100) if applicable > 0 else 0)
            groups[key] = {
                'label': label,
                'total': total,
                'complete': complete,
                'in_progress': in_progress,
                'not_started': not_started,
                'not_applicable': na,
                'percent': percent,
            }

        return Response({
            'overall': binder.completion_stats,
            'groups': groups,
        })


# =============================================================================
# BINDER SECTION VIEWSET
# =============================================================================

class BinderSectionViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for individual binder sections (documents 1-39).
    Nested under a binder instance via URL: /primusgfs/binder-sections/?binder=<id>
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']  # No create/delete via standard CRUD

    serializer_class = BinderSectionSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return BinderSection.objects.none()

        queryset = BinderSection.objects.filter(
            binder__company=company
        ).select_related('binder', 'completed_by').prefetch_related('supporting_documents')

        # Filter by binder
        binder_id = self.request.query_params.get('binder')
        if binder_id:
            queryset = queryset.filter(binder_id=binder_id)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by section_group
        group_filter = self.request.query_params.get('section_group')
        if group_filter:
            queryset = queryset.filter(section_group=group_filter)

        # Filter by doc_type
        type_filter = self.request.query_params.get('doc_type')
        if type_filter:
            queryset = queryset.filter(doc_type=type_filter)

        return queryset

    @action(detail=True, methods=['post'])
    def mark_complete(self, request, pk=None):
        """Mark a section as complete."""
        section = self.get_object()
        section.mark_complete(request.user)

        # Auto-update binder status
        self._update_binder_status(section.binder)

        return Response(
            BinderSectionDetailSerializer(section, context={'request': request}).data
        )

    @action(detail=True, methods=['post'])
    def mark_not_applicable(self, request, pk=None):
        """Mark a section as not applicable."""
        section = self.get_object()
        reason = request.data.get('reason', '')
        section.mark_not_applicable(reason)

        # Auto-update binder status
        self._update_binder_status(section.binder)

        return Response(
            BinderSectionDetailSerializer(section, context={'request': request}).data
        )

    @action(detail=True, methods=['post'])
    def update_sop(self, request, pk=None):
        """Save SOP content for a section."""
        section = self.get_object()
        sop_content = request.data.get('sop_content', '')
        section.sop_content = sop_content
        if section.status == 'not_started':
            section.status = 'in_progress'
        section.save(update_fields=['sop_content', 'status'])

        return Response(
            BinderSectionDetailSerializer(section, context={'request': request}).data
        )

    @action(detail=True, methods=['post'])
    def update_notes(self, request, pk=None):
        """Save notes for a section."""
        section = self.get_object()
        section.notes = request.data.get('notes', '')
        section.save(update_fields=['notes'])

        return Response(
            BinderSectionDetailSerializer(section, context={'request': request}).data
        )

    @action(detail=True, methods=['get'])
    def auto_fill_preview(self, request, pk=None):
        """
        Run the auto-fill function for this section and return live data preview.
        Does NOT save the data - just shows what would be filled.
        """
        section = self.get_object()
        if not section.auto_fill_source:
            return Response(
                {'fields': [], 'warnings': ['This section does not support auto-fill.']},
            )

        from .services.cac_auto_fill import get_auto_fill_data

        binder = section.binder
        result = get_auto_fill_data(
            source_key=section.auto_fill_source,
            company_id=binder.company_id,
            farm_id=binder.farm_id,
            season_year=binder.season_year,
        )

        return Response(result)

    @action(detail=True, methods=['post'])
    def apply_auto_fill(self, request, pk=None):
        """
        Run the auto-fill function and save the result to auto_fill_data.
        Also applies any manual_overrides from the request body.
        """
        section = self.get_object()
        if not section.auto_fill_source:
            return Response(
                {'error': 'This section does not support auto-fill.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .services.cac_auto_fill import get_auto_fill_data

        binder = section.binder
        result = get_auto_fill_data(
            source_key=section.auto_fill_source,
            company_id=binder.company_id,
            farm_id=binder.farm_id,
            season_year=binder.season_year,
        )

        # Save auto-fill data
        section.auto_fill_data = result
        if section.status == 'not_started':
            section.status = 'in_progress'

        # Apply manual overrides if provided
        overrides = request.data.get('manual_overrides')
        if overrides:
            section.manual_overrides = overrides

        # Bridge: also resolve auto-fill values to PDF field names so the
        # PDF editor shows auto-fill data without requiring a separate step.
        self._bridge_auto_fill_to_pdf_fields(section, binder)

        section.save(update_fields=[
            'auto_fill_data', 'manual_overrides', 'pdf_field_data', 'status',
        ])

        return Response(
            BinderSectionDetailSerializer(section, context={'request': request}).data
        )

    @action(detail=True, methods=['post'], url_path='save_pdf_fields')
    def save_pdf_fields(self, request, pk=None):
        """
        Save user-edited PDF form field values to this binder section.

        Request body::

            {
                "field_values": {
                    "1-a-100": "Sunrise Ranch",
                    "4-a-CheckBox1": true,
                    ...
                }
            }

        Uses merge (PATCH) semantics: fields not included are left unchanged.
        """
        section = self.get_object()
        field_values = request.data.get('field_values', {})

        if not isinstance(field_values, dict):
            return Response(
                {'error': 'field_values must be a dict'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Merge with existing data (PATCH semantics)
        existing = section.pdf_field_data or {}
        existing.update(field_values)
        section.pdf_field_data = existing

        if section.status == 'not_started':
            section.status = 'in_progress'

        section.save(update_fields=['pdf_field_data', 'status'])

        return Response(
            BinderSectionDetailSerializer(section, context={'request': request}).data
        )

    @action(detail=True, methods=['post'], url_path='reset_pdf_fields')
    def reset_pdf_fields(self, request, pk=None):
        """Clear all user PDF field overrides, reverting to auto-fill defaults."""
        section = self.get_object()
        section.pdf_field_data = None
        section.save(update_fields=['pdf_field_data'])

        return Response(
            BinderSectionDetailSerializer(section, context={'request': request}).data
        )

    def _bridge_auto_fill_to_pdf_fields(self, section, binder):
        """
        Resolve auto-fill values to PDF AcroForm field names and merge
        into section.pdf_field_data.  User overrides take priority.
        """
        from .services.primusgfs.cac_data_mapper import CACDataMapper, DOC_PAGE_MAP
        from .services.primusgfs.cac_pdf_filler import CACPDFFieldFiller

        doc_str = str(section.doc_number).zfill(2)
        if doc_str not in DOC_PAGE_MAP:
            return

        try:
            fields_by_page = CACPDFFieldFiller.discover_fields()
            mapper = CACDataMapper(
                company=binder.company,
                farm=binder.farm,
                season_year=binder.season_year,
            )
            all_text = mapper.resolve_positional_fields(fields_by_page)
            all_cb = mapper.resolve_positional_checkboxes(fields_by_page)

            # Filter to only fields on this doc's pages
            doc_pages = set(DOC_PAGE_MAP[doc_str])
            doc_field_names = set()
            for page_num, fields in fields_by_page.items():
                if page_num in doc_pages:
                    for f in fields:
                        doc_field_names.add(f['name'])

            auto_pdf_data = {}
            for name in doc_field_names:
                if name in all_text and all_text[name]:
                    auto_pdf_data[name] = all_text[name]
                elif name in all_cb:
                    auto_pdf_data[name] = all_cb[name]

            # Merge: auto-fill as base, existing user edits take priority
            if section.pdf_field_data:
                auto_pdf_data.update(section.pdf_field_data)
            section.pdf_field_data = auto_pdf_data
        except Exception as e:
            logger = __import__('logging').getLogger(__name__)
            logger.warning(
                "Could not bridge auto-fill to PDF fields for doc %s: %s",
                doc_str, e,
            )

    def _update_binder_status(self, binder):
        """Auto-update binder status based on section completion."""
        stats = binder.completion_stats
        if stats['complete'] == 0 and stats['in_progress'] == 0:
            new_status = 'draft'
        elif stats['percent'] == 100:
            new_status = 'ready'
        else:
            new_status = 'in_progress'

        if binder.status != new_status and binder.status != 'submitted':
            binder.status = new_status
            binder.save(update_fields=['status'])


# =============================================================================
# BINDER SUPPORTING DOCUMENT VIEWSET
# =============================================================================

class BinderSupportingDocumentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for supporting documents attached to binder sections.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = BinderSupportingDocumentSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return BinderSupportingDocument.objects.none()

        queryset = BinderSupportingDocument.objects.filter(
            section__binder__company=company
        ).select_related('uploaded_by')

        # Filter by section
        section_id = self.request.query_params.get('section')
        if section_id:
            queryset = queryset.filter(section_id=section_id)

        return queryset

    def perform_create(self, serializer):
        # Set file_name from the uploaded file if not provided
        file_obj = self.request.FILES.get('file')
        extra = {'uploaded_by': self.request.user}
        if file_obj and not serializer.validated_data.get('file_name'):
            extra['file_name'] = file_obj.name
        serializer.save(**extra)
