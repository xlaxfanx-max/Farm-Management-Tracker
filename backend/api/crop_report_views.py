"""
Crop report endpoints — one row per (Ranch × Crop) combination.

Delegates all the aggregation work to services.crop_report. The view layer
just resolves the season window from query params, scopes to the user's
company, and serializes the dataclasses.
"""

from datetime import date, datetime

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .view_helpers import require_company
from .permissions import HasCompanyAccess
from .services.crop_report import (
    generate_ranch_crop_cards, build_crop_report_card, _resolve_season_window,
)


def _parse_date(raw):
    if not raw:
        return None
    try:
        return datetime.strptime(raw, '%Y-%m-%d').date()
    except ValueError:
        return None


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def crop_report_list(request):
    """GET /api/crop-reports/?start=YYYY-MM-DD&end=YYYY-MM-DD

    Returns one card per (Farm, crop_variety) combo with data in the
    season window. Defaults to the trailing 365 days when unspecified."""
    company = require_company(request.user)
    season_start = _parse_date(request.query_params.get('start'))
    season_end = _parse_date(request.query_params.get('end'))

    cards = generate_ranch_crop_cards(
        company=company,
        season_start=season_start,
        season_end=season_end,
    )

    start, end, label = _resolve_season_window(season_start, season_end)
    return Response({
        'season': {
            'start': start.isoformat(),
            'end': end.isoformat(),
            'label': label,
        },
        'card_count': len(cards),
        'cards': [c.to_dict() for c in cards],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasCompanyAccess])
def crop_report_detail(request):
    """GET /api/crop-reports/detail/?farm_id=X&crop_variety=Y&start=...&end=...

    Returns a single card for a specific (farm, crop) combo. Useful for
    drill-in pages where the grower is looking at one crop."""
    from .models import Farm

    company = require_company(request.user)
    try:
        farm_id = int(request.query_params.get('farm_id'))
    except (TypeError, ValueError):
        return Response(
            {'detail': 'farm_id query parameter is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    crop_variety = request.query_params.get('crop_variety')
    if not crop_variety:
        return Response(
            {'detail': 'crop_variety query parameter is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not Farm.objects.filter(id=farm_id, company=company).exists():
        return Response(
            {'detail': 'Farm not found or not accessible.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    season_start = _parse_date(request.query_params.get('start'))
    season_end = _parse_date(request.query_params.get('end'))
    start, end, label = _resolve_season_window(season_start, season_end)

    card = build_crop_report_card(
        company=company,
        farm_id=farm_id,
        crop_variety=crop_variety,
        season_start=start,
        season_end=end,
        season_label=label,
    )
    return Response(card.to_dict())
