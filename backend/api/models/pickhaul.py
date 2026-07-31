"""Pick & haul — the platform as system of record.

This is the platform side of the pick & haul pipeline that used to live entirely
on one machine. The split of responsibilities is the load-bearing decision:

* **The local machine keeps the portal fetch.** The Saticoy portal is HTTP-only
  and its logins live in Windows Credential Manager; none of that moves to the
  cloud. After every clean local run (all blocking gates pass), the pipeline
  pushes a JSON bundle of receipts, house charges, and pull provenance to
  ``POST /api/pickhaul/sync/`` using a revocable :class:`MachineApiToken`.
* **The platform owns the human-entered data.** Contractor invoices and the
  hand-keyed manual picks are created here, by the accountant, on the web. Push
  bundles cannot carry them — the sync serializer rejects unknown keys — so
  ownership is enforced by construction, not convention.
* **Reconciliation runs here** (services/pickhaul/): invoices are matched to
  the house's own Direct Charges and linked to the receipts they cover, and the
  data-shaped gates run after every push and every invoice edit.

Why this is upsert-on-natural-key rather than the block-scoring snapshot
pattern: a report card is a computed artifact — each import is one engine run,
protected by staged snapshots and an explicit publish. Pick & haul is a living
operational dataset: receipts accumulate daily and the platform owns the
invoices that link to them. Snapshotting receipts would fork the invoice links.
Provenance is kept instead through :class:`PickHaulSyncBatch` plus
``first_seen_batch`` / ``last_seen_batch`` on every synced row.

Field semantics carried over faithfully from the local schema (pickhaul/db.py):

* ``date_rec_from_ph`` (human record of money arriving) and ``charge_posted``
  (derived from the matching Direct Charge) are two different events and stay
  two different columns. They were once one field; a derived date round-tripped
  through the entry workbook and came back looking like something a person had
  typed. Nothing in this codebase may ever write ``date_rec_from_ph``.
* A receipt that vanishes from a later portal pull is deactivated, not deleted.
* ``block_raw`` is the block string as the house prints it, deliberately
  unmapped; the nullable ``field`` FK is the future seam to real Field rows.
"""

import hashlib
import secrets

from django.db import models
from django.db.models import F, Value
from django.db.models.functions import Coalesce
from decimal import Decimal


PICKHAUL_KIND_CHOICES = [('PICK', 'Pick'), ('HAUL', 'Haul')]
CHARGE_KIND_CHOICES = PICKHAUL_KIND_CHOICES + [('OTHER', 'Other')]
ASSIGNED_CHOICES = [('rule', 'Rule'), ('manual', 'Manual'), ('migrated', 'Migrated')]
SEVERITY_CHOICES = [('error', 'Error'), ('warn', 'Warning'), ('info', 'Info')]


class MachineApiToken(models.Model):
    """A revocable credential for an unattended machine, never a person.

    The local pipeline authenticates its push with one of these. It is not a
    portal credential and grants nothing beyond its scope: only the sync view
    lists MachineTokenAuthentication, so the token is useless anywhere else in
    the API. The secret is shown once at mint and stored only as a hash.

    ``user`` is a service account whose ``current_company`` is set, which makes
    the RLS middleware and audit logging work without modification.
    """

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='machine_tokens'
    )
    user = models.ForeignKey(
        'User', on_delete=models.PROTECT, related_name='machine_tokens',
        help_text='Service account this token authenticates as',
    )
    name = models.CharField(max_length=100)
    scope = models.CharField(max_length=50, default='pickhaul:push')
    token_prefix = models.CharField(
        max_length=12, db_index=True,
        help_text="First characters of the secret, e.g. 'pht_ab12cd34' — safe to display",
    )
    token_hash = models.CharField(max_length=64, unique=True)

    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        state = 'revoked' if self.revoked_at else 'active'
        return f'{self.name} ({self.token_prefix}…, {state})'

    @property
    def is_active(self):
        return self.revoked_at is None

    @classmethod
    def mint(cls, company, user, name, scope='pickhaul:push'):
        """Create a token; returns (instance, secret). The secret is never stored."""
        secret = f'pht_{secrets.token_urlsafe(32)}'
        instance = cls.objects.create(
            company=company, user=user, name=name, scope=scope,
            token_prefix=secret[:12],
            token_hash=hashlib.sha256(secret.encode()).hexdigest(),
        )
        return instance, secret


class PickHaulSyncBatch(models.Model):
    """One received bundle — the provenance envelope for everything sync-owned.

    ``bundle_sha256`` is the idempotency key: re-POSTing the same bundle is a
    recorded no-op, never a duplicate. A rejected bundle is recorded too, with
    its reason, so 'why is the site stale' is answerable from the site.
    """

    STATUS_CHOICES = [
        ('applied', 'Applied'), ('rejected', 'Rejected'), ('duplicate', 'Duplicate'),
    ]
    KIND_CHOICES = [('push', 'Push'), ('seed', 'Seed')]

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='pickhaul_batches'
    )
    received_at = models.DateTimeField(auto_now_add=True)
    season = models.PositiveSmallIntegerField()
    schema_version = models.PositiveSmallIntegerField(default=1)
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default='push')
    generated_at = models.DateTimeField(
        null=True, blank=True, help_text='When the local pipeline built this bundle'
    )
    bundle_sha256 = models.CharField(max_length=64, blank=True)
    config_sha256 = models.CharField(max_length=64, blank=True)
    source_label = models.CharField(
        max_length=100, blank=True, help_text="e.g. 'pickhaul-local @ DESKTOP-XXXX'"
    )

    gate_errors = models.PositiveSmallIntegerField(default=0)
    gate_warns = models.PositiveSmallIntegerField(default=0)
    counts = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)

    status = models.CharField(max_length=12, choices=STATUS_CHOICES)
    reject_reason = models.TextField(blank=True)
    token = models.ForeignKey(
        MachineApiToken, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='batches',
    )

    class Meta:
        ordering = ['-received_at']
        indexes = [models.Index(fields=['company', '-received_at'])]
        constraints = [
            models.UniqueConstraint(
                fields=['company', 'bundle_sha256'],
                condition=models.Q(status='applied'),
                name='uniq_pickhaul_bundle_applied',
            ),
        ]

    def __str__(self):
        return f'Batch {self.pk} season {self.season} ({self.status})'


class PickHaulPull(models.Model):
    """Mirror of the local ``pull`` table: one row per portal file read.

    Only the file's basename travels — local paths stay local.
    """

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='pickhaul_pulls'
    )
    batch = models.ForeignKey(
        PickHaulSyncBatch, on_delete=models.CASCADE, related_name='pulls'
    )
    packinghouse = models.ForeignKey(
        'Packinghouse', on_delete=models.PROTECT, related_name='pickhaul_pulls'
    )
    entity = models.ForeignKey(
        'LegalEntity', on_delete=models.PROTECT, related_name='pickhaul_pulls'
    )
    season = models.PositiveSmallIntegerField()
    pulled_at = models.DateTimeField()
    file_name = models.CharField(max_length=255)
    sha256 = models.CharField(max_length=64)
    header_text = models.CharField(max_length=300, blank=True)
    header_year = models.PositiveSmallIntegerField(null=True, blank=True)
    row_count = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, default='ok')
    note = models.TextField(blank=True)

    class Meta:
        ordering = ['-pulled_at']
        constraints = [
            models.UniqueConstraint(
                fields=['packinghouse', 'entity', 'season', 'pulled_at', 'sha256'],
                name='uniq_pickhaul_pull',
            ),
        ]
        indexes = [models.Index(fields=['company', 'season', 'packinghouse', 'entity'])]

    def __str__(self):
        return f'{self.file_name} @ {self.pulled_at:%Y-%m-%d %H:%M}'


class PickHaulReceipt(models.Model):
    """One bin delivery ticket, keyed on the house's own receipt number.

    SYNC-OWNED: pushes upsert these; the web never edits one. The grain of the
    whole system — invoices attach to receipts through the link table, never by
    row position, which is what makes a refresh unable to misalign payments.
    """

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='pickhaul_receipts'
    )
    packinghouse = models.ForeignKey(
        'Packinghouse', on_delete=models.PROTECT, related_name='pickhaul_receipts'
    )
    entity = models.ForeignKey(
        'LegalEntity', on_delete=models.PROTECT, related_name='pickhaul_receipts'
    )
    season = models.PositiveSmallIntegerField()
    receipt_no = models.CharField(max_length=50)

    pool = models.CharField(max_length=100, blank=True)
    block_raw = models.CharField(
        max_length=200, blank=True,
        help_text="As the house prints it, e.g. 'JP FINCH SESPE BLOCK'. Deliberately unmapped.",
    )
    pick_date = models.DateField(null=True, blank=True)
    pick_date_raw = models.CharField(
        max_length=40, blank=True,
        help_text='Kept verbatim when the export printed text the local pipeline could not parse',
    )
    pick_time = models.CharField(max_length=20, blank=True)
    variety_code = models.CharField(max_length=20, blank=True)
    commodity_code = models.CharField(max_length=20, blank=True)
    uom = models.CharField(max_length=20, blank=True)
    qty = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    uom2 = models.CharField(max_length=20, blank=True)
    qty2 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    extra_12 = models.CharField(max_length=100, blank=True)
    extra_13 = models.CharField(max_length=100, blank=True)
    bins = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    is_active = models.BooleanField(
        default=True,
        help_text='False = vanished from a later portal pull. Flagged, never deleted.',
    )
    field = models.ForeignKey(
        'Field', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pickhaul_receipts',
        help_text='Future seam: block_raw resolved to a real Field',
    )

    first_seen_batch = models.ForeignKey(
        PickHaulSyncBatch, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )
    last_seen_batch = models.ForeignKey(
        PickHaulSyncBatch, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-pick_date', 'receipt_no']
        constraints = [
            models.UniqueConstraint(
                fields=['packinghouse', 'entity', 'season', 'receipt_no'],
                name='uniq_pickhaul_receipt',
            ),
        ]
        indexes = [
            models.Index(fields=['company', 'season', 'block_raw', 'pick_date']),
            models.Index(fields=['company', 'season', 'is_active']),
        ]

    def __str__(self):
        return f'{self.packinghouse.short_code}/{self.entity.short_code} #{self.receipt_no}'


class PickHaulDirectCharge(models.Model):
    """The house's own posted picking/hauling charge rows.

    SYNC-OWNED, append-only: ``row_hash`` is computed locally at ingest and is
    the identity, exactly as in the local schema. This is what invoices
    reconcile against.
    """

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='pickhaul_charges'
    )
    packinghouse = models.ForeignKey(
        'Packinghouse', on_delete=models.PROTECT, related_name='pickhaul_charges'
    )
    entity = models.ForeignKey(
        'LegalEntity', on_delete=models.PROTECT, related_name='pickhaul_charges'
    )
    season = models.PositiveSmallIntegerField()

    pool = models.CharField(max_length=100, blank=True)
    block_raw = models.CharField(max_length=200, blank=True)
    charge_date = models.DateField(null=True, blank=True)
    charge_date_raw = models.CharField(max_length=40, blank=True)
    charge_desc = models.CharField(
        max_length=100, blank=True,
        help_text="As printed: 'PICKING CHARGES' / 'HAULING-GWR ADV' / …",
    )
    kind = models.CharField(max_length=8, choices=CHARGE_KIND_CHOICES)
    txn_desc = models.CharField(max_length=200, blank=True)
    ap_reference = models.CharField(
        max_length=50, blank=True, help_text="e.g. 'APM-SL-00500'"
    )
    debit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    credit = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    qty = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    uom = models.CharField(max_length=20, blank=True)
    per_unit = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    row_hash = models.CharField(max_length=64)

    first_seen_batch = models.ForeignKey(
        PickHaulSyncBatch, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['charge_date', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['packinghouse', 'entity', 'season', 'row_hash'],
                name='uniq_pickhaul_charge_hash',
            ),
        ]
        indexes = [
            models.Index(fields=['company', 'season', 'kind', 'block_raw']),
            models.Index(fields=['company', 'ap_reference']),
        ]

    def __str__(self):
        return f'{self.kind} {self.ap_reference or "?"} ${self.debit or 0}'


class PickHaulInvoice(models.Model):
    """One contractor invoice — entered once, however many receipts it covers.

    PLATFORM-OWNED after the one-time seed. Pushes never create, update, or
    delete rows here; there is no code path from the sync endpoint to this
    table.

    ``date_rec_from_ph`` and ``charge_posted`` are two different events and are
    never merged — see the module docstring. The derived columns
    (``charge_posted``, ``ap_reference``, ``match_method``) are written only by
    the reconciliation service and are read-only through the API.
    """

    SOURCE_CHOICES = [
        ('entry', 'Entry workbook'), ('migrated', 'Migrated'), ('platform', 'Platform'),
    ]

    BILLING_CHOICES = [
        ('direct', 'Grower-paid'),
        ('house_billed', 'House-billed'),
    ]

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='pickhaul_invoices'
    )
    packinghouse = models.ForeignKey(
        'Packinghouse', on_delete=models.PROTECT, related_name='pickhaul_invoices'
    )
    entity = models.ForeignKey(
        'LegalEntity', on_delete=models.PROTECT, related_name='pickhaul_invoices'
    )
    season = models.PositiveSmallIntegerField()
    kind = models.CharField(max_length=8, choices=PICKHAUL_KIND_CHOICES)

    contractor = models.CharField(max_length=100, null=True, blank=True)
    invoice_no = models.CharField(max_length=50, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    block_raw = models.CharField(max_length=200, blank=True)
    date_from = models.DateField(null=True, blank=True)
    date_to = models.DateField(null=True, blank=True)
    date_paid = models.DateField(null=True, blank=True)
    date_emailed = models.DateField(null=True, blank=True)

    date_rec_from_ph = models.DateField(
        null=True, blank=True,
        help_text='When WE received the money. Human record only; nothing derives it.',
    )
    charge_posted = models.DateField(
        null=True, blank=True,
        help_text='When the HOUSE posted the charge. Written only by reconciliation.',
    )
    ap_reference = models.CharField(max_length=50, blank=True)
    match_method = models.CharField(
        max_length=30, blank=True,
        help_text='exact / reference / block / subset (+combined) / unmatched',
    )

    amount_formula = models.CharField(
        max_length=200, blank=True,
        help_text="Preserves amounts typed as formulas, e.g. '=672+125'",
    )
    conflict_fields = models.CharField(
        max_length=200, blank=True,
        help_text='Migration-era record of fields that disagreed across retyped rows',
    )
    notes = models.TextField(blank=True)
    source = models.CharField(max_length=12, choices=SOURCE_CHOICES, default='platform')
    billing = models.CharField(
        max_length=12, choices=BILLING_CHOICES, default='direct',
        help_text='direct = grower pays the contractor and chases reimbursement; '
                  'house_billed = the contractor bills the packinghouse and it is '
                  'charged against sales (nothing to chase).',
    )

    created_by = models.ForeignKey(
        'User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pickhaul_invoices_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_from', '-id']
        constraints = [
            # NULL-safe identity, mirroring the local ux_invoice_identity index.
            # A plain UNIQUE treats NULLs as distinct — which is how JPF-SLA
            # #5782 ($2,351.82, blank contractor) got in twice locally.
            models.UniqueConstraint(
                F('packinghouse'), F('entity'), F('season'), F('kind'),
                Coalesce('contractor', Value('')),
                Coalesce('invoice_no', Value('')),
                Coalesce('amount', Value(Decimal('-1'))),
                name='uniq_pickhaul_invoice_identity',
            ),
        ]
        indexes = [
            models.Index(fields=['company', 'season', 'kind']),
            models.Index(fields=['company', 'season', 'date_emailed']),
        ]

    def __str__(self):
        return f'{self.kind} {self.contractor or "?"} #{self.invoice_no or "?"}'

    @property
    def is_outstanding(self):
        """Grower-paid, emailed to the house, not yet charged back — the chase-list predicate."""
        return (
            self.billing == 'direct'
            and self.date_emailed is not None
            and self.charge_posted is None
        )


class PickHaulInvoiceReceipt(models.Model):
    """Which receipts an invoice covers — the table that replaced row alignment."""

    invoice = models.ForeignKey(
        PickHaulInvoice, on_delete=models.CASCADE, related_name='receipt_links'
    )
    receipt = models.ForeignKey(
        PickHaulReceipt, on_delete=models.PROTECT, related_name='invoice_links'
    )
    assigned = models.CharField(max_length=10, choices=ASSIGNED_CHOICES, default='rule')

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['invoice', 'receipt'], name='uniq_pickhaul_invoice_receipt'
            ),
        ]

    def __str__(self):
        return f'invoice {self.invoice_id} → receipt {self.receipt_id} ({self.assigned})'


class PickHaulChargeMatch(models.Model):
    """A persisted reconciliation allocation: this charge row pays that invoice.

    The local pipeline kept these allocations in memory, which is exactly why
    house-posted charges with no invoice were invisible to every gate. The
    OneToOne makes 'each charge allocated at most once' a database constraint,
    and its absence makes an unmatched charge a first-class query.
    """

    invoice = models.ForeignKey(
        PickHaulInvoice, on_delete=models.CASCADE, related_name='charge_matches'
    )
    charge = models.OneToOneField(
        PickHaulDirectCharge, on_delete=models.CASCADE, related_name='match'
    )
    method = models.CharField(max_length=30)
    matched_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'pick haul charge matches'

    def __str__(self):
        return f'charge {self.charge_id} → invoice {self.invoice_id} ({self.method})'


class PickHaulChargeAck(models.Model):
    """A platform-owned acknowledgment of a house-posted charge.

    When a contractor bills the packinghouse directly, the grower may never
    hold an invoice — the house charge is the only record. Without an ack,
    that charge sits in gate 11 (unmatched-charges) forever. The ack lives in
    a satellite table (same pattern as PickHaulChargeMatch) because
    PickHaulDirectCharge is sync-owned append-only: the web must never write
    a column on a sync-owned row.
    """

    REASON_CHOICES = [
        ('house_billed', 'Expected house-billed'),
        ('disputed', 'Disputed'),
        ('other', 'Other'),
    ]

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='pickhaul_charge_acks'
    )
    charge = models.OneToOneField(
        PickHaulDirectCharge, on_delete=models.CASCADE, related_name='ack'
    )
    reason = models.CharField(
        max_length=15, choices=REASON_CHOICES, default='house_billed'
    )
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(
        'User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pickhaul_charge_acks_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'pick haul charge acks'

    def __str__(self):
        return f'ack charge {self.charge_id} ({self.reason})'


class PickHaulManualPick(models.Model):
    """A hand-keyed pick for the no-portal houses (Limoneira, Mission, …).

    PLATFORM-OWNED: web entry replaces the eight hand-keyed sheets. The sheet
    label is kept as provenance and as the UI's grouping facet.
    """

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='pickhaul_manual_picks'
    )
    packinghouse = models.ForeignKey(
        'Packinghouse', on_delete=models.PROTECT, related_name='pickhaul_manual_picks'
    )
    entity = models.ForeignKey(
        'LegalEntity', on_delete=models.PROTECT, related_name='pickhaul_manual_picks'
    )
    season = models.PositiveSmallIntegerField()
    sheet = models.CharField(
        max_length=50, blank=True,
        help_text="Legacy source-sheet label, e.g. 'JPF Avo's' — provenance and grouping",
    )

    ranch = models.CharField(max_length=100, blank=True)
    block = models.CharField(max_length=100, blank=True)
    varietal = models.CharField(max_length=100, blank=True)
    pick_date = models.DateField(null=True, blank=True)
    date_label = models.CharField(
        max_length=40, blank=True, help_text="Some sheets print a range like '4/13-4/15'"
    )
    bins = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    lbs = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    harvester = models.CharField(max_length=100, blank=True)
    hauler = models.CharField(max_length=100, blank=True)
    invoice_no = models.CharField(max_length=50, blank=True)
    cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    haul_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    date_paid = models.DateField(null=True, blank=True)
    packing_house_text = models.CharField(
        max_length=50, blank=True,
        help_text="The sheet's own 'PH' column, distinct from the FK",
    )
    net_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    date_received = models.DateField(null=True, blank=True)
    po_received = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    row_no = models.PositiveIntegerField(
        null=True, blank=True, help_text='Preserves the order rows were entered in'
    )

    # The sheets repeat one invoice down every row it covers; summing the column
    # would multiply it. False = this row repeats the invoice above.
    count_cost = models.BooleanField(default=True)
    count_haul = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        'User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='pickhaul_manual_picks_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sheet', 'row_no', 'id']
        indexes = [models.Index(fields=['company', 'season', 'packinghouse'])]

    def __str__(self):
        return f'{self.sheet or self.packinghouse_id}: {self.ranch} {self.block} {self.pick_date}'


class PickHaulCheckResult(models.Model):
    """A gate finding — from the local file-shaped gates (1,2,3,4,9, arriving in
    bundles) or the platform-run data-shaped gates (5,6,7,8,10,11)."""

    ORIGIN_CHOICES = [('local', 'Local'), ('platform', 'Platform')]

    company = models.ForeignKey(
        'Company', on_delete=models.CASCADE, related_name='pickhaul_checks'
    )
    batch = models.ForeignKey(
        PickHaulSyncBatch, on_delete=models.CASCADE, null=True, blank=True,
        related_name='checks',
    )
    run_at = models.DateTimeField()
    origin = models.CharField(max_length=10, choices=ORIGIN_CHOICES)
    gate = models.PositiveSmallIntegerField()
    gate_name = models.CharField(max_length=40)
    severity = models.CharField(max_length=8, choices=SEVERITY_CHOICES)
    packinghouse = models.ForeignKey(
        'Packinghouse', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )
    entity = models.ForeignKey(
        'LegalEntity', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='+',
    )
    season = models.PositiveSmallIntegerField(null=True, blank=True)
    subject = models.CharField(max_length=300, blank=True)
    detail = models.TextField()
    invoice = models.ForeignKey(
        PickHaulInvoice, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='check_results',
        help_text='Set when the finding is about one invoice, so the UI can link to it',
    )

    class Meta:
        ordering = ['-run_at', 'gate']
        indexes = [
            models.Index(fields=['company', '-run_at', 'severity']),
            models.Index(fields=['company', 'season', 'gate']),
        ]

    def __str__(self):
        return f'[{self.severity}] gate {self.gate} {self.gate_name}'
