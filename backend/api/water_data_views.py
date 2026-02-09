"""
Water data import views: load water wells and readings from fixtures.
"""
import json
import os
from decimal import Decimal as D
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Farm, WaterSource, WellReading


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def load_water_data_api(request):
    """
    API endpoint to load water wells and readings from the fixtures file.

    GET: Returns info about what will be imported (dry run)
    POST: Actually performs the import

    Query Parameters:
        farm_id: Farm ID to assign wells to (defaults to first farm)
    """
    # Get farm
    farm_id = request.query_params.get('farm_id')
    if farm_id:
        try:
            farm = Farm.objects.get(id=int(farm_id))
        except Farm.DoesNotExist:
            return Response({'error': f'Farm {farm_id} not found'}, status=400)
    else:
        farm = Farm.objects.first()
        if not farm:
            return Response({'error': 'No farms exist'}, status=400)

    # Load fixture file
    fixture_path = os.path.join(os.path.dirname(__file__), '..', 'fixtures', 'water_data_export.json')
    if not os.path.exists(fixture_path):
        return Response({'error': 'Fixture file not found', 'path': fixture_path}, status=404)

    with open(fixture_path, 'r') as f:
        data = json.load(f)

    water_sources = [item for item in data if item.get('model') == 'api.watersource']
    well_readings = [item for item in data if item.get('model') == 'api.wellreading']

    # Check existing
    existing_wells = set(WaterSource.objects.filter(
        source_type='well',
        state_well_number__isnull=False
    ).exclude(state_well_number='').values_list('state_well_number', flat=True))

    new_sources = [s for s in water_sources if s['fields'].get('state_well_number') not in existing_wells]

    if request.method == 'GET':
        return Response({
            'farm': {'id': farm.id, 'name': farm.name},
            'fixture_file': fixture_path,
            'total_sources_in_file': len(water_sources),
            'total_readings_in_file': len(well_readings),
            'existing_wells_in_db': len(existing_wells),
            'new_wells_to_create': len(new_sources),
            'message': 'Use POST to actually import the data'
        })

    # POST - do the import
    source_pk_map = {}
    sources_created = 0
    sources_skipped = 0

    for item in water_sources:
        old_pk = item['pk']
        fields = item['fields']
        state_well = fields.get('state_well_number', '')

        # Check if exists
        existing = WaterSource.objects.filter(state_well_number=state_well).first() if state_well else None
        if existing:
            source_pk_map[old_pk] = existing.pk
            sources_skipped += 1
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
                base_extraction_rate=D(fields['base_extraction_rate']) if fields.get('base_extraction_rate') else None,
                gsp_rate=D(fields['gsp_rate']) if fields.get('gsp_rate') else None,
                domestic_rate=D(fields['domestic_rate']) if fields.get('domestic_rate') else None,
                fixed_quarterly_fee=D(fields['fixed_quarterly_fee']) if fields.get('fixed_quarterly_fee') else None,
                is_domestic_well=fields.get('is_domestic_well', False),
                has_flowmeter=fields.get('has_flowmeter', True),
                flowmeter_units=fields.get('flowmeter_units', 'acre_feet'),
                flowmeter_multiplier=D(fields.get('flowmeter_multiplier', '1.0')),
                well_status=fields.get('well_status', 'active'),
                active=fields.get('active', True),
                used_for_irrigation=fields.get('used_for_irrigation', True),
                notes=fields.get('notes', ''),
            )
            ws.save()
            source_pk_map[old_pk] = ws.pk
            sources_created += 1
        except Exception as e:
            return Response({'error': f'Failed to create well: {e}'}, status=500)

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

        # Check duplicate
        if WellReading.objects.filter(water_source_id=new_source_pk, reading_date=reading_date).exists():
            readings_skipped += 1
            continue

        # Skip if no meter reading
        if not fields.get('meter_reading'):
            readings_skipped += 1
            continue

        try:
            wr = WellReading(
                water_source_id=new_source_pk,
                reading_date=reading_date,
                meter_reading=D(fields['meter_reading']),
                reading_type=fields.get('reading_type', 'manual'),
                extraction_acre_feet=D(fields['extraction_acre_feet']) if fields.get('extraction_acre_feet') else None,
                notes=fields.get('notes', ''),
            )
            wr.save()
            readings_created += 1
        except Exception as e:
            readings_skipped += 1

    return Response({
        'success': True,
        'farm': {'id': farm.id, 'name': farm.name},
        'wells_created': sources_created,
        'wells_skipped': sources_skipped,
        'readings_created': readings_created,
        'readings_skipped': readings_skipped,
    })
