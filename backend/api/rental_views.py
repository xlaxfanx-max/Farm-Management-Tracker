"""Views for the rental module.

RentalUnit and Lease carry no company column of their own — they reach it
through their parent property. That means ``CompanyFilteredViewSet`` can filter
them with a traversing ``company_field``, but cannot create them, because it
would try to ``save(rental_property__company=...)``. Both therefore override
``perform_create`` and validate the parent explicitly.

That validation is load-bearing, not defensive noise: without it a POST naming
another tenant's property id would be accepted on a queryset that only filters
reads. RLS catches this in production, but RLS is Postgres-only and the API
should not depend on the database to enforce its own tenancy.
"""

from decimal import Decimal

from django.db.models import Count, F, Sum
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Farm,
    Lease,
    RentalCategory,
    RentalLedgerEntry,
    RentalProperty,
    RentalUnit,
)
from .permissions import HasCompanyAccess, HasPermission, IsAuthenticated
from .rental_serializers import (
    LeaseSerializer,
    PortfolioRentRollSerializer,
    RanchRentalSummarySerializer,
    RentalCategorySerializer,
    RentalLedgerEntrySerializer,
    RentalPropertySerializer,
    RentalUnitSerializer,
)
from .view_helpers import CompanyFilteredViewSet, get_user_company, require_company

ZERO = Decimal('0')


def _as_bool(value):
    return str(value).lower() in ('1', 'true', 'yes')


class _RentalCrudViewSet(CompanyFilteredViewSet):
    """Company-scoped CRUD: read with view_rentals, write with manage_rentals.

    Field roles get neither. Rent figures and occupant labels have no bearing
    on farm work, and the fewer places they appear the better.
    """

    permission_classes = [IsAuthenticated, HasCompanyAccess, HasPermission]
    permission_map = {
        'list': 'view_rentals',
        'retrieve': 'view_rentals',
        'create': 'manage_rentals',
        'update': 'manage_rentals',
        'partial_update': 'manage_rentals',
        'destroy': 'manage_rentals',
    }


class RentalPropertyViewSet(_RentalCrudViewSet):
    model = RentalProperty
    serializer_class = RentalPropertySerializer
    select_related_fields = ('farm', 'owning_entity', 'parcel')
    default_ordering = ('farm__name', 'name')

    def filter_queryset_by_params(self, queryset):
        params = self.request.query_params

        farm_id = params.get('farm')
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        location_type = params.get('location_type')
        if location_type:
            queryset = queryset.filter(location_type=location_type)

        property_type = params.get('property_type')
        if property_type:
            queryset = queryset.filter(property_type=property_type)

        entity_id = params.get('owning_entity')
        if entity_id:
            queryset = queryset.filter(owning_entity_id=entity_id)

        if 'is_active' in params:
            queryset = queryset.filter(is_active=_as_bool(params.get('is_active')))

        return queryset.annotate(unit_count_annotated=Count('units', distinct=True))


class RentalCategoryViewSet(_RentalCrudViewSet):
    model = RentalCategory
    serializer_class = RentalCategorySerializer
    default_ordering = ('kind', 'name')

    def filter_queryset_by_params(self, queryset):
        kind = self.request.query_params.get('kind')
        if kind:
            queryset = queryset.filter(kind=kind)
        return queryset


class RentalUnitViewSet(_RentalCrudViewSet):
    model = RentalUnit
    serializer_class = RentalUnitSerializer
    company_field = 'rental_property__company'
    select_related_fields = ('rental_property', 'rental_property__farm')
    default_ordering = ('rental_property__name', 'unit_label')

    def filter_queryset_by_params(self, queryset):
        params = self.request.query_params

        property_id = params.get('rental_property')
        if property_id:
            queryset = queryset.filter(rental_property_id=property_id)

        farm_id = params.get('farm')
        if farm_id:
            queryset = queryset.filter(rental_property__farm_id=farm_id)

        location_type = params.get('location_type')
        if location_type:
            queryset = queryset.filter(rental_property__location_type=location_type)

        if 'is_rent_controlled' in params:
            queryset = queryset.filter(
                is_rent_controlled=_as_bool(params.get('is_rent_controlled'))
            )

        return queryset.prefetch_related('leases')

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        prop = serializer.validated_data.get('rental_property')
        if prop is None or prop.company_id != company.id:
            raise serializers.ValidationError(
                {'rental_property': 'Unknown rental property.'}
            )
        return serializer.save()


class LeaseViewSet(_RentalCrudViewSet):
    model = Lease
    serializer_class = LeaseSerializer
    company_field = 'unit__rental_property__company'
    select_related_fields = ('unit', 'unit__rental_property')
    default_ordering = ('unit__rental_property__name', 'unit__unit_label')

    def filter_queryset_by_params(self, queryset):
        params = self.request.query_params

        unit_id = params.get('unit')
        if unit_id:
            queryset = queryset.filter(unit_id=unit_id)

        property_id = params.get('rental_property')
        if property_id:
            queryset = queryset.filter(unit__rental_property_id=property_id)

        if 'is_active' in params:
            queryset = queryset.filter(is_active=_as_bool(params.get('is_active')))

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        unit = serializer.validated_data.get('unit')
        if unit is None or unit.rental_property.company_id != company.id:
            raise serializers.ValidationError({'unit': 'Unknown rental unit.'})
        return serializer.save()


class RentalLedgerEntryViewSet(_RentalCrudViewSet):
    model = RentalLedgerEntry
    serializer_class = RentalLedgerEntrySerializer
    select_related_fields = ('rental_property', 'unit', 'category')
    default_ordering = ('-period_year', '-period_month')

    def filter_queryset_by_params(self, queryset):
        params = self.request.query_params

        property_id = params.get('rental_property')
        if property_id:
            queryset = queryset.filter(rental_property_id=property_id)

        farm_id = params.get('farm')
        if farm_id:
            queryset = queryset.filter(rental_property__farm_id=farm_id)

        year = params.get('year')
        if year:
            queryset = queryset.filter(period_year=year)

        month = params.get('month')
        if month:
            queryset = queryset.filter(period_month=month)

        grain = params.get('grain')
        if grain == 'annual':
            queryset = queryset.filter(period_month__isnull=True)
        elif grain == 'monthly':
            queryset = queryset.filter(period_month__isnull=False)

        if 'is_flagged' in params:
            queryset = queryset.filter(
                is_flagged=_as_bool(params.get('is_flagged'))
            )

        if 'delinquent' in params and _as_bool(params.get('delinquent')):
            queryset = queryset.filter(amount_charged__gt=F('amount_paid'))

        return queryset

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        prop = serializer.validated_data.get('rental_property')
        category = serializer.validated_data.get('category')
        if prop is None or prop.company_id != company.id:
            raise serializers.ValidationError(
                {'rental_property': 'Unknown rental property.'}
            )
        if category is None or category.company_id != company.id:
            raise serializers.ValidationError({'category': 'Unknown category.'})
        return serializer.save(company=company)


class RanchRentalSummaryView(APIView):
    """GET /api/farms/<farm_id>/rental-summary/?year=YYYY

    Returns rental income for one ranch and one year, carrying no acreage
    field. See RanchRentalSummarySerializer — the omission is the point.
    """

    permission_classes = [IsAuthenticated, HasCompanyAccess, HasPermission]
    required_permission = 'view_rentals'

    def get(self, request, farm_id):
        company = get_user_company(request.user)
        if not company:
            return Response(
                {'detail': 'No company selected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            farm = Farm.objects.get(pk=farm_id, company=company)
        except Farm.DoesNotExist:
            return Response(
                {'detail': 'Ranch not found.'}, status=status.HTTP_404_NOT_FOUND
            )

        year = request.query_params.get('year')

        # Scoped by location_type, not by the farm FK alone. FIFA's rule is a
        # location rule, not an entity rule: only on-ranch property belongs in
        # a ranch panel. An off-ranch property that happens to carry a farm
        # reference must not leak into the ranch figure, or it is double-counted
        # against the portfolio roll-up that also claims it.
        properties = RentalProperty.objects.filter(
            company=company, farm=farm, location_type='on_ranch'
        )

        entries = RentalLedgerEntry.objects.filter(
            company=company,
            rental_property__farm=farm,
            rental_property__location_type='on_ranch',
        )
        if year:
            entries = entries.filter(period_year=year)

        income = entries.filter(category__kind='income')
        expense = entries.filter(category__kind='expense')

        income_total = income.aggregate(t=Sum('amount_charged'))['t'] or ZERO
        expense_total = expense.aggregate(t=Sum('amount_charged'))['t'] or ZERO

        # Collection figures are income-only. An unpaid expense row is an
        # account payable, not a delinquent tenant, and blending the two would
        # make the delinquency number mean nothing.
        collection = income.aggregate(
            charged=Sum('amount_charged'), paid=Sum('amount_paid')
        )
        charged = collection['charged'] or ZERO
        paid = collection['paid'] or ZERO

        has_annual = entries.filter(period_month__isnull=True).exists()
        has_monthly = entries.filter(period_month__isnull=False).exists()
        if has_annual and has_monthly:
            grain = 'mixed'
        elif has_monthly:
            grain = 'monthly'
        else:
            grain = 'annual'

        payload = {
            'farm_id': farm.id,
            'farm_name': farm.name,
            'year': int(year) if year else None,
            'property_count': properties.count(),
            'unit_count': RentalUnit.objects.filter(
                rental_property__in=properties
            ).count(),
            'income_total': income_total,
            'expense_total': expense_total,
            'net_total': income_total - expense_total,
            'amount_charged': charged,
            'amount_paid': paid,
            'amount_outstanding': charged - paid,
            'grain': grain,
            'flagged_entry_count': entries.filter(is_flagged=True).count(),
        }
        return Response(RanchRentalSummarySerializer(payload).data)


class PortfolioRentRollView(APIView):
    """GET /api/rentals/rent-roll/?location_type=off_ranch

    Gross potential rent counted from units and their active leases — never
    from occupant rows. Unit count and occupied count are reported separately
    so the two can be compared rather than conflated.
    """

    permission_classes = [IsAuthenticated, HasCompanyAccess, HasPermission]
    required_permission = 'view_rentals'

    def get(self, request):
        company = get_user_company(request.user)
        if not company:
            return Response(
                {'detail': 'No company selected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        units = RentalUnit.objects.filter(rental_property__company=company)

        location_type = request.query_params.get('location_type')
        if location_type:
            units = units.filter(rental_property__location_type=location_type)

        farm_id = request.query_params.get('farm')
        if farm_id:
            units = units.filter(rental_property__farm_id=farm_id)

        active_leases = Lease.objects.filter(unit__in=units, is_active=True)

        monthly_gpr = active_leases.aggregate(t=Sum('monthly_rent'))['t'] or ZERO

        payload = {
            'unit_count': units.count(),
            'occupied_count': active_leases.exclude(occupant_label='').count(),
            'rent_controlled_count': units.filter(is_rent_controlled=True).count(),
            'monthly_gross_potential_rent': monthly_gpr,
            'annual_gross_potential_rent': monthly_gpr * 12,
        }
        return Response(PortfolioRentRollSerializer(payload).data)
