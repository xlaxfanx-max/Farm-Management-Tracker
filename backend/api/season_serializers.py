from rest_framework import serializers
from .models import SeasonTemplate, SeasonType, GrowingCycle, GrowingCycleStatus


class SeasonTemplateSerializer(serializers.ModelSerializer):
    """Serializer for SeasonTemplate model."""
    season_type_display = serializers.CharField(source='get_season_type_display', read_only=True)
    is_system_default = serializers.SerializerMethodField()

    class Meta:
        model = SeasonTemplate
        fields = [
            'id', 'name', 'season_type', 'season_type_display',
            'start_month', 'start_day', 'duration_months',
            'crosses_calendar_year', 'label_format',
            'applicable_categories',
            'company', 'active',
            'is_system_default',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_is_system_default(self, obj):
        return obj.company is None


class SeasonTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for season template dropdowns."""

    class Meta:
        model = SeasonTemplate
        fields = ['id', 'name', 'season_type', 'crosses_calendar_year', 'applicable_categories']


class GrowingCycleSerializer(serializers.ModelSerializer):
    """Full serializer for GrowingCycle model."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    crop_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    duration_days = serializers.IntegerField(read_only=True)

    class Meta:
        model = GrowingCycle
        fields = [
            'id', 'field', 'field_name',
            'cycle_number', 'year',
            'crop', 'crop_name',
            'planting_date', 'expected_harvest_start', 'expected_harvest_end',
            'actual_harvest_date',
            'days_to_maturity',
            'status', 'status_display', 'is_active',
            'duration_days',
            'notes',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_crop_name(self, obj):
        crop = obj.effective_crop
        if crop:
            return crop.name if not crop.variety else f"{crop.name} ({crop.variety})"
        return None


class GrowingCycleListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for growing cycle lists."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    crop_name = serializers.SerializerMethodField()

    class Meta:
        model = GrowingCycle
        fields = [
            'id', 'field', 'field_name',
            'cycle_number', 'year',
            'crop_name', 'status',
            'planting_date', 'expected_harvest_end',
        ]

    def get_crop_name(self, obj):
        crop = obj.effective_crop
        return crop.name if crop else None
