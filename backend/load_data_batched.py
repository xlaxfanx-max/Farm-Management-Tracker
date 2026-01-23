"""
Batch data loader for Railway - handles large datasets with connection management.
Disables FK constraints during loading to handle circular dependencies.
"""
import os
import sys
import django
import json
import time

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pesticide_tracker.settings')
django.setup()

from django.core import serializers
from django.db import connection

def load_in_batches(filename, batch_size=100):
    """Load fixture data in batches with FK constraints disabled."""

    print(f"Loading {filename}...")

    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Total records: {len(data)}")

    # Group by model for ordered loading (FK dependencies matter!)
    models_order = [
        # Base models with no FK dependencies
        'api.permission',
        'api.company',
        # User depends on Company (current_company FK)
        'api.user',
        # These depend on User and/or Company
        'api.role',
        'api.companymembership',
        'api.invitation',
        # Tokens depend on User
        'token_blacklist.outstandingtoken',
        'token_blacklist.blacklistedtoken',
        'api.crop',
        'api.rootstock',
        'api.cropcoefficientprofile',
        'api.farm',
        # Load satellite/detection models BEFORE field (field has FK to detection run)
        'api.satelliteimage',
        'api.lidardataset',
        'api.treedetectionrun',
        'api.lidarprocessingrun',
        'api.terrainanalysis',
        # Now field can reference detection runs
        'api.field',
        'api.pesticideproduct',
        'api.fertilizerproduct',
        'api.buyer',
        'api.packinghouse',
        'api.irrigationzone',
        'api.pesticideapplication',
        'api.harvest',
        'api.pool',
        'api.poolsettlement',
        'api.packoutreport',
        'api.packoutgradeline',
        'api.settlementgradeline',
        'api.settlementdeduction',
        'api.packinghousestatement',
        'api.irrigationevent',
        'api.weathercache',
        'api.quarantinezone',
        'api.externaldetection',
        'api.auditlog',
        # Large tree models last
        'api.tree',
        'api.detectedtree',
        'api.lidardetectedtree',
        'api.treeobservation',
        'api.treefeedback',
    ]

    # Group records by model
    by_model = {}
    for record in data:
        model = record['model']
        if model not in by_model:
            by_model[model] = []
        by_model[model].append(record)

    # Find any models not in our order list
    for model in by_model:
        if model not in models_order:
            print(f"  Warning: {model} not in load order, adding to end")
            models_order.append(model)

    total_loaded = 0
    failed_batches = []

    # Disable FK constraints for the session
    print("\nDisabling FK constraints...")
    with connection.cursor() as cursor:
        cursor.execute("SET session_replication_role = 'replica';")

    try:
        for model in models_order:
            if model not in by_model:
                continue

            records = by_model[model]
            print(f"\n  Loading {model}: {len(records)} records")

            # Process in batches
            for i in range(0, len(records), batch_size):
                batch = records[i:i + batch_size]
                batch_json = json.dumps(batch)

                retry_count = 0
                max_retries = 3

                while retry_count < max_retries:
                    try:
                        # Close stale connections and re-disable FK
                        connection.close()
                        connection.ensure_connection()
                        with connection.cursor() as cursor:
                            cursor.execute("SET session_replication_role = 'replica';")

                        for obj in serializers.deserialize('json', batch_json):
                            obj.save()

                        total_loaded += len(batch)

                        if len(records) > batch_size:
                            print(f"    Batch {i//batch_size + 1}: {len(batch)} records (total: {total_loaded})")

                        break

                    except Exception as e:
                        retry_count += 1
                        error_msg = str(e)[:200]
                        print(f"    Error (attempt {retry_count}): {error_msg}")

                        if retry_count < max_retries:
                            print(f"    Retrying in 3 seconds...")
                            time.sleep(3)
                            connection.close()
                        else:
                            print(f"    Failed after {max_retries} attempts, skipping batch")
                            failed_batches.append((model, i, error_msg))

                # Small delay between batches
                if len(records) > batch_size:
                    time.sleep(0.3)

    finally:
        # Re-enable FK constraints
        print("\n\nRe-enabling FK constraints...")
        connection.close()
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SET session_replication_role = 'origin';")

    print(f"\n\nComplete! Loaded {total_loaded} records.")

    if failed_batches:
        print(f"\nFailed batches ({len(failed_batches)}):")
        for model, batch_idx, error in failed_batches:
            print(f"  {model} batch {batch_idx}: {error[:100]}")

if __name__ == '__main__':
    filename = sys.argv[1] if len(sys.argv) > 1 else 'data_export_utf8.json'
    batch_size = int(sys.argv[2]) if len(sys.argv) > 2 else 100
    load_in_batches(filename, batch_size)
