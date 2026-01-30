#!/bin/bash
set -e

echo "=== Starting entrypoint ==="

# Run migrations
echo "Running migrations..."
python manage.py migrate --noinput
echo "Migrations complete."

# Skip management commands on startup - run manually if needed
# python manage.py load_water_fixture
# python manage.py reassign_wells --company="Finch Farms"
# python manage.py sync_well_names

# Start gunicorn
echo "Starting gunicorn on port ${PORT:-8000}..."
exec gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 1 --timeout 120 --preload pesticide_tracker.wsgi:application
