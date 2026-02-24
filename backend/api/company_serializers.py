from rest_framework import serializers
from .models import Company
from .serializer_mixins import DynamicFieldsMixin


class CompanySerializer(DynamicFieldsMixin, serializers.ModelSerializer):
    """
    Serializer for Company model.
    Used for company settings page and company management.
    """

    # Computed fields
    farm_count = serializers.ReadOnlyField()
    user_count = serializers.ReadOnlyField()
    county_display = serializers.ReadOnlyField()

    list_fields = [
        'id', 'uuid', 'name', 'county',
        'subscription_tier', 'farm_count', 'user_count',
        'is_active',
    ]

    class Meta:
        model = Company
        fields = [
            # Identification
            'id', 'uuid', 'name', 'legal_name',

            # Contact Information
            'primary_contact_name', 'phone', 'email',

            # Address
            'address', 'city', 'county', 'county_display', 'state', 'zip_code',

            # Business/Regulatory IDs
            'operator_id', 'business_license',
            'pca_license', 'qal_license', 'qac_license',
            'federal_tax_id', 'state_tax_id',

            # Additional info
            'website', 'notes',
            'primary_crop', 'estimated_total_acres',

            # Subscription
            'subscription_tier', 'subscription_start', 'subscription_end',
            'max_farms', 'max_users',

            # Computed counts
            'farm_count', 'user_count',

            # Onboarding
            'onboarding_completed', 'onboarding_step', 'onboarding_completed_at',

            # Status
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'uuid',
            'farm_count', 'user_count', 'county_display',
            'subscription_tier', 'subscription_start', 'subscription_end',
            'max_farms', 'max_users',
            'onboarding_completed', 'onboarding_step', 'onboarding_completed_at',
            'is_active', 'created_at', 'updated_at',
        ]


# Backward-compatible alias
CompanyListSerializer = CompanySerializer
