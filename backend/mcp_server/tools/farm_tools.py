"""
Farm and Field Context Tools

Provides tools for listing and querying farms and fields.
These are essential context tools for the AI to understand
what resources are available.
"""

from typing import Optional
from mcp_server.context import (
    get_company_id,
    list_all_farms,
    list_all_fields,
    resolve_field,
    resolve_farm,
)


async def list_farms() -> dict:
    """
    List all farms accessible to the current user.

    Returns a list of farms with basic information including:
    - id, name, county
    - total_acres
    - GPS coordinates (if available)

    Use this to get farm IDs for other operations.
    """
    company_id = get_company_id()
    farms = list_all_farms(company_id=company_id)

    return {
        'farms': farms,
        'count': len(farms),
    }


async def list_fields(farm_id: Optional[int] = None) -> dict:
    """
    List all fields, optionally filtered by farm.

    Args:
        farm_id: Optional farm ID to filter by. If not provided,
                 lists all fields across all farms.

    Returns a list of fields with:
    - id, name, farm_id, farm_name
    - current_crop, total_acres
    - GPS coordinates (if available)

    Use this to get field IDs for compliance checks, spray planning, etc.
    """
    company_id = get_company_id()
    fields = list_all_fields(farm_id=farm_id, company_id=company_id)

    return {
        'fields': fields,
        'count': len(fields),
        'farm_id': farm_id,
    }


async def get_field_details(field_identifier: str | int) -> dict:
    """
    Get detailed information about a specific field.

    Args:
        field_identifier: Field name (e.g., "Block 5") or field ID.
                         Name matching is case-insensitive and supports
                         partial matches.

    Returns detailed field information including:
    - id, name, farm details
    - current crop and variety
    - total acres
    - GPS coordinates and PLSS data
    - Recent activity summary

    Example:
        get_field_details("Block 5")
        get_field_details(123)
    """
    from api.models import Field

    company_id = get_company_id()
    field_info = resolve_field(field_identifier, company_id=company_id)

    if not field_info:
        return {
            'error': f'Field "{field_identifier}" not found',
            'suggestion': 'Use list_fields() to see available fields',
        }

    # Get additional details
    try:
        field = Field.objects.select_related('farm').get(id=field_info['id'])

        # Add extended information
        field_info.update({
            'variety': getattr(field, 'variety', None),
            'plss_section': field.plss_section,
            'plss_township': field.plss_township,
            'plss_range': field.plss_range,
            'plss_display': field.plss_display,
            'tree_count': getattr(field, 'tree_count', None),
            'row_spacing': getattr(field, 'row_spacing', None),
            'tree_spacing': getattr(field, 'tree_spacing', None),
        })

        # Get recent application count
        from api.models import PesticideApplication
        recent_apps = PesticideApplication.objects.filter(
            field=field,
        ).count()
        field_info['total_applications'] = recent_apps

    except Field.DoesNotExist:
        pass

    return field_info


async def get_farm_details(farm_identifier: str | int) -> dict:
    """
    Get detailed information about a specific farm.

    Args:
        farm_identifier: Farm name (e.g., "North Ranch") or farm ID.
                        Name matching is case-insensitive and supports
                        partial matches.

    Returns detailed farm information including:
    - id, name, company
    - county (important for regulatory requirements)
    - total acres
    - GPS coordinates
    - List of fields on this farm

    Example:
        get_farm_details("North Ranch")
        get_farm_details(1)
    """
    from api.models import Farm, Field

    company_id = get_company_id()
    farm_info = resolve_farm(farm_identifier, company_id=company_id)

    if not farm_info:
        return {
            'error': f'Farm "{farm_identifier}" not found',
            'suggestion': 'Use list_farms() to see available farms',
        }

    # Get additional details and fields
    try:
        farm = Farm.objects.get(id=farm_info['id'])

        # Add extended information
        farm_info.update({
            'address': farm.address,
            'city': farm.city,
            'state': farm.state,
            'zip_code': farm.zip_code,
            'plss_section': farm.plss_section,
            'plss_township': farm.plss_township,
            'plss_range': farm.plss_range,
            'plss_display': farm.plss_display,
        })

        # Get fields for this farm
        fields = Field.objects.filter(farm=farm, active=True)
        farm_info['fields'] = [
            {
                'id': f.id,
                'name': f.name,
                'current_crop': f.current_crop,
                'total_acres': float(f.total_acres) if f.total_acres else None,
            }
            for f in fields
        ]
        farm_info['field_count'] = fields.count()

    except Farm.DoesNotExist:
        pass

    return farm_info


# Tool definitions for MCP server registration
TOOLS = [
    {
        'function': list_farms,
        'name': 'list_farms',
        'description': 'List all farms accessible to the current user. Returns farm names, IDs, and basic info.',
    },
    {
        'function': list_fields,
        'name': 'list_fields',
        'description': 'List all fields, optionally filtered by farm_id. Returns field names, IDs, crops, and acreage.',
    },
    {
        'function': get_field_details,
        'name': 'get_field_details',
        'description': 'Get detailed information about a specific field by name or ID. Supports flexible name matching.',
    },
    {
        'function': get_farm_details,
        'name': 'get_farm_details',
        'description': 'Get detailed information about a specific farm by name or ID, including its fields.',
    },
]
