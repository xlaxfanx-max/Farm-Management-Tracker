"""Apply a push bundle from the local pipeline.

The bundle carries only sync-owned data: pulls, receipts, direct charges, and
the local gate findings. There is deliberately no code path from here to
PickHaulInvoice or PickHaulManualPick — those are platform-owned, and a bundle
containing such keys is rejected outright.

Upsert semantics (the reason this is not the block-scoring snapshot pattern —
see api/models/pickhaul.py):

    receipts       upsert on (house, entity, season, receipt_no); is_active
                   taken from the bundle; never deleted
    direct charges insert-if-absent on (house, entity, season, row_hash)
    pulls          insert-if-absent on (house, entity, season, pulled_at, sha256)

Every accepted or rejected bundle is recorded as a PickHaulSyncBatch, so 'why
is the site stale' is answerable from the site.
"""

import hashlib
import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from api.models import (
    PickHaulCheckResult, PickHaulDirectCharge, PickHaulPull, PickHaulReceipt,
    PickHaulSyncBatch,
)
from .checks import run_platform_gates
from .codes import UnknownCode, build_resolvers
from .linking import relink_season
from .reconcile import run_reconciliation

SCHEMA_VERSION = 1
ALLOWED_TOP_LEVEL_KEYS = {'meta', 'pulls', 'receipts', 'direct_charges'}

RECEIPT_FIELDS = (
    'pool', 'block_raw', 'pick_date', 'pick_date_raw', 'pick_time',
    'variety_code', 'commodity_code', 'uom', 'qty', 'uom2', 'qty2',
    'extra_12', 'extra_13', 'bins', 'is_active',
)


class BundleRejected(Exception):
    """The bundle was refused; a rejected batch row records why."""

    def __init__(self, reason, batch=None):
        super().__init__(reason)
        self.reason = reason
        self.batch = batch


def canonical_sha256(payload):
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(',', ':'), default=str).encode()
    ).hexdigest()


# ------------------------------------------------------------------ parsing --

def _date(value):
    if value in (None, ''):
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _datetime(value):
    if value in (None, ''):
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    return parsed


def _dec(value):
    if value in (None, ''):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _text(value, limit):
    return ('' if value is None else str(value))[:limit]


# --------------------------------------------------------------- validation --

def _validate(company, payload):
    """Return (meta, reason). reason is None when the bundle is acceptable.

    Also resolves every house/entity code so the apply phase cannot fail —
    a rejected batch row must be written outside the apply transaction.
    """
    if not isinstance(payload, dict):
        return {}, 'Bundle must be a JSON object.'

    unknown = set(payload) - ALLOWED_TOP_LEVEL_KEYS
    if unknown:
        # Most importantly: 'invoices' / 'manual_picks' can never ride a push.
        return {}, f'Unknown top-level key(s): {", ".join(sorted(unknown))}. ' \
                   f'Push bundles carry only {", ".join(sorted(ALLOWED_TOP_LEVEL_KEYS))}.'

    meta = payload.get('meta') or {}
    if meta.get('schema') != SCHEMA_VERSION:
        return meta, f'Unsupported bundle schema {meta.get("schema")!r} (expected {SCHEMA_VERSION}).'

    season = meta.get('season')
    if not isinstance(season, int):
        return meta, 'meta.season must be an integer.'

    gates = meta.get('gates') or {}
    if gates.get('errors', 0) > 0:
        return meta, (
            f'Local blocking gates failed ({gates["errors"]} error(s)); nothing accepted. '
            f'Fix the local run and push again.'
        )

    counts = meta.get('counts') or {}
    for key, array_key in (('receipts', 'receipts'),
                           ('direct_charges', 'direct_charges'),
                           ('pulls', 'pulls')):
        declared = counts.get(key)
        actual = len(payload.get(array_key) or [])
        if declared is not None and declared != actual:
            return meta, (
                f'meta.counts.{key} says {declared} but the bundle holds {actual} — '
                f'truncated upload?'
            )

    for row in payload.get('receipts') or []:
        if row.get('season') != season:
            return meta, f'Receipt {row.get("receipt_no")!r} has season {row.get("season")}, expected {season}.'
        if not row.get('receipt_no'):
            return meta, 'A receipt row has no receipt_no.'
    for row in payload.get('direct_charges') or []:
        if row.get('season') != season:
            return meta, f'A direct charge has season {row.get("season")}, expected {season}.'
        if not row.get('row_hash'):
            return meta, 'A direct charge row has no row_hash.'
    for row in payload.get('pulls') or []:
        if row.get('season') != season:
            return meta, f'A pull row has season {row.get("season")}, expected {season}.'

    resolve_house, resolve_entity = build_resolvers(company)
    try:
        for array_key in ('receipts', 'direct_charges', 'pulls'):
            for row in payload.get(array_key) or []:
                resolve_house(row.get('house'))
                resolve_entity(row.get('entity'))
    except UnknownCode as exc:
        return meta, str(exc)

    return meta, None


# ------------------------------------------------------------------ upserts --

def _upsert_receipts(company, batch, rows, resolve_house, resolve_entity):
    existing = {
        (r.packinghouse_id, r.entity_id, r.receipt_no): r
        for r in PickHaulReceipt.objects.filter(company=company, season=batch.season)
    }
    stats = {'created': 0, 'updated': 0, 'unchanged': 0,
             'deactivated': 0, 'reactivated': 0}

    for row in rows:
        ph = resolve_house(row.get('house'))
        ent = resolve_entity(row.get('entity'))
        values = {
            'pool': _text(row.get('pool'), 100),
            'block_raw': _text(row.get('block_raw'), 200),
            'pick_date': _date(row.get('pick_date')),
            'pick_date_raw': _text(row.get('pick_date_raw'), 40),
            'pick_time': _text(row.get('pick_time'), 20),
            'variety_code': _text(row.get('variety_code'), 20),
            'commodity_code': _text(row.get('commodity_code'), 20),
            'uom': _text(row.get('uom'), 20),
            'qty': _dec(row.get('qty')),
            'uom2': _text(row.get('uom2'), 20),
            'qty2': _dec(row.get('qty2')),
            'extra_12': _text(row.get('extra_12'), 100),
            'extra_13': _text(row.get('extra_13'), 100),
            'bins': _dec(row.get('bins')),
            'is_active': bool(row.get('is_active', True)),
        }

        key = (ph.pk, ent.pk, str(row['receipt_no']))
        current = existing.get(key)
        if current is None:
            PickHaulReceipt.objects.create(
                company=company, packinghouse=ph, entity=ent,
                season=batch.season, receipt_no=str(row['receipt_no']),
                first_seen_batch=batch, last_seen_batch=batch, **values,
            )
            stats['created'] += 1
            continue

        changed = [f for f in RECEIPT_FIELDS if getattr(current, f) != values[f]]
        if changed:
            if 'is_active' in changed:
                stats['deactivated' if not values['is_active'] else 'reactivated'] += 1
            for f in changed:
                setattr(current, f, values[f])
            current.last_seen_batch = batch
            current.save(update_fields=changed + ['last_seen_batch', 'updated_at'])
            stats['updated'] += 1
        else:
            PickHaulReceipt.objects.filter(pk=current.pk).update(last_seen_batch=batch)
            stats['unchanged'] += 1
    return stats


def _insert_charges(company, batch, rows, resolve_house, resolve_entity):
    existing = set(
        PickHaulDirectCharge.objects.filter(company=company, season=batch.season)
        .values_list('packinghouse_id', 'entity_id', 'row_hash')
    )
    stats = {'created': 0, 'existing': 0}
    for row in rows:
        ph = resolve_house(row.get('house'))
        ent = resolve_entity(row.get('entity'))
        key = (ph.pk, ent.pk, str(row['row_hash']))
        if key in existing:
            stats['existing'] += 1
            continue
        PickHaulDirectCharge.objects.create(
            company=company, packinghouse=ph, entity=ent, season=batch.season,
            pool=_text(row.get('pool'), 100),
            block_raw=_text(row.get('block_raw'), 200),
            charge_date=_date(row.get('charge_date')),
            charge_date_raw=_text(row.get('charge_date_raw'), 40),
            charge_desc=_text(row.get('charge_desc'), 100),
            kind=row.get('kind') or 'OTHER',
            txn_desc=_text(row.get('txn_desc'), 200),
            ap_reference=_text(row.get('ap_reference'), 50),
            debit=_dec(row.get('debit')),
            credit=_dec(row.get('credit')),
            qty=_dec(row.get('qty')),
            uom=_text(row.get('uom'), 20),
            per_unit=_dec(row.get('per_unit')),
            row_hash=str(row['row_hash']),
            first_seen_batch=batch,
        )
        existing.add(key)
        stats['created'] += 1
    return stats


def _insert_pulls(company, batch, rows, resolve_house, resolve_entity):
    stats = {'created': 0, 'existing': 0}
    for row in rows:
        ph = resolve_house(row.get('house'))
        ent = resolve_entity(row.get('entity'))
        _, created = PickHaulPull.objects.get_or_create(
            packinghouse=ph, entity=ent, season=batch.season,
            pulled_at=_datetime(row.get('pulled_at')) or batch.received_at or timezone.now(),
            sha256=_text(row.get('sha256'), 64),
            defaults={
                'company': company, 'batch': batch,
                'file_name': _text(row.get('file_name'), 255),
                'header_text': _text(row.get('header_text'), 300),
                'header_year': row.get('header_year'),
                'row_count': row.get('row_count'),
                'status': _text(row.get('status'), 20) or 'ok',
                'note': str(row.get('note') or ''),
            },
        )
        stats['created' if created else 'existing'] += 1
    return stats


def _record_local_checks(company, batch, meta, resolve_house, resolve_entity):
    """Replace the local-origin findings with this bundle's.

    Local findings describe the current pull; like platform findings they are
    current-state, and the batch history keeps the trail.
    """
    PickHaulCheckResult.objects.filter(
        company=company, season=batch.season, origin='local',
    ).delete()
    results = (meta.get('gates') or {}).get('results') or []
    run_at = _datetime(meta.get('generated_at')) or timezone.now()
    rows = []
    for f in results:
        ph = ent = None
        try:
            if f.get('house'):
                ph = resolve_house(f['house'])
            if f.get('entity'):
                ent = resolve_entity(f['entity'])
        except UnknownCode:
            pass  # a finding about an unknown account is still worth recording
        rows.append(PickHaulCheckResult(
            company=company, batch=batch, run_at=run_at, origin='local',
            gate=f.get('gate') or 0, gate_name=_text(f.get('gate_name'), 40),
            severity=f.get('severity') or 'info',
            packinghouse=ph, entity=ent, season=batch.season,
            subject=_text(f.get('subject'), 300),
            detail=str(f.get('detail') or ''),
        ))
    PickHaulCheckResult.objects.bulk_create(rows)
    return len(rows)


# -------------------------------------------------------------------- apply --

def apply_bundle(company, payload, token=None, kind='push'):
    """Validate and apply one bundle. Returns the response body dict.

    Raises BundleRejected (with the rejected batch recorded) on refusal.
    """
    meta, reason = _validate(company, payload)
    gates = meta.get('gates') or {}

    def _record(status, **extra):
        return PickHaulSyncBatch.objects.create(
            company=company, season=meta.get('season') or 0,
            schema_version=meta.get('schema') or 0, kind=kind,
            generated_at=_datetime(meta.get('generated_at')),
            bundle_sha256=canonical_sha256(payload),
            config_sha256=_text(meta.get('config_sha256'), 64),
            source_label=_text(
                f"{meta.get('source') or ''} @ {meta.get('machine') or ''}".strip(' @'), 100),
            gate_errors=gates.get('errors', 0), gate_warns=gates.get('warns', 0),
            counts=meta.get('counts') or {}, token=token, status=status, **extra,
        )

    if reason:
        batch = _record('rejected', reject_reason=reason)
        raise BundleRejected(reason, batch=batch)

    sha = canonical_sha256(payload)
    original = PickHaulSyncBatch.objects.filter(
        company=company, bundle_sha256=sha, status='applied',
    ).order_by('-received_at').first()
    if original:
        _record('duplicate', result={'original_batch_id': original.pk})
        return {
            'batch_id': original.pk, 'duplicate': True,
            'season': original.season, 'result': original.result,
        }

    with transaction.atomic():
        # Codes were fully resolved during validation; nothing here can fail
        # on bundle content, so a rejected batch is always recorded outside
        # this transaction.
        resolve_house, resolve_entity = build_resolvers(company)
        batch = _record('applied')
        applied = {
            'receipts': _upsert_receipts(
                company, batch, payload.get('receipts') or [],
                resolve_house, resolve_entity),
            'direct_charges': _insert_charges(
                company, batch, payload.get('direct_charges') or [],
                resolve_house, resolve_entity),
            'pulls': _insert_pulls(
                company, batch, payload.get('pulls') or [],
                resolve_house, resolve_entity),
        }
        applied['local_checks_recorded'] = _record_local_checks(
            company, batch, meta, resolve_house, resolve_entity)

        relink_season(company, batch.season)
        reconciliation = run_reconciliation(company, batch.season)
        platform_gates = run_platform_gates(company, batch.season, batch=batch)

        result = {
            'applied': applied,
            'reconciliation': {
                'invoices': reconciliation['invoices'],
                'matched': reconciliation['matched'],
                'unmatched': reconciliation['unmatched'],
                'method_counts': reconciliation['method_counts'],
                'disagreements': reconciliation['disagreements'],
            },
            'platform_gates': platform_gates,
        }
        batch.result = result
        batch.save(update_fields=['result'])

    return {'batch_id': batch.pk, 'duplicate': False, 'season': batch.season, **result}
