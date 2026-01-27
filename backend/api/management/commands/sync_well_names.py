"""
Management command to sync well_name field to match name field.

This fixes wells where the user updated `name` in the UI but `well_name`
still has the old import value.

Usage:
    python manage.py sync_well_names
"""

from django.core.management.base import BaseCommand
from api.models import WaterSource


class Command(BaseCommand):
    help = 'Sync well_name to match name for all wells'

    def handle(self, *args, **options):
        wells = WaterSource.objects.filter(source_type='well')
        updated = 0

        for well in wells:
            if well.name != well.well_name:
                old_name = well.well_name
                well.well_name = well.name
                well.save(update_fields=['well_name'])
                updated += 1
                self.stdout.write(f'  Updated: "{old_name}" -> "{well.name}"')

        if updated:
            self.stdout.write(self.style.SUCCESS(f'[OK] Synced {updated} well names'))
        else:
            self.stdout.write('[SKIP] All well names already in sync')
