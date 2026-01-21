"""
Django ORM Initialization for MCP Server

This module must be imported BEFORE any Django models are imported.
It configures Django settings so the ORM can be used outside of a
Django web server context.
"""

import os
import sys
from pathlib import Path


def setup_django():
    """
    Initialize Django settings and ORM for use in MCP server.

    Call this function before importing any Django models or services.
    """
    # Add the backend directory to Python path
    backend_dir = Path(__file__).resolve().parent.parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    # Set the Django settings module
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pesticide_tracker.settings')

    # Initialize Django
    import django
    django.setup()


# Auto-setup when this module is imported
setup_django()
