# Retry migration to load water well data into production
# This is needed because 0040 may have run before the path was fixed
from django.db import migrations
import json
import os
from decimal import Decimal


def load_water_data(apps, schema_editor):
    """
    Load water wells and readings from fixture file.
    """
    WaterSource = apps.get_model('api', 'WaterSource')
    WellReading = apps.get_model('api', 'WellReading')
    Farm = apps.get_model('api', 'Farm')

    # Check if data already loaded (by previous migration or this one)
    existing_count = WaterSource.objects.filter(source_type='well').count()
    if existing_count >= 10:
        print(f"  [SKIP] Already have {existing_count} wells, skipping load")
        return

    # Get first farm as placeholder
    farm = Farm.objects.first()
    if not farm:
        print("  [SKIP] No farm exists, skipping water data load")
        return

    # Find fixture file - migration is at backend/api/migrations/
    # Fixture is at backend/fixtures/
    migration_dir = os.path.dirname(__file__)

    possible_paths = [
        # Correct path: from api/migrations go up to api, up to backend, then fixtures
        os.path.join(migration_dir, '..', '..', 'fixtures', 'water_data_export.json'),
        # Railway Docker: /app is the backend folder
        '/app/fixtures/water_data_export.json',
    ]

    fixture_path = None
    for path in possible_paths:
        normalized = os.path.normpath(path)
        print(f"  Checking: {normalized}")
        if os.path.exists(normalized):
            fixture_path = normalized
            print(f"  Found!")
            break

    if not fixture_path:
        print(f"  [ERROR] Fixture file not found!")
        print(f"  Migration dir: {migration_dir}")
        print(f"  Tried paths: {possible_paths}")
        return

    print(f"  Loading from: {fixture_path}")

    with open(fixture_path, 'r') as f:
        data = json.load(f)

    water_sources = [item for item in data if item.get('model') == 'api.watersource']
    well_readings = [item for item in data if item.get('model') == 'api.wellreading']

    print(f"  Found {len(water_sources)} water sources, {len(well_readings)} readings")

    # Track mapping of old PKs to new PKs
    source_pk_map = {}
    sources_created = 0
    sources_skipped = 0

    # Get existing wells by state_well_number
    existing_wells = set(
        WaterSource.objects.filter(
            source_type='well',
            state_well_number__isnull=False
        ).exclude(
            state_well_number=''
        ).values_list('state_well_number', flat=True)
    )

    for item in water_sources:
        old_pk = item['pk']
        fields = item['fields']
        state_well = fields.get('state_well_number', '')

        if state_well and state_well in existing_wells:
            existing = WaterSource.objects.filter(state_well_number=state_well).first()
            if existing:
                source_pk_map[old_pk] = existing.pk
                sources_skipped += 1
                continue

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
        sources_created += 1

    print(f"  Wells: {sources_created} created, {sources_skipped} existed")

    # Import readings
    readings_created = 0
    readings_skipped = 0

    for item in well_readings:
        fields = item['fields']
        old_source_pk = fields.get('water_source')

        if old_source_pk not in source_pk_map:
            readings_skipped += 1
            continue

        new_source_pk = source_pk_map[old_source_pk]
        reading_date = fields.get('reading_date')
        meter_reading = fields.get('meter_reading')

        if not meter_reading:
            readings_skipped += 1
            continue

        if WellReading.objects.filter(
            water_source_id=new_source_pk,
            reading_date=reading_date
        ).exists():
            readings_skipped += 1
            continue

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

    print(f"  Readings: {readings_created} created, {readings_skipped} skipped")
    print(f"  [OK] Water data load complete!")


def reverse_load(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0040_load_water_data'),
    ]

    operations = [
        migrations.RunPython(load_water_data, reverse_load),
    ]
