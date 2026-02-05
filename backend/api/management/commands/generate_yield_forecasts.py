"""
Management command to run the yield forecast pipeline for fields/seasons.
"""
from django.core.management.base import BaseCommand

from api.services.yield_forecast_service import YieldForecastService
from api.services.season_service import SeasonService


class Command(BaseCommand):
    help = 'Run yield forecast pipeline for current or specified season'

    def add_arguments(self, parser):
        parser.add_argument('--company', type=int, required=True, help='Company ID')
        parser.add_argument('--field', type=int, help='Single field ID')
        parser.add_argument('--season', type=str, help='Season label (e.g., 2025-2026)')
        parser.add_argument(
            '--method', type=str, default='auto',
            choices=['auto', 'historical_avg', 'climate_adjusted', 'bearing_adjusted', 'crop_baseline'],
            help='Forecast method (default: auto)'
        )
        parser.add_argument(
            '--publish', action='store_true',
            help='Auto-publish forecasts (default: draft)'
        )
        parser.add_argument(
            '--crop-category', type=str,
            help='Filter to specific crop category (e.g., citrus, subtropical)'
        )

    def handle(self, *args, **options):
        company_id = options['company']
        field_id = options.get('field')
        season_label = options.get('season')
        method = options.get('method', 'auto')
        publish = options.get('publish', False)
        crop_category = options.get('crop_category')

        service = YieldForecastService(company_id=company_id)

        stats = {'generated': 0, 'skipped': 0, 'errors': 0}

        if field_id:
            # Single field
            if not season_label:
                season_service = SeasonService()
                current = season_service.get_current_season()
                season_label = current.label

            self.stdout.write(f"Forecasting field {field_id} for {season_label}...")

            try:
                result = service.forecast_field(field_id, season_label, method=method)

                if result.skipped:
                    self.stdout.write(self.style.WARNING(
                        f"  Skipped: {result.skip_reason}"
                    ))
                    stats['skipped'] += 1
                else:
                    forecast = service.save_forecast(
                        field_id, season_label, result, auto_publish=publish,
                    )
                    self.stdout.write(self.style.SUCCESS(
                        f"  {result.predicted_yield_per_acre} {result.yield_unit}/acre "
                        f"({result.lower_bound_per_acre}-{result.upper_bound_per_acre}) "
                        f"method={result.forecast_method}"
                    ))
                    if result.degradation_warnings:
                        for w in result.degradation_warnings:
                            self.stdout.write(self.style.WARNING(f"    Warning: {w}"))
                    stats['generated'] += 1

            except Exception as e:
                self.stderr.write(self.style.ERROR(f"  Error: {e}"))
                stats['errors'] += 1
        else:
            # All fields
            self.stdout.write(
                f"Forecasting all fields for company {company_id}"
                f"{f' ({crop_category})' if crop_category else ''}..."
            )

            results = service.forecast_all_fields(
                season_label=season_label,
                crop_category=crop_category,
            )

            for fid, resolved_label, result in results:
                if result.skipped:
                    self.stdout.write(self.style.WARNING(
                        f"  Field {fid}: Skipped - {result.skip_reason}"
                    ))
                    stats['skipped'] += 1
                else:
                    try:
                        forecast = service.save_forecast(
                            fid, resolved_label, result, auto_publish=publish,
                        )
                        self.stdout.write(
                            f"  Field {fid}: {result.predicted_yield_per_acre} "
                            f"{result.yield_unit}/acre "
                            f"[{result.forecast_method}]"
                        )
                        stats['generated'] += 1
                    except Exception as e:
                        self.stderr.write(self.style.ERROR(
                            f"  Field {fid}: Error saving - {e}"
                        ))
                        stats['errors'] += 1

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Generated: {stats['generated']}, "
            f"Skipped: {stats['skipped']}, Errors: {stats['errors']}"
        ))
