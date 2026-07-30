"""Serializers for the rental module.

Two rules here are not stylistic and should not be "tidied up" later:

* ``RanchRentalSummarySerializer`` has no acreage field, and must not acquire
  one. It is the query-level half of the farming boundary — if the payload
  never carries acres, a per-acre rental figure cannot be computed on the
  client no matter what a future screen tries to render.

* Derived money (``amount_outstanding``, ``annual_rent``, ``gross_potential_rent``)
  is read-only and computed from stored columns. Nothing writes a delinquency
  figure directly; it is always charged minus paid, so the two can never
  disagree.
"""

from rest_framework import serializers

from .models import (
    Lease,
    RentalCategory,
    RentalLedgerEntry,
    RentalProperty,
    RentalUnit,
)


class RentalCategorySerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)

    class Meta:
        model = RentalCategory
        fields = [
            'id', 'name', 'kind', 'kind_display', 'qb_account_name',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class RentalPropertySerializer(serializers.ModelSerializer):
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    entity_name = serializers.CharField(source='owning_entity.name', read_only=True)
    entity_code = serializers.CharField(source='owning_entity.short_code', read_only=True)
    parcel_apn = serializers.CharField(source='parcel.apn', read_only=True)

    location_type_display = serializers.CharField(
        source='get_location_type_display', read_only=True
    )
    property_type_display = serializers.CharField(
        source='get_property_type_display', read_only=True
    )
    pnl_treatment_display = serializers.CharField(
        source='get_pnl_treatment_display', read_only=True
    )

    unit_count = serializers.SerializerMethodField()

    class Meta:
        model = RentalProperty
        fields = [
            'id', 'name',
            'farm', 'farm_name', 'parcel', 'parcel_apn',
            'owning_entity', 'entity_name', 'entity_code',
            'location_type', 'location_type_display',
            'property_type', 'property_type_display',
            'pnl_treatment', 'pnl_treatment_display',
            'qb_class_path',
            'address', 'city', 'state', 'zip_code',
            'is_active', 'acquired_on', 'disposed_on',
            'unit_count', 'note', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_unit_count(self, obj):
        annotated = getattr(obj, 'unit_count_annotated', None)
        if annotated is not None:
            return annotated
        return obj.units.count()

    def validate(self, attrs):
        """Surface the on-ranch rule as a 400 rather than a database error.

        The CheckConstraint is the real guarantee — this only makes the failure
        legible. Both are needed: the constraint also covers importers and the
        shell, which never pass through a serializer.
        """
        location_type = attrs.get(
            'location_type',
            getattr(self.instance, 'location_type', None),
        )
        farm = attrs.get('farm', getattr(self.instance, 'farm', None))

        if location_type == 'on_ranch' and farm is None:
            raise serializers.ValidationError({
                'farm': (
                    'An on-ranch property must name the ranch it stands on. '
                    'If this is a standalone investment property, set '
                    'location_type to off_ranch instead.'
                )
            })
        return attrs


class LeaseSerializer(serializers.ModelSerializer):
    unit_label = serializers.CharField(source='unit.unit_label', read_only=True)
    property_id = serializers.IntegerField(
        source='unit.rental_property_id', read_only=True
    )
    property_name = serializers.CharField(
        source='unit.rental_property.name', read_only=True
    )
    annual_rent = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )

    class Meta:
        model = Lease
        fields = [
            'id', 'unit', 'unit_label', 'property_id', 'property_name',
            'occupant_label', 'monthly_rent', 'annual_rent', 'deposit',
            'start_date', 'end_date', 'is_active', 'note',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'annual_rent', 'created_at', 'updated_at']


class RentalUnitSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(
        source='rental_property.name', read_only=True
    )
    farm_name = serializers.CharField(
        source='rental_property.farm.name', read_only=True
    )
    current_rent = serializers.SerializerMethodField()
    occupant_label = serializers.SerializerMethodField()

    class Meta:
        model = RentalUnit
        fields = [
            'id', 'rental_property', 'property_name', 'farm_name',
            'unit_label', 'bedrooms', 'bathrooms', 'square_feet',
            'is_rent_controlled', 'is_available',
            'current_rent', 'occupant_label',
            'note', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_current_rent(self, obj):
        lease = obj.current_lease
        return str(lease.monthly_rent) if lease else None

    def get_occupant_label(self, obj):
        lease = obj.current_lease
        return lease.occupant_label if lease else ''


class RentalLedgerEntrySerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(
        source='rental_property.name', read_only=True
    )
    # Carried on the row so a roll-up can group on-ranch against off-ranch
    # without a second request. The two are reported separately, never summed:
    # on-ranch is annual P&L grain, off-ranch is monthly statement grain.
    property_location_type = serializers.CharField(
        source='rental_property.location_type', read_only=True
    )
    farm_name = serializers.CharField(
        source='rental_property.farm.name', read_only=True
    )
    unit_label = serializers.CharField(source='unit.unit_label', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_kind = serializers.CharField(source='category.kind', read_only=True)

    grain = serializers.CharField(read_only=True)
    amount_outstanding = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True
    )
    is_delinquent = serializers.BooleanField(read_only=True)

    class Meta:
        model = RentalLedgerEntry
        fields = [
            'id', 'rental_property', 'property_name',
            'property_location_type', 'farm_name',
            'unit', 'unit_label',
            'category', 'category_name', 'category_kind',
            'period_year', 'period_month', 'grain',
            'amount_charged', 'amount_paid', 'amount_outstanding',
            'is_delinquent',
            'source', 'is_flagged', 'flag_reason', 'note',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'grain', 'amount_outstanding', 'is_delinquent',
            'created_at', 'updated_at',
        ]

    def validate_period_month(self, value):
        if value is not None and not 1 <= value <= 12:
            raise serializers.ValidationError('period_month must be between 1 and 12.')
        return value


class RanchRentalSummarySerializer(serializers.Serializer):
    """Rental income for one ranch, for one year.

    Deliberately carries NO acreage field. This is the query-level half of the
    farming boundary described in models/rental.py — dividing rental income by
    ranch acres is arithmetically valid and completely meaningless, so the
    numbers required to do it never travel together.

    Do not add acres, bearing_acres, or any per-acre figure to this serializer.
    """

    farm_id = serializers.IntegerField()
    farm_name = serializers.CharField()
    year = serializers.IntegerField()

    property_count = serializers.IntegerField()
    unit_count = serializers.IntegerField()

    income_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    expense_total = serializers.DecimalField(max_digits=14, decimal_places=2)
    net_total = serializers.DecimalField(max_digits=14, decimal_places=2)

    amount_charged = serializers.DecimalField(max_digits=14, decimal_places=2)
    amount_paid = serializers.DecimalField(max_digits=14, decimal_places=2)
    amount_outstanding = serializers.DecimalField(max_digits=14, decimal_places=2)

    grain = serializers.CharField(
        help_text="'annual', 'monthly', or 'mixed' — never blend the two on screen"
    )
    flagged_entry_count = serializers.IntegerField(
        help_text="Rows the import could not fully trust. Badge them."
    )


class PortfolioRentRollSerializer(serializers.Serializer):
    """Gross potential rent, counted from units and never from occupants.

    The May 2026 rent roll workbook prints $60,563 by summing 31 tenant rows
    against 19 units. This payload reports both counts side by side precisely
    so that discrepancy is visible rather than reproduced.
    """

    unit_count = serializers.IntegerField()
    occupied_count = serializers.IntegerField()
    rent_controlled_count = serializers.IntegerField()

    monthly_gross_potential_rent = serializers.DecimalField(
        max_digits=14, decimal_places=2
    )
    annual_gross_potential_rent = serializers.DecimalField(
        max_digits=14, decimal_places=2
    )
