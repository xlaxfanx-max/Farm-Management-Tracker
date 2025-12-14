"""
Pesticide Product Bulk Import Tool

This module allows you to import pesticide products from CSV files,
including California's DPR database or your own custom lists.
"""

import csv
import io
from django.core.management.base import BaseCommand
from api.models import PesticideProduct
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse


class PesticideProductImporter:
    """
    Import pesticide products from CSV files.
    
    Supports multiple CSV formats:
    - California DPR format
    - Custom simplified format
    - Full enhanced format
    """
    
    def __init__(self):
        self.created_count = 0
        self.updated_count = 0
        self.error_count = 0
        self.errors = []
    
    def import_from_csv(self, csv_file, update_existing=True):
        """
        Import products from CSV file.
        
        Args:
            csv_file: File object or file path
            update_existing: If True, update existing products. If False, skip them.
        
        Returns:
            Dictionary with import statistics
        """
        try:
            # Read CSV
            if hasattr(csv_file, 'read'):
                content = csv_file.read()
                if isinstance(content, bytes):
                    content = content.decode('utf-8')
                csv_data = io.StringIO(content)
            else:
                csv_data = open(csv_file, 'r', encoding='utf-8')
            
            reader = csv.DictReader(csv_data)
            
            for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
                try:
                    self._import_row(row, update_existing)
                except Exception as e:
                    self.error_count += 1
                    self.errors.append(f"Row {row_num}: {str(e)}")
            
            if not hasattr(csv_file, 'read'):
                csv_data.close()
            
            return {
                'created': self.created_count,
                'updated': self.updated_count,
                'errors': self.error_count,
                'error_details': self.errors,
                'total_processed': self.created_count + self.updated_count + self.error_count
            }
        
        except Exception as e:
            return {
                'created': 0,
                'updated': 0,
                'errors': 1,
                'error_details': [f"File error: {str(e)}"],
                'total_processed': 0
            }
    
    def _import_row(self, row, update_existing):
        """Import a single row from CSV"""
        # Required field
        epa_number = row.get('epa_registration_number', '').strip()
        if not epa_number:
            raise ValueError("Missing EPA registration number")
        
        # Prepare product data
        product_data = {
            'epa_registration_number': epa_number,
            'product_name': row.get('product_name', '').strip(),
            'manufacturer': row.get('manufacturer', '').strip(),
            'active_ingredients': row.get('active_ingredients', '').strip(),
            'formulation_type': row.get('formulation_type', '').strip(),
            'restricted_use': self._parse_bool(row.get('restricted_use', 'False')),
            'product_type': row.get('product_type', '').strip().lower(),
            'is_fumigant': self._parse_bool(row.get('is_fumigant', 'False')),
            'signal_word': row.get('signal_word', '').strip().upper(),
            'california_registration_number': row.get('california_registration_number', '').strip(),
            'active_status_california': self._parse_bool(row.get('active_status_california', 'True')),
            'formulation_code': row.get('formulation_code', '').strip(),
            'approved_crops': row.get('approved_crops', '').strip(),
            'product_status': row.get('product_status', 'active').strip().lower(),
            'unit_size': row.get('unit_size', '').strip(),
            'label_url': row.get('label_url', '').strip(),
            'sds_url': row.get('sds_url', '').strip(),
            'notes': row.get('notes', '').strip(),
            'active': self._parse_bool(row.get('active', 'True')),
        }
        
        # Parse numeric fields
        if row.get('rei_hours'):
            try:
                product_data['rei_hours'] = float(row['rei_hours'])
            except ValueError:
                pass
        
        if row.get('rei_days'):
            try:
                product_data['rei_days'] = int(row['rei_days'])
            except ValueError:
                pass
        
        if row.get('phi_days'):
            try:
                product_data['phi_days'] = int(row['phi_days'])
            except ValueError:
                pass
        
        if row.get('max_applications_per_season'):
            try:
                product_data['max_applications_per_season'] = int(row['max_applications_per_season'])
            except ValueError:
                pass
        
        if row.get('max_rate_per_application'):
            try:
                product_data['max_rate_per_application'] = float(row['max_rate_per_application'])
            except ValueError:
                pass
        
        if row.get('max_rate_unit'):
            product_data['max_rate_unit'] = row['max_rate_unit'].strip()
        
        if row.get('density_specific_gravity'):
            try:
                product_data['density_specific_gravity'] = float(row['density_specific_gravity'])
            except ValueError:
                pass
        
        if row.get('buffer_zone_feet'):
            try:
                product_data['buffer_zone_feet'] = int(row['buffer_zone_feet'])
            except ValueError:
                pass
        
        if row.get('cost_per_unit'):
            try:
                product_data['cost_per_unit'] = float(row['cost_per_unit'])
            except ValueError:
                pass
        
        # Boolean fields
        for bool_field in ['groundwater_advisory', 'endangered_species_restrictions', 'buffer_zone_required']:
            if row.get(bool_field):
                product_data[bool_field] = self._parse_bool(row[bool_field])
        
        # Remove empty string values
        product_data = {k: v for k, v in product_data.items() if v != ''}
        
        # Create or update product
        try:
            product, created = PesticideProduct.objects.update_or_create(
                epa_registration_number=epa_number,
                defaults=product_data
            )
            
            if created:
                self.created_count += 1
            elif update_existing:
                self.updated_count += 1
            
        except Exception as e:
            raise ValueError(f"Database error: {str(e)}")
    
    def _parse_bool(self, value):
        """Parse boolean values from CSV"""
        if isinstance(value, bool):
            return value
        value = str(value).strip().lower()
        return value in ('true', 'yes', 'y', '1', 't')


# Add these methods to your PesticideProductViewSet in views.py

def add_product_import_endpoints():
    """
    Add these methods to your PesticideProductViewSet in backend/api/views.py
    """
    
    @action(detail=False, methods=['post'])
    def import_csv(self, request):
        """
        Import products from CSV file.
        
        POST /api/products/import_csv/
        
        Body: multipart/form-data with 'file' field
        Optional: 'update_existing' boolean field (default: true)
        """
        if 'file' not in request.FILES:
            return Response({
                'error': 'No file provided'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        csv_file = request.FILES['file']
        update_existing = request.data.get('update_existing', 'true').lower() == 'true'
        
        # Import products
        importer = PesticideProductImporter()
        result = importer.import_from_csv(csv_file, update_existing)
        
        return Response({
            'success': result['errors'] == 0,
            'message': f"Imported {result['created']} new products, updated {result['updated']} existing products",
            'statistics': result
        })
    
    @action(detail=False, methods=['get'])
    def export_csv_template(self, request):
        """
        Download a CSV template for importing products.
        
        GET /api/products/export_csv_template/
        """
        # Create CSV template
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header row with all fields
        headers = [
            'epa_registration_number',  # REQUIRED
            'product_name',              # REQUIRED
            'manufacturer',
            'active_ingredients',
            'formulation_type',
            'restricted_use',            # true/false
            'product_type',              # insecticide, herbicide, fungicide, etc.
            'is_fumigant',              # true/false
            'signal_word',              # DANGER, WARNING, CAUTION, NONE
            'rei_hours',                # Numeric
            'rei_days',                 # Numeric
            'phi_days',                 # Numeric
            'max_applications_per_season',  # Numeric
            'max_rate_per_application',     # Numeric
            'max_rate_unit',            # lbs/acre, gal/acre, etc.
            'california_registration_number',
            'active_status_california', # true/false
            'formulation_code',
            'density_specific_gravity',
            'approved_crops',           # Comma-separated
            'groundwater_advisory',     # true/false
            'endangered_species_restrictions',  # true/false
            'buffer_zone_required',     # true/false
            'buffer_zone_feet',         # Numeric
            'product_status',           # active, discontinued, suspended, cancelled
            'unit_size',
            'cost_per_unit',            # Numeric
            'label_url',
            'sds_url',
            'notes',
            'active',                   # true/false
        ]
        
        writer.writerow(headers)
        
        # Example row
        example = [
            '12345-678',                    # epa_registration_number
            'Example Insecticide 2.5EC',    # product_name
            'Example Chemical Company',      # manufacturer
            'Permethrin 25%',               # active_ingredients
            'Emulsifiable Concentrate',      # formulation_type
            'false',                        # restricted_use
            'insecticide',                  # product_type
            'false',                        # is_fumigant
            'CAUTION',                      # signal_word
            '12',                           # rei_hours
            '',                             # rei_days
            '7',                            # phi_days
            '4',                            # max_applications_per_season
            '1.0',                          # max_rate_per_application
            'lbs/acre',                     # max_rate_unit
            '',                             # california_registration_number
            'true',                         # active_status_california
            'EC',                           # formulation_code
            '1.05',                         # density_specific_gravity
            'Citrus, Almonds, Walnuts',     # approved_crops
            'false',                        # groundwater_advisory
            'false',                        # endangered_species_restrictions
            'false',                        # buffer_zone_required
            '',                             # buffer_zone_feet
            'active',                       # product_status
            '2.5 gallon jug',               # unit_size
            '125.50',                       # cost_per_unit
            'https://example.com/label.pdf', # label_url
            'https://example.com/sds.pdf',  # sds_url
            'Apply early morning or late evening', # notes
            'true',                         # active
        ]
        
        writer.writerow(example)
        
        # Create response
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="pesticide_products_template.csv"'
        
        return response
    
    @action(detail=False, methods=['get'])
    def export_current_products(self, request):
        """
        Export current products to CSV.
        
        GET /api/products/export_current_products/
        """
        products = PesticideProduct.objects.all()
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Headers
        headers = [
            'epa_registration_number', 'product_name', 'manufacturer',
            'active_ingredients', 'formulation_type', 'restricted_use',
            'product_type', 'is_fumigant', 'signal_word',
            'rei_hours', 'rei_days', 'phi_days',
            'max_applications_per_season', 'max_rate_per_application', 'max_rate_unit',
            'california_registration_number', 'active_status_california',
            'formulation_code', 'approved_crops', 'product_status',
            'unit_size', 'cost_per_unit', 'label_url', 'notes', 'active'
        ]
        writer.writerow(headers)
        
        # Data rows
        for product in products:
            row = [
                product.epa_registration_number,
                product.product_name,
                product.manufacturer,
                product.active_ingredients,
                product.formulation_type,
                product.restricted_use,
                product.product_type,
                product.is_fumigant,
                product.signal_word,
                product.rei_hours,
                product.rei_days,
                product.phi_days,
                product.max_applications_per_season,
                product.max_rate_per_application,
                product.max_rate_unit,
                product.california_registration_number,
                product.active_status_california,
                product.formulation_code,
                product.approved_crops,
                product.product_status,
                product.unit_size,
                product.cost_per_unit,
                product.label_url,
                product.notes,
                product.active,
            ]
            writer.writerow(row)
        
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="pesticide_products_export.csv"'
        
        return response


# Django Management Command for CLI import
# Save as: backend/api/management/commands/import_products.py

from django.core.management.base import BaseCommand
from api.models import PesticideProduct

class Command(BaseCommand):
    help = 'Import pesticide products from CSV file'
    
    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to CSV file')
        parser.add_argument(
            '--no-update',
            action='store_true',
            help='Skip updating existing products',
        )
    
    def handle(self, *args, **options):
        csv_file = options['csv_file']
        update_existing = not options['no_update']
        
        self.stdout.write(f"Importing products from {csv_file}...")
        
        importer = PesticideProductImporter()
        result = importer.import_from_csv(csv_file, update_existing)
        
        # Display results
        self.stdout.write(self.style.SUCCESS(
            f"✓ Created: {result['created']} products"
        ))
        self.stdout.write(self.style.SUCCESS(
            f"✓ Updated: {result['updated']} products"
        ))
        
        if result['errors'] > 0:
            self.stdout.write(self.style.ERROR(
                f"✗ Errors: {result['errors']}"
            ))
            for error in result['error_details']:
                self.stdout.write(self.style.ERROR(f"  {error}"))
        
        self.stdout.write(self.style.SUCCESS(
            f"\nTotal processed: {result['total_processed']} rows"
        ))
