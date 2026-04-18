"""
HLB (citrus greening) risk scoring for a field.

Citrus greening has no cure — once a tree is infected, removal is the only
reliable response. So the leverage is in *early* detection of risk factors
before the disease establishes: how close are known HLB detections, how
much Asian Citrus Psyllid (ACP, the vector) pressure is in the area, are
our trees already showing canopy decline that would mask early symptoms,
and is the climate currently favorable for vector transmission.

This service combines the existing ExternalDetection, TreeSurvey, and
QuarantineZone infrastructure into a single 0-100 risk score with
explainable components. It is *advisory* — it does not trigger alerts on
its own (DiseaseAlertRule handles that). The score is stable and cheap to
compute so it can power a dashboard widget and a per-field detail view.

Methodology (weighted components):
- Proximity risk (40%)     — distance to nearest active HLB detection
- Vector pressure (20%)    — ACP detections within 10mi, weighted by recency
- Host vulnerability (20%) — % of trees in stressed/critical NDVI bands
- Zone exposure (10%)      — field-in-quarantine check (HLB > ACP)
- Climate favorability (10%) — recent 30-day avg temp vs ACP-optimum band

Risk level thresholds: 80+ critical, 60-79 high, 40-59 moderate, <40 low.

Rationale notes:
- Proximity weight is highest because HLB-positive trees within ACP flight
  range (~5 miles) are the primary driver of risk. Research consistently
  shows that proximity to a HLB-positive residence dominates field risk
  more than any internal factor.
- ACP vector pressure weighted lower than proximity because ACP without
  HLB nearby still lets us respond with targeted sprays.
- Host vulnerability gets meaningful weight because stressed trees are
  both more susceptible AND harder to diagnose (symptom overlap with
  nutrient/water stress).
- Climate component is small and gated on CIMIS availability — it
  degrades gracefully to a neutral 50 when we don't have the data.
"""

from dataclasses import dataclass, field as dataclass_field, asdict
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional

from django.db.models import Avg, Count
from django.utils import timezone


# Component weights — must sum to 1.0
WEIGHTS = {
    'proximity': 0.40,
    'vector_pressure': 0.20,
    'host_vulnerability': 0.20,
    'zone_exposure': 0.10,
    'climate': 0.10,
}

# Proximity decay — miles → sub-score (0-100). Linear interpolation between
# points. 0 miles means the detection is on the field itself.
PROXIMITY_DECAY = [
    (0.0, 100.0),
    (1.0, 95.0),
    (3.0, 75.0),
    (5.0, 55.0),
    (10.0, 30.0),
    (20.0, 15.0),
    (40.0, 0.0),
]

ACP_OPTIMUM_LOW_F = 77.0
ACP_OPTIMUM_HIGH_F = 86.0
ACP_FAVORABLE_LOW_F = 70.0
ACP_FAVORABLE_HIGH_F = 95.0


@dataclass
class HLBRiskAssessment:
    field_id: int
    field_name: str
    risk_score: float
    risk_level: str  # low | moderate | high | critical
    components: dict  # raw sub-scores 0-100 per component
    factors: List[str] = dataclass_field(default_factory=list)
    recommendations: List[str] = dataclass_field(default_factory=list)
    data_gaps: List[str] = dataclass_field(default_factory=list)
    computed_at: str = ''
    nearest_hlb_miles: Optional[float] = None
    acp_detections_90d: int = 0
    inside_hlb_zone: bool = False
    inside_acp_zone: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


# =============================================================================
# Component scoring
# =============================================================================

def _piecewise(miles: float, table=PROXIMITY_DECAY) -> float:
    """Linear interpolation between miles→score anchor points."""
    if miles is None:
        return 0.0
    if miles <= table[0][0]:
        return table[0][1]
    if miles >= table[-1][0]:
        return table[-1][1]
    for (mi_a, sc_a), (mi_b, sc_b) in zip(table, table[1:]):
        if mi_a <= miles <= mi_b:
            frac = (miles - mi_a) / (mi_b - mi_a) if mi_b > mi_a else 0
            return sc_a + frac * (sc_b - sc_a)
    return 0.0


def _score_proximity(field, factors, gaps):
    """Nearest active HLB detection → 0-100."""
    from .proximity_calculator import ProximityCalculator

    if not field.gps_latitude or not field.gps_longitude:
        gaps.append("Field has no GPS coordinates — proximity scoring disabled")
        return 0.0, None

    nearest = ProximityCalculator().get_nearest_detection_for_field(
        field, disease_types=['hlb'], active_only=True,
    )
    if not nearest:
        return 0.0, None

    detection, distance = nearest
    score = _piecewise(float(distance))
    if score >= 75:
        factors.append(
            f"Active HLB detection {distance:.1f} miles away "
            f"({detection.location_type or 'location'}, {detection.county})"
        )
    elif score >= 40:
        factors.append(f"HLB detection within {distance:.0f} miles")
    return score, float(distance)


def _score_vector_pressure(field, lookback_days, factors, gaps):
    """Count ACP detections within 10mi in recent window, weighted by recency."""
    from ..models import ExternalDetection
    from .proximity_calculator import haversine_miles

    if not field.gps_latitude or not field.gps_longitude:
        gaps.append("Field has no GPS coordinates — ACP pressure scoring disabled")
        return 0.0, 0

    cutoff = date.today() - timedelta(days=lookback_days)
    qs = ExternalDetection.objects.filter(
        disease_type='acp', is_active=True, detection_date__gte=cutoff,
    )
    count = 0
    recency_weighted = 0.0
    today = date.today()
    for det in qs:
        dist = haversine_miles(
            field.gps_latitude, field.gps_longitude,
            det.latitude, det.longitude,
        )
        if dist > 10:
            continue
        count += 1
        age = (today - det.detection_date).days
        if age <= 30:
            weight = 1.0
        elif age <= 60:
            weight = 0.7
        else:
            weight = 0.4
        # Closer detections carry more pressure
        proximity_boost = max(0.1, 1.0 - dist / 10.0)
        recency_weighted += weight * proximity_boost * 10  # 10 points per weighted detection

    score = min(100.0, recency_weighted)
    if count >= 10:
        factors.append(f"High ACP activity: {count} detections within 10mi in last {lookback_days}d")
    elif count >= 3:
        factors.append(f"Moderate ACP activity: {count} detections within 10mi")
    elif count > 0:
        factors.append(f"{count} recent ACP detection(s) nearby")
    return score, count


def _score_host_vulnerability(field, factors, gaps):
    """Most recent TreeSurvey → % of trees in stressed+critical bands."""
    from ..models import TreeSurvey, DetectedTree

    survey = (
        TreeSurvey.objects
        .filter(field=field, status='completed')
        .order_by('-capture_date')
        .first()
    )
    if not survey:
        gaps.append("No completed tree survey on record — host vulnerability unknown")
        return 0.0

    trees = DetectedTree.objects.filter(survey=survey)
    total = trees.count()
    if total == 0:
        gaps.append("Tree survey exists but no trees detected")
        return 0.0

    stressed_or_worse = trees.filter(
        health_category__in=['stressed', 'critical'],
    ).count()
    ratio = stressed_or_worse / total
    # 0% stressed → 0; 50%+ → 100; linear in between
    score = min(100.0, ratio * 200.0)

    if ratio >= 0.25:
        factors.append(
            f"{ratio * 100:.0f}% of trees stressed or critical in last survey "
            f"({stressed_or_worse} of {total})"
        )
    elif ratio >= 0.10:
        factors.append(
            f"{ratio * 100:.0f}% of trees showing stress — monitor for HLB symptoms"
        )

    # Stale data caveat
    age_days = (date.today() - survey.capture_date).days if survey.capture_date else None
    if age_days is not None and age_days > 180:
        gaps.append(f"Tree survey is {age_days} days old — consider a fresh flight")
    return score


def _point_in_polygon(lat, lon, boundary) -> bool:
    """Ray casting point-in-polygon for a GeoJSON Polygon / MultiPolygon.

    We accept either ``{"type": "Polygon", "coordinates": [...]}`` or a plain
    list of rings (older records). Returns False on malformed data rather
    than crashing risk scoring."""
    if lat is None or lon is None or not boundary:
        return False
    try:
        geom_type = None
        coords = None
        if isinstance(boundary, dict):
            geom_type = boundary.get('type')
            coords = boundary.get('coordinates')
        else:
            coords = boundary
            geom_type = 'Polygon'

        if geom_type == 'Polygon':
            polygons = [coords[0]] if coords else []
        elif geom_type == 'MultiPolygon':
            polygons = [p[0] for p in (coords or []) if p]
        else:
            polygons = []

        x, y = float(lon), float(lat)
        for ring in polygons:
            inside = False
            n = len(ring)
            if n < 3:
                continue
            j = n - 1
            for i in range(n):
                xi, yi = ring[i][0], ring[i][1]
                xj, yj = ring[j][0], ring[j][1]
                intersect = ((yi > y) != (yj > y)) and (
                    x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi
                )
                if intersect:
                    inside = not inside
                j = i
            if inside:
                return True
    except (TypeError, ValueError, IndexError):
        return False
    return False


def _score_zone_exposure(field, factors, gaps):
    """Is field in an active HLB or ACP quarantine zone?"""
    from ..models import QuarantineZone

    if not field.gps_latitude or not field.gps_longitude:
        return 0.0, False, False

    lat, lon = float(field.gps_latitude), float(field.gps_longitude)
    zones = QuarantineZone.objects.filter(
        is_active=True, zone_type__in=['hlb', 'acp'],
    )

    in_hlb = False
    in_acp = False
    for zone in zones:
        if _point_in_polygon(lat, lon, zone.boundary):
            if zone.zone_type == 'hlb':
                in_hlb = True
            elif zone.zone_type == 'acp':
                in_acp = True

    if in_hlb:
        factors.append("Field is inside an active HLB quarantine zone")
        return 100.0, True, in_acp
    if in_acp:
        factors.append("Field is inside an active ACP quarantine zone")
        return 50.0, False, True
    return 0.0, False, False


def _score_climate(field, factors, gaps):
    """Recent 30-day avg temp vs ACP-favorable band. Returns neutral 50 when
    data is unavailable — we don't want to penalize fields that simply
    haven't been mapped to a CIMIS station."""
    farm = getattr(field, 'farm', None)
    station_id = getattr(farm, 'cimis_station_id', '') if farm else ''
    if not station_id:
        gaps.append("No CIMIS station mapped to farm — climate component neutral")
        return 50.0

    try:
        from .cimis_service import CIMISService
        end = date.today()
        start = end - timedelta(days=30)
        data = CIMISService().get_daily_data(station_id, start, end)
    except Exception:
        gaps.append("CIMIS data unavailable — climate component neutral")
        return 50.0

    temps = [d.get('air_temp_avg') for d in (data or []) if d.get('air_temp_avg') is not None]
    if not temps:
        gaps.append("No recent CIMIS readings — climate component neutral")
        return 50.0

    avg_temp = sum(float(t) for t in temps) / len(temps)
    if ACP_OPTIMUM_LOW_F <= avg_temp <= ACP_OPTIMUM_HIGH_F:
        factors.append(f"Avg temp {avg_temp:.1f}°F is optimal for ACP activity")
        return 100.0
    if ACP_FAVORABLE_LOW_F <= avg_temp <= ACP_FAVORABLE_HIGH_F:
        return 60.0
    return 20.0


# =============================================================================
# Recommendations
# =============================================================================

def _build_recommendations(assessment: HLBRiskAssessment) -> List[str]:
    recs = []
    level = assessment.risk_level
    comps = assessment.components

    if level == 'critical':
        recs.append("Priority scouting this week — trained inspector looking for HLB symptoms (asymmetric blotchy mottle, misshapen bitter fruit)")
        recs.append("Confirm ACP monitoring traps are deployed and checked weekly")
    elif level == 'high':
        recs.append("Scouting within 2 weeks; photograph suspect trees and submit scouting reports")
    elif level == 'moderate':
        recs.append("Routine monthly scouting; flag any individual tree showing canopy decline")

    if comps.get('proximity', 0) >= 55 or assessment.inside_hlb_zone:
        recs.append("Coordinate with county ag commissioner on area-wide ACP management program")

    if comps.get('vector_pressure', 0) >= 50:
        recs.append("Consider a dormant or delayed-dormant application with a non-IRAC-4A MOA to rotate chemistries")

    if comps.get('host_vulnerability', 0) >= 50:
        recs.append("Address underlying tree stress — stressed trees mask HLB symptoms. Review recent irrigation and nutrition data.")

    if comps.get('climate', 0) >= 80:
        recs.append("Climate is favoring ACP reproduction — intensify trap checks and scouting frequency")

    return recs


# =============================================================================
# Public API
# =============================================================================

def _risk_level(score: float) -> str:
    if score >= 80:
        return 'critical'
    if score >= 60:
        return 'high'
    if score >= 40:
        return 'moderate'
    return 'low'


def score_field_hlb_risk(field, lookback_days: int = 90) -> HLBRiskAssessment:
    """Compute the HLB risk assessment for a single field.

    Safe to call cheaply — the expensive parts (proximity + climate) are each
    bounded. Does not write to the database. Callers decide whether to cache.
    """
    factors: List[str] = []
    gaps: List[str] = []

    prox_score, nearest_miles = _score_proximity(field, factors, gaps)
    vector_score, acp_count = _score_vector_pressure(field, lookback_days, factors, gaps)
    host_score = _score_host_vulnerability(field, factors, gaps)
    zone_score, in_hlb, in_acp = _score_zone_exposure(field, factors, gaps)
    climate_score = _score_climate(field, factors, gaps)

    components = {
        'proximity': round(prox_score, 1),
        'vector_pressure': round(vector_score, 1),
        'host_vulnerability': round(host_score, 1),
        'zone_exposure': round(zone_score, 1),
        'climate': round(climate_score, 1),
    }

    total = (
        prox_score * WEIGHTS['proximity']
        + vector_score * WEIGHTS['vector_pressure']
        + host_score * WEIGHTS['host_vulnerability']
        + zone_score * WEIGHTS['zone_exposure']
        + climate_score * WEIGHTS['climate']
    )
    total = round(min(100.0, max(0.0, total)), 1)

    assessment = HLBRiskAssessment(
        field_id=field.id,
        field_name=getattr(field, 'name', f'Field {field.id}'),
        risk_score=total,
        risk_level=_risk_level(total),
        components=components,
        factors=factors,
        data_gaps=gaps,
        computed_at=timezone.now().isoformat(),
        nearest_hlb_miles=round(nearest_miles, 2) if nearest_miles is not None else None,
        acp_detections_90d=acp_count,
        inside_hlb_zone=in_hlb,
        inside_acp_zone=in_acp,
    )
    assessment.recommendations = _build_recommendations(assessment)
    return assessment


def score_company_hlb_risk(company, lookback_days: int = 90) -> List[HLBRiskAssessment]:
    """Score every citrus-bearing field for a company, highest risk first."""
    from ..models import Field

    fields = (
        Field.objects
        .filter(farm__company=company)
        .select_related('farm', 'crop')
    )
    assessments = [score_field_hlb_risk(f, lookback_days) for f in fields]
    assessments.sort(key=lambda a: a.risk_score, reverse=True)
    return assessments
