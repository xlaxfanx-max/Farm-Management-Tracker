"""
FSMA Compliance Module Views

This module provides API endpoints for FSMA compliance management including:
- User Signatures (saved digital signatures)
- Facility Locations (cleaning tracking)
- Facility Cleaning Logs
- Visitor Logs
- Safety Meetings and Attendees
- Fertilizer Inventory Management
- PHI Compliance Checking
- Audit Binder Generation
- FSMA Dashboard
"""

from datetime import date, timedelta, datetime
from decimal import Decimal
from django.db.models import Count, Q, Sum, F
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.http import FileResponse
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers as drf_serializers

from .permissions import HasCompanyAccess
from .audit_utils import AuditLogMixin

from .models import (
    UserSignature, FacilityLocation, FacilityCleaningLog,
    VisitorLog, SafetyMeeting, SafetyMeetingAttendee,
    FertilizerInventory, FertilizerInventoryTransaction, MonthlyInventorySnapshot,
    PHIComplianceCheck, AuditBinder,
    Farm, Field, Harvest, FertilizerProduct, PesticideApplication,
)

from .serializers import (
    UserSignatureSerializer,
    FacilityLocationSerializer, FacilityLocationListSerializer,
    FacilityCleaningLogSerializer, FacilityCleaningLogListSerializer,
    VisitorLogSerializer, VisitorLogListSerializer, VisitorQuickEntrySerializer,
    SafetyMeetingSerializer, SafetyMeetingListSerializer, SafetyMeetingAttendeeSerializer,
    FertilizerInventorySerializer, FertilizerInventoryListSerializer,
    FertilizerInventoryTransactionSerializer, FertilizerInventoryTransactionListSerializer,
    InventoryPurchaseSerializer, InventoryAdjustmentSerializer,
    MonthlyInventorySnapshotSerializer,
    PHIComplianceCheckSerializer, PHIComplianceCheckListSerializer, PHIPreCheckSerializer,
    AuditBinderSerializer, AuditBinderListSerializer, AuditBinderGenerateSerializer,
    FSMADashboardSerializer,
)

from .view_helpers import get_user_company, require_company


# =============================================================================
# USER SIGNATURE VIEWSET
# =============================================================================

class UserSignatureViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing user digital signatures.
    Each user has at most one saved signature.
    """
    serializer_class = UserSignatureSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    http_method_names = ['get', 'post', 'put', 'patch', 'delete']

    def get_queryset(self):
        # Users can only see their own signature
        return UserSignature.objects.filter(user=self.request.user)

    def get_object(self):
        """Get or raise 404 for current user's signature."""
        try:
            return UserSignature.objects.get(user=self.request.user)
        except UserSignature.DoesNotExist:
            from django.http import Http404
            raise Http404("No signature found")

    def list(self, request, *args, **kwargs):
        """Return the user's signature if it exists."""
        try:
            signature = UserSignature.objects.get(user=request.user)
            serializer = self.get_serializer(signature)
            return Response(serializer.data)
        except UserSignature.DoesNotExist:
            return Response({'detail': 'No signature saved'}, status=status.HTTP_404_NOT_FOUND)

    def create(self, request, *args, **kwargs):
        """Create or update the user's signature."""
        signature, created = UserSignature.objects.update_or_create(
            user=request.user,
            defaults={'signature_data': request.data.get('signature_data', '')}
        )
        serializer = self.get_serializer(signature)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )

    @action(detail=False, methods=['post'])
    def save_signature(self, request):
        """Save or update the current user's signature."""
        signature_data = request.data.get('signature_data')
        if not signature_data:
            return Response(
                {'error': 'signature_data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        signature, created = UserSignature.objects.update_or_create(
            user=request.user,
            defaults={'signature_data': signature_data}
        )
        serializer = self.get_serializer(signature)
        return Response(serializer.data)


# =============================================================================
# FACILITY LOCATION VIEWSET
# =============================================================================

class FacilityLocationViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing facility locations.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'facility_type', 'created_at']
    ordering = ['name']

    def get_serializer_class(self):
        if self.action == 'list':
            return FacilityLocationListSerializer
        return FacilityLocationSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FacilityLocation.objects.none()

        queryset = FacilityLocation.objects.filter(company=company)

        # Filter by active status
        active = self.request.query_params.get('active')
        if active is not None:
            queryset = queryset.filter(is_active=active.lower() == 'true')

        # Filter by facility type
        facility_type = self.request.query_params.get('facility_type')
        if facility_type:
            queryset = queryset.filter(facility_type=facility_type)

        # Filter by farm
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        return queryset.select_related('farm')

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)


# =============================================================================
# FACILITY CLEANING LOG VIEWSET
# =============================================================================

class FacilityCleaningLogViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing facility cleaning logs.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['cleaning_date', 'cleaning_time', 'created_at']
    ordering = ['-cleaning_date', '-cleaning_time']

    def get_serializer_class(self):
        if self.action == 'list':
            return FacilityCleaningLogListSerializer
        return FacilityCleaningLogSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FacilityCleaningLog.objects.none()

        queryset = FacilityCleaningLog.objects.filter(
            facility__company=company
        ).select_related('facility', 'cleaned_by', 'verified_by')

        # Filter by facility
        facility_id = self.request.query_params.get('facility')
        if facility_id:
            queryset = queryset.filter(facility_id=facility_id)

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(cleaning_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(cleaning_date__lte=end_date)

        return queryset

    def perform_create(self, serializer):
        # Auto-set cleaned_by to current user if not specified
        if not serializer.validated_data.get('cleaned_by'):
            serializer.save(cleaned_by=self.request.user)
        else:
            serializer.save()

        # Auto-set signature timestamp if signature provided
        instance = serializer.instance
        if instance.signature_data and not instance.signature_timestamp:
            instance.signature_timestamp = timezone.now()
            instance.save(update_fields=['signature_timestamp'])

    @action(detail=False, methods=['get'])
    def today_schedule(self, request):
        """Get facilities that need cleaning today."""
        company = require_company(request.user)
        today = date.today()

        # Get all active facilities
        facilities = FacilityLocation.objects.filter(
            company=company,
            is_active=True
        )

        # Check which have been cleaned today
        cleaned_today = FacilityCleaningLog.objects.filter(
            facility__company=company,
            cleaning_date=today
        ).values_list('facility_id', flat=True)

        schedule = []
        for facility in facilities:
            cleaned = facility.id in cleaned_today
            schedule.append({
                'facility_id': facility.id,
                'facility_name': facility.name,
                'facility_type': facility.facility_type,
                'facility_type_display': facility.get_facility_type_display(),
                'cleaning_frequency': facility.cleaning_frequency,
                'cleaned_today': cleaned,
                'requires_cleaning': self._requires_cleaning_today(facility),
            })

        return Response(schedule)

    def _requires_cleaning_today(self, facility):
        """Determine if facility requires cleaning today based on frequency."""
        freq = facility.cleaning_frequency
        if freq in ['daily', 'twice_daily']:
            return True
        # For other frequencies, check last cleaning date
        last_cleaning = facility.cleaning_logs.order_by('-cleaning_date').first()
        if not last_cleaning:
            return True

        today = date.today()
        days_since = (today - last_cleaning.cleaning_date).days

        if freq == 'weekly':
            return days_since >= 7
        elif freq == 'biweekly':
            return days_since >= 14
        elif freq == 'monthly':
            return days_since >= 30

        return False

    @action(detail=False, methods=['get'])
    def compliance_status(self, request):
        """Get cleaning compliance status for all facilities."""
        company = require_company(request.user)
        today = date.today()
        week_ago = today - timedelta(days=7)

        facilities = FacilityLocation.objects.filter(
            company=company,
            is_active=True
        )

        total = facilities.count()
        compliant = 0
        non_compliant = 0

        for facility in facilities:
            if self._is_cleaning_compliant(facility, today):
                compliant += 1
            else:
                non_compliant += 1

        compliance_rate = (compliant / total * 100) if total > 0 else 100

        return Response({
            'total_facilities': total,
            'compliant': compliant,
            'non_compliant': non_compliant,
            'compliance_rate': round(compliance_rate, 1),
        })

    def _is_cleaning_compliant(self, facility, reference_date):
        """Check if facility cleaning is compliant."""
        last_cleaning = facility.cleaning_logs.filter(
            cleaning_date__lte=reference_date
        ).order_by('-cleaning_date').first()

        if not last_cleaning:
            return False

        days_since = (reference_date - last_cleaning.cleaning_date).days
        freq = facility.cleaning_frequency

        if freq == 'daily':
            return days_since <= 1
        elif freq == 'twice_daily':
            return days_since <= 1
        elif freq == 'weekly':
            return days_since <= 7
        elif freq == 'biweekly':
            return days_since <= 14
        elif freq == 'monthly':
            return days_since <= 31
        elif freq == 'as_needed':
            return True
        elif freq == 'after_use':
            return True

        return True


# =============================================================================
# VISITOR LOG VIEWSET
# =============================================================================

class VisitorLogViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing visitor logs.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['visitor_name', 'visitor_company', 'purpose']
    ordering_fields = ['visit_date', 'time_in', 'visitor_name', 'created_at']
    ordering = ['-visit_date', '-time_in']

    def get_serializer_class(self):
        if self.action == 'list':
            return VisitorLogListSerializer
        return VisitorLogSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return VisitorLog.objects.none()

        queryset = VisitorLog.objects.filter(company=company)

        # Filter by farm
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        # Filter by visitor type
        visitor_type = self.request.query_params.get('visitor_type')
        if visitor_type:
            queryset = queryset.filter(visitor_type=visitor_type)

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(visit_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(visit_date__lte=end_date)

        # Filter by linked harvest
        has_harvest = self.request.query_params.get('has_harvest')
        if has_harvest is not None:
            if has_harvest.lower() == 'true':
                queryset = queryset.filter(linked_harvest__isnull=False)
            else:
                queryset = queryset.filter(linked_harvest__isnull=True)

        return queryset.select_related('farm', 'logged_by', 'linked_harvest')

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        instance = serializer.save(company=company, logged_by=self.request.user)

        # Auto-set signature timestamp
        if instance.signature_data and not instance.signature_timestamp:
            instance.signature_timestamp = timezone.now()
            instance.save(update_fields=['signature_timestamp'])

        # Auto-link to harvest if harvester type
        if instance.visitor_type == 'harvester' and not instance.linked_harvest:
            self._try_auto_link_harvest(instance)

    def _try_auto_link_harvest(self, visitor_log):
        """Try to auto-link visitor to a same-day harvest."""
        same_day_harvests = Harvest.objects.filter(
            field__farm=visitor_log.farm,
            harvest_date=visitor_log.visit_date
        )

        if same_day_harvests.count() == 1:
            visitor_log.linked_harvest = same_day_harvests.first()
            visitor_log.auto_linked = True
            visitor_log.save(update_fields=['linked_harvest', 'auto_linked'])

    @action(detail=False, methods=['post'])
    def quick_entry(self, request):
        """Quick visitor sign-in (kiosk mode)."""
        company = require_company(request.user)
        serializer = VisitorQuickEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        now = timezone.now()
        visitor_log = VisitorLog.objects.create(
            company=company,
            farm=serializer.validated_data['farm'],
            visitor_name=serializer.validated_data['visitor_name'],
            visitor_company=serializer.validated_data.get('visitor_company', ''),
            visitor_type=serializer.validated_data['visitor_type'],
            visit_date=now.date(),
            time_in=now.time(),
            purpose=serializer.validated_data.get('purpose', ''),
            signature_data=serializer.validated_data.get('signature_data', ''),
            signature_timestamp=now if serializer.validated_data.get('signature_data') else None,
            logged_by=request.user,
        )

        return Response(
            VisitorLogSerializer(visitor_log).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def sign_out(self, request, pk=None):
        """Sign out a visitor (set time_out)."""
        visitor_log = self.get_object()
        if visitor_log.time_out:
            return Response(
                {'error': 'Visitor already signed out'},
                status=status.HTTP_400_BAD_REQUEST
            )

        visitor_log.time_out = timezone.now().time()
        visitor_log.save(update_fields=['time_out'])

        return Response(VisitorLogSerializer(visitor_log).data)

    @action(detail=False, methods=['get'])
    def harvest_overlap(self, request):
        """Find harvests that overlap with a date for potential linking."""
        company = require_company(request.user)
        farm_id = request.query_params.get('farm_id')
        visit_date = request.query_params.get('date')

        if not farm_id or not visit_date:
            return Response(
                {'error': 'farm_id and date are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            visit_date = datetime.strptime(visit_date, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find harvests on or near the date
        harvests = Harvest.objects.filter(
            field__farm_id=farm_id,
            field__farm__company=company,
            harvest_date__gte=visit_date - timedelta(days=1),
            harvest_date__lte=visit_date + timedelta(days=1),
        ).select_related('field')

        harvest_data = [{
            'id': h.id,
            'harvest_date': h.harvest_date,
            'field_id': h.field_id,
            'field_name': h.field.name,
            'crop_variety': h.crop_variety,
            'total_bins': h.total_bins,
        } for h in harvests]

        return Response(harvest_data)

    @action(detail=True, methods=['post'])
    def link_harvest(self, request, pk=None):
        """Manually link visitor log to a harvest."""
        visitor_log = self.get_object()
        harvest_id = request.data.get('harvest_id')

        if not harvest_id:
            return Response(
                {'error': 'harvest_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            harvest = Harvest.objects.get(
                id=harvest_id,
                field__farm=visitor_log.farm
            )
        except Harvest.DoesNotExist:
            return Response(
                {'error': 'Harvest not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        visitor_log.linked_harvest = harvest
        visitor_log.auto_linked = False
        visitor_log.save(update_fields=['linked_harvest', 'auto_linked'])

        return Response(VisitorLogSerializer(visitor_log).data)


# =============================================================================
# SAFETY MEETING VIEWSET
# =============================================================================

class SafetyMeetingViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing company-wide safety meetings.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['meeting_date', 'meeting_type', 'created_at']
    ordering = ['-meeting_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return SafetyMeetingListSerializer
        return SafetyMeetingSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return SafetyMeeting.objects.none()

        queryset = SafetyMeeting.objects.filter(company=company)

        # Filter by meeting type
        meeting_type = self.request.query_params.get('meeting_type')
        if meeting_type:
            queryset = queryset.filter(meeting_type=meeting_type)

        # Filter by year
        year = self.request.query_params.get('year')
        if year:
            queryset = queryset.filter(year=int(year))

        # Filter by quarter
        quarter = self.request.query_params.get('quarter')
        if quarter:
            queryset = queryset.filter(quarter=int(quarter))

        return queryset.prefetch_related('attendees')

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company, conducted_by=self.request.user)

    @action(detail=True, methods=['post'])
    def add_attendee(self, request, pk=None):
        """Add an attendee to a meeting."""
        meeting = self.get_object()
        attendee_name = request.data.get('attendee_name')

        if not attendee_name:
            return Response(
                {'error': 'attendee_name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        attendee, created = SafetyMeetingAttendee.objects.get_or_create(
            meeting=meeting,
            attendee_name=attendee_name,
            defaults={
                'employee_id': request.data.get('employee_id', ''),
                'department': request.data.get('department', ''),
            }
        )

        if not created:
            return Response(
                {'error': 'Attendee already added to this meeting'},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            SafetyMeetingAttendeeSerializer(attendee).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['get'])
    def quarterly_compliance(self, request):
        """Check quarterly meeting compliance status."""
        company = require_company(request.user)
        year = int(request.query_params.get('year', date.today().year))

        meetings = SafetyMeeting.objects.filter(
            company=company,
            meeting_type='quarterly_fsma',
            year=year
        )

        quarters_covered = list(meetings.values_list('quarter', flat=True).distinct())
        current_quarter = (date.today().month - 1) // 3 + 1

        compliance = {
            'year': year,
            'quarters': {},
            'overall_compliant': True,
        }

        for q in range(1, 5):
            if q <= current_quarter:
                meeting = meetings.filter(quarter=q).first()
                if meeting:
                    attendee_count = meeting.attendees.count()
                    signed_count = meeting.attendees.exclude(signature_data='').count()
                    compliance['quarters'][q] = {
                        'meeting_id': meeting.id,
                        'meeting_date': meeting.meeting_date,
                        'attendee_count': attendee_count,
                        'signed_count': signed_count,
                        'compliant': True,
                    }
                else:
                    compliance['quarters'][q] = {
                        'meeting_id': None,
                        'meeting_date': None,
                        'attendee_count': 0,
                        'signed_count': 0,
                        'compliant': False,
                    }
                    compliance['overall_compliant'] = False
            else:
                compliance['quarters'][q] = {
                    'meeting_id': None,
                    'meeting_date': None,
                    'attendee_count': 0,
                    'signed_count': 0,
                    'compliant': None,  # Future quarter
                }

        return Response(compliance)


# =============================================================================
# SAFETY MEETING ATTENDEE VIEWSET
# =============================================================================

class SafetyMeetingAttendeeViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing meeting attendees.
    """
    serializer_class = SafetyMeetingAttendeeSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return SafetyMeetingAttendee.objects.none()

        queryset = SafetyMeetingAttendee.objects.filter(
            meeting__company=company
        )

        # Filter by meeting
        meeting_id = self.request.query_params.get('meeting')
        if meeting_id:
            queryset = queryset.filter(meeting_id=meeting_id)

        return queryset.select_related('meeting', 'user')

    @action(detail=True, methods=['post'])
    def sign_in(self, request, pk=None):
        """Record attendee signature."""
        attendee = self.get_object()
        signature_data = request.data.get('signature_data')

        if not signature_data:
            return Response(
                {'error': 'signature_data is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        attendee.signature_data = signature_data
        attendee.signed_at = timezone.now()
        attendee.save(update_fields=['signature_data', 'signed_at'])

        return Response(SafetyMeetingAttendeeSerializer(attendee).data)


# =============================================================================
# FERTILIZER INVENTORY VIEWSET
# =============================================================================

class FertilizerInventoryViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing fertilizer inventory.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product__name', 'storage_location']
    ordering_fields = ['product__name', 'quantity_on_hand', 'last_updated']
    ordering = ['product__name']

    def get_serializer_class(self):
        if self.action == 'list':
            return FertilizerInventoryListSerializer
        return FertilizerInventorySerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FertilizerInventory.objects.none()

        queryset = FertilizerInventory.objects.filter(company=company)

        # Filter by low stock
        low_stock = self.request.query_params.get('low_stock')
        if low_stock and low_stock.lower() == 'true':
            queryset = queryset.filter(
                quantity_on_hand__lte=F('reorder_point')
            )

        return queryset.select_related('product')

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        serializer.save(company=company)

    @action(detail=True, methods=['post'])
    def adjust(self, request, pk=None):
        """Make a manual inventory adjustment."""
        inventory = self.get_object()
        serializer = InventoryAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        quantity = serializer.validated_data['quantity']
        reason = serializer.validated_data['reason']

        new_balance = inventory.quantity_on_hand + Decimal(str(quantity))
        if new_balance < 0:
            return Response(
                {'error': 'Adjustment would result in negative inventory'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create transaction
        FertilizerInventoryTransaction.objects.create(
            inventory=inventory,
            transaction_type='adjustment',
            quantity=quantity,
            balance_after=new_balance,
            transaction_date=timezone.now(),
            notes=reason,
            created_by=request.user,
        )

        # Update inventory
        inventory.quantity_on_hand = new_balance
        inventory.save(update_fields=['quantity_on_hand'])

        return Response(FertilizerInventorySerializer(inventory).data)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get all items below reorder point."""
        company = require_company(request.user)

        low_stock_items = FertilizerInventory.objects.filter(
            company=company,
            reorder_point__isnull=False,
            quantity_on_hand__lte=F('reorder_point')
        ).select_related('product')

        serializer = FertilizerInventoryListSerializer(low_stock_items, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def transactions(self, request, pk=None):
        """Get transaction history for an inventory item."""
        inventory = self.get_object()

        # Get query params for pagination
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))

        transactions = inventory.transactions.all()[offset:offset + limit]
        serializer = FertilizerInventoryTransactionListSerializer(transactions, many=True)

        return Response({
            'count': inventory.transactions.count(),
            'results': serializer.data,
        })


# =============================================================================
# FERTILIZER INVENTORY TRANSACTION VIEWSET
# =============================================================================

class FertilizerInventoryTransactionViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing inventory transactions.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    http_method_names = ['get', 'post']  # No update/delete for audit trail

    def get_serializer_class(self):
        if self.action == 'list':
            return FertilizerInventoryTransactionListSerializer
        return FertilizerInventoryTransactionSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FertilizerInventoryTransaction.objects.none()

        queryset = FertilizerInventoryTransaction.objects.filter(
            inventory__company=company
        )

        # Filter by inventory
        inventory_id = self.request.query_params.get('inventory')
        if inventory_id:
            queryset = queryset.filter(inventory_id=inventory_id)

        # Filter by transaction type
        transaction_type = self.request.query_params.get('type')
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(transaction_date__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(transaction_date__date__lte=end_date)

        return queryset.select_related('inventory', 'inventory__product', 'created_by')

    @action(detail=False, methods=['post'])
    def purchase(self, request):
        """Record a fertilizer purchase."""
        company = require_company(request.user)
        serializer = InventoryPurchaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product = serializer.validated_data['product']
        quantity = serializer.validated_data['quantity']
        unit = serializer.validated_data.get('unit', 'lbs')

        # Get or create inventory record
        inventory, _ = FertilizerInventory.objects.get_or_create(
            company=company,
            product=product,
            defaults={'unit': unit}
        )

        new_balance = inventory.quantity_on_hand + quantity

        # Calculate total cost
        cost_per_unit = serializer.validated_data.get('cost_per_unit')
        total_cost = cost_per_unit * quantity if cost_per_unit else None

        # Create transaction
        transaction = FertilizerInventoryTransaction.objects.create(
            inventory=inventory,
            transaction_type='purchase',
            quantity=quantity,
            balance_after=new_balance,
            transaction_date=timezone.now(),
            supplier=serializer.validated_data.get('supplier', ''),
            invoice_number=serializer.validated_data.get('invoice_number', ''),
            cost_per_unit=cost_per_unit,
            total_cost=total_cost,
            notes=serializer.validated_data.get('notes', ''),
            created_by=request.user,
        )

        # Update inventory
        inventory.quantity_on_hand = new_balance
        if serializer.validated_data.get('lot_number'):
            inventory.lot_number = serializer.validated_data['lot_number']
        if serializer.validated_data.get('expiration_date'):
            inventory.expiration_date = serializer.validated_data['expiration_date']
        inventory.save()

        return Response(
            FertilizerInventoryTransactionSerializer(transaction).data,
            status=status.HTTP_201_CREATED
        )


# =============================================================================
# MONTHLY INVENTORY SNAPSHOT VIEWSET
# =============================================================================

class MonthlyInventorySnapshotViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for monthly inventory snapshots.
    """
    serializer_class = MonthlyInventorySnapshotSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    http_method_names = ['get', 'post']

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return MonthlyInventorySnapshot.objects.none()

        return MonthlyInventorySnapshot.objects.filter(company=company)

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate a snapshot for a specific month."""
        company = require_company(request.user)
        month = int(request.data.get('month', date.today().month))
        year = int(request.data.get('year', date.today().year))

        # Get current inventory
        inventories = FertilizerInventory.objects.filter(company=company)

        inventory_data = []
        total_value = Decimal('0')
        low_stock_count = 0

        for inv in inventories:
            item_value = None
            # Try to get latest cost
            last_purchase = inv.transactions.filter(
                transaction_type='purchase',
                cost_per_unit__isnull=False
            ).order_by('-transaction_date').first()

            if last_purchase:
                item_value = last_purchase.cost_per_unit * inv.quantity_on_hand
                total_value += item_value

            inventory_data.append({
                'product_id': inv.product_id,
                'product_name': inv.product.name,
                'quantity_on_hand': float(inv.quantity_on_hand),
                'unit': inv.unit,
                'reorder_point': float(inv.reorder_point) if inv.reorder_point else None,
                'is_low_stock': inv.is_low_stock,
                'estimated_value': float(item_value) if item_value else None,
            })

            if inv.is_low_stock:
                low_stock_count += 1

        snapshot, created = MonthlyInventorySnapshot.objects.update_or_create(
            company=company,
            month=month,
            year=year,
            defaults={
                'inventory_data': inventory_data,
                'total_products': len(inventory_data),
                'total_value': total_value,
                'low_stock_count': low_stock_count,
            }
        )

        return Response(
            MonthlyInventorySnapshotSerializer(snapshot).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


# =============================================================================
# PHI COMPLIANCE CHECK VIEWSET
# =============================================================================

class PHIComplianceCheckViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for PHI compliance checks.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    http_method_names = ['get', 'post']

    def get_serializer_class(self):
        if self.action == 'list':
            return PHIComplianceCheckListSerializer
        return PHIComplianceCheckSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return PHIComplianceCheck.objects.none()

        queryset = PHIComplianceCheck.objects.filter(
            harvest__field__farm__company=company
        )

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(harvest__harvest_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(harvest__harvest_date__lte=end_date)

        return queryset.select_related('harvest', 'harvest__field', 'override_by')

    @action(detail=False, methods=['post'])
    def pre_check(self, request):
        """Run a pre-harvest PHI check without saving."""
        company = require_company(request.user)
        serializer = PHIPreCheckSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        field_id = serializer.validated_data['field_id']
        proposed_date = serializer.validated_data['proposed_harvest_date']

        # Verify field belongs to company
        try:
            field = Field.objects.get(id=field_id, farm__company=company)
        except Field.DoesNotExist:
            return Response(
                {'error': 'Field not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check recent applications
        result = self._check_phi_compliance(field, proposed_date)

        return Response(result)

    def _check_phi_compliance(self, field, harvest_date):
        """Check PHI compliance for a field and harvest date."""
        # Look back 365 days for applications
        lookback_date = harvest_date - timedelta(days=365)

        applications = PesticideApplication.objects.filter(
            field=field,
            application_date__gte=lookback_date,
            application_date__lte=harvest_date
        ).select_related('product')

        applications_checked = []
        warnings = []
        status_val = 'compliant'
        earliest_safe = None

        for app in applications:
            phi_days = app.product.phi_days if app.product.phi_days else 0
            days_since_app = (harvest_date - app.application_date).days
            safe_date = app.application_date + timedelta(days=phi_days)

            app_check = {
                'application_id': app.id,
                'product_name': app.product.name,
                'application_date': str(app.application_date),
                'phi_days': phi_days,
                'days_since_application': days_since_app,
                'earliest_safe_harvest': str(safe_date),
                'compliant': days_since_app >= phi_days,
            }
            applications_checked.append(app_check)

            if days_since_app < phi_days:
                if phi_days - days_since_app <= 3:
                    warnings.append(
                        f"WARNING: {app.product.name} applied on {app.application_date} - "
                        f"only {days_since_app} days ago (PHI is {phi_days} days). "
                        f"Safe to harvest after {safe_date}."
                    )
                    if status_val == 'compliant':
                        status_val = 'warning'
                else:
                    warnings.append(
                        f"NON-COMPLIANT: {app.product.name} applied on {app.application_date} - "
                        f"only {days_since_app} days ago (PHI is {phi_days} days). "
                        f"Cannot harvest until {safe_date}."
                    )
                    status_val = 'non_compliant'

                if earliest_safe is None or safe_date > earliest_safe:
                    earliest_safe = safe_date

        return {
            'status': status_val,
            'applications_checked': applications_checked,
            'warnings': warnings,
            'earliest_safe_harvest': str(earliest_safe) if earliest_safe else None,
        }

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Re-verify PHI compliance for an existing check."""
        phi_check = self.get_object()
        harvest = phi_check.harvest

        result = self._check_phi_compliance(harvest.field, harvest.harvest_date)

        phi_check.status = result['status']
        phi_check.applications_checked = result['applications_checked']
        phi_check.warnings = result['warnings']
        if result['earliest_safe_harvest']:
            phi_check.earliest_safe_harvest = datetime.strptime(
                result['earliest_safe_harvest'], '%Y-%m-%d'
            ).date()
        phi_check.save()

        return Response(PHIComplianceCheckSerializer(phi_check).data)

    @action(detail=True, methods=['post'])
    def override(self, request, pk=None):
        """Override a non-compliant or warning status."""
        phi_check = self.get_object()
        reason = request.data.get('reason')

        if not reason:
            return Response(
                {'error': 'Override reason is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        phi_check.status = 'override'
        phi_check.override_reason = reason
        phi_check.override_by = request.user
        phi_check.override_at = timezone.now()
        phi_check.save()

        return Response(PHIComplianceCheckSerializer(phi_check).data)


# =============================================================================
# AUDIT BINDER VIEWSET
# =============================================================================

class AuditBinderViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for managing audit binders.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_serializer_class(self):
        if self.action == 'list':
            return AuditBinderListSerializer
        return AuditBinderSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return AuditBinder.objects.none()

        return AuditBinder.objects.filter(company=company)

    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Start generating a new audit binder."""
        company = require_company(request.user)
        serializer = AuditBinderGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        binder = AuditBinder.objects.create(
            company=company,
            date_range_start=serializer.validated_data['date_range_start'],
            date_range_end=serializer.validated_data['date_range_end'],
            include_visitor_logs=serializer.validated_data['include_visitor_logs'],
            include_cleaning_logs=serializer.validated_data['include_cleaning_logs'],
            include_safety_meetings=serializer.validated_data['include_safety_meetings'],
            include_fertilizer_inventory=serializer.validated_data['include_fertilizer_inventory'],
            include_phi_reports=serializer.validated_data['include_phi_reports'],
            include_harvest_records=serializer.validated_data['include_harvest_records'],
            farm_ids=serializer.validated_data.get('farm_ids', []),
            notes=serializer.validated_data.get('notes', ''),
            generated_by=request.user,
            status='pending',
        )

        # Queue the generation task (will be handled by Celery in Phase 5)
        # For now, just return the pending binder
        # from .tasks.fsma_tasks import generate_audit_binder
        # generate_audit_binder.delay(binder.id)

        return Response(
            AuditBinderSerializer(binder, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['get'])
    def status(self, request, pk=None):
        """Get the current generation status."""
        binder = self.get_object()
        return Response({
            'id': binder.id,
            'status': binder.status,
            'status_display': binder.get_status_display(),
            'error_message': binder.error_message,
            'generation_started': binder.generation_started,
            'generation_completed': binder.generation_completed,
        })

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download the generated PDF."""
        binder = self.get_object()

        if binder.status != 'completed':
            return Response(
                {'error': 'Binder generation not completed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not binder.pdf_file:
            return Response(
                {'error': 'PDF file not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        return FileResponse(
            binder.pdf_file.open('rb'),
            as_attachment=True,
            filename=f'audit_binder_{binder.date_range_start}_{binder.date_range_end}.pdf'
        )


# =============================================================================
# FSMA DASHBOARD VIEWSET
# =============================================================================

class FSMADashboardViewSet(viewsets.ViewSet):
    """
    API endpoint for the FSMA compliance dashboard overview.
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def list(self, request):
        """Get comprehensive FSMA compliance dashboard data."""
        company = require_company(request.user)
        today = date.today()

        # Facility cleaning status
        total_facilities = FacilityLocation.objects.filter(
            company=company, is_active=True
        ).count()
        facilities_cleaned_today = FacilityCleaningLog.objects.filter(
            facility__company=company,
            cleaning_date=today
        ).values('facility').distinct().count()

        # Visitor logs today
        visitors_today = VisitorLog.objects.filter(
            company=company,
            visit_date=today
        ).count()

        # PHI issues
        phi_issues = PHIComplianceCheck.objects.filter(
            harvest__field__farm__company=company,
            status__in=['warning', 'non_compliant']
        ).count()

        # Low inventory count
        low_inventory = FertilizerInventory.objects.filter(
            company=company,
            reorder_point__isnull=False,
            quantity_on_hand__lte=F('reorder_point')
        ).count()

        # Quarterly meeting status
        current_quarter = (today.month - 1) // 3 + 1
        quarterly_meeting = SafetyMeeting.objects.filter(
            company=company,
            meeting_type='quarterly_fsma',
            year=today.year,
            quarter=current_quarter
        ).first()

        # Calculate cleaning compliance rate (last 7 days)
        week_ago = today - timedelta(days=7)
        cleaning_compliance_rate = self._calculate_cleaning_compliance(company, week_ago, today)

        # Calculate visitor log compliance (assuming all visitors should sign)
        visitor_compliance = self._calculate_visitor_compliance(company, week_ago, today)

        # Recent activity
        recent_activity = self._get_recent_activity(company, limit=10)

        # Calculate overall compliance score
        score, status_val = self._calculate_compliance_score(
            company, facilities_cleaned_today, total_facilities,
            quarterly_meeting, phi_issues, low_inventory
        )

        data = {
            'overall_compliance_score': score,
            'overall_status': status_val,
            'facilities_cleaned_today': facilities_cleaned_today,
            'facilities_requiring_cleaning': total_facilities,
            'visitors_logged_today': visitors_today,
            'phi_issues_pending': phi_issues,
            'quarterly_meeting_status': {
                'quarter': current_quarter,
                'year': today.year,
                'completed': quarterly_meeting is not None,
                'meeting_id': quarterly_meeting.id if quarterly_meeting else None,
                'meeting_date': quarterly_meeting.meeting_date if quarterly_meeting else None,
            },
            'cleaning_compliance_rate': cleaning_compliance_rate,
            'visitor_log_compliance_rate': visitor_compliance,
            'low_inventory_count': low_inventory,
            'upcoming_expirations': self._get_upcoming_expirations(company),
            'recent_activity': recent_activity,
        }

        return Response(data)

    def _calculate_cleaning_compliance(self, company, start_date, end_date):
        """Calculate cleaning compliance rate for a date range."""
        facilities = FacilityLocation.objects.filter(
            company=company, is_active=True,
            cleaning_frequency__in=['daily', 'twice_daily']
        )

        if not facilities.exists():
            return 100.0

        total_required = 0
        total_completed = 0

        for facility in facilities:
            days = (end_date - start_date).days + 1
            total_required += days

            cleanings = FacilityCleaningLog.objects.filter(
                facility=facility,
                cleaning_date__gte=start_date,
                cleaning_date__lte=end_date
            ).values('cleaning_date').distinct().count()

            total_completed += cleanings

        if total_required == 0:
            return 100.0

        return round((total_completed / total_required) * 100, 1)

    def _calculate_visitor_compliance(self, company, start_date, end_date):
        """Calculate visitor log signature compliance rate."""
        visitors = VisitorLog.objects.filter(
            company=company,
            visit_date__gte=start_date,
            visit_date__lte=end_date
        )

        total = visitors.count()
        if total == 0:
            return 100.0

        signed = visitors.exclude(signature_data='').count()
        return round((signed / total) * 100, 1)

    def _get_recent_activity(self, company, limit=10):
        """Get recent FSMA-related activity."""
        activity = []

        # Recent cleaning logs
        for log in FacilityCleaningLog.objects.filter(
            facility__company=company
        ).order_by('-created_at')[:5]:
            activity.append({
                'type': 'cleaning',
                'description': f"Cleaned {log.facility.name}",
                'timestamp': log.created_at,
            })

        # Recent visitor logs
        for log in VisitorLog.objects.filter(
            company=company
        ).order_by('-created_at')[:5]:
            activity.append({
                'type': 'visitor',
                'description': f"{log.visitor_name} visited {log.farm.name}",
                'timestamp': log.created_at,
            })

        # Sort by timestamp and limit
        activity.sort(key=lambda x: x['timestamp'], reverse=True)
        return activity[:limit]

    def _get_upcoming_expirations(self, company):
        """Get upcoming inventory expirations."""
        thirty_days = date.today() + timedelta(days=30)

        expiring = FertilizerInventory.objects.filter(
            company=company,
            expiration_date__lte=thirty_days,
            expiration_date__gte=date.today()
        ).select_related('product')

        return [{
            'product_name': inv.product.name,
            'expiration_date': inv.expiration_date,
            'quantity_on_hand': float(inv.quantity_on_hand),
        } for inv in expiring]

    def _calculate_compliance_score(
        self, company, cleaned_today, total_facilities,
        quarterly_meeting, phi_issues, low_inventory
    ):
        """Calculate overall FSMA compliance score."""
        score = 100
        status_val = 'good'

        # Deduct for uncleaned facilities today
        if total_facilities > 0:
            cleaning_pct = cleaned_today / total_facilities
            if cleaning_pct < 0.5:
                score -= 20
            elif cleaning_pct < 1.0:
                score -= 10

        # Deduct for missing quarterly meeting
        current_quarter = (date.today().month - 1) // 3 + 1
        if not quarterly_meeting:
            # Only deduct if we're past the first month of the quarter
            days_into_quarter = (date.today() - date(
                date.today().year,
                (current_quarter - 1) * 3 + 1,
                1
            )).days
            if days_into_quarter > 30:
                score -= 15

        # Deduct for PHI issues
        if phi_issues > 0:
            score -= min(phi_issues * 10, 30)

        # Minor deduction for low inventory
        if low_inventory > 0:
            score -= min(low_inventory * 2, 10)

        # Determine status
        if score >= 90:
            status_val = 'excellent'
        elif score >= 75:
            status_val = 'good'
        elif score >= 50:
            status_val = 'warning'
        else:
            status_val = 'critical'

        return max(0, score), status_val
