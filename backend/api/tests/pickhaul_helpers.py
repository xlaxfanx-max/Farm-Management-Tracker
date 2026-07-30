"""Shared fixtures for the pick & haul tests.

Sets up the real permission wiring (setup_roles) so HasPermission is tested
against the actual role definitions, not stand-ins.
"""

from datetime import date
from decimal import Decimal
from io import StringIO

from django.core.management import call_command

from api.models import (
    CompanyMembership, LegalEntity, Packinghouse,
    PickHaulDirectCharge, PickHaulInvoice, PickHaulReceipt, Role,
)
from api.tests.factories import TestDataFactory

SEASON = 2026


class PickHaulScenario:
    """A company with the two portal houses, two entities, and role wiring."""

    def __init__(self):
        self.factory = TestDataFactory()
        call_command('setup_roles', stdout=StringIO())
        self.company, self.owner = self.factory.create_company_with_user()
        # setup_roles ran after the factory's bare Role creation in some
        # orders; re-point the owner membership at the fully-wired role.
        owner_role = Role.objects.get(codename='owner')
        CompanyMembership.objects.filter(user=self.owner, company=self.company).update(
            role=owner_role
        )

        self.sla = Packinghouse.objects.create(
            company=self.company, name='Saticoy Lemon Association', short_code='SLA',
        )
        self.vpoa = Packinghouse.objects.create(
            company=self.company, name='Villa Park Orchards Association', short_code='VPOA',
        )
        self.jpf = LegalEntity.objects.create(
            company=self.company, name='James P. Finch Trust', short_code='JPF',
        )
        self.ffllc = LegalEntity.objects.create(
            company=self.company, name='Finch Farms LLC', short_code='FFLLC',
        )

    def member(self, role_codename):
        """A user in the company with the given (setup_roles-wired) role."""
        user = self.factory.create_user(company=self.company)
        role = Role.objects.get(codename=role_codename)
        CompanyMembership.objects.create(
            user=user, company=self.company, role=role, is_active=True,
        )
        return user

    # ------------------------------------------------------------- rows -----
    def receipt(self, receipt_no, pick_date=None, block='SESPE', bins='20.5',
                house=None, entity=None, **kwargs):
        return PickHaulReceipt.objects.create(
            company=self.company,
            packinghouse=house or self.sla, entity=entity or self.jpf,
            season=SEASON, receipt_no=str(receipt_no),
            pick_date=pick_date or date(2026, 4, 12),
            block_raw=block, bins=Decimal(bins), **kwargs,
        )

    def charge(self, debit, kind='PICK', ap_reference='APM-SL-00500',
               charge_date=None, block='', row_hash=None, house=None, entity=None,
               **kwargs):
        n = PickHaulDirectCharge.objects.count() + 1
        return PickHaulDirectCharge.objects.create(
            company=self.company,
            packinghouse=house or self.sla, entity=entity or self.jpf,
            season=SEASON, kind=kind, ap_reference=ap_reference,
            charge_date=charge_date or date(2026, 4, 20),
            block_raw=block, debit=Decimal(str(debit)),
            row_hash=row_hash or f'hash{n:04d}', **kwargs,
        )

    def invoice(self, amount, kind='PICK', contractor='Magana', invoice_no=None,
                block='', date_from=None, date_to=None, house=None, entity=None,
                **kwargs):
        n = PickHaulInvoice.objects.count() + 1
        return PickHaulInvoice.objects.create(
            company=self.company,
            packinghouse=house or self.sla, entity=entity or self.jpf,
            season=SEASON, kind=kind, contractor=contractor,
            invoice_no=invoice_no or str(88000 + n),
            amount=Decimal(str(amount)) if amount is not None else None,
            block_raw=block,
            date_from=date_from or date(2026, 4, 10),
            date_to=date_to or date(2026, 4, 15),
            **kwargs,
        )


def make_bundle(season=SEASON, receipts=(), charges=(), pulls=(),
                gates=None, **meta_overrides):
    """A well-formed push bundle with overridable parts."""
    receipts = list(receipts)
    charges = list(charges)
    pulls = list(pulls)
    meta = {
        'schema': 1,
        'source': 'pickhaul-local',
        'machine': 'TEST-MACHINE',
        'generated_at': '2026-07-30T06:05:00',
        'season': season,
        'config_sha256': 'c' * 64,
        'counts': {
            'receipts': len(receipts),
            'direct_charges': len(charges),
            'pulls': len(pulls),
        },
        'gates': gates or {'errors': 0, 'warns': 0, 'infos': 0, 'results': []},
    }
    meta.update(meta_overrides)
    return {'meta': meta, 'pulls': pulls, 'receipts': receipts,
            'direct_charges': charges}


def bundle_receipt(receipt_no, house='SLA', entity='JPF', season=SEASON, **kwargs):
    row = {
        'house': house, 'entity': entity, 'season': season,
        'receipt_no': str(receipt_no), 'pool': 'LEM2026',
        'block_raw': 'SESPE', 'pick_date': '2026-04-12', 'pick_date_raw': None,
        'pick_time': '07:31:00', 'variety_code': 'L', 'commodity_code': 'LEM',
        'uom': 'BINS', 'qty': 20.5, 'uom2': None, 'qty2': None,
        'extra_12': None, 'extra_13': None, 'bins': 20.5, 'is_active': True,
    }
    row.update(kwargs)
    return row


def bundle_charge(row_hash, house='SLA', entity='JPF', season=SEASON, **kwargs):
    row = {
        'house': house, 'entity': entity, 'season': season,
        'pool': 'LEM2026', 'block_raw': '', 'charge_date': '2026-04-20',
        'charge_desc': 'PICKING CHARGES', 'kind': 'PICK', 'txn_desc': '',
        'ap_reference': 'APM-SL-00500', 'debit': 1234.56, 'credit': None,
        'qty': 10.0, 'uom': 'BINS', 'per_unit': 123.46, 'row_hash': row_hash,
    }
    row.update(kwargs)
    return row


def bundle_pull(house='SLA', entity='JPF', season=SEASON, **kwargs):
    row = {
        'pulled_at': '2026-07-30T06:00:00', 'house': house, 'entity': entity,
        'season': season, 'file_name': 'Receiving SLA JPF Spokane Data.xlsx',
        'sha256': 'a' * 64, 'header_text': f'Commodity Receipts for TEST ({season})',
        'header_year': season, 'row_count': 1, 'status': 'ok', 'note': None,
    }
    row.update(kwargs)
    return row
