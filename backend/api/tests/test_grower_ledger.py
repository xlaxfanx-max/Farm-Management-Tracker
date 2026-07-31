"""Grower ledger entry API: tenancy, pool consistency, credit convention.

The model has no company FK — company rides on the packinghouse — so the
serializer must reject a posted packinghouse from another company (the
read path was always filtered; the create path used to be a hole).
"""

from datetime import date
from decimal import Decimal

from django.test import TestCase

from api.models import GrowerLedgerEntry, Packinghouse, Pool
from api.tests.factories import TestDataFactory


class GrowerLedgerApiTests(TestCase):
    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client_api = self.factory.create_authenticated_client(self.user)
        self.house = Packinghouse.objects.create(
            company=self.company, name='Saticoy Lemon', short_code='SLA',
        )
        self.pool = Pool.objects.create(
            packinghouse=self.house, pool_id='LEM-1', name='Lemon Pool',
            commodity='LEMONS', season='2025-2026',
        )

    def _payload(self, **overrides):
        data = {
            'packinghouse': self.house.pk,
            'pool': self.pool.pk,
            'entry_date': date(2026, 1, 15).isoformat(),
            'entry_type': 'advance',
            'reference': 'CHK-1001',
            'description': 'First advance',
            'credit': '2500.00',
            'debit': '0',
        }
        data.update(overrides)
        return data

    def test_member_can_record_advance(self):
        res = self.client_api.post('/api/grower-ledger/', self._payload(), format='json')
        self.assertEqual(res.status_code, 201, res.content)
        entry = GrowerLedgerEntry.objects.get()
        self.assertEqual(entry.entry_type, 'advance')
        self.assertEqual(entry.credit, Decimal('2500.00'))

    def test_cross_tenant_packinghouse_rejected(self):
        other_company, _ = self.factory.create_company_with_user()
        other_house = Packinghouse.objects.create(
            company=other_company, name='Other House', short_code='OTH',
        )
        res = self.client_api.post(
            '/api/grower-ledger/',
            self._payload(packinghouse=other_house.pk, pool=''),
            format='json',
        )
        self.assertEqual(res.status_code, 400)
        self.assertEqual(GrowerLedgerEntry.objects.count(), 0)

    def test_pool_house_mismatch_rejected(self):
        other_house = Packinghouse.objects.create(
            company=self.company, name='Villa Park', short_code='VPOA',
        )
        other_pool = Pool.objects.create(
            packinghouse=other_house, pool_id='NAV-1', name='Navel Pool',
            commodity='NAVELS', season='2025-2026',
        )
        res = self.client_api.post(
            '/api/grower-ledger/', self._payload(pool=other_pool.pk), format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_cash_types_require_credit(self):
        res = self.client_api.post(
            '/api/grower-ledger/',
            self._payload(credit='0', debit='2500.00'),
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_list_filters_by_pool(self):
        self.client_api.post('/api/grower-ledger/', self._payload(), format='json')
        other_pool = Pool.objects.create(
            packinghouse=self.house, pool_id='LEM-2', name='Second Pool',
            commodity='LEMONS', season='2025-2026',
        )
        self.client_api.post(
            '/api/grower-ledger/',
            self._payload(pool=other_pool.pk, reference='CHK-1002'),
            format='json',
        )
        res = self.client_api.get(f'/api/grower-ledger/?pool={self.pool.pk}')
        payload = res.json()
        rows = payload['results'] if isinstance(payload, dict) and 'results' in payload else payload
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['reference'], 'CHK-1001')

    def test_other_company_sees_nothing(self):
        self.client_api.post('/api/grower-ledger/', self._payload(), format='json')
        _, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)
        res = other_client.get('/api/grower-ledger/')
        payload = res.json()
        rows = payload['results'] if isinstance(payload, dict) and 'results' in payload else payload
        self.assertEqual(len(rows), 0)
