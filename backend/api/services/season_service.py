"""
Season Service - Centralized season calculation and management.

Provides consistent season handling across the application for different crop types:
- Citrus: Oct-Sep (crosses calendar year)
- Deciduous/Nuts: Calendar year or crop-specific windows
- Row crops: Multiple cycles per year
- Vines: Mar-Nov growing season
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional, List, Dict, Any, Tuple
from dateutil.relativedelta import relativedelta


@dataclass
class SeasonPeriod:
    """Represents a resolved season period with start/end dates."""
    label: str
    start_date: date
    end_date: date
    template_id: Optional[int] = None
    season_type: str = 'calendar_year'
    is_current: bool = False

    def contains(self, target_date: date) -> bool:
        """Check if target_date falls within this season."""
        return self.start_date <= target_date <= self.end_date

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            'label': self.label,
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(),
            'template_id': self.template_id,
            'season_type': self.season_type,
            'is_current': self.is_current,
        }


class SeasonService:
    """
    Centralized service for all season-related calculations.

    Handles:
    - Determining current season for any field/crop combination
    - Calculating date ranges for a season
    - Resolving which season a date belongs to
    - Supporting multiple growing cycles

    Usage:
        service = SeasonService(company_id=request.user.current_company_id)
        current = service.get_current_season(field_id=123)
        print(f"Current season: {current.label} ({current.start_date} to {current.end_date})")
    """

    # Default season configurations by crop category
    # These are used when no SeasonTemplate is found in the database
    #
    # Season timing research (California):
    # - Citrus: Oct 1 - Sep 30 (industry marketing year)
    # - Avocados/Subtropical: Nov 1 - Oct 31 (CAC fiscal year)
    # - Almonds: Feb 1 - Oct 31 (bloom to harvest)
    # - Grapes: Mar 1 - Dec 31 (bud break to dormancy)
    #
    DEFAULT_SEASON_CONFIGS = {
        # CITRUS - October-September marketing year
        # Navel oranges: Nov-Jun, Valencia: Mar-Oct, Lemons: year-round, Mandarins: Nov-May
        'citrus': {
            'start_month': 10,
            'start_day': 1,
            'duration_months': 12,
            'crosses_calendar_year': True,
            'label_format': '{start_year}-{end_year}',
            'season_type': 'citrus',
        },
        # SUBTROPICAL (Avocados) - November-October (CAC fiscal year)
        # Harvest builds Feb/Mar, peaks Apr-Aug, ends Sep/Oct
        # Nov 1 start aligns with California Avocado Commission assessment periods
        'subtropical': {
            'start_month': 11,
            'start_day': 1,
            'duration_months': 12,
            'crosses_calendar_year': True,
            'label_format': '{start_year}-{end_year}',
            'season_type': 'avocado',
        },
        # DECIDUOUS FRUIT - Calendar year
        'deciduous_fruit': {
            'start_month': 1,
            'start_day': 1,
            'duration_months': 12,
            'crosses_calendar_year': False,
            'label_format': '{start_year}',
            'season_type': 'calendar_year',
        },
        # NUTS (Almonds) - February-October (bloom to harvest)
        'nut': {
            'start_month': 2,
            'start_day': 1,
            'duration_months': 9,
            'crosses_calendar_year': False,
            'label_format': '{start_year}',
            'season_type': 'almond',
        },
        # VINES (Grapes) - March-December (bud break to post-harvest)
        'vine': {
            'start_month': 3,
            'start_day': 1,
            'duration_months': 10,
            'crosses_calendar_year': False,
            'label_format': '{start_year}',
            'season_type': 'grape',
        },
        # ROW CROPS - Calendar year (multiple cycles tracked separately)
        'row_crop': {
            'start_month': 1,
            'start_day': 1,
            'duration_months': 12,
            'crosses_calendar_year': False,
            'label_format': '{start_year}',
            'season_type': 'calendar_year',
        },
        # VEGETABLES - Calendar year (multiple cycles tracked separately)
        'vegetable': {
            'start_month': 1,
            'start_day': 1,
            'duration_months': 12,
            'crosses_calendar_year': False,
            'label_format': '{start_year}',
            'season_type': 'calendar_year',
        },
        # BERRIES - Calendar year
        'berry': {
            'start_month': 1,
            'start_day': 1,
            'duration_months': 12,
            'crosses_calendar_year': False,
            'label_format': '{start_year}',
            'season_type': 'calendar_year',
        },
        # OTHER - Calendar year fallback
        'other': {
            'start_month': 1,
            'start_day': 1,
            'duration_months': 12,
            'crosses_calendar_year': False,
            'label_format': '{start_year}',
            'season_type': 'calendar_year',
        },
    }

    # Fallback default
    DEFAULT_CONFIG = {
        'start_month': 1,
        'start_day': 1,
        'duration_months': 12,
        'crosses_calendar_year': False,
        'label_format': '{start_year}',
        'season_type': 'calendar_year',
    }

    def __init__(self, company_id: Optional[int] = None):
        """
        Initialize the SeasonService.

        Args:
            company_id: Optional company ID for company-specific season templates
        """
        self.company_id = company_id

    def get_current_season(
        self,
        field_id: Optional[int] = None,
        crop_category: Optional[str] = None,
        target_date: Optional[date] = None
    ) -> SeasonPeriod:
        """
        Get the current season for a field or crop category.

        Args:
            field_id: Optional field ID for field-specific season
            crop_category: Optional crop category if no field specified
            target_date: Date to determine season for (default: today)

        Returns:
            SeasonPeriod with start/end dates and label
        """
        if target_date is None:
            target_date = date.today()

        config = self._get_season_config(field_id, crop_category)
        season = self._calculate_season(target_date, config)
        season.is_current = season.contains(date.today())

        return season

    def get_season_date_range(
        self,
        season_label: str,
        field_id: Optional[int] = None,
        crop_category: Optional[str] = None
    ) -> Tuple[date, date]:
        """
        Get start and end dates for a season label.

        Args:
            season_label: Season string (e.g., "2024-2025" or "2024")
            field_id: Optional field for context
            crop_category: Optional crop category

        Returns:
            Tuple of (start_date, end_date)
        """
        config = self._get_season_config(field_id, crop_category)

        # Parse the season label to get start year
        if '-' in season_label:
            start_year = int(season_label.split('-')[0])
        else:
            start_year = int(season_label)

        start_date = date(start_year, config['start_month'], config['start_day'])
        end_date = start_date + relativedelta(months=config['duration_months']) - timedelta(days=1)

        return start_date, end_date

    def get_available_seasons(
        self,
        field_id: Optional[int] = None,
        crop_category: Optional[str] = None,
        years_back: int = 5,
        years_forward: int = 1
    ) -> List[SeasonPeriod]:
        """
        Get list of available seasons for selection.

        Returns seasons from (current - years_back) to (current + years_forward).

        Args:
            field_id: Optional field for context
            crop_category: Optional crop category
            years_back: How many years to include in the past
            years_forward: How many years to include in the future

        Returns:
            List of SeasonPeriod objects, sorted newest first
        """
        config = self._get_season_config(field_id, crop_category)
        today = date.today()
        current = self._calculate_season(today, config)

        seasons = []
        seen_labels = set()

        # Calculate backward
        for i in range(years_back, 0, -1):
            past_date = today - relativedelta(years=i)
            season = self._calculate_season(past_date, config)
            if season.label not in seen_labels:
                seen_labels.add(season.label)
                seasons.append(season)

        # Current
        current.is_current = True
        if current.label not in seen_labels:
            seen_labels.add(current.label)
            seasons.append(current)

        # Future
        for i in range(1, years_forward + 1):
            future_date = today + relativedelta(years=i)
            season = self._calculate_season(future_date, config)
            if season.label not in seen_labels:
                seen_labels.add(season.label)
                seasons.append(season)

        return sorted(seasons, key=lambda s: s.start_date, reverse=True)

    def get_last_season(
        self,
        season_label: str,
        field_id: Optional[int] = None,
        crop_category: Optional[str] = None
    ) -> SeasonPeriod:
        """
        Get the previous season relative to the given season.

        Args:
            season_label: Current season label (e.g., "2024-2025" or "2024")
            field_id: Optional field for context
            crop_category: Optional crop category

        Returns:
            SeasonPeriod for the previous season
        """
        config = self._get_season_config(field_id, crop_category)

        # Parse current season to get its start date
        if '-' in season_label:
            current_start_year = int(season_label.split('-')[0])
        else:
            current_start_year = int(season_label)

        current_start = date(current_start_year, config['start_month'], config.get('start_day', 1))

        # Calculate previous season by going back one year from current start
        previous_date = current_start - relativedelta(years=1)

        return self._calculate_season(previous_date, config)

    def get_season_for_compliance(
        self,
        field_id: int,
        application_date: date,
        product_id: Optional[int] = None
    ) -> SeasonPeriod:
        """
        Get the season context for compliance checking.

        Used for checking max applications per season, etc.
        Considers whether the product label specifies calendar year vs growing season.

        Args:
            field_id: Field ID
            application_date: Date of the application
            product_id: Optional product ID for product-specific season rules

        Returns:
            SeasonPeriod for compliance calculations
        """
        # Future enhancement: check product.season_type if we add that field
        # For now, use field's season
        return self.get_current_season(
            field_id=field_id,
            target_date=application_date
        )

    def get_season_for_field(self, field_id: int) -> SeasonPeriod:
        """
        Convenience method to get current season for a specific field.

        Args:
            field_id: Field ID

        Returns:
            Current SeasonPeriod for the field
        """
        return self.get_current_season(field_id=field_id)

    def parse_season_label(
        self,
        season_label: str,
        crop_category: Optional[str] = None
    ) -> SeasonPeriod:
        """
        Parse a season label string into a SeasonPeriod.

        Args:
            season_label: Season string (e.g., "2024-2025" or "2024")
            crop_category: Optional crop category for context

        Returns:
            SeasonPeriod with dates derived from the label
        """
        start_date, end_date = self.get_season_date_range(
            season_label,
            crop_category=crop_category
        )

        config = self._get_season_config(None, crop_category)

        return SeasonPeriod(
            label=season_label,
            start_date=start_date,
            end_date=end_date,
            season_type=config.get('season_type', 'calendar_year'),
            is_current=(start_date <= date.today() <= end_date)
        )

    def _get_season_config(
        self,
        field_id: Optional[int],
        crop_category: Optional[str]
    ) -> Dict[str, Any]:
        """
        Get season configuration for field or category.

        Priority:
        1. Field's season_template
        2. Field's crop's season_template
        3. SeasonTemplate for crop category
        4. Built-in defaults for crop category
        5. Calendar year fallback

        Args:
            field_id: Optional field ID
            crop_category: Optional crop category

        Returns:
            Configuration dict with season parameters
        """
        # Try to get from database first
        if field_id:
            try:
                from api.models import Field
                field = Field.objects.select_related('crop').get(id=field_id)

                # Check if season_template field exists (migration may not have run)
                template = None
                if hasattr(field, 'season_template'):
                    template = field.season_template

                if not template and field.crop:
                    if hasattr(field.crop, 'season_template'):
                        template = field.crop.season_template
                    if not template and field.crop.category:
                        crop_category = field.crop.category

                if template:
                    return {
                        'start_month': template.start_month,
                        'start_day': template.start_day,
                        'duration_months': template.duration_months,
                        'crosses_calendar_year': template.crosses_calendar_year,
                        'label_format': template.label_format,
                        'template_id': template.id,
                        'season_type': template.season_type,
                    }
            except Exception:
                # Field not found or other error - fall through to defaults
                pass

        # Try to get SeasonTemplate from database by category
        if crop_category:
            try:
                from api.models import SeasonTemplate, Company
                company = None
                if self.company_id:
                    company = Company.objects.filter(id=self.company_id).first()

                template = SeasonTemplate.get_for_category(crop_category, company)
                if template:
                    return {
                        'start_month': template.start_month,
                        'start_day': template.start_day,
                        'duration_months': template.duration_months,
                        'crosses_calendar_year': template.crosses_calendar_year,
                        'label_format': template.label_format,
                        'template_id': template.id,
                        'season_type': template.season_type,
                    }
            except Exception:
                # Database not ready, SeasonTemplate doesn't exist, or other error
                # Fall through to built-in defaults
                pass

        # Fall back to built-in category defaults
        category_key = (crop_category or 'other').lower()
        if category_key in self.DEFAULT_SEASON_CONFIGS:
            config = self.DEFAULT_SEASON_CONFIGS[category_key].copy()
        else:
            config = self.DEFAULT_CONFIG.copy()

        config['template_id'] = None
        return config

    def _calculate_season(
        self,
        target_date: date,
        config: Dict[str, Any]
    ) -> SeasonPeriod:
        """
        Calculate season period for a target date given config.

        Args:
            target_date: Date to calculate season for
            config: Configuration dict with season parameters

        Returns:
            SeasonPeriod for the calculated season
        """
        year = target_date.year
        month = target_date.month

        start_month = config['start_month']
        start_day = config.get('start_day', 1)
        duration = config['duration_months']
        crosses_year = config['crosses_calendar_year']

        # Determine start year based on where target_date falls
        if crosses_year:
            # For Oct-Sep: if we're in Oct-Dec, season starts this year
            # If we're in Jan-Sep, season started last year
            if month >= start_month:
                start_year = year
            else:
                start_year = year - 1
        else:
            # For calendar-aligned seasons
            if month < start_month:
                start_year = year - 1
            else:
                start_year = year

        start_date = date(start_year, start_month, start_day)
        end_date = start_date + relativedelta(months=duration) - timedelta(days=1)

        # Generate label from format
        label_format = config.get('label_format', '{start_year}')
        label = label_format.format(
            start_year=start_year,
            end_year=start_year + 1 if crosses_year else start_year
        )

        return SeasonPeriod(
            label=label,
            start_date=start_date,
            end_date=end_date,
            template_id=config.get('template_id'),
            season_type=config.get('season_type', 'calendar_year'),
            is_current=False  # Will be set by caller
        )


# Convenience function for getting current citrus season (backward compatibility)
def get_citrus_season(target_date: Optional[date] = None) -> SeasonPeriod:
    """
    Get the current citrus season (Oct-Sep).

    This is a convenience function for backward compatibility with existing
    citrus-focused code.

    Args:
        target_date: Date to calculate season for (default: today)

    Returns:
        SeasonPeriod for citrus season
    """
    service = SeasonService()
    return service.get_current_season(
        crop_category='citrus',
        target_date=target_date
    )


# Convenience function for parsing legacy season strings
def parse_legacy_season(season_string: str) -> Tuple[date, date]:
    """
    Parse a legacy season string (e.g., "2024-2025") into dates.

    Assumes citrus-style Oct-Sep season for cross-year formats.

    Args:
        season_string: Season string like "2024-2025" or "2024"

    Returns:
        Tuple of (start_date, end_date)
    """
    if '-' in season_string:
        # Cross-year format (citrus): "2024-2025" -> Oct 1, 2024 to Sep 30, 2025
        start_year = int(season_string.split('-')[0])
        return date(start_year, 10, 1), date(start_year + 1, 9, 30)
    else:
        # Calendar year format: "2024" -> Jan 1, 2024 to Dec 31, 2024
        year = int(season_string)
        return date(year, 1, 1), date(year, 12, 31)


# =============================================================================
# COMMODITY NORMALIZATION
# =============================================================================

# Canonical commodity names and their known aliases/variants
COMMODITY_ALIASES = {
    'AVOCADOS': [
        'AVOCADO', 'CA AVOCADO', 'CA AVOCADOS', 'CALIFORNIA AVOCADO',
        'HASS', 'HASS AVOCADO', 'HASS AVOCADOS', 'FUERTE', 'FUERTE AVOCADO',
        'LAMB HASS', 'GEM', 'REED', 'ZUTANO', 'BACON',
    ],
    'LEMONS': ['LEMON'],
    'NAVELS': ['NAVEL', 'NAVEL ORANGE', 'NAVEL ORANGES'],
    'VALENCIAS': ['VALENCIA', 'VALENCIA ORANGE', 'VALENCIA ORANGES'],
    'TANGERINES': [
        'TANGERINE', 'MANDARIN', 'MANDARINS',
        'CLEMENTINE', 'CLEMENTINES', 'PIXIE', 'PIXIES',
        'TANGO', 'MURCOTT', 'W. MURCOTT',
    ],
    'GRAPEFRUIT': ['GRAPEFRUITS'],
    'LIMES': ['LIME'],
    'ORANGES': ['ORANGE'],
}

# Build reverse lookup: alias (uppercase) -> canonical name
_COMMODITY_LOOKUP = {}
for _canonical, _aliases in COMMODITY_ALIASES.items():
    _COMMODITY_LOOKUP[_canonical.upper()] = _canonical
    for _alias in _aliases:
        _COMMODITY_LOOKUP[_alias.upper()] = _canonical

logger = __import__('logging').getLogger(__name__)


def normalize_commodity(raw: str) -> str:
    """
    Normalize a free-text commodity string to a canonical name.

    Returns the canonical name if recognized, or the original string
    (uppercased/stripped) if not recognized. Logs a warning for
    unrecognized values so they can be flagged for review.

    Examples:
        normalize_commodity('HASS') -> 'AVOCADOS'
        normalize_commodity('CA AVOCADO') -> 'AVOCADOS'
        normalize_commodity('LEMON') -> 'LEMONS'
        normalize_commodity('SESPE') -> 'SESPE' (with warning)
    """
    cleaned = (raw or '').strip().upper()
    if not cleaned:
        return cleaned

    # Direct lookup
    if cleaned in _COMMODITY_LOOKUP:
        return _COMMODITY_LOOKUP[cleaned]

    # Substring match fallback (e.g., "CALIFORNIA HASS AVOCADO" contains "AVOCADO")
    for keyword, canonical in _COMMODITY_LOOKUP.items():
        if keyword in cleaned:
            return canonical

    # Unknown — return as-is with warning
    logger.warning(
        f"Unknown commodity value '{raw}' — not normalized. "
        f"Consider adding to COMMODITY_ALIASES in season_service.py."
    )
    return cleaned


def get_crop_category_for_commodity(commodity_string: str) -> str:
    """
    Map a free-text commodity string (e.g. 'LEMONS', 'HASS AVOCADOS')
    to a crop category key matching SeasonService.DEFAULT_SEASON_CONFIGS.

    Used to determine the correct season date range for a given commodity.

    Returns: 'citrus', 'subtropical', 'nut', 'vine', or 'citrus' (default fallback).
    """
    upper = (commodity_string or '').upper()
    if any(c in upper for c in ['AVOCADO', 'SUBTROPICAL']):
        return 'subtropical'
    elif any(c in upper for c in [
        'LEMON', 'ORANGE', 'NAVEL', 'VALENCIA',
        'TANGERINE', 'MANDARIN', 'GRAPEFRUIT', 'CITRUS', 'LIME'
    ]):
        return 'citrus'
    elif any(c in upper for c in ['ALMOND', 'WALNUT', 'PISTACHIO']):
        return 'nut'
    elif any(c in upper for c in ['GRAPE', 'WINE']):
        return 'vine'
    else:
        return 'citrus'  # Default to citrus for unknown commodities


def parse_season_for_category(season_string: str, crop_category: str) -> Tuple[date, date]:
    """
    Parse a season string into dates using the correct season config for the crop category.

    Unlike parse_legacy_season() which assumes citrus Oct-Sep for all cross-year formats,
    this function uses the actual season start month for the given crop category.

    Args:
        season_string: Season string like "2024-2025" or "2025"
        crop_category: Crop category key (e.g., 'citrus', 'subtropical', 'nut')

    Returns:
        Tuple of (start_date, end_date)
    """
    config = SeasonService.DEFAULT_SEASON_CONFIGS.get(
        crop_category,
        SeasonService.DEFAULT_SEASON_CONFIGS.get('other', {
            'start_month': 1, 'start_day': 1,
            'duration_months': 12, 'crosses_calendar_year': False,
        })
    )

    start_month = config.get('start_month', 1)
    start_day = config.get('start_day', 1)
    duration_months = config.get('duration_months', 12)

    if '-' in season_string:
        # Cross-year format: "2024-2025"
        start_year = int(season_string.split('-')[0])
    else:
        # Single year format: "2025"
        start_year = int(season_string)

    start = date(start_year, start_month, start_day)
    end = start + relativedelta(months=duration_months) - timedelta(days=1)
    return start, end
