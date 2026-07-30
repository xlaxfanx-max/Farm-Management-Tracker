"""Tests for the rental module.

These lean heavily on the specific failures the source data actually contains,
because those are the regressions worth preventing:

* the rent roll workbook that totals 31 occupant rows against 19 units
* the manager statement whose charge column double-counts split payments
* Thacher Creek LLC owning one on-ranch house and one off-ranch building
* dividing rental income by ranch acres, which the API must make impossible
"""

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse

from api.models import (
    Lease,
    LegalEntity,
    RentalCategory,
    RentalLedgerEntry,
    RentalProperty,
    RentalUnit,
)
from api.tests.factories import TestDataFactory


class RentalScenarioMixin:
    """A company with one ranch, one on-ranch house, one off-ranch building."""

    def setUp(self):
        super().setUp()
        self.factory = TestDataFactory()
        self.company, self.owner = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.owner)

        self.farm = self.factory.create_farm(self.company, name='Thacher Creek')

        # One entity, two properties, opposite treatments — the case that
        # forces location_type to be its own field.
        self.tcc = LegalEntity.objects.create(
            company=self.company, name='Thacher Creek LLC', short_code='TCC',
        )

        self.house = RentalProperty.objects.create(
            company=self.company,
            farm=self.farm,
            owning_entity=self.tcc,
            name='2728 E Ojai',
            location_type='on_ranch',
            property_type='dwelling',
        )
        self.building = RentalProperty.objects.create(
            company=self.company,
            farm=None,
            owning_entity=self.tcc,
            name='Ventura St',
            location_type='off_ranch',
            property_type='dwelling',
        )

        self.rent_income = RentalCategory.objects.create(
            company=self.company, name='Rental Income', kind='income',
        )
        self.utilities = RentalCategory.objects.create(
            company=self.company, name='Utilities', kind='expense',
        )


class RentalPropertyConstraintTests(RentalScenarioMixin, TestCase):

    def test_on_ranch_property_requires_a_farm(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                RentalProperty.objects.create(
                    company=self.company,
                    farm=None,
                    name='Orphan house',
                    location_type='on_ranch',
                )

    def test_off_ranch_property_may_have_no_farm(self):
        prop = RentalProperty.objects.create(
            company=self.company,
            farm=None,
            name='196 Fir',
            location_type='off_ranch',
            property_type='commercial',
        )
        self.assertIsNone(prop.farm_id)

    def test_one_entity_can_hold_both_treatments(self):
        """Thacher Creek LLC owns an on-ranch house and an off-ranch building.

        location_type must therefore be independent of both the owning entity
        and the farm FK — this is the case that breaks any implementation
        deriving it from ``farm_id IS NULL``.
        """
        owned = RentalProperty.objects.filter(owning_entity=self.tcc)
        self.assertEqual(owned.count(), 2)
        self.assertEqual(
            sorted(owned.values_list('location_type', flat=True)),
            ['off_ranch', 'on_ranch'],
        )

    def test_api_rejects_on_ranch_without_farm_as_400(self):
        response = self.client.post(
            reverse('rental-property-list'),
            {'name': 'Orphan', 'location_type': 'on_ranch'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('farm', response.data)


class LeaseRentTests(RentalScenarioMixin, TestCase):

    def test_rent_is_counted_per_unit_not_per_occupant(self):
        """The May 2026 rent roll totals 31 occupant rows against 19 units.

        Two leases on one unit (a co-tenancy, or a stale row left active) must
        not double the unit's contribution to gross potential rent... which is
        exactly what this asserts does NOT happen at the unit level.
        """
        unit = RentalUnit.objects.create(
            rental_property=self.building, unit_label='363',
        )
        Lease.objects.create(
            unit=unit, occupant_label='Vasquez',
            monthly_rent=Decimal('1575.00'), is_active=True,
        )

        response = self.client.get(
            reverse('rental-rent-roll'), {'location_type': 'off_ranch'}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['unit_count'], 1)
        self.assertEqual(
            Decimal(response.data['monthly_gross_potential_rent']),
            Decimal('1575.00'),
        )
        self.assertEqual(
            Decimal(response.data['annual_gross_potential_rent']),
            Decimal('18900.00'),
        )

    def test_unit_count_and_occupied_count_are_reported_separately(self):
        occupied = RentalUnit.objects.create(
            rental_property=self.building, unit_label='359',
        )
        RentalUnit.objects.create(rental_property=self.building, unit_label='361')
        Lease.objects.create(
            unit=occupied, occupant_label='Vasquez',
            monthly_rent=Decimal('1600.00'), is_active=True,
        )

        response = self.client.get(reverse('rental-rent-roll'))
        self.assertEqual(response.data['unit_count'], 2)
        self.assertEqual(response.data['occupied_count'], 1)

    def test_rent_controlled_units_are_countable(self):
        RentalUnit.objects.create(
            rental_property=self.building, unit_label='1', is_rent_controlled=True,
        )
        RentalUnit.objects.create(
            rental_property=self.building, unit_label='2', is_rent_controlled=False,
        )
        response = self.client.get(reverse('rental-rent-roll'))
        self.assertEqual(response.data['rent_controlled_count'], 1)

    def test_lease_dates_are_optional(self):
        """Not one lease date exists in any source file. A lease with a rent
        and no dates is the honest record and must be storable."""
        unit = RentalUnit.objects.create(
            rental_property=self.building, unit_label='whole',
        )
        lease = Lease.objects.create(
            unit=unit, occupant_label='', monthly_rent=Decimal('4750.00'),
        )
        self.assertIsNone(lease.start_date)
        self.assertIsNone(lease.end_date)
        self.assertEqual(lease.annual_rent, Decimal('57000.00'))


class RentalLedgerTests(RentalScenarioMixin, TestCase):

    def test_null_period_month_marks_annual_grain(self):
        entry = RentalLedgerEntry.objects.create(
            company=self.company,
            rental_property=self.house,
            category=self.rent_income,
            period_year=2024,
            period_month=None,
            amount_charged=Decimal('15840.00'),
            amount_paid=Decimal('15840.00'),
        )
        self.assertEqual(entry.grain, 'annual')

    def test_monthly_grain_when_period_month_present(self):
        entry = RentalLedgerEntry.objects.create(
            company=self.company,
            rental_property=self.building,
            category=self.rent_income,
            period_year=2025,
            period_month=5,
            amount_charged=Decimal('1600.00'),
            amount_paid=Decimal('1600.00'),
        )
        self.assertEqual(entry.grain, 'monthly')

    def test_split_payment_collapses_to_one_row_with_correct_outstanding(self):
        """Gray Prop unit 359: $1,600 charged, paid as $600 + $1,000.

        The statement's own charge column repeats the full $1,600 on every
        payment line, which is why its 'Original Amount' total reads $101,700
        against $80,700 actually paid. One row carrying both amounts cannot
        reproduce that error.
        """
        entry = RentalLedgerEntry.objects.create(
            company=self.company,
            rental_property=self.building,
            category=self.rent_income,
            period_year=2025,
            period_month=5,
            amount_charged=Decimal('1600.00'),
            amount_paid=Decimal('600.00') + Decimal('1000.00'),
        )
        self.assertEqual(entry.amount_outstanding, Decimal('0.00'))
        self.assertFalse(entry.is_delinquent)

    def test_delinquency_is_charged_minus_paid(self):
        entry = RentalLedgerEntry.objects.create(
            company=self.company,
            rental_property=self.building,
            category=self.rent_income,
            period_year=2025,
            period_month=6,
            amount_charged=Decimal('1600.00'),
            amount_paid=Decimal('600.00'),
        )
        self.assertEqual(entry.amount_outstanding, Decimal('1000.00'))
        self.assertTrue(entry.is_delinquent)

    def test_overpayment_shows_negative_rather_than_clamping_to_zero(self):
        entry = RentalLedgerEntry.objects.create(
            company=self.company,
            rental_property=self.building,
            category=self.rent_income,
            period_year=2025,
            period_month=7,
            amount_charged=Decimal('1600.00'),
            amount_paid=Decimal('1750.00'),
        )
        self.assertEqual(entry.amount_outstanding, Decimal('-150.00'))
        self.assertFalse(entry.is_delinquent)

    def test_flagged_rows_are_filterable(self):
        RentalLedgerEntry.objects.create(
            company=self.company, rental_property=self.house,
            category=self.rent_income, period_year=2024,
            amount_charged=Decimal('3916.90'),
            is_flagged=True,
            flag_reason='$3,916.90 appears for three properties across two entities',
        )
        RentalLedgerEntry.objects.create(
            company=self.company, rental_property=self.house,
            category=self.rent_income, period_year=2023,
            amount_charged=Decimal('10800.00'),
        )
        response = self.client.get(
            reverse('rental-ledger-list'), {'is_flagged': 'true'}
        )
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertTrue(results[0]['is_flagged'])


class RanchRentalSummaryTests(RentalScenarioMixin, TestCase):

    def _summary(self, **params):
        return self.client.get(
            reverse('farm-rental-summary', kwargs={'farm_id': self.farm.id}),
            params,
        )

    def test_summary_carries_no_acreage_field(self):
        """The query-level half of the farming boundary.

        Dividing rental income by ranch acres is arithmetically valid and
        completely meaningless, so the two figures never travel together. If
        someone adds an acres field to this payload, this test fails and they
        have to justify it.
        """
        response = self._summary(year=2024)
        self.assertEqual(response.status_code, 200)
        for key in response.data:
            self.assertNotIn(
                'acre', key.lower(),
                msg=f"'{key}' would let a client compute rental $/acre",
            )

    def test_summary_nets_income_against_expense(self):
        RentalLedgerEntry.objects.create(
            company=self.company, rental_property=self.house,
            category=self.rent_income, period_year=2024,
            amount_charged=Decimal('15840.00'), amount_paid=Decimal('15840.00'),
        )
        RentalLedgerEntry.objects.create(
            company=self.company, rental_property=self.house,
            category=self.utilities, period_year=2024,
            amount_charged=Decimal('1990.70'), amount_paid=Decimal('1990.70'),
        )

        response = self._summary(year=2024)
        self.assertEqual(Decimal(response.data['income_total']), Decimal('15840.00'))
        self.assertEqual(Decimal(response.data['expense_total']), Decimal('1990.70'))
        self.assertEqual(Decimal(response.data['net_total']), Decimal('13849.30'))

    def test_off_ranch_property_never_enters_a_ranch_summary(self):
        """FIFA's rule is a location rule, not an entity rule.

        Both properties here belong to Thacher Creek LLC. Only the on-ranch one
        may appear in the ranch panel — otherwise the off-ranch building is
        counted twice, once here and once in the portfolio roll-up.
        """
        RentalLedgerEntry.objects.create(
            company=self.company, rental_property=self.house,
            category=self.rent_income, period_year=2024,
            amount_charged=Decimal('15840.00'),
        )
        RentalLedgerEntry.objects.create(
            company=self.company, rental_property=self.building,
            category=self.rent_income, period_year=2024,
            amount_charged=Decimal('305772.00'),
        )

        response = self._summary(year=2024)
        self.assertEqual(response.data['property_count'], 1)
        self.assertEqual(Decimal(response.data['income_total']), Decimal('15840.00'))

    def test_collection_figures_ignore_expense_rows(self):
        """An unpaid utility bill is an account payable, not a delinquent
        tenant. Blending them would make the delinquency figure meaningless."""
        RentalLedgerEntry.objects.create(
            company=self.company, rental_property=self.house,
            category=self.rent_income, period_year=2024,
            amount_charged=Decimal('10000.00'), amount_paid=Decimal('9000.00'),
        )
        RentalLedgerEntry.objects.create(
            company=self.company, rental_property=self.house,
            category=self.utilities, period_year=2024,
            amount_charged=Decimal('500.00'), amount_paid=Decimal('0.00'),
        )

        response = self._summary(year=2024)
        self.assertEqual(Decimal(response.data['amount_charged']), Decimal('10000.00'))
        self.assertEqual(Decimal(response.data['amount_paid']), Decimal('9000.00'))
        self.assertEqual(
            Decimal(response.data['amount_outstanding']), Decimal('1000.00')
        )

    def test_grain_reports_mixed_rather_than_blending(self):
        RentalLedgerEntry.objects.create(
            company=self.company, rental_property=self.house,
            category=self.rent_income, period_year=2024, period_month=None,
            amount_charged=Decimal('15840.00'),
        )
        RentalLedgerEntry.objects.create(
            company=self.company, rental_property=self.house,
            category=self.rent_income, period_year=2024, period_month=5,
            amount_charged=Decimal('1320.00'),
        )
        response = self._summary(year=2024)
        self.assertEqual(response.data['grain'], 'mixed')

    def test_unknown_ranch_returns_404(self):
        response = self.client.get(
            reverse('farm-rental-summary', kwargs={'farm_id': 999999})
        )
        self.assertEqual(response.status_code, 404)


class RentalTenancyTests(RentalScenarioMixin, TestCase):
    """Company isolation, asserted at the API rather than trusting Postgres RLS
    (which is vendor-guarded off on SQLite and so proves nothing here)."""

    def setUp(self):
        super().setUp()
        self.other_company, self.other_owner = (
            self.factory.create_company_with_user(company_name='Other Co')
        )
        self.other_client = self.factory.create_authenticated_client(
            self.other_owner
        )

    def test_properties_are_not_visible_across_companies(self):
        response = self.other_client.get(reverse('rental-property-list'))
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 0)

    def test_cannot_attach_a_unit_to_another_companys_property(self):
        response = self.other_client.post(
            reverse('rental-unit-list'),
            {'rental_property': self.building.id, 'unit_label': 'stolen'},
            format='json',
        )
        self.assertIn(response.status_code, (400, 403))
        self.assertFalse(RentalUnit.objects.filter(unit_label='stolen').exists())

    def test_cannot_attach_a_lease_to_another_companys_unit(self):
        unit = RentalUnit.objects.create(
            rental_property=self.building, unit_label='359',
        )
        response = self.other_client.post(
            reverse('rental-lease-list'),
            {'unit': unit.id, 'occupant_label': 'intruder',
             'monthly_rent': '1600.00'},
            format='json',
        )
        self.assertIn(response.status_code, (400, 403))
        self.assertFalse(Lease.objects.filter(occupant_label='intruder').exists())

    def test_ranch_summary_of_another_companys_ranch_is_404(self):
        response = self.other_client.get(
            reverse('farm-rental-summary', kwargs={'farm_id': self.farm.id})
        )
        self.assertEqual(response.status_code, 404)
