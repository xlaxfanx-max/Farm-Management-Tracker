"""Serializers for the pick & haul module.

The one rule that matters here: the derived invoice columns (charge_posted,
ap_reference, match_method) and the provenance columns (source, conflict_fields,
amount_formula) are read-only. They are owned by the reconciliation service and
the seed respectively; a PATCH naming them is ignored, per DRF convention.
"""

from datetime import date
from decimal import Decimal

from rest_framework import serializers

from .models import (
    LegalEntity, Packinghouse,
    PickHaulCheckResult, PickHaulDirectCharge, PickHaulInvoice,
    PickHaulManualPick, PickHaulReceipt, PickHaulSyncBatch,
)


class PickHaulReceiptSerializer(serializers.ModelSerializer):
    house_name = serializers.CharField(source='packinghouse.name', read_only=True)
    house_code = serializers.CharField(source='packinghouse.short_code', read_only=True)
    entity_name = serializers.CharField(source='entity.name', read_only=True)
    entity_code = serializers.CharField(source='entity.short_code', read_only=True)
    covered = serializers.SerializerMethodField()

    class Meta:
        model = PickHaulReceipt
        fields = [
            'id', 'packinghouse', 'house_name', 'house_code',
            'entity', 'entity_name', 'entity_code',
            'season', 'receipt_no', 'pool', 'block_raw',
            'pick_date', 'pick_date_raw', 'pick_time',
            'variety_code', 'commodity_code', 'uom', 'qty', 'uom2', 'qty2',
            'bins', 'is_active', 'field',
            'first_seen_batch', 'last_seen_batch', 'updated_at', 'covered',
        ]
        read_only_fields = fields

    def get_covered(self, obj):
        annotated = getattr(obj, 'covered_annotated', None)
        if annotated is not None:
            return bool(annotated)
        return obj.invoice_links.filter(invoice__kind='PICK').exists()


class PickHaulDirectChargeSerializer(serializers.ModelSerializer):
    house_name = serializers.CharField(source='packinghouse.name', read_only=True)
    house_code = serializers.CharField(source='packinghouse.short_code', read_only=True)
    entity_name = serializers.CharField(source='entity.name', read_only=True)
    entity_code = serializers.CharField(source='entity.short_code', read_only=True)
    matched_invoice_id = serializers.SerializerMethodField()
    acked = serializers.SerializerMethodField()
    ack_reason = serializers.SerializerMethodField()
    ack_note = serializers.SerializerMethodField()

    class Meta:
        model = PickHaulDirectCharge
        fields = [
            'id', 'packinghouse', 'house_name', 'house_code',
            'entity', 'entity_name', 'entity_code',
            'season', 'pool', 'block_raw', 'charge_date', 'charge_date_raw',
            'charge_desc', 'kind', 'txn_desc', 'ap_reference',
            'debit', 'credit', 'qty', 'uom', 'per_unit',
            'matched_invoice_id', 'acked', 'ack_reason', 'ack_note',
        ]
        read_only_fields = fields

    def get_matched_invoice_id(self, obj):
        match = getattr(obj, 'match', None)
        return match.invoice_id if match else None

    def get_acked(self, obj):
        return getattr(obj, 'ack', None) is not None

    def get_ack_reason(self, obj):
        ack = getattr(obj, 'ack', None)
        return ack.reason if ack else None

    def get_ack_note(self, obj):
        ack = getattr(obj, 'ack', None)
        return ack.note if ack else None


class _LinkedReceiptSerializer(serializers.ModelSerializer):
    """Minimal receipt rows shown inside an invoice detail."""

    class Meta:
        model = PickHaulReceipt
        fields = ['id', 'receipt_no', 'pick_date', 'block_raw', 'bins']
        read_only_fields = fields


class PickHaulInvoiceSerializer(serializers.ModelSerializer):
    house_name = serializers.CharField(source='packinghouse.name', read_only=True)
    house_code = serializers.CharField(source='packinghouse.short_code', read_only=True)
    entity_name = serializers.CharField(source='entity.name', read_only=True)
    entity_code = serializers.CharField(source='entity.short_code', read_only=True)
    matched_charges = serializers.SerializerMethodField()
    matched_receipts = serializers.SerializerMethodField()
    days_outstanding = serializers.SerializerMethodField()

    class Meta:
        model = PickHaulInvoice
        fields = [
            'id', 'packinghouse', 'house_name', 'house_code',
            'entity', 'entity_name', 'entity_code',
            'season', 'kind', 'contractor', 'invoice_no', 'amount', 'block_raw',
            'billing', 'date_from', 'date_to', 'date_paid', 'date_emailed',
            'date_rec_from_ph',
            # -- derived / provenance: read-only --
            'charge_posted', 'ap_reference', 'match_method',
            'amount_formula', 'conflict_fields', 'source',
            # --
            'notes', 'matched_charges', 'matched_receipts', 'days_outstanding',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'charge_posted', 'ap_reference', 'match_method',
            'amount_formula', 'conflict_fields', 'source',
            'created_at', 'updated_at',
        ]

    def get_matched_charges(self, obj):
        return [
            {
                'id': m.charge_id,
                'ap_reference': m.charge.ap_reference,
                'charge_date': m.charge.charge_date,
                'kind': m.charge.kind,
                'debit': m.charge.debit,
                'method': m.method,
            }
            for m in obj.charge_matches.select_related('charge')
        ]

    def get_matched_receipts(self, obj):
        links = obj.receipt_links.select_related('receipt')
        return _LinkedReceiptSerializer([l.receipt for l in links], many=True).data

    def get_days_outstanding(self, obj):
        if obj.date_emailed is None or obj.charge_posted is not None:
            return None
        return (date.today() - obj.date_emailed).days

    def validate(self, attrs):
        """Friendly 400 for the NULL-safe identity constraint.

        The DB constraint is the backstop; this produces a readable message
        instead of an IntegrityError 500. Empty strings normalise to NULL so
        '' and 'not recorded' cannot make two spellings of the same invoice.
        """
        for f in ('contractor', 'invoice_no'):
            if f in attrs:
                attrs[f] = attrs[f] or None

        def value(field, default=None):
            if field in attrs:
                return attrs[field]
            return getattr(self.instance, field, default) if self.instance else default

        qs = PickHaulInvoice.objects.filter(
            packinghouse=value('packinghouse'),
            entity=value('entity'),
            season=value('season'),
            kind=value('kind'),
            contractor=value('contractor'),
            invoice_no=value('invoice_no'),
            amount=value('amount'),
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'This invoice already exists: same house, entity, season, kind, '
                'contractor, invoice number, and amount.'
            )
        return attrs


class PickHaulManualPickSerializer(serializers.ModelSerializer):
    house_name = serializers.CharField(source='packinghouse.name', read_only=True)
    house_code = serializers.CharField(source='packinghouse.short_code', read_only=True)
    entity_name = serializers.CharField(source='entity.name', read_only=True)
    entity_code = serializers.CharField(source='entity.short_code', read_only=True)

    class Meta:
        model = PickHaulManualPick
        fields = [
            'id', 'packinghouse', 'house_name', 'house_code',
            'entity', 'entity_name', 'entity_code',
            'season', 'sheet', 'ranch', 'block', 'varietal',
            'pick_date', 'date_label', 'bins', 'lbs',
            'harvester', 'hauler', 'invoice_no', 'cost', 'haul_cost',
            'date_paid', 'packing_house_text', 'net_amount', 'date_received',
            'po_received', 'notes', 'row_no', 'count_cost', 'count_haul',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PickHaulCheckResultSerializer(serializers.ModelSerializer):
    house_code = serializers.CharField(source='packinghouse.short_code', read_only=True, default=None)
    entity_code = serializers.CharField(source='entity.short_code', read_only=True, default=None)

    class Meta:
        model = PickHaulCheckResult
        fields = [
            'id', 'run_at', 'origin', 'gate', 'gate_name', 'severity',
            'packinghouse', 'house_code', 'entity', 'entity_code',
            'season', 'subject', 'detail', 'invoice',
        ]
        read_only_fields = fields


class PickHaulSyncBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = PickHaulSyncBatch
        fields = [
            'id', 'received_at', 'season', 'schema_version', 'kind',
            'generated_at', 'bundle_sha256', 'config_sha256', 'source_label',
            'gate_errors', 'gate_warns', 'counts', 'result',
            'status', 'reject_reason',
        ]
        read_only_fields = fields
