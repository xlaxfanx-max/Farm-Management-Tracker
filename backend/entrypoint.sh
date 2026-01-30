#!/bin/bash
set -e

# Run migrations
python manage.py migrate --noinput

# Load fixtures (idempotent - skips if data exists)
python manage.py load_water_fixture
python manage.py reassign_wells --company="Finch Farms"
python manage.py sync_well_names

# Start gunicorn
exec gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 1 --timeout 120 --preload pesticide_tracker.wsgi:application
