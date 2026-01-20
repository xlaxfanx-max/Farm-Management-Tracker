"""
Celery configuration for Grove Master (pesticide_tracker) project.

This module initializes the Celery application and configures it to work
with Django. Tasks are auto-discovered from the 'api' app.

Usage:
    # Start the worker (from backend directory):
    celery -A pesticide_tracker worker --loglevel=info

    # On Windows, use:
    celery -A pesticide_tracker worker --loglevel=info --pool=solo
"""

import os
from celery import Celery

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pesticide_tracker.settings')

# Create the Celery app
app = Celery('pesticide_tracker')

# Load config from Django settings, using the CELERY namespace.
# This means all celery-related settings in Django should be prefixed with CELERY_
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all registered Django apps.
# This will look for a 'tasks.py' or 'tasks/' module in each app.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task to verify Celery is working."""
    print(f'Request: {self.request!r}')
