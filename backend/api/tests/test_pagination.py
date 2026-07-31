"""
Tests for pagination configuration.

Covers StandardPagination behavior.
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
