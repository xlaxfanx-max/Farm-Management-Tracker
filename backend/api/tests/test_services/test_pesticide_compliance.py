"""
Tests for the Pesticide Compliance Service.

Tests cover:
- Application validation
- PHI clearance calculations
- REI status tracking
- NOI requirements
- Product restrictions
"""

from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import Mock, patch

from django.test import TestCase
from django.contrib.auth import get_user_model

from api.models import (
    Company, Farm, Field, PesticideProduct, PesticideApplication
)
from api.services.compliance.pesticide_compliance import (
    PesticideComplianceService,
    ComplianceIssue,
    ApplicationValidationResult,
    PHIClearanceResult,
    REIStatus,
)


class PesticideComplianceServiceTestCase(TestCase):
    """Base test case with common setup for pesticide compliance tests."""

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

        # Create farm with coordinates
        cls.farm = Farm.objects.create(
            company=cls.company,
            name='North Ranch',
            gps_latitude=Decimal('36.7783'),
            gps_longitude=Decimal('-119.4179'),
            county='Fresno',
        )

        # Create field
        cls.field = Field.objects.create(
            farm=cls.farm,
            name='Block 1',
            total_acres=Decimal('20.0'),
            current_crop='Navel Oranges',
        )

        # Create test products
        cls.product_standard = PesticideProduct.objects.create(
            epa_registration_number='12345-1',
            product_name='TestSpray 2EC',
            manufacturer='Test Chemical Co',
            active_ingredients='Test Active 25%',
            restricted_use=False,
            product_type='insecticide',
            phi_days=7,
            rei_hours=Decimal('12'),
            max_applications_per_season=4,
            max_rate_per_application=Decimal('2.0'),
            max_rate_unit='gal/acre',
            active_status_california=True,
            product_status='active',
        )

        cls.product_restricted = PesticideProduct.objects.create(
            epa_registration_number='12345-2',
            product_name='RestrictedSpray 5G',
            manufacturer='Test Chemical Co',
            active_ingredients='Restricted Active 50%',
            restricted_use=True,
            product_type='fumigant',
            is_fumigant=True,
            phi_days=14,
            rei_hours=Decimal('48'),
            signal_word='DANGER',
            max_applications_per_season=2,
            max_rate_per_application=Decimal('1.5'),
            max_rate_unit='lbs/acre',
            active_status_california=True,
            product_status='active',
            buffer_zone_required=True,
            buffer_zone_feet=100,
        )


class ValidateProposedApplicationTests(PesticideComplianceServiceTestCase):
    """Tests for validate_proposed_application method."""

    def setUp(self):
        self.service = PesticideComplianceService(company_id=self.company.id)

    def test_valid_application_passes(self):
        """Test that a valid application passes all checks."""
        result = self.service.validate_proposed_application(
            field_id=self.field.id,
            product_id=self.product_standard.id,
            application_date=date.today(),
            rate_per_acre=1.5,
            application_method='Ground Spray',
            acres_treated=10.0,
            applicator_name='John Smith',
            check_weather=False,
            check_quarantine=False,
        )

        self.assertTrue(result.is_valid)
        self.assertEqual(len(result.issues), 0)

    def test_invalid_field_id_fails(self):
        """Test that an invalid field ID returns an error."""
        result = self.service.validate_proposed_application(
            field_id=99999,
            product_id=self.product_standard.id,
            application_date=date.today(),
            rate_per_acre=1.5,
            application_method='Ground Spray',
            acres_treated=10.0,
            check_weather=False,
            check_quarantine=False,
        )

        self.assertFalse(result.is_valid)
        self.assertTrue(any(i.category == 'registration' for i in result.issues))

    def test_invalid_product_id_fails(self):
        """Test that an invalid product ID returns an error."""
        result = self.service.validate_proposed_application(
            field_id=self.field.id,
            product_id=99999,
            application_date=date.today(),
            rate_per_acre=1.5,
            application_method='Ground Spray',
            acres_treated=10.0,
            check_weather=False,
            check_quarantine=False,
        )

        self.assertFalse(result.is_valid)

    def test_rate_exceeds_max_fails(self):
        """Test that exceeding max rate returns an error."""
        result = self.service.validate_proposed_application(
            field_id=self.field.id,
            product_id=self.product_standard.id,
            application_date=date.today(),
            rate_per_acre=5.0,  # Exceeds max of 2.0
            application_method='Ground Spray',
            acres_treated=10.0,
            check_weather=False,
            check_quarantine=False,
        )

        self.assertFalse(result.is_valid)
        rate_issues = [i for i in result.issues if i.category == 'rate']
        self.assertTrue(len(rate_issues) > 0)

    def test_restricted_product_requires_applicator(self):
        """Test that restricted products require applicator name."""
        result = self.service.validate_proposed_application(
            field_id=self.field.id,
            product_id=self.product_restricted.id,
            application_date=date.today(),
            rate_per_acre=1.0,
            application_method='Soil Injection',
            acres_treated=10.0,
            applicator_name=None,  # Missing applicator
            check_weather=False,
            check_quarantine=False,
        )

        self.assertFalse(result.is_valid)
        permit_issues = [i for i in result.issues if i.category == 'permit']
        self.assertTrue(len(permit_issues) > 0)

    def test_noi_required_for_restricted(self):
        """Test that NOI is flagged for restricted materials."""
        result = self.service.validate_proposed_application(
            field_id=self.field.id,
            product_id=self.product_restricted.id,
            application_date=date.today() + timedelta(days=7),
            rate_per_acre=1.0,
            application_method='Soil Injection',
            acres_treated=10.0,
            applicator_name='Licensed Applicator',
            applicator_license='CA-12345',
            check_weather=False,
            check_quarantine=False,
        )

        self.assertTrue(result.noi_required)
        self.assertIsNotNone(result.noi_deadline)

    def test_season_limit_exceeded_fails(self):
        """Test that exceeding season limits returns an error."""
        # Create existing applications to hit the limit
        # All applications must be in the same calendar year as today
        current_year = date.today().year
        for i in range(4):  # Max is 4
            # Space applications 7 days apart, all in current year
            app_date = date(current_year, 1, 1) + timedelta(days=i * 7)
            PesticideApplication.objects.create(
                field=self.field,
                product=self.product_standard,
                application_date=app_date,
                start_time='08:00',
                end_time='10:00',
                acres_treated=Decimal('10.0'),
                amount_used=Decimal('15.0'),
                unit_of_measure='gal',
                application_method='Ground Spray',
                applicator_name='John Smith',
            )

        result = self.service.validate_proposed_application(
            field_id=self.field.id,
            product_id=self.product_standard.id,
            application_date=date.today(),
            rate_per_acre=1.5,
            application_method='Ground Spray',
            acres_treated=10.0,
            check_weather=False,
            check_quarantine=False,
        )

        self.assertFalse(result.is_valid)
        rate_issues = [i for i in result.issues if i.category == 'rate']
        self.assertTrue(any('Maximum applications' in i.message for i in rate_issues))


class PHIClearanceTests(PesticideComplianceServiceTestCase):
    """Tests for PHI clearance calculation."""

    def setUp(self):
        self.service = PesticideComplianceService(company_id=self.company.id)

    def test_no_applications_is_clear(self):
        """Test that a field with no applications is clear."""
        result = self.service.calculate_phi_clearance(
            field_id=self.field.id,
        )

        self.assertTrue(result.is_clear)
        self.assertEqual(result.days_until_clear, 0)

    def test_recent_application_blocks_harvest(self):
        """Test that a recent application with PHI blocks harvest."""
        # Create recent application
        PesticideApplication.objects.create(
            field=self.field,
            product=self.product_standard,  # 7 day PHI
            application_date=date.today() - timedelta(days=3),
            start_time='08:00',
            end_time='10:00',
            acres_treated=Decimal('10.0'),
            amount_used=Decimal('15.0'),
            unit_of_measure='gal',
            application_method='Ground Spray',
            applicator_name='John Smith',
        )

        result = self.service.calculate_phi_clearance(
            field_id=self.field.id,
            proposed_harvest_date=date.today()
        )

        self.assertFalse(result.is_clear)
        self.assertGreater(result.days_until_clear, 0)
        self.assertEqual(len(result.blocking_applications), 1)

    def test_old_application_allows_harvest(self):
        """Test that an old application doesn't block harvest."""
        # Create old application (beyond PHI)
        PesticideApplication.objects.create(
            field=self.field,
            product=self.product_standard,  # 7 day PHI
            application_date=date.today() - timedelta(days=30),
            start_time='08:00',
            end_time='10:00',
            acres_treated=Decimal('10.0'),
            amount_used=Decimal('15.0'),
            unit_of_measure='gal',
            application_method='Ground Spray',
            applicator_name='John Smith',
        )

        result = self.service.calculate_phi_clearance(
            field_id=self.field.id,
        )

        self.assertTrue(result.is_clear)
        self.assertEqual(result.days_until_clear, 0)

    def test_earliest_harvest_date_calculation(self):
        """Test that earliest harvest date is calculated correctly."""
        app_date = date.today() - timedelta(days=3)
        PesticideApplication.objects.create(
            field=self.field,
            product=self.product_standard,  # 7 day PHI
            application_date=app_date,
            start_time='08:00',
            end_time='10:00',
            acres_treated=Decimal('10.0'),
            amount_used=Decimal('15.0'),
            unit_of_measure='gal',
            application_method='Ground Spray',
            applicator_name='John Smith',
        )

        result = self.service.calculate_phi_clearance(
            field_id=self.field.id,
        )

        expected_clear_date = app_date + timedelta(days=7)
        self.assertEqual(result.earliest_harvest_date, expected_clear_date)


class REIStatusTests(PesticideComplianceServiceTestCase):
    """Tests for REI status tracking."""

    def setUp(self):
        self.service = PesticideComplianceService(company_id=self.company.id)

    def test_no_applications_is_clear(self):
        """Test that a field with no applications is safe for entry."""
        result = self.service.get_rei_status(field_id=self.field.id)

        self.assertTrue(result.is_clear)
        self.assertEqual(result.hours_until_clear, 0)

    def test_old_application_is_clear(self):
        """Test that an old application doesn't restrict entry."""
        # Create old application
        PesticideApplication.objects.create(
            field=self.field,
            product=self.product_standard,  # 12 hour REI
            application_date=date.today() - timedelta(days=2),
            start_time='08:00',
            end_time='10:00',
            acres_treated=Decimal('10.0'),
            amount_used=Decimal('15.0'),
            unit_of_measure='gal',
            application_method='Ground Spray',
            applicator_name='John Smith',
        )

        result = self.service.get_rei_status(field_id=self.field.id)

        self.assertTrue(result.is_clear)


class NOIRequirementsTests(PesticideComplianceServiceTestCase):
    """Tests for NOI requirements."""

    def setUp(self):
        self.service = PesticideComplianceService()

    def test_non_restricted_no_noi(self):
        """Test that non-restricted products don't require NOI."""
        result = self.service.get_noi_requirements(
            product_id=self.product_standard.id,
            application_date=date.today() + timedelta(days=7),
            county='Fresno'
        )

        self.assertFalse(result['required'])

    def test_restricted_requires_noi(self):
        """Test that restricted products require NOI."""
        result = self.service.get_noi_requirements(
            product_id=self.product_restricted.id,
            application_date=date.today() + timedelta(days=7),
            county='Fresno'
        )

        self.assertTrue(result['required'])
        self.assertIn('deadline', result)
        self.assertIn('submission_info', result)

    def test_fumigant_longer_lead_time(self):
        """Test that fumigants require longer NOI lead time."""
        result = self.service.get_noi_requirements(
            product_id=self.product_restricted.id,  # Is fumigant
            application_date=date.today() + timedelta(days=7),
            county='Fresno'
        )

        self.assertEqual(result['lead_time_days'], 2)  # Fumigants need 48 hours


class ProductRestrictionsTests(PesticideComplianceServiceTestCase):
    """Tests for product restriction checking."""

    def setUp(self):
        self.service = PesticideComplianceService(company_id=self.company.id)

    def test_buffer_zone_warning(self):
        """Test that buffer zone requirement generates warning."""
        issues = self.service.check_product_restrictions(
            product_id=self.product_restricted.id,  # Has buffer zone
            field_id=self.field.id,
            application_date=date.today()
        )

        buffer_issues = [i for i in issues if i.category == 'buffer']
        self.assertTrue(len(buffer_issues) > 0)

    def test_inactive_product_error(self):
        """Test that inactive products generate error."""
        # Create inactive product
        inactive_product = PesticideProduct.objects.create(
            epa_registration_number='99999-1',
            product_name='Discontinued Product',
            active_status_california=True,
            product_status='discontinued',
        )

        issues = self.service.check_product_restrictions(
            product_id=inactive_product.id,
            field_id=self.field.id,
            application_date=date.today()
        )

        registration_issues = [i for i in issues if i.category == 'registration']
        self.assertTrue(any(i.blocking for i in registration_issues))


class DataClassSerializationTests(TestCase):
    """Tests for data class serialization."""

    def test_compliance_issue_dict(self):
        """Test ComplianceIssue serialization."""
        issue = ComplianceIssue(
            severity='error',
            category='phi',
            message='Test message',
            blocking=True,
            details={'key': 'value'}
        )

        # to_dict is not defined on ComplianceIssue, but it should work with vars()
        # or we test that the fields are accessible
        self.assertEqual(issue.severity, 'error')
        self.assertEqual(issue.category, 'phi')
        self.assertTrue(issue.blocking)

    def test_application_validation_result_to_dict(self):
        """Test ApplicationValidationResult.to_dict() method."""
        result = ApplicationValidationResult(
            is_valid=True,
            is_compliant=True,
            issues=[],
            warnings=[
                ComplianceIssue(
                    severity='warning',
                    category='weather',
                    message='Wind is moderate',
                    blocking=False
                )
            ],
            noi_required=False,
            recommended_actions=['Monitor weather']
        )

        data = result.to_dict()

        self.assertTrue(data['is_valid'])
        self.assertTrue(data['is_compliant'])
        self.assertEqual(len(data['issues']), 0)
        self.assertEqual(len(data['warnings']), 1)
        self.assertEqual(data['warnings'][0]['category'], 'weather')

    def test_phi_clearance_result_to_dict(self):
        """Test PHIClearanceResult.to_dict() method."""
        result = PHIClearanceResult(
            field_id=1,
            field_name='Test Field',
            is_clear=True,
            earliest_harvest_date=date.today(),
            days_until_clear=0,
            recent_applications=[],
            blocking_applications=[]
        )

        data = result.to_dict()

        self.assertEqual(data['field_id'], 1)
        self.assertEqual(data['field_name'], 'Test Field')
        self.assertTrue(data['is_clear'])
        self.assertEqual(data['days_until_clear'], 0)
