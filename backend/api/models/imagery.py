from django.db import models
from django.utils import timezone


# =============================================================================
# QUARANTINE STATUS MODEL
# =============================================================================

class QuarantineStatus(models.Model):
    """
    Caches quarantine status results from CDFA API queries.
    Used to track whether farms/fields fall within HLB quarantine zones.

    One of farm or field must be set (not both, not neither).
    """

    QUARANTINE_TYPE_CHOICES = [
        ('HLB', 'Huanglongbing (Citrus Greening)'),
        ('ACP_BULK', 'Asian Citrus Psyllid Bulk Citrus'),
    ]

    # Link to either Farm or Field (one must be set)
    farm = models.ForeignKey(
        'Farm',
        on_delete=models.CASCADE,
        related_name='quarantine_statuses',
        null=True,
        blank=True,
        help_text="Farm being checked for quarantine status"
    )
    field = models.ForeignKey(
        'Field',
        on_delete=models.CASCADE,
        related_name='quarantine_statuses',
        null=True,
        blank=True,
        help_text="Field being checked for quarantine status"
    )

    # Quarantine type being checked
    quarantine_type = models.CharField(
        max_length=20,
        choices=QUARANTINE_TYPE_CHOICES,
        default='HLB',
        help_text="Type of quarantine check"
    )

    # Status result
    in_quarantine = models.BooleanField(
        null=True,
        blank=True,
        help_text="True if in quarantine, False if not, null if unknown/error"
    )
    zone_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of the quarantine zone if applicable"
    )

    # Tracking timestamps
    last_checked = models.DateTimeField(
        auto_now=True,
        help_text="When the status was last checked"
    )
    last_changed = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the quarantine status actually changed"
    )

    # Coordinates used for the check (cached for reference)
    check_latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        help_text="Latitude used for the check"
    )
    check_longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        null=True,
        blank=True,
        help_text="Longitude used for the check"
    )

    # Raw API response for debugging
    raw_response = models.JSONField(
        null=True,
        blank=True,
        help_text="Raw response from CDFA API for debugging"
    )

    # Error tracking
    error_message = models.TextField(
        blank=True,
        help_text="Error message if the check failed"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Quarantine Status"
        verbose_name_plural = "Quarantine Statuses"
        ordering = ['-last_checked']
        indexes = [
            models.Index(fields=['farm', 'quarantine_type']),
            models.Index(fields=['field', 'quarantine_type']),
            models.Index(fields=['last_checked']),
        ]
        # Ensure only one record per farm+type or field+type combination
        constraints = [
            models.UniqueConstraint(
                fields=['farm', 'quarantine_type'],
                condition=models.Q(farm__isnull=False),
                name='unique_farm_quarantine_type'
            ),
            models.UniqueConstraint(
                fields=['field', 'quarantine_type'],
                condition=models.Q(field__isnull=False),
                name='unique_field_quarantine_type'
            ),
        ]

    def __str__(self):
        target = self.farm.name if self.farm else (self.field.name if self.field else "Unknown")
        status = "In Quarantine" if self.in_quarantine else "Clear" if self.in_quarantine is False else "Unknown"
        return f"{target} - {self.get_quarantine_type_display()}: {status}"

    def clean(self):
        """Validate that exactly one of farm or field is set."""
        from django.core.exceptions import ValidationError

        if self.farm and self.field:
            raise ValidationError("Cannot set both farm and field. Choose one.")
        if not self.farm and not self.field:
            raise ValidationError("Must set either farm or field.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def target_name(self):
        """Get the name of the farm or field being checked."""
        if self.farm:
            return self.farm.name
        elif self.field:
            return self.field.name
        return "Unknown"

    @property
    def target_type(self):
        """Get whether this is a farm or field check."""
        if self.farm:
            return "farm"
        elif self.field:
            return "field"
        return "unknown"

    @property
    def is_stale(self):
        """Check if the status is older than 24 hours."""
        from datetime import timedelta
        return timezone.now() - self.last_checked > timedelta(hours=24)

    @property
    def status_display(self):
        """Human-readable status."""
        if self.error_message:
            return "Error"
        if self.in_quarantine is None:
            return "Unknown"
        return "In Quarantine" if self.in_quarantine else "Clear"

    def get_company(self):
        """Get the company that owns this status (for RLS)."""
        if self.farm:
            return self.farm.company
        elif self.field and self.field.farm:
            return self.field.farm.company
        return None
