"""
FSMA Rule 204 Traceability Views

API endpoints for lot-level traceability including:
- TraceabilityLot CRUD + create-from-harvest
- TraceabilityEvent (CTE) management
- LotDisposition tracking
- ContaminationIncident + corrective actions
- Full trace report assembly (one-step-back / one-step-forward)
- Traceability dashboard
"""

from datetime import timedelta
from django.db.models import Count, Q, Prefetch
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .permissions import HasCompanyAccess
from .view_helpers import CompanyFilteredViewSet, get_user_company, require_company

from .models import (
    TraceabilityLot, TraceabilityEvent, LotDisposition,
    ContaminationIncident, IncidentCorrectiveAction,
    Harvest, HarvestLoad, PackinghouseDelivery,
    PesticideApplication, NutrientApplication,
    VisitorLog, FacilityCleaningLog, FSMAWaterAssessment,
)

from .traceability_serializers import (
    TraceabilityLotSerializer,
    TraceabilityLotCreateFromHarvestSerializer,
    TraceabilityEventSerializer,
    LotDispositionSerializer,
    ContaminationIncidentSerializer,
    IncidentCorrectiveActionSerializer,
    FullTraceReportSerializer,
)


# =============================================================================
# TRACEABILITY LOT VIEWSET
# =============================================================================

class TraceabilityLotViewSet(CompanyFilteredViewSet):
    model = TraceabilityLot
    serializer_class = TraceabilityLotSerializer
    select_related_fields = ('field', 'farm', 'harvest')
    default_ordering = ('-harvest_date', '-created_at')

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.annotate(_event_count=Count('events'))

        # Query param filters
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(lot_number__icontains=search) |
                Q(product_description__icontains=search) |
                Q(commodity__icontains=search)
            )

        farm_id = self.request.query_params.get('farm')
        if farm_id:
            qs = qs.filter(farm_id=farm_id)

        field_id = self.request.query_params.get('field')
        if field_id:
            qs = qs.filter(field_id=field_id)

        return qs

    @action(detail=False, methods=['post'], url_path='create-from-harvest')
    def create_from_harvest(self, request):
        """Create a TraceabilityLot from an existing Harvest record."""
        company = require_company(request.user)
        serializer = TraceabilityLotCreateFromHarvestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        harvest = Harvest.objects.select_related(
            'field', 'field__farm'
        ).get(pk=serializer.validated_data['harvest_id'])

        # Build the lot from harvest data
        lot = TraceabilityLot.objects.create(
            company=company,
            lot_number=harvest.lot_number,
            harvest=harvest,
            product_description=serializer.validated_data['product_description'],
            commodity=harvest.crop_variety,
            field=harvest.field,
            farm=harvest.field.farm if harvest.field else None,
            growing_cycle=harvest.growing_cycle,
            harvest_date=harvest.harvest_date,
            quantity_bins=harvest.total_bins,
            quantity_weight_lbs=harvest.estimated_weight_lbs,
            status='harvested',
            phi_compliant=harvest.phi_compliant,
            created_by=request.user,
        )

        # Check water assessment status
        if harvest.field and harvest.field.farm:
            water_assessment = FSMAWaterAssessment.objects.filter(
                farm=harvest.field.farm,
                status='approved',
            ).first()
            if water_assessment:
                lot.water_assessment_status = 'approved'
                lot.save(update_fields=['water_assessment_status'])

        # Auto-create growing CTE
        TraceabilityEvent.objects.create(
            lot=lot,
            event_type='growing',
            event_date=timezone.make_aware(
                timezone.datetime.combine(harvest.harvest_date, timezone.datetime.min.time())
            ),
            location_name=harvest.field.name if harvest.field else 'Unknown Field',
            location_address=harvest.field.farm.address if harvest.field and harvest.field.farm else '',
            quantity_bins=harvest.total_bins,
            quantity_weight_lbs=harvest.estimated_weight_lbs,
            trading_partner_name=company.name,
            trading_partner_type='Grower',
            reference_document_type='Harvest Record',
            reference_document_number=harvest.lot_number,
            created_by=request.user,
        )

        # Auto-create shipping CTEs from harvest loads
        for load in harvest.loads.select_related('buyer').all():
            TraceabilityEvent.objects.create(
                lot=lot,
                event_type='shipping',
                event_date=load.departure_time or timezone.make_aware(
                    timezone.datetime.combine(harvest.harvest_date, timezone.datetime.min.time())
                ),
                location_name=harvest.field.farm.name if harvest.field and harvest.field.farm else 'Farm',
                quantity_bins=load.bins,
                quantity_weight_lbs=load.weight_lbs,
                trading_partner_name=load.buyer.name if load.buyer else '',
                trading_partner_type='Buyer',
                truck_id=load.truck_id or '',
                trailer_id=load.trailer_id or '',
                driver_name=load.driver_name or '',
                seal_number=load.seal_number or '',
                temperature_f=load.temperature_at_loading,
                departure_time=load.departure_time,
                arrival_time=load.arrival_time,
                reference_document_type='Weight Ticket',
                reference_document_number=load.weight_ticket_number or '',
                harvest_load=load,
                created_by=request.user,
            )

        # Auto-create receiving CTEs from packinghouse deliveries
        for delivery in harvest.packinghouse_deliveries.select_related(
            'pool__packinghouse'
        ).all():
            TraceabilityEvent.objects.create(
                lot=lot,
                event_type='receiving',
                event_date=timezone.make_aware(
                    timezone.datetime.combine(delivery.delivery_date, timezone.datetime.min.time())
                ),
                location_name=delivery.pool.packinghouse.name if delivery.pool else 'Packinghouse',
                location_address=(
                    delivery.pool.packinghouse.address if delivery.pool else ''
                ),
                quantity_bins=delivery.bins,
                quantity_weight_lbs=delivery.weight_lbs,
                trading_partner_name=(
                    delivery.pool.packinghouse.name if delivery.pool else ''
                ),
                trading_partner_type='Packinghouse',
                reference_document_type='Receiving Ticket',
                reference_document_number=delivery.ticket_number,
                packinghouse_delivery=delivery,
                created_by=request.user,
            )

        result = TraceabilityLotSerializer(lot, context={'request': request})
        return Response(result.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='full-trace')
    def full_trace(self, request, pk=None):
        """
        Assemble the complete one-step-back / one-step-forward report
        for FDA Rule 204 compliance. Designed to be producible within 24 hours.
        """
        lot = self.get_object()

        # One-step-back: everything that went into this lot
        one_step_back = {
            'field': None,
            'farm': None,
            'pesticide_applications': [],
            'nutrient_applications': [],
            'water_sources': [],
            'visitors': [],
            'labor': [],
        }

        if lot.field:
            one_step_back['field'] = {
                'id': lot.field.id,
                'name': lot.field.name,
                'acreage': str(lot.field.acreage) if lot.field.acreage else None,
            }

        if lot.farm:
            one_step_back['farm'] = {
                'id': lot.farm.id,
                'name': lot.farm.name,
                'address': lot.farm.address if hasattr(lot.farm, 'address') else '',
            }

        # Pesticide applications within 365 days before harvest
        if lot.field and lot.harvest_date:
            lookback = lot.harvest_date - timedelta(days=365)
            pest_apps = PesticideApplication.objects.filter(
                field=lot.field,
                application_date__gte=lookback,
                application_date__lte=lot.harvest_date,
            ).select_related('product').order_by('-application_date')

            one_step_back['pesticide_applications'] = [
                {
                    'date': str(app.application_date),
                    'product': app.product.product_name if app.product else 'Unknown',
                    'phi_days': app.product.phi_days if app.product else None,
                    'rate': str(app.rate) if app.rate else None,
                }
                for app in pest_apps
            ]

            # Nutrient applications in same window
            nut_apps = NutrientApplication.objects.filter(
                field=lot.field,
                application_date__gte=lookback,
                application_date__lte=lot.harvest_date,
            ).order_by('-application_date')

            one_step_back['nutrient_applications'] = [
                {
                    'date': str(app.application_date),
                    'product': app.product_name,
                    'rate': str(app.rate) if hasattr(app, 'rate') and app.rate else None,
                }
                for app in nut_apps
            ]

        # Visitors on harvest date
        if lot.harvest and lot.farm:
            visitors = VisitorLog.objects.filter(
                Q(linked_harvest=lot.harvest) |
                Q(farm=lot.farm, visit_date=lot.harvest_date)
            ).distinct()

            one_step_back['visitors'] = [
                {
                    'name': v.visitor_name,
                    'company': v.visitor_company,
                    'purpose': v.purpose,
                    'date': str(v.visit_date),
                }
                for v in visitors
            ]

        # Labor records
        if lot.harvest:
            one_step_back['labor'] = [
                {
                    'contractor': labor.contractor.company_name if labor.contractor else '',
                    'crew_name': labor.crew_name,
                    'foreman': labor.foreman_name,
                    'training_verified': labor.training_verified,
                    'workers': labor.worker_count,
                }
                for labor in lot.harvest.labor_records.select_related('contractor').all()
            ]

        # Critical tracking events
        events = lot.events.all()

        # One-step-forward: where the lot went
        one_step_forward = {
            'loads': [],
            'deliveries': [],
            'dispositions': [],
        }

        if lot.harvest:
            one_step_forward['loads'] = [
                {
                    'load_number': load.load_number,
                    'buyer': load.buyer.name if load.buyer else '',
                    'bins': load.bins,
                    'weight_lbs': str(load.weight_lbs) if load.weight_lbs else None,
                    'truck_id': load.truck_id,
                    'driver': load.driver_name,
                    'departure': str(load.departure_time) if load.departure_time else None,
                    'arrival': str(load.arrival_time) if load.arrival_time else None,
                    'temperature_f': str(load.temperature_at_loading) if load.temperature_at_loading else None,
                }
                for load in lot.harvest.loads.select_related('buyer').all()
            ]

            one_step_forward['deliveries'] = [
                {
                    'ticket_number': d.ticket_number,
                    'packinghouse': d.pool.packinghouse.name if d.pool else '',
                    'pool': d.pool.name if d.pool else '',
                    'delivery_date': str(d.delivery_date),
                    'bins': str(d.bins),
                    'weight_lbs': str(d.weight_lbs) if d.weight_lbs else None,
                }
                for d in lot.harvest.packinghouse_deliveries.select_related(
                    'pool__packinghouse'
                ).all()
            ]

        one_step_forward['dispositions'] = [
            {
                'type': d.get_disposition_type_display(),
                'date': str(d.disposition_date),
                'quantity_bins': str(d.quantity_bins) if d.quantity_bins else None,
                'buyer': d.buyer.name if d.buyer else d.processor_name,
            }
            for d in lot.dispositions.select_related('buyer').all()
        ]

        # Compliance snapshot
        compliance = {
            'phi_compliant': lot.phi_compliant,
            'water_assessment_status': lot.water_assessment_status or 'not_assessed',
            'fda_response_ready': lot.fda_response_ready,
            'completeness_score': lot.completeness_score,
        }

        # Facility sanitation around harvest date
        if lot.farm and lot.harvest_date:
            cleanings = FacilityCleaningLog.objects.filter(
                facility__farm=lot.farm,
                cleaning_date__gte=lot.harvest_date - timedelta(days=7),
                cleaning_date__lte=lot.harvest_date + timedelta(days=7),
            ).select_related('facility')
            compliance['facility_cleanings'] = [
                {
                    'facility': c.facility.name,
                    'date': str(c.cleaning_date),
                    'sanitizer_applied': c.sanitizer_applied,
                    'verified': c.verified_at is not None,
                }
                for c in cleanings
            ]

        # Linked incidents
        incidents = lot.contamination_incidents.all()

        data = {
            'lot': TraceabilityLotSerializer(lot, context={'request': request}).data,
            'one_step_back': one_step_back,
            'critical_tracking_events': TraceabilityEventSerializer(
                events, many=True, context={'request': request}
            ).data,
            'one_step_forward': one_step_forward,
            'compliance': compliance,
            'incidents': ContaminationIncidentSerializer(
                incidents, many=True, context={'request': request}
            ).data,
        }

        return Response(data)

    @action(detail=False, methods=['get'], url_path='dashboard')
    def dashboard(self, request):
        """Traceability module dashboard summary."""
        company = get_user_company(request.user)
        if not company:
            return Response({'error': 'No company'}, status=400)

        lots = TraceabilityLot.objects.filter(company=company)
        now = timezone.now().date()
        last_30 = now - timedelta(days=30)

        total = lots.count()
        by_status = dict(
            lots.values_list('status').annotate(count=Count('id')).values_list('status', 'count')
        )
        recent = lots.filter(created_at__date__gte=last_30).count()
        fda_ready = lots.filter(fda_response_ready=True).count()

        # Harvests without traceability lots (need attention)
        unlinked_harvests = Harvest.objects.filter(
            field__farm__company=company,
        ).exclude(
            traceability_lot__isnull=False,
        ).count()

        # Open incidents
        open_incidents = ContaminationIncident.objects.filter(
            company=company,
            status__in=['open', 'contained'],
        ).count()

        return Response({
            'total_lots': total,
            'lots_by_status': by_status,
            'recent_lots_30d': recent,
            'fda_ready_count': fda_ready,
            'fda_ready_pct': round(fda_ready / total * 100, 1) if total else 0,
            'unlinked_harvests': unlinked_harvests,
            'open_incidents': open_incidents,
        })

    @action(detail=False, methods=['get'], url_path='unlinked-harvests')
    def unlinked_harvests(self, request):
        """List harvests that don't yet have a traceability lot."""
        company = require_company(request.user)
        harvests = Harvest.objects.filter(
            field__farm__company=company,
        ).exclude(
            traceability_lot__isnull=False,
        ).select_related('field', 'field__farm').order_by('-harvest_date')[:50]

        data = [
            {
                'id': h.id,
                'lot_number': h.lot_number,
                'harvest_date': str(h.harvest_date),
                'field_name': h.field.name if h.field else '',
                'farm_name': h.field.farm.name if h.field and h.field.farm else '',
                'crop_variety': h.crop_variety,
                'total_bins': h.total_bins,
                'estimated_weight_lbs': str(h.estimated_weight_lbs) if h.estimated_weight_lbs else None,
                'phi_compliant': h.phi_compliant,
                'status': h.status,
            }
            for h in harvests
        ]
        return Response(data)


# =============================================================================
# TRACEABILITY EVENT VIEWSET
# =============================================================================

class TraceabilityEventViewSet(viewsets.ModelViewSet):
    serializer_class = TraceabilityEventSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return TraceabilityEvent.objects.none()

        qs = TraceabilityEvent.objects.filter(
            lot__company=company
        ).select_related('lot')

        lot_id = self.request.query_params.get('lot')
        if lot_id:
            qs = qs.filter(lot_id=lot_id)

        event_type = self.request.query_params.get('event_type')
        if event_type:
            qs = qs.filter(event_type=event_type)

        return qs.order_by('event_date')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# =============================================================================
# LOT DISPOSITION VIEWSET
# =============================================================================

class LotDispositionViewSet(viewsets.ModelViewSet):
    serializer_class = LotDispositionSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return LotDisposition.objects.none()

        qs = LotDisposition.objects.filter(
            lot__company=company
        ).select_related('lot', 'buyer')

        lot_id = self.request.query_params.get('lot')
        if lot_id:
            qs = qs.filter(lot_id=lot_id)

        return qs.order_by('-disposition_date')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# =============================================================================
# CONTAMINATION INCIDENT VIEWSET
# =============================================================================

class ContaminationIncidentViewSet(CompanyFilteredViewSet):
    model = ContaminationIncident
    serializer_class = ContaminationIncidentSerializer
    default_ordering = ('-incident_date',)
    prefetch_related_fields = ('lots', 'corrective_actions')

    def filter_queryset_by_params(self, queryset):
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset


# =============================================================================
# INCIDENT CORRECTIVE ACTION VIEWSET
# =============================================================================

class IncidentCorrectiveActionViewSet(viewsets.ModelViewSet):
    serializer_class = IncidentCorrectiveActionSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return IncidentCorrectiveAction.objects.none()

        qs = IncidentCorrectiveAction.objects.filter(
            incident__company=company
        ).select_related('incident')

        incident_id = self.request.query_params.get('incident')
        if incident_id:
            qs = qs.filter(incident_id=incident_id)

        return qs.order_by('planned_date')
