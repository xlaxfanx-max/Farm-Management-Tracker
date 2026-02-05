"""
Management command to fetch SSURGO soil data for fields with GPS coordinates.
"""
from django.core.management.base import BaseCommand

from api.services.soil_survey_service import SoilSurveyService


class Command(BaseCommand):
    help = 'Fetch SSURGO soil data for all fields with GPS coordinates'

    def add_arguments(self, parser):
        parser.add_argument('--company', type=int, required=True, help='Company ID')
        parser.add_argument('--field', type=int, help='Single field ID')
        parser.add_argument(
            '--force', action='store_true',
            help='Re-fetch even if data already exists'
        )

    def handle(self, *args, **options):
        company_id = options['company']
        field_id = options.get('field')
        force = options.get('force', False)

        service = SoilSurveyService()

        if field_id:
            from api.models import Field
            try:
                field_obj = Field.objects.select_related('farm').get(
                    id=field_id, farm__company_id=company_id
                )
            except Field.DoesNotExist:
                self.stderr.write(f"Field {field_id} not found for company {company_id}")
                return

            lat = float(field_obj.gps_latitude or field_obj.farm.gps_latitude or 0)
            lon = float(field_obj.gps_longitude or field_obj.farm.gps_longitude or 0)

            if not lat or not lon:
                self.stderr.write(f"No GPS coordinates for field {field_id}")
                return

            self.stdout.write(f"Fetching soil data for {field_obj.name} ({lat}, {lon})...")
            props = service.fetch_soil_properties(lat, lon)

            if props:
                service.save_to_field(field_id, props)
                self.stdout.write(self.style.SUCCESS(
                    f"  Saved: {props.muname} ({props.texture_class})"
                ))
            else:
                self.stderr.write(f"  No SSURGO data found for ({lat}, {lon})")
        else:
            self.stdout.write(f"Syncing soil data for company {company_id}...")
            summary = service.sync_all_fields(company_id, force=force)

            self.stdout.write(self.style.SUCCESS(
                f"\nDone. "
                f"Synced: {summary['synced']}, "
                f"Skipped: {summary['skipped']}, "
                f"Errors: {summary['errors']}, "
                f"No GPS: {summary['no_gps']}"
            ))
