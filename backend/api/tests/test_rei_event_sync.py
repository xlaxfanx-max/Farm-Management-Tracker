"""
REI posting sync for tank-mix ApplicationEvents.

Sprays recorded through the modern ApplicationEvent flow must produce
REIPostingRecords so the dashboard ticker and REI alerts see them —
previously only legacy PesticideApplication records did.
"""

from datetime import timedelta

from django.utils import timezone

from django.test import TestCase

from api.models import ApplicationEvent, Product, REIPostingRecord, TankMixItem
from api.tests.factories import TestDataFactory


class EventREISyncBase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.factory = TestDataFactory()
        cls.company, cls.user = cls.factory.create_company_with_user()
        cls.client_api = None  # created per-test; APIClient is not shareable
        cls.farm = cls.factory.create_farm(cls.company)
        cls.field = cls.factory.create_field(cls.farm)
        cls.product_rei = Product.objects.create(
            product_name='ReiSpray 24',
            product_type='pesticide',
            rei_hours=24,
            phi_days=7,
        )
        cls.product_no_rei = Product.objects.create(
            product_name='GentleFoliar',
            product_type='fertilizer',
        )

    def setUp(self):
        self.client_api = self.factory.create_authenticated_client(self.user)

    def _event_payload(self, product, date_started=None, field=None):
        return {
            'farm': self.farm.id,
            'field': (field or self.field).id,
            'date_started': (date_started or timezone.now()).isoformat(),
            'treated_area_acres': '5.00',
            'application_method': 'ground',
            'tank_mix_items': [{
                'product': product.id,
                'total_amount': '10.000',
                'amount_unit': 'Ga',
                'rate': '2.000',
                'rate_unit': 'Ga/A',
            }],
        }


class EventREICreationTests(EventREISyncBase):
    def test_event_with_rei_product_creates_posting(self):
        response = self.client_api.post(
            '/api/application-events/',
            self._event_payload(self.product_rei),
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)

        event = ApplicationEvent.objects.get(id=response.data['id'])
        self.assertEqual(float(event.rei_hours), 24.0)
        self.assertEqual(event.phi_days, 7)

        posting = REIPostingRecord.objects.get(event=event)
        self.assertIsNone(posting.application)
        self.assertEqual(posting.rei_hours, 24)
        self.assertEqual(
            posting.rei_end_datetime,
            event.date_started + timedelta(hours=24),
        )

    def test_event_without_rei_product_creates_no_posting(self):
        response = self.client_api.post(
            '/api/application-events/',
            self._event_payload(self.product_no_rei),
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertFalse(
            REIPostingRecord.objects.filter(event_id=response.data['id']).exists()
        )

    def test_historical_event_creates_no_posting(self):
        """PDF imports of old records must not flood the alert stream."""
        old_start = timezone.now() - timedelta(days=90)
        response = self.client_api.post(
            '/api/application-events/',
            self._event_payload(self.product_rei, date_started=old_start),
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertFalse(
            REIPostingRecord.objects.filter(event_id=response.data['id']).exists()
        )

    def test_update_reschedules_posting(self):
        response = self.client_api.post(
            '/api/application-events/',
            self._event_payload(self.product_rei),
            format='json',
        )
        event_id = response.data['id']

        new_start = timezone.now() + timedelta(days=1)
        payload = self._event_payload(self.product_rei, date_started=new_start)
        response = self.client_api.put(
            f'/api/application-events/{event_id}/', payload, format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)

        posting = REIPostingRecord.objects.get(event_id=event_id)
        event = ApplicationEvent.objects.get(id=event_id)
        self.assertEqual(
            posting.rei_end_datetime,
            event.date_started + timedelta(hours=24),
        )


class ActiveREIEndpointTests(EventREISyncBase):
    def _create_event_with_rei(self):
        response = self.client_api.post(
            '/api/application-events/',
            self._event_payload(self.product_rei),
            format='json',
        )
        assert response.status_code == 201, response.content
        return response.data['id']

    def test_active_feed_includes_event_posting(self):
        event_id = self._create_event_with_rei()
        response = self.client_api.get('/api/compliance/rei-postings/active/')
        self.assertEqual(response.status_code, 200)

        entries = response.data
        self.assertEqual(len(entries), 1)
        entry = entries[0]
        self.assertEqual(entry['event'], event_id)
        self.assertEqual(entry['field_name'], self.field.name)
        self.assertEqual(entry['product_name'], 'ReiSpray 24')
        self.assertGreater(entry['time_remaining_seconds'], 0)

    def test_mark_removed_clears_event_posting(self):
        event_id = self._create_event_with_rei()
        posting = REIPostingRecord.objects.get(event_id=event_id)

        response = self.client_api.post(
            f'/api/compliance/rei-postings/{posting.id}/mark_removed/'
        )
        self.assertEqual(response.status_code, 200, response.content)

        posting.refresh_from_db()
        self.assertIsNotNone(posting.removed_at)

        # Removed postings drop out of the active feed
        response = self.client_api.get('/api/compliance/rei-postings/active/')
        self.assertEqual(len(response.data), 0)

    def test_other_company_cannot_see_event_posting(self):
        self._create_event_with_rei()
        _, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get('/api/compliance/rei-postings/active/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)


class MultiProductREITests(EventREISyncBase):
    def test_max_rei_across_tank_mix_wins(self):
        product_48 = Product.objects.create(
            product_name='StrongSpray 48',
            product_type='pesticide',
            rei_hours=48,
            phi_days=14,
        )
        payload = self._event_payload(self.product_rei)
        payload['tank_mix_items'].append({
            'product': product_48.id,
            'total_amount': '5.000',
            'amount_unit': 'Ga',
            'rate': '1.000',
            'rate_unit': 'Ga/A',
        })
        response = self.client_api.post(
            '/api/application-events/', payload, format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)

        event = ApplicationEvent.objects.get(id=response.data['id'])
        self.assertEqual(float(event.rei_hours), 48.0)
        self.assertEqual(event.phi_days, 14)

        posting = REIPostingRecord.objects.get(event=event)
        self.assertEqual(posting.rei_hours, 48)
        # Ticker shows the product list summary for tank mixes
        self.assertIn('+1 more', posting.product_display)
