"""
FSMA Rule 204 Traceability Models

Implements the FDA's "Requirements for Additional Traceability Records for
Certain Foods" (21 CFR Part 1, Subpart S). These models create a thin
coordination layer on top of existing harvest/packinghouse data to provide
lot-level traceability with Critical Tracking Events (CTEs) and
Key Data Elements (KDEs).
"""

from django.db import models
from django.utils import timezone


# =============================================================================
# CONSTANTS
# =============================================================================

LOT_STATUS_CHOICES = [
    ('harvested', 'Harvested'),
    ('in_transit', 'In Transit'),
    ('received', 'Received at Packinghouse'),
    ('processing', 'In Processing'),
    ('packout_complete', 'Packout Complete'),
    ('distributed', 'Distributed'),
    ('recalled', 'Recalled'),
    ('destroyed', 'Destroyed'),
]

CTE_TYPE_CHOICES = [
    ('growing', 'Growing'),
    ('receiving', 'Receiving'),
    ('transforming', 'Transforming'),
    ('creating', 'Creating'),
    ('shipping', 'Shipping'),
]

DISPOSITION_TYPE_CHOICES = [
    ('fresh_market', 'Fresh Market Sales'),
    ('juice_processing', 'Juice/Processing'),
    ('culled', 'Culled/Rejected'),
    ('destroyed', 'Destroyed'),
    ('returned', 'Returned'),
    ('donated', 'Donated'),
    ('other', 'Other'),
]

CONTAMINATION_TYPE_CHOICES = [
    ('pathogen', 'Pathogen Detection (E. coli, Salmonella, Listeria)'),
    ('physical', 'Physical Hazard (Glass, Metal, Foreign Material)'),
    ('chemical', 'Chemical Contamination'),
    ('allergen', 'Allergen Cross-Contact'),
    ('environmental', 'Environmental Hazard'),
    ('other', 'Other'),
]

CONTAMINATION_LOCATION_CHOICES = [
    ('field', 'In Field'),
    ('during_harvest', 'During Harvest'),
    ('in_transit', 'During Transport'),
    ('at_packinghouse', 'At Packinghouse'),
    ('at_retail', 'At Retail/Consumer'),
    ('post_consumption', 'Post-Consumption Report'),
    ('unknown', 'Unknown'),
]

INCIDENT_STATUS_CHOICES = [
    ('open', 'Under Investigation'),
    ('contained', 'Contained'),
    ('resolved', 'Resolved'),
    ('closed', 'Closed'),
]

CORRECTIVE_ACTION_STATUS_CHOICES = [
    ('planned', 'Planned'),
    ('in_progress', 'In Progress'),
    ('completed', 'Completed'),
    ('verified', 'Verified Effective'),
    ('ineffective', 'Verified Ineffective'),
]


# =============================================================================
# TRACEABILITY LOT
# =============================================================================

class TraceabilityLot(models.Model):
    """
    The central "identity card" for a lot through its full supply chain lifecycle.

    Wraps an existing Harvest record with explicit links to all upstream inputs
    (one-step-back) and downstream outputs (one-step-forward) per FDA Rule 204.
    Auto-created when a Harvest record is finalized, or manually for lots
    originating outside the system.
    """
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='traceability_lots'
    )

    # Primary identity
    lot_number = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Traceability Lot Code (TLC) — matches Harvest.lot_number when linked"
    )
    harvest = models.OneToOneField(
        'Harvest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='traceability_lot',
        help_text="Source harvest record (null for externally received lots)"
    )

    # Product description (FDA KDE)
    product_description = models.CharField(
        max_length=200,
        help_text="FDA product description (e.g., 'Fresh Navel Oranges')"
    )
    commodity = models.CharField(
        max_length=50,
        blank=True,
        help_text="Commodity type (e.g., NAVELS, LEMONS)"
    )
    variety = models.CharField(
        max_length=50,
        blank=True,
    )

    # One-step-back: origin
    field = models.ForeignKey(
        'Field',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='traceability_lots'
    )
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='traceability_lots'
    )
    growing_cycle = models.ForeignKey(
        'GrowingCycle',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='traceability_lots'
    )

    # Quantity at origin
    harvest_date = models.DateField(
        null=True,
        blank=True,
    )
    quantity_bins = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    quantity_weight_lbs = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    # Status tracking
    status = models.CharField(
        max_length=20,
        choices=LOT_STATUS_CHOICES,
        default='harvested',
    )

    # Compliance snapshot
    phi_compliant = models.BooleanField(
        null=True,
        blank=True,
        help_text="PHI compliance at time of harvest"
    )
    water_assessment_status = models.CharField(
        max_length=20,
        blank=True,
        help_text="FSMA water assessment status at harvest time"
    )

    # FDA 24-hour response readiness
    fda_response_ready = models.BooleanField(
        default=False,
        help_text="All required KDEs are populated for this lot"
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_traceability_lots',
    )

    class Meta:
        ordering = ['-harvest_date', '-created_at']
        verbose_name = "Traceability Lot"
        verbose_name_plural = "Traceability Lots"
        indexes = [
            models.Index(fields=['company', 'status'], name='idx_trlot_co_status'),
            models.Index(fields=['company', 'harvest_date'], name='idx_trlot_co_date'),
            models.Index(fields=['lot_number'], name='idx_trlot_lot_num'),
        ]

    def __str__(self):
        return f"Lot {self.lot_number} ({self.get_status_display()})"

    @property
    def completeness_score(self):
        """Calculate how complete the traceability record is (0-100)."""
        checks = [
            bool(self.lot_number),
            bool(self.product_description),
            bool(self.field),
            bool(self.harvest_date),
            bool(self.quantity_bins or self.quantity_weight_lbs),
            self.phi_compliant is not None,
            self.events.filter(event_type='growing').exists(),
            self.events.filter(event_type='shipping').exists(),
            self.events.filter(event_type='receiving').exists(),
            self.dispositions.exists(),
        ]
        return int(sum(checks) / len(checks) * 100)


# =============================================================================
# TRACEABILITY EVENT (Critical Tracking Events)
# =============================================================================

class TraceabilityEvent(models.Model):
    """
    A Critical Tracking Event (CTE) in a lot's journey through the supply chain.

    Each event captures the FDA-required Key Data Elements (KDEs) for that
    step: who, what, where, when, and how much.
    """
    lot = models.ForeignKey(
        TraceabilityLot,
        on_delete=models.CASCADE,
        related_name='events'
    )

    event_type = models.CharField(
        max_length=20,
        choices=CTE_TYPE_CHOICES,
    )
    event_date = models.DateTimeField(
        help_text="When this event occurred"
    )

    # Location KDE
    location_name = models.CharField(
        max_length=200,
        help_text="Name of location where event occurred"
    )
    location_address = models.TextField(
        blank=True,
        help_text="Full address of the location"
    )
    location_gps_lat = models.DecimalField(
        max_digits=10, decimal_places=7,
        null=True, blank=True,
    )
    location_gps_lon = models.DecimalField(
        max_digits=10, decimal_places=7,
        null=True, blank=True,
    )

    # Quantity KDE
    quantity_bins = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
    )
    quantity_weight_lbs = models.DecimalField(
        max_digits=12, decimal_places=2,
        null=True, blank=True,
    )
    quantity_unit = models.CharField(
        max_length=20,
        blank=True,
        help_text="Unit of measure (bins, lbs, cartons)"
    )

    # Trading partner KDE
    trading_partner_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Business name of the trading partner"
    )
    trading_partner_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="e.g., Grower, Packinghouse, Distributor, Retailer"
    )

    # Transportation KDE (for shipping/receiving events)
    truck_id = models.CharField(max_length=50, blank=True)
    trailer_id = models.CharField(max_length=50, blank=True)
    driver_name = models.CharField(max_length=200, blank=True)
    seal_number = models.CharField(max_length=50, blank=True)
    temperature_f = models.DecimalField(
        max_digits=5, decimal_places=1,
        null=True, blank=True,
        help_text="Temperature at time of event (°F)"
    )
    departure_time = models.DateTimeField(null=True, blank=True)
    arrival_time = models.DateTimeField(null=True, blank=True)

    # Reference document KDE
    reference_document_type = models.CharField(
        max_length=50,
        blank=True,
        help_text="e.g., BOL, Receiving Ticket, Packout Report"
    )
    reference_document_number = models.CharField(
        max_length=100,
        blank=True,
        help_text="Document number (ticket #, BOL #, etc.)"
    )

    # Links to existing records (optional, for cross-referencing)
    harvest_load = models.ForeignKey(
        'HarvestLoad',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='traceability_events',
    )
    packinghouse_delivery = models.ForeignKey(
        'PackinghouseDelivery',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='traceability_events',
    )
    packout_report = models.ForeignKey(
        'PackoutReport',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='traceability_events',
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_traceability_events',
    )

    class Meta:
        ordering = ['event_date']
        verbose_name = "Traceability Event"
        verbose_name_plural = "Traceability Events"
        indexes = [
            models.Index(fields=['lot', 'event_type'], name='idx_trevt_lot_type'),
            models.Index(fields=['event_date'], name='idx_trevt_date'),
        ]

    def __str__(self):
        return f"{self.get_event_type_display()} — {self.lot.lot_number} @ {self.location_name}"


# =============================================================================
# LOT DISPOSITION
# =============================================================================

class LotDisposition(models.Model):
    """
    Records the final disposition of a lot or portion of a lot.

    A lot may have multiple dispositions if it was split (e.g., 80% fresh
    market, 20% juice). Total disposition quantity should not exceed lot quantity.
    """
    lot = models.ForeignKey(
        TraceabilityLot,
        on_delete=models.CASCADE,
        related_name='dispositions'
    )

    disposition_type = models.CharField(
        max_length=20,
        choices=DISPOSITION_TYPE_CHOICES,
    )
    disposition_date = models.DateField()

    # Quantity disposed
    quantity_bins = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
    )
    quantity_weight_lbs = models.DecimalField(
        max_digits=12, decimal_places=2,
        null=True, blank=True,
    )

    # For sales
    buyer = models.ForeignKey(
        'Buyer',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='lot_dispositions',
    )
    invoice_number = models.CharField(max_length=100, blank=True)

    # For processing/destruction
    processor_name = models.CharField(max_length=200, blank=True)
    method = models.CharField(
        max_length=200,
        blank=True,
        help_text="Processing method or destruction method"
    )
    witnessed_by = models.CharField(max_length=200, blank=True)

    # Documentation
    documentation = models.FileField(
        upload_to='traceability/dispositions/',
        null=True, blank=True,
    )
    approved_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='approved_dispositions',
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_dispositions',
    )

    class Meta:
        ordering = ['-disposition_date']
        verbose_name = "Lot Disposition"
        verbose_name_plural = "Lot Dispositions"
        indexes = [
            models.Index(fields=['lot', 'disposition_type'], name='idx_lotdisp_lot_type'),
        ]

    def __str__(self):
        return f"{self.lot.lot_number} — {self.get_disposition_type_display()} ({self.disposition_date})"


# =============================================================================
# CONTAMINATION INCIDENT
# =============================================================================

class ContaminationIncident(models.Model):
    """
    Tracks contamination incidents linked to one or more traceability lots.
    Supports investigation workflow and links to corrective actions.
    """
    company = models.ForeignKey(
        'Company',
        on_delete=models.CASCADE,
        related_name='contamination_incidents'
    )

    # Affected lots
    lots = models.ManyToManyField(
        TraceabilityLot,
        related_name='contamination_incidents',
        blank=True,
    )

    incident_date = models.DateField()
    reported_date = models.DateField(
        default=timezone.now,
    )

    contamination_type = models.CharField(
        max_length=20,
        choices=CONTAMINATION_TYPE_CHOICES,
    )
    contamination_location = models.CharField(
        max_length=20,
        choices=CONTAMINATION_LOCATION_CHOICES,
    )
    description = models.TextField(
        help_text="Detailed description of the contamination event"
    )

    # Investigation
    status = models.CharField(
        max_length=20,
        choices=INCIDENT_STATUS_CHOICES,
        default='open',
    )
    root_cause = models.TextField(
        blank=True,
        help_text="Root cause analysis findings"
    )
    investigation_notes = models.TextField(blank=True)

    # Recall linkage
    fda_recall_number = models.CharField(
        max_length=100,
        blank=True,
        help_text="FDA recall number if a recall was initiated"
    )
    recall_initiated = models.BooleanField(default=False)
    recall_initiated_date = models.DateField(null=True, blank=True)

    # Resolution
    resolved_date = models.DateField(null=True, blank=True)
    resolution_summary = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='created_incidents',
    )

    class Meta:
        ordering = ['-incident_date']
        verbose_name = "Contamination Incident"
        verbose_name_plural = "Contamination Incidents"
        indexes = [
            models.Index(fields=['company', 'status'], name='idx_contam_co_status'),
            models.Index(fields=['incident_date'], name='idx_contam_date'),
        ]

    def __str__(self):
        return f"Incident {self.pk} — {self.get_contamination_type_display()} ({self.incident_date})"


# =============================================================================
# INCIDENT CORRECTIVE ACTION
# =============================================================================

class IncidentCorrectiveAction(models.Model):
    """
    Corrective actions taken in response to a contamination incident.
    """
    incident = models.ForeignKey(
        ContaminationIncident,
        on_delete=models.CASCADE,
        related_name='corrective_actions'
    )

    action_description = models.TextField(
        help_text="What corrective action is being taken"
    )
    assigned_to = models.CharField(
        max_length=200,
        help_text="Person or team responsible"
    )

    status = models.CharField(
        max_length=20,
        choices=CORRECTIVE_ACTION_STATUS_CHOICES,
        default='planned',
    )

    planned_date = models.DateField(
        help_text="When the action should be completed"
    )
    completed_date = models.DateField(null=True, blank=True)

    # Effectiveness verification
    effectiveness_verified = models.BooleanField(default=False)
    verification_date = models.DateField(null=True, blank=True)
    verification_notes = models.TextField(blank=True)
    verified_by = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='verified_incident_actions',
    )

    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['planned_date']
        verbose_name = "Incident Corrective Action"
        verbose_name_plural = "Incident Corrective Actions"

    def __str__(self):
        return f"CA for Incident #{self.incident_id}: {self.action_description[:50]}"
