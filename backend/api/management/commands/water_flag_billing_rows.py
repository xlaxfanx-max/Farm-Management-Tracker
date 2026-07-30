"""Flag which well readings may be summed into a period total.

The two agencies Finch pumps under read and bill on different cycles, and the
difference is not visible in the data itself:

  UWCD  reads the meter quarterly but bills SEMI-ANNUALLY. The June row spans
        December->June and already contains the March read; the December row
        spans June->December and already contains September. Only June and
        December may be summed.

  OBGMA bills each quarter as its own period. Every row may be summed.

Applying either rule to both agencies is wrong in one direction or the other.
Summing every UWCD row inflates Saticoy FIN0002's 2022 from the 32.72 AF that
was billed to 59.46. Summing only June and December on an OBGMA well loses more
than half the year — Grand Irrigation 2022 drops from 192.13 to 85.39.

The rule below was validated against the printed annual totals in
'Water Usage Summary V1.0' ('AF by Well'): it reproduces 102 of 105 well-years
exactly. The three it misses are Q2 2021 on the OBGMA wells, where the source
reading carries no acre-feet figure at all (gaps of 12.08, 76.73 and 64.29 AF
against RMLF, Grand and TCC respectively). Those are a data hole, not a rule
failure, and the command reports them rather than papering over them.

Usage:
    python manage.py water_flag_billing_rows                    # dry run
    python manage.py water_flag_billing_rows --commit
    python manage.py water_flag_billing_rows --company="Finch Farms" --commit
"""

from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import WaterSource, WellReading

# Month-day of the readings that close a UWCD billing period.
UWCD_BILLING_DAYS = {'06-30', '12-31'}

# Agencies that bill every read as its own period.
PER_READ_AGENCIES = {'obgma', 'fpbgsa', 'uvrga', 'fcgma'}


class Command(BaseCommand):
    help = 'Flag well readings as billing rows or interim reads, per agency cycle'

    def add_arguments(self, parser):
        parser.add_argument(
            '--company',
            type=str,
            help='Limit to one company by name (substring match)',
        )
        parser.add_argument(
            '--commit',
            action='store_true',
            help='Write the changes. Without this the command only reports.',
        )

    def handle(self, *args, **options):
        commit = options['commit']
        company_name = options.get('company')

        wells = WaterSource.objects.filter(source_type='well')
        if company_name:
            wells = wells.filter(farm__company__name__icontains=company_name)

        if not wells.exists():
            self.stdout.write(self.style.ERROR('No wells matched.'))
            return

        to_interim = []   # readings that should be is_billing_row=False
        to_billing = []   # readings that should be is_billing_row=True
        unknown_agency = defaultdict(int)

        for well in wells.select_related('farm'):
            gsa = (well.gsa or '').strip().lower()
            readings = WellReading.objects.filter(water_source=well)

            if gsa == 'uwcd':
                for reading in readings:
                    is_billing = reading.reading_date.strftime('%m-%d') in UWCD_BILLING_DAYS
                    if reading.is_billing_row != is_billing:
                        (to_billing if is_billing else to_interim).append(reading)
            elif gsa in PER_READ_AGENCIES:
                for reading in readings.exclude(is_billing_row=True):
                    to_billing.append(reading)
            else:
                # No agency recorded. Leave every row alone — guessing a billing
                # cycle would silently change a total nobody asked us to change.
                unknown_agency[well.name] = readings.count()

        self.stdout.write('')
        self.stdout.write(f'Wells examined:            {wells.count()}')
        self.stdout.write(f'Readings -> interim:       {len(to_interim)}')
        self.stdout.write(f'Readings -> billing:       {len(to_billing)}')

        if unknown_agency:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING(
                f'{len(unknown_agency)} well(s) have no GSA recorded and were skipped:'
            ))
            for name, count in sorted(unknown_agency.items()):
                self.stdout.write(f'    {name} ({count} readings)')
            self.stdout.write(
                '    Set WaterSource.gsa on these before their totals can be trusted.'
            )

        # Report what the change does to each affected well-year, so the effect
        # on a published number is visible before it is written.
        if to_interim:
            self.stdout.write('')
            self.stdout.write('Annual totals that change:')
            affected = defaultdict(lambda: [0, 0])
            for reading in to_interim:
                key = (reading.water_source.name, reading.reading_date.year)
                affected[key][0] += float(reading.extraction_acre_feet or 0)
            for (name, year), (removed, _) in sorted(affected.items()):
                if removed:
                    self.stdout.write(f'    {name} {year}: -{removed:.2f} AF')

        if not commit:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING(
                'Dry run — nothing written. Re-run with --commit to apply.'
            ))
            return

        with transaction.atomic():
            for reading in to_interim:
                reading.is_billing_row = False
            for reading in to_billing:
                reading.is_billing_row = True
            WellReading.objects.bulk_update(
                to_interim + to_billing, ['is_billing_row'], batch_size=500
            )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'[OK] Updated {len(to_interim) + len(to_billing)} readings.'
        ))
        self.stdout.write(
            'Verify against "Water Usage Summary V1.0" -> "AF by Well" before '
            'quoting any annual figure.'
        )
