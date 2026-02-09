from rest_framework import serializers
from .models import (
    WellReading, MeterCalibration, WaterAllocation,
    ExtractionReport, IrrigationEvent,
)


# -----------------------------------------------------------------------------
# WELL READING SERIALIZERS (Now reference WaterSource instead of Well)
# -----------------------------------------------------------------------------

class WellReadingSerializer(serializers.ModelSerializer):
    """Full serializer for WellReading model."""

    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    farm_name = serializers.CharField(source='water_source.farm.name', read_only=True)
    flowmeter_units = serializers.CharField(source='water_source.flowmeter_units', read_only=True)
    reading_type_display = serializers.CharField(source='get_reading_type_display', read_only=True)

    class Meta:
        model = WellReading
        fields = '__all__'
        read_only_fields = [
            'previous_reading', 'previous_reading_date',
            'extraction_native_units', 'extraction_acre_feet', 'extraction_gallons',
            # Fee fields are auto-calculated
            'irrigation_extraction_af', 'base_fee', 'gsp_fee', 'domestic_fee',
            'fixed_fee', 'total_fee'
        ]


class WellReadingCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating meter readings."""

    class Meta:
        model = WellReading
        fields = [
            'water_source', 'reading_date', 'reading_time', 'meter_reading',
            'reading_type', 'meter_photo', 'pump_hours', 'water_level_ft',
            'recorded_by', 'notes',
            # New fields for rollover and domestic split
            'meter_rollover', 'domestic_extraction_af'
        ]

    def validate(self, data):
        """Validate reading is greater than previous (unless rollover specified)."""
        water_source = data.get('water_source')
        meter_reading = data.get('meter_reading')
        reading_date = data.get('reading_date')
        meter_rollover = data.get('meter_rollover')

        if water_source and meter_reading:
            # Get the previous reading
            prev = WellReading.objects.filter(
                water_source=water_source,
                reading_date__lte=reading_date
            ).exclude(
                id=self.instance.id if self.instance else None
            ).order_by('-reading_date', '-reading_time').first()

            if prev and meter_reading < prev.meter_reading:
                # Allow if meter_rollover is provided (meter reset)
                if meter_rollover:
                    pass  # Rollover handles lower reading
                # Allow if reading_type is 'initial' (meter replacement)
                elif data.get('reading_type') != 'initial':
                    raise serializers.ValidationError({
                        'meter_reading': f'Reading ({meter_reading}) cannot be less than previous reading ({prev.meter_reading}). '
                                        f'Provide meter_rollover value if meter reset, or use reading_type "initial" if meter was replaced.'
                    })

        return data


class WellReadingListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for reading listings."""

    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    reading_type_display = serializers.CharField(source='get_reading_type_display', read_only=True)

    class Meta:
        model = WellReading
        fields = [
            'id', 'water_source', 'water_source_name', 'reading_date', 'reading_time',
            'meter_reading', 'extraction_acre_feet', 'extraction_gallons',
            'reading_type', 'reading_type_display', 'recorded_by'
        ]


# -----------------------------------------------------------------------------
# METER CALIBRATION SERIALIZERS (Now reference WaterSource)
# -----------------------------------------------------------------------------

class MeterCalibrationSerializer(serializers.ModelSerializer):
    """Full serializer for MeterCalibration model."""

    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    farm_name = serializers.CharField(source='water_source.farm.name', read_only=True)
    calibration_type_display = serializers.CharField(
        source='get_calibration_type_display', read_only=True
    )
    days_until_due = serializers.SerializerMethodField()

    class Meta:
        model = MeterCalibration
        fields = '__all__'

    def get_days_until_due(self, obj):
        if obj.next_calibration_due:
            from datetime import date
            delta = obj.next_calibration_due - date.today()
            return delta.days
        return None


class MeterCalibrationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating calibration records."""

    class Meta:
        model = MeterCalibration
        fields = '__all__'

    def validate(self, data):
        """Auto-set next_calibration_due if not provided."""
        if not data.get('next_calibration_due') and data.get('calibration_date'):
            from datetime import timedelta
            # Default to 3 years from calibration date
            data['next_calibration_due'] = data['calibration_date'] + timedelta(days=365*3)

        # Auto-determine passed status
        if data.get('post_calibration_accuracy') is not None:
            accuracy = abs(data['post_calibration_accuracy'])
            data['passed'] = accuracy <= 5.0  # Within +/- 5%

        return data


# -----------------------------------------------------------------------------
# WATER ALLOCATION SERIALIZERS
# -----------------------------------------------------------------------------

class WaterAllocationSerializer(serializers.ModelSerializer):
    """Full serializer for WaterAllocation model."""

    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    farm_name = serializers.CharField(source='water_source.farm.name', read_only=True)
    allocation_type_display = serializers.CharField(
        source='get_allocation_type_display', read_only=True
    )
    source_display = serializers.CharField(source='get_source_display', read_only=True)

    class Meta:
        model = WaterAllocation
        fields = '__all__'


class WaterAllocationSummarySerializer(serializers.Serializer):
    """Serializer for allocation summary data."""

    water_year = serializers.CharField()
    water_source_id = serializers.IntegerField()
    water_source_name = serializers.CharField()
    total_allocated_af = serializers.DecimalField(max_digits=10, decimal_places=4)
    total_extracted_af = serializers.DecimalField(max_digits=10, decimal_places=4)
    remaining_af = serializers.DecimalField(max_digits=10, decimal_places=4)
    percent_used = serializers.DecimalField(max_digits=5, decimal_places=2)
    is_over_allocation = serializers.BooleanField()


# -----------------------------------------------------------------------------
# EXTRACTION REPORT SERIALIZERS (Now reference WaterSource)
# -----------------------------------------------------------------------------

class ExtractionReportSerializer(serializers.ModelSerializer):
    """Full serializer for ExtractionReport model."""

    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    farm_name = serializers.CharField(source='water_source.farm.name', read_only=True)
    gsa = serializers.CharField(source='water_source.gsa', read_only=True)
    gsa_display = serializers.CharField(source='water_source.get_gsa_display', read_only=True)
    period_type_display = serializers.CharField(source='get_period_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_status_display = serializers.CharField(
        source='get_payment_status_display', read_only=True
    )

    class Meta:
        model = ExtractionReport
        fields = '__all__'


class ExtractionReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating extraction reports."""

    class Meta:
        model = ExtractionReport
        fields = '__all__'

    def validate(self, data):
        """Validate period dates and readings."""
        water_source = data.get('water_source')
        period_start = data.get('period_start_date')
        period_end = data.get('period_end_date')

        if period_start and period_end and period_start >= period_end:
            raise serializers.ValidationError({
                'period_end_date': 'End date must be after start date'
            })

        # Auto-generate reporting_period if not provided
        if not data.get('reporting_period') and period_start:
            year = period_start.year
            if period_start.month >= 10:
                # Oct-Mar = Period 1 of next year
                data['reporting_period'] = f"{year + 1}-1"
            elif period_start.month >= 4:
                # Apr-Sep = Period 2
                data['reporting_period'] = f"{year}-2"
            else:
                # Jan-Mar = Period 1
                data['reporting_period'] = f"{year}-1"

        return data


class ExtractionReportListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for report listings."""

    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    gsa_display = serializers.CharField(source='water_source.get_gsa_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_status_display = serializers.CharField(
        source='get_payment_status_display', read_only=True
    )

    class Meta:
        model = ExtractionReport
        fields = [
            'id', 'water_source', 'water_source_name', 'gsa_display', 'reporting_period',
            'period_type', 'period_start_date', 'period_end_date',
            'total_extraction_af', 'period_allocation_af', 'over_allocation',
            'total_fees_due', 'status', 'status_display',
            'payment_status', 'payment_status_display', 'payment_due_date'
        ]


# -----------------------------------------------------------------------------
# IRRIGATION EVENT SERIALIZERS (Now only reference WaterSource)
# -----------------------------------------------------------------------------

class IrrigationEventSerializer(serializers.ModelSerializer):
    """Full serializer for IrrigationEvent model."""

    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    irrigation_method_display = serializers.CharField(
        source='get_irrigation_method_display', read_only=True
    )
    measurement_method_display = serializers.CharField(
        source='get_measurement_method_display', read_only=True
    )

    class Meta:
        model = IrrigationEvent
        fields = '__all__'
        read_only_fields = ['duration_hours', 'acre_inches']


class IrrigationEventCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating irrigation events."""

    class Meta:
        model = IrrigationEvent
        fields = '__all__'

    def validate(self, data):
        """Ensure water_source is provided."""
        if not data.get('water_source'):
            raise serializers.ValidationError(
                'water_source must be specified'
            )
        return data


class IrrigationEventListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for irrigation event listings."""

    field_name = serializers.CharField(source='field.name', read_only=True)
    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    irrigation_method_display = serializers.CharField(
        source='get_irrigation_method_display', read_only=True
    )

    class Meta:
        model = IrrigationEvent
        fields = [
            'id', 'field', 'field_name', 'water_source', 'water_source_name',
            'irrigation_date', 'duration_hours', 'water_applied_af',
            'water_applied_gallons', 'irrigation_method', 'irrigation_method_display',
            'acres_irrigated', 'acre_inches'
        ]


# -----------------------------------------------------------------------------
# SGMA DASHBOARD SERIALIZER
# -----------------------------------------------------------------------------

class SGMADashboardSerializer(serializers.Serializer):
    """Serializer for SGMA compliance dashboard data."""

    # Summary stats
    total_wells = serializers.IntegerField()
    active_wells = serializers.IntegerField()
    wells_with_ami = serializers.IntegerField()

    # Extraction summary
    ytd_extraction_af = serializers.DecimalField(max_digits=12, decimal_places=4)
    ytd_allocation_af = serializers.DecimalField(max_digits=12, decimal_places=4)
    allocation_remaining_af = serializers.DecimalField(max_digits=12, decimal_places=4)
    percent_allocation_used = serializers.DecimalField(max_digits=5, decimal_places=2)

    # Current period
    current_period = serializers.CharField()
    current_period_extraction_af = serializers.DecimalField(max_digits=12, decimal_places=4)
    current_period_start = serializers.DateField()
    current_period_end = serializers.DateField()

    # Compliance status
    calibrations_current = serializers.IntegerField()
    calibrations_due_soon = serializers.IntegerField()
    calibrations_overdue = serializers.IntegerField()

    # Upcoming deadlines
    next_report_due = serializers.DateField(allow_null=True)
    next_calibration_due = serializers.DateField(allow_null=True)

    # Alerts
    alerts = serializers.ListField(child=serializers.DictField())

    # Wells by GSA
    wells_by_gsa = serializers.ListField(child=serializers.DictField())

    # Recent readings
    recent_readings = WellReadingListSerializer(many=True)
