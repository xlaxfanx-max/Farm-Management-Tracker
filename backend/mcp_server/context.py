"""
Context Management for MCP Server

Handles:
- Company ID retrieval from environment or configuration
- Field name resolution ("Block 5" -> field_id)
- Farm name resolution ("North Ranch" -> farm_id)
"""

import os
from typing import Optional, List, Dict, Any
from functools import lru_cache


def get_company_id() -> Optional[int]:
    """
    Get the company ID for RLS filtering.

    Returns company ID from environment variable MCP_COMPANY_ID,
    or None if not set.
    """
    company_id = os.environ.get('MCP_COMPANY_ID')
    if company_id:
        try:
            return int(company_id)
        except ValueError:
            pass
    return None


def resolve_field(
    field_identifier: str | int,
    farm_id: Optional[int] = None,
    company_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Resolve a field identifier (name or ID) to field details.

    Supports flexible field identification:
    - "Block 5" or "block 5" (case-insensitive name match)
    - "North 40" (partial name match)
    - 123 (direct ID)

    Args:
        field_identifier: Field name (str) or ID (int)
        farm_id: Optional farm ID to narrow search
        company_id: Optional company ID for RLS

    Returns:
        Dictionary with field details or None if not found
    """
    from api.models import Field

    queryset = Field.objects.filter(active=True).select_related('farm')

    if company_id:
        queryset = queryset.filter(farm__company_id=company_id)

    if farm_id:
        queryset = queryset.filter(farm_id=farm_id)

    # Try direct ID lookup first
    if isinstance(field_identifier, int):
        try:
            field = queryset.get(id=field_identifier)
            return _field_to_dict(field)
        except Field.DoesNotExist:
            return None

    # Try exact name match (case-insensitive)
    name = str(field_identifier).strip()
    try:
        field = queryset.get(name__iexact=name)
        return _field_to_dict(field)
    except Field.DoesNotExist:
        pass
    except Field.MultipleObjectsReturned:
        # If multiple matches, return the first one
        field = queryset.filter(name__iexact=name).first()
        if field:
            return _field_to_dict(field)

    # Try partial name match
    matches = queryset.filter(name__icontains=name)
    if matches.count() == 1:
        return _field_to_dict(matches.first())
    elif matches.count() > 1:
        # Return first match but note ambiguity
        field = matches.first()
        result = _field_to_dict(field)
        result['ambiguous'] = True
        result['other_matches'] = [m.name for m in matches[1:5]]
        return result

    return None


def resolve_farm(
    farm_identifier: str | int,
    company_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Resolve a farm identifier (name or ID) to farm details.

    Args:
        farm_identifier: Farm name (str) or ID (int)
        company_id: Optional company ID for RLS

    Returns:
        Dictionary with farm details or None if not found
    """
    from api.models import Farm

    queryset = Farm.objects.filter(active=True)

    if company_id:
        queryset = queryset.filter(company_id=company_id)

    # Try direct ID lookup first
    if isinstance(farm_identifier, int):
        try:
            farm = queryset.get(id=farm_identifier)
            return _farm_to_dict(farm)
        except Farm.DoesNotExist:
            return None

    # Try exact name match (case-insensitive)
    name = str(farm_identifier).strip()
    try:
        farm = queryset.get(name__iexact=name)
        return _farm_to_dict(farm)
    except Farm.DoesNotExist:
        pass
    except Farm.MultipleObjectsReturned:
        farm = queryset.filter(name__iexact=name).first()
        if farm:
            return _farm_to_dict(farm)

    # Try partial name match
    matches = queryset.filter(name__icontains=name)
    if matches.count() == 1:
        return _farm_to_dict(matches.first())
    elif matches.count() > 1:
        farm = matches.first()
        result = _farm_to_dict(farm)
        result['ambiguous'] = True
        result['other_matches'] = [m.name for m in matches[1:5]]
        return result

    return None


def _field_to_dict(field) -> Dict[str, Any]:
    """Convert Field model instance to dictionary."""
    return {
        'id': field.id,
        'name': field.name,
        'farm_id': field.farm_id,
        'farm_name': field.farm.name if field.farm else None,
        'current_crop': field.current_crop,
        'total_acres': float(field.total_acres) if field.total_acres else None,
        'has_coordinates': field.has_coordinates,
        'latitude': float(field.gps_latitude) if field.gps_latitude else None,
        'longitude': float(field.gps_longitude) if field.gps_longitude else None,
    }


def _farm_to_dict(farm) -> Dict[str, Any]:
    """Convert Farm model instance to dictionary."""
    return {
        'id': farm.id,
        'name': farm.name,
        'company_id': farm.company_id,
        'county': farm.county,
        'total_acres': float(farm.total_acres) if farm.total_acres else None,
        'has_coordinates': farm.has_coordinates,
        'latitude': float(farm.gps_latitude) if farm.gps_latitude else None,
        'longitude': float(farm.gps_longitude) if farm.gps_longitude else None,
    }


def list_all_farms(company_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    List all active farms.

    Args:
        company_id: Optional company ID for RLS

    Returns:
        List of farm dictionaries
    """
    from api.models import Farm

    queryset = Farm.objects.filter(active=True)

    if company_id:
        queryset = queryset.filter(company_id=company_id)

    return [_farm_to_dict(farm) for farm in queryset]


def list_all_fields(
    farm_id: Optional[int] = None,
    company_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    List all active fields.

    Args:
        farm_id: Optional farm ID filter
        company_id: Optional company ID for RLS

    Returns:
        List of field dictionaries
    """
    from api.models import Field

    queryset = Field.objects.filter(active=True).select_related('farm')

    if company_id:
        queryset = queryset.filter(farm__company_id=company_id)

    if farm_id:
        queryset = queryset.filter(farm_id=farm_id)

    return [_field_to_dict(field) for field in queryset]
