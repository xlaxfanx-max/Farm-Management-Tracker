"""
Tests for the Water Compliance Service.

Tests cover:
- Allocation status tracking
- Compliance violation detection
- Usage forecasting
- SGMA report data generation
"""

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.contrib.auth import get_user_model

from api.models import (
    Company, Farm, WaterSource, WellReading, WaterAllocation
)
from api.services.compliance.water_compliance import (
    WaterComplianceService,
    AllocationStatus,
    ComplianceViolation,
    get_current_water_year,
    get_water_year_dates,
)


class WaterComplianceServiceTestCase(TestCase):
    """Base test case with common setup for water compliance tests."""

    @classmethod
    def setUpTestData(cls):
        """Set up test data that doesn't change between tests."""
        # Create company
        cls.company = Company.objects.create(
            name='Test Citrus Company',
            county='Fresno',
        )

        # Create user
        User = get_user_model()
        cls.user = User.objects.create_user(
            email='farmer@test.com',
            password='testpass123',
        )
        cls.user.current_company = cls.company
        cls.user.save()

        # Create farm
        cls.farm = Farm.objects.create(
            company=cls.company,
            name='North Ranch',
            county='Fresno',
        )

        # Create wells
        cls.well1 = WaterSource.objects.create(
            farm=cls.farm,
            name='Well #1',
            source_type='well',
            has_flowmeter=True,
            active=True,
        )

        cls.well2 = WaterSource.objects.create(
            farm=cls.farm,
            name='Well #2',
            source_type='well',
            has_flowmeter=True,
            active=True,
        )


def create_allocation(water_source, water_year, allocated_af, allocation_type='annual'):
    """Helper to create WaterAllocation with required fields."""
    wy_dates = get_water_year_dates(water_year)
    return WaterAllocation.objects.create(
        water_source=water_source,
        water_year=water_year,
        period_start=wy_dates['start'],
        period_end=wy_dates['end'],
        allocated_acre_feet=allocated_af,
        allocation_type=allocation_type,
    )


class AllocationStatusTests(WaterComplianceServiceTestCase):
    """Tests for allocation status tracking."""

    def setUp(self):
        self.service = WaterComplianceService(company_id=self.company.id)
        self.water_year = get_current_water_year()

    def test_no_allocation_returns_zero(self):
        """Test that wells without allocations show zero."""
        results = self.service.get_allocation_status(farm_id=self.farm.id)

        self.assertEqual(len(results), 2)  # Two wells
        for result in results:
            self.assertEqual(result.allocated_af, 0)
            self.assertEqual(result.used_af, 0)

    def test_allocation_tracking(self):
        """Test that allocations are tracked correctly."""
        # Create allocation
        create_allocation(self.well1, self.water_year, Decimal('100.0'), 'annual')

        results = self.service.get_allocation_status(farm_id=self.farm.id)

        well1_status = next(r for r in results if r.water_source_id == self.well1.id)
        self.assertEqual(well1_status.allocated_af, 100.0)
        self.assertEqual(well1_status.used_af, 0)
        self.assertEqual(well1_status.remaining_af, 100.0)

    def test_extraction_tracking(self):
        """Test that extractions reduce remaining allocation."""
        # Create allocation
        create_allocation(self.well1, self.water_year, Decimal('100.0'))

        # Create extraction reading
        wy_dates = get_water_year_dates(self.water_year)
        reading_date = max(wy_dates['start'], date.today() - timedelta(days=30))

        WellReading.objects.create(
            water_source=self.well1,
            reading_date=reading_date,
            meter_reading=Decimal('1025.0'),
            extraction_acre_feet=Decimal('25.0'),
        )

        results = self.service.get_allocation_status(farm_id=self.farm.id)

        well1_status = next(r for r in results if r.water_source_id == self.well1.id)
        self.assertEqual(well1_status.used_af, 25.0)
        self.assertEqual(well1_status.remaining_af, 75.0)
        self.assertEqual(well1_status.percent_used, 25.0)

    def test_over_allocation_warning(self):
        """Test that over allocation generates warning."""
        # Create allocation
        create_allocation(self.well1, self.water_year, Decimal('100.0'))

        # Create extraction exceeding allocation
        wy_dates = get_water_year_dates(self.water_year)
        reading_date = max(wy_dates['start'], date.today() - timedelta(days=30))

        WellReading.objects.create(
            water_source=self.well1,
            reading_date=reading_date,
            meter_reading=Decimal('1110.0'),
            extraction_acre_feet=Decimal('110.0'),  # Over allocation
        )

        results = self.service.get_allocation_status(farm_id=self.farm.id)

        well1_status = next(r for r in results if r.water_source_id == self.well1.id)
        self.assertFalse(well1_status.on_track)
        self.assertTrue(any('OVER' in w for w in well1_status.warnings))


class ComplianceViolationTests(WaterComplianceServiceTestCase):
    """Tests for compliance violation detection."""

    def setUp(self):
        self.service = WaterComplianceService(company_id=self.company.id)
        self.water_year = get_current_water_year()

    def test_over_allocation_violation(self):
        """Test detection of over-allocation violation."""
        # Create allocation
        create_allocation(self.well1, self.water_year, Decimal('100.0'))

        # Create extraction exceeding allocation
        wy_dates = get_water_year_dates(self.water_year)
        reading_date = max(wy_dates['start'], date.today() - timedelta(days=30))

        WellReading.objects.create(
            water_source=self.well1,
            reading_date=reading_date,
            meter_reading=Decimal('1110.0'),
            extraction_acre_feet=Decimal('110.0'),
        )

        violations = self.service.check_extraction_compliance(self.well1.id)

        over_allocation = [v for v in violations if v.violation_type == 'over_allocation']
        self.assertTrue(len(over_allocation) > 0)
        self.assertEqual(over_allocation[0].severity, 'error')

    def test_missing_reading_warning(self):
        """Test detection of missing recent readings."""
        # Create an old reading
        WellReading.objects.create(
            water_source=self.well1,
            reading_date=date.today() - timedelta(days=60),
            meter_reading=Decimal('1010.0'),
            extraction_acre_feet=Decimal('10.0'),
        )

        violations = self.service.check_extraction_compliance(self.well1.id)

        missing = [v for v in violations if v.violation_type == 'missing_reading']
        self.assertTrue(len(missing) > 0)

    def test_no_readings_warning(self):
        """Test warning when no readings exist."""
        violations = self.service.check_extraction_compliance(self.well1.id)

        no_readings = [v for v in violations if v.violation_type == 'no_readings']
        self.assertTrue(len(no_readings) > 0)

    def test_check_all_wells(self):
        """Test checking compliance for all wells."""
        # Create allocation for one well
        create_allocation(self.well1, self.water_year, Decimal('100.0'))

        result = self.service.check_all_wells_compliance(farm_id=self.farm.id)

        self.assertEqual(result['wells_checked'], 2)
        self.assertIn('violations', result)


class UsageForecastTests(WaterComplianceServiceTestCase):
    """Tests for usage forecasting."""

    def setUp(self):
        self.service = WaterComplianceService(company_id=self.company.id)
        self.water_year = get_current_water_year()

    def test_forecast_with_no_history(self):
        """Test forecasting when no historical data exists."""
        forecasts = self.service.forecast_water_usage(
            farm_id=self.farm.id,
            months_ahead=3
        )

        self.assertEqual(len(forecasts), 2)  # Two wells
        for forecast in forecasts:
            self.assertEqual(forecast.forecast_period_months, 3)
            self.assertLess(forecast.forecast_confidence, 0.5)  # Low confidence

    def test_forecast_with_history(self):
        """Test forecasting with historical extraction data."""
        # Create historical readings
        base_meter = 1000
        for i in range(6):
            reading_date = date.today() - timedelta(days=30 * i)
            if reading_date.month >= 10 or reading_date.month <= 9:
                WellReading.objects.create(
                    water_source=self.well1,
                    reading_date=reading_date,
                    meter_reading=Decimal(str(base_meter + (6 - i) * 10)),
                    extraction_acre_feet=Decimal('10.0'),
                )

        forecasts = self.service.forecast_water_usage(
            farm_id=self.farm.id,
            months_ahead=6
        )

        well1_forecast = next(f for f in forecasts if f.water_source_id == self.well1.id)
        self.assertEqual(well1_forecast.forecast_period_months, 6)
        self.assertTrue(len(well1_forecast.monthly_projections) > 0)


class SGMAReportTests(WaterComplianceServiceTestCase):
    """Tests for SGMA report data generation."""

    def setUp(self):
        self.service = WaterComplianceService(company_id=self.company.id)
        self.water_year = get_current_water_year()

    def test_generate_h1_report(self):
        """Test generating H1 (Oct-Mar) report data."""
        # Create allocation
        create_allocation(self.well1, self.water_year, Decimal('100.0'))

        report = self.service.generate_sgma_report_data(
            farm_id=self.farm.id,
            report_period='H1'
        )

        self.assertEqual(report.farm_id, self.farm.id)
        self.assertEqual(report.report_period, 'H1')
        self.assertEqual(report.water_year, self.water_year)
        self.assertEqual(len(report.wells), 2)

    def test_generate_h2_report(self):
        """Test generating H2 (Apr-Sep) report data."""
        report = self.service.generate_sgma_report_data(
            farm_id=self.farm.id,
            report_period='H2'
        )

        self.assertEqual(report.report_period, 'H2')

    def test_report_compliance_status(self):
        """Test that compliance status is calculated correctly."""
        # Create allocation
        create_allocation(self.well1, self.water_year, Decimal('100.0'))

        report = self.service.generate_sgma_report_data(
            farm_id=self.farm.id,
            report_period='H1'
        )

        # With no extraction, should be compliant
        self.assertEqual(report.compliance_status, 'compliant')


class HelperFunctionTests(TestCase):
    """Tests for helper functions."""

    def test_get_current_water_year(self):
        """Test water year calculation."""
        water_year = get_current_water_year()

        # Should be in format YYYY-YYYY
        self.assertRegex(water_year, r'^\d{4}-\d{4}$')

        # Years should be consecutive
        years = water_year.split('-')
        self.assertEqual(int(years[1]) - int(years[0]), 1)

    def test_get_water_year_dates(self):
        """Test water year date range calculation."""
        dates = get_water_year_dates('2024-2025')

        self.assertEqual(dates['start'], date(2024, 10, 1))
        self.assertEqual(dates['end'], date(2025, 9, 30))

    def test_get_water_year_dates_default(self):
        """Test water year dates with default (current) year."""
        dates = get_water_year_dates()

        # Should return valid date range
        self.assertLess(dates['start'], dates['end'])
        # Start should be October 1
        self.assertEqual(dates['start'].month, 10)
        self.assertEqual(dates['start'].day, 1)


class DataClassSerializationTests(TestCase):
    """Tests for data class serialization."""

    def test_allocation_status_to_dict(self):
        """Test AllocationStatus.to_dict() method."""
        status = AllocationStatus(
            water_source_id=1,
            water_source_name='Test Well',
            water_year='2024-2025',
            allocated_af=100.0,
            used_af=25.0,
            remaining_af=75.0,
            percent_used=25.0,
            projected_annual_use=50.0,
            on_track=True,
            warnings=[]
        )

        data = status.to_dict()

        self.assertEqual(data['water_source_id'], 1)
        self.assertEqual(data['allocated_af'], 100.0)
        self.assertEqual(data['percent_used'], 25.0)
        self.assertTrue(data['on_track'])

    def test_compliance_violation_to_dict(self):
        """Test ComplianceViolation.to_dict() method."""
        violation = ComplianceViolation(
            violation_type='over_allocation',
            severity='error',
            water_source_id=1,
            water_source_name='Test Well',
            message='Test message',
            recommended_action='Take action',
            deadline=date.today(),
        )

        data = violation.to_dict()

        self.assertEqual(data['violation_type'], 'over_allocation')
        self.assertEqual(data['severity'], 'error')
        self.assertIsNotNone(data['deadline'])
