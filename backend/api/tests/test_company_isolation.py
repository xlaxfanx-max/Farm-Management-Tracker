"""
Company Isolation / Row-Level Security Tests

Verifies that multi-tenancy is enforced correctly across all major
domain models. A user from Company A should NEVER see, update, or
delete Company B's data.

Key invariant tested:
    - CompanyFilteredViewSet filters at the queryset level, so
      cross-company detail/update/delete returns 404 (not 403).
"""

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework import status

from api.tests.factories import TestDataFactory
from api.models import (
    Farm, Field, Harvest, Packinghouse, Pool,
    TraceabilityLot, ComplianceDeadline, WaterSource,
)


class CompanyIsolationTests(TestCase):
    """
    Two companies (Alpha, Beta) are created in setUp.
    Every test verifies that Beta cannot see or touch Alpha's data
    (and vice-versa where applicable).
    """

    def setUp(self):
        self.factory = TestDataFactory()

        # Company A  --------------------------------------------------------
        self.company_a, self.user_a = self.factory.create_company_with_user(
            company_name='Alpha Farm', email='alpha@test.com'
        )
        self.client_a = self.factory.create_authenticated_client(self.user_a)

        # Company B  --------------------------------------------------------
        self.company_b, self.user_b = self.factory.create_company_with_user(
            company_name='Beta Farm', email='beta@test.com'
        )
        self.client_b = self.factory.create_authenticated_client(self.user_b)

    # =====================================================================
    #  HELPERS
    # =====================================================================

    def _get_results(self, response):
        """Extract results list from paginated or unpaginated response."""
        data = response.json()
        return data.get('results', data)

    # =====================================================================
    #  1. FARM ISOLATION
    # =====================================================================

    def test_company_b_cannot_list_company_a_farms(self):
        """Listing farms as Company B must not reveal Company A farms."""
        self.factory.create_farm(self.company_a, name='Alpha Ranch')
        self.factory.create_farm(self.company_a, name='Alpha Orchard')

        response = self.client_b.get('/api/farms/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response)
        farm_names = [f['name'] for f in results]
        self.assertNotIn('Alpha Ranch', farm_names)
        self.assertNotIn('Alpha Orchard', farm_names)
        self.assertEqual(len(results), 0)

    def test_company_a_sees_only_own_farms(self):
        """Company A sees its own farms but not Company B's."""
        self.factory.create_farm(self.company_a, name='Alpha Ranch')
        self.factory.create_farm(self.company_b, name='Beta Ranch')

        response = self.client_a.get('/api/farms/')
        results = self._get_results(response)
        farm_names = [f['name'] for f in results]
        self.assertIn('Alpha Ranch', farm_names)
        self.assertNotIn('Beta Ranch', farm_names)
        self.assertEqual(len(results), 1)

    def test_company_b_sees_only_own_farms(self):
        """Company B sees its own farms but not Company A's."""
        self.factory.create_farm(self.company_a, name='Alpha Ranch')
        self.factory.create_farm(self.company_b, name='Beta Ranch')

        response = self.client_b.get('/api/farms/')
        results = self._get_results(response)
        farm_names = [f['name'] for f in results]
        self.assertIn('Beta Ranch', farm_names)
        self.assertNotIn('Alpha Ranch', farm_names)
        self.assertEqual(len(results), 1)

    # =====================================================================
    #  2. FIELD ISOLATION  (company via farm relationship)
    # =====================================================================

    def test_company_b_cannot_list_company_a_fields(self):
        """Fields from Company A's farm are invisible to Company B."""
        farm_a = self.factory.create_farm(self.company_a)
        self.factory.create_field(farm_a, name='Alpha Block 1')
        self.factory.create_field(farm_a, name='Alpha Block 2')

        response = self.client_b.get('/api/fields/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response)
        field_names = [f['name'] for f in results]
        self.assertNotIn('Alpha Block 1', field_names)
        self.assertNotIn('Alpha Block 2', field_names)
        self.assertEqual(len(results), 0)

    def test_each_company_sees_only_own_fields(self):
        """Both companies see only their own fields."""
        farm_a = self.factory.create_farm(self.company_a)
        farm_b = self.factory.create_farm(self.company_b)
        self.factory.create_field(farm_a, name='Alpha Block')
        self.factory.create_field(farm_b, name='Beta Block')

        # Company A
        resp_a = self.client_a.get('/api/fields/')
        results_a = self._get_results(resp_a)
        names_a = [f['name'] for f in results_a]
        self.assertIn('Alpha Block', names_a)
        self.assertNotIn('Beta Block', names_a)

        # Company B
        resp_b = self.client_b.get('/api/fields/')
        results_b = self._get_results(resp_b)
        names_b = [f['name'] for f in results_b]
        self.assertIn('Beta Block', names_b)
        self.assertNotIn('Alpha Block', names_b)

    # =====================================================================
    #  3. HARVEST ISOLATION  (company via field->farm)
    # =====================================================================

    def test_company_b_cannot_list_company_a_harvests(self):
        """Harvests on Company A's field are invisible to Company B."""
        farm_a = self.factory.create_farm(self.company_a)
        field_a = self.factory.create_field(farm_a)
        self.factory.create_harvest(field_a)

        response = self.client_b.get('/api/harvests/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response)
        self.assertEqual(len(results), 0)

    def test_each_company_sees_only_own_harvests(self):
        """Both companies see only their own harvests."""
        farm_a = self.factory.create_farm(self.company_a)
        field_a = self.factory.create_field(farm_a)
        self.factory.create_harvest(field_a, total_bins=50)

        farm_b = self.factory.create_farm(self.company_b)
        field_b = self.factory.create_field(farm_b)
        self.factory.create_harvest(field_b, total_bins=75)

        resp_a = self.client_a.get('/api/harvests/')
        results_a = self._get_results(resp_a)
        self.assertEqual(len(results_a), 1)
        self.assertEqual(results_a[0]['total_bins'], 50)

        resp_b = self.client_b.get('/api/harvests/')
        results_b = self._get_results(resp_b)
        self.assertEqual(len(results_b), 1)
        self.assertEqual(results_b[0]['total_bins'], 75)

    # =====================================================================
    #  4. PACKINGHOUSE ISOLATION
    # =====================================================================

    def test_company_b_cannot_list_company_a_packinghouses(self):
        """Packinghouses from Company A are invisible to Company B."""
        self.factory.create_packinghouse(self.company_a, name='Alpha Packing')

        response = self.client_b.get('/api/packinghouses/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response)
        packinghouse_names = [p['name'] for p in results]
        self.assertNotIn('Alpha Packing', packinghouse_names)
        self.assertEqual(len(results), 0)

    def test_each_company_sees_only_own_packinghouses(self):
        """Both companies see only their own packinghouses."""
        self.factory.create_packinghouse(self.company_a, name='Alpha Packing')
        self.factory.create_packinghouse(self.company_b, name='Beta Packing')

        resp_a = self.client_a.get('/api/packinghouses/')
        results_a = self._get_results(resp_a)
        names_a = [p['name'] for p in results_a]
        self.assertIn('Alpha Packing', names_a)
        self.assertNotIn('Beta Packing', names_a)

        resp_b = self.client_b.get('/api/packinghouses/')
        results_b = self._get_results(resp_b)
        names_b = [p['name'] for p in results_b]
        self.assertIn('Beta Packing', names_b)
        self.assertNotIn('Alpha Packing', names_b)

    # =====================================================================
    #  5. TRACEABILITY LOT ISOLATION
    # =====================================================================

    def test_company_b_cannot_list_company_a_lots(self):
        """Traceability lots from Company A are invisible to Company B."""
        self.factory.create_traceability_lot(
            self.company_a, lot_number='LOT-ALPHA-001'
        )

        response = self.client_b.get('/api/traceability-lots/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response)
        lot_numbers = [lot['lot_number'] for lot in results]
        self.assertNotIn('LOT-ALPHA-001', lot_numbers)
        self.assertEqual(len(results), 0)

    def test_each_company_sees_only_own_lots(self):
        """Both companies see only their own traceability lots."""
        self.factory.create_traceability_lot(
            self.company_a, lot_number='LOT-ALPHA-001'
        )
        self.factory.create_traceability_lot(
            self.company_b, lot_number='LOT-BETA-001'
        )

        resp_a = self.client_a.get('/api/traceability-lots/')
        results_a = self._get_results(resp_a)
        lots_a = [lot['lot_number'] for lot in results_a]
        self.assertIn('LOT-ALPHA-001', lots_a)
        self.assertNotIn('LOT-BETA-001', lots_a)

        resp_b = self.client_b.get('/api/traceability-lots/')
        results_b = self._get_results(resp_b)
        lots_b = [lot['lot_number'] for lot in results_b]
        self.assertIn('LOT-BETA-001', lots_b)
        self.assertNotIn('LOT-ALPHA-001', lots_b)

    # =====================================================================
    #  6. CROSS-COMPANY DETAIL ACCESS  (should return 404)
    # =====================================================================

    def test_cross_company_farm_detail_returns_404(self):
        """GET /api/farms/{id}/ for another company's farm yields 404."""
        farm_a = self.factory.create_farm(self.company_a, name='Alpha Ranch')

        response = self.client_b.get(f'/api/farms/{farm_a.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_company_field_detail_returns_404(self):
        """GET /api/fields/{id}/ for another company's field yields 404."""
        farm_a = self.factory.create_farm(self.company_a)
        field_a = self.factory.create_field(farm_a, name='Alpha Block')

        response = self.client_b.get(f'/api/fields/{field_a.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_company_harvest_detail_returns_404(self):
        """GET /api/harvests/{id}/ for another company's harvest yields 404."""
        farm_a = self.factory.create_farm(self.company_a)
        field_a = self.factory.create_field(farm_a)
        harvest_a = self.factory.create_harvest(field_a)

        response = self.client_b.get(f'/api/harvests/{harvest_a.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_company_packinghouse_detail_returns_404(self):
        """GET /api/packinghouses/{id}/ for another company's packinghouse yields 404."""
        ph_a = self.factory.create_packinghouse(self.company_a, name='Alpha Packing')

        response = self.client_b.get(f'/api/packinghouses/{ph_a.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_company_lot_detail_returns_404(self):
        """GET /api/traceability-lots/{id}/ for another company's lot yields 404."""
        lot_a = self.factory.create_traceability_lot(self.company_a)

        response = self.client_b.get(f'/api/traceability-lots/{lot_a.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # =====================================================================
    #  7. CROSS-COMPANY UPDATE  (should return 404)
    # =====================================================================

    def test_cross_company_farm_update_returns_404(self):
        """PATCH /api/farms/{id}/ for another company's farm yields 404."""
        farm_a = self.factory.create_farm(self.company_a, name='Alpha Ranch')

        response = self.client_b.patch(
            f'/api/farms/{farm_a.pk}/',
            {'name': 'Hacked Farm'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        # Verify the name was NOT changed
        farm_a.refresh_from_db()
        self.assertEqual(farm_a.name, 'Alpha Ranch')

    def test_cross_company_field_update_returns_404(self):
        """PATCH /api/fields/{id}/ for another company's field yields 404."""
        farm_a = self.factory.create_farm(self.company_a)
        field_a = self.factory.create_field(farm_a, name='Alpha Block')

        response = self.client_b.patch(
            f'/api/fields/{field_a.pk}/',
            {'name': 'Hacked Block'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        field_a.refresh_from_db()
        self.assertEqual(field_a.name, 'Alpha Block')

    def test_cross_company_packinghouse_update_returns_404(self):
        """PATCH /api/packinghouses/{id}/ for another company's packinghouse yields 404."""
        ph_a = self.factory.create_packinghouse(self.company_a, name='Alpha Packing')

        response = self.client_b.patch(
            f'/api/packinghouses/{ph_a.pk}/',
            {'name': 'Hacked Packinghouse'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        ph_a.refresh_from_db()
        self.assertEqual(ph_a.name, 'Alpha Packing')

    # =====================================================================
    #  8. CROSS-COMPANY DELETE  (should return 404)
    # =====================================================================

    def test_cross_company_farm_delete_returns_404(self):
        """DELETE /api/farms/{id}/ for another company's farm yields 404."""
        farm_a = self.factory.create_farm(self.company_a, name='Alpha Ranch')

        response = self.client_b.delete(f'/api/farms/{farm_a.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        # Farm still exists
        self.assertTrue(Farm.objects.filter(pk=farm_a.pk).exists())

    def test_cross_company_field_delete_returns_404(self):
        """DELETE /api/fields/{id}/ for another company's field yields 404."""
        farm_a = self.factory.create_farm(self.company_a)
        field_a = self.factory.create_field(farm_a, name='Alpha Block')

        response = self.client_b.delete(f'/api/fields/{field_a.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Field.objects.filter(pk=field_a.pk).exists())

    def test_cross_company_packinghouse_delete_returns_404(self):
        """DELETE /api/packinghouses/{id}/ for another company's packinghouse yields 404."""
        ph_a = self.factory.create_packinghouse(self.company_a, name='Alpha Packing')

        response = self.client_b.delete(f'/api/packinghouses/{ph_a.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Packinghouse.objects.filter(pk=ph_a.pk).exists())

    # =====================================================================
    #  9. COMPLIANCE DEADLINE ISOLATION
    # =====================================================================

    def test_company_b_cannot_list_company_a_compliance_deadlines(self):
        """Compliance deadlines from Company A are invisible to Company B."""
        ComplianceDeadline.objects.create(
            company=self.company_a,
            name='Annual PUR Report',
            category='reporting',
            due_date=date.today() + timedelta(days=30),
        )

        response = self.client_b.get('/api/compliance/deadlines/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response)
        deadline_names = [d['name'] for d in results]
        self.assertNotIn('Annual PUR Report', deadline_names)
        self.assertEqual(len(results), 0)

    def test_each_company_sees_only_own_compliance_deadlines(self):
        """Both companies see only their own compliance deadlines."""
        ComplianceDeadline.objects.create(
            company=self.company_a,
            name='Alpha WPS Training',
            category='training',
            due_date=date.today() + timedelta(days=30),
        )
        ComplianceDeadline.objects.create(
            company=self.company_b,
            name='Beta Water Testing',
            category='testing',
            due_date=date.today() + timedelta(days=60),
        )

        resp_a = self.client_a.get('/api/compliance/deadlines/')
        results_a = self._get_results(resp_a)
        names_a = [d['name'] for d in results_a]
        self.assertIn('Alpha WPS Training', names_a)
        self.assertNotIn('Beta Water Testing', names_a)

        resp_b = self.client_b.get('/api/compliance/deadlines/')
        results_b = self._get_results(resp_b)
        names_b = [d['name'] for d in results_b]
        self.assertIn('Beta Water Testing', names_b)
        self.assertNotIn('Alpha WPS Training', names_b)

    def test_cross_company_compliance_deadline_detail_returns_404(self):
        """GET detail for another company's deadline yields 404."""
        deadline_a = ComplianceDeadline.objects.create(
            company=self.company_a,
            name='Alpha Audit Deadline',
            category='audit',
            due_date=date.today() + timedelta(days=30),
        )

        response = self.client_b.get(
            f'/api/compliance/deadlines/{deadline_a.pk}/'
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # =====================================================================
    #  10. WATER SOURCE ISOLATION
    # =====================================================================

    def test_company_b_cannot_list_company_a_water_sources(self):
        """Water sources from Company A are invisible to Company B."""
        self.factory.create_water_source(
            self.company_a, name='Alpha Well #1'
        )

        response = self.client_b.get('/api/water-sources/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._get_results(response)
        source_names = [s['name'] for s in results]
        self.assertNotIn('Alpha Well #1', source_names)
        self.assertEqual(len(results), 0)

    def test_each_company_sees_only_own_water_sources(self):
        """Both companies see only their own water sources."""
        self.factory.create_water_source(
            self.company_a, name='Alpha Well #1'
        )
        self.factory.create_water_source(
            self.company_b, name='Beta Reservoir'
        )

        resp_a = self.client_a.get('/api/water-sources/')
        results_a = self._get_results(resp_a)
        names_a = [s['name'] for s in results_a]
        self.assertIn('Alpha Well #1', names_a)
        self.assertNotIn('Beta Reservoir', names_a)

        resp_b = self.client_b.get('/api/water-sources/')
        results_b = self._get_results(resp_b)
        names_b = [s['name'] for s in results_b]
        self.assertIn('Beta Reservoir', names_b)
        self.assertNotIn('Alpha Well #1', names_b)

    def test_cross_company_water_source_detail_returns_404(self):
        """GET detail for another company's water source yields 404."""
        source_a = self.factory.create_water_source(
            self.company_a, name='Alpha Well #1'
        )

        response = self.client_b.get(f'/api/water-sources/{source_a.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_company_water_source_update_returns_404(self):
        """PATCH for another company's water source yields 404."""
        source_a = self.factory.create_water_source(
            self.company_a, name='Alpha Well #1'
        )

        response = self.client_b.patch(
            f'/api/water-sources/{source_a.pk}/',
            {'name': 'Hacked Source'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        source_a.refresh_from_db()
        self.assertEqual(source_a.name, 'Alpha Well #1')

    def test_cross_company_water_source_delete_returns_404(self):
        """DELETE for another company's water source yields 404."""
        source_a = self.factory.create_water_source(
            self.company_a, name='Alpha Well #1'
        )

        response = self.client_b.delete(f'/api/water-sources/{source_a.pk}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(WaterSource.objects.filter(pk=source_a.pk).exists())

    # =====================================================================
    #  ADDITIONAL CROSS-CUTTING CHECKS
    # =====================================================================

    def test_unauthenticated_user_gets_401(self):
        """An unauthenticated request should be rejected entirely."""
        self.factory.create_farm(self.company_a, name='Alpha Ranch')

        from rest_framework.test import APIClient
        anon_client = APIClient()

        response = anon_client.get('/api/farms/')
        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def test_multiple_resources_cross_company_isolation(self):
        """
        End-to-end: create a full data chain for Company A.
        Company B should see zero results across all endpoints.
        """
        farm_a = self.factory.create_farm(self.company_a, name='Alpha Ranch')
        field_a = self.factory.create_field(farm_a, name='Alpha Block')
        self.factory.create_harvest(field_a)
        self.factory.create_packinghouse(self.company_a, name='Alpha Packing')
        self.factory.create_water_source(self.company_a, name='Alpha Well')
        ComplianceDeadline.objects.create(
            company=self.company_a,
            name='Alpha Deadline',
            category='reporting',
            due_date=date.today() + timedelta(days=30),
        )

        endpoints = [
            '/api/farms/',
            '/api/fields/',
            '/api/harvests/',
            '/api/packinghouses/',
            '/api/water-sources/',
            '/api/compliance/deadlines/',
        ]

        for endpoint in endpoints:
            response = self.client_b.get(endpoint)
            self.assertEqual(
                response.status_code, status.HTTP_200_OK,
                f'Unexpected status for {endpoint}',
            )
            results = self._get_results(response)
            self.assertEqual(
                len(results), 0,
                f'Company B saw {len(results)} result(s) at {endpoint} '
                f'that belong to Company A',
            )

    def test_own_company_detail_succeeds(self):
        """Sanity check: a user CAN access their own company's farm detail."""
        farm_a = self.factory.create_farm(self.company_a, name='Alpha Ranch')

        response = self.client_a.get(f'/api/farms/{farm_a.pk}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['name'], 'Alpha Ranch')

    def test_own_company_update_succeeds(self):
        """Sanity check: a user CAN update their own company's farm."""
        farm_a = self.factory.create_farm(self.company_a, name='Alpha Ranch')

        response = self.client_a.patch(
            f'/api/farms/{farm_a.pk}/',
            {'name': 'Alpha Ranch Updated'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        farm_a.refresh_from_db()
        self.assertEqual(farm_a.name, 'Alpha Ranch Updated')

    def test_own_company_delete_succeeds(self):
        """Sanity check: a user CAN delete their own company's water source."""
        source_a = self.factory.create_water_source(
            self.company_a, name='Alpha Temp Well'
        )

        response = self.client_a.delete(f'/api/water-sources/{source_a.pk}/')
        self.assertIn(
            response.status_code,
            [status.HTTP_204_NO_CONTENT, status.HTTP_200_OK],
        )
        self.assertFalse(WaterSource.objects.filter(pk=source_a.pk).exists())
