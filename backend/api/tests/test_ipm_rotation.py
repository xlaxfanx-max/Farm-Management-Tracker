"""
Tests for IPM rotation and application cost computation.

Covers the advisory-only MOA rotation check (IRAC/FRAC/HRAC) across both
model paths and the cost properties on products/applications.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from api.models import (
    ApplicationEvent,
    Company,
    Farm,
    Field,
    PesticideApplication,
    PesticideProduct,
    Product,
    TankMixItem,
)
from api.services.ipm_rotation import (
    check_moa_rotation,
    check_moa_rotation_for_event,
)


class PesticideApplicationCostTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Citrus Co')
        cls.farm = Farm.objects.create(company=cls.company, name='North')
        cls.field = Field.objects.create(
            farm=cls.farm, name='Block 1',
            total_acres=Decimal('10.00'),
            current_crop='Navel Oranges',
        )

    def _make_product(self, **kwargs):
        defaults = dict(
            epa_registration_number='100-1',
            product_name='TestProduct',
        )
        defaults.update(kwargs)
        return PesticideProduct.objects.create(**defaults)

    def _make_application(self, product, **kwargs):
        defaults = dict(
            field=self.field,
            product=product,
            application_date=date(2026, 3, 1),
            start_time=time(8, 0),
            end_time=time(10, 0),
            acres_treated=Decimal('5.00'),
            amount_used=Decimal('4.00'),
            unit_of_measure='gal',
            application_method='Ground Spray',
            applicator_name='Test',
        )
        defaults.update(kwargs)
        return PesticideApplication.objects.create(**defaults)

    def test_application_cost_computes_when_units_match(self):
        product = self._make_product(
            cost_per_unit=Decimal('60.00'), cost_unit='gal',
        )
        app = self._make_application(product)
        self.assertEqual(app.application_cost, Decimal('240.00'))
        self.assertEqual(app.cost_per_acre, Decimal('48.00'))

    def test_application_cost_is_none_when_units_mismatch(self):
        # Product priced per pound, application measured in gallons — we
        # don't have a safe conversion, so cost should be None rather than
        # silently wrong.
        product = self._make_product(
            cost_per_unit=Decimal('40.00'), cost_unit='lbs',
        )
        app = self._make_application(product)
        self.assertIsNone(app.application_cost)
        self.assertIsNone(app.cost_per_acre)

    def test_application_cost_is_none_when_cost_not_configured(self):
        product = self._make_product()
        app = self._make_application(product)
        self.assertIsNone(app.application_cost)


class MOARotationLegacyTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Citrus Co')
        cls.farm = Farm.objects.create(company=cls.company, name='North')
        cls.field = Field.objects.create(
            farm=cls.farm, name='Block 1',
            total_acres=Decimal('10.00'),
            current_crop='Navel Oranges',
        )

        cls.neonic = PesticideProduct.objects.create(
            epa_registration_number='100-1', product_name='Neonic-A',
            moa_code='IRAC-4A', moa_group_name='Neonicotinoids',
        )
        cls.neonic_b = PesticideProduct.objects.create(
            epa_registration_number='100-2', product_name='Neonic-B',
            moa_code='IRAC-4A', moa_group_name='Neonicotinoids',
        )
        cls.pyrethroid = PesticideProduct.objects.create(
            epa_registration_number='101-1', product_name='Pyr-A',
            moa_code='IRAC-3A', moa_group_name='Pyrethroids',
        )
        cls.no_moa = PesticideProduct.objects.create(
            epa_registration_number='102-1', product_name='Unknown-A',
        )

    def _app(self, product, days_ago):
        return PesticideApplication.objects.create(
            field=self.field, product=product,
            application_date=date(2026, 3, 1) - timedelta(days=days_ago),
            start_time=time(8, 0), end_time=time(10, 0),
            acres_treated=Decimal('5.00'), amount_used=Decimal('4.00'),
            unit_of_measure='gal', application_method='Ground Spray',
            applicator_name='Test',
        )

    def test_no_warning_when_no_prior_history(self):
        warning = check_moa_rotation(
            field=self.field, product=self.neonic,
            application_date=date(2026, 3, 1),
        )
        self.assertIsNone(warning)

    def test_warning_on_back_to_back_same_moa(self):
        self._app(self.neonic, days_ago=10)
        warning = check_moa_rotation(
            field=self.field, product=self.neonic_b,
            application_date=date(2026, 3, 1),
        )
        self.assertIsNotNone(warning)
        self.assertEqual(warning.severity, 'warning')
        self.assertEqual(warning.code, 'moa_rotation_back_to_back')

    def test_critical_on_three_consecutive_same_moa(self):
        self._app(self.neonic, days_ago=30)
        self._app(self.neonic_b, days_ago=15)
        warning = check_moa_rotation(
            field=self.field, product=self.neonic,
            application_date=date(2026, 3, 1),
        )
        self.assertIsNotNone(warning)
        self.assertEqual(warning.severity, 'critical')

    def test_break_in_streak_suppresses_warning(self):
        # Neonic, then pyrethroid, then neonic again — the pyrethroid breaks
        # the streak, so adding another neonic should not warn.
        self._app(self.neonic, days_ago=40)
        self._app(self.pyrethroid, days_ago=20)
        warning = check_moa_rotation(
            field=self.field, product=self.neonic_b,
            application_date=date(2026, 3, 1),
        )
        self.assertIsNone(warning)

    def test_product_without_moa_never_warns(self):
        self._app(self.neonic, days_ago=5)
        warning = check_moa_rotation(
            field=self.field, product=self.no_moa,
            application_date=date(2026, 3, 1),
        )
        self.assertIsNone(warning)


class MOARotationEventTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Citrus Co')
        cls.farm = Farm.objects.create(company=cls.company, name='North')
        cls.field = Field.objects.create(
            farm=cls.farm, name='Block 1',
            total_acres=Decimal('10.00'),
            current_crop='Navel Oranges',
        )

        cls.neonic = Product.objects.create(
            product_name='Neonic-A', product_type='pesticide',
            moa_code='IRAC-4A', moa_group_name='Neonicotinoids',
        )
        cls.neonic_b = Product.objects.create(
            product_name='Neonic-B', product_type='pesticide',
            moa_code='IRAC-4A', moa_group_name='Neonicotinoids',
            cost_per_unit=Decimal('50.00'), cost_unit='Ga',
        )
        cls.pyrethroid = Product.objects.create(
            product_name='Pyr-A', product_type='pesticide',
            moa_code='IRAC-3A', moa_group_name='Pyrethroids',
        )

    def _event(self, product, days_ago, total_amount=Decimal('2.00'),
               amount_unit='Ga'):
        event_date = timezone.make_aware(
            datetime.combine(date(2026, 3, 1) - timedelta(days=days_ago), time(8, 0))
        )
        event = ApplicationEvent.objects.create(
            company=self.company, farm=self.farm, field=self.field,
            date_started=event_date,
            treated_area_acres=Decimal('5.00'),
            application_method='ground',
        )
        TankMixItem.objects.create(
            application_event=event, product=product,
            total_amount=total_amount, amount_unit=amount_unit,
            rate=Decimal('0.4'), rate_unit='Ga/A',
        )
        return event

    def test_event_path_warns_on_back_to_back(self):
        self._event(self.neonic, days_ago=10)
        warning = check_moa_rotation_for_event(
            field=self.field, product=self.neonic_b,
            event_date=date(2026, 3, 1),
        )
        self.assertIsNotNone(warning)
        self.assertEqual(warning.severity, 'warning')

    def test_event_path_break_in_streak_suppresses(self):
        self._event(self.neonic, days_ago=30)
        self._event(self.pyrethroid, days_ago=15)
        warning = check_moa_rotation_for_event(
            field=self.field, product=self.neonic_b,
            event_date=date(2026, 3, 1),
        )
        self.assertIsNone(warning)

    def test_tank_mix_item_cost_computes(self):
        event = self._event(self.neonic_b, days_ago=5,
                            total_amount=Decimal('4.00'), amount_unit='Ga')
        item = event.tank_mix_items.get()
        self.assertEqual(item.item_cost, Decimal('200.00'))
        self.assertEqual(item.cost_per_acre, Decimal('40.00'))

    def test_event_total_cost_aggregates(self):
        event = self._event(self.neonic_b, days_ago=5,
                            total_amount=Decimal('4.00'), amount_unit='Ga')
        TankMixItem.objects.create(
            application_event=event, product=self.neonic_b,
            total_amount=Decimal('2.00'), amount_unit='Ga',
            rate=Decimal('0.2'), rate_unit='Ga/A',
        )
        # 4 gal * $50 + 2 gal * $50 = $300
        self.assertEqual(event.total_cost, Decimal('300.00'))
        # $300 / 5 acres = $60/acre
        self.assertEqual(event.cost_per_acre, Decimal('60.00'))

    def test_event_total_cost_none_when_any_item_missing_cost(self):
        event = self._event(self.neonic_b, days_ago=5,
                            total_amount=Decimal('4.00'), amount_unit='Ga')
        # Add a second item with product that has no cost configured
        TankMixItem.objects.create(
            application_event=event, product=self.neonic,
            total_amount=Decimal('2.00'), amount_unit='Ga',
            rate=Decimal('0.2'), rate_unit='Ga/A',
        )
        self.assertIsNone(event.total_cost)
