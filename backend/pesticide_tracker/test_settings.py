"""
Test settings that use SQLite instead of PostgreSQL.
This allows running tests without database creation permissions.

PostgreSQL-specific RunSQL migrations (RLS policies, etc.) are
automatically skipped on SQLite via a monkey-patch below.
"""
from .settings import *

# Use SQLite for testing
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'test_db.sqlite3',
    }
}

# Disable password hashers for faster tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Effectively disable throttling for tests by setting very high rates
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '10000/minute',
        'user': '10000/minute',
        'auth': '10000/minute',
        'password_reset': '10000/minute',
    },
}

# ---------------------------------------------------------------------------
# Monkey-patch RunSQL to skip PostgreSQL-only SQL on SQLite.
# This avoids having to modify every RLS migration individually.
# ---------------------------------------------------------------------------
from django.db.migrations.operations.special import RunSQL as _OriginalRunSQL

_original_database_forwards = _OriginalRunSQL.database_forwards
_original_database_backwards = _OriginalRunSQL.database_backwards


def _sql_to_text(sql_value):
    """Flatten a RunSQL sql/reverse_sql value to a single string for inspection."""
    if isinstance(sql_value, str):
        return sql_value
    parts = []
    for item in sql_value:
        parts.append(item if isinstance(item, str) else item[0])
    return ' '.join(parts)


_PG_KEYWORDS = (
    'ROW LEVEL SECURITY', 'CREATE POLICY', 'DROP POLICY',
    'current_setting(', 'FORCE ROW LEVEL', 'NOW()',
)


def _is_pg_only_sql(sql_text):
    return any(kw in sql_text for kw in _PG_KEYWORDS)


def _safe_database_forwards(self, app_label, schema_editor, from_state, to_state):
    if schema_editor.connection.vendor != 'postgresql':
        if _is_pg_only_sql(_sql_to_text(self.sql)):
            return  # Skip PostgreSQL-only SQL on SQLite
    _original_database_forwards(self, app_label, schema_editor, from_state, to_state)


def _safe_database_backwards(self, app_label, schema_editor, from_state, to_state):
    if schema_editor.connection.vendor != 'postgresql':
        reverse = self.reverse_sql
        if reverse and reverse is not _OriginalRunSQL.noop:
            if _is_pg_only_sql(_sql_to_text(reverse)):
                return
    _original_database_backwards(self, app_label, schema_editor, from_state, to_state)


_OriginalRunSQL.database_forwards = _safe_database_forwards
_OriginalRunSQL.database_backwards = _safe_database_backwards
