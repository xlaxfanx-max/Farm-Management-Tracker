"""
CAC Audit Binder Serializers

Serializers for the CAC Food Safety Manual audit binder management system.
"""

from rest_framework import serializers
from .models import (
    CACBinderTemplate,
    AuditBinderInstance,
    BinderSection,
    BinderSupportingDocument,
)


# =============================================================================
# SUPPORTING DOCUMENT SERIALIZERS
# =============================================================================

class BinderSupportingDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(
        source='uploaded_by.get_full_name', read_only=True
    )
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = BinderSupportingDocument
        fields = [
            'id', 'section', 'file', 'file_url', 'file_name',
            'description', 'uploaded_by', 'uploaded_by_name', 'created_at',
        ]
        read_only_fields = ['uploaded_by', 'created_at']

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


# =============================================================================
# BINDER SECTION SERIALIZERS
# =============================================================================

class BinderSectionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for section lists."""
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    doc_type_display = serializers.CharField(
        source='get_doc_type_display', read_only=True
    )
    section_group_display = serializers.CharField(
        source='get_section_group_display', read_only=True
    )
    supporting_doc_count = serializers.IntegerField(
        source='supporting_documents.count', read_only=True
    )
    has_sop_content = serializers.SerializerMethodField()
    has_pdf_field_data = serializers.SerializerMethodField()

    class Meta:
        model = BinderSection
        fields = [
            'id', 'doc_number', 'title', 'section_group',
            'section_group_display', 'doc_type', 'doc_type_display',
            'status', 'status_display', 'auto_fill_source',
            'supporting_doc_count', 'has_sop_content', 'has_pdf_field_data',
            'notes',
        ]

    def get_has_sop_content(self, obj):
        return bool(obj.sop_content)

    def get_has_pdf_field_data(self, obj):
        return bool(obj.pdf_field_data)


class BinderSectionDetailSerializer(serializers.ModelSerializer):
    """Full serializer for section detail view."""
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    doc_type_display = serializers.CharField(
        source='get_doc_type_display', read_only=True
    )
    section_group_display = serializers.CharField(
        source='get_section_group_display', read_only=True
    )
    completed_by_name = serializers.CharField(
        source='completed_by.get_full_name', read_only=True, default=None
    )
    supporting_documents = BinderSupportingDocumentSerializer(
        many=True, read_only=True
    )

    class Meta:
        model = BinderSection
        fields = [
            'id', 'binder', 'doc_number', 'title', 'section_group',
            'section_group_display', 'doc_type', 'doc_type_display',
            'status', 'status_display', 'sop_content', 'auto_fill_source',
            'auto_fill_data', 'manual_overrides', 'pdf_field_data', 'notes',
            'completed_by', 'completed_by_name', 'completed_at',
            'supporting_documents',
        ]
        read_only_fields = ['binder', 'doc_number', 'title', 'section_group',
                            'doc_type', 'completed_by', 'completed_at']


# =============================================================================
# BINDER TEMPLATE SERIALIZERS
# =============================================================================

class CACBinderTemplateListSerializer(serializers.ModelSerializer):
    instance_count = serializers.IntegerField(
        source='instances.count', read_only=True
    )

    class Meta:
        model = CACBinderTemplate
        fields = [
            'id', 'version', 'name', 'is_active',
            'instance_count', 'created_at', 'updated_at',
        ]


class CACBinderTemplateDetailSerializer(serializers.ModelSerializer):
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = CACBinderTemplate
        fields = [
            'id', 'company', 'version', 'name', 'pdf_file', 'pdf_url',
            'section_definitions', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company', 'created_at', 'updated_at']

    def get_pdf_url(self, obj):
        if obj.pdf_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None


# =============================================================================
# BINDER INSTANCE SERIALIZERS
# =============================================================================

class AuditBinderInstanceListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for binder list views."""
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    template_name = serializers.CharField(
        source='template.name', read_only=True
    )
    template_version = serializers.CharField(
        source='template.version', read_only=True
    )
    farm_name = serializers.CharField(
        source='farm.name', read_only=True, default=None
    )
    completion_stats = serializers.DictField(read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True, default=None
    )

    class Meta:
        model = AuditBinderInstance
        fields = [
            'id', 'name', 'season_year', 'farm', 'farm_name',
            'template', 'template_name', 'template_version',
            'status', 'status_display', 'completion_stats',
            'created_by', 'created_by_name',
            'generated_at', 'created_at', 'updated_at',
        ]


class AuditBinderInstanceDetailSerializer(serializers.ModelSerializer):
    """Full serializer for binder detail view, includes sections."""
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    template_name = serializers.CharField(
        source='template.name', read_only=True
    )
    template_version = serializers.CharField(
        source='template.version', read_only=True
    )
    farm_name = serializers.CharField(
        source='farm.name', read_only=True, default=None
    )
    completion_stats = serializers.DictField(read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True, default=None
    )
    sections = BinderSectionListSerializer(many=True, read_only=True)
    generated_pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = AuditBinderInstance
        fields = [
            'id', 'company', 'name', 'season_year', 'farm', 'farm_name',
            'template', 'template_name', 'template_version',
            'status', 'status_display', 'notes', 'completion_stats',
            'sections', 'generated_pdf', 'generated_pdf_url', 'generated_at',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['company', 'generated_pdf', 'generated_at',
                            'created_by', 'created_at', 'updated_at']

    def get_generated_pdf_url(self, obj):
        if obj.generated_pdf:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.generated_pdf.url)
            return obj.generated_pdf.url
        return None


class CreateAuditBinderSerializer(serializers.Serializer):
    """Serializer for creating a new binder instance from a template."""
    template_id = serializers.IntegerField()
    name = serializers.CharField(max_length=200)
    season_year = serializers.IntegerField()
    farm_id = serializers.IntegerField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
