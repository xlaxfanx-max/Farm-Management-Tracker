"""Run the dev server on a local SQLite DB — no Postgres service needed.

Usage:
    python run_dev_sqlite.py               # runserver on 127.0.0.1:8000
    python run_dev_sqlite.py migrate --run-syncdb
    python run_dev_sqlite.py seed_demo_data

The backend/.env file does not define DATABASE_URL/DEBUG/SKIP_MIGRATIONS,
so these values survive settings' load_dotenv(override=True).
"""
import os
import sys

# Anchor the DB to this file's directory — the dev server may be launched
# from the project root, and a relative sqlite path would silently create
# a second, empty database there.
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DB_PATH = os.path.join(_BASE_DIR, 'dev_local.sqlite3').replace('\\', '/')
os.environ.setdefault('DATABASE_URL', f'sqlite:///{_DB_PATH}')
os.environ.setdefault('SKIP_MIGRATIONS', '1')
os.environ.setdefault('DEBUG', 'True')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pesticide_tracker.settings')

from django.core.management import execute_from_command_line  # noqa: E402

if __name__ == '__main__':
    args = sys.argv[1:] or ['runserver', '127.0.0.1:8000', '--noreload']
    execute_from_command_line([sys.argv[0]] + args)
