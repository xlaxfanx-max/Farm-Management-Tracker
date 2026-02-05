"""
Tests for pagination configuration and model constraints.

Covers StandardPagination behavior and YieldForecast unique constraint.
"""

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import (
    Company, CompanyMembership, Role,
    Farm, Field, Crop,
)
from api.pagination import StandardPagination

User = get_user_model()


class StandardPaginationTests(TestCase):
    """Tests for the custom pagination class."""

    def test_default_page_size(self):
        paginator = StandardPagination()
        self.assertEqual(paginator.page_size, 100)

    def test_max_page_size(self):
        paginator = StandardPagination()
        self.assertEqual(paginator.max_page_size, 1000)

    def test_page_size_query_param(self):
        paginator = StandardPagination()
        self.assertEqual(paginator.page_size_query_param, 'page_size')


class PaginatedListEndpointTests(TestCase):
    """Tests that list endpoints return paginated results."""

    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Pagination Test Co')
        cls.role = Role.objects.create(
            name='Owner', codename='owner', is_system_role=True
        )
        cls.user = User.objects.create_user(
            email='pagtest@example.com',
            password='testpass123',
        )
        cls.user.current_company = cls.company
        cls.user.save(update_fields=['current_company'])
        CompanyMembership.objects.create(
            user=cls.user,
            company=cls.company,
            role=cls.role,
        )

        # Create some farms
        for i in range(5):
            Farm.objects.create(
                company=cls.company,
                name=f'Test Farm {i}',
                county='Ventura',
            )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_farm_list_is_paginated(self):
        response = self.client.get('/api/farms/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        # Paginated responses have count, next, previous, results
        self.assertIn('results', data)
        self.assertIn('count', data)
        self.assertEqual(data['count'], 5)
        self.assertEqual(len(data['results']), 5)

    def test_custom_page_size(self):
        response = self.client.get('/api/farms/?page_size=2')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data['results']), 2)
        self.assertEqual(data['count'], 5)
        self.assertIsNotNone(data['next'])

    def test_page_size_capped_at_max(self):
        response = self.client.get('/api/farms/?page_size=9999')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        # Should still work, but page_size is capped to max_page_size
        self.assertIn('results', data)


class YieldForecastConstraintTests(TestCase):
    """Tests for the YieldForecast unique constraint."""

    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Yield Test Co')
        cls.farm = Farm.objects.create(
            company=cls.company,
            name='Test Farm',
            county='Ventura',
        )
        cls.crop = Crop.objects.create(name='Avocado')
        cls.field = Field.objects.create(
            farm=cls.farm,
            name='Block A',
            crop=cls.crop,
            total_acres=Decimal('10.00'),
        )

    def _create_forecast(self, status='published', forecast_date=None):
        from api.models import YieldForecast
        return YieldForecast.objects.create(
            field=self.field,
            season_label='2025-2026',
            forecast_date=forecast_date or date(2025, 10, 1),
            predicted_yield_per_acre=Decimal('50.00'),
            predicted_total_yield=Decimal('500.00'),
            yield_unit='bins',
            harvestable_acres=Decimal('10.00'),
            confidence_level=Decimal('0.80'),
            lower_bound_per_acre=Decimal('40.00'),
            upper_bound_per_acre=Decimal('60.00'),
            status=status,
        )

    def test_duplicate_published_forecast_rejected(self):
        """Two published forecasts for same field/season/date should fail."""
        self._create_forecast(status='published')

        with self.assertRaises(IntegrityError):
            self._create_forecast(status='published')

    def test_draft_duplicates_allowed(self):
        """Multiple draft forecasts for same field/season/date are OK."""
        self._create_forecast(status='draft')
        # Should not raise
        self._create_forecast(status='draft')

    def test_published_and_draft_same_day_allowed(self):
        """One published + one draft for same field/season/date is OK."""
        self._create_forecast(status='published')
        # Should not raise
        self._create_forecast(status='draft')

    def test_published_different_dates_allowed(self):
        """Published forecasts for different dates are OK."""
        self._create_forecast(status='published', forecast_date=date(2025, 10, 1))
        # Should not raise
        self._create_forecast(status='published', forecast_date=date(2025, 11, 1))

    def test_superseded_duplicates_allowed(self):
        """Multiple superseded forecasts are OK."""
        self._create_forecast(status='superseded')
        self._create_forecast(status='superseded')
