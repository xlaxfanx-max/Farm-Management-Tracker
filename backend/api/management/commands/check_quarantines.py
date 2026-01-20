"""
Management command to check HLB quarantine status for all farms.

Run with: python manage.py check_quarantines

This command:
- Checks all farms with GPS coordinates that haven't been checked in 24 hours
- Logs when a farm's quarantine status changes
- Can be run via cron for daily batch updates

Example cron entry for daily runs at 6 AM:
0 6 * * * cd /path/to/project && python manage.py check_quarantines
"""

import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import Farm, QuarantineStatus
from api.services.quarantine_service import CDFAQuarantineService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Checks HLB quarantine status for all farms with GPS coordinates'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force re-check all farms regardless of last check time',
        )
        parser.add_argument(
            '--company',
            type=int,
            help='Only check farms for a specific company ID',
        )
        parser.add_argument(
            '--farm',
            type=int,
            help='Only check a specific farm by ID',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be checked without making API calls',
        )

    def handle(self, *args, **options):
        force = options.get('force', False)
        company_id = options.get('company')
        farm_id = options.get('farm')
        dry_run = options.get('dry_run', False)

        self.stdout.write('Checking HLB quarantine status for farms...\n')

        # Build queryset
        farms = Farm.objects.filter(
            active=True,
            gps_latitude__isnull=False,
            gps_longitude__isnull=False,
        )

        if company_id:
            farms = farms.filter(company_id=company_id)
            self.stdout.write(f'Filtering by company ID: {company_id}')

        if farm_id:
            farms = farms.filter(id=farm_id)
            self.stdout.write(f'Checking specific farm ID: {farm_id}')

        # Filter by last check time unless forcing
        if not force:
            cutoff = timezone.now() - timedelta(hours=24)
            # Get farm IDs that have been checked recently
            recently_checked = QuarantineStatus.objects.filter(
                farm__isnull=False,
                quarantine_type='HLB',
                last_checked__gte=cutoff,
            ).values_list('farm_id', flat=True)

            farms = farms.exclude(id__in=recently_checked)
            self.stdout.write(f'Skipping {len(recently_checked)} farms checked in last 24 hours')

        total_farms = farms.count()
        self.stdout.write(f'Found {total_farms} farms to check\n')

        if total_farms == 0:
            self.stdout.write(self.style.SUCCESS('No farms need checking.'))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No API calls will be made\n'))
            for farm in farms:
                self.stdout.write(
                    f'  Would check: {farm.name} ({farm.gps_latitude}, {farm.gps_longitude})'
                )
            return

        # Initialize service
        service = CDFAQuarantineService()

        # Counters
        checked = 0
        in_quarantine = 0
        clear = 0
        errors = 0
        status_changes = 0

        for farm in farms:
            self.stdout.write(f'Checking: {farm.name}...', ending=' ')

            # Get existing status record
            existing = QuarantineStatus.objects.filter(
                farm=farm,
                quarantine_type='HLB',
            ).first()

            previous_status = existing.in_quarantine if existing else None

            # Query CDFA API
            result = service.check_location(farm.gps_latitude, farm.gps_longitude)

            if result['error']:
                self.stdout.write(self.style.ERROR(f'ERROR: {result["error"]}'))
                errors += 1

                # Update error message if existing record
                if existing:
                    existing.error_message = result['error']
                    existing.save()
                continue

            checked += 1

            # Determine if status changed
            status_changed = (
                previous_status is not None and
                previous_status != result['in_quarantine']
            )

            if status_changed:
                status_changes += 1
                change_msg = (
                    f'CHANGED from {"IN QUARANTINE" if previous_status else "CLEAR"} '
                    f'to {"IN QUARANTINE" if result["in_quarantine"] else "CLEAR"}'
                )
                self.stdout.write(self.style.WARNING(change_msg))
                logger.warning(
                    f'Quarantine status change for {farm.name} (ID: {farm.id}): {change_msg}'
                )
            elif result['in_quarantine']:
                self.stdout.write(self.style.ERROR(f'IN QUARANTINE: {result["zone_name"]}'))
            else:
                self.stdout.write(self.style.SUCCESS('CLEAR'))

            # Update counters
            if result['in_quarantine']:
                in_quarantine += 1
            else:
                clear += 1

            # Save or update status record
            status_data = {
                'in_quarantine': result['in_quarantine'],
                'zone_name': result['zone_name'] or '',
                'check_latitude': farm.gps_latitude,
                'check_longitude': farm.gps_longitude,
                'raw_response': result['raw_response'],
                'error_message': '',
            }

            if status_changed:
                status_data['last_changed'] = timezone.now()

            if existing:
                for key, value in status_data.items():
                    setattr(existing, key, value)
                existing.save()
            else:
                QuarantineStatus.objects.create(
                    farm=farm,
                    quarantine_type='HLB',
                    **status_data
                )

        # Summary
        self.stdout.write('\n' + '=' * 50)
        self.stdout.write(self.style.SUCCESS('Quarantine check complete!'))
        self.stdout.write(f'  Total farms checked: {checked}')
        self.stdout.write(f'  In quarantine: {in_quarantine}')
        self.stdout.write(f'  Clear: {clear}')
        self.stdout.write(f'  Status changes: {status_changes}')
        if errors:
            self.stdout.write(self.style.ERROR(f'  Errors: {errors}'))

        # Log summary
        logger.info(
            f'Quarantine check completed: {checked} farms checked, '
            f'{in_quarantine} in quarantine, {clear} clear, '
            f'{status_changes} status changes, {errors} errors'
        )
