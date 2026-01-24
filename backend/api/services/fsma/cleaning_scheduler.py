"""
FSMA Cleaning Schedule Management Service

Provides functionality for managing facility cleaning schedules,
tracking compliance, and generating alerts for missed cleanings.
"""

from datetime import date, datetime, timedelta
from typing import List, Dict, Optional, Tuple
from django.db.models import Q, Count, Max


class CleaningScheduler:
    """
    Service for managing facility cleaning schedules and compliance.

    Handles:
    - Determining which facilities need cleaning
    - Tracking cleaning compliance rates
    - Generating alerts for overdue cleanings
    - Providing schedule summaries
    """

    # Frequency definitions in days
    FREQUENCY_DAYS = {
        'daily': 1,
        'twice_daily': 0.5,  # Special handling needed
        'weekly': 7,
        'biweekly': 14,
        'monthly': 30,
        'as_needed': None,  # No scheduled requirement
        'after_use': None,  # No scheduled requirement
    }

    def __init__(self, company):
        """
        Initialize the scheduler for a specific company.

        Args:
            company: The Company model instance
        """
        self.company = company

    def get_todays_schedule(self) -> List[Dict]:
        """
        Get the cleaning schedule for today.

        Returns:
            List of facilities with their cleaning status for today
        """
        from api.models import FacilityLocation, FacilityCleaningLog

        today = date.today()

        facilities = FacilityLocation.objects.filter(
            company=self.company,
            is_active=True
        ).select_related('farm')

        # Get today's cleanings
        todays_cleanings = FacilityCleaningLog.objects.filter(
            facility__company=self.company,
            cleaning_date=today
        ).values('facility_id').annotate(
            cleaning_count=Count('id'),
            last_time=Max('cleaning_time')
        )

        cleaned_map = {c['facility_id']: c for c in todays_cleanings}

        schedule = []
        for facility in facilities:
            needs_cleaning = self._needs_cleaning_today(facility, today)
            cleaning_info = cleaned_map.get(facility.id)

            schedule.append({
                'facility_id': facility.id,
                'facility_name': facility.name,
                'facility_type': facility.facility_type,
                'facility_type_display': facility.get_facility_type_display(),
                'farm_id': facility.farm_id,
                'farm_name': facility.farm.name if facility.farm else None,
                'cleaning_frequency': facility.cleaning_frequency,
                'cleaning_frequency_display': facility.get_cleaning_frequency_display(),
                'needs_cleaning': needs_cleaning,
                'cleaned_today': cleaning_info is not None,
                'cleaning_count_today': cleaning_info['cleaning_count'] if cleaning_info else 0,
                'last_cleaning_time': str(cleaning_info['last_time']) if cleaning_info else None,
                'status': self._get_status(facility, needs_cleaning, cleaning_info),
            })

        # Sort by status (overdue first, then needs cleaning, then complete)
        status_order = {'overdue': 0, 'pending': 1, 'partial': 2, 'complete': 3, 'not_scheduled': 4}
        schedule.sort(key=lambda x: status_order.get(x['status'], 5))

        return schedule

    def get_overdue_facilities(self) -> List[Dict]:
        """
        Get facilities that are overdue for cleaning.

        Returns:
            List of overdue facilities with details
        """
        from api.models import FacilityLocation, FacilityCleaningLog

        today = date.today()
        overdue = []

        facilities = FacilityLocation.objects.filter(
            company=self.company,
            is_active=True,
            cleaning_frequency__in=['daily', 'twice_daily', 'weekly', 'biweekly', 'monthly']
        ).select_related('farm')

        for facility in facilities:
            last_cleaning = FacilityCleaningLog.objects.filter(
                facility=facility
            ).order_by('-cleaning_date', '-cleaning_time').first()

            if self._is_overdue(facility, last_cleaning, today):
                days_overdue = self._calculate_days_overdue(facility, last_cleaning, today)
                overdue.append({
                    'facility_id': facility.id,
                    'facility_name': facility.name,
                    'facility_type': facility.facility_type,
                    'facility_type_display': facility.get_facility_type_display(),
                    'farm_name': facility.farm.name if facility.farm else None,
                    'cleaning_frequency': facility.cleaning_frequency,
                    'last_cleaning_date': str(last_cleaning.cleaning_date) if last_cleaning else None,
                    'days_overdue': days_overdue,
                    'urgency': 'high' if days_overdue > 2 else 'medium' if days_overdue > 1 else 'low',
                })

        # Sort by days overdue (most overdue first)
        overdue.sort(key=lambda x: x['days_overdue'], reverse=True)

        return overdue

    def get_compliance_summary(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict:
        """
        Get a compliance summary for a date range.

        Args:
            start_date: Start of the period (defaults to 30 days ago)
            end_date: End of the period (defaults to today)

        Returns:
            Dictionary with compliance metrics
        """
        from api.models import FacilityLocation, FacilityCleaningLog

        if end_date is None:
            end_date = date.today()
        if start_date is None:
            start_date = end_date - timedelta(days=30)

        # Get facilities with scheduled cleaning requirements
        scheduled_facilities = FacilityLocation.objects.filter(
            company=self.company,
            is_active=True,
            cleaning_frequency__in=['daily', 'twice_daily', 'weekly', 'biweekly', 'monthly']
        )

        total_required = 0
        total_completed = 0
        by_facility = []

        for facility in scheduled_facilities:
            required, completed = self._calculate_facility_compliance(
                facility, start_date, end_date
            )
            total_required += required
            total_completed += completed

            compliance_rate = (completed / required * 100) if required > 0 else 100

            by_facility.append({
                'facility_id': facility.id,
                'facility_name': facility.name,
                'required_cleanings': required,
                'completed_cleanings': completed,
                'compliance_rate': round(compliance_rate, 1),
            })

        overall_rate = (total_completed / total_required * 100) if total_required > 0 else 100

        return {
            'period_start': str(start_date),
            'period_end': str(end_date),
            'total_facilities': scheduled_facilities.count(),
            'total_required_cleanings': total_required,
            'total_completed_cleanings': total_completed,
            'overall_compliance_rate': round(overall_rate, 1),
            'by_facility': sorted(by_facility, key=lambda x: x['compliance_rate']),
        }

    def get_upcoming_schedule(self, days: int = 7) -> List[Dict]:
        """
        Get the cleaning schedule for the upcoming days.

        Args:
            days: Number of days to look ahead

        Returns:
            List of scheduled cleanings by date
        """
        from api.models import FacilityLocation

        facilities = FacilityLocation.objects.filter(
            company=self.company,
            is_active=True
        ).select_related('farm')

        schedule = []
        today = date.today()

        for day_offset in range(days):
            check_date = today + timedelta(days=day_offset)
            day_schedule = {
                'date': str(check_date),
                'day_name': check_date.strftime('%A'),
                'facilities': [],
            }

            for facility in facilities:
                if self._needs_cleaning_on_date(facility, check_date):
                    day_schedule['facilities'].append({
                        'facility_id': facility.id,
                        'facility_name': facility.name,
                        'facility_type_display': facility.get_facility_type_display(),
                        'farm_name': facility.farm.name if facility.farm else None,
                    })

            schedule.append(day_schedule)

        return schedule

    def _needs_cleaning_today(self, facility, today: date) -> bool:
        """Determine if a facility needs cleaning today."""
        freq = facility.cleaning_frequency

        if freq in ['as_needed', 'after_use']:
            return False  # No scheduled requirement

        if freq in ['daily', 'twice_daily']:
            return True

        # For less frequent schedules, check based on day of week/month
        if freq == 'weekly':
            # Assume Monday is cleaning day (can be customized)
            return today.weekday() == 0
        elif freq == 'biweekly':
            # Every other Monday
            week_num = today.isocalendar()[1]
            return today.weekday() == 0 and week_num % 2 == 0
        elif freq == 'monthly':
            # First day of month
            return today.day == 1

        return False

    def _needs_cleaning_on_date(self, facility, check_date: date) -> bool:
        """Determine if a facility needs cleaning on a specific date."""
        return self._needs_cleaning_today(facility, check_date)

    def _is_overdue(self, facility, last_cleaning, today: date) -> bool:
        """Check if a facility is overdue for cleaning."""
        freq = facility.cleaning_frequency

        if freq in ['as_needed', 'after_use']:
            return False

        if last_cleaning is None:
            return True  # Never cleaned

        days_since = (today - last_cleaning.cleaning_date).days

        max_days = self.FREQUENCY_DAYS.get(freq)
        if max_days is None:
            return False

        # Allow some grace period (1 day for daily, proportional for others)
        grace_period = 1 if max_days <= 1 else int(max_days * 0.2)

        return days_since > (max_days + grace_period)

    def _calculate_days_overdue(self, facility, last_cleaning, today: date) -> int:
        """Calculate how many days overdue a facility is."""
        if last_cleaning is None:
            # Assume it's been overdue since facility was created
            return (today - facility.created_at.date()).days

        freq = facility.cleaning_frequency
        max_days = self.FREQUENCY_DAYS.get(freq, 1)

        if max_days is None:
            return 0

        days_since = (today - last_cleaning.cleaning_date).days
        return max(0, days_since - int(max_days))

    def _get_status(self, facility, needs_cleaning: bool, cleaning_info) -> str:
        """Determine the cleaning status for a facility."""
        freq = facility.cleaning_frequency

        if freq in ['as_needed', 'after_use']:
            return 'not_scheduled'

        if not needs_cleaning:
            return 'not_scheduled'

        if cleaning_info is None:
            return 'pending'

        # For twice_daily, need 2 cleanings
        if freq == 'twice_daily':
            if cleaning_info['cleaning_count'] >= 2:
                return 'complete'
            else:
                return 'partial'

        return 'complete'

    def _calculate_facility_compliance(
        self,
        facility,
        start_date: date,
        end_date: date
    ) -> Tuple[int, int]:
        """
        Calculate required and completed cleanings for a facility in a period.

        Returns:
            Tuple of (required_cleanings, completed_cleanings)
        """
        from api.models import FacilityCleaningLog

        freq = facility.cleaning_frequency
        days = (end_date - start_date).days + 1

        # Calculate required cleanings
        if freq == 'daily':
            required = days
        elif freq == 'twice_daily':
            required = days * 2
        elif freq == 'weekly':
            required = days // 7 + 1
        elif freq == 'biweekly':
            required = days // 14 + 1
        elif freq == 'monthly':
            required = days // 30 + 1
        else:
            required = 0

        # Count actual cleanings
        completed = FacilityCleaningLog.objects.filter(
            facility=facility,
            cleaning_date__gte=start_date,
            cleaning_date__lte=end_date
        ).count()

        return required, completed

    def generate_alerts(self) -> List[Dict]:
        """
        Generate alerts for cleaning issues.

        Returns:
            List of alert dictionaries
        """
        alerts = []
        today = date.today()

        # Get overdue facilities
        overdue = self.get_overdue_facilities()
        for item in overdue:
            priority = 'critical' if item['urgency'] == 'high' else 'high' if item['urgency'] == 'medium' else 'medium'
            alerts.append({
                'type': 'cleaning_overdue',
                'priority': priority,
                'title': f"Cleaning Overdue: {item['facility_name']}",
                'message': f"{item['facility_name']} is {item['days_overdue']} day(s) overdue for cleaning. "
                          f"Last cleaned: {item['last_cleaning_date'] or 'Never'}",
                'facility_id': item['facility_id'],
            })

        # Check for facilities that need cleaning today but haven't been
        schedule = self.get_todays_schedule()
        current_hour = datetime.now().hour

        # After noon, warn about facilities not yet cleaned
        if current_hour >= 12:
            for item in schedule:
                if item['needs_cleaning'] and not item['cleaned_today']:
                    alerts.append({
                        'type': 'cleaning_pending',
                        'priority': 'medium',
                        'title': f"Cleaning Pending: {item['facility_name']}",
                        'message': f"{item['facility_name']} has not been cleaned today and is past noon.",
                        'facility_id': item['facility_id'],
                    })

        return alerts
