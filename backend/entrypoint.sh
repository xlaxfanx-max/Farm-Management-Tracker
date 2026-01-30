#!/bin/bash
set -e

# Run migrations
python manage.py migrate --noinput

# Load fixtures (idempotent - skips if data exists)
# These should not prevent the server from starting if they fail
python manage.py load_water_fixture || echo "Warning: load_water_fixture failed, continuing..."
python manage.py reassign_wells --company="Finch Farms" || echo "Warning: reassign_wells failed, continuing..."
python manage.py sync_well_names || echo "Warning: sync_well_names failed, continuing..."

# Start gunicorn
exec gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 1 --timeout 120 --preload pesticide_tracker.wsgi:application
