# Generated migration to load water well data into production
from django.db import migrations
import json
import os
from decimal import Decimal


def load_water_data(apps, schema_editor):
    """
    Load water wells and readings from fixture file.

    This is a one-time data migration to populate production with
    historical well data from UWCD and OBGMA spreadsheets.
    """
    WaterSource = apps.get_model('api', 'WaterSource')
    WellReading = apps.get_model('api', 'WellReading')
    Farm = apps.get_model('api', 'Farm')

    # Get first farm as placeholder
    farm = Farm.objects.first()
    if not farm:
        print("  [SKIP] No farm exists, skipping water data load")
        return

    # Find fixture file (try multiple paths for different environments)
    possible_paths = [
        os.path.join(os.path.dirname(__file__), '..', 'fixtures', 'water_data_export.json'),
        os.path.join(os.path.dirname(__file__), '..', '..', 'fixtures', 'water_data_export.json'),
        '/app/fixtures/water_data_export.json',
        '/app/api/fixtures/water_data_export.json',
    ]

    fixture_path = None
    for path in possible_paths:
        if os.path.exists(path):
            fixture_path = path
            break

    if not fixture_path:
        print(f"  [SKIP] Fixture file not found in any of: {possible_paths}")
        return

    print(f"  Loading from: {fixture_path}")

    with open(fixture_path, 'r') as f:
        data = json.load(f)

    water_sources = [item for item in data if item.get('model') == 'api.watersource']
    well_readings = [item for item in data if item.get('model') == 'api.wellreading']

    print(f"  Found {len(water_sources)} water sources, {len(well_readings)} readings in fixture")

    # Track mapping of old PKs to new PKs
    source_pk_map = {}
    sources_created = 0
    sources_skipped = 0

    # Get existing wells by state_well_number to avoid duplicates
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

        # Check if already exists
        if state_well and state_well in existing_wells:
            # Find existing and map it
            existing = WaterSource.objects.filter(state_well_number=state_well).first()
            if existing:
                source_pk_map[old_pk] = existing.pk
                sources_skipped += 1
                continue

        # Create new water source
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

    print(f"  Water sources: {sources_created} created, {sources_skipped} already existed")

    # Import readings
    readings_created = 0
    readings_skipped = 0

    for item in well_readings:
        fields = item['fields']
        old_source_pk = fields.get('water_source')

        # Skip if source wasn't mapped
        if old_source_pk not in source_pk_map:
            readings_skipped += 1
            continue

        new_source_pk = source_pk_map[old_source_pk]
        reading_date = fields.get('reading_date')
        meter_reading = fields.get('meter_reading')

        # Skip if no meter reading
        if not meter_reading:
            readings_skipped += 1
            continue

        # Check for duplicate
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

    print(f"  Well readings: {readings_created} created, {readings_skipped} skipped")
    print(f"  [OK] Water data migration complete!")


def reverse_load(apps, schema_editor):
    """
    Reverse migration - remove data loaded by this migration.
    Only removes wells with notes containing 'Auto-imported from'.
    """
    WaterSource = apps.get_model('api', 'WaterSource')

    # Only delete wells that were auto-imported
    deleted = WaterSource.objects.filter(
        notes__contains='Auto-imported from'
    ).delete()

    print(f"  Removed {deleted[0]} auto-imported water sources")


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0039_optional_field_on_packout'),
    ]

    operations = [
        migrations.RunPython(load_water_data, reverse_load),
    ]
