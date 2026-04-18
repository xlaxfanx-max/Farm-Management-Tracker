"""
Ranch-crop report cards — one row per (Farm × Crop) combination aggregating
what actually happened on that combo this season.

Design constraint: real growers often track only at the ranch level. Pick
reports, applicator records, and pool settlements frequently arrive at
"Navel oranges at North Ranch" granularity — blocks only surface when the
settlement PDF carries `block_id` tags or when growers tie applications
to individual fields. The card therefore has to be useful with *no* block
detail and progressively reveal more when the data supports it.

Aggregation key: (Farm.id, crop_variety_code).

Crop identity across models is messy — Field stores both a FK to Crop and
a legacy `current_crop` text; Harvest uses `crop_variety` from
CROP_VARIETY_CHOICES; ApplicationEvent uses free-text DPR `commodity_name`
("LEMON"); Pool uses `commodity` ("NAVELS"). We use crop_variety codes as
the canonical key and a token-overlap matcher to pull in pool/event data
that referenced the crop via different names.
"""

from dataclasses import dataclass, field as dc_field, asdict
from datetime import date, timedelta
from decimal import Decimal
from typing import List, Optional, Set, Dict, Tuple


# =============================================================================
# Crop name normalization
# =============================================================================

# Noise words / plural suffixes to strip before token comparison.
_PLURAL_MAP = {
    'navels': 'navel', 'oranges': 'orange', 'lemons': 'lemon',
    'avocados': 'avocado', 'grapefruits': 'grapefruit', 'limes': 'lime',
    'mandarins': 'mandarin', 'tangerines': 'tangerine',
    'clementines': 'clementine', 'satsumas': 'satsuma',
    'tangelos': 'tangelo', 'kumquats': 'kumquat',
}


def _normalize_tokens(s) -> Set[str]:
    """Break a crop string into comparison tokens. Returns an empty set on
    None/empty rather than raising — callers pass these freely."""
    if not s:
        return set()
    s = str(s).lower().replace('_', ' ').replace('-', ' ')
    for plural, singular in _PLURAL_MAP.items():
        s = s.replace(plural, singular)
    tokens = {t.strip() for t in s.split() if len(t.strip()) >= 3}
    return tokens


def _crops_match(a, b) -> bool:
    """True iff the two crop strings share at least one meaningful token."""
    return bool(_normalize_tokens(a) & _normalize_tokens(b))


def _crop_display(crop_variety: str) -> str:
    """Pretty-print a CROP_VARIETY_CHOICES code ('navel_orange' → 'Navel Orange')."""
    if not crop_variety:
        return 'Unknown'
    return ' '.join(w.capitalize() for w in crop_variety.split('_'))


# =============================================================================
# Dataclasses
# =============================================================================

@dataclass
class FieldBreakdown:
    field_id: int
    field_name: str
    acres: float
    bins: int
    spray_cost: float
    # Data availability flags for the UI
    has_harvest: bool = False
    has_applications: bool = False
    has_tree_survey: bool = False
    # Optional rollups
    hlb_risk_score: Optional[float] = None
    avg_ndvi: Optional[float] = None


@dataclass
class CropReportCard:
    farm_id: int
    farm_name: str
    crop_variety: str
    crop_variety_display: str
    season_label: str
    # Core metrics — always present
    total_acres: float
    total_bins: int
    total_revenue: float
    total_spray_cost: float
    net_return: float
    net_per_acre: Optional[float]
    # Progressive detail
    field_count: int
    fields: List[FieldBreakdown] = dc_field(default_factory=list)
    has_block_level_data: bool = False
    # Compliance / health rollups — Optional means "not enough data"
    phi_compliant: Optional[bool] = None
    moa_rotation_warnings: int = 0
    avg_health_score: Optional[float] = None
    hlb_risk_max: Optional[float] = None
    # Trend
    prior_season_net_per_acre: Optional[float] = None
    # Quality
    data_gaps: List[str] = dc_field(default_factory=list)
    applicable_settlements: int = 0
    applicable_events: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


# =============================================================================
# Season helpers
# =============================================================================

def _resolve_season_window(
    season_start: Optional[date], season_end: Optional[date]
) -> Tuple[date, date, str]:
    """Default to a single crop year ending today if unspecified."""
    today = date.today()
    if season_end is None:
        season_end = today
    if season_start is None:
        season_start = season_end - timedelta(days=365)
    # Label like '2025-2026' when crossing a year boundary, else just the year
    if season_start.year == season_end.year:
        label = str(season_end.year)
    else:
        label = f'{season_start.year}-{season_end.year}'
    return season_start, season_end, label


# =============================================================================
# Per-card aggregator
# =============================================================================

def _enumerate_ranch_crop_combos(company) -> Set[Tuple[int, str]]:
    """Find every (farm_id, crop_variety) pair that has ANY record —
    field assignment, harvest, or application event."""
    from ..models import Field, Harvest

    combos: Set[Tuple[int, str]] = set()

    # From Field.current_crop — the legacy text is still the authoritative
    # "what's planted here" in most of the codebase.
    field_rows = (
        Field.objects
        .filter(farm__company=company)
        .values_list('farm_id', 'current_crop')
    )
    for farm_id, crop in field_rows:
        if crop:
            combos.add((farm_id, crop.lower().replace(' ', '_')))

    # From Harvest.crop_variety — catches crops that were once planted/harvested
    # even if the field's current_crop has since moved on.
    harv_rows = (
        Harvest.objects
        .filter(field__farm__company=company)
        .values_list('field__farm_id', 'crop_variety')
    )
    for farm_id, cv in harv_rows:
        if cv:
            combos.add((farm_id, cv))

    return combos


def _fields_for_combo(farm_id: int, crop_variety: str):
    """Fields on this farm that match the crop. Uses Field.current_crop
    first; falls back to Harvest.crop_variety if no fields match (for
    historical combos where the crop has been replanted)."""
    from ..models import Field, Harvest

    target_tokens = _normalize_tokens(crop_variety)
    fields = list(Field.objects.filter(farm_id=farm_id).select_related('farm', 'crop'))
    matches = [f for f in fields if _normalize_tokens(f.current_crop) & target_tokens]
    if matches:
        return matches

    # Fall back to fields that have harvests of this crop in history
    harvest_field_ids = set(
        Harvest.objects
        .filter(field__farm_id=farm_id, crop_variety=crop_variety)
        .values_list('field_id', flat=True)
    )
    return [f for f in fields if f.id in harvest_field_ids]


def _spray_cost_for_field(field, start_date: date, end_date: date) -> Decimal:
    """Sum spray costs across both application paths — legacy
    PesticideApplication and new ApplicationEvent/TankMixItem — for this
    field in the window. Returns Decimal(0) when nothing is tracked."""
    from ..models import PesticideApplication, ApplicationEvent

    total = Decimal(0)

    # Legacy PesticideApplication model — uses application_cost property
    legacy = (
        PesticideApplication.objects
        .filter(field=field, application_date__range=(start_date, end_date))
        .select_related('product')
    )
    for app in legacy:
        cost = app.application_cost
        if cost is not None:
            total += Decimal(str(cost))

    # New ApplicationEvent — rolls up tank mix costs
    events = (
        ApplicationEvent.objects
        .filter(field=field, date_started__date__range=(start_date, end_date))
        .prefetch_related('tank_mix_items__product')
    )
    for event in events:
        ev_total = event.total_cost  # Decimal or None
        if ev_total is not None:
            total += ev_total
    return total


def _ranch_level_spray_cost(
    farm_id: int, crop_variety: str, start_date: date, end_date: date
) -> Tuple[Decimal, int]:
    """Sum ApplicationEvent costs attached to the farm *without* a field,
    filtered by commodity_name token match. This is the path for growers
    who record applications at ranch granularity."""
    from ..models import ApplicationEvent

    target_tokens = _normalize_tokens(crop_variety)
    events = (
        ApplicationEvent.objects
        .filter(
            farm_id=farm_id,
            field__isnull=True,
            date_started__date__range=(start_date, end_date),
        )
        .prefetch_related('tank_mix_items__product')
    )
    total = Decimal(0)
    matched = 0
    for event in events:
        if not _normalize_tokens(event.commodity_name) & target_tokens:
            continue
        matched += 1
        ev_total = event.total_cost
        if ev_total is not None:
            total += ev_total
    return total, matched


def _revenue_for_combo(
    company, farm_id: int, field_ids: List[int], crop_variety: str,
    start_date: date, end_date: date,
) -> Tuple[Decimal, int, int]:
    """Pool settlements that belong to this (farm, crop) combo.

    Primary path: settlement.field is one of our field_ids.
    Fallback path: settlement.field is null BUT the pool's commodity
    matches the crop token and we have no field-specific settlements on
    this farm for the same pool (avoids double-counting when the same
    pool has both an aggregate line and block-specific lines).
    """
    from ..models import PoolSettlement

    total = Decimal(0)
    matched_settlements = 0

    base_qs = (
        PoolSettlement.objects
        .filter(
            pool__packinghouse__company=company,
            statement_date__range=(start_date, end_date),
        )
        .select_related('pool', 'pool__packinghouse', 'field')
    )

    # Field-linked settlements
    field_settlements = base_qs.filter(field_id__in=field_ids) if field_ids else base_qs.none()
    seen_pools: Set[int] = set()
    for s in field_settlements:
        if s.net_return is not None:
            total += s.net_return
        matched_settlements += 1
        seen_pools.add(s.pool_id)

    # Null-field fallback — commodity matches and not already counted
    target_tokens = _normalize_tokens(crop_variety)
    null_field = base_qs.filter(field__isnull=True).exclude(pool_id__in=seen_pools)
    # Constrain to settlements whose pool is plausibly for this farm:
    # either the pool has deliveries from our fields, or the grower only
    # has one farm (can't tell otherwise).
    for s in null_field:
        if not _normalize_tokens(s.pool.commodity) & target_tokens:
            continue
        # Require a delivery or harvest-link to a field on this farm before
        # attributing the pool to this farm. Avoids cross-farm leakage.
        has_farm_link = s.pool.deliveries.filter(field_id__in=field_ids).exists() if field_ids else False
        if not has_farm_link:
            continue
        if s.net_return is not None:
            total += s.net_return
        matched_settlements += 1

    return total, matched_settlements, len(seen_pools)


def _build_field_breakdowns(
    fields, crop_variety: str, start_date: date, end_date: date,
) -> List[FieldBreakdown]:
    from ..models import Harvest, TreeSurvey, PesticideApplication, ApplicationEvent

    breakdowns: List[FieldBreakdown] = []
    for f in fields:
        harvests_qs = Harvest.objects.filter(
            field=f, crop_variety=crop_variety,
            harvest_date__range=(start_date, end_date),
        )
        bins = sum(h.total_bins or 0 for h in harvests_qs)
        has_harvest = harvests_qs.exists()

        spray = _spray_cost_for_field(f, start_date, end_date)

        has_apps = (
            PesticideApplication.objects.filter(
                field=f, application_date__range=(start_date, end_date),
            ).exists()
            or ApplicationEvent.objects.filter(
                field=f, date_started__date__range=(start_date, end_date),
            ).exists()
        )

        survey = (
            TreeSurvey.objects
            .filter(field=f, status='completed')
            .order_by('-capture_date')
            .first()
        )

        hlb_score = None
        # Only compute HLB when the field has enough signal to be worth showing
        if f.gps_latitude and f.gps_longitude:
            try:
                from .hlb_risk_service import score_field_hlb_risk
                hlb_score = score_field_hlb_risk(f).risk_score
            except Exception:
                hlb_score = None

        breakdowns.append(FieldBreakdown(
            field_id=f.id,
            field_name=f.name,
            acres=float(f.total_acres or 0),
            bins=int(bins),
            spray_cost=float(spray),
            has_harvest=has_harvest,
            has_applications=has_apps,
            has_tree_survey=survey is not None,
            hlb_risk_score=hlb_score,
            avg_ndvi=float(survey.avg_ndvi) if survey and survey.avg_ndvi is not None else None,
        ))
    return breakdowns


def _compliance_rollup(fields, start_date: date, end_date: date) -> Dict:
    """Summarize PHI and MOA rotation status across the fields. Returns
    partial results — any metric that lacks supporting data comes back
    None rather than a fake zero."""
    from ..models import Harvest, ApplicationEvent
    from .ipm_rotation import check_moa_rotation_for_event

    phi_samples = []
    for f in fields:
        phi_samples.extend(
            Harvest.objects
            .filter(field=f, harvest_date__range=(start_date, end_date))
            .values_list('phi_verified', flat=True)
        )
    phi_compliant = (
        all(phi_samples) if phi_samples else None
    )

    # Rotation warnings across all fields' application events this season
    rotation_warnings = 0
    for f in fields:
        events = (
            ApplicationEvent.objects
            .filter(field=f, date_started__date__range=(start_date, end_date))
            .prefetch_related('tank_mix_items__product')
        )
        for event in events:
            event_date = event.date_started.date() if hasattr(event.date_started, 'date') else event.date_started
            for item in event.tank_mix_items.all():
                try:
                    w = check_moa_rotation_for_event(
                        field=f, product=item.product,
                        event_date=event_date, exclude_event_id=event.id,
                    )
                except Exception:
                    continue
                if w and w.severity in ('warning', 'critical'):
                    rotation_warnings += 1

    return {
        'phi_compliant': phi_compliant,
        'moa_rotation_warnings': rotation_warnings,
    }


def _prior_season_net_per_acre(
    company, farm_id: int, field_ids: List[int], crop_variety: str,
    current_start: date,
) -> Optional[float]:
    """Cheap previous-season comparison — looks back 365 days before the
    current window and reuses the same aggregators."""
    from ..models import Field

    prior_end = current_start - timedelta(days=1)
    prior_start = prior_end - timedelta(days=365)

    revenue, _, _ = _revenue_for_combo(
        company, farm_id, field_ids, crop_variety, prior_start, prior_end,
    )
    # Spray cost for prior season
    fields = list(Field.objects.filter(id__in=field_ids)) if field_ids else []
    spray = Decimal(0)
    for f in fields:
        spray += _spray_cost_for_field(f, prior_start, prior_end)
    ranch_spray, _ = _ranch_level_spray_cost(
        farm_id, crop_variety, prior_start, prior_end,
    )
    spray += ranch_spray
    acres = sum((f.total_acres or Decimal(0)) for f in fields)
    net = revenue - spray
    if acres and acres > 0:
        return float(net / acres)
    return None


def build_crop_report_card(
    company, farm_id: int, crop_variety: str,
    season_start: date, season_end: date, season_label: str,
) -> CropReportCard:
    """Build a single report card. Returns None when there's no signal at
    all (no fields, no harvests, no events) so callers can skip it."""
    from ..models import Farm, Harvest

    farm = Farm.objects.get(id=farm_id)
    fields = _fields_for_combo(farm_id, crop_variety)
    field_ids = [f.id for f in fields]

    # Revenue + settlements
    revenue, settlement_count, block_settlement_count = _revenue_for_combo(
        company, farm_id, field_ids, crop_variety, season_start, season_end,
    )

    # Spray cost — sum field-tagged + ranch-level events matching this crop
    spray = Decimal(0)
    for f in fields:
        spray += _spray_cost_for_field(f, season_start, season_end)
    ranch_spray, ranch_event_count = _ranch_level_spray_cost(
        farm_id, crop_variety, season_start, season_end,
    )
    spray += ranch_spray

    # Harvest totals — aggregated across all matching fields
    harvests_qs = (
        Harvest.objects
        .filter(field__in=field_ids, crop_variety=crop_variety,
                harvest_date__range=(season_start, season_end))
    )
    total_bins = sum(h.total_bins or 0 for h in harvests_qs)
    total_acres = sum((f.total_acres or Decimal(0)) for f in fields)

    net_return = revenue - spray
    net_per_acre = float(net_return / total_acres) if total_acres and total_acres > 0 else None

    # Compliance roll-up
    comp = _compliance_rollup(fields, season_start, season_end)

    # Per-field breakdown (feeds the drill-down)
    breakdowns = _build_field_breakdowns(fields, crop_variety, season_start, season_end)
    hlb_scores = [b.hlb_risk_score for b in breakdowns if b.hlb_risk_score is not None]
    ndvi_values = [b.avg_ndvi for b in breakdowns if b.avg_ndvi is not None]

    # Block-level data is meaningful when either multiple fields or a
    # settlement carries per-block lines.
    has_block_level = block_settlement_count > 0 or len(fields) > 1

    # Trend
    prior_net_per_acre = _prior_season_net_per_acre(
        company, farm_id, field_ids, crop_variety, season_start,
    )

    # Data gaps
    gaps: List[str] = []
    if not fields:
        gaps.append("No fields tagged with this crop on this ranch")
    if total_bins == 0 and harvests_qs.count() == 0:
        gaps.append("No harvests recorded this season")
    if settlement_count == 0:
        gaps.append("No pool settlements linked to this ranch + crop")
    if spray == 0 and not ranch_event_count:
        gaps.append("No spray records in this window — spray cost will show $0")
    if not hlb_scores:
        gaps.append("HLB risk requires field GPS coordinates")

    return CropReportCard(
        farm_id=farm_id,
        farm_name=farm.name,
        crop_variety=crop_variety,
        crop_variety_display=_crop_display(crop_variety),
        season_label=season_label,
        total_acres=float(total_acres),
        total_bins=int(total_bins),
        total_revenue=float(revenue),
        total_spray_cost=float(spray),
        net_return=float(net_return),
        net_per_acre=net_per_acre,
        field_count=len(fields),
        fields=breakdowns,
        has_block_level_data=has_block_level,
        phi_compliant=comp['phi_compliant'],
        moa_rotation_warnings=comp['moa_rotation_warnings'],
        avg_health_score=(
            round(sum(ndvi_values) / len(ndvi_values) * 100, 1)
            if ndvi_values else None
        ),
        hlb_risk_max=max(hlb_scores) if hlb_scores else None,
        prior_season_net_per_acre=prior_net_per_acre,
        data_gaps=gaps,
        applicable_settlements=settlement_count,
        applicable_events=ranch_event_count,
    )


# =============================================================================
# Public API
# =============================================================================

def generate_ranch_crop_cards(
    company,
    season_start: Optional[date] = None,
    season_end: Optional[date] = None,
) -> List[CropReportCard]:
    """Emit one card per (Farm, crop_variety) combo that has any data in
    the season window. Sorted highest-revenue-first so the grower sees
    their most important crops at the top."""
    season_start, season_end, season_label = _resolve_season_window(
        season_start, season_end,
    )
    combos = _enumerate_ranch_crop_combos(company)

    cards: List[CropReportCard] = []
    for farm_id, crop_variety in combos:
        card = build_crop_report_card(
            company, farm_id, crop_variety, season_start, season_end, season_label,
        )
        # Skip empty combos — no fields AND no harvests AND no spray
        if (
            card.field_count == 0
            and card.total_bins == 0
            and card.total_spray_cost == 0
            and card.applicable_events == 0
        ):
            continue
        cards.append(card)

    cards.sort(key=lambda c: c.total_revenue, reverse=True)
    return cards
