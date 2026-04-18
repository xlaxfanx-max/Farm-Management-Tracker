"""
Tests for the HLB risk scoring service.

These tests focus on the component functions because the full scorer
stitches them together — proving each component reacts correctly to its
inputs gives confidence in the weighted sum without needing to assert
exact numeric scores (which would make the tests brittle to weight tuning).
"""

from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from api.models import (
    Company,
    DetectedTree,
    ExternalDetection,
    Farm,
    Field,
    QuarantineZone,
    TreeSurvey,
)
from api.services.hlb_risk_service import (
    _piecewise,
    _point_in_polygon,
    score_field_hlb_risk,
    PROXIMITY_DECAY,
)


class ProximityDecayTests(TestCase):
    def test_zero_miles_is_max(self):
        self.assertEqual(_piecewise(0.0), 100.0)

    def test_far_is_zero(self):
        self.assertEqual(_piecewise(100.0), 0.0)

    def test_linear_interpolation_midpoint(self):
        # Between (3.0, 75) and (5.0, 55) at 4 miles → 65
        self.assertAlmostEqual(_piecewise(4.0), 65.0, places=1)


class PointInPolygonTests(TestCase):
    def test_inside_simple_square(self):
        polygon = {
            'type': 'Polygon',
            'coordinates': [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]],
        }
        self.assertTrue(_point_in_polygon(5, 5, polygon))

    def test_outside_simple_square(self):
        polygon = {
            'type': 'Polygon',
            'coordinates': [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]],
        }
        self.assertFalse(_point_in_polygon(20, 20, polygon))

    def test_malformed_returns_false(self):
        self.assertFalse(_point_in_polygon(5, 5, {'type': 'Polygon', 'coordinates': []}))
        self.assertFalse(_point_in_polygon(5, 5, None))


class HLBRiskScoringTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(name='Citrus Co')
        cls.farm = Farm.objects.create(
            company=cls.company, name='North',
            gps_latitude=Decimal('34.2000000'),
            gps_longitude=Decimal('-119.1000000'),
        )
        cls.field = Field.objects.create(
            farm=cls.farm, name='Block 1',
            total_acres=Decimal('10.00'),
            current_crop='Navel Oranges',
            gps_latitude=Decimal('34.2000000'),
            gps_longitude=Decimal('-119.1000000'),
        )

    def test_no_data_returns_low_risk(self):
        """A field with no nearby detections, no survey, no zones → low risk."""
        assessment = score_field_hlb_risk(self.field)
        self.assertEqual(assessment.risk_level, 'low')
        self.assertEqual(assessment.nearest_hlb_miles, None)
        self.assertEqual(assessment.acp_detections_90d, 0)
        self.assertFalse(assessment.inside_hlb_zone)

    def test_nearby_hlb_detection_escalates_risk(self):
        # Put an HLB detection right next to the field (~0.07 miles)
        ExternalDetection.objects.create(
            source='cdfa', disease_type='hlb', disease_name='HLB',
            latitude=Decimal('34.2010000'),
            longitude=Decimal('-119.1000000'),
            county='Ventura',
            detection_date=date.today() - timedelta(days=5),
            reported_date=date.today() - timedelta(days=5),
            is_active=True,
        )
        assessment = score_field_hlb_risk(self.field)
        self.assertIn(assessment.risk_level, ('high', 'critical'))
        self.assertIsNotNone(assessment.nearest_hlb_miles)
        self.assertLess(assessment.nearest_hlb_miles, 1.0)
        self.assertGreaterEqual(assessment.components['proximity'], 90)
        # Factor narrative mentions HLB proximity
        self.assertTrue(any('HLB' in f for f in assessment.factors))

    def test_distant_hlb_detection_is_low_risk(self):
        # Detection 100 miles away should not drive the score up meaningfully
        ExternalDetection.objects.create(
            source='cdfa', disease_type='hlb', disease_name='HLB',
            latitude=Decimal('33.5000000'),
            longitude=Decimal('-118.0000000'),
            county='Los Angeles',
            detection_date=date.today() - timedelta(days=5),
            reported_date=date.today() - timedelta(days=5),
            is_active=True,
        )
        assessment = score_field_hlb_risk(self.field)
        self.assertEqual(assessment.risk_level, 'low')
        self.assertEqual(assessment.components['proximity'], 0.0)

    def test_acp_cluster_contributes_vector_pressure(self):
        # Five ACP detections within 5mi, recent
        for i in range(5):
            ExternalDetection.objects.create(
                source='cdfa', disease_type='acp', disease_name='ACP',
                latitude=Decimal('34.2000000') + Decimal(f'0.0{i}'),
                longitude=Decimal('-119.1000000'),
                county='Ventura',
                detection_date=date.today() - timedelta(days=10),
                reported_date=date.today() - timedelta(days=10),
                is_active=True,
            )
        assessment = score_field_hlb_risk(self.field)
        self.assertGreater(assessment.components['vector_pressure'], 20)
        self.assertGreaterEqual(assessment.acp_detections_90d, 3)

    def test_acp_outside_lookback_window_ignored(self):
        ExternalDetection.objects.create(
            source='cdfa', disease_type='acp', disease_name='ACP',
            latitude=Decimal('34.2010000'),
            longitude=Decimal('-119.1000000'),
            county='Ventura',
            detection_date=date.today() - timedelta(days=400),
            reported_date=date.today() - timedelta(days=400),
            is_active=True,
        )
        assessment = score_field_hlb_risk(self.field, lookback_days=90)
        self.assertEqual(assessment.components['vector_pressure'], 0.0)
        self.assertEqual(assessment.acp_detections_90d, 0)

    def test_stressed_trees_drive_host_vulnerability(self):
        survey = TreeSurvey.objects.create(
            field=self.field,
            status='completed',
            image_type='multispectral',
            capture_date=date.today() - timedelta(days=30),
            has_nir=True,
        )
        # 8 healthy, 2 stressed
        for i in range(8):
            DetectedTree.objects.create(
                survey=survey,
                latitude=34.2 + i * 0.001, longitude=-119.1,
                confidence=0.9,
                canopy_diameter_m=3.0,
                ndvi_mean=0.75,
                health_category='healthy',
            )
        for i in range(2):
            DetectedTree.objects.create(
                survey=survey,
                latitude=34.2 + (8 + i) * 0.001, longitude=-119.1,
                confidence=0.9,
                canopy_diameter_m=2.0,
                ndvi_mean=0.3,
                health_category='stressed',
            )
        assessment = score_field_hlb_risk(self.field)
        # 20% stressed — non-zero host vulnerability contribution
        self.assertGreater(assessment.components['host_vulnerability'], 20)

    def test_field_inside_hlb_zone_marks_flag(self):
        QuarantineZone.objects.create(
            zone_type='hlb',
            name='Test HLB Zone',
            boundary={
                'type': 'Polygon',
                'coordinates': [[
                    [-119.2, 34.1], [-119.0, 34.1],
                    [-119.0, 34.3], [-119.2, 34.3],
                    [-119.2, 34.1],
                ]],
            },
            source='test',
            established_date=date(2026, 1, 1),
        )
        assessment = score_field_hlb_risk(self.field)
        self.assertTrue(assessment.inside_hlb_zone)
        self.assertEqual(assessment.components['zone_exposure'], 100.0)
        self.assertTrue(any('HLB quarantine' in f for f in assessment.factors))

    def test_recommendations_scale_with_level(self):
        # Drop HLB detection on-site to force high risk
        ExternalDetection.objects.create(
            source='cdfa', disease_type='hlb', disease_name='HLB',
            latitude=Decimal('34.2001000'),
            longitude=Decimal('-119.1000000'),
            county='Ventura',
            detection_date=date.today() - timedelta(days=5),
            reported_date=date.today() - timedelta(days=5),
            is_active=True,
        )
        assessment = score_field_hlb_risk(self.field)
        self.assertIn(assessment.risk_level, ('high', 'critical'))
        # Should get concrete action recommendations, not just abstract ones
        self.assertTrue(len(assessment.recommendations) >= 2)
        self.assertTrue(
            any('scout' in r.lower() for r in assessment.recommendations),
            f"Expected scouting recommendation, got: {assessment.recommendations}",
        )

    def test_data_gaps_populated_when_no_survey_or_coords(self):
        # Field with no GPS — should report data gap, not crash
        orphan_field = Field.objects.create(
            farm=self.farm, name='No-GPS Block',
            total_acres=Decimal('5.00'),
            current_crop='Valencia',
        )
        assessment = score_field_hlb_risk(orphan_field)
        self.assertIn(
            'no GPS coordinates',
            ' '.join(assessment.data_gaps).lower(),
        )
        # Still returns a valid assessment (score stays low)
        self.assertEqual(assessment.risk_level, 'low')
