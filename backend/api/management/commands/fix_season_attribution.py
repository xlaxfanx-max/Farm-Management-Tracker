"""
Management command to fix misattributed wash reports/packout reports.

Reports dated within the 2024-2025 citrus season (Oct 1, 2024 - Sep 30, 2025)
may have been incorrectly assigned to pools with season "2025-2026".

This command:
1. Finds PackoutReports where report_date falls in 2024-2025 but pool.season is wrong
2. Either moves them to the correct pool or updates the pool's season
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from datetime import date
from api.models import PackoutReport, Pool
from api.services.season_service import SeasonService


class Command(BaseCommand):
    help = 'Fix wash reports/packout reports attributed to the wrong season'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making changes',
        )
        parser.add_argument(
            '--company-id',
            type=int,
            help='Only fix reports for a specific company',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        company_id = options.get('company_id')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))

        season_service = SeasonService()

        # Find all packout reports
        reports = PackoutReport.objects.select_related('pool', 'pool__packinghouse')

        if company_id:
            reports = reports.filter(pool__packinghouse__company_id=company_id)

        misattributed = []

        for report in reports:
            if not report.report_date or not report.pool:
                continue

            # Determine what season this report should be in based on report_date
            commodity = report.pool.commodity or 'CITRUS'
            commodity_upper = commodity.upper()

            if any(c in commodity_upper for c in ['AVOCADO', 'SUBTROPICAL']):
                crop_category = 'subtropical'
            elif any(c in commodity_upper for c in ['LEMON', 'ORANGE', 'NAVEL', 'VALENCIA', 'TANGERINE', 'MANDARIN', 'GRAPEFRUIT', 'CITRUS']):
                crop_category = 'citrus'
            else:
                crop_category = 'citrus'

            correct_season = season_service.get_current_season(
                crop_category=crop_category,
                target_date=report.report_date
            )

            current_season = report.pool.season

            if current_season != correct_season.label:
                misattributed.append({
                    'report': report,
                    'current_season': current_season,
                    'correct_season': correct_season.label,
                    'report_date': report.report_date,
                    'commodity': commodity,
                    'pool': report.pool,
                })

        if not misattributed:
            self.stdout.write(self.style.SUCCESS('No misattributed reports found!'))
            return

        self.stdout.write(f'\nFound {len(misattributed)} misattributed report(s):\n')

        # Group by pool for easier fixing
        pools_to_fix = {}
        for item in misattributed:
            pool = item['pool']
            if pool.id not in pools_to_fix:
                pools_to_fix[pool.id] = {
                    'pool': pool,
                    'correct_season': item['correct_season'],
                    'reports': [],
                }
            pools_to_fix[pool.id]['reports'].append(item)

        for pool_id, data in pools_to_fix.items():
            pool = data['pool']
            correct_season = data['correct_season']
            reports_list = data['reports']

            self.stdout.write(f'\nPool: {pool.name} (ID: {pool.id})')
            self.stdout.write(f'  Packinghouse: {pool.packinghouse.name}')
            self.stdout.write(f'  Commodity: {pool.commodity}')
            self.stdout.write(f'  Current season: {pool.season}')
            self.stdout.write(f'  Correct season: {correct_season}')
            self.stdout.write(f'  Reports affected: {len(reports_list)}')

            for item in reports_list[:5]:  # Show first 5 reports
                self.stdout.write(f'    - Report {item["report"].id}: date={item["report_date"]}')
            if len(reports_list) > 5:
                self.stdout.write(f'    ... and {len(reports_list) - 5} more')

        if dry_run:
            self.stdout.write(self.style.WARNING('\nDRY RUN - No changes made. Run without --dry-run to apply fixes.'))
            return

        # Apply fixes
        self.stdout.write('\nApplying fixes...')

        with transaction.atomic():
            for pool_id, data in pools_to_fix.items():
                pool = data['pool']
                correct_season = data['correct_season']

                # Check if a pool with the correct season already exists
                existing_correct_pool = Pool.objects.filter(
                    packinghouse=pool.packinghouse,
                    pool_id=pool.pool_id,
                    season=correct_season
                ).exclude(id=pool.id).first()

                if existing_correct_pool:
                    # Move reports to the existing correct pool
                    report_ids = [item['report'].id for item in data['reports']]
                    PackoutReport.objects.filter(id__in=report_ids).update(pool=existing_correct_pool)
                    self.stdout.write(f'  Moved {len(report_ids)} reports from pool {pool.id} to pool {existing_correct_pool.id}')

                    # If the wrong pool is now empty, we could delete it
                    # (but let's be conservative and leave it)
                else:
                    # Check if ALL reports in this pool need to move to the same season
                    all_pool_reports = PackoutReport.objects.filter(pool=pool)
                    all_need_same_fix = all(
                        season_service.get_current_season(
                            crop_category='citrus',
                            target_date=r.report_date
                        ).label == correct_season
                        for r in all_pool_reports if r.report_date
                    )

                    if all_need_same_fix:
                        # Just update the pool's season
                        pool.season = correct_season
                        pool.save()
                        self.stdout.write(f'  Updated pool {pool.id} season from {data["reports"][0]["current_season"]} to {correct_season}')
                    else:
                        # Create a new pool for the correct season and move reports
                        new_pool = Pool.objects.create(
                            packinghouse=pool.packinghouse,
                            pool_id=pool.pool_id,
                            name=pool.name,
                            commodity=pool.commodity,
                            variety=pool.variety,
                            season=correct_season,
                            pool_type=pool.pool_type,
                            status=pool.status,
                        )
                        report_ids = [item['report'].id for item in data['reports']]
                        PackoutReport.objects.filter(id__in=report_ids).update(pool=new_pool)
                        self.stdout.write(f'  Created new pool {new_pool.id} with season {correct_season} and moved {len(report_ids)} reports')

        self.stdout.write(self.style.SUCCESS('\nFixes applied successfully!'))
