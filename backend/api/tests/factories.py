"""
Test Factories for Finch Farms Dashboard

Provides reusable factory functions for creating test data.
Each factory creates the minimum required related objects
and returns the created instance.

Usage:
    from api.tests.factories import TestDataFactory

    class MyTest(TestCase):
        def setUp(self):
            self.factory = TestDataFactory()
            self.company, self.user = self.factory.create_company_with_user()
            self.farm = self.factory.create_farm(self.company)
            self.field = self.factory.create_field(self.farm)
"""

from datetime import date, time, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from api.models import (
    Company, Role, CompanyMembership,
    Farm, Field, Crop,
    Buyer, LaborContractor, Harvest, HarvestLoad, HarvestLabor,
    PesticideProduct, PesticideApplication,
    WaterSource, WaterTest,
    FertilizerProduct, NutrientApplication,
    Packinghouse, Pool, PackinghouseDelivery,
    ComplianceProfile, ComplianceDeadline,
)

User = get_user_model()


class TestDataFactory:
    """Factory for creating test data with sensible defaults."""

    _counter = 0

    @classmethod
    def _next_id(cls):
        cls._counter += 1
        return cls._counter

    # =========================================================================
    # AUTH / COMPANY
    # =========================================================================

    def create_company(self, name=None, **kwargs):
        n = self._next_id()
        return Company.objects.create(
            name=name or f'Test Farm Co {n}',
            county='ventura',
            subscription_tier='professional',
            **kwargs,
        )

    def create_user(self, company=None, email=None, password='testpass123', **kwargs):
        n = self._next_id()
        user = User.objects.create_user(
            email=email or f'user{n}@test.com',
            password=password,
            first_name=kwargs.pop('first_name', 'Test'),
            last_name=kwargs.pop('last_name', f'User{n}'),
            **kwargs,
        )
        if company:
            user.current_company = company
            user.save(update_fields=['current_company'])
        return user

    def create_company_with_user(self, company_name=None, email=None):
        """Create a company + owner user + membership. Returns (company, user)."""
        company = self.create_company(name=company_name)
        user = self.create_user(company=company, email=email)
        role, _ = Role.objects.get_or_create(
            name='Owner', defaults={'codename': 'owner', 'is_system_role': True}
        )
        CompanyMembership.objects.create(
            user=user, company=company, role=role, is_active=True
        )
        return company, user

    def create_authenticated_client(self, user):
        """Create an APIClient authenticated as the given user."""
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    # =========================================================================
    # FARM / FIELD
    # =========================================================================

    def create_farm(self, company, name=None, **kwargs):
        n = self._next_id()
        return Farm.objects.create(
            company=company,
            name=name or f'Test Farm {n}',
            address=kwargs.pop('address', '123 Farm Rd'),
            county=kwargs.pop('county', 'ventura'),
            **kwargs,
        )

    def create_field(self, farm, name=None, **kwargs):
        n = self._next_id()
        return Field.objects.create(
            farm=farm,
            name=name or f'Field {n}',
            total_acres=kwargs.pop('total_acres', Decimal('10.00')),
            county=kwargs.pop('county', farm.county or 'ventura'),
            **kwargs,
        )

    # =========================================================================
    # HARVEST
    # =========================================================================

    def create_buyer(self, company, name=None, **kwargs):
        n = self._next_id()
        return Buyer.objects.create(
            company=company,
            name=name or f'Test Buyer {n}',
            buyer_type=kwargs.pop('buyer_type', 'packing_house'),
            **kwargs,
        )

    def create_harvest(self, field, **kwargs):
        return Harvest.objects.create(
            field=field,
            harvest_date=kwargs.pop('harvest_date', date.today()),
            crop_variety=kwargs.pop('crop_variety', 'navel_orange'),
            acres_harvested=kwargs.pop('acres_harvested', field.total_acres or Decimal('10.00')),
            total_bins=kwargs.pop('total_bins', 100),
            status=kwargs.pop('status', 'complete'),
            **kwargs,
        )

    # =========================================================================
    # PACKINGHOUSE
    # =========================================================================

    def create_packinghouse(self, company, name=None, **kwargs):
        n = self._next_id()
        return Packinghouse.objects.create(
            company=company,
            name=name or f'Test Packinghouse {n}',
            **kwargs,
        )

    def create_pool(self, packinghouse, **kwargs):
        n = self._next_id()
        return Pool.objects.create(
            packinghouse=packinghouse,
            pool_id=kwargs.pop('pool_id', f'POOL-{n}'),
            name=kwargs.pop('name', f'Test Pool {n}'),
            commodity=kwargs.pop('commodity', 'NAVELS'),
            season=kwargs.pop('season', '2025-2026'),
            **kwargs,
        )

    # =========================================================================
    # WATER
    # =========================================================================

    def create_water_source(self, company=None, farm=None, **kwargs):
        n = self._next_id()
        if farm is None:
            if company is None:
                raise ValueError("Either farm or company must be provided")
            farm = self.create_farm(company)
        return WaterSource.objects.create(
            farm=farm,
            name=kwargs.pop('name', f'Well {n}'),
            source_type=kwargs.pop('source_type', 'well'),
            **kwargs,
        )

    # =========================================================================
    # PESTICIDE / APPLICATION
    # =========================================================================

    def create_pesticide_product(self, company=None, **kwargs):
        # `company` accepted for call-site symmetry but unused:
        # PesticideProduct is a global product database with no company FK.
        n = self._next_id()
        return PesticideProduct.objects.create(
            product_name=kwargs.pop('product_name', f'Test Pesticide {n}'),
            epa_registration_number=kwargs.pop(
                'epa_registration_number', f'12345-{n}'
            ),
            phi_days=kwargs.pop('phi_days', 14),
            rei_hours=kwargs.pop('rei_hours', 12),
            **kwargs,
        )

    def create_application(self, field, product=None, **kwargs):
        if product is None:
            product = self.create_pesticide_product()
        return PesticideApplication.objects.create(
            field=field,
            product=product,
            application_date=kwargs.pop('application_date', date.today() - timedelta(days=30)),
            start_time=kwargs.pop('start_time', time(6, 0)),
            end_time=kwargs.pop('end_time', time(10, 0)),
            acres_treated=kwargs.pop('acres_treated', field.total_acres or Decimal('10.00')),
            amount_used=kwargs.pop('amount_used', Decimal('25.00')),
            unit_of_measure=kwargs.pop('unit_of_measure', 'gal'),
            application_method=kwargs.pop('application_method', 'Ground Spray'),
            applicator_name=kwargs.pop('applicator_name', 'Test Applicator'),
            **kwargs,
        )

    # =========================================================================
    # FULL PIPELINE HELPER
    # =========================================================================

    def create_full_pipeline(self):
        """
        Create a complete data pipeline for integration testing:
        company + user + farm + field + harvest + packinghouse + pool + delivery

        Returns a dict with all created objects.
        """
        company, user = self.create_company_with_user()
        farm = self.create_farm(company)
        field = self.create_field(farm)
        buyer = self.create_buyer(company)
        harvest = self.create_harvest(field)
        packinghouse = self.create_packinghouse(company)
        pool = self.create_pool(packinghouse)

        return {
            'company': company,
            'user': user,
            'farm': farm,
            'field': field,
            'buyer': buyer,
            'harvest': harvest,
            'packinghouse': packinghouse,
            'pool': pool,
        }
