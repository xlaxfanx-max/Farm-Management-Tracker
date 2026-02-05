from rest_framework import serializers
from .models import (
    ExternalDataSource, SoilSurveyData,
    YieldFeatureSnapshot, YieldForecast,
)


class ExternalDataSourceSerializer(serializers.ModelSerializer):
    source_type_display = serializers.CharField(
        source='get_source_type_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_last_sync_status_display', read_only=True
    )

    class Meta:
        model = ExternalDataSource
        fields = '__all__'
        read_only_fields = [
            'created_at', 'updated_at', 'last_sync_at',
            'last_sync_status', 'last_sync_error', 'records_synced',
        ]


class SoilSurveyDataSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)

    class Meta:
        model = SoilSurveyData
        fields = '__all__'
        read_only_fields = ['fetched_at']


class YieldFeatureSnapshotSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.SerializerMethodField()

    class Meta:
        model = YieldFeatureSnapshot
        fields = '__all__'
        read_only_fields = ['created_at']

    def get_farm_name(self, obj):
        return obj.field.farm.name if obj.field.farm else ''


class YieldForecastSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.SerializerMethodField()
    crop_name = serializers.SerializerMethodField()
    forecast_method_display = serializers.CharField(
        source='get_forecast_method_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    accuracy_pct = serializers.SerializerMethodField()

    class Meta:
        model = YieldForecast
        fields = '__all__'
        read_only_fields = [
            'created_at', 'updated_at', 'forecast_error_pct',
        ]

    def get_farm_name(self, obj):
        return obj.field.farm.name if obj.field.farm else ''

    def get_crop_name(self, obj):
        return obj.field.crop.name if obj.field.crop else ''

    def get_accuracy_pct(self, obj):
        if obj.forecast_error_pct is not None:
            return float(100 - obj.forecast_error_pct)
        return None


class YieldForecastListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.SerializerMethodField()
    crop_name = serializers.SerializerMethodField()
    forecast_method_display = serializers.CharField(
        source='get_forecast_method_display', read_only=True
    )

    class Meta:
        model = YieldForecast
        fields = [
            'id', 'field', 'field_name', 'farm_name', 'crop_name',
            'season_label', 'forecast_date',
            'predicted_yield_per_acre', 'predicted_total_yield', 'yield_unit',
            'lower_bound_per_acre', 'upper_bound_per_acre',
            'confidence_level',
            'forecast_method', 'forecast_method_display',
            'status', 'data_completeness_pct',
            'actual_yield_per_acre', 'forecast_error_pct',
        ]

    def get_farm_name(self, obj):
        return obj.field.farm.name if obj.field.farm else ''

    def get_crop_name(self, obj):
        return obj.field.crop.name if obj.field.crop else ''
