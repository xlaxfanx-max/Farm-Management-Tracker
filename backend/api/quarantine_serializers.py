from rest_framework import serializers
from .models import QuarantineStatus
from .serializer_mixins import DynamicFieldsMixin


class QuarantineStatusSerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """
    Full serializer for QuarantineStatus model.
    Used for quarantine check results.
    """
    # Read-only computed fields
    target_name = serializers.ReadOnlyField()
    target_type = serializers.ReadOnlyField()
    status_display = serializers.ReadOnlyField()
    is_stale = serializers.ReadOnlyField()
    quarantine_type_display = serializers.CharField(
        source='get_quarantine_type_display',
        read_only=True
    )

    # Related names
    farm_name = serializers.CharField(source='farm.name', read_only=True, allow_null=True)
    field_name = serializers.CharField(source='field.name', read_only=True, allow_null=True)

    list_fields = [
        'id',
        'farm', 'field',
        'target_name', 'target_type',
        'quarantine_type', 'quarantine_type_display',
        'in_quarantine', 'zone_name',
        'status_display', 'last_checked',
        'error_message',
    ]

    class Meta:
        model = QuarantineStatus
        fields = [
            'id',
            'farm', 'farm_name',
            'field', 'field_name',
            'quarantine_type', 'quarantine_type_display',
            'in_quarantine', 'zone_name',
            'last_checked', 'last_changed',
            'check_latitude', 'check_longitude',
            'error_message',
            'target_name', 'target_type', 'status_display', 'is_stale',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'last_checked', 'last_changed',
            'created_at', 'updated_at',
        ]


# Backward-compatible alias
QuarantineStatusListSerializer = QuarantineStatusSerializer
