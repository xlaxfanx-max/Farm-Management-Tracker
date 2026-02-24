"""
Serializers for PUR models: Product, Applicator, ApplicationEvent, TankMixItem.
"""
from rest_framework import serializers
from .models import Product, Applicator, ApplicationEvent, TankMixItem
from .serializer_mixins import DynamicFieldsMixin


# =============================================================================
# PRODUCT
# =============================================================================

class ProductSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = [
        'id', 'product_name', 'product_type', 'manufacturer',
        'epa_registration_number', 'active_ingredient',
        'is_active',
    ]

    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


# Backward-compatible alias
ProductListSerializer = ProductSerializer


# =============================================================================
# APPLICATOR
# =============================================================================

class ApplicatorSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    list_fields = ['id', 'name', 'applicator_type', 'applicator_id', 'is_active']

    class Meta:
        model = Applicator
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


# Backward-compatible alias
ApplicatorListSerializer = ApplicatorSerializer


# =============================================================================
# TANK MIX ITEM
# =============================================================================

class TankMixItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    epa_registration_number = serializers.CharField(
        source='product.epa_registration_number', read_only=True
    )
    active_ingredient = serializers.CharField(
        source='product.active_ingredient', read_only=True
    )
    product_type = serializers.CharField(
        source='product.product_type', read_only=True
    )

    class Meta:
        model = TankMixItem
        fields = [
            'id', 'product', 'product_name', 'epa_registration_number',
            'active_ingredient', 'product_type',
            'total_amount', 'amount_unit', 'rate', 'rate_unit',
            'dilution_gallons', 'sort_order',
        ]


class TankMixItemWriteSerializer(serializers.ModelSerializer):
    """Write serializer — no nested read-only fields."""
    class Meta:
        model = TankMixItem
        fields = [
            'product', 'total_amount', 'amount_unit',
            'rate', 'rate_unit', 'dilution_gallons', 'sort_order',
        ]


# =============================================================================
# APPLICATION EVENT
# =============================================================================

class ApplicationEventSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """
    Unified serializer for ApplicationEvent.

    List action returns summary fields (via list_fields).
    Detail action returns all fields with nested tank_mix_items.
    """
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True, default='')
    applicator_name = serializers.CharField(source='applicator.name', read_only=True, default='')
    tank_mix_items = TankMixItemSerializer(many=True, read_only=True)
    product_count = serializers.SerializerMethodField()
    pur_status_display = serializers.CharField(source='get_pur_status_display', read_only=True)
    method_display = serializers.CharField(source='get_application_method_display', read_only=True)

    list_fields = [
        'id', 'pur_number', 'pur_status', 'pur_status_display',
        'date_started', 'date_completed',
        'farm', 'farm_name', 'field', 'field_name',
        'applicator', 'applicator_name',
        'treated_area_acres', 'commodity_name',
        'application_method', 'method_display',
        'product_count', 'rei_hours', 'phi_days',
        'imported_from', 'created_at',
    ]

    class Meta:
        model = ApplicationEvent
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_product_count(self, obj):
        return obj.tank_mix_items.count()


# Backward-compatible aliases
ApplicationEventListSerializer = ApplicationEventSerializer
ApplicationEventDetailSerializer = ApplicationEventSerializer


class ApplicationEventCreateSerializer(serializers.ModelSerializer):
    """Write serializer that accepts nested tank mix items."""
    tank_mix_items = TankMixItemWriteSerializer(many=True)

    class Meta:
        model = ApplicationEvent
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        items_data = validated_data.pop('tank_mix_items', [])
        event = ApplicationEvent.objects.create(**validated_data)
        for idx, item_data in enumerate(items_data):
            item_data.setdefault('sort_order', idx)
            TankMixItem.objects.create(application_event=event, **item_data)
        event.update_compliance_from_items()
        return event

    def update(self, instance, validated_data):
        items_data = validated_data.pop('tank_mix_items', None)

        # Update event fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Replace tank mix items if provided
        if items_data is not None:
            instance.tank_mix_items.all().delete()
            for idx, item_data in enumerate(items_data):
                item_data.setdefault('sort_order', idx)
                TankMixItem.objects.create(application_event=instance, **item_data)
            instance.update_compliance_from_items()

        return instance
