from django.db import models
from django.utils import timezone
from decimal import Decimal


class Packinghouse(models.Model):
    """
    Reference entity for packing cooperatives.
    Examples: "Saticoy Lemon Association", "Villa Park Orchards"
    """

    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='packinghouses',
        help_text='Company that owns this packinghouse record'
    )

    name = models.CharField(
        max_length=200,
        help_text='Full packinghouse name (e.g., "Saticoy Lemon Association")'
    )
    short_code = models.CharField(
        max_length=20,
        blank=True,
        help_text='Abbreviation (e.g., "SLA", "VPOA")'
    )

    # Address
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, default='CA')
    zip_code = models.CharField(max_length=10, blank=True)

    # Contact Information
    contact_name = models.CharField(max_length=100, blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    contact_email = models.EmailField(blank=True)

    # Grower Identification
    grower_id = models.CharField(
        max_length=50,
        blank=True,
        help_text='Your grower ID with this packinghouse (e.g., "THACR641")'
    )

    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = "Packinghouse"
        verbose_name_plural = "Packinghouses"
        indexes = [
            models.Index(fields=['company', 'is_active'], name='idx_pkghs_co_active'),
        ]

    def __str__(self):
        if self.short_code:
            return f"{self.name} ({self.short_code})"
        return self.name


class Pool(models.Model):
    """
    Marketing pool within a packinghouse.
    Pools group deliveries by commodity/variety/season for pricing.
    """

    POOL_TYPE_CHOICES = [
        ('fresh', 'Fresh Market'),
        ('juice', 'Juice/Processing'),
        ('mixed', 'Mixed'),
    ]

    POOL_STATUS_CHOICES = [
        ('active', 'Active'),
        ('closed', 'Closed'),
        ('settled', 'Settled'),
    ]

    packinghouse = models.ForeignKey(
        Packinghouse,
        on_delete=models.CASCADE,
        related_name='pools'
    )

    pool_id = models.CharField(
        max_length=50,
        help_text='Packinghouse pool identifier (e.g., "2520000 D2 POOL")'
    )
    name = models.CharField(
        max_length=200,
        help_text='Friendly name for the pool'
    )

    # Commodity/variety classification
    commodity = models.CharField(
        max_length=50,
        help_text='e.g., "LEMONS", "NAVELS", "TANGERINES"'
    )
    variety = models.CharField(
        max_length=50,
        blank=True,
        help_text='e.g., "CARA NAVELS", "PIXIES"'
    )

    # Season tracking (legacy string field kept for backward compatibility)
    season = models.CharField(
        max_length=20,
        help_text='Legacy season string (e.g., "2024-2025")'
    )

    # Structured season fields (new)
    season_template = models.ForeignKey(
        'SeasonTemplate',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pools',
        help_text="Season template used for this pool"
    )
    season_start = models.DateField(
        null=True,
        blank=True,
        help_text="Actual season start date"
    )
    season_end = models.DateField(
        null=True,
        blank=True,
        help_text="Actual season end date"
    )

    pool_type = models.CharField(
        max_length=20,
        choices=POOL_TYPE_CHOICES,
        default='fresh'
    )
    status = models.CharField(
        max_length=20,
        choices=POOL_STATUS_CHOICES,
        default='active'
    )

    # Date range
    open_date = models.DateField(null=True, blank=True)
    close_date = models.DateField(null=True, blank=True)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-season', 'commodity', 'name']
        verbose_name = "Pool"
        verbose_name_plural = "Pools"
        constraints = [
            models.UniqueConstraint(
                fields=['packinghouse', 'pool_id'],
                name='unique_pool_packinghouse_poolid'
            ),
        ]
        indexes = [
            models.Index(fields=['packinghouse', 'status'], name='idx_pool_pkghs_status'),
            models.Index(fields=['season', 'commodity'], name='idx_pool_season_comm'),
        ]

    def __str__(self):
        return f"{self.name} ({self.season})"

    @property
    def total_bins(self):
        """
        Total bins for this pool.
        Uses packout reports as primary source (bins_this_period),
        falls back to deliveries if no packout reports exist.
        Uses pre-computed annotations when available (from _annotate_pool_aggregates).
        """
        if hasattr(self, '_packout_bins'):
            packout_bins = self._packout_bins
            if packout_bins:
                return packout_bins
            return self._delivery_bins or 0
        from django.db.models import Sum
        packout_bins = self.packout_reports.aggregate(total=Sum('bins_this_period'))['total']
        if packout_bins:
            return packout_bins
        return self.deliveries.aggregate(total=Sum('bins'))['total'] or 0

    @property
    def total_weight(self):
        """Total weight in lbs for this pool (from settlements or deliveries).
        Uses pre-computed annotations when available (from _annotate_pool_aggregates).
        """
        if hasattr(self, '_settlement_weight'):
            if self._settlement_weight:
                return self._settlement_weight
            return self._delivery_weight or 0
        from django.db.models import Sum
        settlement = self.settlements.first()
        if settlement and settlement.total_weight_lbs:
            return settlement.total_weight_lbs
        return self.deliveries.aggregate(total=Sum('weight_lbs'))['total'] or 0

    @property
    def primary_unit_info(self):
        from api.services.season_service import get_primary_unit_for_commodity
        return get_primary_unit_for_commodity(self.commodity)

    @property
    def primary_quantity(self):
        """Primary quantity in the commodity's natural unit (bins or lbs)."""
        info = self.primary_unit_info
        if info['unit'] == 'LBS':
            return self.total_weight
        return self.total_bins

    @property
    def primary_unit(self):
        return self.primary_unit_info['unit']

    @property
    def primary_unit_label(self):
        return self.primary_unit_info['label_plural']

    @property
    def delivery_count(self):
        """Number of deliveries to this pool.
        Uses pre-computed annotation when available (from _annotate_pool_aggregates).
        """
        if hasattr(self, '_delivery_count'):
            return self._delivery_count
        return self.deliveries.count()


class PackinghouseDelivery(models.Model):
    """
    Individual delivery/receiving ticket to a packinghouse pool.
    Links to field for traceability and optional Harvest record.
    """

    pool = models.ForeignKey(
        Pool,
        on_delete=models.CASCADE,
        related_name='deliveries'
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='packinghouse_deliveries'
    )

    ticket_number = models.CharField(
        max_length=50,
        help_text='Receiving ticket number (e.g., "182622")'
    )
    delivery_date = models.DateField()

    # Quantity
    bins = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Number of bins delivered'
    )
    field_boxes = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Field box count if different from bins'
    )
    weight_lbs = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Total weight in pounds'
    )

    # Optional link to harvest record for traceability
    harvest = models.ForeignKey(
        'Harvest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='packinghouse_deliveries'
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-delivery_date', '-created_at']
        verbose_name = "Packinghouse Delivery"
        verbose_name_plural = "Packinghouse Deliveries"
        constraints = [
            models.UniqueConstraint(
                fields=['pool', 'ticket_number'],
                name='unique_delivery_pool_ticket'
            ),
        ]
        indexes = [
            models.Index(fields=['pool', 'delivery_date'], name='idx_pkgdel_pool_date'),
            models.Index(fields=['field', 'delivery_date'], name='idx_pkgdel_field_date'),
        ]

    def __str__(self):
        return f"Ticket {self.ticket_number} - {self.bins} bins ({self.delivery_date})"


class PackoutReport(models.Model):
    """
    Periodic packout/wash report showing grade breakdown.
    Typically received weekly from the packinghouse.
    """

    pool = models.ForeignKey(
        Pool,
        on_delete=models.CASCADE,
        related_name='packout_reports'
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='packout_reports',
        null=True,
        blank=True,
        help_text='Field this packout is from (optional - packouts may aggregate multiple fields)'
    )

    report_date = models.DateField(
        help_text='Date of the packout report'
    )
    period_start = models.DateField(
        help_text='Start of fruit packing period'
    )
    period_end = models.DateField(
        help_text='End of fruit packing period'
    )
    run_numbers = models.CharField(
        max_length=200,
        blank=True,
        help_text='Run numbers covered (e.g., "2535499" or "2535579, 2535591")'
    )

    # Bins for this period and cumulative
    bins_this_period = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Bins packed this period'
    )
    bins_cumulative = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Cumulative bins for pool to date'
    )

    # Summary percentages
    total_packed_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Percentage of fruit packed (vs. juice/cull)'
    )
    house_avg_packed_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='House average pack percentage for comparison'
    )

    # Cull/juice info
    juice_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )
    cull_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Quality notes from packinghouse
    quality_notes = models.TextField(
        blank=True,
        help_text='Quality observations (e.g., "Wind Scar", "Scale")'
    )

    # Store raw JSON for complete grade breakdown
    grade_data_json = models.JSONField(
        default=dict,
        help_text='Complete grade breakdown data from report'
    )

    # Link to source PDF statement (if created via PDF upload)
    source_statement = models.OneToOneField(
        'PackinghouseStatement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='packout_report',
        help_text='Source PDF statement if created via upload'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-report_date']
        verbose_name = "Packout Report"
        verbose_name_plural = "Packout Reports"
        indexes = [
            models.Index(fields=['pool', '-report_date'], name='idx_packout_pool_date'),
            models.Index(fields=['field', '-report_date'], name='idx_packout_field_date'),
        ]

    def __str__(self):
        return f"Packout {self.report_date} - {self.field.name}"


class PackoutGradeLine(models.Model):
    """
    Individual grade/size line from packout report.
    E.g., SUNKIST 075 - 120 cartons (15.5%)
    """

    UNIT_CHOICES = [
        ('CARTON', 'Cartons'),
        ('BIN', 'Bins'),
        ('LBS', 'Pounds'),
    ]

    packout_report = models.ForeignKey(
        PackoutReport,
        on_delete=models.CASCADE,
        related_name='grade_lines'
    )

    grade = models.CharField(
        max_length=20,
        help_text='Grade designation (e.g., "SUNKIST", "CHOICE", "STANDARD", "JUICE")'
    )
    size = models.CharField(
        max_length=20,
        blank=True,
        help_text='Size code (e.g., "075", "088", "113")'
    )
    unit_of_measure = models.CharField(
        max_length=20,
        choices=UNIT_CHOICES,
        default='CARTON'
    )

    # This period
    quantity_this_period = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Quantity packed this period'
    )
    percent_this_period = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text='Percentage of pack this period'
    )

    # Cumulative (pool to date)
    quantity_cumulative = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    percent_cumulative = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True
    )

    # House average comparison
    house_avg_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='House average percentage for comparison'
    )

    class Meta:
        ordering = ['grade', 'size']
        verbose_name = "Packout Grade Line"
        verbose_name_plural = "Packout Grade Lines"

    def __str__(self):
        if self.size:
            return f"{self.grade} {self.size}: {self.quantity_this_period} {self.unit_of_measure}"
        return f"{self.grade}: {self.quantity_this_period} {self.unit_of_measure}"


class PoolSettlement(models.Model):
    """
    Final pool closing statement with pricing and returns.
    Shows gross credits, deductions, and net return.
    """

    pool = models.ForeignKey(
        Pool,
        on_delete=models.CASCADE,
        related_name='settlements'
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='pool_settlements',
        help_text='Specific field, or null for grower summary across all blocks'
    )

    statement_date = models.DateField(
        help_text='Date of settlement statement'
    )

    # Receiving totals
    total_bins = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Total bins in settlement (primary for citrus)'
    )
    total_cartons = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    total_weight_lbs = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Summary financials
    total_credits = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Total gross credits (sales)'
    )
    total_deductions = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Total deductions (packing, assessments, etc.)'
    )
    net_return = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Net return (credits - deductions)'
    )
    prior_advances = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text='Prior advances paid to grower'
    )
    amount_due = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Final amount due (net return - prior advances)'
    )

    # Per-unit metrics (high precision for accurate calculations)
    net_per_bin = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    net_per_carton = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    net_per_lb = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True
    )
    net_per_acre = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    # House average comparison
    house_avg_per_bin = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )
    house_avg_per_carton = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Pack percentages
    fresh_fruit_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Percentage packed as fresh fruit'
    )
    products_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Percentage going to products/juice'
    )

    # Store complete data
    settlement_data_json = models.JSONField(
        default=dict,
        help_text='Complete settlement data for reference'
    )

    # Link to source PDF statement (if created via PDF upload)
    source_statement = models.OneToOneField(
        'PackinghouseStatement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pool_settlement',
        help_text='Source PDF statement if created via upload'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-statement_date']
        verbose_name = "Pool Settlement"
        verbose_name_plural = "Pool Settlements"
        indexes = [
            models.Index(fields=['pool', '-statement_date'], name='idx_settle_pool_date'),
            models.Index(fields=['field', '-statement_date'], name='idx_settle_field_date'),
        ]

    def __str__(self):
        field_name = self.field.name if self.field else "All Blocks"
        return f"Settlement {self.statement_date} - {field_name}"

    @property
    def variance_vs_house_per_bin(self):
        """Calculate variance from house average per bin."""
        if self.net_per_bin and self.house_avg_per_bin:
            return float(self.net_per_bin - self.house_avg_per_bin)
        return None


class SettlementGradeLine(models.Model):
    """
    Pricing detail by grade/size from settlement.
    Shows quantity, FOB rate, and total for each grade.
    """

    UNIT_CHOICES = [
        ('CARTON', 'Cartons'),
        ('BIN', 'Bins'),
        ('LBS', 'Pounds'),
    ]

    settlement = models.ForeignKey(
        PoolSettlement,
        on_delete=models.CASCADE,
        related_name='grade_lines'
    )

    block_id = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text='Block/grove ID this line belongs to (e.g., "002", "003"). Blank if no block breakdown.'
    )

    grade = models.CharField(
        max_length=20,
        help_text='Grade designation (e.g., "SK DOMESTIC", "CH DOMESTIC", "JUICE")'
    )
    size = models.CharField(
        max_length=20,
        blank=True,
        help_text='Size code (e.g., "048", "056", "072")'
    )
    unit_of_measure = models.CharField(
        max_length=20,
        choices=UNIT_CHOICES,
        default='CARTON'
    )

    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text='Quantity in this grade/size'
    )
    percent_of_total = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text='Percentage of total pack'
    )
    fob_rate = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        help_text='FOB price per unit (high precision: 21.75359773)'
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Total credit for this line'
    )

    class Meta:
        ordering = ['grade', 'size']
        verbose_name = "Settlement Grade Line"
        verbose_name_plural = "Settlement Grade Lines"

    def __str__(self):
        if self.size:
            return f"{self.grade} {self.size}: {self.quantity} @ ${self.fob_rate}"
        return f"{self.grade}: {self.quantity} @ ${self.fob_rate}"


class SettlementDeduction(models.Model):
    """
    Itemized charges from settlement.
    Tracks packing charges, assessments, capital contributions, etc.
    """

    CATEGORY_CHOICES = [
        ('packing', 'Packing Charges'),
        ('assessment', 'Assessments'),
        ('pick_haul', 'Pick & Haul'),
        ('capital', 'Capital Funds'),
        ('marketing', 'Marketing'),
        ('other', 'Other'),
    ]

    settlement = models.ForeignKey(
        PoolSettlement,
        on_delete=models.CASCADE,
        related_name='deductions'
    )

    block_id = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text='Block/grove ID this deduction belongs to (e.g., "002", "003"). Blank if not block-specific.'
    )

    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        help_text='Deduction category'
    )
    description = models.CharField(
        max_length=200,
        help_text='Description (e.g., "DOOR CHARGE", "SUNKIST MARKETING")'
    )
    quantity = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Quantity basis'
    )
    unit_of_measure = models.CharField(
        max_length=20,
        default='UNIT',
        blank=True,
        help_text='Unit (BIN, CTN, LBS, etc.)'
    )
    rate = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        help_text='Rate per unit (high precision)'
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Total deduction amount'
    )

    class Meta:
        ordering = ['category', 'description']
        verbose_name = "Settlement Deduction"
        verbose_name_plural = "Settlement Deductions"

    def __str__(self):
        return f"{self.description}: ${self.amount}"


class GrowerLedgerEntry(models.Model):
    """
    Track advances and payments from packinghouse.
    Used to reconcile grower account with packinghouse.
    """

    ENTRY_TYPE_CHOICES = [
        ('advance', 'Advance'),
        ('pool_close', 'Pool Close'),
        ('adjustment', 'Adjustment'),
        ('refund', 'Refund'),
        ('payment', 'Payment'),
        ('capital_equity', 'Capital/Equity'),
    ]

    packinghouse = models.ForeignKey(
        Packinghouse,
        on_delete=models.CASCADE,
        related_name='ledger_entries'
    )
    pool = models.ForeignKey(
        Pool,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='ledger_entries',
        help_text='Associated pool, if applicable'
    )

    entry_date = models.DateField(
        help_text='Transaction date'
    )
    posted_date = models.DateField(
        null=True,
        blank=True,
        help_text='Date posted to account'
    )
    entry_type = models.CharField(
        max_length=20,
        choices=ENTRY_TYPE_CHOICES
    )
    reference = models.CharField(
        max_length=50,
        blank=True,
        help_text='Reference number (e.g., "APM-SL-09588", "00265")'
    )
    description = models.CharField(
        max_length=200,
        help_text='Transaction description'
    )

    # Debit increases what packinghouse owes grower
    # Credit increases what grower owes packinghouse (or reduces balance)
    debit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text='Amount owed to grower'
    )
    credit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text='Amount paid or offset'
    )
    balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Running balance after this entry'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-entry_date', '-created_at']
        verbose_name = "Grower Ledger Entry"
        verbose_name_plural = "Grower Ledger Entries"
        indexes = [
            models.Index(fields=['packinghouse', '-entry_date'], name='idx_ledger_pkghs_date'),
            models.Index(fields=['entry_type'], name='idx_ledger_type'),
        ]

    def __str__(self):
        return f"{self.entry_date} - {self.description} (${self.debit - self.credit})"

    @property
    def net_amount(self):
        """Return net amount (positive = owed to grower)."""
        return self.debit - self.credit


class PackinghouseStatement(models.Model):
    """
    Uploaded PDF statement from packinghouse with AI-extracted data.
    Supports VPOA and SLA statement formats.
    """

    STATEMENT_TYPE_CHOICES = [
        ('packout', 'Packout Statement'),
        ('settlement', 'Pool Settlement'),
        ('wash_report', 'Wash Report'),
        ('grower_statement', 'Grower Pool Statement'),
    ]

    PACKINGHOUSE_FORMAT_CHOICES = [
        ('vpoa', 'Villa Park Orchards (VPOA)'),
        ('sla', 'Saticoy Lemon Association (SLA)'),
        ('mission', 'Mission Produce'),
        ('generic', 'Generic/Other'),
    ]

    STATUS_CHOICES = [
        ('uploaded', 'Uploaded'),
        ('extracting', 'Extracting'),
        ('extracted', 'Extracted'),
        ('review', 'Awaiting Review'),
        ('completed', 'Completed'),
        ('failed', 'Extraction Failed'),
    ]

    packinghouse = models.ForeignKey(
        Packinghouse,
        on_delete=models.CASCADE,
        related_name='statements',
        null=True,
        blank=True,
        help_text='Packinghouse this statement is from (auto-detected if not specified)'
    )

    # File storage
    pdf_file = models.FileField(
        upload_to='packinghouse_statements/%Y/%m/',
        help_text='Uploaded PDF file'
    )
    original_filename = models.CharField(
        max_length=255,
        help_text='Original filename of uploaded PDF'
    )
    file_size_bytes = models.PositiveIntegerField(
        help_text='File size in bytes'
    )

    # Statement classification
    statement_type = models.CharField(
        max_length=20,
        choices=STATEMENT_TYPE_CHOICES,
        blank=True,
        help_text='Type of statement (auto-detected or user-specified)'
    )
    packinghouse_format = models.CharField(
        max_length=20,
        choices=PACKINGHOUSE_FORMAT_CHOICES,
        default='generic',
        help_text='Format/template used by packinghouse (auto-detected)'
    )

    # Processing status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='uploaded'
    )

    # Extracted data (raw JSON from AI extraction)
    extracted_data = models.JSONField(
        default=dict,
        blank=True,
        help_text='Raw extracted data from PDF for preview/editing'
    )

    # Extraction confidence (0.0 - 1.0)
    extraction_confidence = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='AI confidence in extraction accuracy'
    )

    # Error tracking
    extraction_error = models.TextField(
        blank=True,
        help_text='Error message if extraction failed'
    )

    # Optional associations (set after user confirms data)
    pool = models.ForeignKey(
        Pool,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_statements',
        help_text='Pool this statement belongs to (set during confirmation)'
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_statements',
        help_text='Field this statement is for (set during confirmation)'
    )

    # Batch upload tracking (set when uploaded as part of batch)
    batch_upload = models.ForeignKey(
        'StatementBatchUpload',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='statements',
        help_text='Batch this statement belongs to (if uploaded via batch)'
    )

    # Auto-match result (populated during batch upload)
    auto_match_result = models.JSONField(
        default=dict,
        blank=True,
        help_text='Auto-matching result with confidence scores'
    )

    # Audit fields
    uploaded_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_statements'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Packinghouse Statement"
        verbose_name_plural = "Packinghouse Statements"
        indexes = [
            models.Index(fields=['packinghouse', '-created_at'], name='idx_stmt_pkghs_created'),
            models.Index(fields=['status'], name='idx_stmt_status'),
            models.Index(fields=['statement_type'], name='idx_stmt_type'),
        ]

    def __str__(self):
        return f"{self.original_filename} ({self.get_status_display()})"

    @property
    def has_packout_report(self):
        """Check if this statement has generated a PackoutReport."""
        return hasattr(self, 'packout_report') and self.packout_report is not None

    @property
    def has_pool_settlement(self):
        """Check if this statement has generated a PoolSettlement."""
        return hasattr(self, 'pool_settlement') and self.pool_settlement is not None

    @property
    def is_processed(self):
        """Check if statement has been processed into a report/settlement."""
        return self.has_packout_report or self.has_pool_settlement


class PackinghouseGrowerMapping(models.Model):
    """
    Learned mappings from grower names/IDs in PDF statements to farms/fields.
    Created when users confirm statement matches, used for auto-matching future uploads.
    """
    packinghouse = models.ForeignKey(
        Packinghouse,
        on_delete=models.CASCADE,
        related_name='grower_mappings',
        help_text='Packinghouse this mapping applies to'
    )

    # Pattern matching fields (from PDF data)
    grower_name_pattern = models.CharField(
        max_length=255,
        help_text='Grower name as it appears in statements (e.g., "THACKER FARMS")'
    )
    grower_id_pattern = models.CharField(
        max_length=100,
        blank=True,
        help_text='Grower ID as it appears in statements (e.g., "THACR641")'
    )
    block_name_pattern = models.CharField(
        max_length=100,
        blank=True,
        help_text='Block/ranch name pattern for field-level matching'
    )

    # Target entities
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        related_name='packinghouse_mappings',
        help_text='Farm this grower name maps to'
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='packinghouse_mappings',
        help_text='Optional specific field this block name maps to'
    )

    # Usage tracking
    use_count = models.PositiveIntegerField(
        default=1,
        help_text='Number of times this mapping has been used'
    )
    last_used_at = models.DateTimeField(
        auto_now=True,
        help_text='When this mapping was last used'
    )

    # Source tracking
    created_from_statement = models.ForeignKey(
        PackinghouseStatement,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_mappings',
        help_text='Statement that created this mapping'
    )

    # Audit fields
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_grower_mappings'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Packinghouse Grower Mapping"
        verbose_name_plural = "Packinghouse Grower Mappings"
        # Unique constraint on packinghouse + grower pattern + optional block
        unique_together = ['packinghouse', 'grower_name_pattern', 'block_name_pattern']
        indexes = [
            models.Index(fields=['packinghouse', 'grower_name_pattern'], name='idx_mapping_grower'),
            models.Index(fields=['packinghouse', 'grower_id_pattern'], name='idx_mapping_grower_id'),
            models.Index(fields=['farm'], name='idx_mapping_farm'),
        ]
        ordering = ['-use_count', '-last_used_at']

    def __str__(self):
        target = f"{self.farm.name}"
        if self.field:
            target += f" / {self.field.name}"
        return f"{self.grower_name_pattern} -> {target}"

    def increment_use_count(self):
        """Increment the use count when mapping is used."""
        self.use_count += 1
        self.save(update_fields=['use_count', 'last_used_at'])


class StatementBatchUpload(models.Model):
    """
    Tracks batch upload progress for multiple PDF statements.
    """
    BATCH_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('partial', 'Partial Success'),
        ('failed', 'Failed'),
    ]

    batch_id = models.UUIDField(
        unique=True,
        editable=False,
        help_text='Unique identifier for this batch'
    )
    packinghouse = models.ForeignKey(
        Packinghouse,
        on_delete=models.CASCADE,
        related_name='batch_uploads',
        null=True,
        blank=True,
        help_text='Default packinghouse (null for mixed uploads with auto-detection)'
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=BATCH_STATUS_CHOICES,
        default='pending'
    )

    # Progress counters
    total_files = models.PositiveIntegerField(
        default=0,
        help_text='Total number of files in batch'
    )
    processed_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of files processed'
    )
    success_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of successfully extracted files'
    )
    failed_count = models.PositiveIntegerField(
        default=0,
        help_text='Number of failed extractions'
    )

    # Error tracking
    error_message = models.TextField(
        blank=True,
        help_text='Error message if batch failed'
    )

    # Audit fields
    uploaded_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='batch_uploads'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When processing completed'
    )

    class Meta:
        verbose_name = "Statement Batch Upload"
        verbose_name_plural = "Statement Batch Uploads"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['batch_id'], name='idx_batch_id'),
            models.Index(fields=['packinghouse', '-created_at'], name='idx_batch_pkghs'),
            models.Index(fields=['status'], name='idx_batch_status'),
        ]

    def __str__(self):
        return f"Batch {self.batch_id} ({self.status})"

    @property
    def progress_percent(self):
        """Calculate progress percentage."""
        if self.total_files == 0:
            return 0
        return round((self.processed_count / self.total_files) * 100, 1)

    @property
    def is_complete(self):
        """Check if batch processing is complete."""
        return self.status in ['completed', 'partial', 'failed']
