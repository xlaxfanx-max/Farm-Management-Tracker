"""
CDFA Quarantine Service

Queries the California Department of Food and Agriculture (CDFA) ArcGIS FeatureServer
to determine if a given location falls within an HLB (Huanglongbing) quarantine zone.
"""

import requests
import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional

logger = logging.getLogger(__name__)


class CDFAQuarantineService:
    """
    Service for querying CDFA quarantine boundaries via their public ArcGIS FeatureServer.
    """

    # CDFA Active Quarantines FeatureServer endpoint
    BASE_URL = "https://gis2.cdfa.ca.gov/server/rest/services/Plant/ActiveQuarantines/FeatureServer/0/query"

    # Request timeout in seconds
    TIMEOUT = 10

    def __init__(self):
        self.session = requests.Session()

    def check_hlb_quarantine(
        self,
        latitude: float,
        longitude: float
    ) -> dict:
        """
        Check if a point is within an HLB quarantine zone.

        Args:
            latitude: GPS latitude (WGS84)
            longitude: GPS longitude (WGS84)

        Returns:
            dict with keys:
                - in_quarantine: bool (True if in quarantine zone, False if not, None if error)
                - zone_name: str or None (name of the quarantine zone if applicable)
                - check_timestamp: datetime (when the check was performed)
                - raw_response: dict or None (full API response for debugging)
                - error: str or None (error message if request failed)
        """
        result = {
            'in_quarantine': None,
            'zone_name': None,
            'check_timestamp': datetime.now(),
            'raw_response': None,
            'error': None,
        }

        try:
            # Build query parameters
            params = {
                'where': '1=1',
                'geometry': f'{longitude},{latitude}',
                'geometryType': 'esriGeometryPoint',
                'inSR': '4326',  # WGS84 coordinates
                'spatialRel': 'esriSpatialRelIntersects',
                'outFields': '*',
                'returnGeometry': 'false',
                'f': 'json',
            }

            logger.info(f"Querying CDFA quarantine API for coordinates: ({latitude}, {longitude})")

            response = self.session.get(
                self.BASE_URL,
                params=params,
                timeout=self.TIMEOUT
            )
            response.raise_for_status()

            data = response.json()
            result['raw_response'] = data

            # Check for API-level errors
            if 'error' in data:
                error_msg = data['error'].get('message', 'Unknown API error')
                result['error'] = f"CDFA API error: {error_msg}"
                logger.error(f"CDFA API returned error: {error_msg}")
                return result

            # Parse features
            features = data.get('features', [])

            if features:
                # Point is within at least one quarantine zone
                result['in_quarantine'] = True

                # Extract zone information from first matching feature
                # Look for HLB-specific features
                hlb_features = [
                    f for f in features
                    if 'HLB' in str(f.get('attributes', {})).upper() or
                       'HUANGLONGBING' in str(f.get('attributes', {})).upper() or
                       'CITRUS' in str(f.get('attributes', {})).upper()
                ]

                if hlb_features:
                    attrs = hlb_features[0].get('attributes', {})
                else:
                    attrs = features[0].get('attributes', {})

                # Try common field names for zone/quarantine name
                zone_name = (
                    attrs.get('QuarantineName') or
                    attrs.get('QUARANTINE_NAME') or
                    attrs.get('Name') or
                    attrs.get('NAME') or
                    attrs.get('Pest') or
                    attrs.get('PEST') or
                    'Unknown Quarantine Zone'
                )
                result['zone_name'] = str(zone_name)

                logger.info(f"Location ({latitude}, {longitude}) is in quarantine zone: {zone_name}")
            else:
                # No features returned - point is not in any quarantine zone
                result['in_quarantine'] = False
                logger.info(f"Location ({latitude}, {longitude}) is NOT in any quarantine zone")

            return result

        except requests.exceptions.Timeout:
            result['error'] = "CDFA API request timed out"
            logger.error(f"Timeout querying CDFA API for ({latitude}, {longitude})")
            return result

        except requests.exceptions.ConnectionError:
            result['error'] = "Unable to connect to CDFA API"
            logger.error(f"Connection error querying CDFA API for ({latitude}, {longitude})")
            return result

        except requests.exceptions.RequestException as e:
            result['error'] = f"Network error: {str(e)}"
            logger.error(f"Request exception querying CDFA API: {e}")
            return result

        except ValueError as e:
            result['error'] = f"Invalid response from CDFA API: {str(e)}"
            logger.error(f"JSON parsing error from CDFA API: {e}")
            return result

        except Exception as e:
            result['error'] = f"Unexpected error: {str(e)}"
            logger.exception(f"Unexpected error querying CDFA API: {e}")
            return result

    def check_location(
        self,
        latitude: Optional[Decimal],
        longitude: Optional[Decimal]
    ) -> dict:
        """
        Wrapper that accepts Decimal coordinates (from Django model fields).

        Args:
            latitude: Decimal latitude from model field
            longitude: Decimal longitude from model field

        Returns:
            Same as check_hlb_quarantine, or error dict if coordinates are missing
        """
        if latitude is None or longitude is None:
            return {
                'in_quarantine': None,
                'zone_name': None,
                'check_timestamp': datetime.now(),
                'raw_response': None,
                'error': "Missing GPS coordinates",
            }

        return self.check_hlb_quarantine(
            latitude=float(latitude),
            longitude=float(longitude)
        )
