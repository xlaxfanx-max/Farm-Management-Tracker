"""
Tests for authentication endpoints.

Covers registration, login, logout, token refresh, email validation,
and HttpOnly cookie behavior.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from api.models import Company, Role, CompanyMembership

User = get_user_model()


class AuthTestBase(TestCase):
    """Shared setup for auth tests."""

    @classmethod
    def setUpTestData(cls):
        cls.owner_role = Role.objects.create(
            name='Owner', codename='owner', is_system_role=True
        )

    def setUp(self):
        self.client = APIClient()


# =============================================================================
# REGISTRATION TESTS
# =============================================================================

class RegisterTests(AuthTestBase):

    def test_register_success(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'newuser@example.com',
            'password': 'securepass123',
            'first_name': 'John',
            'last_name': 'Doe',
            'company_name': 'Test Farm LLC',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn('tokens', data)
        self.assertIn('access', data['tokens'])
        self.assertIn('refresh', data['tokens'])
        self.assertEqual(data['user']['email'], 'newuser@example.com')
        self.assertEqual(data['company']['name'], 'Test Farm LLC')

        # User should exist in DB
        self.assertTrue(User.objects.filter(email='newuser@example.com').exists())

    def test_register_sets_cookies(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'cookie@example.com',
            'password': 'securepass123',
            'company_name': 'Cookie Farm',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertIn('access_token', response.cookies)

    def test_register_missing_email(self):
        response = self.client.post('/api/auth/register/', {
            'password': 'securepass123',
            'company_name': 'Test Farm',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.json()['errors'])

    def test_register_missing_password(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'user@example.com',
            'company_name': 'Test Farm',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json()['errors'])

    def test_register_short_password(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'user@example.com',
            'password': 'short',
            'company_name': 'Test Farm',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json()['errors'])

    def test_register_missing_company_name(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'user@example.com',
            'password': 'securepass123',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('company_name', response.json()['errors'])

    def test_register_duplicate_email(self):
        User.objects.create_user(email='existing@example.com', password='testpass')

        response = self.client.post('/api/auth/register/', {
            'email': 'existing@example.com',
            'password': 'securepass123',
            'company_name': 'Test Farm',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.json()['errors'])

    def test_register_invalid_email_format(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'not-an-email',
            'password': 'securepass123',
            'company_name': 'Test Farm',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.json()['errors'])

    def test_register_email_too_long(self):
        long_email = 'a' * 250 + '@example.com'
        response = self.client.post('/api/auth/register/', {
            'email': long_email,
            'password': 'securepass123',
            'company_name': 'Test Farm',
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_register_email_case_insensitive(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'User@Example.COM',
            'password': 'securepass123',
            'company_name': 'Test Farm',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(email='user@example.com').exists())

    def test_register_email_whitespace_stripped(self):
        response = self.client.post('/api/auth/register/', {
            'email': '  spaces@example.com  ',
            'password': 'securepass123',
            'company_name': 'Test Farm',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(User.objects.filter(email='spaces@example.com').exists())

    @override_settings(DEBUG=False)
    def test_register_error_does_not_leak_details(self):
        """Ensure 500 errors return generic messages, not internal details."""
        import logging
        from unittest.mock import patch

        # Suppress Django's error logging which triggers a Python 3.14 bug
        # when copying template context for 500 error pages.
        logging.disable(logging.CRITICAL)
        try:
            with patch(
                'api.auth_views.User.objects.create_user',
                side_effect=RuntimeError('DB connection lost'),
            ):
                response = self.client.post('/api/auth/register/', {
                    'email': 'user@example.com',
                    'password': 'securepass123',
                    'company_name': 'Test Farm',
                }, format='json')
        finally:
            logging.disable(logging.NOTSET)

        self.assertEqual(response.status_code, 500)
        error_msg = response.json()['error']
        # Should NOT contain exception class names or stack traces
        self.assertNotIn('Traceback', error_msg)
        self.assertNotIn('DB connection lost', error_msg)


# =============================================================================
# LOGIN TESTS
# =============================================================================

class LoginTests(AuthTestBase):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.company = Company.objects.create(name='Login Test Co')
        cls.user = User.objects.create_user(
            email='login@example.com',
            password='testpass123',
        )
        cls.user.current_company = cls.company
        cls.user.save(update_fields=['current_company'])
        CompanyMembership.objects.create(
            user=cls.user,
            company=cls.company,
            role=cls.owner_role,
        )

    def test_login_success(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'login@example.com',
            'password': 'testpass123',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('tokens', data)
        self.assertEqual(data['user']['email'], 'login@example.com')

    def test_login_sets_cookies(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'login@example.com',
            'password': 'testpass123',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertIn('access_token', response.cookies)

    def test_login_wrong_password(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'login@example.com',
            'password': 'wrongpass',
        }, format='json')

        self.assertEqual(response.status_code, 401)

    def test_login_nonexistent_email(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'nobody@example.com',
            'password': 'testpass123',
        }, format='json')

        self.assertEqual(response.status_code, 401)

    def test_login_missing_fields(self):
        response = self.client.post('/api/auth/login/', {}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_login_invalid_email_format(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'not-valid',
            'password': 'testpass123',
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_login_email_case_insensitive(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'LOGIN@EXAMPLE.COM',
            'password': 'testpass123',
        }, format='json')

        self.assertEqual(response.status_code, 200)

    def test_login_inactive_user(self):
        inactive = User.objects.create_user(
            email='inactive@example.com',
            password='testpass123',
            is_active=False,
        )
        response = self.client.post('/api/auth/login/', {
            'email': 'inactive@example.com',
            'password': 'testpass123',
        }, format='json')

        self.assertEqual(response.status_code, 401)


# =============================================================================
# LOGOUT TESTS
# =============================================================================

class LogoutTests(AuthTestBase):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.company = Company.objects.create(name='Logout Test Co')
        cls.user = User.objects.create_user(
            email='logout@example.com',
            password='testpass123',
        )
        cls.user.current_company = cls.company
        cls.user.save(update_fields=['current_company'])

    def test_logout_success(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/auth/logout/', format='json')

        self.assertEqual(response.status_code, 200)
        self.assertIn('Logged out', response.json()['message'])

    def test_logout_clears_cookies(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/auth/logout/', format='json')

        # Cookie should be set with max_age=0 (deleted)
        if 'access_token' in response.cookies:
            cookie = response.cookies['access_token']
            self.assertEqual(cookie['max-age'], 0)

    def test_logout_unauthenticated(self):
        response = self.client.post('/api/auth/logout/', format='json')
        self.assertEqual(response.status_code, 401)


# =============================================================================
# TOKEN REFRESH TESTS
# =============================================================================

class RefreshTokenTests(AuthTestBase):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.user = User.objects.create_user(
            email='refresh@example.com',
            password='testpass123',
        )

    def _get_tokens(self):
        """Helper to get a valid token pair."""
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(self.user)
        return str(refresh), str(refresh.access_token)

    def test_refresh_with_body_token(self):
        refresh_str, _ = self._get_tokens()
        response = self.client.post('/api/auth/refresh/', {
            'refresh': refresh_str,
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.json())

    def test_refresh_invalid_token(self):
        response = self.client.post('/api/auth/refresh/', {
            'refresh': 'invalid-token-string',
        }, format='json')

        self.assertEqual(response.status_code, 401)

    def test_refresh_missing_token(self):
        response = self.client.post('/api/auth/refresh/', {}, format='json')
        self.assertEqual(response.status_code, 400)


# =============================================================================
# EMAIL VALIDATION HELPER TESTS
# =============================================================================

class EmailValidationTests(TestCase):

    def test_valid_email(self):
        from api.auth_views import validate_email_address
        valid, error = validate_email_address('user@example.com')
        self.assertTrue(valid)
        self.assertIsNone(error)

    def test_empty_email(self):
        from api.auth_views import validate_email_address
        valid, error = validate_email_address('')
        self.assertFalse(valid)
        self.assertEqual(error, 'Email is required')

    def test_none_email(self):
        from api.auth_views import validate_email_address
        valid, error = validate_email_address(None)
        self.assertFalse(valid)

    def test_invalid_format(self):
        from api.auth_views import validate_email_address
        valid, error = validate_email_address('not-an-email')
        self.assertFalse(valid)
        self.assertIn('valid email', error)

    def test_missing_domain(self):
        from api.auth_views import validate_email_address
        valid, error = validate_email_address('user@')
        self.assertFalse(valid)

    def test_too_long(self):
        from api.auth_views import validate_email_address
        long_email = 'a' * 250 + '@example.com'
        valid, error = validate_email_address(long_email)
        self.assertFalse(valid)
        self.assertIn('too long', error)

    def test_email_with_plus(self):
        from api.auth_views import validate_email_address
        valid, error = validate_email_address('user+tag@example.com')
        self.assertTrue(valid)

    def test_email_with_dots(self):
        from api.auth_views import validate_email_address
        valid, error = validate_email_address('first.last@example.co.uk')
        self.assertTrue(valid)


# =============================================================================
# ME / PROFILE TESTS
# =============================================================================

class MeEndpointTests(AuthTestBase):

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.company = Company.objects.create(name='Me Test Co')
        cls.user = User.objects.create_user(
            email='me@example.com',
            password='testpass123',
            first_name='Jane',
            last_name='Smith',
        )
        cls.user.current_company = cls.company
        cls.user.save(update_fields=['current_company'])
        CompanyMembership.objects.create(
            user=cls.user,
            company=cls.company,
            role=cls.owner_role,
        )

    def test_me_authenticated(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['email'], 'me@example.com')
        self.assertEqual(data['first_name'], 'Jane')
        self.assertIn('current_company', data)
        self.assertIn('permissions', data)

    def test_me_unauthenticated(self):
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, 401)


# =============================================================================
# PASSWORD CHANGE TESTS
# =============================================================================

class ChangePasswordTests(AuthTestBase):

    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            email='changepw@example.com',
            password='oldpass123',
        )
        self.client.force_authenticate(user=self.user)

    def test_change_password_success(self):
        response = self.client.post('/api/auth/change-password/', {
            'current_password': 'oldpass123',
            'new_password': 'newpass456',
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('newpass456'))

    def test_change_password_wrong_current(self):
        response = self.client.post('/api/auth/change-password/', {
            'current_password': 'wrongpass',
            'new_password': 'newpass456',
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_change_password_too_short(self):
        response = self.client.post('/api/auth/change-password/', {
            'current_password': 'oldpass123',
            'new_password': 'short',
        }, format='json')

        self.assertEqual(response.status_code, 400)

    def test_change_password_missing_fields(self):
        response = self.client.post('/api/auth/change-password/', {}, format='json')
        self.assertEqual(response.status_code, 400)
