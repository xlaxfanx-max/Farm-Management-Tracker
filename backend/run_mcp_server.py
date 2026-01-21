#!/usr/bin/env python
"""
Entry point script for the Farm Management Tracker MCP Server.

This script:
1. Initializes Django ORM
2. Starts the MCP server

Usage:
    python run_mcp_server.py

Environment variables:
    MCP_COMPANY_ID: Company ID for RLS filtering (optional)
    OPENWEATHERMAP_API_KEY: API key for weather data (required for weather tools)
    DJANGO_SETTINGS_MODULE: Django settings module (default: farm_management.settings)
"""

import asyncio
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Initialize Django BEFORE importing anything that uses Django models
from mcp_server.django_setup import setup_django
setup_django()

# Now import and run the server
from mcp_server.server import main

if __name__ == "__main__":
    asyncio.run(main())
