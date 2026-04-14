import os
import sys

from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        """Import signal handlers when the app is ready."""
        import api.signals  # noqa: F401

        # In DEBUG mode running `runserver`, warn loudly if there are
        # unapplied migrations. Production migrates in entrypoint.sh, so
        # this only fires for developers who forgot to migrate locally.
        from django.conf import settings
        if not settings.DEBUG:
            return
        argv = ' '.join(sys.argv)
        if 'runserver' not in argv:
            return
        # Suppress in the autoreload child process so the warning only
        # prints once per `runserver` invocation.
        if os.environ.get('RUN_MAIN') == 'true':
            return
        try:
            from django.db import connections, DEFAULT_DB_ALIAS
            from django.db.migrations.executor import MigrationExecutor
            connection = connections[DEFAULT_DB_ALIAS]
            executor = MigrationExecutor(connection)
            targets = executor.loader.graph.leaf_nodes()
            plan = executor.migration_plan(targets)
            if plan:
                pending = ', '.join(f'{m.app_label}.{m.name}' for m, _ in plan[:6])
                more = '' if len(plan) <= 6 else f' (+{len(plan) - 6} more)'
                print('\n\033[33m' + '=' * 60)
                print(f'WARNING: {len(plan)} unapplied migration(s) detected!')
                print(f'  {pending}{more}')
                print('  Run: python manage.py migrate')
                print('=' * 60 + '\033[0m\n')
        except Exception:
            # Never block startup over a warning.
            pass
