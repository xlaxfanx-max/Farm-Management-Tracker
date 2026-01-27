"""
Management command to load water wells and readings from JSON.

This allows loading exported data into production by pasting JSON
or providing a URL to fetch the data from.

Usage:
    # From URL
    python manage.py load_water_data --url="https://example.com/data.json" --farm=1 --dry-run

    # From stdin (paste JSON)
    python manage.py load_water_data --farm=1 < water_data.json
"""

import json
import sys
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from api.models import WaterSource, WellReading, Farm


class Command(BaseCommand):
    help = 'Load water wells and readings from JSON data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--url',
            type=str,
            help='URL to fetch JSON data from'
        )
        parser.add_argument(
            '--farm',
            type=int,
            required=True,
            help='Farm ID to assign wells to (required)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview without saving'
        )
        parser.add_argument(
            '--clear-existing',
            action='store_true',
            help='Delete existing wells/readings before import'
        )

    def handle(self, *args, **options):
        farm_id = options['farm']
        dry_run = options['dry_run']
        clear_existing = options['clear_existing']
        url = options.get('url')

        # Verify farm exists
        try:
            farm = Farm.objects.get(id=farm_id)
        except Farm.DoesNotExist:
            raise CommandError(f'Farm with ID {farm_id} not found. Available farms:')

        self.stdout.write(f'\n{"=" * 60}')
        self.stdout.write(f'LOAD WATER DATA')
        self.stdout.write(f'{"=" * 60}')
        self.stdout.write(f'Farm: {farm.name} (ID: {farm_id})')
        self.stdout.write(f'Mode: {"DRY RUN" if dry_run else "LIVE IMPORT"}')
        self.stdout.write(f'{"=" * 60}\n')

        # Get JSON data
        if url:
            import urllib.request
            self.stdout.write(f'Fetching data from: {url}')
            try:
                with urllib.request.urlopen(url) as response:
                    data = json.loads(response.read().decode())
            except Exception as e:
                raise CommandError(f'Failed to fetch URL: {e}')
        else:
            self.stdout.write('Reading JSON from stdin...')
            try:
                data = json.load(sys.stdin)
            except json.JSONDecodeError as e:
                raise CommandError(f'Invalid JSON: {e}')

        # Parse the data
        water_sources = [item for item in data if item.get('model') == 'api.watersource']
        well_readings = [item for item in data if item.get('model') == 'api.wellreading']

        self.stdout.write(f'\nFound {len(water_sources)} water sources')
        self.stdout.write(f'Found {len(well_readings)} well readings\n')

        if clear_existing and not dry_run:
            self.stdout.write(self.style.WARNING('Clearing existing data...'))
            WellReading.objects.all().delete()
            WaterSource.objects.filter(source_type='well').delete()
            self.stdout.write('Existing wells and readings deleted.\n')

        # Import water sources
        source_pk_map = {}  # old_pk -> new_pk
        sources_created = 0

        self.stdout.write('Importing water sources...')
        for item in water_sources:
            old_pk = item['pk']
            fields = item['fields']

            # Check if already exists by state_well_number
            state_well = fields.get('state_well_number', '')
            if state_well:
                existing = WaterSource.objects.filter(state_well_number=state_well).first()
                if existing:
                    source_pk_map[old_pk] = existing.pk
                    self.stdout.write(f'  [EXISTS] {state_well} -> pk={existing.pk}')
                    continue

            if dry_run:
                self.stdout.write(f'  [DRY-RUN] Would create: {fields.get("name")} ({state_well})')
                source_pk_map[old_pk] = old_pk  # Use same pk for mapping
                sources_created += 1
                continue

            try:
                ws = WaterSource(
                    farm=farm,
                    name=fields.get('name', ''),
                    source_type='well',
                    well_name=fields.get('well_name', ''),
                    state_well_number=fields.get('state_well_number', ''),
                    gsa=fields.get('gsa', ''),
                    owner_code=fields.get('owner_code', ''),
                    base_extraction_rate=Decimal(fields['base_extraction_rate']) if fields.get('base_extraction_rate') else None,
                    gsp_rate=Decimal(fields['gsp_rate']) if fields.get('gsp_rate') else None,
                    domestic_rate=Decimal(fields['domestic_rate']) if fields.get('domestic_rate') else None,
                    fixed_quarterly_fee=Decimal(fields['fixed_quarterly_fee']) if fields.get('fixed_quarterly_fee') else None,
                    is_domestic_well=fields.get('is_domestic_well', False),
                    has_flowmeter=fields.get('has_flowmeter', True),
                    flowmeter_units=fields.get('flowmeter_units', 'acre_feet'),
                    flowmeter_multiplier=Decimal(fields.get('flowmeter_multiplier', '1.0')),
                    well_status=fields.get('well_status', 'active'),
                    active=fields.get('active', True),
                    used_for_irrigation=fields.get('used_for_irrigation', True),
                    notes=fields.get('notes', ''),
                )
                ws.save()
                source_pk_map[old_pk] = ws.pk
                sources_created += 1
                self.stdout.write(f'  [CREATED] {ws.name} ({ws.state_well_number}) -> pk={ws.pk}')
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  [ERROR] {fields.get("name")}: {e}'))

        self.stdout.write(f'\nWater sources created: {sources_created}\n')

        # Import well readings
        readings_created = 0
        readings_skipped = 0

        self.stdout.write('Importing well readings...')
        for item in well_readings:
            fields = item['fields']
            old_source_pk = fields.get('water_source')

            if old_source_pk not in source_pk_map:
                readings_skipped += 1
                continue

            new_source_pk = source_pk_map[old_source_pk]

            if dry_run:
                readings_created += 1
                continue

            try:
                # Check for duplicate
                reading_date = fields.get('reading_date')
                exists = WellReading.objects.filter(
                    water_source_id=new_source_pk,
                    reading_date=reading_date
                ).exists()

                if exists:
                    readings_skipped += 1
                    continue

                wr = WellReading(
                    water_source_id=new_source_pk,
                    reading_date=reading_date,
                    meter_reading=Decimal(fields['meter_reading']) if fields.get('meter_reading') else None,
                    reading_type=fields.get('reading_type', 'manual'),
                    extraction_acre_feet=Decimal(fields['extraction_acre_feet']) if fields.get('extraction_acre_feet') else None,
                    notes=fields.get('notes', ''),
                )
                wr.save()
                readings_created += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  [ERROR] Reading: {e}'))
                readings_skipped += 1

        self.stdout.write(f'\nWell readings created: {readings_created}')
        self.stdout.write(f'Well readings skipped: {readings_skipped}')

        if dry_run:
            self.stdout.write(self.style.WARNING('\n[DRY RUN] No changes made.\n'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\n[OK] Import complete!\n'))
