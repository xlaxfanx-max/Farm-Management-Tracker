from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import Company, Role, Invitation, CompanyMembership


class AcceptInvitationExistingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Test Company', county='Fresno')
        cls.role = Role.objects.create(name='Viewer', codename='viewer', is_system_role=True)

        User = get_user_model()
        cls.inviter = User.objects.create_user(
            email='owner@test.com',
            password='testpass123',
        )
        cls.invited_user = User.objects.create_user(
            email='invited@test.com',
            password='testpass123',
        )

        cls.invitation = Invitation.objects.create(
            email=cls.invited_user.email,
            company=cls.company,
            role=cls.role,
            invited_by=cls.inviter,
            expires_at=timezone.now() + timedelta(days=7),
        )

    def setUp(self):
        self.client = APIClient()

    def test_accept_invitation_existing_success(self):
        self.client.force_authenticate(user=self.invited_user)
        response = self.client.post(
            '/api/auth/accept-invitation-existing/',
            {'token': str(self.invitation.token)},
            format='json'
        )

        self.assertEqual(response.status_code, 200)
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, 'accepted')
        self.assertTrue(
            CompanyMembership.objects.filter(
                user=self.invited_user,
                company=self.company,
                is_active=True
            ).exists()
        )

        self.invited_user.refresh_from_db()
        self.assertEqual(self.invited_user.current_company, self.company)

    def test_accept_invitation_existing_wrong_user(self):
        other_user = get_user_model().objects.create_user(
            email='other@test.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=other_user)

        response = self.client.post(
            '/api/auth/accept-invitation-existing/',
            {'token': str(self.invitation.token)},
            format='json'
        )

        self.assertEqual(response.status_code, 403)

    def test_accept_invitation_existing_already_member(self):
        CompanyMembership.objects.create(
            user=self.invited_user,
            company=self.company,
            role=self.role,
            accepted_at=timezone.now(),
        )
        self.client.force_authenticate(user=self.invited_user)

        response = self.client.post(
            '/api/auth/accept-invitation-existing/',
            {'token': str(self.invitation.token)},
            format='json'
        )

        self.assertEqual(response.status_code, 400)

    def test_accept_invitation_existing_expired(self):
        self.invitation.expires_at = timezone.now() - timedelta(days=1)
        self.invitation.save(update_fields=['expires_at'])

        self.client.force_authenticate(user=self.invited_user)
        response = self.client.post(
            '/api/auth/accept-invitation-existing/',
            {'token': str(self.invitation.token)},
            format='json'
        )

        self.assertEqual(response.status_code, 400)
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, 'expired')
