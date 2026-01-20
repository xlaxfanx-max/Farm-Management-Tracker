from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Company


class CompanyAccessTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            email='tester@example.com',
            password='testpass123',
        )

    def test_farm_list_requires_company(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse('farm-list'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_farm_list_allows_with_current_company(self):
        company = Company.objects.create(name='Test Company')
        self.user.current_company = company
        self.user.save(update_fields=['current_company'])

        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse('farm-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
