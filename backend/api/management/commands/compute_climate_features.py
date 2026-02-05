"""
Management command to backfill GDD, chill hours, and climate features
from existing CIMIS data for all fields/seasons.
"""
from datetime import date

from django.core.management.base import BaseCommand

from api.models import Field, Farm
from api.services.climate_features import ClimateFeatureService
from api.services.yield_feature_engine import YieldFeatureEngine
from api.services.season_service import SeasonService


class Command(BaseCommand):
    help = 'Backfill GDD, chill hours, and climate features from existing CIMIS data'

    def add_arguments(self, parser):
        parser.add_argument('--company', type=int, help='Company ID to process')
        parser.add_argument('--field', type=int, help='Single field ID to process')
        parser.add_argument('--season', type=str, help='Specific season label (e.g., 2024-2025)')
        parser.add_argument(
            '--all-seasons', action='store_true',
            help='Compute for all historical seasons (default: current only)'
        )
        parser.add_argument(
            '--years-back', type=int, default=5,
            help='Number of years back to compute (with --all-seasons)'
        )

    def handle(self, *args, **options):
        company_id = options.get('company')
        field_id = options.get('field')
        season_label = options.get('season')
        all_seasons = options.get('all_seasons')
        years_back = options.get('years_back', 5)

        if not company_id and not field_id:
            self.stderr.write('Provide --company or --field')
            return

        # Get fields to process
        fields = Field.objects.select_related('farm', 'crop').filter(
            farm__active=True,
        )
        if field_id:
            fields = fields.filter(id=field_id)
            if fields.exists():
                company_id = fields.first().farm.company_id
        elif company_id:
            fields = fields.filter(farm__company_id=company_id)

        fields = list(fields)
        self.stdout.write(f"Processing {len(fields)} field(s)...")

        season_service = SeasonService()
        stats = {'processed': 0, 'skipped': 0, 'errors': 0}

        for field_obj in fields:
            crop_category = 'citrus'
            if field_obj.crop and hasattr(field_obj.crop, 'category'):
                crop_category = field_obj.crop.category or 'citrus'

            cimis_station = field_obj.farm.cimis_station_id if field_obj.farm else None
            if not cimis_station:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Skipping {field_obj.name}: no CIMIS station on farm"
                    )
                )
                stats['skipped'] += 1
                continue

            # Determine which seasons to compute
            seasons_to_compute = []
            if season_label:
                seasons_to_compute = [season_label]
            elif all_seasons:
                available = season_service.get_available_seasons(
                    crop_category=crop_category,
                    years_back=years_back,
                    years_forward=0,
                )
                seasons_to_compute = [s.label for s in available]
            else:
                current = season_service.get_current_season(crop_category=crop_category)
                seasons_to_compute = [current.label]

            for label in seasons_to_compute:
                try:
                    engine = YieldFeatureEngine(company_id=field_obj.farm.company_id)
                    result = engine.assemble_features(
                        field_id=field_obj.id,
                        season_label=label,
                    )
                    engine.save_snapshot(result)

                    completeness = result.data_quality.get('completeness_pct', 0)
                    self.stdout.write(
                        f"  {field_obj.name} / {label}: "
                        f"{completeness}% data completeness"
                    )
                    stats['processed'] += 1

                except Exception as e:
                    self.stderr.write(
                        self.style.ERROR(
                            f"  Error: {field_obj.name} / {label}: {e}"
                        )
                    )
                    stats['errors'] += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Processed: {stats['processed']}, "
            f"Skipped: {stats['skipped']}, Errors: {stats['errors']}"
        ))
