from rest_framework import serializers
from .models import (
    Packinghouse, Pool, PackinghouseDelivery,
    PackoutReport, PackoutGradeLine,
    PoolSettlement, SettlementGradeLine, SettlementDeduction,
    GrowerLedgerEntry, PackinghouseStatement, Farm,
)


class PackinghouseListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for packinghouse listings."""
    pool_count = serializers.SerializerMethodField()

    class Meta:
        model = Packinghouse
        fields = [
            'id', 'name', 'short_code', 'grower_id',
            'city', 'state', 'is_active', 'pool_count'
        ]

    def get_pool_count(self, obj):
        return obj.pools.count()


class PackinghouseSerializer(serializers.ModelSerializer):
    """Full serializer for Packinghouse model."""
    pool_count = serializers.SerializerMethodField()
    active_pools_count = serializers.SerializerMethodField()

    class Meta:
        model = Packinghouse
        fields = [
            'id', 'company', 'name', 'short_code',
            'address', 'city', 'state', 'zip_code',
            'contact_name', 'contact_phone', 'contact_email',
            'grower_id', 'notes', 'is_active',
            'pool_count', 'active_pools_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at']

    def get_pool_count(self, obj):
        return obj.pools.count()

    def get_active_pools_count(self, obj):
        return obj.pools.filter(status='active').count()


class PoolListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for pool listings."""
    packinghouse_name = serializers.CharField(source='packinghouse.name', read_only=True)
    packinghouse_short_code = serializers.CharField(source='packinghouse.short_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    pool_type_display = serializers.CharField(source='get_pool_type_display', read_only=True)
    total_bins = serializers.ReadOnlyField()
    delivery_count = serializers.ReadOnlyField()
    primary_quantity = serializers.ReadOnlyField()
    primary_unit = serializers.ReadOnlyField()
    primary_unit_label = serializers.ReadOnlyField()

    class Meta:
        model = Pool
        fields = [
            'id', 'pool_id', 'name', 'packinghouse',
            'packinghouse_name', 'packinghouse_short_code',
            'commodity', 'variety', 'season',
            'pool_type', 'pool_type_display',
            'status', 'status_display',
            'total_bins', 'delivery_count',
            'primary_quantity', 'primary_unit', 'primary_unit_label'
        ]


class PoolSerializer(serializers.ModelSerializer):
    """Full serializer for Pool model."""
    packinghouse_name = serializers.CharField(source='packinghouse.name', read_only=True)
    packinghouse_short_code = serializers.CharField(source='packinghouse.short_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    pool_type_display = serializers.CharField(source='get_pool_type_display', read_only=True)
    total_bins = serializers.ReadOnlyField()
    delivery_count = serializers.ReadOnlyField()
    primary_quantity = serializers.ReadOnlyField()
    primary_unit = serializers.ReadOnlyField()
    primary_unit_label = serializers.ReadOnlyField()

    class Meta:
        model = Pool
        fields = [
            'id', 'packinghouse', 'packinghouse_name', 'packinghouse_short_code',
            'pool_id', 'name', 'commodity', 'variety', 'season',
            'pool_type', 'pool_type_display',
            'status', 'status_display',
            'open_date', 'close_date',
            'notes', 'total_bins', 'delivery_count',
            'primary_quantity', 'primary_unit', 'primary_unit_label',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PackinghouseDeliveryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for delivery listings."""
    pool_name = serializers.CharField(source='pool.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    harvest_date = serializers.DateField(source='harvest.harvest_date', read_only=True)
    harvest_lot = serializers.CharField(source='harvest.lot_number', read_only=True)

    class Meta:
        model = PackinghouseDelivery
        fields = [
            'id', 'pool', 'pool_name', 'field', 'field_name',
            'ticket_number', 'delivery_date', 'bins', 'weight_lbs',
            'harvest', 'harvest_date', 'harvest_lot'
        ]


class PackinghouseDeliverySerializer(serializers.ModelSerializer):
    """Full serializer for PackinghouseDelivery model."""
    pool_name = serializers.CharField(source='pool.name', read_only=True)
    pool_commodity = serializers.CharField(source='pool.commodity', read_only=True)
    packinghouse_name = serializers.CharField(source='pool.packinghouse.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    harvest_date = serializers.DateField(source='harvest.harvest_date', read_only=True)

    class Meta:
        model = PackinghouseDelivery
        fields = [
            'id', 'pool', 'pool_name', 'pool_commodity', 'packinghouse_name',
            'field', 'field_name', 'farm_name',
            'ticket_number', 'delivery_date',
            'bins', 'field_boxes', 'weight_lbs',
            'harvest', 'harvest_date',
            'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PackoutGradeLineSerializer(serializers.ModelSerializer):
    """Serializer for packout grade line items."""
    unit_display = serializers.CharField(source='get_unit_of_measure_display', read_only=True)

    class Meta:
        model = PackoutGradeLine
        fields = [
            'id', 'grade', 'size', 'unit_of_measure', 'unit_display',
            'quantity_this_period', 'percent_this_period',
            'quantity_cumulative', 'percent_cumulative',
            'house_avg_percent'
        ]


class PackoutReportListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for packout report listings."""
    pool_name = serializers.CharField(source='pool.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)

    class Meta:
        model = PackoutReport
        fields = [
            'id', 'pool', 'pool_name', 'field', 'field_name',
            'report_date', 'period_start', 'period_end',
            'bins_this_period', 'bins_cumulative',
            'total_packed_percent', 'house_avg_packed_percent'
        ]


class PackoutReportSerializer(serializers.ModelSerializer):
    """Full serializer for PackoutReport with nested grade lines."""
    pool_name = serializers.CharField(source='pool.name', read_only=True)
    pool_commodity = serializers.CharField(source='pool.commodity', read_only=True)
    packinghouse_name = serializers.CharField(source='pool.packinghouse.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True)
    farm_name = serializers.CharField(source='field.farm.name', read_only=True)
    grade_lines = PackoutGradeLineSerializer(many=True, read_only=True)

    class Meta:
        model = PackoutReport
        fields = [
            'id', 'pool', 'pool_name', 'pool_commodity', 'packinghouse_name',
            'field', 'field_name', 'farm_name',
            'report_date', 'period_start', 'period_end', 'run_numbers',
            'bins_this_period', 'bins_cumulative',
            'total_packed_percent', 'house_avg_packed_percent',
            'juice_percent', 'cull_percent',
            'quality_notes', 'grade_data_json',
            'grade_lines',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PackoutReportCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating packout reports with nested grade lines."""
    grade_lines = PackoutGradeLineSerializer(many=True, required=False)

    class Meta:
        model = PackoutReport
        fields = [
            'pool', 'field', 'report_date', 'period_start', 'period_end',
            'run_numbers', 'bins_this_period', 'bins_cumulative',
            'total_packed_percent', 'house_avg_packed_percent',
            'juice_percent', 'cull_percent', 'quality_notes',
            'grade_data_json', 'grade_lines'
        ]

    def create(self, validated_data):
        grade_lines_data = validated_data.pop('grade_lines', [])
        packout_report = PackoutReport.objects.create(**validated_data)

        for grade_line_data in grade_lines_data:
            PackoutGradeLine.objects.create(
                packout_report=packout_report,
                **grade_line_data
            )

        return packout_report


class SettlementGradeLineSerializer(serializers.ModelSerializer):
    """Serializer for settlement grade line items."""
    unit_display = serializers.CharField(source='get_unit_of_measure_display', read_only=True)

    class Meta:
        model = SettlementGradeLine
        fields = [
            'id', 'block_id', 'grade', 'size', 'unit_of_measure', 'unit_display',
            'quantity', 'percent_of_total', 'fob_rate', 'total_amount'
        ]


class SettlementDeductionSerializer(serializers.ModelSerializer):
    """Serializer for settlement deduction items."""
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = SettlementDeduction
        fields = [
            'id', 'block_id', 'category', 'category_display', 'description',
            'quantity', 'unit_of_measure', 'rate', 'amount'
        ]


class PoolSettlementListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for settlement listings."""
    pool_name = serializers.CharField(source='pool.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True, allow_null=True)
    variance_vs_house_per_bin = serializers.ReadOnlyField()
    primary_quantity = serializers.SerializerMethodField()
    primary_unit = serializers.SerializerMethodField()
    primary_unit_label = serializers.SerializerMethodField()

    class Meta:
        model = PoolSettlement
        fields = [
            'id', 'pool', 'pool_name', 'field', 'field_name',
            'statement_date', 'total_bins', 'total_weight_lbs',
            'net_return', 'amount_due',
            'net_per_bin', 'house_avg_per_bin', 'variance_vs_house_per_bin',
            'primary_quantity', 'primary_unit', 'primary_unit_label'
        ]

    def get_primary_quantity(self, obj):
        from api.services.season_service import get_primary_unit_for_commodity
        info = get_primary_unit_for_commodity(obj.pool.commodity)
        if info['unit'] == 'LBS':
            return obj.total_weight_lbs
        return obj.total_bins

    def get_primary_unit(self, obj):
        from api.services.season_service import get_primary_unit_for_commodity
        return get_primary_unit_for_commodity(obj.pool.commodity)['unit']

    def get_primary_unit_label(self, obj):
        from api.services.season_service import get_primary_unit_for_commodity
        return get_primary_unit_for_commodity(obj.pool.commodity)['label_plural']


class PoolSettlementSerializer(serializers.ModelSerializer):
    """Full serializer for PoolSettlement with nested grade lines and deductions."""
    pool_name = serializers.CharField(source='pool.name', read_only=True)
    pool_commodity = serializers.CharField(source='pool.commodity', read_only=True)
    packinghouse_name = serializers.CharField(source='pool.packinghouse.name', read_only=True)
    field_name = serializers.CharField(source='field.name', read_only=True, allow_null=True)
    farm_name = serializers.SerializerMethodField()
    grade_lines = SettlementGradeLineSerializer(many=True, read_only=True)
    deductions = SettlementDeductionSerializer(many=True, read_only=True)
    variance_vs_house_per_bin = serializers.ReadOnlyField()
    source_pdf_url = serializers.SerializerMethodField()
    source_pdf_filename = serializers.SerializerMethodField()
    primary_quantity = serializers.SerializerMethodField()
    primary_unit = serializers.SerializerMethodField()
    primary_unit_label = serializers.SerializerMethodField()
    primary_net_per_unit = serializers.SerializerMethodField()

    class Meta:
        model = PoolSettlement
        fields = [
            'id', 'pool', 'pool_name', 'pool_commodity', 'packinghouse_name',
            'field', 'field_name', 'farm_name',
            'statement_date',
            'total_bins', 'total_cartons', 'total_weight_lbs',
            'total_credits', 'total_deductions',
            'net_return', 'prior_advances', 'amount_due',
            'net_per_bin', 'net_per_carton', 'net_per_lb', 'net_per_acre',
            'house_avg_per_bin', 'house_avg_per_carton', 'variance_vs_house_per_bin',
            'fresh_fruit_percent', 'products_percent',
            'settlement_data_json',
            'grade_lines', 'deductions',
            'source_pdf_url', 'source_pdf_filename',
            'primary_quantity', 'primary_unit', 'primary_unit_label', 'primary_net_per_unit',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_farm_name(self, obj):
        if obj.field:
            return obj.field.farm.name
        return None

    def get_primary_quantity(self, obj):
        from api.services.season_service import get_primary_unit_for_commodity
        info = get_primary_unit_for_commodity(obj.pool.commodity)
        if info['unit'] == 'LBS':
            return obj.total_weight_lbs
        return obj.total_bins

    def get_primary_unit(self, obj):
        from api.services.season_service import get_primary_unit_for_commodity
        return get_primary_unit_for_commodity(obj.pool.commodity)['unit']

    def get_primary_unit_label(self, obj):
        from api.services.season_service import get_primary_unit_for_commodity
        return get_primary_unit_for_commodity(obj.pool.commodity)['label_plural']

    def get_primary_net_per_unit(self, obj):
        from api.services.season_service import get_primary_unit_for_commodity
        info = get_primary_unit_for_commodity(obj.pool.commodity)
        return getattr(obj, info['net_per_field'])

    def get_source_pdf_url(self, obj):
        """Return the proxy URL that serves PDF through our backend to avoid CORS issues."""
        if obj.source_statement and obj.source_statement.pdf_file:
            # Return relative URL so it works with frontend's API base URL
            return f'/api/packinghouse-statements/{obj.source_statement.id}/pdf/'
        return None

    def get_source_pdf_filename(self, obj):
        if obj.source_statement:
            return obj.source_statement.original_filename
        return None


class PoolSettlementCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating settlements with nested grade lines and deductions."""
    grade_lines = SettlementGradeLineSerializer(many=True, required=False)
    deductions = SettlementDeductionSerializer(many=True, required=False)

    class Meta:
        model = PoolSettlement
        fields = [
            'pool', 'field', 'statement_date',
            'total_bins', 'total_cartons', 'total_weight_lbs',
            'total_credits', 'total_deductions',
            'net_return', 'prior_advances', 'amount_due',
            'net_per_bin', 'net_per_carton', 'net_per_lb', 'net_per_acre',
            'house_avg_per_bin', 'house_avg_per_carton',
            'fresh_fruit_percent', 'products_percent',
            'settlement_data_json',
            'grade_lines', 'deductions'
        ]

    def create(self, validated_data):
        grade_lines_data = validated_data.pop('grade_lines', [])
        deductions_data = validated_data.pop('deductions', [])

        settlement = PoolSettlement.objects.create(**validated_data)

        for grade_line_data in grade_lines_data:
            SettlementGradeLine.objects.create(
                settlement=settlement,
                **grade_line_data
            )

        for deduction_data in deductions_data:
            SettlementDeduction.objects.create(
                settlement=settlement,
                **deduction_data
            )

        return settlement


class GrowerLedgerEntryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for ledger entry listings."""
    packinghouse_name = serializers.CharField(source='packinghouse.name', read_only=True)
    pool_name = serializers.CharField(source='pool.name', read_only=True, allow_null=True)
    entry_type_display = serializers.CharField(source='get_entry_type_display', read_only=True)
    net_amount = serializers.ReadOnlyField()

    class Meta:
        model = GrowerLedgerEntry
        fields = [
            'id', 'packinghouse', 'packinghouse_name',
            'pool', 'pool_name',
            'entry_date', 'entry_type', 'entry_type_display',
            'reference', 'description',
            'debit', 'credit', 'net_amount', 'balance'
        ]


class GrowerLedgerEntrySerializer(serializers.ModelSerializer):
    """Full serializer for GrowerLedgerEntry model."""
    packinghouse_name = serializers.CharField(source='packinghouse.name', read_only=True)
    packinghouse_short_code = serializers.CharField(source='packinghouse.short_code', read_only=True)
    pool_name = serializers.CharField(source='pool.name', read_only=True, allow_null=True)
    pool_commodity = serializers.SerializerMethodField()
    entry_type_display = serializers.CharField(source='get_entry_type_display', read_only=True)
    net_amount = serializers.ReadOnlyField()

    class Meta:
        model = GrowerLedgerEntry
        fields = [
            'id', 'packinghouse', 'packinghouse_name', 'packinghouse_short_code',
            'pool', 'pool_name', 'pool_commodity',
            'entry_date', 'posted_date',
            'entry_type', 'entry_type_display',
            'reference', 'description',
            'debit', 'credit', 'net_amount', 'balance',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_pool_commodity(self, obj):
        if obj.pool:
            return obj.pool.commodity
        return None


# =============================================================================
# PACKINGHOUSE ANALYTICS SERIALIZERS
# =============================================================================

class BlockPerformanceSerializer(serializers.Serializer):
    """Serializer for block performance comparison."""
    field_id = serializers.IntegerField()
    field_name = serializers.CharField()
    pool_name = serializers.CharField()
    total_bins = serializers.DecimalField(max_digits=10, decimal_places=2)
    pack_percent = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    house_avg_pack_percent = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    pack_variance = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)
    net_per_bin = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    house_avg_per_bin = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    return_variance = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)


class PackoutTrendSerializer(serializers.Serializer):
    """Serializer for packout percentage trends."""
    report_date = serializers.DateField()
    field_name = serializers.CharField()
    total_packed_percent = serializers.DecimalField(max_digits=5, decimal_places=2)
    house_avg_packed_percent = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)


class SettlementComparisonSerializer(serializers.Serializer):
    """Serializer for packinghouse settlement comparison."""
    packinghouse_id = serializers.IntegerField()
    packinghouse_name = serializers.CharField()
    season = serializers.CharField()
    commodity = serializers.CharField()
    total_bins = serializers.DecimalField(max_digits=10, decimal_places=2)
    net_return = serializers.DecimalField(max_digits=12, decimal_places=2)
    net_per_bin = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    fresh_fruit_percent = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)


class SizeDistributionSizeSerializer(serializers.Serializer):
    """Individual size entry within a farm/field group."""
    size = serializers.CharField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2)
    percent = serializers.DecimalField(max_digits=5, decimal_places=2)
    house_avg_percent = serializers.DecimalField(max_digits=5, decimal_places=2, allow_null=True)


class SizeDistributionGroupSerializer(serializers.Serializer):
    """Farm or field group with size breakdown."""
    group_id = serializers.IntegerField()
    group_name = serializers.CharField()
    total_quantity = serializers.DecimalField(max_digits=12, decimal_places=2)
    sizes = SizeDistributionSizeSerializer(many=True)


class SizePricingEntrySerializer(serializers.Serializer):
    """Pricing data for a single size code."""
    size = serializers.CharField()
    total_quantity = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_revenue = serializers.DecimalField(max_digits=14, decimal_places=2)
    weighted_avg_fob = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    percent_of_total_quantity = serializers.DecimalField(max_digits=5, decimal_places=1)
    percent_of_total_revenue = serializers.DecimalField(max_digits=5, decimal_places=1)


# =============================================================================
# PACKINGHOUSE STATEMENT SERIALIZERS
# =============================================================================

class PackinghouseStatementListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for statement listings."""
    packinghouse_name = serializers.CharField(source='packinghouse.name', read_only=True)
    packinghouse_short_code = serializers.CharField(source='packinghouse.short_code', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    statement_type_display = serializers.CharField(source='get_statement_type_display', read_only=True)
    format_display = serializers.CharField(source='get_packinghouse_format_display', read_only=True)
    pool_name = serializers.CharField(source='pool.name', read_only=True, allow_null=True)
    field_name = serializers.CharField(source='field.name', read_only=True, allow_null=True)
    farm_name = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    commodity = serializers.SerializerMethodField()
    is_processed = serializers.ReadOnlyField()

    class Meta:
        model = PackinghouseStatement
        fields = [
            'id', 'packinghouse', 'packinghouse_name', 'packinghouse_short_code',
            'original_filename', 'file_size_bytes',
            'statement_type', 'statement_type_display',
            'packinghouse_format', 'format_display',
            'status', 'status_display',
            'extraction_confidence',
            'pool', 'pool_name', 'field', 'field_name', 'farm_name',
            'uploaded_by', 'uploaded_by_name',
            'commodity',
            'is_processed',
            'created_at'
        ]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.email
        return None

    def get_farm_name(self, obj):
        """Return farm name from assigned field, or from auto_match_result."""
        if obj.field and obj.field.farm:
            return obj.field.farm.name
        if obj.auto_match_result and isinstance(obj.auto_match_result, dict):
            farm = obj.auto_match_result.get('farm')
            if isinstance(farm, dict):
                return farm.get('name')
        return None

    def get_commodity(self, obj):
        """Return commodity from pool (if confirmed) or extracted_data header."""
        if obj.pool and obj.pool.commodity:
            return obj.pool.commodity
        if obj.extracted_data and isinstance(obj.extracted_data, dict):
            header = obj.extracted_data.get('header', {})
            if isinstance(header, dict):
                return header.get('commodity')
        return None


class PackinghouseStatementSerializer(serializers.ModelSerializer):
    """Full serializer for PackinghouseStatement with all details."""
    packinghouse_name = serializers.CharField(source='packinghouse.name', read_only=True, allow_null=True)
    packinghouse_short_code = serializers.CharField(source='packinghouse.short_code', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    statement_type_display = serializers.CharField(source='get_statement_type_display', read_only=True)
    format_display = serializers.CharField(source='get_packinghouse_format_display', read_only=True)
    pool_name = serializers.CharField(source='pool.name', read_only=True, allow_null=True)
    field_name = serializers.CharField(source='field.name', read_only=True, allow_null=True)
    uploaded_by_name = serializers.SerializerMethodField()
    is_processed = serializers.ReadOnlyField()
    has_packout_report = serializers.ReadOnlyField()
    has_pool_settlement = serializers.ReadOnlyField()
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = PackinghouseStatement
        fields = [
            'id', 'packinghouse', 'packinghouse_name', 'packinghouse_short_code',
            'pdf_file', 'pdf_url', 'original_filename', 'file_size_bytes',
            'statement_type', 'statement_type_display',
            'packinghouse_format', 'format_display',
            'status', 'status_display',
            'extracted_data', 'extraction_confidence', 'extraction_error',
            'auto_match_result',
            'pool', 'pool_name', 'field', 'field_name',
            'uploaded_by', 'uploaded_by_name',
            'is_processed', 'has_packout_report', 'has_pool_settlement',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'pdf_file', 'original_filename', 'file_size_bytes',
            'extracted_data', 'extraction_confidence', 'extraction_error',
            'auto_match_result',
            'uploaded_by', 'created_at', 'updated_at'
        ]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.email
        return None

    def get_pdf_url(self, obj):
        """
        Return the proxy URL that serves PDF through our backend.
        This avoids CORS issues with direct R2/S3 access.
        """
        if obj.pdf_file:
            # Return relative URL - frontend prepends API base URL
            return f'/api/packinghouse-statements/{obj.id}/pdf/'
        return None


class PackinghouseStatementUploadSerializer(serializers.Serializer):
    """Serializer for uploading a new PDF statement."""
    pdf_file = serializers.FileField(
        help_text='PDF file to upload (max 50MB)'
    )
    packinghouse = serializers.PrimaryKeyRelatedField(
        queryset=Packinghouse.objects.all(),
        help_text='Packinghouse ID this statement is from'
    )
    packinghouse_format = serializers.ChoiceField(
        choices=[('', 'Auto-detect'), ('vpoa', 'VPOA'), ('sla', 'SLA'), ('generic', 'Generic')],
        required=False,
        allow_blank=True,
        default='',
        help_text='Format hint (optional, will auto-detect if not specified)'
    )

    def validate_pdf_file(self, value):
        # Check file size (50MB max)
        max_size = 50 * 1024 * 1024  # 50MB
        if value.size > max_size:
            raise serializers.ValidationError(
                f'File too large. Maximum size is 50MB, got {value.size / (1024*1024):.1f}MB'
            )

        # Check file type
        if not value.name.lower().endswith('.pdf'):
            raise serializers.ValidationError('Only PDF files are allowed')

        # Check content type if available
        content_type = getattr(value, 'content_type', None)
        if content_type and content_type != 'application/pdf':
            raise serializers.ValidationError('File must be a PDF')

        return value

    def validate_packinghouse(self, value):
        # Ensure packinghouse belongs to user's company
        request = self.context.get('request')
        if request and request.user.current_company:
            if value.company != request.user.current_company:
                raise serializers.ValidationError('Invalid packinghouse')
        return value


# =============================================================================
# BATCH UPLOAD SERIALIZERS
# =============================================================================

class BatchUploadSerializer(serializers.Serializer):
    """Serializer for batch PDF upload request."""
    packinghouse = serializers.PrimaryKeyRelatedField(
        queryset=Packinghouse.objects.all(),
        required=False,
        allow_null=True,
        help_text='Packinghouse ID (optional - will auto-detect from PDF if not specified)'
    )
    packinghouse_format = serializers.ChoiceField(
        choices=[('', 'Auto-detect'), ('vpoa', 'VPOA'), ('sla', 'SLA'), ('generic', 'Generic')],
        required=False,
        allow_blank=True,
        default='',
        help_text='Format hint (optional, will auto-detect if not specified)'
    )

    def validate_packinghouse(self, value):
        if value is None:
            return value
        request = self.context.get('request')
        if request and request.user.current_company:
            if value.company != request.user.current_company:
                raise serializers.ValidationError('Invalid packinghouse')
        return value


class BatchStatementResultSerializer(serializers.Serializer):
    """Serializer for individual statement result in batch upload response."""
    id = serializers.IntegerField()
    filename = serializers.CharField()
    status = serializers.CharField()
    statement_type = serializers.CharField(allow_null=True)
    extraction_confidence = serializers.DecimalField(
        max_digits=3, decimal_places=2, allow_null=True
    )
    extraction_error = serializers.CharField(allow_blank=True, allow_null=True)
    auto_match = serializers.DictField(allow_null=True)
    needs_review = serializers.BooleanField()


class BatchUploadResponseSerializer(serializers.Serializer):
    """Serializer for batch upload response."""
    batch_id = serializers.UUIDField()
    total = serializers.IntegerField()
    success_count = serializers.IntegerField()
    failed_count = serializers.IntegerField()
    statements = BatchStatementResultSerializer(many=True)


class BatchConfirmItemSerializer(serializers.Serializer):
    """Serializer for individual statement in batch confirm request."""
    id = serializers.IntegerField(help_text='Statement ID')
    packinghouse_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text='Override packinghouse ID (required if not auto-detected)'
    )
    farm_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text='Override farm ID (uses auto-matched if not provided)'
    )
    field_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text='Override field ID (uses auto-matched if not provided)'
    )
    pool_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text='Override pool ID'
    )
    skip = serializers.BooleanField(
        default=False,
        help_text='Skip this statement (do not confirm)'
    )


class BatchConfirmSerializer(serializers.Serializer):
    """Serializer for batch confirm request."""
    statements = BatchConfirmItemSerializer(many=True)
    save_mappings = serializers.BooleanField(
        default=True,
        help_text='Save confirmed matches as learned mappings for future uploads'
    )


class BatchConfirmResultSerializer(serializers.Serializer):
    """Serializer for individual statement result in batch confirm response."""
    id = serializers.IntegerField()
    filename = serializers.CharField()
    success = serializers.BooleanField()
    message = serializers.CharField()
    settlement_id = serializers.IntegerField(allow_null=True)
    packout_report_id = serializers.IntegerField(allow_null=True)
    mapping_saved = serializers.BooleanField()


class BatchConfirmResponseSerializer(serializers.Serializer):
    """Serializer for batch confirm response."""
    total = serializers.IntegerField()
    confirmed = serializers.IntegerField()
    skipped = serializers.IntegerField()
    failed = serializers.IntegerField()
    mappings_created = serializers.IntegerField()
    results = BatchConfirmResultSerializer(many=True)


class BatchStatusSerializer(serializers.Serializer):
    """Serializer for batch status response."""
    batch_id = serializers.UUIDField()
    status = serializers.CharField()
    total_files = serializers.IntegerField()
    processed_count = serializers.IntegerField()
    success_count = serializers.IntegerField()
    failed_count = serializers.IntegerField()
    progress_percent = serializers.FloatField()
    is_complete = serializers.BooleanField()
    created_at = serializers.DateTimeField()
    completed_at = serializers.DateTimeField(allow_null=True)


class GrowerMappingSerializer(serializers.Serializer):
    """Serializer for PackinghouseGrowerMapping."""
    id = serializers.IntegerField(read_only=True)
    packinghouse_id = serializers.IntegerField()
    grower_name_pattern = serializers.CharField()
    grower_id_pattern = serializers.CharField(allow_blank=True)
    block_name_pattern = serializers.CharField(allow_blank=True)
    farm_id = serializers.IntegerField()
    farm_name = serializers.CharField(source='farm.name', read_only=True)
    field_id = serializers.IntegerField(allow_null=True)
    field_name = serializers.CharField(source='field.name', read_only=True, allow_null=True)
    use_count = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
