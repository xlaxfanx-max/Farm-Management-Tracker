"""
CIMIS (California Irrigation Management Information System) Service

Fetches reference evapotranspiration (ETo) and weather data from the CIMIS API.
Caches results in CIMISDataCache to minimize API calls.

API Documentation: https://et.water.ca.gov/Rest/Index
"""

import logging
import requests
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)


class CIMISService:
    """
    Service for fetching and caching CIMIS weather data.
    """

    BASE_URL = 'https://et.water.ca.gov/api/data'
    TIMEOUT = 30

    def __init__(self):
        self.app_key = getattr(settings, 'CIMIS_APP_KEY', '')
        if not self.app_key:
            logger.warning("CIMIS_APP_KEY not configured. CIMIS API calls will fail.")

    def get_daily_data(
        self,
        target: str,
        start_date: date,
        end_date: date,
        target_type: str = 'station'
    ) -> list[dict]:
        """
        Get daily ETo and weather data for a target.

        Args:
            target: Station ID (numeric) or zip code (5 digits)
            start_date: Start date for data range
            end_date: End date for data range
            target_type: 'station' or 'spatial' (zip code)

        Returns:
            List of dicts with date, eto, precipitation, air_temp_avg, etc.
        """
        if not target:
            logger.warning("No CIMIS target provided")
            return []

        # Check cache first
        cached = self._get_cached_data(target, start_date, end_date, target_type)
        if cached is not None:
            return cached

        # Fetch from API
        records = self._fetch_from_api(target, start_date, end_date, target_type)

        # Cache the results
        if records:
            self._cache_records(records, target, target_type)

        return records

    def _fetch_from_api(
        self,
        target: str,
        start_date: date,
        end_date: date,
        target_type: str
    ) -> list[dict]:
        """Fetch data from CIMIS API."""
        if not self.app_key:
            logger.error("CIMIS API key not configured")
            return []

        params = {
            'appKey': self.app_key,
            'targets': target,
            'startDate': start_date.strftime('%Y-%m-%d'),
            'endDate': end_date.strftime('%Y-%m-%d'),
            'dataItems': 'day-eto,day-precip,day-air-tmp-avg,day-air-tmp-max,day-air-tmp-min',
            'unitOfMeasure': 'E',  # English units (inches, Fahrenheit)
        }

        # For zip codes, prefer Spatial CIMIS
        if target_type == 'spatial' or (len(target) == 5 and target.isdigit()):
            params['prioritizeSCS'] = 'Y'

        headers = {
            'Accept': 'application/json',
        }

        try:
            logger.info(f"Fetching CIMIS data for {target} from {start_date} to {end_date}")
            response = requests.get(
                self.BASE_URL,
                params=params,
                headers=headers,
                timeout=self.TIMEOUT
            )
            response.raise_for_status()

            data = response.json()
            return self._parse_response(data, target, target_type)

        except requests.exceptions.Timeout:
            logger.error(f"CIMIS API timeout for target {target}")
            return []
        except requests.exceptions.RequestException as e:
            logger.error(f"CIMIS API request failed: {e}")
            return []
        except ValueError as e:
            logger.error(f"Failed to parse CIMIS response: {e}")
            return []

    def _parse_response(self, data: dict, target: str, target_type: str) -> list[dict]:
        """Parse CIMIS API response into standardized records."""
        records = []

        try:
            providers = data.get('Data', {}).get('Providers', [])
            if not providers:
                logger.warning("No providers in CIMIS response")
                return []

            for provider in providers:
                provider_records = provider.get('Records', [])
                for record in provider_records:
                    parsed = {
                        'date': self._parse_date(record.get('Date')),
                        'source_id': target,
                        'data_source': target_type,
                        'eto': self._extract_value(record, 'DayEto'),
                        'precipitation': self._extract_value(record, 'DayPrecip'),
                        'air_temp_avg': self._extract_value(record, 'DayAirTmpAvg'),
                        'air_temp_max': self._extract_value(record, 'DayAirTmpMax'),
                        'air_temp_min': self._extract_value(record, 'DayAirTmpMin'),
                        'eto_qc': self._extract_qc(record, 'DayEto'),
                        'raw_record': record,
                    }
                    if parsed['date']:
                        records.append(parsed)

        except Exception as e:
            logger.error(f"Error parsing CIMIS response: {e}")

        return records

    def _extract_value(self, record: dict, key: str) -> Optional[Decimal]:
        """Extract numeric value from CIMIS record, handling missing data."""
        try:
            item = record.get(key, {})
            if isinstance(item, dict):
                value = item.get('Value', '--')
            else:
                value = item

            # CIMIS uses '--' for missing values
            if value in ('--', '', None):
                return None

            return Decimal(str(value))
        except (InvalidOperation, ValueError, TypeError):
            return None

    def _extract_qc(self, record: dict, key: str) -> str:
        """Extract quality control flag from CIMIS record."""
        try:
            item = record.get(key, {})
            if isinstance(item, dict):
                return str(item.get('Qc', '')).strip()
        except (ValueError, TypeError):
            pass
        return ''

    def _parse_date(self, date_str: str) -> Optional[date]:
        """Parse date string from CIMIS response."""
        if not date_str:
            return None
        try:
            return datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            try:
                return datetime.strptime(date_str.split('T')[0], '%Y-%m-%d').date()
            except ValueError:
                return None

    def _get_cached_data(
        self,
        target: str,
        start_date: date,
        end_date: date,
        target_type: str
    ) -> Optional[list[dict]]:
        """Check cache for complete data coverage."""
        from api.models import CIMISDataCache

        # Query cached records for the date range
        cached_records = CIMISDataCache.objects.filter(
            source_id=target,
            data_source=target_type,
            date__gte=start_date,
            date__lte=end_date,
        ).order_by('date')

        # Calculate expected number of days
        expected_days = (end_date - start_date).days + 1

        if cached_records.count() < expected_days:
            # Not all days are cached
            return None

        # Convert to list of dicts
        return [
            {
                'date': r.date,
                'source_id': r.source_id,
                'data_source': r.data_source,
                'eto': r.eto,
                'precipitation': r.precipitation,
                'air_temp_avg': r.air_temp_avg,
                'air_temp_max': r.air_temp_max,
                'air_temp_min': r.air_temp_min,
                'eto_qc': r.eto_qc,
            }
            for r in cached_records
        ]

    def _cache_records(self, records: list[dict], target: str, target_type: str):
        """Save records to cache."""
        from api.models import CIMISDataCache

        for record in records:
            if not record.get('date'):
                continue

            try:
                CIMISDataCache.objects.update_or_create(
                    date=record['date'],
                    source_id=target,
                    data_source=target_type,
                    defaults={
                        'eto': record.get('eto'),
                        'precipitation': record.get('precipitation'),
                        'air_temp_avg': record.get('air_temp_avg'),
                        'air_temp_max': record.get('air_temp_max'),
                        'air_temp_min': record.get('air_temp_min'),
                        'eto_qc': record.get('eto_qc', ''),
                        'raw_response': record.get('raw_record'),
                    }
                )
            except Exception as e:
                logger.error(f"Failed to cache CIMIS record for {record.get('date')}: {e}")

    def get_recent_data(self, target: str, days: int = 7, target_type: str = 'station') -> list[dict]:
        """
        Convenience method to get recent data.

        Args:
            target: Station ID or zip code
            days: Number of days of history (default 7)
            target_type: 'station' or 'spatial'

        Returns:
            List of daily records
        """
        end_date = date.today() - timedelta(days=1)  # Yesterday (today's data may not be available)
        start_date = end_date - timedelta(days=days - 1)
        return self.get_daily_data(target, start_date, end_date, target_type)

    def get_eto_sum(self, target: str, start_date: date, end_date: date, target_type: str = 'station') -> Decimal:
        """
        Get sum of ETo for a date range.

        Returns:
            Total ETo in inches, or 0 if no data
        """
        records = self.get_daily_data(target, start_date, end_date, target_type)
        total = Decimal('0')
        for r in records:
            if r.get('eto'):
                total += r['eto']
        return total

    def get_precipitation_sum(self, target: str, start_date: date, end_date: date, target_type: str = 'station') -> Decimal:
        """
        Get sum of precipitation for a date range.

        Returns:
            Total precipitation in inches, or 0 if no data
        """
        records = self.get_daily_data(target, start_date, end_date, target_type)
        total = Decimal('0')
        for r in records:
            if r.get('precipitation'):
                total += r['precipitation']
        return total
