"""
IPM rotation helper — surfaces resistance-management warnings when a
pesticide application would land on a field whose recent history already
leans on the same mode of action (IRAC/FRAC/HRAC group).

Design notes:
- This is advisory, not blocking. Growers still need flexibility when a
  pest outbreak forces their hand.
- Lookback defaults to 60 days. Citrus pest pressure cycles (ACP, thrips,
  mites) typically span 4-8 weeks; a tighter window misses rotation gaps,
  a wider one over-warns.
- Two-consecutive-same-MOA triggers a warning. Three-in-a-row triggers a
  critical warning. Matches IRAC guidance that no more than two consecutive
  applications should share a MOA without a window of a different group.
- Covers both model paths: legacy PesticideApplication/PesticideProduct and
  newer ApplicationEvent/TankMixItem/Product.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import List, Optional


@dataclass
class RotationWarning:
    severity: str  # 'info' | 'warning' | 'critical'
    code: str
    message: str
    recent_moa_codes: List[str]

    def to_dict(self) -> dict:
        return {
            'severity': self.severity,
            'code': self.code,
            'message': self.message,
            'recent_moa_codes': self.recent_moa_codes,
        }


def _build_warning(moa_code: str, moa_label: str, streak: int,
                   streak_codes: List[str]) -> Optional[RotationWarning]:
    if streak == 0:
        return None
    if streak >= 2:
        return RotationWarning(
            severity='critical',
            code='moa_rotation_violation',
            message=(
                f"Third consecutive application of MOA group {moa_label} on this "
                f"field. IRAC/FRAC guidance is to rotate to a different MOA after "
                f"two applications to slow resistance."
            ),
            recent_moa_codes=streak_codes + [moa_code],
        )
    return RotationWarning(
        severity='warning',
        code='moa_rotation_back_to_back',
        message=(
            f"Back-to-back applications of MOA group {moa_label} on this field. "
            f"Consider rotating to a different MOA next time to preserve efficacy."
        ),
        recent_moa_codes=streak_codes + [moa_code],
    )


def check_moa_rotation(
    field,
    product,
    application_date: date,
    lookback_days: int = 60,
    exclude_application_id: Optional[int] = None,
) -> Optional[RotationWarning]:
    """Legacy PesticideApplication path.

    Returns None when no warning is needed (no MOA code on incoming product,
    no prior MOA-tagged history, or a break in the streak already exists).
    """
    if not product or not product.moa_code:
        return None

    from ..models import PesticideApplication

    cutoff = application_date - timedelta(days=lookback_days)
    recent_any = (
        PesticideApplication.objects
        .filter(
            field=field,
            application_date__gte=cutoff,
            application_date__lte=application_date,
        )
        .exclude(product__moa_code='')
        .select_related('product')
        .order_by('-application_date', '-start_time')
    )
    if exclude_application_id:
        recent_any = recent_any.exclude(id=exclude_application_id)

    streak = 0
    streak_codes: List[str] = []
    for app in recent_any:
        if app.product.moa_code == product.moa_code:
            streak += 1
            streak_codes.append(app.product.moa_code)
        else:
            break

    moa_label = product.moa_group_name or product.moa_code
    return _build_warning(product.moa_code, moa_label, streak, streak_codes)


def check_moa_rotation_for_event(
    field,
    product,
    event_date: date,
    lookback_days: int = 60,
    exclude_event_id: Optional[int] = None,
) -> Optional[RotationWarning]:
    """ApplicationEvent / TankMixItem path.

    Looks at tank-mix items on recent ApplicationEvents targeting the same
    field and checks whether `product`'s MOA would extend an existing streak.
    """
    if not product or not product.moa_code:
        return None

    from ..models import ApplicationEvent

    cutoff_start = event_date - timedelta(days=lookback_days)
    events = (
        ApplicationEvent.objects
        .filter(
            field=field,
            date_started__date__gte=cutoff_start,
            date_started__date__lte=event_date,
        )
        .prefetch_related('tank_mix_items__product')
        .order_by('-date_started')
    )
    if exclude_event_id:
        events = events.exclude(id=exclude_event_id)

    streak = 0
    streak_codes: List[str] = []
    for event in events:
        event_codes = {
            item.product.moa_code
            for item in event.tank_mix_items.all()
            if item.product and item.product.moa_code
        }
        if not event_codes:
            # No tagged MOAs on this event — doesn't count as either match
            # or break (we don't have enough info to say).
            continue
        if product.moa_code in event_codes:
            streak += 1
            streak_codes.append(product.moa_code)
        else:
            break

    moa_label = product.moa_group_name or product.moa_code
    return _build_warning(product.moa_code, moa_label, streak, streak_codes)
