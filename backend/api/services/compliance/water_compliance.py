"""
Water Compliance Service for SGMA and Water Management.

Handles:
- Allocation tracking and limits
- Extraction monitoring
- Compliance status reporting
- Usage forecasting

California SGMA (Sustainable Groundwater Management Act) requires:
- Semi-annual extraction reporting
- Compliance with Groundwater Sustainability Agency (GSA) allocations
- Meter calibration and maintenance
- Well registration and monitoring

This service is designed to be called programmatically by both:
1. REST API endpoints (ViewSets)
2. AI agents for automated compliance monitoring
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple

from django.db.models import Sum, Avg, Count, Q, Max
from django.utils import timezone

logger = logging.getLogger(__name__)


# =============================================================================
# DATA CLASSES FOR SERVICE RESULTS
# =============================================================================

@dataclass
class AllocationStatus:
    """
    Water allocation status for a single water source.

    Attributes:
        water_source_id: Database ID of the water source/well
        water_source_name: Human-readable name
        water_year: Water year (e.g., "2024-2025")
        allocated_af: Total allocated acre-feet
        used_af: Total extracted acre-feet
        remaining_af: Remaining allocation
        percent_used: Percentage of allocation used
        projected_annual_use: Projected total use at current rate
        on_track: True if usage is on track to stay within allocation
        warnings: List of warning messages
    """
    water_source_id: int
    water_source_name: str
    water_year: str
    allocated_af: float
    used_af: float
    remaining_af: float
    percent_used: float
    projected_annual_use: Optional[float] = None
    on_track: bool = True
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'water_source_id': self.water_source_id,
            'water_source_name': self.water_source_name,
            'water_year': self.water_year,
            'allocated_af': round(self.allocated_af, 2),
            'used_af': round(self.used_af, 2),
            'remaining_af': round(self.remaining_af, 2),
            'percent_used': round(self.percent_used, 1),
            'projected_annual_use': round(self.projected_annual_use, 2) if self.projected_annual_use else None,
            'on_track': self.on_track,
            'warnings': self.warnings,
        }


@dataclass
class ComplianceViolation:
    """
    Represents a compliance violation or issue.
    """
    violation_type: str  # 'over_allocation', 'missing_reading', 'calibration_overdue', 'permit_expired'
    severity: str  # 'error', 'warning', 'info'
    water_source_id: Optional[int]
    water_source_name: Optional[str]
    message: str
    recommended_action: str
    deadline: Optional[date] = None
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'violation_type': self.violation_type,
            'severity': self.severity,
            'water_source_id': self.water_source_id,
            'water_source_name': self.water_source_name,
            'message': self.message,
            'recommended_action': self.recommended_action,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'details': self.details,
        }


@dataclass
class UsageForecast:
    """
    Water usage forecast result.
    """
    water_source_id: int
    water_source_name: str
    forecast_period_months: int
    current_ytd_use: float
    projected_annual_use: float
    allocated_af: float
    projected_remaining: float
    forecast_confidence: float
    monthly_projections: List[Dict[str, Any]] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'water_source_id': self.water_source_id,
            'water_source_name': self.water_source_name,
            'forecast_period_months': self.forecast_period_months,
            'current_ytd_use': round(self.current_ytd_use, 2),
            'projected_annual_use': round(self.projected_annual_use, 2),
            'allocated_af': round(self.allocated_af, 2),
            'projected_remaining': round(self.projected_remaining, 2),
            'forecast_confidence': round(self.forecast_confidence, 2),
            'monthly_projections': self.monthly_projections,
            'notes': self.notes,
        }


@dataclass
class SGMAReportData:
    """
    Data for SGMA semi-annual reporting.
    """
    farm_id: int
    farm_name: str
    report_period: str  # 'H1' (Oct-Mar) or 'H2' (Apr-Sep)
    water_year: str
    period_start: date
    period_end: date
    wells: List[Dict[str, Any]]
    total_extraction_af: float
    total_allocation_af: float
    compliance_status: str  # 'compliant', 'over_allocation', 'pending'
    notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'farm_id': self.farm_id,
            'farm_name': self.farm_name,
            'report_period': self.report_period,
            'water_year': self.water_year,
            'period_start': self.period_start.isoformat(),
            'period_end': self.period_end.isoformat(),
            'wells': self.wells,
            'total_extraction_af': round(self.total_extraction_af, 2),
            'total_allocation_af': round(self.total_allocation_af, 2),
            'compliance_status': self.compliance_status,
            'notes': self.notes,
        }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_current_water_year() -> str:
    """
    Get the current California water year.
    Water year runs Oct 1 to Sep 30.
    """
    today = date.today()
    if today.month >= 10:
        return f"{today.year}-{today.year + 1}"
    else:
        return f"{today.year - 1}-{today.year}"


def get_water_year_dates(water_year: Optional[str] = None) -> Dict[str, date]:
    """
    Get start and end dates for a water year.

    Args:
        water_year: Water year string (e.g., "2024-2025")

    Returns:
        Dictionary with 'start' and 'end' dates
    """
    if not water_year:
        water_year = get_current_water_year()

    start_year = int(water_year.split('-')[0])

    return {
        'start': date(start_year, 10, 1),
        'end': date(start_year + 1, 9, 30)
    }


def get_current_reporting_period() -> Dict[str, Any]:
    """
    Get the current SGMA reporting period.

    Returns:
        Dictionary with period name, start, and end dates
    """
    today = date.today()

    # H1: October - March
    # H2: April - September
    if today.month >= 10:
        # H1 of current water year
        return {
            'period': 'H1',
            'start': date(today.year, 10, 1),
            'end': date(today.year + 1, 3, 31),
        }
    elif today.month <= 3:
        # H1 of previous water year (started last October)
        return {
            'period': 'H1',
            'start': date(today.year - 1, 10, 1),
            'end': date(today.year, 3, 31),
        }
    else:
        # H2 of current water year
        return {
            'period': 'H2',
            'start': date(today.year, 4, 1),
            'end': date(today.year, 9, 30),
        }


# =============================================================================
# MAIN SERVICE CLASS
# =============================================================================

class WaterComplianceService:
    """
    Service for water compliance monitoring and SGMA reporting.

    Provides comprehensive water management including allocation tracking,
    extraction monitoring, compliance checking, and report generation.

    Example usage:
        service = WaterComplianceService()

        # Get allocation status for all wells
        status = service.get_allocation_status(farm_id=1)

        for well in status:
            if not well.on_track:
                print(f"Warning: {well.water_source_name} - {well.percent_used}% used")

        # Check compliance
        violations = service.check_extraction_compliance(water_source_id=5)

        # Forecast usage
        forecast = service.forecast_water_usage(farm_id=1, months_ahead=6)
    """

    # Warning thresholds
    ALLOCATION_WARNING_PERCENT = 80   # Warn at 80% allocation used
    ALLOCATION_ERROR_PERCENT = 100    # Error at 100% (over allocation)
    CALIBRATION_WARNING_DAYS = 90     # Warn if calibration due within 90 days

    def __init__(self, company_id: Optional[int] = None):
        """
        Initialize the service.

        Args:
            company_id: Optional company ID for RLS filtering
        """
        self.company_id = company_id

    # =========================================================================
    # ALLOCATION STATUS METHODS
    # =========================================================================

    def get_allocation_status(
        self,
        farm_id: Optional[int] = None,
        water_year: Optional[str] = None
    ) -> List[AllocationStatus]:
        """
        Get current allocation status for all water sources.

        Args:
            farm_id: Optional farm ID to filter by
            water_year: Water year to check (default: current)

        Returns:
            List of AllocationStatus for each water source
        """
        from api.models import WaterSource, WellReading, WaterAllocation

        if water_year is None:
            water_year = get_current_water_year()

        wy_dates = get_water_year_dates(water_year)

        # Get wells
        queryset = WaterSource.objects.filter(
            source_type='well',
            active=True
        ).select_related('farm')

        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        if self.company_id:
            queryset = queryset.filter(farm__company_id=self.company_id)

        results = []

        for well in queryset:
            # Get allocation for this water year
            allocation_sum = WaterAllocation.objects.filter(
                water_source=well,
                water_year=water_year
            ).exclude(
                allocation_type='transferred_out'
            ).aggregate(
                total=Sum('allocated_acre_feet')
            )['total'] or Decimal('0')

            # Get extraction for this water year
            extraction_sum = WellReading.objects.filter(
                water_source=well,
                reading_date__gte=wy_dates['start'],
                reading_date__lte=min(wy_dates['end'], date.today())
            ).aggregate(
                total=Sum('extraction_acre_feet')
            )['total'] or Decimal('0')

            allocated = float(allocation_sum)
            used = float(extraction_sum)
            remaining = allocated - used
            percent_used = (used / allocated * 100) if allocated > 0 else 0

            # Calculate projected annual use
            days_in_year = (wy_dates['end'] - wy_dates['start']).days
            days_elapsed = (date.today() - wy_dates['start']).days
            days_elapsed = max(1, min(days_elapsed, days_in_year))

            daily_rate = used / days_elapsed
            projected_annual = daily_rate * days_in_year

            # Determine if on track
            warnings = []
            on_track = True

            if percent_used >= self.ALLOCATION_ERROR_PERCENT:
                on_track = False
                warnings.append(f"OVER ALLOCATION: {percent_used:.1f}% used")
            elif percent_used >= self.ALLOCATION_WARNING_PERCENT:
                warnings.append(f"High usage: {percent_used:.1f}% of allocation used")

            if projected_annual > allocated:
                on_track = False
                warnings.append(f"Projected to exceed allocation by {projected_annual - allocated:.1f} AF")

            status = AllocationStatus(
                water_source_id=well.id,
                water_source_name=well.name,
                water_year=water_year,
                allocated_af=allocated,
                used_af=used,
                remaining_af=remaining,
                percent_used=percent_used,
                projected_annual_use=projected_annual,
                on_track=on_track,
                warnings=warnings,
            )
            results.append(status)

        # Sort by percent used (highest first)
        results.sort(key=lambda s: s.percent_used, reverse=True)

        return results

    # =========================================================================
    # COMPLIANCE CHECKING METHODS
    # =========================================================================

    def check_extraction_compliance(
        self,
        water_source_id: int
    ) -> List[ComplianceViolation]:
        """
        Check if extractions are within permitted limits.

        Returns compliance status and any violations.

        Args:
            water_source_id: ID of the water source to check

        Returns:
            List of ComplianceViolation objects
        """
        from api.models import WaterSource, WellReading, WaterAllocation

        violations = []

        try:
            well = WaterSource.objects.get(id=water_source_id)
        except WaterSource.DoesNotExist:
            violations.append(ComplianceViolation(
                violation_type='error',
                severity='error',
                water_source_id=water_source_id,
                water_source_name='Unknown',
                message=f'Water source with ID {water_source_id} not found',
                recommended_action='Verify water source ID'
            ))
            return violations

        water_year = get_current_water_year()
        wy_dates = get_water_year_dates(water_year)

        # Check allocation compliance
        allocation = WaterAllocation.objects.filter(
            water_source=well,
            water_year=water_year
        ).exclude(
            allocation_type='transferred_out'
        ).aggregate(
            total=Sum('allocated_acre_feet')
        )['total'] or Decimal('0')

        extraction = WellReading.objects.filter(
            water_source=well,
            reading_date__gte=wy_dates['start'],
            reading_date__lte=date.today()
        ).aggregate(
            total=Sum('extraction_acre_feet')
        )['total'] or Decimal('0')

        if extraction > allocation:
            violations.append(ComplianceViolation(
                violation_type='over_allocation',
                severity='error',
                water_source_id=well.id,
                water_source_name=well.name,
                message=f'Extraction ({float(extraction):.2f} AF) exceeds allocation ({float(allocation):.2f} AF)',
                recommended_action='Reduce pumping immediately or acquire additional allocation',
                details={
                    'allocated_af': float(allocation),
                    'extracted_af': float(extraction),
                    'over_by_af': float(extraction - allocation)
                }
            ))

        # Check meter calibration
        if well.has_flowmeter:
            if well.next_calibration_due:
                days_until_due = (well.next_calibration_due - date.today()).days

                if days_until_due < 0:
                    violations.append(ComplianceViolation(
                        violation_type='calibration_overdue',
                        severity='warning',
                        water_source_id=well.id,
                        water_source_name=well.name,
                        message=f'Meter calibration is {abs(days_until_due)} days overdue',
                        recommended_action='Schedule meter calibration immediately',
                        deadline=well.next_calibration_due,
                        details={'days_overdue': abs(days_until_due)}
                    ))
                elif days_until_due <= self.CALIBRATION_WARNING_DAYS:
                    violations.append(ComplianceViolation(
                        violation_type='calibration_due_soon',
                        severity='info',
                        water_source_id=well.id,
                        water_source_name=well.name,
                        message=f'Meter calibration due in {days_until_due} days',
                        recommended_action='Schedule meter calibration',
                        deadline=well.next_calibration_due,
                        details={'days_until_due': days_until_due}
                    ))
            elif not well.meter_calibration_current:
                violations.append(ComplianceViolation(
                    violation_type='calibration_missing',
                    severity='warning',
                    water_source_id=well.id,
                    water_source_name=well.name,
                    message='No calibration record found',
                    recommended_action='Schedule meter calibration and update records'
                ))

        # Check recent readings
        last_reading = WellReading.objects.filter(
            water_source=well
        ).order_by('-reading_date').first()

        if last_reading:
            days_since_reading = (date.today() - last_reading.reading_date).days

            if days_since_reading > 45:  # More than 1.5 months
                violations.append(ComplianceViolation(
                    violation_type='missing_reading',
                    severity='warning' if days_since_reading < 60 else 'error',
                    water_source_id=well.id,
                    water_source_name=well.name,
                    message=f'No well reading recorded in {days_since_reading} days',
                    recommended_action='Record current meter reading',
                    details={'days_since_last_reading': days_since_reading}
                ))
        else:
            violations.append(ComplianceViolation(
                violation_type='no_readings',
                severity='warning',
                water_source_id=well.id,
                water_source_name=well.name,
                message='No well readings recorded',
                recommended_action='Begin recording regular meter readings'
            ))

        return violations

    def check_all_wells_compliance(
        self,
        farm_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Check compliance for all wells.

        Args:
            farm_id: Optional farm ID to filter by

        Returns:
            Dictionary with compliance summary and violations
        """
        from api.models import WaterSource

        queryset = WaterSource.objects.filter(
            source_type='well',
            active=True
        )

        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        if self.company_id:
            queryset = queryset.filter(farm__company_id=self.company_id)

        all_violations = []
        wells_checked = 0

        for well in queryset:
            violations = self.check_extraction_compliance(well.id)
            all_violations.extend(violations)
            wells_checked += 1

        # Categorize violations
        errors = [v for v in all_violations if v.severity == 'error']
        warnings = [v for v in all_violations if v.severity == 'warning']
        infos = [v for v in all_violations if v.severity == 'info']

        return {
            'wells_checked': wells_checked,
            'total_violations': len(all_violations),
            'summary': {
                'errors': len(errors),
                'warnings': len(warnings),
                'info': len(infos),
            },
            'is_compliant': len(errors) == 0,
            'violations': [v.to_dict() for v in all_violations],
        }

    # =========================================================================
    # FORECASTING METHODS
    # =========================================================================

    def forecast_water_usage(
        self,
        farm_id: int,
        months_ahead: int = 6
    ) -> List[UsageForecast]:
        """
        Forecast water usage based on historical patterns.

        Uses historical extraction data and irrigation requirements
        to project future water usage.

        Args:
            farm_id: ID of the farm
            months_ahead: Number of months to forecast

        Returns:
            List of UsageForecast for each water source
        """
        from api.models import WaterSource, WellReading, WaterAllocation

        water_year = get_current_water_year()
        wy_dates = get_water_year_dates(water_year)

        wells = WaterSource.objects.filter(
            farm_id=farm_id,
            source_type='well',
            active=True
        )

        results = []

        for well in wells:
            # Get historical usage patterns
            historical = WellReading.objects.filter(
                water_source=well
            ).values(
                'reading_date__month'
            ).annotate(
                avg_extraction=Avg('extraction_acre_feet')
            ).order_by('reading_date__month')

            monthly_avgs = {h['reading_date__month']: float(h['avg_extraction'] or 0) for h in historical}

            # Get current year usage
            ytd_use = WellReading.objects.filter(
                water_source=well,
                reading_date__gte=wy_dates['start'],
                reading_date__lte=date.today()
            ).aggregate(
                total=Sum('extraction_acre_feet')
            )['total'] or Decimal('0')

            # Get allocation
            allocation = WaterAllocation.objects.filter(
                water_source=well,
                water_year=water_year
            ).exclude(
                allocation_type='transferred_out'
            ).aggregate(
                total=Sum('allocated_acre_feet')
            )['total'] or Decimal('0')

            # Build monthly projections
            monthly_projections = []
            projected_total = float(ytd_use)

            current_month = date.today().month
            for i in range(months_ahead):
                forecast_month = (current_month + i) % 12 + 1

                # Use historical average or estimate
                if forecast_month in monthly_avgs:
                    monthly_use = monthly_avgs[forecast_month]
                else:
                    # Use overall average
                    monthly_use = sum(monthly_avgs.values()) / len(monthly_avgs) if monthly_avgs else 2.0

                projected_total += monthly_use
                monthly_projections.append({
                    'month': forecast_month,
                    'projected_use_af': round(monthly_use, 2),
                    'cumulative_af': round(projected_total, 2)
                })

            # Calculate confidence based on data quality
            confidence = min(0.9, len(monthly_avgs) / 12 * 0.8 + 0.2) if monthly_avgs else 0.3

            notes = []
            if not monthly_avgs:
                notes.append('Limited historical data - using estimates')
            if projected_total > float(allocation):
                notes.append(f'WARNING: Projected to exceed allocation by {projected_total - float(allocation):.1f} AF')

            forecast = UsageForecast(
                water_source_id=well.id,
                water_source_name=well.name,
                forecast_period_months=months_ahead,
                current_ytd_use=float(ytd_use),
                projected_annual_use=projected_total,
                allocated_af=float(allocation),
                projected_remaining=float(allocation) - projected_total,
                forecast_confidence=confidence,
                monthly_projections=monthly_projections,
                notes=notes,
            )
            results.append(forecast)

        return results

    # =========================================================================
    # SGMA REPORTING METHODS
    # =========================================================================

    def generate_sgma_report_data(
        self,
        farm_id: int,
        report_period: str  # 'H1' or 'H2'
    ) -> SGMAReportData:
        """
        Generate data needed for SGMA semi-annual reporting.

        Args:
            farm_id: ID of the farm
            report_period: 'H1' (Oct-Mar) or 'H2' (Apr-Sep)

        Returns:
            SGMAReportData with all required information
        """
        from api.models import Farm, WaterSource, WellReading, WaterAllocation

        try:
            farm = Farm.objects.get(id=farm_id)
        except Farm.DoesNotExist:
            return SGMAReportData(
                farm_id=farm_id,
                farm_name='Unknown',
                report_period=report_period,
                water_year='Unknown',
                period_start=date.today(),
                period_end=date.today(),
                wells=[],
                total_extraction_af=0,
                total_allocation_af=0,
                compliance_status='error',
                notes=['Farm not found']
            )

        # Determine period dates
        water_year = get_current_water_year()
        wy_dates = get_water_year_dates(water_year)

        if report_period == 'H1':
            period_start = wy_dates['start']
            period_end = date(wy_dates['start'].year + 1, 3, 31)
        else:  # H2
            period_start = date(wy_dates['end'].year, 4, 1)
            period_end = wy_dates['end']

        # Get all wells for this farm
        wells = WaterSource.objects.filter(
            farm=farm,
            source_type='well',
            active=True
        )

        well_data = []
        total_extraction = Decimal('0')
        total_allocation = Decimal('0')
        notes = []

        for well in wells:
            # Get extraction for the period
            extraction = WellReading.objects.filter(
                water_source=well,
                reading_date__gte=period_start,
                reading_date__lte=min(period_end, date.today())
            ).aggregate(
                total=Sum('extraction_acre_feet')
            )['total'] or Decimal('0')

            # Get allocation for the water year
            allocation = WaterAllocation.objects.filter(
                water_source=well,
                water_year=water_year
            ).exclude(
                allocation_type='transferred_out'
            ).aggregate(
                total=Sum('allocated_acre_feet')
            )['total'] or Decimal('0')

            # Period allocation (half of annual for semi-annual)
            period_allocation = allocation / 2

            well_info = {
                'well_id': well.id,
                'well_name': well.name,
                'state_well_number': getattr(well, 'state_well_number', None),
                'gsa': getattr(well, 'gsa', None),
                'has_flowmeter': well.has_flowmeter,
                'extraction_af': float(extraction),
                'period_allocation_af': float(period_allocation),
                'annual_allocation_af': float(allocation),
            }
            well_data.append(well_info)

            total_extraction += extraction
            total_allocation += period_allocation

            # Check for issues
            if not well.has_flowmeter:
                notes.append(f'{well.name}: No flowmeter installed')

        # Determine compliance status
        if total_extraction > total_allocation:
            compliance_status = 'over_allocation'
            notes.append(f'OVER ALLOCATION: {float(total_extraction - total_allocation):.2f} AF over limit')
        elif total_extraction > total_allocation * Decimal('0.9'):
            compliance_status = 'near_limit'
            notes.append('Near allocation limit')
        else:
            compliance_status = 'compliant'

        return SGMAReportData(
            farm_id=farm_id,
            farm_name=farm.name,
            report_period=report_period,
            water_year=water_year,
            period_start=period_start,
            period_end=period_end,
            wells=well_data,
            total_extraction_af=float(total_extraction),
            total_allocation_af=float(total_allocation),
            compliance_status=compliance_status,
            notes=notes,
        )
