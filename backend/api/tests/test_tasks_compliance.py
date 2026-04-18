from datetime import date, datetime, time, timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from api.models import (
    Company,
    ComplianceProfile,
    ComplianceDeadline,
    ComplianceAlert,
    Farm,
    Field,
    PesticideProduct,
    PesticideApplication,
    REIPostingRecord,
)
from api.tasks.compliance_tasks import (
    check_compliance_deadlines,
    generate_recurring_deadlines,
    generate_rei_posting_records,
    check_active_reis,
)


class ComplianceTaskTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(
            name='Test Company',
            county='Fresno',
        )

        cls.farm = Farm.objects.create(
            company=cls.company,
            name='North Ranch',
            county='Fresno',
        )

        cls.field = Field.objects.create(
            farm=cls.farm,
            name='Block A',
            county='Fresno',
            total_acres=10,
            current_crop='Oranges',
        )

        cls.product = PesticideProduct.objects.create(
            epa_registration_number='12345-1',
            product_name='TestSpray',
            rei_hours=12,
            active_status_california=True,
            product_status='active',
        )

    def _make_application(self, app_date, start_time_value, end_time_value):
        return PesticideApplication.objects.create(
            field=self.field,
            product=self.product,
            application_date=app_date,
            start_time=start_time_value,
            end_time=end_time_value,
            acres_treated=5,
            amount_used=10,
            unit_of_measure='gal',
            application_method='Ground Spray',
            applicator_name='John Smith',
        )

    def test_check_compliance_deadlines_updates_status_and_creates_alerts(self):
        fixed_now = timezone.make_aware(datetime(2026, 2, 24, 8, 0, 0))
        today = fixed_now.date()

        overdue = ComplianceDeadline.objects.create(
            company=self.company,
            name='Overdue Deadline',
            category='reporting',
            due_date=today - timedelta(days=1),
            warning_days=7,
            status='upcoming',
        )
        due_soon = ComplianceDeadline.objects.create(
            company=self.company,
            name='Due Soon Deadline',
            category='reporting',
            due_date=today + timedelta(days=1),
            warning_days=7,
            status='upcoming',
        )

        # Force status to upcoming without triggering auto status update
        ComplianceDeadline.objects.filter(id=overdue.id).update(status='upcoming')
        ComplianceDeadline.objects.filter(id=due_soon.id).update(status='upcoming')

        with patch('api.tasks.compliance_tasks.timezone.now', return_value=fixed_now):
            stats = check_compliance_deadlines()

        overdue.refresh_from_db()
        due_soon.refresh_from_db()

        self.assertEqual(overdue.status, 'overdue')
        self.assertEqual(due_soon.status, 'due_soon')
        self.assertEqual(stats['alerts_created'], 2)
        self.assertEqual(ComplianceAlert.objects.count(), 2)

    def test_generate_recurring_deadlines_creates_expected_items(self):
        fixed_now = timezone.make_aware(datetime(2026, 2, 24, 8, 0, 0))

        ComplianceProfile.objects.create(
            company=self.company,
            primary_state='CA',
            requires_pur_reporting=True,
            requires_wps_compliance=True,
        )

        with patch('api.tasks.compliance_tasks.timezone.now', return_value=fixed_now):
            generate_recurring_deadlines(company_id=self.company.id)

        self.assertTrue(
            ComplianceDeadline.objects.filter(
                company=self.company,
                name='PUR Report - February 2026',
            ).exists()
        )
        self.assertTrue(
            ComplianceDeadline.objects.filter(
                company=self.company,
                name='WPS Annual Training - 2026',
            ).exists()
        )
        self.assertTrue(
            ComplianceDeadline.objects.filter(
                company=self.company,
                name='Water Quality Testing - Q1 2026',
            ).exists()
        )
        self.assertTrue(
            ComplianceDeadline.objects.filter(
                company=self.company,
                name='SGMA Extraction Report - January-June 2026',
            ).exists()
        )

    def test_generate_rei_posting_records_creates_record(self):
        app_date = date(2026, 2, 24)
        app = self._make_application(app_date, time(8, 0), time(10, 0))

        self.assertFalse(REIPostingRecord.objects.filter(application=app).exists())

        generate_rei_posting_records()

        rei = REIPostingRecord.objects.get(application=app)
        expected_start = timezone.make_aware(datetime.combine(app_date, time(8, 0)))
        expected_end = expected_start + timedelta(hours=12)

        self.assertEqual(rei.rei_hours, 12)
        self.assertEqual(rei.rei_end_datetime, expected_end)

    def test_check_active_reis_creates_alerts(self):
        fixed_now = timezone.make_aware(datetime(2026, 2, 24, 8, 0, 0))

        app_ended = self._make_application(date(2026, 2, 23), time(8, 0), time(10, 0))
        app_ending_soon = self._make_application(date(2026, 2, 24), time(7, 0), time(9, 0))

        REIPostingRecord.objects.create(
            application=app_ended,
            rei_hours=12,
            rei_end_datetime=fixed_now - timedelta(minutes=10),
            posting_compliant=False,
        )
        REIPostingRecord.objects.create(
            application=app_ending_soon,
            rei_hours=12,
            rei_end_datetime=fixed_now + timedelta(minutes=90),
            posting_compliant=False,
        )

        with patch('api.tasks.compliance_tasks.timezone.now', return_value=fixed_now):
            stats = check_active_reis()

        self.assertEqual(stats['alerts_created'], 2)
        self.assertEqual(
            ComplianceAlert.objects.filter(related_object_type='REIPostingRecord').count(),
            2,
        )
