"""
Management command to load water wells from the bundled fixture file.

This command is designed to run on every deploy but skip if data already exists.
It loads the water_data_export.json fixture from the backend/fixtures folder.

Usage:
    python manage.py load_water_fixture
"""

import json
import os
from decimal import Decimal
from django.core.management.base import BaseCommand
from api.models import WaterSource, WellReading, Farm


class Command(BaseCommand):
    help = 'Load water wells and readings from bundled fixture file'

    def handle(self, *args, **options):
        # Check if we already have wells - skip if so
        existing_wells = WaterSource.objects.filter(source_type='well').count()
        if existing_wells >= 10:
            self.stdout.write(f'[SKIP] Already have {existing_wells} wells, skipping import')
            return

        # Get first farm
        farm = Farm.objects.first()
        if not farm:
            self.stdout.write('[SKIP] No farm exists, skipping import')
            return

        # Find fixture file
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
        possible_paths = [
            os.path.join(base_dir, 'fixtures', 'water_data_export.json'),
            '/app/fixtures/water_data_export.json',
        ]

        fixture_path = None
        for path in possible_paths:
            self.stdout.write(f'  Checking: {path}')
            if os.path.exists(path):
                fixture_path = path
                break

        if not fixture_path:
            self.stdout.write(self.style.WARNING(f'[SKIP] Fixture not found'))
            return

        self.stdout.write(f'Loading from: {fixture_path}')

        with open(fixture_path, 'r') as f:
            data = json.load(f)

        water_sources = [item for item in data if item.get('model') == 'api.watersource']
        well_readings = [item for item in data if item.get('model') == 'api.wellreading']

        self.stdout.write(f'Found {len(water_sources)} wells, {len(well_readings)} readings')

        # Build set of existing state well numbers
        existing_numbers = set()
        for ws in WaterSource.objects.filter(source_type='well'):
            if ws.state_well_number:
                existing_numbers.add(ws.state_well_number)

        # Import wells
        source_pk_map = {}
        created = 0

        for item in water_sources:
            old_pk = item['pk']
            fields = item['fields']
            state_well = fields.get('state_well_number', '')

            if state_well in existing_numbers:
                existing = WaterSource.objects.filter(state_well_number=state_well).first()
                if existing:
                    source_pk_map[old_pk] = existing.pk
                continue

            try:
                ws = WaterSource(
                    farm=farm,
                    name=fields.get('name', ''),
                    source_type='well',
                    well_name=fields.get('well_name', ''),
                    state_well_number=state_well,
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
                created += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Error creating well: {e}'))

        self.stdout.write(f'Wells created: {created}')

        # Import readings
        readings_created = 0

        for item in well_readings:
            fields = item['fields']
            old_source_pk = fields.get('water_source')

            if old_source_pk not in source_pk_map:
                continue

            new_source_pk = source_pk_map[old_source_pk]
            reading_date = fields.get('reading_date')
            meter_reading = fields.get('meter_reading')

            if not meter_reading:
                continue

            if WellReading.objects.filter(water_source_id=new_source_pk, reading_date=reading_date).exists():
                continue

            try:
                wr = WellReading(
                    water_source_id=new_source_pk,
                    reading_date=reading_date,
                    meter_reading=Decimal(meter_reading),
                    reading_type=fields.get('reading_type', 'manual'),
                    extraction_acre_feet=Decimal(fields['extraction_acre_feet']) if fields.get('extraction_acre_feet') else None,
                    notes=fields.get('notes', ''),
                )
                wr.save()
                readings_created += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Error creating reading: {e}'))

        self.stdout.write(f'Readings created: {readings_created}')
        self.stdout.write(self.style.SUCCESS('[OK] Water data import complete!'))
