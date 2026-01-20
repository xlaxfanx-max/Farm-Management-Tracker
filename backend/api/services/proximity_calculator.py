"""
Proximity Calculator Service

Calculates distances between farms/fields and disease detections
using the Haversine formula for accurate great-circle distances.
"""

from math import radians, cos, sin, asin, sqrt
from decimal import Decimal
from typing import List, Tuple, Optional, Dict
import logging

logger = logging.getLogger(__name__)


def haversine_miles(lat1, lon1, lat2, lon2) -> float:
    """
    Calculate the great circle distance between two points
    on earth (specified in decimal degrees).

    Returns distance in miles.

    Args:
        lat1, lon1: First point coordinates
        lat2, lon2: Second point coordinates

    Returns:
        Distance in miles
    """
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(radians, [
        float(lat1), float(lon1), float(lat2), float(lon2)
    ])

    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))

    # Earth radius in miles
    r = 3956

    return c * r


class ProximityCalculator:
    """
    Calculate proximity between farms/fields and disease detections.
    """

    def get_farms_near_detection(
        self,
        detection,
        radius_miles: float = 10.0
    ) -> List[Tuple]:
        """
        Find all farms within radius of a detection.

        Args:
            detection: ExternalDetection instance
            radius_miles: Search radius in miles

        Returns:
            List of (Farm, distance_miles) tuples sorted by distance
        """
        from api.models import Farm

        results = []

        farms = Farm.objects.filter(
            gps_latitude__isnull=False,
            gps_longitude__isnull=False
        ).select_related('company')

        for farm in farms:
            distance = haversine_miles(
                farm.gps_latitude, farm.gps_longitude,
                detection.latitude, detection.longitude
            )

            if distance <= radius_miles:
                results.append((farm, round(distance, 2)))

        return sorted(results, key=lambda x: x[1])

    def get_fields_near_detection(
        self,
        detection,
        radius_miles: float = 10.0
    ) -> List[Tuple]:
        """
        Find all fields within radius of a detection.

        Args:
            detection: ExternalDetection instance
            radius_miles: Search radius in miles

        Returns:
            List of (Field, distance_miles) tuples sorted by distance
        """
        from api.models import Field

        results = []

        fields = Field.objects.filter(
            gps_latitude__isnull=False,
            gps_longitude__isnull=False,
            active=True
        ).select_related('farm', 'farm__company')

        for field in fields:
            distance = haversine_miles(
                field.gps_latitude, field.gps_longitude,
                detection.latitude, detection.longitude
            )

            if distance <= radius_miles:
                results.append((field, round(distance, 2)))

        return sorted(results, key=lambda x: x[1])

    def get_nearest_detection_for_farm(
        self,
        farm,
        disease_types: List[str] = None,
        active_only: bool = True
    ) -> Optional[Tuple]:
        """
        Find nearest disease detection to a farm.

        Args:
            farm: Farm instance
            disease_types: List of disease types to filter (e.g., ['hlb', 'acp'])
            active_only: Only consider active detections

        Returns:
            (ExternalDetection, distance_miles) or None
        """
        from api.models import ExternalDetection

        if not farm.gps_latitude or not farm.gps_longitude:
            return None

        detections = ExternalDetection.objects.all()

        if disease_types:
            detections = detections.filter(disease_type__in=disease_types)

        if active_only:
            detections = detections.filter(is_active=True)

        nearest = None
        nearest_distance = float('inf')

        for detection in detections:
            distance = haversine_miles(
                farm.gps_latitude, farm.gps_longitude,
                detection.latitude, detection.longitude
            )

            if distance < nearest_distance:
                nearest = detection
                nearest_distance = distance

        if nearest:
            return (nearest, round(nearest_distance, 2))
        return None

    def get_nearest_detection_for_field(
        self,
        field,
        disease_types: List[str] = None,
        active_only: bool = True
    ) -> Optional[Tuple]:
        """
        Find nearest disease detection to a field.

        Args:
            field: Field instance
            disease_types: List of disease types to filter
            active_only: Only consider active detections

        Returns:
            (ExternalDetection, distance_miles) or None
        """
        from api.models import ExternalDetection

        if not field.gps_latitude or not field.gps_longitude:
            return None

        detections = ExternalDetection.objects.all()

        if disease_types:
            detections = detections.filter(disease_type__in=disease_types)

        if active_only:
            detections = detections.filter(is_active=True)

        nearest = None
        nearest_distance = float('inf')

        for detection in detections:
            distance = haversine_miles(
                field.gps_latitude, field.gps_longitude,
                detection.latitude, detection.longitude
            )

            if distance < nearest_distance:
                nearest = detection
                nearest_distance = distance

        if nearest:
            return (nearest, round(nearest_distance, 2))
        return None

    def get_proximity_risks_for_company(
        self,
        company_id: int,
        radius_miles: float = 15.0
    ) -> Dict:
        """
        Get all proximity risks for a company's farms.

        Args:
            company_id: Company ID
            radius_miles: Search radius in miles

        Returns:
            Dict with farms at risk and summary statistics
            {
                "farms": [
                    {
                        "farm_id": 1,
                        "farm_name": "Ranch A",
                        "risks": [
                            {
                                "detection_id": 5,
                                "disease_type": "hlb",
                                "disease_name": "Huanglongbing",
                                "distance_miles": 8.3,
                                "detection_date": "2026-01-10",
                                "location_type": "residential"
                            }
                        ]
                    }
                ],
                "summary": {
                    "farms_at_risk": 2,
                    "nearest_hlb_miles": 8.3,
                    "nearest_acp_miles": 5.1,
                    "detections_within_radius": 3
                }
            }
        """
        from api.models import Farm, ExternalDetection

        farms = Farm.objects.filter(
            company_id=company_id,
            gps_latitude__isnull=False,
            gps_longitude__isnull=False
        )

        active_detections = list(ExternalDetection.objects.filter(is_active=True))

        results = {"farms": [], "summary": {}}
        farms_at_risk = 0
        nearest_hlb = float('inf')
        nearest_acp = float('inf')
        total_detections_nearby = set()

        for farm in farms:
            farm_risks = []

            for detection in active_detections:
                distance = haversine_miles(
                    farm.gps_latitude, farm.gps_longitude,
                    detection.latitude, detection.longitude
                )

                if distance <= radius_miles:
                    farm_risks.append({
                        "detection_id": detection.id,
                        "disease_type": detection.disease_type,
                        "disease_name": detection.disease_name,
                        "distance_miles": round(distance, 1),
                        "detection_date": detection.detection_date.isoformat(),
                        "location_type": detection.location_type,
                        "county": detection.county
                    })

                    total_detections_nearby.add(detection.id)

                    if detection.disease_type == 'hlb' and distance < nearest_hlb:
                        nearest_hlb = distance
                    if detection.disease_type == 'acp' and distance < nearest_acp:
                        nearest_acp = distance

            if farm_risks:
                farms_at_risk += 1
                results["farms"].append({
                    "farm_id": farm.id,
                    "farm_name": farm.name,
                    "latitude": float(farm.gps_latitude),
                    "longitude": float(farm.gps_longitude),
                    "risks": sorted(farm_risks, key=lambda x: x["distance_miles"])
                })

        results["summary"] = {
            "farms_at_risk": farms_at_risk,
            "total_farms": farms.count(),
            "nearest_hlb_miles": round(nearest_hlb, 1) if nearest_hlb != float('inf') else None,
            "nearest_acp_miles": round(nearest_acp, 1) if nearest_acp != float('inf') else None,
            "detections_within_radius": len(total_detections_nearby)
        }

        return results

    def get_detections_near_point(
        self,
        latitude: float,
        longitude: float,
        radius_miles: float = 10.0,
        disease_types: List[str] = None,
        active_only: bool = True
    ) -> List[Dict]:
        """
        Get all disease detections near a specific point.

        Args:
            latitude: Point latitude
            longitude: Point longitude
            radius_miles: Search radius
            disease_types: Filter by disease types
            active_only: Only active detections

        Returns:
            List of detection dicts with distance
        """
        from api.models import ExternalDetection

        detections = ExternalDetection.objects.all()

        if disease_types:
            detections = detections.filter(disease_type__in=disease_types)
        if active_only:
            detections = detections.filter(is_active=True)

        results = []

        for detection in detections:
            distance = haversine_miles(
                latitude, longitude,
                detection.latitude, detection.longitude
            )

            if distance <= radius_miles:
                results.append({
                    "id": detection.id,
                    "disease_type": detection.disease_type,
                    "disease_name": detection.disease_name,
                    "latitude": float(detection.latitude),
                    "longitude": float(detection.longitude),
                    "county": detection.county,
                    "city": detection.city,
                    "location_type": detection.location_type,
                    "detection_date": detection.detection_date.isoformat(),
                    "distance_miles": round(distance, 2)
                })

        return sorted(results, key=lambda x: x["distance_miles"])

    def calculate_company_risk_score(
        self,
        company_id: int
    ) -> Dict:
        """
        Calculate overall disease risk score for a company.

        Risk factors:
        - Proximity to HLB detections (highest weight)
        - Proximity to ACP activity
        - Number of detections within 15 miles
        - Regional detection density

        Args:
            company_id: Company ID

        Returns:
            Dict with risk score and contributing factors
        """
        risks = self.get_proximity_risks_for_company(company_id, radius_miles=15.0)

        score = 0
        factors = []

        # HLB proximity (up to 50 points)
        hlb_miles = risks["summary"]["nearest_hlb_miles"]
        if hlb_miles is not None:
            if hlb_miles <= 5:
                score += 50
                factors.append(f"HLB detected within 5 miles ({hlb_miles} mi)")
            elif hlb_miles <= 10:
                score += 35
                factors.append(f"HLB detected within 10 miles ({hlb_miles} mi)")
            elif hlb_miles <= 15:
                score += 20
                factors.append(f"HLB detected within 15 miles ({hlb_miles} mi)")

        # ACP proximity (up to 30 points)
        acp_miles = risks["summary"]["nearest_acp_miles"]
        if acp_miles is not None:
            if acp_miles <= 5:
                score += 30
                factors.append(f"ACP activity within 5 miles ({acp_miles} mi)")
            elif acp_miles <= 10:
                score += 20
                factors.append(f"ACP activity within 10 miles ({acp_miles} mi)")
            elif acp_miles <= 15:
                score += 10
                factors.append(f"ACP activity within 15 miles ({acp_miles} mi)")

        # Detection density (up to 20 points)
        detection_count = risks["summary"]["detections_within_radius"]
        if detection_count >= 5:
            score += 20
            factors.append(f"High detection density ({detection_count} within 15 mi)")
        elif detection_count >= 3:
            score += 10
            factors.append(f"Moderate detection density ({detection_count} within 15 mi)")
        elif detection_count >= 1:
            score += 5
            factors.append(f"Some detections nearby ({detection_count} within 15 mi)")

        # Determine risk level
        if score >= 60:
            risk_level = "critical"
        elif score >= 40:
            risk_level = "high"
        elif score >= 20:
            risk_level = "moderate"
        else:
            risk_level = "low"

        return {
            "risk_score": min(100, score),
            "risk_level": risk_level,
            "factors": factors,
            "farms_at_risk": risks["summary"]["farms_at_risk"],
            "total_farms": risks["summary"]["total_farms"]
        }
