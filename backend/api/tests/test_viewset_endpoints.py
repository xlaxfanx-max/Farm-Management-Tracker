"""
Comprehensive ViewSet endpoint tests for the Farm Pesticide Tracker.

Tests CRUD operations, authentication, company scoping, and response shapes
for all critical ViewSets: Farm, Field, Harvest, Packinghouse, Pool,
TraceabilityLot, WaterSource, and ComplianceProfile.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from api.tests.factories import TestDataFactory


def _get_results(response):
    """Extract results list from a possibly-paginated API response."""
    data = response.json()
    if isinstance(data, dict) and 'results' in data:
        return data['results']
    return data


# =============================================================================
# FARM VIEWSET TESTS
# =============================================================================

class FarmViewSetTests(TestCase):
    """Tests for /api/farms/ endpoints."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)
        self.farm = self.factory.create_farm(self.company)

    # --- LIST ---

    def test_list_farms(self):
        response = self.client.get('/api/farms/')
        self.assertEqual(response.status_code, 200)
        results = _get_results(response)
        self.assertGreaterEqual(len(results), 1)

    def test_list_farms_unauthenticated(self):
        client = APIClient()
        response = client.get('/api/farms/')
        self.assertEqual(response.status_code, 401)

    def test_list_farms_contains_expected_fields(self):
        response = self.client.get('/api/farms/')
        results = _get_results(response)
        farm_data = results[0]
        for field in ('id', 'name', 'county', 'active', 'field_count'):
            self.assertIn(field, farm_data, f"Missing field: {field}")

    # --- DETAIL ---

    def test_retrieve_farm(self):
        response = self.client.get(f'/api/farms/{self.farm.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['id'], self.farm.id)
        self.assertEqual(response.json()['name'], self.farm.name)

    def test_retrieve_farm_unauthenticated(self):
        client = APIClient()
        response = client.get(f'/api/farms/{self.farm.id}/')
        self.assertEqual(response.status_code, 401)

    # --- CREATE ---

    def test_create_farm(self):
        response = self.client.post('/api/farms/', {
            'name': 'New Test Farm',
            'address': '456 Orchard Ln',
            'county': 'ventura',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['name'], 'New Test Farm')

    def test_create_farm_unauthenticated(self):
        client = APIClient()
        response = client.post('/api/farms/', {
            'name': 'Unauthorized Farm',
        }, format='json')
        self.assertEqual(response.status_code, 401)

    # --- UPDATE ---

    def test_partial_update_farm(self):
        response = self.client.patch(
            f'/api/farms/{self.farm.id}/',
            {'name': 'Renamed Farm'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'Renamed Farm')

    # --- DELETE ---

    def test_delete_farm(self):
        response = self.client.delete(f'/api/farms/{self.farm.id}/')
        self.assertIn(response.status_code, (204, 200))

    # --- COMPANY SCOPING ---

    def test_farm_company_scoping(self):
        """User from Company B cannot see Company A's farm."""
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get('/api/farms/')
        self.assertEqual(response.status_code, 200)
        results = _get_results(response)
        farm_ids = [f['id'] for f in results]
        self.assertNotIn(self.farm.id, farm_ids)

    def test_farm_detail_company_scoping(self):
        """User from Company B cannot retrieve Company A's farm by ID."""
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get(f'/api/farms/{self.farm.id}/')
        self.assertEqual(response.status_code, 404)

    # --- CUSTOM ACTIONS ---

    def test_farm_fields_action(self):
        """GET /api/farms/{id}/fields/ returns fields for that farm."""
        self.factory.create_field(self.farm)
        response = self.client.get(f'/api/farms/{self.farm.id}/fields/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)
        self.assertGreaterEqual(len(response.json()), 1)


# =============================================================================
# FIELD VIEWSET TESTS
# =============================================================================

class FieldViewSetTests(TestCase):
    """Tests for /api/fields/ endpoints."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)
        self.farm = self.factory.create_farm(self.company)
        self.field = self.factory.create_field(self.farm)

    # --- LIST ---

    def test_list_fields(self):
        response = self.client.get('/api/fields/')
        self.assertEqual(response.status_code, 200)
        results = _get_results(response)
        self.assertGreaterEqual(len(results), 1)

    def test_list_fields_unauthenticated(self):
        client = APIClient()
        response = client.get('/api/fields/')
        self.assertEqual(response.status_code, 401)

    def test_list_fields_contains_expected_fields(self):
        response = self.client.get('/api/fields/')
        results = _get_results(response)
        field_data = results[0]
        for key in ('id', 'name', 'farm', 'farm_name', 'total_acres'):
            self.assertIn(key, field_data, f"Missing field: {key}")

    # --- DETAIL ---

    def test_retrieve_field(self):
        response = self.client.get(f'/api/fields/{self.field.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['id'], self.field.id)

    def test_retrieve_field_unauthenticated(self):
        client = APIClient()
        response = client.get(f'/api/fields/{self.field.id}/')
        self.assertEqual(response.status_code, 401)

    # --- CREATE ---

    def test_create_field_unauthenticated(self):
        client = APIClient()
        response = client.post('/api/fields/', {
            'name': 'Unauthorized Field',
            'farm': self.farm.id,
        }, format='json')
        self.assertEqual(response.status_code, 401)

    # --- UPDATE ---

    def test_partial_update_field(self):
        response = self.client.patch(
            f'/api/fields/{self.field.id}/',
            {'name': 'Renamed Field'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'Renamed Field')

    # --- DELETE ---

    def test_delete_field(self):
        response = self.client.delete(f'/api/fields/{self.field.id}/')
        self.assertIn(response.status_code, (204, 200))

    # --- COMPANY SCOPING ---

    def test_field_company_scoping(self):
        """User from another company cannot see this company's fields."""
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get('/api/fields/')
        self.assertEqual(response.status_code, 200)
        results = _get_results(response)
        field_ids = [f['id'] for f in results]
        self.assertNotIn(self.field.id, field_ids)

    def test_field_detail_company_scoping(self):
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get(f'/api/fields/{self.field.id}/')
        self.assertEqual(response.status_code, 404)

    # --- CUSTOM ACTIONS ---

    def test_field_applications_action(self):
        """GET /api/fields/{id}/applications/ returns applications for that field."""
        response = self.client.get(f'/api/fields/{self.field.id}/applications/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)


# =============================================================================
# HARVEST VIEWSET TESTS
# =============================================================================

class HarvestViewSetTests(TestCase):
    """Tests for /api/harvests/ endpoints."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)
        self.farm = self.factory.create_farm(self.company)
        self.field = self.factory.create_field(self.farm)
        self.harvest = self.factory.create_harvest(self.field)

    # --- LIST ---

    def test_list_harvests(self):
        response = self.client.get('/api/harvests/')
        self.assertEqual(response.status_code, 200)
        results = _get_results(response)
        self.assertGreaterEqual(len(results), 1)

    def test_list_harvests_unauthenticated(self):
        client = APIClient()
        response = client.get('/api/harvests/')
        self.assertEqual(response.status_code, 401)

    def test_list_harvests_contains_expected_fields(self):
        response = self.client.get('/api/harvests/')
        results = _get_results(response)
        harvest_data = results[0]
        for key in ('id', 'field', 'harvest_date', 'total_bins', 'status'):
            self.assertIn(key, harvest_data, f"Missing field: {key}")

    # --- DETAIL ---

    def test_retrieve_harvest(self):
        response = self.client.get(f'/api/harvests/{self.harvest.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['id'], self.harvest.id)

    def test_retrieve_harvest_unauthenticated(self):
        client = APIClient()
        response = client.get(f'/api/harvests/{self.harvest.id}/')
        self.assertEqual(response.status_code, 401)

    # --- CREATE ---

    def test_create_harvest(self):
        response = self.client.post('/api/harvests/', {
            'field': self.field.id,
            'harvest_date': str(date.today()),
            'crop_variety': 'navel_orange',
            'acres_harvested': '10.00',
            'total_bins': 50,
            'status': 'complete',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['total_bins'], 50)

    def test_create_harvest_unauthenticated(self):
        client = APIClient()
        response = client.post('/api/harvests/', {
            'field': self.field.id,
            'harvest_date': str(date.today()),
            'crop_variety': 'navel_orange',
            'total_bins': 10,
        }, format='json')
        self.assertEqual(response.status_code, 401)

    # --- UPDATE ---

    def test_partial_update_harvest(self):
        response = self.client.patch(
            f'/api/harvests/{self.harvest.id}/',
            {'total_bins': 200},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['total_bins'], 200)

    # --- DELETE ---

    def test_delete_harvest(self):
        response = self.client.delete(f'/api/harvests/{self.harvest.id}/')
        self.assertIn(response.status_code, (204, 200))

    # --- COMPANY SCOPING ---

    def test_harvest_company_scoping(self):
        """User from another company cannot see this company's harvests."""
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get('/api/harvests/')
        self.assertEqual(response.status_code, 200)
        results = _get_results(response)
        harvest_ids = [h['id'] for h in results]
        self.assertNotIn(self.harvest.id, harvest_ids)

    def test_harvest_detail_company_scoping(self):
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get(f'/api/harvests/{self.harvest.id}/')
        self.assertEqual(response.status_code, 404)

    # --- QUERY FILTERS ---

    def test_list_harvests_filter_by_field(self):
        response = self.client.get(f'/api/harvests/?field={self.field.id}')
        self.assertEqual(response.status_code, 200)
        results = _get_results(response)
        for h in results:
            self.assertEqual(h['field'], self.field.id)

    def test_list_harvests_filter_by_status(self):
        response = self.client.get('/api/harvests/?status=complete')
        self.assertEqual(response.status_code, 200)


# =============================================================================
# PACKINGHOUSE VIEWSET TESTS
# =============================================================================

class PackinghouseViewSetTests(TestCase):
    """Tests for /api/packinghouses/ endpoints."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)
        self.packinghouse = self.factory.create_packinghouse(self.company)

    # --- LIST ---

    def test_list_packinghouses(self):
        response = self.client.get('/api/packinghouses/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        # Could be paginated or a plain list
        results = data.get('results', data) if isinstance(data, dict) else data
        self.assertGreaterEqual(len(results), 1)

    def test_list_packinghouses_unauthenticated(self):
        client = APIClient()
        response = client.get('/api/packinghouses/')
        self.assertEqual(response.status_code, 401)

    def test_list_packinghouses_contains_expected_fields(self):
        response = self.client.get('/api/packinghouses/')
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        ph_data = results[0]
        for key in ('id', 'name', 'is_active', 'pool_count'):
            self.assertIn(key, ph_data, f"Missing field: {key}")

    # --- DETAIL ---

    def test_retrieve_packinghouse(self):
        response = self.client.get(f'/api/packinghouses/{self.packinghouse.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['id'], self.packinghouse.id)

    def test_retrieve_packinghouse_unauthenticated(self):
        client = APIClient()
        response = client.get(f'/api/packinghouses/{self.packinghouse.id}/')
        self.assertEqual(response.status_code, 401)

    # --- CREATE ---

    def test_create_packinghouse(self):
        response = self.client.post('/api/packinghouses/', {
            'name': 'New Packinghouse',
            'city': 'Oxnard',
            'state': 'CA',
            'is_active': True,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['name'], 'New Packinghouse')

    def test_create_packinghouse_unauthenticated(self):
        client = APIClient()
        response = client.post('/api/packinghouses/', {
            'name': 'Unauthorized PH',
        }, format='json')
        self.assertEqual(response.status_code, 401)

    # --- UPDATE ---

    def test_partial_update_packinghouse(self):
        response = self.client.patch(
            f'/api/packinghouses/{self.packinghouse.id}/',
            {'name': 'Updated PH Name'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'Updated PH Name')

    # --- DELETE ---

    def test_delete_packinghouse(self):
        response = self.client.delete(f'/api/packinghouses/{self.packinghouse.id}/')
        self.assertIn(response.status_code, (204, 200))

    # --- COMPANY SCOPING ---

    def test_packinghouse_company_scoping(self):
        """User from another company cannot see this company's packinghouses."""
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get('/api/packinghouses/')
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        ph_ids = [p['id'] for p in results]
        self.assertNotIn(self.packinghouse.id, ph_ids)

    def test_packinghouse_detail_company_scoping(self):
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get(f'/api/packinghouses/{self.packinghouse.id}/')
        self.assertEqual(response.status_code, 404)

    # --- CUSTOM ACTIONS ---

    def test_packinghouse_pools_action(self):
        """GET /api/packinghouses/{id}/pools/ lists pools."""
        self.factory.create_pool(self.packinghouse)
        response = self.client.get(f'/api/packinghouses/{self.packinghouse.id}/pools/')
        self.assertEqual(response.status_code, 200)

    def test_packinghouse_ledger_action(self):
        """GET /api/packinghouses/{id}/ledger/ returns ledger entries."""
        response = self.client.get(f'/api/packinghouses/{self.packinghouse.id}/ledger/')
        self.assertEqual(response.status_code, 200)


# =============================================================================
# POOL VIEWSET TESTS
# =============================================================================

class PoolViewSetTests(TestCase):
    """Tests for /api/pools/ endpoints."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)
        self.packinghouse = self.factory.create_packinghouse(self.company)
        self.pool = self.factory.create_pool(self.packinghouse)

    # --- LIST ---

    def test_list_pools(self):
        response = self.client.get('/api/pools/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        self.assertGreaterEqual(len(results), 1)

    def test_list_pools_unauthenticated(self):
        client = APIClient()
        response = client.get('/api/pools/')
        self.assertEqual(response.status_code, 401)

    def test_list_pools_contains_expected_fields(self):
        response = self.client.get('/api/pools/')
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        pool_data = results[0]
        for key in ('id', 'pool_id', 'name', 'packinghouse', 'commodity', 'season'):
            self.assertIn(key, pool_data, f"Missing field: {key}")

    # --- DETAIL ---

    def test_retrieve_pool(self):
        response = self.client.get(f'/api/pools/{self.pool.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['id'], self.pool.id)

    def test_retrieve_pool_unauthenticated(self):
        client = APIClient()
        response = client.get(f'/api/pools/{self.pool.id}/')
        self.assertEqual(response.status_code, 401)

    # --- CREATE ---

    def test_create_pool(self):
        response = self.client.post('/api/pools/', {
            'packinghouse': self.packinghouse.id,
            'pool_id': 'POOL-NEW-001',
            'name': 'New Pool',
            'commodity': 'NAVELS',
            'season': '2025-2026',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['name'], 'New Pool')

    def test_create_pool_unauthenticated(self):
        client = APIClient()
        response = client.post('/api/pools/', {
            'packinghouse': self.packinghouse.id,
            'pool_id': 'POOL-UNAUTH',
            'name': 'Unauthorized Pool',
        }, format='json')
        self.assertEqual(response.status_code, 401)

    # --- UPDATE ---

    def test_partial_update_pool(self):
        response = self.client.patch(
            f'/api/pools/{self.pool.id}/',
            {'name': 'Renamed Pool'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'Renamed Pool')

    # --- DELETE ---

    def test_delete_pool(self):
        response = self.client.delete(f'/api/pools/{self.pool.id}/')
        self.assertIn(response.status_code, (204, 200))

    # --- COMPANY SCOPING ---

    def test_pool_company_scoping(self):
        """User from another company cannot see this company's pools."""
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get('/api/pools/')
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        pool_ids = [p['id'] for p in results]
        self.assertNotIn(self.pool.id, pool_ids)

    def test_pool_detail_company_scoping(self):
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get(f'/api/pools/{self.pool.id}/')
        self.assertEqual(response.status_code, 404)

    # --- QUERY FILTERS ---

    def test_list_pools_filter_by_packinghouse(self):
        response = self.client.get(f'/api/pools/?packinghouse={self.packinghouse.id}')
        self.assertEqual(response.status_code, 200)

    def test_list_pools_filter_by_season(self):
        response = self.client.get('/api/pools/?season=2025-2026')
        self.assertEqual(response.status_code, 200)

    # --- CUSTOM ACTIONS ---

    def test_pool_deliveries_action(self):
        """GET /api/pools/{id}/deliveries/ returns deliveries."""
        response = self.client.get(f'/api/pools/{self.pool.id}/deliveries/')
        self.assertEqual(response.status_code, 200)


# =============================================================================
# TRACEABILITY LOT VIEWSET TESTS
# =============================================================================

class TraceabilityLotViewSetTests(TestCase):
    """Tests for /api/fsma/traceability-lots/ endpoints."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)
        self.farm = self.factory.create_farm(self.company)
        self.field = self.factory.create_field(self.farm)
        self.harvest = self.factory.create_harvest(self.field)
        self.lot = self.factory.create_traceability_lot(
            self.company,
            harvest=self.harvest,
            field=self.field,
            farm=self.farm,
        )

    # --- LIST ---

    def test_list_lots(self):
        response = self.client.get('/api/fsma/traceability-lots/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        self.assertGreaterEqual(len(results), 1)

    def test_list_lots_unauthenticated(self):
        client = APIClient()
        response = client.get('/api/fsma/traceability-lots/')
        self.assertEqual(response.status_code, 401)

    def test_list_lots_contains_expected_fields(self):
        response = self.client.get('/api/fsma/traceability-lots/')
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        lot_data = results[0]
        for key in ('id', 'lot_number', 'product_description', 'commodity',
                     'status', 'harvest_date'):
            self.assertIn(key, lot_data, f"Missing field: {key}")

    # --- DETAIL ---

    def test_retrieve_lot(self):
        response = self.client.get(f'/api/fsma/traceability-lots/{self.lot.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['id'], self.lot.id)
        self.assertEqual(response.json()['lot_number'], self.lot.lot_number)

    def test_retrieve_lot_unauthenticated(self):
        client = APIClient()
        response = client.get(f'/api/fsma/traceability-lots/{self.lot.id}/')
        self.assertEqual(response.status_code, 401)

    # --- CREATE (direct) ---

    def test_create_lot_direct(self):
        response = self.client.post('/api/fsma/traceability-lots/', {
            'lot_number': 'LOT-DIRECT-001',
            'product_description': 'Fresh Lemons',
            'commodity': 'eureka_lemon',
            'harvest_date': str(date.today()),
            'quantity_bins': 75,
            'status': 'harvested',
            'field': self.field.id,
            'farm': self.farm.id,
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['lot_number'], 'LOT-DIRECT-001')

    # --- CREATE FROM HARVEST ---

    def test_create_lot_from_harvest(self):
        """POST /api/fsma/traceability-lots/create-from-harvest/"""
        new_harvest = self.factory.create_harvest(self.field)
        response = self.client.post(
            '/api/fsma/traceability-lots/create-from-harvest/',
            {
                'harvest_id': new_harvest.id,
                'product_description': 'Fresh Navel Oranges',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn('lot_number', response.json())
        self.assertEqual(response.json()['status'], 'harvested')

    def test_create_lot_from_harvest_unauthenticated(self):
        client = APIClient()
        response = client.post(
            '/api/fsma/traceability-lots/create-from-harvest/',
            {'harvest_id': self.harvest.id, 'product_description': 'Test'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)

    # --- FULL TRACE ---

    def test_full_trace(self):
        """GET /api/fsma/traceability-lots/{id}/full-trace/ returns trace report."""
        response = self.client.get(
            f'/api/fsma/traceability-lots/{self.lot.id}/full-trace/'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('one_step_back', data)
        self.assertIn('one_step_forward', data)
        self.assertIn('compliance', data)

    def test_full_trace_unauthenticated(self):
        client = APIClient()
        response = client.get(
            f'/api/fsma/traceability-lots/{self.lot.id}/full-trace/'
        )
        self.assertEqual(response.status_code, 401)

    # --- DASHBOARD ---

    def test_dashboard(self):
        """GET /api/fsma/traceability-lots/dashboard/ returns summary stats."""
        response = self.client.get('/api/fsma/traceability-lots/dashboard/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('total_lots', data)
        self.assertIn('fda_ready_count', data)
        self.assertIn('lots_by_status', data)

    def test_dashboard_unauthenticated(self):
        client = APIClient()
        response = client.get('/api/fsma/traceability-lots/dashboard/')
        self.assertEqual(response.status_code, 401)

    # --- COMPANY SCOPING ---

    def test_lot_company_scoping(self):
        """User from another company cannot see this company's lots."""
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get('/api/fsma/traceability-lots/')
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        lot_ids = [l['id'] for l in results]
        self.assertNotIn(self.lot.id, lot_ids)

    def test_lot_detail_company_scoping(self):
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get(f'/api/fsma/traceability-lots/{self.lot.id}/')
        self.assertEqual(response.status_code, 404)

    # --- QUERY FILTERS ---

    def test_list_lots_filter_by_status(self):
        response = self.client.get('/api/fsma/traceability-lots/?status=harvested')
        self.assertEqual(response.status_code, 200)

    def test_list_lots_search(self):
        response = self.client.get(
            f'/api/fsma/traceability-lots/?search={self.lot.lot_number}'
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        self.assertGreaterEqual(len(results), 1)


# =============================================================================
# WATER SOURCE VIEWSET TESTS
# =============================================================================

class WaterSourceViewSetTests(TestCase):
    """Tests for /api/water-sources/ endpoints."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)
        self.farm = self.factory.create_farm(self.company)
        self.water_source = self.factory.create_water_source(
            self.company, farm=self.farm,
        )

    # --- LIST ---

    def test_list_water_sources(self):
        response = self.client.get('/api/water-sources/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        self.assertGreaterEqual(len(results), 1)

    def test_list_water_sources_unauthenticated(self):
        client = APIClient()
        response = client.get('/api/water-sources/')
        self.assertEqual(response.status_code, 401)

    def test_list_water_sources_contains_expected_fields(self):
        response = self.client.get('/api/water-sources/')
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        ws_data = results[0]
        for key in ('id', 'name', 'source_type', 'farm', 'active'):
            self.assertIn(key, ws_data, f"Missing field: {key}")

    # --- DETAIL ---

    def test_retrieve_water_source(self):
        response = self.client.get(f'/api/water-sources/{self.water_source.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['id'], self.water_source.id)

    def test_retrieve_water_source_unauthenticated(self):
        client = APIClient()
        response = client.get(f'/api/water-sources/{self.water_source.id}/')
        self.assertEqual(response.status_code, 401)

    # --- CREATE ---

    def test_create_water_source_unauthenticated(self):
        client = APIClient()
        response = client.post('/api/water-sources/', {
            'name': 'Unauthorized Well',
            'source_type': 'well',
            'farm': self.farm.id,
        }, format='json')
        self.assertEqual(response.status_code, 401)

    # --- UPDATE ---

    def test_partial_update_water_source(self):
        response = self.client.patch(
            f'/api/water-sources/{self.water_source.id}/',
            {'name': 'Renamed Well'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['name'], 'Renamed Well')

    # --- DELETE ---

    def test_delete_water_source(self):
        response = self.client.delete(f'/api/water-sources/{self.water_source.id}/')
        self.assertIn(response.status_code, (204, 200))

    # --- COMPANY SCOPING ---

    def test_water_source_company_scoping(self):
        """User from another company cannot see this company's water sources."""
        other_company, other_user = self.factory.create_company_with_user()
        other_farm = self.factory.create_farm(other_company)
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get('/api/water-sources/')
        data = response.json()
        results = data.get('results', data) if isinstance(data, dict) else data
        ws_ids = [w['id'] for w in results]
        self.assertNotIn(self.water_source.id, ws_ids)

    def test_water_source_detail_company_scoping(self):
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        response = other_client.get(f'/api/water-sources/{self.water_source.id}/')
        self.assertEqual(response.status_code, 404)

    # --- CUSTOM ACTIONS ---

    def test_water_source_tests_action(self):
        """GET /api/water-sources/{id}/tests/ returns water tests."""
        response = self.client.get(f'/api/water-sources/{self.water_source.id}/tests/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)

    def test_water_source_overdue_action(self):
        """GET /api/water-sources/overdue/ returns overdue sources."""
        response = self.client.get('/api/water-sources/overdue/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)


# =============================================================================
# COMPLIANCE PROFILE VIEWSET TESTS
# =============================================================================

class ComplianceProfileViewSetTests(TestCase):
    """Tests for /api/compliance/profile/ endpoints."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)

    # --- GET (auto-creates) ---

    def test_get_compliance_profile(self):
        """GET /api/compliance/profile/ auto-creates and returns profile."""
        response = self.client.get('/api/compliance/profile/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('id', data)
        self.assertIn('company', data)

    def test_get_compliance_profile_unauthenticated(self):
        client = APIClient()
        response = client.get('/api/compliance/profile/')
        self.assertEqual(response.status_code, 401)

    def test_get_compliance_profile_contains_expected_fields(self):
        response = self.client.get('/api/compliance/profile/')
        data = response.json()
        for key in ('id', 'company', 'primary_state',
                     'requires_pur_reporting', 'requires_wps_compliance',
                     'requires_fsma_compliance', 'active_regulations'):
            self.assertIn(key, data, f"Missing field: {key}")

    # --- PATCH ---

    def test_update_compliance_profile(self):
        """PATCH /api/compliance/profile/{id}/ updates the profile."""
        # First GET to ensure the profile exists and get its ID
        get_resp = self.client.get('/api/compliance/profile/')
        profile_id = get_resp.json()['id']

        response = self.client.patch(
            f'/api/compliance/profile/{profile_id}/',
            {
                'requires_pur_reporting': True,
                'requires_fsma_compliance': True,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['requires_pur_reporting'])
        self.assertTrue(response.json()['requires_fsma_compliance'])

    def test_update_compliance_profile_unauthenticated(self):
        # Get profile ID first
        get_resp = self.client.get('/api/compliance/profile/')
        profile_id = get_resp.json()['id']

        client = APIClient()
        response = client.patch(
            f'/api/compliance/profile/{profile_id}/',
            {'requires_pur_reporting': True},
            format='json',
        )
        self.assertEqual(response.status_code, 401)

    # --- COMPANY SCOPING ---

    def test_compliance_profile_company_scoping(self):
        """Each company gets its own profile; other company's profile is inaccessible."""
        # Create profile for company A
        resp_a = self.client.get('/api/compliance/profile/')
        profile_a_company = resp_a.json()['company']

        # Company B
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        resp_b = other_client.get('/api/compliance/profile/')
        self.assertEqual(resp_b.status_code, 200)
        profile_b_company = resp_b.json()['company']

        # Each company has a distinct profile
        self.assertNotEqual(profile_a_company, profile_b_company)

    # --- CREATE/DELETE NOT ALLOWED ---

    def test_create_compliance_profile_not_allowed(self):
        """POST should not be allowed -- profiles are auto-created."""
        response = self.client.post('/api/compliance/profile/', {
            'primary_state': 'CA',
        }, format='json')
        self.assertIn(response.status_code, (405, 403))

    def test_delete_compliance_profile_not_allowed(self):
        """DELETE should not be allowed on compliance profiles."""
        get_resp = self.client.get('/api/compliance/profile/')
        profile_id = get_resp.json()['id']

        response = self.client.delete(f'/api/compliance/profile/{profile_id}/')
        self.assertIn(response.status_code, (405, 403))

    # --- IDEMPOTENT GET ---

    def test_get_compliance_profile_idempotent(self):
        """Multiple GETs return the same profile (not duplicated)."""
        resp1 = self.client.get('/api/compliance/profile/')
        resp2 = self.client.get('/api/compliance/profile/')
        self.assertEqual(resp1.json()['id'], resp2.json()['id'])


# =============================================================================
# CROSS-CUTTING: FULL PIPELINE INTEGRATION TEST
# =============================================================================

class FullPipelineIntegrationTests(TestCase):
    """
    Integration tests using the full pipeline factory to verify
    end-to-end data visibility and cross-entity references.
    """

    def setUp(self):
        self.factory = TestDataFactory()
        self.pipeline = self.factory.create_full_pipeline()
        self.client = self.factory.create_authenticated_client(
            self.pipeline['user']
        )

    def test_all_entities_visible(self):
        """All pipeline entities are visible to the owning user."""
        endpoints = [
            '/api/farms/',
            '/api/fields/',
            '/api/harvests/',
            '/api/packinghouses/',
            '/api/pools/',
            '/api/fsma/traceability-lots/',
        ]
        for url in endpoints:
            response = self.client.get(url)
            self.assertEqual(
                response.status_code, 200,
                f"Failed on {url}: {response.status_code}"
            )
            results = _get_results(response)
            self.assertGreaterEqual(
                len(results), 1,
                f"No results for {url}"
            )

    def test_pipeline_entities_invisible_to_other_company(self):
        """All pipeline entities are invisible to a different company's user."""
        other_company, other_user = self.factory.create_company_with_user()
        other_client = self.factory.create_authenticated_client(other_user)

        endpoints = [
            '/api/farms/',
            '/api/fields/',
            '/api/harvests/',
            '/api/packinghouses/',
            '/api/pools/',
            '/api/fsma/traceability-lots/',
        ]
        for url in endpoints:
            response = other_client.get(url)
            self.assertEqual(response.status_code, 200)
            results = _get_results(response)
            self.assertEqual(
                len(results), 0,
                f"Unexpected data leaked on {url}"
            )

    def test_harvest_references_correct_field(self):
        """Harvest detail references the correct field and farm."""
        harvest = self.pipeline['harvest']
        response = self.client.get(f'/api/harvests/{harvest.id}/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['field'], self.pipeline['field'].id)
        self.assertEqual(data['farm_name'], self.pipeline['farm'].name)

    def test_lot_references_correct_harvest(self):
        """Traceability lot references the correct harvest."""
        lot = self.pipeline['lot']
        response = self.client.get(f'/api/fsma/traceability-lots/{lot.id}/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['harvest'], self.pipeline['harvest'].id)

    def test_pool_belongs_to_correct_packinghouse(self):
        """Pool detail references the correct packinghouse."""
        pool = self.pipeline['pool']
        response = self.client.get(f'/api/pools/{pool.id}/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['packinghouse'], self.pipeline['packinghouse'].id)
