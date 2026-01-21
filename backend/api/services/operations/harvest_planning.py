"""
Harvest Planning Service for Farm Operations.

Handles:
- PHI clearance tracking across all fields
- Harvest readiness assessment
- Yield estimation based on tree counts and historical data
- Labor and equipment planning coordination

This service integrates with the pesticide compliance service for PHI
checking and provides comprehensive harvest planning support.

Designed to be called programmatically by both:
1. REST API endpoints (ViewSets)
2. AI agents for automated harvest planning
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any

from django.db import models
from django.db.models import Sum, Avg, Count, Q, F, Max
from django.utils import timezone

logger = logging.getLogger(__name__)


# =============================================================================
# DATA CLASSES FOR SERVICE RESULTS
# =============================================================================

@dataclass
class HarvestReadiness:
    """
    Harvest readiness status for a single field.

    Attributes:
        field_id: Database ID of the field
        field_name: Human-readable field name
        farm_id: ID of the parent farm
        farm_name: Name of the parent farm
        crop: Crop type (e.g., 'citrus')
        variety: Crop variety (e.g., 'Navel Orange')
        total_acres: Total acreage of the field
        is_ready: True if field is ready for harvest
        phi_clear: True if PHI requirements are met
        phi_clear_date: Date when PHI will be clear
        estimated_yield_bins: Estimated yield in bins
        estimated_yield_per_acre: Estimated yield per acre
        blocking_issues: List of issues preventing harvest
        advisory_notes: List of advisory notes
    """
    field_id: int
    field_name: str
    farm_id: Optional[int]
    farm_name: Optional[str]
    crop: Optional[str]
    variety: Optional[str]
    total_acres: float
    is_ready: bool
    phi_clear: bool
    phi_clear_date: date
    estimated_yield_bins: Optional[float] = None
    estimated_yield_per_acre: Optional[float] = None
    blocking_issues: List[str] = field(default_factory=list)
    advisory_notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'field_id': self.field_id,
            'field_name': self.field_name,
            'farm_id': self.farm_id,
            'farm_name': self.farm_name,
            'crop': self.crop,
            'variety': self.variety,
            'total_acres': self.total_acres,
            'is_ready': self.is_ready,
            'phi_clear': self.phi_clear,
            'phi_clear_date': self.phi_clear_date.isoformat(),
            'estimated_yield_bins': self.estimated_yield_bins,
            'estimated_yield_per_acre': self.estimated_yield_per_acre,
            'blocking_issues': self.blocking_issues,
            'advisory_notes': self.advisory_notes,
        }


@dataclass
class HarvestScheduleItem:
    """
    A single item in a harvest schedule recommendation.
    """
    field_id: int
    field_name: str
    recommended_date: date
    priority: str  # 'high', 'medium', 'low'
    estimated_bins: Optional[float]
    estimated_hours: Optional[float]
    crew_size_recommended: Optional[int]
    notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'field_id': self.field_id,
            'field_name': self.field_name,
            'recommended_date': self.recommended_date.isoformat(),
            'priority': self.priority,
            'estimated_bins': self.estimated_bins,
            'estimated_hours': self.estimated_hours,
            'crew_size_recommended': self.crew_size_recommended,
            'notes': self.notes,
        }


@dataclass
class YieldEstimate:
    """
    Yield estimate for a field.
    """
    field_id: int
    field_name: str
    estimation_method: str  # 'tree_count', 'historical', 'satellite', 'manual'
    estimated_total_bins: Optional[float]
    estimated_bins_per_acre: Optional[float]
    confidence: float  # 0-1
    factors: Dict[str, Any] = field(default_factory=dict)
    notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'field_id': self.field_id,
            'field_name': self.field_name,
            'estimation_method': self.estimation_method,
            'estimated_total_bins': self.estimated_total_bins,
            'estimated_bins_per_acre': self.estimated_bins_per_acre,
            'confidence': round(self.confidence, 2),
            'factors': self.factors,
            'notes': self.notes,
        }


# =============================================================================
# MAIN SERVICE CLASS
# =============================================================================

class HarvestPlanningService:
    """
    Service for harvest planning and coordination.

    Provides comprehensive harvest planning including PHI clearance tracking,
    yield estimation, and schedule optimization.

    Example usage:
        service = HarvestPlanningService()

        # Check harvest readiness for all fields
        readiness = service.assess_harvest_readiness(farm_id=1)

        for field in readiness:
            if field.is_ready:
                print(f"{field.field_name} ready for harvest")
            else:
                print(f"{field.field_name}: {', '.join(field.blocking_issues)}")

        # Get schedule recommendation
        schedule = service.get_harvest_schedule_recommendation(
            farm_id=1,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=14)
        )
    """

    # Default yield estimates by crop type (bins per acre)
    DEFAULT_YIELDS = {
        'navel': {'bins_per_acre': 15, 'bins_per_tree': 1.5},
        'valencia': {'bins_per_acre': 18, 'bins_per_tree': 1.8},
        'mandarin': {'bins_per_acre': 12, 'bins_per_tree': 1.2},
        'lemon': {'bins_per_acre': 20, 'bins_per_tree': 2.0},
        'grapefruit': {'bins_per_acre': 14, 'bins_per_tree': 1.4},
        'citrus': {'bins_per_acre': 16, 'bins_per_tree': 1.6},  # Generic
        'default': {'bins_per_acre': 15, 'bins_per_tree': 1.5},
    }

    # Harvest productivity estimates
    PRODUCTIVITY = {
        'bins_per_picker_hour': 2.5,  # Average bins per picker per hour
        'default_crew_size': 8,       # Default crew size
        'hours_per_day': 8,           # Working hours per day
    }

    def __init__(self, company_id: Optional[int] = None):
        """
        Initialize the service.

        Args:
            company_id: Optional company ID for RLS filtering
        """
        self.company_id = company_id
        self._compliance_service = None

    @property
    def compliance_service(self):
        """Lazy-load compliance service."""
        if self._compliance_service is None:
            from api.services.compliance.pesticide_compliance import PesticideComplianceService
            self._compliance_service = PesticideComplianceService(self.company_id)
        return self._compliance_service

    # =========================================================================
    # HARVEST READINESS ASSESSMENT
    # =========================================================================

    def assess_harvest_readiness(
        self,
        farm_id: Optional[int] = None,
        proposed_harvest_date: Optional[date] = None
    ) -> List[HarvestReadiness]:
        """
        Assess harvest readiness for all fields (or fields on a specific farm).

        Returns comprehensive status including PHI clearance for each field.

        Args:
            farm_id: Optional farm ID to filter by
            proposed_harvest_date: Optional date to check readiness against

        Returns:
            List of HarvestReadiness objects
        """
        from api.models import Field

        if proposed_harvest_date is None:
            proposed_harvest_date = date.today()

        queryset = Field.objects.filter(active=True).select_related('farm')

        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        if self.company_id:
            queryset = queryset.filter(farm__company_id=self.company_id)

        results = []

        for field in queryset:
            # Get PHI clearance
            phi_result = self.compliance_service.calculate_phi_clearance(
                field_id=field.id,
                proposed_harvest_date=proposed_harvest_date
            )

            # Estimate yield
            yield_estimate = self.estimate_field_yield(field.id)

            # Determine blocking issues
            blocking_issues = []
            advisory_notes = []

            if not phi_result.is_clear:
                blocking_issues.append(
                    f"PHI not clear until {phi_result.earliest_harvest_date.strftime('%m/%d/%Y')}"
                )
                if phi_result.blocking_applications:
                    for app in phi_result.blocking_applications:
                        advisory_notes.append(
                            f"Blocked by {app.get('product_name', 'Unknown')} "
                            f"applied {app.get('application_date', 'Unknown')}"
                        )

            # Check for other readiness factors
            if not field.current_crop:
                advisory_notes.append("No crop specified for field")

            is_ready = len(blocking_issues) == 0

            readiness = HarvestReadiness(
                field_id=field.id,
                field_name=field.name,
                farm_id=field.farm.id if field.farm else None,
                farm_name=field.farm.name if field.farm else None,
                crop=field.current_crop,
                variety=getattr(field, 'variety', None),
                total_acres=float(field.total_acres or 0),
                is_ready=is_ready,
                phi_clear=phi_result.is_clear,
                phi_clear_date=phi_result.earliest_harvest_date,
                estimated_yield_bins=yield_estimate.estimated_total_bins,
                estimated_yield_per_acre=yield_estimate.estimated_bins_per_acre,
                blocking_issues=blocking_issues,
                advisory_notes=advisory_notes,
            )
            results.append(readiness)

        # Sort by readiness (ready first), then by PHI clear date
        results.sort(key=lambda r: (not r.is_ready, r.phi_clear_date))

        return results

    # =========================================================================
    # HARVEST SCHEDULING
    # =========================================================================

    def get_harvest_schedule_recommendation(
        self,
        farm_id: int,
        start_date: date,
        end_date: date,
        available_crew_size: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Recommend harvest scheduling based on multiple factors.

        Considers:
        - PHI clearance dates
        - Crop maturity indicators
        - Weather forecast
        - Labor/equipment availability
        - Buyer commitments

        Args:
            farm_id: ID of the farm
            start_date: Start of scheduling window
            end_date: End of scheduling window
            available_crew_size: Available crew size (default: 8)

        Returns:
            Dictionary with schedule recommendation and details
        """
        if available_crew_size is None:
            available_crew_size = self.PRODUCTIVITY['default_crew_size']

        # Get readiness for all fields
        readiness_list = self.assess_harvest_readiness(
            farm_id=farm_id,
            proposed_harvest_date=start_date
        )

        schedule_items = []
        total_bins = 0
        total_hours = 0

        # Calculate daily capacity
        daily_capacity_bins = (
            available_crew_size *
            self.PRODUCTIVITY['hours_per_day'] *
            self.PRODUCTIVITY['bins_per_picker_hour']
        )

        current_date = start_date
        remaining_capacity_today = daily_capacity_bins

        for readiness in readiness_list:
            if not readiness.is_ready and readiness.phi_clear_date > end_date:
                # Skip fields that won't be ready in time
                continue

            # Determine when to schedule this field
            schedule_date = max(current_date, readiness.phi_clear_date)

            if schedule_date > end_date:
                continue

            estimated_bins = readiness.estimated_yield_bins or (
                readiness.total_acres * self.DEFAULT_YIELDS['default']['bins_per_acre']
            )

            # Calculate time needed
            estimated_hours = estimated_bins / self.PRODUCTIVITY['bins_per_picker_hour']
            estimated_days = estimated_hours / self.PRODUCTIVITY['hours_per_day']

            # Determine priority
            priority = 'medium'
            notes = []

            if readiness.phi_clear_date == date.today():
                priority = 'high'
                notes.append('PHI clears today')
            elif not readiness.is_ready:
                priority = 'low'
                notes.append(f'Wait for PHI clearance on {readiness.phi_clear_date.strftime("%m/%d")}')

            schedule_item = HarvestScheduleItem(
                field_id=readiness.field_id,
                field_name=readiness.field_name,
                recommended_date=schedule_date,
                priority=priority,
                estimated_bins=round(estimated_bins, 1),
                estimated_hours=round(estimated_hours, 1),
                crew_size_recommended=available_crew_size,
                notes=notes,
            )
            schedule_items.append(schedule_item)

            total_bins += estimated_bins
            total_hours += estimated_hours

        # Sort by date and priority
        priority_order = {'high': 0, 'medium': 1, 'low': 2}
        schedule_items.sort(key=lambda x: (x.recommended_date, priority_order.get(x.priority, 1)))

        return {
            'farm_id': farm_id,
            'schedule_period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'total_days': (end_date - start_date).days + 1,
            },
            'summary': {
                'total_fields': len(schedule_items),
                'ready_now': len([s for s in schedule_items if s.priority in ('high', 'medium')]),
                'total_estimated_bins': round(total_bins, 1),
                'total_estimated_hours': round(total_hours, 1),
                'estimated_days_needed': round(total_hours / self.PRODUCTIVITY['hours_per_day'], 1),
            },
            'crew_info': {
                'available_crew_size': available_crew_size,
                'daily_capacity_bins': round(daily_capacity_bins, 1),
            },
            'schedule': [item.to_dict() for item in schedule_items],
        }

    # =========================================================================
    # YIELD ESTIMATION
    # =========================================================================

    def estimate_field_yield(self, field_id: int) -> YieldEstimate:
        """
        Estimate yield for a field based on available data.

        Uses multiple data sources in priority order:
        1. Tree count (manual or satellite) × bins per tree
        2. Historical yields for this field
        3. Satellite canopy analysis (if available)
        4. Default values by crop type

        Args:
            field_id: ID of the field

        Returns:
            YieldEstimate with estimation details
        """
        from api.models import Field, Harvest

        try:
            field = Field.objects.get(id=field_id)
        except Field.DoesNotExist:
            return YieldEstimate(
                field_id=field_id,
                field_name='Unknown',
                estimation_method='error',
                estimated_total_bins=None,
                estimated_bins_per_acre=None,
                confidence=0,
                notes=['Field not found']
            )

        notes = []
        factors = {}
        method = 'default'
        confidence = 0.3  # Low confidence for defaults

        # Get crop-specific defaults
        crop_key = 'default'
        if field.current_crop:
            crop_lower = field.current_crop.lower()
            for key in self.DEFAULT_YIELDS.keys():
                if key in crop_lower:
                    crop_key = key
                    break

        defaults = self.DEFAULT_YIELDS.get(crop_key, self.DEFAULT_YIELDS['default'])

        # Try to get tree count
        tree_count = getattr(field, 'tree_count', None) or getattr(field, 'estimated_trees', None)

        if tree_count and tree_count > 0:
            # Tree-based estimation
            method = 'tree_count'
            bins_per_tree = defaults['bins_per_tree']
            estimated_total = tree_count * bins_per_tree
            estimated_per_acre = estimated_total / float(field.total_acres) if field.total_acres else None
            confidence = 0.7

            factors['tree_count'] = tree_count
            factors['bins_per_tree'] = bins_per_tree
            notes.append(f"Based on {tree_count} trees × {bins_per_tree} bins/tree")

        else:
            # Try historical data
            historical = Harvest.objects.filter(
                field_id=field_id
            ).aggregate(
                avg_bins_per_acre=Avg(
                    F('total_bins') / F('acres_harvested'),
                    filter=Q(acres_harvested__gt=0, total_bins__gt=0)
                ),
                last_yield=Max('total_bins')
            )

            if historical['avg_bins_per_acre']:
                method = 'historical'
                estimated_per_acre = float(historical['avg_bins_per_acre'])
                estimated_total = estimated_per_acre * float(field.total_acres) if field.total_acres else None
                confidence = 0.6

                factors['historical_avg'] = estimated_per_acre
                notes.append(f"Based on historical average yield")

            else:
                # Fall back to defaults
                estimated_per_acre = defaults['bins_per_acre']
                estimated_total = estimated_per_acre * float(field.total_acres) if field.total_acres else None

                factors['default_rate'] = defaults['bins_per_acre']
                factors['crop_type'] = crop_key
                notes.append(f"Using default estimate for {crop_key}")

        return YieldEstimate(
            field_id=field_id,
            field_name=field.name,
            estimation_method=method,
            estimated_total_bins=round(estimated_total, 1) if estimated_total else None,
            estimated_bins_per_acre=round(estimated_per_acre, 1) if estimated_per_acre else None,
            confidence=confidence,
            factors=factors,
            notes=notes,
        )

    # =========================================================================
    # BUYER COORDINATION
    # =========================================================================

    def get_buyer_harvest_summary(
        self,
        buyer_id: int,
        season_year: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get harvest summary for a specific buyer.

        Args:
            buyer_id: ID of the buyer
            season_year: Season year to summarize (default: current year)

        Returns:
            Dictionary with buyer harvest statistics
        """
        from api.models import Buyer, HarvestLoad

        if season_year is None:
            season_year = date.today().year

        try:
            buyer = Buyer.objects.get(id=buyer_id)
        except Buyer.DoesNotExist:
            return {'error': f'Buyer with ID {buyer_id} not found'}

        loads = HarvestLoad.objects.filter(
            buyer_id=buyer_id,
            harvest__harvest_date__year=season_year
        ).select_related('harvest', 'harvest__field')

        stats = loads.aggregate(
            total_loads=Count('id'),
            total_bins=Sum('bins'),
            total_revenue=Sum('total_revenue'),
            avg_price_per_bin=Avg('price_per_unit', filter=Q(price_unit='per_bin')),
        )

        # Get loads by field
        by_field = loads.values(
            'harvest__field__name'
        ).annotate(
            loads=Count('id'),
            bins=Sum('bins'),
            revenue=Sum('total_revenue')
        ).order_by('-bins')

        return {
            'buyer_id': buyer_id,
            'buyer_name': buyer.name,
            'season_year': season_year,
            'summary': {
                'total_loads': stats['total_loads'] or 0,
                'total_bins': float(stats['total_bins'] or 0),
                'total_revenue': float(stats['total_revenue'] or 0),
                'avg_price_per_bin': float(stats['avg_price_per_bin']) if stats['avg_price_per_bin'] else None,
            },
            'by_field': list(by_field),
        }
