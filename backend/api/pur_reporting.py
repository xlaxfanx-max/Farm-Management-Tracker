"""
California Pesticide Use Reporting (PUR) Export Module

This module handles the generation of PUR-compliant reports for submission
to county agricultural commissioners.

PUR Requirements Reference:
- California Food and Agricultural Code Section 12973-12979
- County Agricultural Commissioner reporting format
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import csv
from io import StringIO
from django.db.models import Q, Sum, Count
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse


class PURReportGenerator:
    """
    Generates California PUR-compliant reports from pesticide application data.
    
    PUR Report must include:
    - Site/location information
    - Application date and time
    - Pesticide product (EPA registration number)
    - Amount applied
    - Unit of measure
    - Acres treated
    - Operator/applicator information
    """
    
    # PUR-required fields mapping
    PUR_FIELDS = [
        'use_no',                    # Unique use number (county assigns)
        'site_location_id',          # Field/site identifier
        'site_county_cd',            # County code
        'site_address',              # Application site address
        'operator_name',             # Farm operator name
        'grower_id',                 # Grower ID (if registered)
        'application_date',          # Date of application (MM/DD/YYYY)
        'application_start_time',    # Start time (HH:MM)
        'application_end_time',      # End time (HH:MM)
        'product_epa_reg_no',        # EPA registration number
        'product_name',              # Chemical product name
        'active_ingredient',         # Active ingredient(s)
        'amount_applied',            # Amount of product applied
        'unit_of_measure',           # Unit (lbs, gal, oz, etc.)
        'acres_treated',             # Acres treated
        'application_method',        # Method of application
        'commodity_applied_to',      # Crop/commodity
        'applicator_name',           # Licensed applicator name
        'applicator_license_no',     # Applicator license number
        'applicator_business_name',  # Applicator business
        'restricted_use',            # Restricted use indicator (Y/N)
        'fumigant',                  # Fumigant indicator (Y/N)
        'aerial_ground_indicator',   # A=Aerial, G=Ground, O=Other
    ]
    
    # California county codes
    COUNTY_CODES = {
        'Fresno': '10',
        'Kern': '15',
        'Kings': '16',
        'Madera': '20',
        'Merced': '24',
        'Tulare': '54',
        'Riverside': '33',
        'San Diego': '37',
        'Imperial': '13',
        'Ventura': '56',
        # Add more as needed
    }
    
    def __init__(self, applications_queryset):
        """
        Initialize the PUR report generator.
        
        Args:
            applications_queryset: Django queryset of PesticideApplication objects
        """
        self.applications = applications_queryset
        self.validation_errors = []
        self.validation_warnings = []
    
    def validate_for_pur(self) -> Dict[str, Any]:
        """
        Validate applications to ensure they meet PUR requirements.
        
        Returns:
            Dict with validation results including errors and warnings
        """
        errors = []
        warnings = []
        
        for app in self.applications:
            app_id = f"Application #{app.id}"
            
            # Required field checks
            if not app.application_date:
                errors.append(f"{app_id}: Missing application date")
            
            if not app.field:
                errors.append(f"{app_id}: Missing field/site information")
            elif not app.field.farm:
                errors.append(f"{app_id}: Field missing farm information")
            
            if not app.product:
                errors.append(f"{app_id}: Missing pesticide product")
            elif not app.product.epa_registration_number:
                errors.append(f"{app_id}: Product missing EPA registration number")
            
            if not app.amount_used or app.amount_used <= 0:
                errors.append(f"{app_id}: Missing or invalid amount used")
            
            if not app.unit_of_measure:
                errors.append(f"{app_id}: Missing unit of measure")
            
            if not app.acres_treated or app.acres_treated <= 0:
                errors.append(f"{app_id}: Missing or invalid acres treated")
            
            if not app.applicator_name:
                warnings.append(f"{app_id}: Missing applicator name")
            
            if not app.start_time or not app.end_time:
                warnings.append(f"{app_id}: Missing application time")
            
            if not app.application_method:
                warnings.append(f"{app_id}: Missing application method")
            
            # County code validation
            if app.field and app.field.county:
                if app.field.county not in self.COUNTY_CODES:
                    warnings.append(f"{app_id}: County '{app.field.county}' not in standard county codes")
            
            # Restricted use verification
            if app.product and app.product.restricted_use:
                if not app.applicator_name:
                    errors.append(f"{app_id}: Restricted use product requires licensed applicator name")
        
        self.validation_errors = errors
        self.validation_warnings = warnings
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'applications_count': self.applications.count(),
            'ready_for_export': len(errors) == 0
        }
    
    def generate_csv(self) -> str:
        """
        Generate PUR report in CSV format.
        
        Returns:
            CSV string ready for submission
        """
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=self.PUR_FIELDS)
        writer.writeheader()
        
        for app in self.applications:
            row = self._application_to_pur_row(app)
            writer.writerow(row)
        
        return output.getvalue()
    
    def _application_to_pur_row(self, app) -> Dict[str, str]:
        """
        Convert a PesticideApplication to a PUR-formatted row.
        
        Args:
            app: PesticideApplication instance
            
        Returns:
            Dictionary with PUR-formatted fields
        """
        field = app.field
        farm = field.farm if field else None
        product = app.product
        
        # Determine aerial/ground indicator
        aerial_ground = 'O'  # Other by default
        if app.application_method:
            method_lower = app.application_method.lower()
            if 'aerial' in method_lower or 'aircraft' in method_lower:
                aerial_ground = 'A'
            elif 'ground' in method_lower or 'spray' in method_lower or 'broadcast' in method_lower:
                aerial_ground = 'G'
        
        return {
            'use_no': '',  # County assigns this
            'site_location_id': field.field_number if field else '',
            'site_county_cd': self.COUNTY_CODES.get(field.county, '') if field else '',
            'site_address': farm.address if farm else '',
            'operator_name': farm.operator_name if farm else '',
            'grower_id': '',  # Optional field
            'application_date': app.application_date.strftime('%m/%d/%Y') if app.application_date else '',
            'application_start_time': app.start_time.strftime('%H:%M') if app.start_time else '',
            'application_end_time': app.end_time.strftime('%H:%M') if app.end_time else '',
            'product_epa_reg_no': product.epa_registration_number if product else '',
            'product_name': product.product_name if product else '',
            'active_ingredient': product.active_ingredients if product else '',
            'amount_applied': str(app.amount_used) if app.amount_used else '',
            'unit_of_measure': app.unit_of_measure or '',
            'acres_treated': str(app.acres_treated) if app.acres_treated else '',
            'application_method': app.application_method or '',
            'commodity_applied_to': field.current_crop if field else '',
            'applicator_name': app.applicator_name or '',
            'applicator_license_no': '',  # Add this field to model if needed
            'applicator_business_name': farm.name if farm else '',
            'restricted_use': 'Y' if (product and product.restricted_use) else 'N',
            'fumigant': 'N',  # Add logic if tracking fumigants
            'aerial_ground_indicator': aerial_ground,
        }
    
    def generate_summary_report(self) -> Dict[str, Any]:
        """
        Generate a summary report for review before submission.
        
        Returns:
            Dictionary with summary statistics
        """
        from django.db.models import Sum, Count, Q
        
        summary = {
            'report_period': self._get_date_range(),
            'total_applications': self.applications.count(),
            'total_acres_treated': self.applications.aggregate(Sum('acres_treated'))['acres_treated__sum'] or 0,
            'unique_products': self.applications.values('product').distinct().count(),
            'unique_fields': self.applications.values('field').distinct().count(),
            'restricted_use_applications': self.applications.filter(
                product__restricted_use=True
            ).count(),
            'by_county': self._summarize_by_county(),
            'by_product': self._summarize_by_product(),
            'by_month': self._summarize_by_month(),
        }
        
        return summary
    
    def _get_date_range(self) -> Dict[str, str]:
        """Get the date range covered by applications."""
        dates = self.applications.values_list('application_date', flat=True)
        if dates:
            return {
                'start': min(dates).strftime('%m/%d/%Y'),
                'end': max(dates).strftime('%m/%d/%Y')
            }
        return {'start': '', 'end': ''}
    
    def _summarize_by_county(self) -> List[Dict[str, Any]]:
        """Summarize applications by county."""
        from django.db.models import Count, Sum
        
        summary = []
        counties = self.applications.values('field__county').annotate(
            count=Count('id'),
            total_acres=Sum('acres_treated')
        ).order_by('field__county')
        
        for county in counties:
            summary.append({
                'county': county['field__county'] or 'Unknown',
                'applications': county['count'],
                'acres': float(county['total_acres'] or 0)
            })
        
        return summary
    
    def _summarize_by_product(self) -> List[Dict[str, Any]]:
        """Summarize applications by product."""
        from django.db.models import Count, Sum
        
        summary = []
        products = self.applications.values(
            'product__product_name',
            'product__epa_registration_number'
        ).annotate(
            count=Count('id'),
            total_amount=Sum('amount_used')
        ).order_by('-count')[:10]  # Top 10 products
        
        for product in products:
            summary.append({
                'product_name': product['product__product_name'] or 'Unknown',
                'epa_reg_no': product['product__epa_registration_number'] or '',
                'applications': product['count'],
                'total_amount': float(product['total_amount'] or 0)
            })
        
        return summary
    
    def _summarize_by_month(self) -> List[Dict[str, Any]]:
        """Summarize applications by month."""
        from django.db.models import Count
        from django.db.models.functions import TruncMonth
        
        summary = []
        months = self.applications.annotate(
            month=TruncMonth('application_date')
        ).values('month').annotate(
            count=Count('id')
        ).order_by('month')
        
        for month in months:
            if month['month']:
                summary.append({
                    'month': month['month'].strftime('%B %Y'),
                    'applications': month['count']
                })
        
        return summary


# Add these methods to your PesticideApplicationViewSet in views.py:

def add_pur_endpoints_to_viewset():
    """
    Add these methods to your PesticideApplicationViewSet class in views.py
    """
    
    @action(detail=False, methods=['post'])
    def validate_pur(self, request):
        """
        Validate applications for PUR compliance.
        
        POST /api/applications/validate_pur/
        Body: {
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "farm_id": 1  // optional
        }
        """
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        farm_id = request.data.get('farm_id')
        
        # Filter applications
        queryset = self.get_queryset()
        
        if start_date:
            queryset = queryset.filter(application_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(application_date__lte=end_date)
        if farm_id:
            queryset = queryset.filter(field__farm_id=farm_id)
        
        # Generate validation report
        generator = PURReportGenerator(queryset)
        validation_result = generator.validate_for_pur()
        
        return Response(validation_result)
    
    @action(detail=False, methods=['post'])
    def export_pur_csv(self, request):
        """
        Export applications as PUR-formatted CSV.
        
        POST /api/applications/export_pur_csv/
        Body: {
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "farm_id": 1  // optional
        }
        """
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        farm_id = request.data.get('farm_id')
        
        # Filter applications
        queryset = self.get_queryset()
        
        if start_date:
            queryset = queryset.filter(application_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(application_date__lte=end_date)
        if farm_id:
            queryset = queryset.filter(field__farm_id=farm_id)
        
        # Validate first
        generator = PURReportGenerator(queryset)
        validation = generator.validate_for_pur()
        
        if not validation['valid']:
            return Response({
                'error': 'Applications contain validation errors',
                'validation': validation
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate CSV
        csv_content = generator.generate_csv()
        
        # Create response
        response = HttpResponse(csv_content, content_type='text/csv')
        filename = f"PUR_Report_{start_date}_to_{end_date}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
    
    @action(detail=False, methods=['post'])
    def pur_summary(self, request):
        """
        Get summary statistics for PUR report period.
        
        POST /api/applications/pur_summary/
        Body: {
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "farm_id": 1  // optional
        }
        """
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        farm_id = request.data.get('farm_id')
        
        # Filter applications
        queryset = self.get_queryset()
        
        if start_date:
            queryset = queryset.filter(application_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(application_date__lte=end_date)
        if farm_id:
            queryset = queryset.filter(field__farm_id=farm_id)
        
        # Generate summary
        generator = PURReportGenerator(queryset)
        summary = generator.generate_summary_report()
        validation = generator.validate_for_pur()
        
        return Response({
            'summary': summary,
            'validation': validation
        })


# Instructions for integration:
"""
To integrate this into your Django backend:

1. Copy this file to: backend/api/pur_reporting.py

2. Update backend/api/views.py:
   - Import: from .pur_reporting import PURReportGenerator
   - Add the three @action methods to PesticideApplicationViewSet class

3. Optional: Add applicator_license_no field to PesticideApplication model:
   applicator_license_no = models.CharField(max_length=50, blank=True)

4. Run migrations if you added the field:
   python manage.py makemigrations
   python manage.py migrate

5. Test the endpoints:
   POST http://localhost:8000/api/applications/validate_pur/
   POST http://localhost:8000/api/applications/pur_summary/
   POST http://localhost:8000/api/applications/export_pur_csv/
"""
