"""
N+1 Query Detection Tests for Farm Pesticide Tracker

Verifies that list endpoints maintain bounded query counts regardless of
record count. Uses Django's CaptureQueriesContext to assert that queries
don't scale linearly with the number of records returned (the hallmark
of an N+1 problem).

Each test creates 10+ records, then asserts the total query count stays
below a reasonable upper bound. If a test fails, the assertion message
dumps the actual SQL for debugging.
"""

from datetime import date, timedelta
from decimal import Decimal

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from api.models import (
    ComplianceDeadline,
    FertilizerProduct,
    NutrientApplication,
    PackinghouseDelivery,
    PesticideApplication,
    WaterSource,
)
from api.tests.factories import TestDataFactory


def _query_report(captured_queries, label=""):
    """Format captured queries into a readable debug string."""
    lines = [f"--- {label} ({len(captured_queries)} queries) ---"]
    for i, q in enumerate(captured_queries, 1):
        sql_preview = q['sql'][:120].replace('\n', ' ')
        lines.append(f"  {i}. {sql_preview}")
    return "\n".join(lines)


class FarmsQueryPerformanceTests(TestCase):
    """N+1 detection for the /api/farms/ endpoint."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)

    def test_farms_list_bounded_queries(self):
        """Listing 10 farms should not produce per-farm queries."""
        for i in range(10):
            self.factory.create_farm(self.company)

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/farms/')
            self.assertEqual(response.status_code, 200)

        self.assertLessEqual(
            len(ctx.captured_queries), 10,
            f"Too many queries for farms list. "
            f"Possible N+1.\n{_query_report(ctx.captured_queries, 'farms list')}"
        )

    def test_farms_list_query_count_stable_at_scale(self):
        """Query count with 3 farms vs 15 farms should be within 2 of each other."""
        for i in range(3):
            self.factory.create_farm(self.company)

        with CaptureQueriesContext(connection) as ctx_small:
            self.client.get('/api/farms/')
        count_small = len(ctx_small.captured_queries)

        for i in range(12):
            self.factory.create_farm(self.company)

        with CaptureQueriesContext(connection) as ctx_large:
            self.client.get('/api/farms/')
        count_large = len(ctx_large.captured_queries)

        self.assertLessEqual(
            abs(count_large - count_small), 2,
            f"Query count scaled with record count: {count_small} queries for 3 farms "
            f"vs {count_large} queries for 15 farms. "
            f"Likely N+1.\n{_query_report(ctx_large.captured_queries, 'farms 15 records')}"
        )

    def test_farms_list_with_fields_no_extra_queries(self):
        """Farms with varying numbers of fields should not cause extra queries."""
        for i in range(5):
            farm = self.factory.create_farm(self.company)
            for j in range(3):
                self.factory.create_field(farm)

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/farms/')
            self.assertEqual(response.status_code, 200)

        self.assertLessEqual(
            len(ctx.captured_queries), 10,
            f"Too many queries for farms list with fields.\n"
            f"{_query_report(ctx.captured_queries, 'farms+fields')}"
        )


class FieldsQueryPerformanceTests(TestCase):
    """N+1 detection for the /api/fields/ endpoint."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)

    def test_fields_list_bounded_queries(self):
        """Listing 10 fields across 3 farms should use select_related(farm)."""
        farms = [self.factory.create_farm(self.company) for _ in range(3)]
        for i in range(10):
            self.factory.create_field(farms[i % 3])

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/fields/')
            self.assertEqual(response.status_code, 200)

        self.assertLessEqual(
            len(ctx.captured_queries), 10,
            f"Too many queries for fields list. "
            f"Ensure select_related('farm') is active.\n"
            f"{_query_report(ctx.captured_queries, 'fields list')}"
        )

    def test_fields_list_query_count_stable(self):
        """Query count should not grow linearly with field count."""
        farm = self.factory.create_farm(self.company)
        for i in range(3):
            self.factory.create_field(farm)

        with CaptureQueriesContext(connection) as ctx_small:
            self.client.get('/api/fields/')
        count_small = len(ctx_small.captured_queries)

        for i in range(12):
            self.factory.create_field(farm)

        with CaptureQueriesContext(connection) as ctx_large:
            self.client.get('/api/fields/')
        count_large = len(ctx_large.captured_queries)

        self.assertLessEqual(
            abs(count_large - count_small), 2,
            f"Query count scaled: {count_small} for 3 fields vs "
            f"{count_large} for 15 fields.\n"
            f"{_query_report(ctx_large.captured_queries, 'fields 15 records')}"
        )


class HarvestsQueryPerformanceTests(TestCase):
    """N+1 detection for the /api/harvests/ endpoint.

    Harvests are a common N+1 risk due to field__farm joins
    and prefetched loads/labor_records.
    """

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)

    def test_harvests_list_bounded_queries(self):
        """10 harvests across multiple farms should stay bounded."""
        farms = [self.factory.create_farm(self.company) for _ in range(3)]
        fields = [self.factory.create_field(farms[i % 3]) for i in range(5)]

        for i in range(10):
            self.factory.create_harvest(
                fields[i % 5],
                harvest_date=date.today() - timedelta(days=i),
            )

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/harvests/')
            self.assertEqual(response.status_code, 200)

        # HarvestViewSet uses select_related(field, field__farm) +
        # prefetch_related(loads, labor_records) = ~5-8 queries
        self.assertLessEqual(
            len(ctx.captured_queries), 12,
            f"Too many queries for harvests list. "
            f"Check select_related/prefetch_related on HarvestViewSet.\n"
            f"{_query_report(ctx.captured_queries, 'harvests list')}"
        )

    def test_harvests_query_count_stable(self):
        """Query count with 3 vs 12 harvests should be nearly identical."""
        farm = self.factory.create_farm(self.company)
        field = self.factory.create_field(farm)

        for i in range(3):
            self.factory.create_harvest(
                field, harvest_date=date.today() - timedelta(days=i)
            )

        with CaptureQueriesContext(connection) as ctx_small:
            self.client.get('/api/harvests/')
        count_small = len(ctx_small.captured_queries)

        for i in range(9):
            self.factory.create_harvest(
                field, harvest_date=date.today() - timedelta(days=10 + i)
            )

        with CaptureQueriesContext(connection) as ctx_large:
            self.client.get('/api/harvests/')
        count_large = len(ctx_large.captured_queries)

        self.assertLessEqual(
            abs(count_large - count_small), 2,
            f"Query count scaled: {count_small} for 3 harvests vs "
            f"{count_large} for 12 harvests.\n"
            f"{_query_report(ctx_large.captured_queries, 'harvests 12 records')}"
        )

    def test_harvests_with_loads_bounded(self):
        """Harvests with loads should not trigger per-harvest load queries."""
        from api.models import Buyer, HarvestLoad
        farm = self.factory.create_farm(self.company)
        field = self.factory.create_field(farm)
        buyer = self.factory.create_buyer(self.company)

        for i in range(5):
            harvest = self.factory.create_harvest(
                field, harvest_date=date.today() - timedelta(days=i)
            )
            for j in range(3):
                HarvestLoad.objects.create(
                    harvest=harvest,
                    buyer=buyer,
                    load_number=j + 1,
                    bins=10,
                )

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/harvests/')
            self.assertEqual(response.status_code, 200)

        # With prefetch_related, loads are fetched in a single query
        self.assertLessEqual(
            len(ctx.captured_queries), 12,
            f"Too many queries for harvests+loads.\n"
            f"{_query_report(ctx.captured_queries, 'harvests+loads')}"
        )


class TraceabilityLotsQueryPerformanceTests(TestCase):
    """N+1 detection for the /api/fsma/traceability-lots/ endpoint.

    Lots have field, farm, and harvest FK relations that are
    common N+1 sources.
    """

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)

    def test_traceability_lots_list_bounded(self):
        """10 lots with related objects should stay bounded."""
        farms = [self.factory.create_farm(self.company) for _ in range(3)]
        fields = [self.factory.create_field(farms[i % 3]) for i in range(5)]

        for i in range(10):
            field = fields[i % 5]
            harvest = self.factory.create_harvest(
                field, harvest_date=date.today() - timedelta(days=i)
            )
            self.factory.create_traceability_lot(
                self.company,
                harvest=harvest,
                field=field,
                farm=field.farm,
            )

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/fsma/traceability-lots/')
            self.assertEqual(response.status_code, 200)

        # select_related(field, farm, harvest) + annotation + auth ~6-10
        self.assertLessEqual(
            len(ctx.captured_queries), 12,
            f"Too many queries for traceability lots list.\n"
            f"{_query_report(ctx.captured_queries, 'traceability lots')}"
        )

    def test_traceability_lots_query_count_stable(self):
        """Query count should not grow with lot count."""
        farm = self.factory.create_farm(self.company)
        field = self.factory.create_field(farm)

        for i in range(3):
            harvest = self.factory.create_harvest(
                field, harvest_date=date.today() - timedelta(days=i)
            )
            self.factory.create_traceability_lot(
                self.company, harvest=harvest, field=field, farm=farm,
            )

        with CaptureQueriesContext(connection) as ctx_small:
            self.client.get('/api/fsma/traceability-lots/')
        count_small = len(ctx_small.captured_queries)

        for i in range(10):
            harvest = self.factory.create_harvest(
                field, harvest_date=date.today() - timedelta(days=20 + i)
            )
            self.factory.create_traceability_lot(
                self.company, harvest=harvest, field=field, farm=farm,
            )

        with CaptureQueriesContext(connection) as ctx_large:
            self.client.get('/api/fsma/traceability-lots/')
        count_large = len(ctx_large.captured_queries)

        self.assertLessEqual(
            abs(count_large - count_small), 2,
            f"Query count scaled: {count_small} for 3 lots vs "
            f"{count_large} for 13 lots.\n"
            f"{_query_report(ctx_large.captured_queries, 'lots 13 records')}"
        )


class PoolsQueryPerformanceTests(TestCase):
    """N+1 detection for the /api/pools/ endpoint.

    Pools use select_related(packinghouse) and aggregate annotations.
    """

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)

    def test_pools_list_bounded_queries(self):
        """10 pools across 2 packinghouses should stay bounded."""
        ph1 = self.factory.create_packinghouse(self.company)
        ph2 = self.factory.create_packinghouse(self.company)

        for i in range(10):
            ph = ph1 if i < 5 else ph2
            self.factory.create_pool(ph, season=f'2025-{2026 + i % 2}')

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/pools/')
            self.assertEqual(response.status_code, 200)

        self.assertLessEqual(
            len(ctx.captured_queries), 10,
            f"Too many queries for pools list.\n"
            f"{_query_report(ctx.captured_queries, 'pools list')}"
        )

    def test_pools_query_count_stable(self):
        """Query count should not scale with pool count."""
        ph = self.factory.create_packinghouse(self.company)

        for i in range(3):
            self.factory.create_pool(ph)

        with CaptureQueriesContext(connection) as ctx_small:
            self.client.get('/api/pools/')
        count_small = len(ctx_small.captured_queries)

        for i in range(10):
            self.factory.create_pool(ph)

        with CaptureQueriesContext(connection) as ctx_large:
            self.client.get('/api/pools/')
        count_large = len(ctx_large.captured_queries)

        self.assertLessEqual(
            abs(count_large - count_small), 2,
            f"Query count scaled: {count_small} for 3 pools vs "
            f"{count_large} for 13 pools.\n"
            f"{_query_report(ctx_large.captured_queries, 'pools 13 records')}"
        )


class PackinghouseDeliveriesQueryPerformanceTests(TestCase):
    """N+1 detection for the /api/packinghouse-deliveries/ endpoint.

    Deliveries have deep FK chains: pool__packinghouse, field__farm, harvest.
    """

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)

    def test_deliveries_list_bounded_queries(self):
        """10 deliveries with deep FK chains should stay bounded."""
        ph = self.factory.create_packinghouse(self.company)
        pool = self.factory.create_pool(ph)
        farms = [self.factory.create_farm(self.company) for _ in range(3)]
        fields = [self.factory.create_field(farms[i % 3]) for i in range(5)]

        for i in range(10):
            field = fields[i % 5]
            harvest = self.factory.create_harvest(
                field, harvest_date=date.today() - timedelta(days=i)
            )
            PackinghouseDelivery.objects.create(
                pool=pool,
                field=field,
                ticket_number=f'TKT-{i:04d}',
                delivery_date=date.today() - timedelta(days=i),
                bins=Decimal('20.00'),
                harvest=harvest,
            )

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/packinghouse-deliveries/')
            self.assertEqual(response.status_code, 200)

        # select_related covers pool, pool__packinghouse, field, field__farm, harvest
        self.assertLessEqual(
            len(ctx.captured_queries), 10,
            f"Too many queries for deliveries list.\n"
            f"{_query_report(ctx.captured_queries, 'deliveries list')}"
        )


class PesticideApplicationsQueryPerformanceTests(TestCase):
    """N+1 detection for the /api/applications/ endpoint.

    Applications use select_related(field, field__farm, product).
    """

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)

    def test_applications_list_bounded_queries(self):
        """10 applications with products and field joins should stay bounded."""
        farms = [self.factory.create_farm(self.company) for _ in range(2)]
        fields = [self.factory.create_field(farms[i % 2]) for i in range(4)]
        products = [
            self.factory.create_pesticide_product(company=self.company)
            for _ in range(3)
        ]

        for i in range(10):
            self.factory.create_application(
                fields[i % 4],
                product=products[i % 3],
                application_date=date.today() - timedelta(days=30 + i),
            )

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/applications/')
            self.assertEqual(response.status_code, 200)

        self.assertLessEqual(
            len(ctx.captured_queries), 10,
            f"Too many queries for applications list.\n"
            f"{_query_report(ctx.captured_queries, 'applications list')}"
        )

    def test_applications_query_count_stable(self):
        """Query count should not scale with application count."""
        farm = self.factory.create_farm(self.company)
        field = self.factory.create_field(farm)
        product = self.factory.create_pesticide_product(company=self.company)

        for i in range(3):
            self.factory.create_application(
                field, product=product,
                application_date=date.today() - timedelta(days=i),
            )

        with CaptureQueriesContext(connection) as ctx_small:
            self.client.get('/api/applications/')
        count_small = len(ctx_small.captured_queries)

        for i in range(10):
            self.factory.create_application(
                field, product=product,
                application_date=date.today() - timedelta(days=20 + i),
            )

        with CaptureQueriesContext(connection) as ctx_large:
            self.client.get('/api/applications/')
        count_large = len(ctx_large.captured_queries)

        self.assertLessEqual(
            abs(count_large - count_small), 2,
            f"Query count scaled: {count_small} for 3 apps vs "
            f"{count_large} for 13 apps.\n"
            f"{_query_report(ctx_large.captured_queries, 'apps 13 records')}"
        )


class WaterSourcesQueryPerformanceTests(TestCase):
    """N+1 detection for the /api/water-sources/ endpoint.

    WaterSources use select_related(farm) via CompanyFilteredViewSet.
    """

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)

    def test_water_sources_list_bounded_queries(self):
        """10 water sources across farms should stay bounded."""
        farms = [self.factory.create_farm(self.company) for _ in range(3)]

        for i in range(10):
            self.factory.create_water_source(
                company=self.company,
                farm=farms[i % 3],
            )

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/water-sources/')
            self.assertEqual(response.status_code, 200)

        self.assertLessEqual(
            len(ctx.captured_queries), 10,
            f"Too many queries for water sources list.\n"
            f"{_query_report(ctx.captured_queries, 'water sources list')}"
        )


class NutrientApplicationsQueryPerformanceTests(TestCase):
    """N+1 detection for the /api/nutrient-applications/ endpoint.

    NutrientApplications have four FK joins:
    field, field__farm, product, water_source.
    """

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)

    def test_nutrient_applications_list_bounded(self):
        """10 nutrient apps with deep joins should stay bounded."""
        farms = [self.factory.create_farm(self.company) for _ in range(2)]
        fields = [self.factory.create_field(farms[i % 2]) for i in range(4)]
        water_sources = [
            self.factory.create_water_source(company=self.company, farm=farms[i % 2])
            for i in range(2)
        ]
        products = [
            FertilizerProduct.objects.create(
                company=self.company,
                name=f'Fert Product {i}',
                nitrogen_pct=Decimal('21.00'),
                phosphorus_pct=Decimal('0.00'),
                potassium_pct=Decimal('0.00'),
            )
            for i in range(3)
        ]

        for i in range(10):
            NutrientApplication.objects.create(
                field=fields[i % 4],
                product=products[i % 3],
                water_source=water_sources[i % 2],
                application_date=date.today() - timedelta(days=i),
                rate=Decimal('200.000'),
                rate_unit='lbs_acre',
                acres_treated=fields[i % 4].acreage,
            )

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/nutrient-applications/')
            self.assertEqual(response.status_code, 200)

        # select_related covers field, field__farm, product, water_source
        self.assertLessEqual(
            len(ctx.captured_queries), 10,
            f"Too many queries for nutrient applications list.\n"
            f"{_query_report(ctx.captured_queries, 'nutrient apps list')}"
        )


class ComplianceDeadlinesQueryPerformanceTests(TestCase):
    """N+1 detection for the /api/compliance/deadlines/ endpoint."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)

    def test_deadlines_list_bounded_queries(self):
        """10 compliance deadlines should not trigger per-record queries."""
        for i in range(10):
            ComplianceDeadline.objects.create(
                company=self.company,
                name=f'Deadline {i}',
                category='reporting',
                due_date=date.today() + timedelta(days=30 + i),
                status='upcoming',
            )

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/compliance/deadlines/')
            self.assertEqual(response.status_code, 200)

        self.assertLessEqual(
            len(ctx.captured_queries), 10,
            f"Too many queries for compliance deadlines list.\n"
            f"{_query_report(ctx.captured_queries, 'deadlines list')}"
        )


class PackinghousesQueryPerformanceTests(TestCase):
    """N+1 detection for the /api/packinghouses/ endpoint."""

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)

    def test_packinghouses_list_bounded_queries(self):
        """10 packinghouses should not trigger per-record queries."""
        for i in range(10):
            self.factory.create_packinghouse(self.company)

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get('/api/packinghouses/')
            self.assertEqual(response.status_code, 200)

        self.assertLessEqual(
            len(ctx.captured_queries), 10,
            f"Too many queries for packinghouses list.\n"
            f"{_query_report(ctx.captured_queries, 'packinghouses list')}"
        )


class CrossEndpointScalingTests(TestCase):
    """Comparative scaling tests: verify query counts remain constant
    as data volume increases from small to large.

    These tests use the same endpoint twice with different record counts
    and assert the query count delta is minimal.
    """

    def setUp(self):
        self.factory = TestDataFactory()
        self.company, self.user = self.factory.create_company_with_user()
        self.client = self.factory.create_authenticated_client(self.user)

    def _measure_queries(self, url):
        """Return the query count for a GET request to the given URL."""
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200)
        return len(ctx.captured_queries), ctx.captured_queries

    def test_packinghouses_scaling(self):
        """Packinghouses: 2 vs 12 records should produce similar query counts."""
        for i in range(2):
            self.factory.create_packinghouse(self.company)
        count_small, _ = self._measure_queries('/api/packinghouses/')

        for i in range(10):
            self.factory.create_packinghouse(self.company)
        count_large, queries_large = self._measure_queries('/api/packinghouses/')

        self.assertLessEqual(
            abs(count_large - count_small), 2,
            f"Packinghouses queries scaled: {count_small} (2 records) vs "
            f"{count_large} (12 records).\n"
            f"{_query_report(queries_large, 'packinghouses 12 records')}"
        )

    def test_compliance_deadlines_scaling(self):
        """Compliance deadlines: 2 vs 12 records should produce similar counts."""
        for i in range(2):
            ComplianceDeadline.objects.create(
                company=self.company,
                name=f'Deadline {i}',
                category='reporting',
                due_date=date.today() + timedelta(days=30 + i),
                status='upcoming',
            )
        count_small, _ = self._measure_queries('/api/compliance/deadlines/')

        for i in range(10):
            ComplianceDeadline.objects.create(
                company=self.company,
                name=f'Deadline more {i}',
                category='training',
                due_date=date.today() + timedelta(days=60 + i),
                status='upcoming',
            )
        count_large, queries_large = self._measure_queries('/api/compliance/deadlines/')

        self.assertLessEqual(
            abs(count_large - count_small), 2,
            f"Deadlines queries scaled: {count_small} (2 records) vs "
            f"{count_large} (12 records).\n"
            f"{_query_report(queries_large, 'deadlines 12 records')}"
        )

    def test_deliveries_scaling(self):
        """Deliveries: 2 vs 12 records should produce similar query counts."""
        ph = self.factory.create_packinghouse(self.company)
        pool = self.factory.create_pool(ph)
        farm = self.factory.create_farm(self.company)
        field = self.factory.create_field(farm)

        for i in range(2):
            harvest = self.factory.create_harvest(
                field, harvest_date=date.today() - timedelta(days=i)
            )
            PackinghouseDelivery.objects.create(
                pool=pool,
                field=field,
                ticket_number=f'TKT-S-{i:04d}',
                delivery_date=date.today() - timedelta(days=i),
                bins=Decimal('15.00'),
                harvest=harvest,
            )
        count_small, _ = self._measure_queries('/api/packinghouse-deliveries/')

        for i in range(10):
            harvest = self.factory.create_harvest(
                field, harvest_date=date.today() - timedelta(days=20 + i)
            )
            PackinghouseDelivery.objects.create(
                pool=pool,
                field=field,
                ticket_number=f'TKT-L-{i:04d}',
                delivery_date=date.today() - timedelta(days=20 + i),
                bins=Decimal('15.00'),
                harvest=harvest,
            )
        count_large, queries_large = self._measure_queries('/api/packinghouse-deliveries/')

        self.assertLessEqual(
            abs(count_large - count_small), 2,
            f"Deliveries queries scaled: {count_small} (2 records) vs "
            f"{count_large} (12 records).\n"
            f"{_query_report(queries_large, 'deliveries 12 records')}"
        )
