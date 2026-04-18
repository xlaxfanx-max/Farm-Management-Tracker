from rest_framework import serializers
from .models import PesticideProduct, PesticideApplication


class PesticideProductSerializer(serializers.ModelSerializer):
    rei_display = serializers.SerializerMethodField()
    requires_license = serializers.BooleanField(read_only=True)
    is_high_toxicity = serializers.BooleanField(read_only=True)

    class Meta:
        model = PesticideProduct
        fields = '__all__'

    def get_rei_display(self, obj):
        """Get REI formatted for display"""
        rei_hours = obj.get_rei_display_hours()
        if rei_hours:
            if rei_hours >= 24:
                days = int(rei_hours / 24)
                return f"{days} day{'s' if days != 1 else ''}"
            return f"{int(rei_hours)} hour{'s' if rei_hours != 1 else ''}"
        return None


class PesticideApplicationSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)
    field_crop = serializers.CharField(source='field.current_crop', read_only=True)
    field_acres = serializers.DecimalField(source='field.total_acres', max_digits=10, decimal_places=2, read_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    product_epa = serializers.CharField(source='product.epa_registration_number', read_only=True)
    product_moa_code = serializers.CharField(source='product.moa_code', read_only=True)
    product_moa_group_name = serializers.CharField(source='product.moa_group_name', read_only=True)
    application_cost = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True, allow_null=True,
    )
    cost_per_acre = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True, allow_null=True,
    )
    rotation_warning = serializers.SerializerMethodField()

    class Meta:
        model = PesticideApplication
        fields = [
            'id', 'application_date', 'start_time', 'end_time',
            'field', 'field_name', 'field_crop', 'field_acres',
            'acres_treated', 'product', 'product_name', 'product_epa',
            'product_moa_code', 'product_moa_group_name',
            'amount_used', 'unit_of_measure', 'application_method',
            'target_pest', 'applicator_name',
            'temperature', 'wind_speed', 'wind_direction',
            'notes', 'status', 'submitted_to_pur', 'pur_submission_date',
            'application_cost', 'cost_per_acre', 'rotation_warning',
            'created_at', 'updated_at'
        ]

    def get_rotation_warning(self, obj):
        from .services.ipm_rotation import check_moa_rotation
        warning = check_moa_rotation(
            field=obj.field,
            product=obj.product,
            application_date=obj.application_date,
            exclude_application_id=obj.id,
        )
        return warning.to_dict() if warning else None

    def validate(self, attrs):
        """Attach MOA rotation advisory to request context so the view can
        bubble it up in the response. This is advisory-only — never blocks
        the application from being saved."""
        field = attrs.get('field') or getattr(self.instance, 'field', None)
        product = attrs.get('product') or getattr(self.instance, 'product', None)
        application_date = (
            attrs.get('application_date')
            or getattr(self.instance, 'application_date', None)
        )
        request = self.context.get('request')
        if field and product and application_date and request is not None:
            from .services.ipm_rotation import check_moa_rotation
            warning = check_moa_rotation(
                field=field,
                product=product,
                application_date=application_date,
                exclude_application_id=getattr(self.instance, 'id', None),
            )
            if warning:
                # Stash on the serializer so the view can read it after save.
                self._rotation_warning = warning.to_dict()
        return attrs
