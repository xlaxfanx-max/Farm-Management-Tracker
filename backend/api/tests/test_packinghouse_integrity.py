from datetime import date, time
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import (
    Company,
    Farm,
    Field,
    Packinghouse,
    Pool,
    PoolSettlement,
    PesticideApplication,
    PesticideProduct,
)


class PackinghouseIntegrityTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            email='operator@example.com',
            password='testpass123',
        )

        self.company = Company.objects.create(name='Primary Citrus Co')
        self.other_company = Company.objects.create(name='Other Citrus Co')

        self.user.current_company = self.company
        self.user.save(update_fields=['current_company'])
        self.client.force_authenticate(user=self.user)

        self.farm = Farm.objects.create(company=self.company, name='North Ranch')
        self.field = Field.objects.create(
            farm=self.farm,
            name='Block 1',
            total_acres=Decimal('20.00'),
            current_crop='Navel Oranges',
        )
        self.other_farm = Farm.objects.create(company=self.other_company, name='Other Ranch')
        self.other_field = Field.objects.create(
            farm=self.other_farm,
            name='Other Block',
            total_acres=Decimal('15.00'),
            current_crop='Lemons',
        )

        self.packinghouse = Packinghouse.objects.create(
            company=self.company,
            name='Saticoy Lemon Association',
            short_code='SLA',
        )
        self.pool = Pool.objects.create(
            packinghouse=self.packinghouse,
            pool_id='POOL-2026-01',
            name='Navel Pool',
            commodity='NAVELS',
            season='2025-2026',
        )

    def test_manual_settlement_create_reconciles_from_grade_lines(self):
        response = self.client.post(reverse('pool-settlement-list'), {
            'pool': self.pool.id,
            'field': self.field.id,
            'statement_date': '2026-03-01',
            'total_bins': '999.00',
            'total_credits': '1000.00',
            'total_deductions': '100.00',
            'net_return': '900.00',
            'prior_advances': '0.00',
            'amount_due': '900.00',
            'grade_lines': [
                {
                    'grade': 'US1',
                    'size': '88',
                    'unit_of_measure': 'BIN',
                    'quantity': '25.00',
                    'percent_of_total': '100.00',
                    'fob_rate': '40.000000',
                    'total_amount': '1000.00',
                }
            ],
            'deductions': [
                {
                    'category': 'packing',
                    'description': 'Packing charge',
                    'quantity': '25.00',
                    'unit_of_measure': 'BIN',
                    'rate': '4.0000000',
                    'amount': '100.00',
                }
            ],
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        settlement = PoolSettlement.objects.get(pool=self.pool, field=self.field)
        self.assertEqual(settlement.total_bins, Decimal('25.00'))
        self.assertEqual(settlement.net_per_bin, Decimal('36.00'))
        self.assertIn('warnings', response.data)

    def test_delivery_create_rejects_field_from_other_company(self):
        response = self.client.post(reverse('packinghouse-delivery-list'), {
            'pool': self.pool.id,
            'field': self.other_field.id,
            'ticket_number': 'TICKET-1',
            'delivery_date': '2026-03-01',
            'bins': '12.00',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('field', response.data)

    def test_packout_report_rejects_field_from_other_company(self):
        response = self.client.post(reverse('packout-report-list'), {
            'pool': self.pool.id,
            'field': self.other_field.id,
            'report_date': '2026-03-01',
            'period_start': '2026-02-01',
            'period_end': '2026-02-28',
            'bins_this_period': '50.00',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('field', response.data)

    def test_pool_settlement_rejects_field_from_other_company(self):
        response = self.client.post(reverse('pool-settlement-list'), {
            'pool': self.pool.id,
            'field': self.other_field.id,
            'statement_date': '2026-03-01',
            'total_bins': '10.00',
            'total_credits': '400.00',
            'total_deductions': '40.00',
            'net_return': '360.00',
            'prior_advances': '0.00',
            'amount_due': '360.00',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('field', response.data)


class NOISubmissionIntegrityTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            email='compliance@example.com',
            password='testpass123',
        )

        self.company = Company.objects.create(name='Primary Citrus Co')
        self.other_company = Company.objects.create(name='Other Citrus Co')

        self.user.current_company = self.company
        self.user.save(update_fields=['current_company'])
        self.client.force_authenticate(user=self.user)

        self.farm = Farm.objects.create(company=self.company, name='North Ranch')
        self.field = Field.objects.create(
            farm=self.farm,
            name='Block 1',
            total_acres=Decimal('20.00'),
            current_crop='Navel Oranges',
        )
        self.other_farm = Farm.objects.create(company=self.other_company, name='Other Ranch')
        self.other_field = Field.objects.create(
            farm=self.other_farm,
            name='Other Block',
            total_acres=Decimal('15.00'),
            current_crop='Lemons',
        )

        self.product = PesticideProduct.objects.create(
            epa_registration_number='12345-1',
            product_name='Restricted Spray',
            restricted_use=True,
            product_type='insecticide',
            rei_hours=Decimal('12'),
            phi_days=7,
        )

        self.application = PesticideApplication.objects.create(
            field=self.field,
            product=self.product,
            application_date=date(2026, 3, 1),
            start_time=time(7, 0),
            end_time=time(8, 0),
            acres_treated=Decimal('5.00'),
            amount_used=Decimal('10.00'),
            unit_of_measure='gal',
            application_method='Ground Spray',
            applicator_name='John Smith',
        )

    def test_noi_create_rejects_mismatched_application_and_field(self):
        response = self.client.post(reverse('noi-submission-list'), {
            'product': self.product.id,
            'field': self.other_field.id,
            'pesticide_application': self.application.id,
            'planned_application_date': '2026-03-02',
            'planned_acres': '5.00',
            'county': 'Fresno',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('field', response.data)
