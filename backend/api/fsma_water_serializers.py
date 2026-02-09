from rest_framework import serializers


class FSMAWaterAssessmentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for assessment listings."""
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    fda_outcome_display = serializers.CharField(source='get_fda_outcome_display', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    source_count = serializers.SerializerMethodField()
    field_count = serializers.SerializerMethodField()
    pending_mitigation_count = serializers.SerializerMethodField()
    days_until_expiry = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        from .models import FSMAWaterAssessment
        model = FSMAWaterAssessment
        fields = [
            'id', 'farm', 'farm_name', 'assessment_year', 'assessment_date',
            'assessor_name', 'status', 'status_display',
            'overall_risk_score', 'risk_level', 'risk_level_display',
            'fda_outcome', 'fda_outcome_display', 'valid_until',
            'source_count', 'field_count', 'pending_mitigation_count',
            'days_until_expiry', 'is_expired', 'created_at'
        ]

    def get_source_count(self, obj):
        return obj.source_assessments.count()

    def get_field_count(self, obj):
        return obj.field_assessments.count()

    def get_pending_mitigation_count(self, obj):
        return obj.mitigation_actions.filter(status__in=['pending', 'in_progress']).count()

    def get_days_until_expiry(self, obj):
        return obj.days_until_expiry


class FSMASourceAssessmentSerializer(serializers.ModelSerializer):
    """Full serializer for source assessments."""
    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    water_source_type = serializers.CharField(source='water_source.source_type', read_only=True)
    water_source_type_display = serializers.CharField(
        source='water_source.get_source_type_display', read_only=True
    )
    source_control_level_display = serializers.CharField(
        source='get_source_control_level_display', read_only=True
    )
    distribution_control_level_display = serializers.CharField(
        source='get_distribution_control_level_display', read_only=True
    )
    wellhead_condition_display = serializers.CharField(
        source='get_wellhead_condition_display', read_only=True
    )
    overall_condition_display = serializers.CharField(
        source='get_overall_condition_display', read_only=True
    )
    source_risk_level_display = serializers.CharField(
        source='get_source_risk_level_display', read_only=True
    )

    class Meta:
        from .models import FSMASourceAssessment
        model = FSMASourceAssessment
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class FSMAFieldAssessmentSerializer(serializers.ModelSerializer):
    """Full serializer for field assessments."""
    field_name = serializers.CharField(source='field.name', read_only=True)
    field_crop = serializers.SerializerMethodField()
    water_source_name = serializers.CharField(source='water_source.name', read_only=True)
    application_method_display = serializers.CharField(
        source='get_application_method_display', read_only=True
    )
    crop_contact_type_display = serializers.CharField(
        source='get_crop_contact_type_display', read_only=True
    )
    crop_growth_position_display = serializers.CharField(
        source='get_crop_growth_position_display', read_only=True
    )
    crop_surface_type_display = serializers.CharField(
        source='get_crop_surface_type_display', read_only=True
    )
    internalization_risk_display = serializers.CharField(
        source='get_internalization_risk_display', read_only=True
    )
    field_risk_level_display = serializers.CharField(
        source='get_field_risk_level_display', read_only=True
    )

    class Meta:
        from .models import FSMAFieldAssessment
        model = FSMAFieldAssessment
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_field_crop(self, obj):
        if obj.field and obj.field.crop:
            return obj.field.crop.name
        elif obj.field and obj.field.current_crop:
            return obj.field.current_crop
        return None


class FSMAEnvironmentalAssessmentSerializer(serializers.ModelSerializer):
    """Full serializer for environmental assessments."""
    flooding_risk_display = serializers.CharField(
        source='get_flooding_risk_display', read_only=True
    )
    nearest_cafo_distance_display = serializers.CharField(
        source='get_nearest_cafo_distance_display', read_only=True
    )
    nearest_grazing_distance_display = serializers.CharField(
        source='get_nearest_grazing_distance_display', read_only=True
    )
    nearest_septic_distance_display = serializers.CharField(
        source='get_nearest_septic_distance_display', read_only=True
    )
    wildlife_pressure_display = serializers.CharField(
        source='get_wildlife_pressure_display', read_only=True
    )
    environmental_risk_level_display = serializers.CharField(
        source='get_environmental_risk_level_display', read_only=True
    )

    class Meta:
        from .models import FSMAEnvironmentalAssessment
        model = FSMAEnvironmentalAssessment
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class FSMAMitigationActionSerializer(serializers.ModelSerializer):
    """Full serializer for mitigation actions."""
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    hazard_source_display = serializers.CharField(
        source='get_hazard_source_display', read_only=True
    )
    completed_by_name = serializers.SerializerMethodField()
    verified_by_name = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    farm_name = serializers.CharField(source='assessment.farm.name', read_only=True)

    class Meta:
        from .models import FSMAMitigationAction
        model = FSMAMitigationAction
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_completed_by_name(self, obj):
        if obj.completed_by:
            return obj.completed_by.get_full_name() or obj.completed_by.email
        return None

    def get_verified_by_name(self, obj):
        if obj.verified_by:
            return obj.verified_by.get_full_name() or obj.verified_by.email
        return None


class FSMAWaterAssessmentSerializer(serializers.ModelSerializer):
    """Standard serializer for create/update operations."""
    assessor_name = serializers.CharField(required=False, allow_blank=True)
    assessment_date = serializers.DateField(required=False, allow_null=True)

    class Meta:
        from .models import FSMAWaterAssessment
        model = FSMAWaterAssessment
        fields = '__all__'
        read_only_fields = [
            'id', 'company', 'assessor', 'overall_risk_score', 'risk_level',
            'fda_outcome', 'submitted_at', 'submitted_by',
            'approved_at', 'approved_by', 'pdf_file', 'pdf_generated_at',
            'created_at', 'updated_at'
        ]


class FSMAWaterAssessmentDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with nested sub-assessments."""
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    fda_outcome_display = serializers.CharField(source='get_fda_outcome_display', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    submitted_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    source_assessments = FSMASourceAssessmentSerializer(many=True, read_only=True)
    field_assessments = FSMAFieldAssessmentSerializer(many=True, read_only=True)
    environmental_assessments = FSMAEnvironmentalAssessmentSerializer(many=True, read_only=True)
    mitigation_actions = FSMAMitigationActionSerializer(many=True, read_only=True)
    pdf_url = serializers.SerializerMethodField()
    days_until_expiry = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)
    is_current = serializers.BooleanField(read_only=True)

    class Meta:
        from .models import FSMAWaterAssessment
        model = FSMAWaterAssessment
        fields = '__all__'

    def get_submitted_by_name(self, obj):
        if obj.submitted_by:
            return obj.submitted_by.get_full_name() or obj.submitted_by.email
        return None

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.email
        return None

    def get_pdf_url(self, obj):
        if obj.pdf_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None

    def get_days_until_expiry(self, obj):
        return obj.days_until_expiry
