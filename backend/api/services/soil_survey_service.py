"""
Soil Survey Service for Yield Forecasting.

Fetches soil data from USDA SSURGO via the Soil Data Mart (SDM) REST API.
Caches results in the SoilSurveyData model for each field.
"""
import logging
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

import requests

logger = logging.getLogger(__name__)


@dataclass
class SoilProperties:
    """Parsed soil properties from SSURGO query."""
    mukey: str = ''
    musym: str = ''
    muname: str = ''
    texture_class: str = ''
    clay_pct: Optional[Decimal] = None
    sand_pct: Optional[Decimal] = None
    silt_pct: Optional[Decimal] = None
    organic_matter_pct: Optional[Decimal] = None
    ph: Optional[Decimal] = None
    cec: Optional[Decimal] = None
    available_water_capacity: Optional[Decimal] = None
    drainage_class: str = ''
    depth_to_restrictive_layer_cm: Optional[int] = None
    ksat: Optional[Decimal] = None
    raw_response: dict = None

    def __post_init__(self):
        if self.raw_response is None:
            self.raw_response = {}


class SoilSurveyService:
    """
    Fetches soil data from USDA Web Soil Survey / SSURGO via the SDM REST API.

    Usage:
        service = SoilSurveyService()
        props = service.fetch_soil_properties(lat=34.4285, lon=-119.229)
        if props:
            service.save_to_field(field_id=42, properties=props)
    """

    BASE_URL = 'https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest'
    TIMEOUT = 30  # seconds

    def fetch_soil_properties(self, lat: float, lon: float) -> Optional[SoilProperties]:
        """
        Fetch soil properties for a GPS coordinate from SSURGO.

        Uses a point-in-polygon query to find the map unit, then retrieves
        the dominant component's soil properties.
        """
        try:
            # Step 1: Get map unit key for the coordinate
            mukey = self._get_mukey_for_point(lat, lon)
            if not mukey:
                logger.warning(f"No SSURGO map unit found for ({lat}, {lon})")
                return None

            # Step 2: Get soil properties for the map unit
            return self._get_soil_properties_for_mukey(mukey)

        except requests.RequestException as e:
            logger.error(f"SSURGO API request failed for ({lat}, {lon}): {e}")
            return None
        except Exception as e:
            logger.error(f"Error fetching soil data for ({lat}, {lon}): {e}")
            return None

    def save_to_field(self, field_id: int, properties: SoilProperties) -> 'SoilSurveyData':
        """Create or update SoilSurveyData record for a field."""
        from api.models import SoilSurveyData

        obj, _ = SoilSurveyData.objects.update_or_create(
            field_id=field_id,
            defaults={
                'mukey': properties.mukey,
                'musym': properties.musym,
                'muname': properties.muname,
                'texture_class': properties.texture_class,
                'clay_pct': properties.clay_pct,
                'sand_pct': properties.sand_pct,
                'silt_pct': properties.silt_pct,
                'organic_matter_pct': properties.organic_matter_pct,
                'ph': properties.ph,
                'cec': properties.cec,
                'available_water_capacity': properties.available_water_capacity,
                'drainage_class': properties.drainage_class,
                'depth_to_restrictive_layer_cm': properties.depth_to_restrictive_layer_cm,
                'ksat': properties.ksat,
                'raw_response': properties.raw_response,
            }
        )
        return obj

    def sync_all_fields(self, company_id: int, force: bool = False) -> dict:
        """
        Sync soil data for all fields with GPS coordinates in a company.

        Args:
            company_id: Company to sync fields for
            force: Re-fetch even if data already exists

        Returns:
            Summary dict with counts of synced, skipped, and errored fields
        """
        from api.models import Field

        fields = Field.objects.select_related('farm').filter(
            farm__company_id=company_id,
            farm__active=True,
        ).exclude(
            farm__gps_latitude__isnull=True,
        ).exclude(
            farm__gps_longitude__isnull=True,
        )

        summary = {'synced': 0, 'skipped': 0, 'errors': 0, 'no_gps': 0}

        for field in fields:
            # Use field GPS if available, fall back to farm GPS
            lat = float(field.gps_latitude) if field.gps_latitude else None
            lon = float(field.gps_longitude) if field.gps_longitude else None
            if not lat or not lon:
                lat = float(field.farm.gps_latitude) if field.farm.gps_latitude else None
                lon = float(field.farm.gps_longitude) if field.farm.gps_longitude else None

            if not lat or not lon:
                summary['no_gps'] += 1
                continue

            # Skip if already has data (unless force)
            if not force and hasattr(field, 'soil_survey'):
                try:
                    field.soil_survey
                    summary['skipped'] += 1
                    continue
                except Exception:
                    pass

            props = self.fetch_soil_properties(lat, lon)
            if props:
                self.save_to_field(field.id, props)
                summary['synced'] += 1
            else:
                summary['errors'] += 1

        return summary

    def _get_mukey_for_point(self, lat: float, lon: float) -> Optional[str]:
        """Query SSURGO for the map unit key at a GPS point."""
        query = f"""
            SELECT mukey, musym, muname
            FROM mapunit
            WHERE mukey IN (
                SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84(
                    'POINT({lon} {lat})'
                )
            )
        """
        response = self._execute_sdm_query(query)
        if not response:
            return None

        table = response.get('Table', [])
        if not table:
            return None

        return table[0].get('mukey')

    def _get_soil_properties_for_mukey(self, mukey: str) -> Optional[SoilProperties]:
        """Fetch detailed soil properties for a SSURGO map unit key."""
        # Get map unit info + dominant component properties
        query = f"""
            SELECT
                mu.mukey, mu.musym, mu.muname,
                c.compname, c.comppct_r,
                c.drainagecl,
                ct.texcl AS texture_class,
                ch.claytotal_r AS clay_pct,
                ch.sandtotal_r AS sand_pct,
                ch.silttotal_r AS silt_pct,
                ch.om_r AS organic_matter_pct,
                ch.ph1to1h2o_r AS ph,
                ch.cec7_r AS cec,
                ch.awc_r AS available_water_capacity,
                ch.ksat_r AS ksat,
                cr.resdept_r AS depth_to_restrictive_layer_cm
            FROM mapunit mu
            INNER JOIN component c ON c.mukey = mu.mukey
            LEFT JOIN chorizon ch ON ch.cokey = c.cokey
            LEFT JOIN chtexturegrp ctg ON ctg.chkey = ch.chkey AND ctg.rvindicator = 'Yes'
            LEFT JOIN chtexture ct ON ct.chtgkey = ctg.chtgkey
            LEFT JOIN corestrictions cr ON cr.cokey = c.cokey
            WHERE mu.mukey = '{mukey}'
                AND c.comppct_r = (
                    SELECT MAX(c2.comppct_r)
                    FROM component c2
                    WHERE c2.mukey = mu.mukey
                )
            ORDER BY ch.hzdept_r ASC
        """

        response = self._execute_sdm_query(query)
        if not response:
            return None

        table = response.get('Table', [])
        if not table:
            return None

        # Use the first (topmost) horizon for surface soil properties
        row = table[0]

        def to_decimal(val, places=1):
            if val is None:
                return None
            try:
                return Decimal(str(val)).quantize(Decimal(10) ** -places)
            except Exception:
                return None

        return SoilProperties(
            mukey=str(row.get('mukey', '')),
            musym=str(row.get('musym', '')),
            muname=str(row.get('muname', '')),
            texture_class=str(row.get('texture_class', '') or ''),
            clay_pct=to_decimal(row.get('clay_pct')),
            sand_pct=to_decimal(row.get('sand_pct')),
            silt_pct=to_decimal(row.get('silt_pct')),
            organic_matter_pct=to_decimal(row.get('organic_matter_pct'), 2),
            ph=to_decimal(row.get('ph'), 2),
            cec=to_decimal(row.get('cec')),
            available_water_capacity=to_decimal(row.get('available_water_capacity'), 3),
            drainage_class=str(row.get('drainagecl', '') or ''),
            depth_to_restrictive_layer_cm=(
                int(row['depth_to_restrictive_layer_cm'])
                if row.get('depth_to_restrictive_layer_cm') is not None
                else None
            ),
            ksat=to_decimal(row.get('ksat'), 3),
            raw_response=response,
        )

    def _execute_sdm_query(self, query: str) -> Optional[dict]:
        """Execute a query against the USDA Soil Data Mart REST API."""
        payload = {
            'query': query.strip(),
            'format': 'JSON',
        }

        response = requests.post(
            self.BASE_URL,
            json=payload,
            timeout=self.TIMEOUT,
            headers={'Content-Type': 'application/json'},
        )
        response.raise_for_status()

        data = response.json()
        return data
