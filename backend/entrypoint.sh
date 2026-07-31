#!/bin/bash
set -e

echo "=== Starting entrypoint ==="

# Run migrations
echo "Running migrations..."
python manage.py migrate --noinput
echo "Migrations complete."

# Test if the Django app can load before starting gunicorn
echo "Testing Django app import..."
python -c "
import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'finch_dashboard.settings')
django.setup()
from finch_dashboard.wsgi import application
print('Django app loaded successfully')
" 2>&1 || echo "WARNING: Django app import failed"

# Start gunicorn without --preload to avoid silent crashes
echo "Starting gunicorn on port ${PORT:-8000}..."
exec gunicorn --bind 0.0.0.0:${PORT:-8000} --workers 1 --timeout 120 --access-logfile - --error-logfile - finch_dashboard.wsgi:application
