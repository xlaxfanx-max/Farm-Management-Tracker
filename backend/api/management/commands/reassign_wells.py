"""
Management command to reassign wells to a specific company's farm.

Usage:
    python manage.py reassign_wells --company="Finch Farms"
    python manage.py reassign_wells --farm-id=1
"""

from django.core.management.base import BaseCommand
from api.models import WaterSource, Farm, Company


class Command(BaseCommand):
    help = 'Reassign all wells to a specific company farm'

    def add_arguments(self, parser):
        parser.add_argument(
            '--company',
            type=str,
            help='Company name to reassign wells to'
        )
        parser.add_argument(
            '--farm-id',
            type=int,
            help='Specific farm ID to reassign wells to'
        )

    def handle(self, *args, **options):
        company_name = options.get('company')
        farm_id = options.get('farm_id')

        if farm_id:
            farm = Farm.objects.filter(id=farm_id).first()
            if not farm:
                self.stdout.write(self.style.ERROR(f'Farm ID {farm_id} not found'))
                return
        elif company_name:
            company = Company.objects.filter(name__icontains=company_name).first()
            if not company:
                self.stdout.write(self.style.ERROR(f'Company "{company_name}" not found'))
                self.stdout.write('Available companies:')
                for c in Company.objects.all():
                    self.stdout.write(f'  - {c.name} (ID: {c.id})')
                return
            farm = Farm.objects.filter(company=company).first()
            if not farm:
                self.stdout.write(self.style.ERROR(f'No farms found for company "{company_name}"'))
                return
        else:
            # List all companies and farms
            self.stdout.write('Available companies and farms:')
            for company in Company.objects.all():
                self.stdout.write(f'\nCompany: {company.name} (ID: {company.id})')
                farms = Farm.objects.filter(company=company)
                for f in farms:
                    self.stdout.write(f'  - Farm: {f.name} (ID: {f.id})')

            self.stdout.write('\nUsage: python manage.py reassign_wells --company="Company Name"')
            return

        # Get all wells
        wells = WaterSource.objects.filter(source_type='well')
        count = wells.count()

        if count == 0:
            self.stdout.write('No wells found to reassign')
            return

        self.stdout.write(f'Reassigning {count} wells to farm: {farm.name} (Company: {farm.company.name if farm.company else "None"})')

        # Update all wells
        wells.update(farm=farm)

        self.stdout.write(self.style.SUCCESS(f'[OK] Reassigned {count} wells to {farm.name}'))
