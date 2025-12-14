import csv
import io
from datetime import datetime, timedelta, date
from decimal import Decimal
from django.db.models import Sum, Avg, Count, F, Q
from django.db.models.functions import Coalesce
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .pur_reporting import PURReportGenerator
from .product_import_tool import PesticideProductImporter
from django.http import HttpResponse
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from .models import ( 
    Farm, Field, PesticideProduct, PesticideApplication, WaterSource, WaterTest, 
    Buyer, LaborContractor, Harvest, HarvestLoad, HarvestLabor,
    PesticideApplication
)
from .serializers import ( 
    FarmSerializer, FieldSerializer, PesticideProductSerializer, PesticideApplicationSerializer, 
    WaterSourceSerializer, WaterTestSerializer,
    BuyerSerializer, BuyerListSerializer,
    LaborContractorSerializer, LaborContractorListSerializer,
    HarvestSerializer, HarvestListSerializer,
    HarvestLoadSerializer, HarvestLaborSerializer,
    PHICheckSerializer, HarvestStatisticsSerializer
)
class FarmViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing farms
    """
    queryset = Farm.objects.filter(active=True)
    serializer_class = FarmSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'farm_number', 'owner_name', 'county']
    ordering_fields = ['name', 'created_at']
    
    @action(detail=True, methods=['get'])
    def fields(self, request, pk=None):
        """Get all fields for a specific farm"""
        farm = self.get_object()
        fields = farm.fields.all()
        serializer = FieldSerializer(fields, many=True)
        return Response(serializer.data)
    
class FieldViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing fields
    """
    queryset = Field.objects.filter(active=True)
    serializer_class = FieldSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'field_number', 'current_crop', 'county']
    ordering_fields = ['name', 'total_acres', 'created_at']
    
    @action(detail=True, methods=['get'])
    def applications(self, request, pk=None):
        """Get all applications for a specific field"""
        field = self.get_object()
        applications = field.applications.all()
        serializer = PesticideApplicationSerializer(applications, many=True)
        return Response(serializer.data)


class PesticideProductViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing pesticide products
    """
    queryset = PesticideProduct.objects.all()
    serializer_class = PesticideProductSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product_name', 'epa_registration_number', 'manufacturer', 'active_ingredients']
    ordering_fields = ['product_name', 'created_at']

    @action(detail=False, methods=['post'])
    def import_csv(self, request):
        """Import products from CSV file"""
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        csv_file = request.FILES['file']
        update_existing = request.data.get('update_existing', 'true').lower() == 'true'
        
        importer = PesticideProductImporter()
        result = importer.import_from_csv(csv_file, update_existing)
        
        return Response({
            'success': result['errors'] == 0,
            'message': f"Imported {result['created']} new products, updated {result['updated']} existing products",
            'statistics': result
        })

    
    @action(detail=False, methods=['get'])
    def export_csv_template(self, request):
        """Download CSV template for importing products"""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header row with all fields
        headers = [
            'epa_registration_number',
            'product_name',
            'manufacturer',
            'active_ingredients',
            'formulation_type',
            'restricted_use',
            'product_type',
            'is_fumigant',
            'signal_word',
            'rei_hours',
            'rei_days',
            'phi_days',
            'max_applications_per_season',
            'max_rate_per_application',
            'max_rate_unit',
            'california_registration_number',
            'active_status_california',
            'formulation_code',
            'density_specific_gravity',
            'approved_crops',
            'groundwater_advisory',
            'endangered_species_restrictions',
            'buffer_zone_required',
            'buffer_zone_feet',
            'product_status',
            'unit_size',
            'cost_per_unit',
            'label_url',
            'sds_url',
            'notes',
            'active',
        ]
        
        writer.writerow(headers)
        
        # Example row
        example = [
            '12345-678',
            'Example Insecticide 2.5EC',
            'Example Chemical Company',
            'Permethrin 25%',
            'Emulsifiable Concentrate',
            'false',
            'insecticide',
            'false',
            'CAUTION',
            '12',
            '',
            '7',
            '4',
            '1.0',
            'lbs/acre',
            '',
            'true',
            'EC',
            '1.05',
            'Citrus, Almonds, Walnuts',
            'false',
            'false',
            'false',
            '',
            'active',
            '2.5 gallon',
            '125.50',
            'https://example.com/label.pdf',
            'https://example.com/sds.pdf',
            'Apply early morning or late evening',
            'true',
        ]
        
        writer.writerow(example)
        
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="pesticide_products_template.csv"'
        return response

    @action(detail=False, methods=['get'])
    def export_current_products(self, request):
        """Export current products to CSV"""
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
                product.product_type if hasattr(product, 'product_type') else '',
                product.is_fumigant if hasattr(product, 'is_fumigant') else False,
                product.signal_word if hasattr(product, 'signal_word') else '',
                product.rei_hours if hasattr(product, 'rei_hours') else '',
                product.rei_days if hasattr(product, 'rei_days') else '',
                product.phi_days if hasattr(product, 'phi_days') else '',
                product.max_applications_per_season if hasattr(product, 'max_applications_per_season') else '',
                product.max_rate_per_application if hasattr(product, 'max_rate_per_application') else '',
                product.max_rate_unit if hasattr(product, 'max_rate_unit') else '',
                product.california_registration_number if hasattr(product, 'california_registration_number') else '',
                product.active_status_california if hasattr(product, 'active_status_california') else True,
                product.formulation_code if hasattr(product, 'formulation_code') else '',
                product.approved_crops if hasattr(product, 'approved_crops') else '',
                product.product_status if hasattr(product, 'product_status') else 'active',
                product.unit_size if hasattr(product, 'unit_size') else '',
                product.cost_per_unit if hasattr(product, 'cost_per_unit') else '',
                product.label_url if hasattr(product, 'label_url') else '',
                product.notes if hasattr(product, 'notes') else '',
                product.active if hasattr(product, 'active') else True,
            ]
            writer.writerow(row)
        
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="pesticide_products_export.csv"'
        return response


class PesticideApplicationViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing pesticide applications
    """
    queryset = PesticideApplication.objects.all()
    serializer_class = PesticideApplicationSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['field__name', 'product__product_name', 'applicator_name']
    ordering_fields = ['application_date', 'created_at']
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get all pending applications"""
        pending = self.queryset.filter(status='pending_signature')
        serializer = self.get_serializer(pending, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def ready_for_pur(self, request):
        """Get all complete applications ready for PUR submission"""
        ready = self.queryset.filter(status='complete', submitted_to_pur=False)
        serializer = self.get_serializer(ready, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_complete(self, request, pk=None):
        """Mark an application as complete"""
        application = self.get_object()
        application.status = 'complete'
        application.save()
        serializer = self.get_serializer(application)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_submitted(self, request, pk=None):
        """Mark an application as submitted to PUR"""
        application = self.get_object()
        application.submitted_to_pur = True
        application.status = 'submitted'
        from django.utils import timezone
        application.pur_submission_date = timezone.now().date()
        application.save()
        serializer = self.get_serializer(application)
        return Response(serializer.data)
    
        
    @action(detail=False, methods=['post'])
    def validate_pur(self, request):
        """Validate applications for PUR compliance."""
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
        """Export applications as PUR-formatted CSV."""
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
        """Get summary statistics for PUR report period."""
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
    
    @action(detail=False, methods=['get'])
    def export_pur(self, request):
        """
        Enhanced PUR export with multiple format options.
        
        Query Parameters:
        - format: 'csv' (official CA PUR format), 'excel', or 'csv_detailed'
        - start_date: YYYY-MM-DD
        - end_date: YYYY-MM-DD
        - farm_id: Filter by farm
        - status: Filter by status
        - county: Filter by county
        - validate: 'true' to validate before export (default: true)
        """
        # Get parameters
        export_format = request.query_params.get('format', 'csv')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        farm_id = request.query_params.get('farm_id')
        status_filter = request.query_params.get('status')
        county = request.query_params.get('county')
        validate_first = request.query_params.get('validate', 'true').lower() == 'true'
        
        # Build query
        queryset = self.get_queryset()
        
        if start_date:
            queryset = queryset.filter(application_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(application_date__lte=end_date)
        if farm_id:
            queryset = queryset.filter(field__farm_id=farm_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if county:
            queryset = queryset.filter(field__county__icontains=county)
        
        # Select related to optimize
        queryset = queryset.select_related('field', 'field__farm', 'product').order_by('application_date')
        
        # Use existing PURReportGenerator for validation and official CSV
        generator = PURReportGenerator(queryset)
        
        # Validate if requested
        if validate_first:
            validation = generator.validate_for_pur()
            if not validation['valid'] and export_format == 'csv':
                # For official PUR format, enforce validation
                return Response({
                    'error': 'Applications contain validation errors. Cannot export official PUR format.',
                    'validation': validation
                }, status=status.HTTP_400_BAD_REQUEST)
        
        # Route to appropriate export method
        if export_format == 'csv':
            # Use existing official CA PUR format
            return self._export_official_pur_csv(generator, start_date, end_date)
        elif export_format == 'excel':
            # New Excel format with summary
            return self._export_pur_excel(queryset, start_date, end_date)
        elif export_format == 'csv_detailed':
            # Detailed CSV with all fields
            return self._export_pur_csv_detailed(queryset, start_date, end_date)
        else:
            return Response({'error': 'Invalid format'}, status=status.HTTP_400_BAD_REQUEST)


    def _export_official_pur_csv(self, generator, start_date, end_date):
        """Export using existing official California PUR format"""
        csv_content = generator.generate_csv()
        
        response = HttpResponse(csv_content, content_type='text/csv')
        filename = f"PUR_Official_{start_date or 'all'}_to_{end_date or 'all'}_{datetime.now().strftime('%Y%m%d')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response


    def _export_pur_csv_detailed(self, queryset, start_date, end_date):
        """Export detailed CSV with all available fields"""
        import csv
        
        response = HttpResponse(content_type='text/csv')
        
        date_range = ""
        if start_date and end_date:
            date_range = f"_{start_date}_to_{end_date}"
        
        filename = f"PUR_Detailed{date_range}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        writer = csv.writer(response)
        
        # Detailed header
        writer.writerow([
            'Application Date',
            'Farm Name',
            'Farm Number',
            'Operator Name',
            'County',
            'Field Name',
            'Field Number',
            'Section',
            'Township',
            'Range',
            'GPS Latitude',
            'GPS Longitude',
            'Acres Treated',
            'Current Crop',
            'EPA Registration Number',
            'Product Name',
            'Active Ingredients',
            'Amount Used',
            'Unit',
            'Application Method',
            'Target Pest',
            'Applicator Name',
            'Start Time',
            'End Time',
            'Temperature (°F)',
            'Wind Speed (mph)',
            'Wind Direction',
            'Restricted Use',
            'Fumigant',
            'REI (hours)',
            'PHI (days)',
            'Signal Word',
            'Status',
            'PUR Submitted',
            'Submission Date',
            'Notes'
        ])
        
        # Write data
        for app in queryset:
            writer.writerow([
                app.application_date.strftime('%m/%d/%Y'),
                app.field.farm.name,
                app.field.farm.farm_number or '',
                app.field.farm.operator_name or '',
                app.field.county,
                app.field.name,
                app.field.field_number or '',
                app.field.section or '',
                app.field.township or '',
                app.field.range_value or '',
                app.field.gps_lat or '',
                app.field.gps_long or '',
                app.acres_treated,
                app.field.current_crop or '',
                app.product.epa_registration_number,
                app.product.product_name,
                app.product.active_ingredients,
                app.amount_used,
                app.unit_of_measure,
                app.application_method,
                app.target_pest or '',
                app.applicator_name,
                app.start_time.strftime('%H:%M') if app.start_time else '',
                app.end_time.strftime('%H:%M') if app.end_time else '',
                app.temperature or '',
                app.wind_speed or '',
                app.wind_direction or '',
                'Yes' if app.product.restricted_use else 'No',
                'Yes' if app.product.is_fumigant else 'No',
                app.product.rei_hours or '',
                app.product.phi_days or '',
                app.product.signal_word or '',
                app.get_status_display(),
                'Yes' if app.submitted_to_pur else 'No',
                app.pur_submission_date.strftime('%m/%d/%Y') if app.pur_submission_date else '',
                app.notes or ''
            ])
        
        return response


    def _export_pur_excel(self, queryset, start_date, end_date):
        """Export detailed Excel with formatting and summary"""
        wb = Workbook()
        
        # === OFFICIAL PUR FORMAT SHEET ===
        ws_pur = wb.active
        ws_pur.title = "Official PUR Format"
        
        # Use PURReportGenerator for official format
        generator = PURReportGenerator(queryset)
        
        # Styling
        header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF", size=10)
        header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        border_side = Side(style='thin', color='000000')
        border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)
        
        # Write official PUR headers
        for col_num, field_name in enumerate(generator.PUR_FIELDS, 1):
            cell = ws_pur.cell(row=1, column=col_num)
            cell.value = field_name.replace('_', ' ').title()
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment
            cell.border = border
        
        # Write official PUR data
        for row_num, app in enumerate(queryset, 2):
            row_data = generator._application_to_pur_row(app)
            for col_num, field_name in enumerate(generator.PUR_FIELDS, 1):
                cell = ws_pur.cell(row=row_num, column=col_num)
                cell.value = row_data.get(field_name, '')
                cell.border = border
        
        # Auto-size columns for PUR sheet
        for col in range(1, len(generator.PUR_FIELDS) + 1):
            ws_pur.column_dimensions[chr(64 + col)].width = 15
        
        ws_pur.freeze_panes = 'A2'
        
        # === DETAILED DATA SHEET ===
        ws_detail = wb.create_sheet("Detailed Data")
        
        detail_headers = [
            'Date', 'Farm', 'Farm #', 'County', 'Field', 'Field #',
            'Acres', 'Crop', 'EPA #', 'Product', 'Active Ingredients',
            'Amount', 'Unit', 'Method', 'Target Pest', 'Applicator',
            'Start', 'End', 'Temp', 'Wind Speed', 'Wind Dir',
            'Restricted', 'REI', 'PHI', 'Status', 'Notes'
        ]
        
        # Write headers
        for col_num, header in enumerate(detail_headers, 1):
            cell = ws_detail.cell(row=1, column=col_num)
            cell.value = header
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_alignment
            cell.border = border
        
        # Write data
        for row_num, app in enumerate(queryset, 2):
            data = [
                app.application_date.strftime('%m/%d/%Y'),
                app.field.farm.name,
                app.field.farm.farm_number or '',
                app.field.county,
                app.field.name,
                app.field.field_number or '',
                float(app.acres_treated),
                app.field.current_crop or '',
                app.product.epa_registration_number,
                app.product.product_name,
                app.product.active_ingredients,
                float(app.amount_used),
                app.unit_of_measure,
                app.application_method,
                app.target_pest or '',
                app.applicator_name,
                app.start_time.strftime('%H:%M') if app.start_time else '',
                app.end_time.strftime('%H:%M') if app.end_time else '',
                app.temperature or '',
                app.wind_speed or '',
                app.wind_direction or '',
                'Yes' if app.product.restricted_use else 'No',
                app.product.rei_hours or '',
                app.product.phi_days or '',
                app.get_status_display(),
                app.notes or ''
            ]
            
            for col_num, value in enumerate(data, 1):
                cell = ws_detail.cell(row=row_num, column=col_num)
                cell.value = value
                cell.border = border
        
        # Auto-size columns
        for col_num in range(1, len(detail_headers) + 1):
            col_letter = chr(64 + col_num)
            ws_detail.column_dimensions[col_letter].width = 12
        
        ws_detail.freeze_panes = 'A2'
        
        # === SUMMARY SHEET ===
        ws_summary = wb.create_sheet("Summary & Validation")
        ws_summary.column_dimensions['A'].width = 30
        ws_summary.column_dimensions['B'].width = 20
        
        # Title
        ws_summary['A1'] = "PUR Report Summary"
        ws_summary['A1'].font = Font(bold=True, size=14)
        
        row = 3
        
        # Report Info
        ws_summary[f'A{row}'] = "Report Generated:"
        ws_summary[f'B{row}'] = datetime.now().strftime('%m/%d/%Y %H:%M:%S')
        row += 1
        
        if start_date:
            ws_summary[f'A{row}'] = "Start Date:"
            ws_summary[f'B{row}'] = start_date
            row += 1
        
        if end_date:
            ws_summary[f'A{row}'] = "End Date:"
            ws_summary[f'B{row}'] = end_date
            row += 1
        
        row += 1
        
        # Statistics
        ws_summary[f'A{row}'] = "STATISTICS"
        ws_summary[f'A{row}'].font = Font(bold=True, size=12)
        row += 1
        
        ws_summary[f'A{row}'] = "Total Applications:"
        ws_summary[f'B{row}'] = queryset.count()
        row += 1
        
        ws_summary[f'A{row}'] = "Total Acres Treated:"
        ws_summary[f'B{row}'] = queryset.aggregate(Sum('acres_treated'))['acres_treated__sum'] or 0
        row += 1
        
        ws_summary[f'A{row}'] = "Unique Farms:"
        ws_summary[f'B{row}'] = queryset.values('field__farm').distinct().count()
        row += 1
        
        ws_summary[f'A{row}'] = "Unique Fields:"
        ws_summary[f'B{row}'] = queryset.values('field').distinct().count()
        row += 1
        
        ws_summary[f'A{row}'] = "Unique Products:"
        ws_summary[f'B{row}'] = queryset.values('product').distinct().count()
        row += 2
        
        # Validation Results
        validation = generator.validate_for_pur()
        
        ws_summary[f'A{row}'] = "VALIDATION RESULTS"
        ws_summary[f'A{row}'].font = Font(bold=True, size=12)
        row += 1
        
        ws_summary[f'A{row}'] = "Ready for PUR Submission:"
        ws_summary[f'B{row}'] = "YES" if validation['valid'] else "NO"
        ws_summary[f'B{row}'].font = Font(
            color="00FF00" if validation['valid'] else "FF0000",
            bold=True
        )
        row += 2
        
        if validation['errors']:
            ws_summary[f'A{row}'] = "ERRORS (Must Fix):"
            ws_summary[f'A{row}'].font = Font(bold=True, color="FF0000")
            row += 1
            for error in validation['errors']:
                ws_summary[f'A{row}'] = error
                ws_summary[f'A{row}'].font = Font(color="FF0000")
                row += 1
            row += 1
        
        if validation['warnings']:
            ws_summary[f'A{row}'] = "WARNINGS (Recommended):"
            ws_summary[f'A{row}'].font = Font(bold=True, color="FFA500")
            row += 1
            for warning in validation['warnings']:
                ws_summary[f'A{row}'] = warning
                ws_summary[f'A{row}'].font = Font(color="FFA500")
                row += 1
        
        # Status breakdown
        row += 2
        ws_summary[f'A{row}'] = "STATUS BREAKDOWN"
        ws_summary[f'A{row}'].font = Font(bold=True, size=12)
        row += 1
        
        status_counts = queryset.values('status').annotate(count=Count('id'))
        for status_data in status_counts:
            ws_summary[f'A{row}'] = status_data['status'].replace('_', ' ').title()
            ws_summary[f'B{row}'] = status_data['count']
            row += 1
        
        # Save to response
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        date_range = ""
        if start_date and end_date:
            date_range = f"_{start_date}_to_{end_date}"
        
        filename = f"PUR_Report{date_range}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        response = HttpResponse(
            output.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response


    # Also add the validation and summary endpoints from existing file
    @action(detail=False, methods=['post', 'get'])
    def validate_pur(self, request):
        """
        Validate applications for PUR compliance.
        
        Supports both GET and POST methods for flexibility.
        """
        # Get parameters from either query params or body
        if request.method == 'POST':
            start_date = request.data.get('start_date')
            end_date = request.data.get('end_date')
            farm_id = request.data.get('farm_id')
        else:
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            farm_id = request.query_params.get('farm_id')
        
        # Filter applications
        queryset = self.get_queryset()
        
        if start_date:
            queryset = queryset.filter(application_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(application_date__lte=end_date)
        if farm_id:
            queryset = queryset.filter(field__farm_id=farm_id)
        
        queryset = queryset.select_related('field', 'field__farm', 'product')
        
        # Generate validation report
        generator = PURReportGenerator(queryset)
        validation_result = generator.validate_for_pur()
        
        return Response(validation_result)


    @action(detail=False, methods=['post', 'get'])
    def pur_summary(self, request):
        """
        Get summary statistics for PUR report period.
        
        Supports both GET and POST methods.
        """
        # Get parameters
        if request.method == 'POST':
            start_date = request.data.get('start_date')
            end_date = request.data.get('end_date')
            farm_id = request.data.get('farm_id')
        else:
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            farm_id = request.query_params.get('farm_id')
        
        # Filter applications
        queryset = self.get_queryset()
        
        if start_date:
            queryset = queryset.filter(application_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(application_date__lte=end_date)
        if farm_id:
            queryset = queryset.filter(field__farm_id=farm_id)
        
        queryset = queryset.select_related('field', 'field__farm', 'product')
        
        # Generate summary and validation
        generator = PURReportGenerator(queryset)
        summary = generator.generate_summary_report()
        validation = generator.validate_for_pur()
        
        return Response({
            'summary': summary,
            'validation': validation
        })


class WaterSourceViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing water sources
    """
    queryset = WaterSource.objects.filter(active=True)
    serializer_class = WaterSourceSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'source_type', 'farm__name']
    ordering_fields = ['name', 'created_at']
    
    @action(detail=True, methods=['get'])
    def tests(self, request, pk=None):
        """Get all tests for a specific water source"""
        water_source = self.get_object()
        tests = water_source.water_tests.all()
        serializer = WaterTestSerializer(tests, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get all water sources with overdue tests"""
        overdue_sources = [ws for ws in self.queryset if ws.is_test_overdue()]
        serializer = self.get_serializer(overdue_sources, many=True)
        return Response(serializer.data)


class WaterTestViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing water tests
    """
    queryset = WaterTest.objects.all()
    serializer_class = WaterTestSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['water_source__name', 'lab_name', 'status']
    ordering_fields = ['test_date', 'created_at']

    def get_queryset(self):
        """Allow filtering by water_source"""
        queryset = super().get_queryset()
        water_source_id = self.request.query_params.get('water_source', None)
        if water_source_id:
            queryset = queryset.filter(water_source_id=water_source_id)
        return queryset

    def perform_create(self, serializer):
        """Auto-determine status when creating"""
        instance = serializer.save()
        if instance.status == 'pending' and instance.ecoli_result is not None:
            instance.status = instance.auto_determine_status()
            instance.save()

    @action(detail=False, methods=['get'])
    def failed(self, request):
        """Get all failed tests"""
        failed = self.queryset.filter(status='fail')
        serializer = self.get_serializer(failed, many=True)
        return Response(serializer.data)
    
from rest_framework.decorators import api_view

@api_view(['GET'])
def report_statistics(request):
    """Get statistics for the reports dashboard"""
    from django.db.models import Sum, Count
    
    # Get query parameters
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    farm_id = request.query_params.get('farm_id')
    
    # Build base queryset
    queryset = PesticideApplication.objects.all()
    
    if start_date:
        queryset = queryset.filter(application_date__gte=start_date)
    if end_date:
        queryset = queryset.filter(application_date__lte=end_date)
    if farm_id:
        queryset = queryset.filter(field__farm_id=farm_id)
    
    # Calculate statistics
    stats = {
        'total_applications': queryset.count(),
        'total_acres': float(queryset.aggregate(Sum('acres_treated'))['acres_treated__sum'] or 0),
        'unique_farms': queryset.values('field__farm').distinct().count(),
        'unique_fields': queryset.values('field').distinct().count(),
        'unique_products': queryset.values('product').distinct().count(),
        'status_breakdown': {},
        'by_county': {},
        'by_month': {},
        'restricted_use_count': 0,
        'submitted_to_pur': queryset.filter(submitted_to_pur=True).count(),
        'pending_signature': queryset.filter(status='pending_signature').count(),
    }
    
    # Status breakdown
    status_counts = queryset.values('status').annotate(count=Count('id'))
    for item in status_counts:
        stats['status_breakdown'][item['status']] = item['count']
    
    # By county
    county_counts = queryset.values('field__county').annotate(
        count=Count('id'),
        acres=Sum('acres_treated')
    ).order_by('-count')[:10]
    
    for item in county_counts:
        county = item['field__county'] or 'Unknown'
        stats['by_county'][county] = {
            'applications': item['count'],
            'acres': float(item['acres'] or 0)
        }
    
    # By month (last 12 months)
    twelve_months_ago = datetime.now() - timedelta(days=365)
    monthly_data = queryset.filter(
        application_date__gte=twelve_months_ago
    ).extra(
        select={'month': "strftime('%%Y-%%m', application_date)"}
    ).values('month').annotate(
        count=Count('id'),
        acres=Sum('acres_treated')
    ).order_by('month')
    
    for item in monthly_data:
        if item['month']:
            stats['by_month'][item['month']] = {
                'applications': item['count'],
                'acres': float(item['acres'] or 0)
            }
    
    # Restricted use products
    stats['restricted_use_count'] = queryset.filter(
        product__restricted_use=True
    ).count()
    
    return Response(stats)

# -----------------------------------------------------------------------------
# BUYER VIEWSET
# -----------------------------------------------------------------------------

class BuyerViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Buyers (packing houses, processors, etc.)
    """
    queryset = Buyer.objects.all()
    serializer_class = BuyerSerializer
    
    def get_queryset(self):
        queryset = Buyer.objects.all()
        
        # Filter by active status
        active = self.request.query_params.get('active')
        if active is not None:
            queryset = queryset.filter(active=active.lower() == 'true')
        
        # Filter by buyer type
        buyer_type = self.request.query_params.get('buyer_type')
        if buyer_type:
            queryset = queryset.filter(buyer_type=buyer_type)
        
        # Search by name
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(name__icontains=search)
        
        return queryset.order_by('name')
    
    def get_serializer_class(self):
        if self.action == 'list' and self.request.query_params.get('simple') == 'true':
            return BuyerListSerializer
        return BuyerSerializer
    
    @action(detail=True, methods=['get'])
    def load_history(self, request, pk=None):
        """Get all loads sent to this buyer."""
        buyer = self.get_object()
        loads = HarvestLoad.objects.filter(buyer=buyer).select_related(
            'harvest', 'harvest__field', 'harvest__field__farm'
        ).order_by('-harvest__harvest_date')
        
        serializer = HarvestLoadSerializer(loads, many=True)
        
        # Calculate summary stats
        summary = loads.aggregate(
            total_loads=Count('id'),
            total_bins=Sum('bins'),
            total_revenue=Sum('total_revenue'),
            pending_revenue=Sum('total_revenue', filter=Q(payment_status='pending'))
        )
        
        return Response({
            'buyer': BuyerSerializer(buyer).data,
            'summary': summary,
            'loads': serializer.data
        })


# -----------------------------------------------------------------------------
# LABOR CONTRACTOR VIEWSET
# -----------------------------------------------------------------------------

class LaborContractorViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Labor Contractors.
    """
    queryset = LaborContractor.objects.all()
    serializer_class = LaborContractorSerializer
    
    def get_queryset(self):
        queryset = LaborContractor.objects.all()
        
        # Filter by active status
        active = self.request.query_params.get('active')
        if active is not None:
            queryset = queryset.filter(active=active.lower() == 'true')
        
        # Filter by valid license
        valid_license = self.request.query_params.get('valid_license')
        if valid_license == 'true':
            queryset = queryset.filter(license_expiration__gte=date.today())
        
        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(company_name__icontains=search)
        
        return queryset.order_by('company_name')
    
    def get_serializer_class(self):
        if self.action == 'list' and self.request.query_params.get('simple') == 'true':
            return LaborContractorListSerializer
        return LaborContractorSerializer
    
    @action(detail=True, methods=['get'])
    def job_history(self, request, pk=None):
        """Get all harvest jobs for this contractor."""
        contractor = self.get_object()
        labor_records = HarvestLabor.objects.filter(
            contractor=contractor
        ).select_related(
            'harvest', 'harvest__field', 'harvest__field__farm'
        ).order_by('-harvest__harvest_date')
        
        serializer = HarvestLaborSerializer(labor_records, many=True)
        
        # Calculate summary stats
        summary = labor_records.aggregate(
            total_jobs=Count('id'),
            total_bins=Sum('bins_picked'),
            total_cost=Sum('total_labor_cost'),
            total_hours=Sum('total_hours')
        )
        
        return Response({
            'contractor': LaborContractorSerializer(contractor).data,
            'summary': summary,
            'jobs': serializer.data
        })
    
    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        """Get contractors with licenses/insurance expiring in next 30 days."""
        threshold = date.today() + timedelta(days=30)
        
        expiring = LaborContractor.objects.filter(
            Q(license_expiration__lte=threshold) |
            Q(insurance_expiration__lte=threshold) |
            Q(workers_comp_expiration__lte=threshold),
            active=True
        )
        
        serializer = LaborContractorSerializer(expiring, many=True)
        return Response(serializer.data)


# -----------------------------------------------------------------------------
# HARVEST VIEWSET
# -----------------------------------------------------------------------------

class HarvestViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Harvests with PHI checking and statistics.
    """
    queryset = Harvest.objects.all()
    serializer_class = HarvestSerializer
    
    def get_queryset(self):
        queryset = Harvest.objects.select_related(
            'field', 'field__farm'
        ).prefetch_related('loads', 'labor_records')
        
        # Filter by field
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)
        
        # Filter by farm
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            queryset = queryset.filter(field__farm_id=farm_id)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(harvest_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(harvest_date__lte=end_date)
        
        # Filter by crop variety
        crop = self.request.query_params.get('crop_variety')
        if crop:
            queryset = queryset.filter(crop_variety=crop)
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by PHI compliance
        phi_compliant = self.request.query_params.get('phi_compliant')
        if phi_compliant == 'true':
            queryset = queryset.filter(phi_compliant=True)
        elif phi_compliant == 'false':
            queryset = queryset.filter(phi_compliant=False)
        
        # Season filter (year)
        season = self.request.query_params.get('season')
        if season:
            queryset = queryset.filter(harvest_date__year=season)
        
        return queryset.order_by('-harvest_date', '-created_at')
    
    def get_serializer_class(self):
        if self.action == 'list':
            return HarvestListSerializer
        return HarvestSerializer
    
    @action(detail=False, methods=['post'])
    def check_phi(self, request):
        """
        Check PHI compliance before creating a harvest.
        POST: { "field_id": 1, "proposed_harvest_date": "2024-12-20" }
        """
        field_id = request.data.get('field_id')
        proposed_date_str = request.data.get('proposed_harvest_date')
        
        if not field_id or not proposed_date_str:
            return Response(
                {'error': 'field_id and proposed_harvest_date required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            proposed_date = datetime.strptime(proposed_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get most recent application
        last_app = PesticideApplication.objects.filter(
            field_id=field_id
        ).select_related('product').order_by('-application_date').first()
        
        if not last_app:
            return Response({
                'field_id': field_id,
                'proposed_harvest_date': proposed_date_str,
                'last_application_date': None,
                'last_application_product': None,
                'phi_required_days': None,
                'days_since_application': None,
                'is_compliant': True,
                'warning_message': 'No pesticide applications found for this field.'
            })
        
        days_since = (proposed_date - last_app.application_date).days
        phi_required = last_app.product.phi_days if last_app.product else None
        is_compliant = days_since >= phi_required if phi_required else None
        
        warning_message = None
        if is_compliant is False:
            warning_message = (
                f"PHI VIOLATION: Only {days_since} days since application of "
                f"{last_app.product.product_name}. Required: {phi_required} days. "
                f"Earliest safe harvest date: {last_app.application_date + timedelta(days=phi_required)}"
            )
        elif is_compliant is True:
            warning_message = f"PHI compliant. {days_since} days since last application (required: {phi_required})."
        
        return Response({
            'field_id': field_id,
            'proposed_harvest_date': proposed_date_str,
            'last_application_date': last_app.application_date,
            'last_application_product': last_app.product.product_name if last_app.product else None,
            'phi_required_days': phi_required,
            'days_since_application': days_since,
            'is_compliant': is_compliant,
            'warning_message': warning_message
        })
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """
        Get harvest statistics with optional filters.
        """
        queryset = self.get_queryset()
        
        # Base aggregations
        stats = queryset.aggregate(
            total_harvests=Count('id'),
            total_bins=Coalesce(Sum('total_bins'), 0),
            total_weight_lbs=Coalesce(Sum('estimated_weight_lbs'), Decimal('0')),
            total_acres_harvested=Coalesce(Sum('acres_harvested'), Decimal('0')),
        )
        
        # Revenue from loads
        load_stats = HarvestLoad.objects.filter(
            harvest__in=queryset
        ).aggregate(
            total_revenue=Coalesce(Sum('total_revenue'), Decimal('0')),
            pending_payments=Coalesce(
                Sum('total_revenue', filter=Q(payment_status='pending')),
                Decimal('0')
            ),
            avg_price_per_bin=Avg('price_per_unit', filter=Q(price_unit='per_bin'))
        )
        
        # Labor costs
        labor_stats = HarvestLabor.objects.filter(
            harvest__in=queryset
        ).aggregate(
            total_labor_cost=Coalesce(Sum('total_labor_cost'), Decimal('0'))
        )
        
        # PHI violations
        phi_violations = queryset.filter(phi_compliant=False).count()
        
        # Calculate yield per acre
        if stats['total_acres_harvested'] and stats['total_acres_harvested'] > 0:
            avg_yield = float(stats['total_bins']) / float(stats['total_acres_harvested'])
        else:
            avg_yield = 0
        
        # By crop breakdown
        by_crop = list(queryset.values('crop_variety').annotate(
            count=Count('id'),
            bins=Sum('total_bins'),
            acres=Sum('acres_harvested')
        ).order_by('-bins'))
        
        # By buyer breakdown
        by_buyer = list(HarvestLoad.objects.filter(
            harvest__in=queryset
        ).values('buyer__name').annotate(
            loads=Count('id'),
            bins=Sum('bins'),
            revenue=Sum('total_revenue')
        ).order_by('-revenue'))
        
        return Response({
            'total_harvests': stats['total_harvests'],
            'total_bins': stats['total_bins'],
            'total_weight_lbs': stats['total_weight_lbs'],
            'total_acres_harvested': stats['total_acres_harvested'],
            'total_revenue': load_stats['total_revenue'],
            'total_labor_cost': labor_stats['total_labor_cost'],
            'avg_yield_per_acre': round(avg_yield, 1),
            'avg_price_per_bin': load_stats['avg_price_per_bin'],
            'pending_payments': load_stats['pending_payments'],
            'phi_violations': phi_violations,
            'by_crop': by_crop,
            'by_buyer': by_buyer
        })
    
    @action(detail=True, methods=['post'])
    def mark_complete(self, request, pk=None):
        """Mark harvest as complete."""
        harvest = self.get_object()
        harvest.status = 'complete'
        harvest.save()
        return Response(HarvestSerializer(harvest).data)
    
    @action(detail=True, methods=['post'])
    def mark_verified(self, request, pk=None):
        """Mark harvest as verified (for GAP/GHP)."""
        harvest = self.get_object()
        
        # Check GAP/GHP requirements
        warnings = []
        if not harvest.phi_verified:
            warnings.append("PHI verification not checked")
        if not harvest.equipment_cleaned:
            warnings.append("Equipment cleaning not verified")
        if not harvest.no_contamination_observed:
            warnings.append("Contamination check not verified")
        
        harvest.status = 'verified'
        harvest.save()
        
        return Response({
            'harvest': HarvestSerializer(harvest).data,
            'warnings': warnings
        })
    
    @action(detail=False, methods=['get'])
    def by_field(self, request):
        """Get harvests grouped by field."""
        queryset = self.get_queryset()
        
        fields_data = {}
        for harvest in queryset:
            field_id = harvest.field_id
            if field_id not in fields_data:
                fields_data[field_id] = {
                    'field_id': field_id,
                    'field_name': harvest.field.name,
                    'farm_name': harvest.field.farm.name if harvest.field.farm else None,
                    'harvests': []
                }
            fields_data[field_id]['harvests'].append(
                HarvestListSerializer(harvest).data
            )
        
        return Response(list(fields_data.values()))


# -----------------------------------------------------------------------------
# HARVEST LOAD VIEWSET
# -----------------------------------------------------------------------------

class HarvestLoadViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Harvest Loads.
    """
    queryset = HarvestLoad.objects.all()
    serializer_class = HarvestLoadSerializer
    
    def get_queryset(self):
        queryset = HarvestLoad.objects.select_related(
            'harvest', 'harvest__field', 'buyer'
        )
        
        # Filter by harvest
        harvest_id = self.request.query_params.get('harvest')
        if harvest_id:
            queryset = queryset.filter(harvest_id=harvest_id)
        
        # Filter by buyer
        buyer_id = self.request.query_params.get('buyer')
        if buyer_id:
            queryset = queryset.filter(buyer_id=buyer_id)
        
        # Filter by payment status
        payment_status = self.request.query_params.get('payment_status')
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)
        
        # Filter by grade
        grade = self.request.query_params.get('grade')
        if grade:
            queryset = queryset.filter(grade=grade)
        
        # Date range (based on harvest date)
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(harvest__harvest_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(harvest__harvest_date__lte=end_date)
        
        return queryset.order_by('-harvest__harvest_date', 'load_number')
    
    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark load as paid."""
        load = self.get_object()
        load.payment_status = 'paid'
        load.payment_date = request.data.get('payment_date', date.today())
        load.save()
        return Response(HarvestLoadSerializer(load).data)
    
    @action(detail=False, methods=['get'])
    def pending_payments(self, request):
        """Get all loads with pending payments."""
        loads = self.get_queryset().filter(
            payment_status__in=['pending', 'invoiced']
        ).order_by('harvest__harvest_date')
        
        total_pending = loads.aggregate(total=Sum('total_revenue'))['total'] or 0
        
        return Response({
            'total_pending': total_pending,
            'loads': HarvestLoadSerializer(loads, many=True).data
        })


# -----------------------------------------------------------------------------
# HARVEST LABOR VIEWSET
# -----------------------------------------------------------------------------

class HarvestLaborViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Harvest Labor records.
    """
    queryset = HarvestLabor.objects.all()
    serializer_class = HarvestLaborSerializer
    
    def get_queryset(self):
        queryset = HarvestLabor.objects.select_related(
            'harvest', 'harvest__field', 'contractor'
        )
        
        # Filter by harvest
        harvest_id = self.request.query_params.get('harvest')
        if harvest_id:
            queryset = queryset.filter(harvest_id=harvest_id)
        
        # Filter by contractor
        contractor_id = self.request.query_params.get('contractor')
        if contractor_id:
            queryset = queryset.filter(contractor_id=contractor_id)
        
        # Date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(harvest__harvest_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(harvest__harvest_date__lte=end_date)
        
        return queryset.order_by('-harvest__harvest_date')
    
    @action(detail=False, methods=['get'])
    def cost_analysis(self, request):
        """Get labor cost analysis."""
        queryset = self.get_queryset()
        
        analysis = queryset.aggregate(
            total_cost=Sum('total_labor_cost'),
            total_hours=Sum('total_hours'),
            total_bins=Sum('bins_picked'),
            avg_hourly_rate=Avg('rate', filter=Q(pay_type='hourly')),
            avg_piece_rate=Avg('rate', filter=Q(pay_type='piece_rate'))
        )
        
        # Calculate cost per bin
        if analysis['total_bins'] and analysis['total_cost']:
            analysis['cost_per_bin'] = float(analysis['total_cost']) / analysis['total_bins']
        else:
            analysis['cost_per_bin'] = None
        
        # By contractor breakdown
        by_contractor = list(queryset.values(
            'contractor__company_name'
        ).annotate(
            jobs=Count('id'),
            bins=Sum('bins_picked'),
            cost=Sum('total_labor_cost'),
            hours=Sum('total_hours')
        ).order_by('-cost'))
        
        return Response({
            **analysis,
            'by_contractor': by_contractor
        })
