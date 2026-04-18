from datetime import date

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from api.models import Company, ComplianceReport


class ComplianceReportValidationTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            email='reports@example.com',
            password='testpass123',
        )
        self.company = Company.objects.create(name='Primary Citrus Co')
        self.user.current_company = self.company
        self.user.save(update_fields=['current_company'])
        self.client.force_authenticate(user=self.user)

    def test_validate_blocks_empty_pur_report(self):
        report = ComplianceReport.objects.create(
            company=self.company,
            report_type='pur_monthly',
            title='PUR March 2026',
            reporting_period_start=date(2026, 3, 1),
            reporting_period_end=date(2026, 3, 31),
            report_data={},
            created_by=self.user,
        )

        response = self.client.post(reverse('compliance-report-validate', args=[report.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        report.refresh_from_db()
        self.assertFalse(report.is_valid)
        self.assertEqual(report.status, 'draft')
        self.assertIn('Report data is empty.', report.validation_errors)

    def test_validate_marks_incomplete_pur_report_pending_review(self):
        report = ComplianceReport.objects.create(
            company=self.company,
            report_type='pur_monthly',
            title='PUR March 2026',
            reporting_period_start=date(2026, 3, 1),
            reporting_period_end=date(2026, 3, 31),
            record_count=1,
            report_data={
                'total_applications': 1,
                'applications': [
                    {
                        'date': '2026-03-10',
                        'farm': 'North Ranch',
                        'field': 'Block 1',
                        'product': 'Restricted Spray',
                        'epa_reg_no': '12345-1',
                    }
                ],
            },
            created_by=self.user,
        )

        response = self.client.post(reverse('compliance-report-validate', args=[report.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        report.refresh_from_db()
        self.assertFalse(report.is_valid)
        self.assertEqual(report.status, 'pending_review')
        self.assertTrue(any('advisory fields' in warning for warning in report.validation_warnings))
