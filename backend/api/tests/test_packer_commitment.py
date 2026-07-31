"""Packer commitments: the season plan (commodity default + block override)."""

from django.test import TestCase

from api.models import PackerCommitment, Packinghouse
from api.tests.factories import TestDataFactory

SEASON = 2026


class PackerCommitmentApiTests(TestCase):
    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client_api = self.factory.create_authenticated_client(self.user)
        self.house = Packinghouse.objects.create(
            company=self.company, name='Saticoy Lemon', short_code='SLA',
        )
        self.farm = self.factory.create_farm(self.company)
        self.field = self.factory.create_field(self.farm)

    def _payload(self, **overrides):
        data = {
            'season': SEASON,
            'commodity': 'LEMONS',
            'packinghouse': self.house.pk,
            'flex': False,
            'notes': '',
        }
        data.update(overrides)
        return data

    def _rows(self, res):
        payload = res.json()
        return payload['results'] if isinstance(payload, dict) and 'results' in payload else payload

    def test_create_default_commitment(self):
        res = self.client_api.post('/api/packer-commitments/', self._payload(), format='json')
        self.assertEqual(res.status_code, 201, res.content)
        c = PackerCommitment.objects.get()
        self.assertEqual(c.company, self.company)
        self.assertEqual(c.commodity, 'LEMONS')
        self.assertIsNone(c.field)
        self.assertEqual(res.json()['season_label'], '2025-2026')

    def test_commodity_is_normalized(self):
        res = self.client_api.post(
            '/api/packer-commitments/', self._payload(commodity='HASS'), format='json',
        )
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()['commodity'], 'AVOCADOS')

    def test_duplicate_default_rejected(self):
        self.client_api.post('/api/packer-commitments/', self._payload(), format='json')
        res = self.client_api.post('/api/packer-commitments/', self._payload(), format='json')
        self.assertEqual(res.status_code, 400)

    def test_block_override_allowed_alongside_default(self):
        self.client_api.post('/api/packer-commitments/', self._payload(), format='json')
        res = self.client_api.post(
            '/api/packer-commitments/', self._payload(field=self.field.pk), format='json',
        )
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(PackerCommitment.objects.count(), 2)

    def test_duplicate_block_override_rejected(self):
        self.client_api.post(
            '/api/packer-commitments/', self._payload(field=self.field.pk), format='json',
        )
        res = self.client_api.post(
            '/api/packer-commitments/', self._payload(field=self.field.pk), format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_cross_company_field_rejected(self):
        other_company, _ = self.factory.create_company_with_user()
        other_farm = self.factory.create_farm(other_company)
        other_field = self.factory.create_field(other_farm)
        res = self.client_api.post(
            '/api/packer-commitments/', self._payload(field=other_field.pk), format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_cross_company_packinghouse_rejected(self):
        other_company, _ = self.factory.create_company_with_user()
        other_house = Packinghouse.objects.create(
            company=other_company, name='Other', short_code='OTH',
        )
        res = self.client_api.post(
            '/api/packer-commitments/', self._payload(packinghouse=other_house.pk),
            format='json',
        )
        self.assertEqual(res.status_code, 400)

    def test_season_filter(self):
        self.client_api.post('/api/packer-commitments/', self._payload(), format='json')
        self.client_api.post(
            '/api/packer-commitments/', self._payload(season=2025), format='json',
        )
        res = self.client_api.get(f'/api/packer-commitments/?season={SEASON}')
        rows = self._rows(res)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['season'], SEASON)

    def test_other_company_sees_nothing(self):
        self.client_api.post('/api/packer-commitments/', self._payload(), format='json')
        _, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)
        res = other_client.get('/api/packer-commitments/')
        self.assertEqual(len(self._rows(res)), 0)
