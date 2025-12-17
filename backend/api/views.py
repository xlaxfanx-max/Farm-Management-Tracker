import csv
import io
import requests
import re
from datetime import datetime, timedelta, date
from decimal import Decimal
from django.db.models import Sum, Avg, Count, F, Q
from django.db.models.functions import Coalesce
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .pur_reporting import PURReportGenerator
from .product_import_tool import PesticideProductImporter
from django.http import HttpResponse
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from .models import ( 
    Farm, Field, FarmParcel, PesticideProduct, PesticideApplication, WaterSource, WaterTest, 
    Buyer, LaborContractor, Harvest, HarvestLoad, HarvestLabor,
    WellReading, MeterCalibration, WaterAllocation,
    ExtractionReport, IrrigationEvent,
    FertilizerProduct, NutrientApplication, NutrientPlan
)
from .serializers import ( 
    FarmSerializer, FarmParcelSerializer, FarmParcelListSerializer, FieldSerializer, PesticideProductSerializer, PesticideApplicationSerializer, 
    WaterSourceSerializer, WaterSourceListSerializer, WaterTestSerializer,
    BuyerSerializer, BuyerListSerializer,
    LaborContractorSerializer, LaborContractorListSerializer,
    HarvestSerializer, HarvestListSerializer,
    HarvestLoadSerializer, HarvestLaborSerializer,
    PHICheckSerializer, HarvestStatisticsSerializer,
    WellReadingSerializer, WellReadingCreateSerializer, WellReadingListSerializer,
    MeterCalibrationSerializer, MeterCalibrationCreateSerializer,
    WaterAllocationSerializer, WaterAllocationSummarySerializer,
    ExtractionReportSerializer, ExtractionReportCreateSerializer, ExtractionReportListSerializer,
    IrrigationEventSerializer, IrrigationEventCreateSerializer, IrrigationEventListSerializer,
    SGMADashboardSerializer,
    FertilizerProductSerializer, FertilizerProductListSerializer,
    NutrientApplicationSerializer, NutrientApplicationListSerializer,
    NutrientPlanSerializer, NutrientPlanListSerializer,
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
    
    @action(detail=True, methods=['get', 'post'])
    def parcels(self, request, pk=None):
        """GET: List parcels, POST: Add parcel"""
        farm = self.get_object()
        
        if request.method == 'GET':
            serializer = FarmParcelSerializer(farm.parcels.all(), many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            data = request.data.copy()
            data['farm'] = farm.id
            if 'apn' in data:
                data['apn'] = FarmParcel.format_apn(data['apn'], farm.county)
            
            serializer = FarmParcelSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='bulk-parcels')
    def bulk_parcels(self, request, pk=None):
        """Bulk add/update parcels"""
        farm = self.get_object()
        parcels_data = request.data.get('parcels', [])
        replace_existing = request.data.get('replace', False)
        
        if replace_existing:
            farm.parcels.all().delete()
        
        created, updated, errors = [], [], []
        
        for parcel_data in parcels_data:
            apn = FarmParcel.format_apn(parcel_data.get('apn', ''), farm.county)
            try:
                parcel, was_created = FarmParcel.objects.update_or_create(
                    farm=farm, apn=apn,
                    defaults={
                        'acreage': parcel_data.get('acreage'),
                        'ownership_type': parcel_data.get('ownership_type', 'owned'),
                        'notes': parcel_data.get('notes', ''),
                    }
                )
                (created if was_created else updated).append(
                    FarmParcelSerializer(parcel).data
                )
            except Exception as e:
                errors.append({'apn': parcel_data.get('apn'), 'error': str(e)})
        
        return Response({
            'created': created, 'updated': updated, 'errors': errors,
            'total_parcels': farm.parcels.count()
        })
        
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
    
class FarmParcelViewSet(viewsets.ModelViewSet):
    serializer_class = FarmParcelSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'current_company') and user.current_company:
            queryset = FarmParcel.objects.filter(
                farm__company=user.current_company
            ).select_related('farm')
        else:
            queryset = FarmParcel.objects.all().select_related('farm')
        
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)
        
        return queryset


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

# =============================================================================
# MAP FEATURE ENDPOINTS
# =============================================================================

def get_plss_from_coordinates(lat, lng):
    """
    Get Section, Township, Range from GPS coordinates using BLM PLSS service.
    Returns dict with section, township, range (or None values if not found).
    """
    import requests as req
    import re
    
    result = {
        'section': None,
        'township': None,
        'range': None
    }
    
    try:
        # Use identify endpoint
        identify_url = "https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/identify"
        
        buffer = 0.001
        identify_params = {
            'geometry': f'{lng},{lat}',
            'geometryType': 'esriGeometryPoint',
            'sr': '4326',
            'layers': 'all',
            'tolerance': '1',
            'mapExtent': f'{lng-buffer},{lat-buffer},{lng+buffer},{lat+buffer}',
            'imageDisplay': '100,100,96',
            'returnGeometry': 'false',
            'f': 'json'
        }
        
        response = req.get(identify_url, params=identify_params, timeout=15,
                          headers={'User-Agent': 'FarmManagementTracker/1.0'})
        
        if response.status_code == 200:
            data = response.json()
            
            if 'results' in data:
                for item in data['results']:
                    attrs = item.get('attributes', {})
                    
                    # Look for section number from multiple possible fields
                    if result['section'] is None:
                        # Try FRSTDIVNO first
                        if 'FRSTDIVNO' in attrs and attrs['FRSTDIVNO']:
                            result['section'] = str(attrs['FRSTDIVNO'])
                        # Try SECDIVNO
                        elif 'SECDIVNO' in attrs and attrs['SECDIVNO']:
                            result['section'] = str(attrs['SECDIVNO'])
                        # Try to extract from 'First Division Identifier' (format: CA210140S0200E0SN030)
                        elif 'First Division Identifier' in attrs and attrs['First Division Identifier']:
                            fdi = str(attrs['First Division Identifier'])
                            # Look for SN followed by digits (Section Number)
                            sec_match = re.search(r'SN0*(\d+)', fdi)
                            if sec_match:
                                result['section'] = sec_match.group(1)
                        # Try FRSTDIVID field
                        elif 'FRSTDIVID' in attrs and attrs['FRSTDIVID']:
                            fdi = str(attrs['FRSTDIVID'])
                            sec_match = re.search(r'SN0*(\d+)', fdi)
                            if sec_match:
                                result['section'] = sec_match.group(1)
                    
                    # Look for township/range in TWNSHPLAB
                    # Format can be: "T14S R20E" or "14S 20E" or "T14S-R20E" etc.
                    if 'TWNSHPLAB' in attrs and attrs['TWNSHPLAB']:
                        label = str(attrs['TWNSHPLAB'])
                        
                        # Try to find township (number followed by N or S)
                        if result['township'] is None:
                            twp_match = re.search(r'T?\.?\s*(\d+)\s*([NS])', label, re.IGNORECASE)
                            if twp_match:
                                result['township'] = f"{twp_match.group(1)}{twp_match.group(2).upper()}"
                        
                        # Try to find range (number followed by E or W)
                        if result['range'] is None:
                            rng_match = re.search(r'R?\.?\s*(\d+)\s*([EW])', label, re.IGNORECASE)
                            if rng_match:
                                result['range'] = f"{rng_match.group(1)}{rng_match.group(2).upper()}"
                    
                    # Also check individual fields as backup
                    if result['township'] is None and 'TWNSHPNO' in attrs and attrs['TWNSHPNO']:
                        twp_dir = attrs.get('TWNSHPDIR', 'N')
                        result['township'] = f"{attrs['TWNSHPNO']}{twp_dir}"
                    
                    if result['range'] is None and 'RANGENO' in attrs and attrs['RANGENO']:
                        rng_dir = attrs.get('RANGEDIR', 'E')
                        result['range'] = f"{attrs['RANGENO']}{rng_dir}"
        
        return result
        
    except Exception as e:
        print(f"PLSS lookup error: {e}")
        return result


@api_view(['POST'])
def geocode_address(request):
    """
    Geocode an address to GPS coordinates using Nominatim (OpenStreetMap).
    Also returns PLSS data (Section, Township, Range) if available.
    
    POST /api/geocode/
    {
        "address": "123 Main St, Fresno, CA"
    }
    
    Returns:
    {
        "lat": 36.7378,
        "lng": -119.7871,
        "display_name": "...",
        "section": "10",
        "township": "15S",
        "range": "22E"
    }
    """
    address = request.data.get('address', '')
    
    if not address:
        return Response({'error': 'Address is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        response = requests.get(
            'https://nominatim.openstreetmap.org/search',
            params={
                'q': address,
                'format': 'json',
                'limit': 1,
                'countrycodes': 'us'
            },
            headers={'User-Agent': 'FarmManagementTracker/1.0'},
            timeout=10
        )
        
        data = response.json()
        
        if data and len(data) > 0:
            result = data[0]
            lat = float(result['lat'])
            lng = float(result['lon'])
            
            # Also get PLSS data (Section/Township/Range)
            plss_data = get_plss_from_coordinates(lat, lng)
            
            return Response({
                'lat': lat,
                'lng': lng,
                'display_name': result.get('display_name', ''),
                'section': plss_data.get('section'),
                'township': plss_data.get('township'),
                'range': plss_data.get('range'),
            })
        else:
            return Response({'error': 'Address not found'}, status=status.HTTP_404_NOT_FOUND)
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def update_field_boundary(request, field_id):
    """
    Update a field's boundary from a drawn polygon.
    Also updates total_acres and fetches PLSS data.
    
    POST /api/fields/{id}/boundary/
    {
        "boundary_geojson": {...},
        "calculated_acres": 45.5
    }
    """
    from .models import Field  # Import here to avoid circular imports
    
    print(f"[Boundary] update_field_boundary called for field_id: {field_id}")
    
    try:
        field = Field.objects.get(id=field_id)
        print(f"[Boundary] Found field: {field.name}")
    except Field.DoesNotExist:
        return Response({'error': 'Field not found'}, status=status.HTTP_404_NOT_FOUND)
    
    boundary = request.data.get('boundary_geojson')
    acres = request.data.get('calculated_acres')
    
    print(f"[Boundary] Received boundary: {boundary is not None}")
    print(f"[Boundary] Received acres: {acres}")
    
    if boundary:
        field.boundary_geojson = boundary
        
        # Calculate centroid of the polygon to get PLSS data
        try:
            coords = boundary.get('coordinates', [[]])[0]
            print(f"[Boundary] Coordinates count: {len(coords) if coords else 0}")
            if coords:
                # Calculate centroid
                lats = [c[1] for c in coords]
                lngs = [c[0] for c in coords]
                centroid_lat = sum(lats) / len(lats)
                centroid_lng = sum(lngs) / len(lngs)
                
                print(f"[Boundary] Centroid: {centroid_lat}, {centroid_lng}")
                
                # Update field GPS coordinates to centroid
                field.gps_lat = centroid_lat
                field.gps_long = centroid_lng
                
                # Get PLSS data
                print(f"[Boundary] Calling get_plss_from_coordinates...")
                plss_data = get_plss_from_coordinates(centroid_lat, centroid_lng)
                print(f"[Boundary] PLSS result: {plss_data}")
                
                if plss_data.get('section'):
                    field.section = plss_data['section']
                    print(f"[Boundary] Set section: {field.section}")
                if plss_data.get('township'):
                    field.township = plss_data['township']
                    print(f"[Boundary] Set township: {field.township}")
                if plss_data.get('range'):
                    field.range_value = plss_data['range']
                    print(f"[Boundary] Set range: {field.range_value}")
        except Exception as e:
            print(f"[Boundary] Error calculating centroid/PLSS: {e}")
            import traceback
            traceback.print_exc()
    
    if acres is not None:
        field.calculated_acres = acres
        field.total_acres = acres  # Also update main acres field
    
    field.save()
    
    return Response({
        'id': field.id,
        'name': field.name,
        'boundary_geojson': field.boundary_geojson,
        'calculated_acres': str(field.calculated_acres) if field.calculated_acres else None,
        'total_acres': str(field.total_acres) if field.total_acres else None,
        'gps_lat': str(field.gps_lat) if field.gps_lat else None,
        'gps_long': str(field.gps_long) if field.gps_long else None,
        'section': field.section,
        'township': field.township,
        'range': field.range_value,
        'message': 'Boundary saved successfully'
    })


@api_view(['POST'])
def get_plss(request):
    """
    Get Section, Township, Range from GPS coordinates.
    """
    lat = request.data.get('lat')
    lng = request.data.get('lng')
    
    if lat is None or lng is None:
        return Response({'error': 'lat and lng are required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        plss_data = get_plss_from_coordinates(float(lat), float(lng))
        return Response({
            'section': plss_data.get('section'),
            'township': plss_data.get('township'),
            'range': plss_data.get('range'),
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# -----------------------------------------------------------------------------
# HELPER FUNCTIONS
# -----------------------------------------------------------------------------

def get_current_water_year():
    """Get the current water year string (e.g., '2024-2025')."""
    today = date.today()
    if today.month >= 10:
        return f"{today.year}-{today.year + 1}"
    return f"{today.year - 1}-{today.year}"


def get_water_year_dates(water_year=None):
    """Get start and end dates for a water year."""
    if not water_year:
        water_year = get_current_water_year()
    
    start_year = int(water_year.split('-')[0])
    return {
        'start': date(start_year, 10, 1),
        'end': date(start_year + 1, 9, 30)
    }


def get_current_reporting_period():
    """Get the current semi-annual reporting period."""
    today = date.today()
    if today.month >= 10:
        # Oct-Mar = Period 1 of next year
        return {
            'period': f"{today.year + 1}-1",
            'type': 'semi_annual_1',
            'start': date(today.year, 10, 1),
            'end': date(today.year + 1, 3, 31)
        }
    elif today.month >= 4:
        # Apr-Sep = Period 2
        return {
            'period': f"{today.year}-2",
            'type': 'semi_annual_2',
            'start': date(today.year, 4, 1),
            'end': date(today.year, 9, 30)
        }
    else:
        # Jan-Mar = Period 1
        return {
            'period': f"{today.year}-1",
            'type': 'semi_annual_1',
            'start': date(today.year - 1, 10, 1),
            'end': date(today.year, 3, 31)
        }


# -----------------------------------------------------------------------------
# WELL VIEWSET
# -----------------------------------------------------------------------------

class WellViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Well model.
    Provides CRUD operations plus custom actions for well management.
    """
    queryset = WaterSource.objects.filter(source_type="well").select_related(
        'water_source', 'water_source__farm'
    ).all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return WellListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return WellCreateSerializer
        return WellSerializer
    
    def get_queryset(self):
        """Filter wells by user's current company."""
        queryset = super().get_queryset()
        
        # Filter by company
        user = self.request.user
        if hasattr(user, 'current_company') and user.current_company:
            queryset = queryset.filter(
                water_source__farm__company=user.current_company
            )
        
        # Optional filters
        gsa = self.request.query_params.get('gsa')
        if gsa:
            queryset = queryset.filter(gsa=gsa)
        
        basin = self.request.query_params.get('basin')
        if basin:
            queryset = queryset.filter(basin=basin)
        
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            queryset = queryset.filter(water_source__farm_id=farm_id)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset
    
    @action(detail=True, methods=['get'])
    def readings(self, request, pk=None):
        """Get all readings for a specific well."""
        well = self.get_object()
        readings = water_source.readings.all()
        
        # Optional date filters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date:
            readings = readings.filter(reading_date__gte=start_date)
        if end_date:
            readings = readings.filter(reading_date__lte=end_date)
        
        serializer = WellReadingListSerializer(readings, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def calibrations(self, request, pk=None):
        """Get calibration history for a specific well."""
        well = self.get_object()
        calibrations = water_source.calibrations.all()
        serializer = MeterCalibrationSerializer(calibrations, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def allocations(self, request, pk=None):
        """Get allocation history for a specific well."""
        well = self.get_object()
        allocations = water_source.allocations.all()
        
        water_year = request.query_params.get('water_year')
        if water_year:
            allocations = allocations.filter(water_year=water_year)
        
        serializer = WaterAllocationSerializer(allocations, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def extraction_summary(self, request, pk=None):
        """Get extraction summary for a well."""
        well = self.get_object()
        water_year = request.query_params.get('water_year', get_current_water_year())
        wy_dates = get_water_year_dates(water_year)
        
        # Get extraction
        extraction = water_source.readings.filter(
            reading_date__gte=wy_dates['start'],
            reading_date__lte=wy_dates['end']
        ).aggregate(
            total_af=Sum('extraction_acre_feet'),
            total_gallons=Sum('extraction_gallons'),
            reading_count=Count('id')
        )
        
        # Get allocation
        allocation = water_source.allocations.filter(
            water_year=water_year
        ).exclude(
            allocation_type='transferred_out'
        ).aggregate(
            total_af=Sum('allocated_acre_feet')
        )
        
        total_allocated = allocation['total_af'] or Decimal('0')
        total_extracted = extraction['total_af'] or Decimal('0')
        remaining = total_allocated - total_extracted
        
        return Response({
            'water_year': water_year,
            'well_id': well.id,
            'well_name': well.well_name or well.water_source.name,
            'total_allocated_af': float(total_allocated),
            'total_extracted_af': float(total_extracted),
            'remaining_af': float(remaining),
            'percent_used': float((total_extracted / total_allocated * 100) if total_allocated else 0),
            'is_over_allocation': remaining < 0,
            'reading_count': extraction['reading_count']
        })
    
    @action(detail=False, methods=['get'])
    def by_gsa(self, request):
        """Get wells grouped by GSA."""
        queryset = self.get_queryset()
        
        gsa_data = queryset.values('gsa').annotate(
            count=Count('id'),
            active_count=Count('id', filter=Q(status='active'))
        ).order_by('gsa')
        
        return Response(list(gsa_data))
    
    @action(detail=False, methods=['get'])
    def calibration_due(self, request):
        """Get wells with calibration due or overdue."""
        days = int(request.query_params.get('days', 30))
        warning_date = date.today() + timedelta(days=days)
        
        queryset = self.get_queryset().filter(
            Q(next_calibration_due__lte=warning_date) |
            Q(next_calibration_due__isnull=True),
            has_flowmeter=True,
            status='active'
        )
        
        serializer = WellListSerializer(queryset, many=True)
        return Response(serializer.data)


# -----------------------------------------------------------------------------
# WELL READING VIEWSET
# -----------------------------------------------------------------------------

class WellReadingViewSet(viewsets.ModelViewSet):
    """ViewSet for WellReading model."""
    
    queryset = WellReading.objects.select_related(
        'well', 'water_source', 'water_source__farm'
    ).all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return WellReadingListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return WellReadingCreateSerializer
        return WellReadingSerializer
    
    def get_queryset(self):
        """Filter by company and optional parameters."""
        queryset = super().get_queryset()
        
        user = self.request.user
        if hasattr(user, 'current_company') and user.current_company:
            queryset = queryset.filter(
                water_source__farm__company=user.current_company
            )
        
        # Filter by well
        well_id = self.request.query_params.get('well')
        if well_id:
            queryset = queryset.filter(water_source_id=well_id)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(reading_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(reading_date__lte=end_date)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def by_period(self, request):
        """Get readings for a specific reporting period."""
        period_type = request.query_params.get('period_type', 'semi_annual_1')
        water_year = request.query_params.get('water_year', get_current_water_year())
        
        wy_dates = get_water_year_dates(water_year)
        
        if period_type == 'semi_annual_1':
            start = wy_dates['start']
            end = date(wy_dates['start'].year + 1, 3, 31)
        elif period_type == 'semi_annual_2':
            start = date(wy_dates['end'].year, 4, 1)
            end = wy_dates['end']
        else:
            start = wy_dates['start']
            end = wy_dates['end']
        
        queryset = self.get_queryset().filter(
            reading_date__gte=start,
            reading_date__lte=end
        )
        
        serializer = WellReadingListSerializer(queryset, many=True)
        return Response({
            'period_type': period_type,
            'water_year': water_year,
            'start_date': start,
            'end_date': end,
            'readings': serializer.data
        })


# -----------------------------------------------------------------------------
# METER CALIBRATION VIEWSET
# -----------------------------------------------------------------------------

class MeterCalibrationViewSet(viewsets.ModelViewSet):
    """ViewSet for MeterCalibration model."""
    
    queryset = MeterCalibration.objects.select_related(
        'well', 'water_source', 'water_source__farm'
    ).all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return MeterCalibrationCreateSerializer
        return MeterCalibrationSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        user = self.request.user
        if hasattr(user, 'current_company') and user.current_company:
            queryset = queryset.filter(
                water_source__farm__company=user.current_company
            )
        
        well_id = self.request.query_params.get('well')
        if well_id:
            queryset = queryset.filter(water_source_id=well_id)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def expiring(self, request):
        """Get calibrations expiring within specified days."""
        days = int(request.query_params.get('days', 90))
        expiry_date = date.today() + timedelta(days=days)
        
        queryset = self.get_queryset().filter(
            next_calibration_due__lte=expiry_date,
            next_calibration_due__gte=date.today()
        ).order_by('next_calibration_due')
        
        serializer = MeterCalibrationSerializer(queryset, many=True)
        return Response(serializer.data)


# -----------------------------------------------------------------------------
# WATER ALLOCATION VIEWSET
# -----------------------------------------------------------------------------

class WaterAllocationViewSet(viewsets.ModelViewSet):
    """ViewSet for WaterAllocation model."""
    
    queryset = WaterAllocation.objects.select_related(
        'well', 'water_source', 'water_source__farm'
    ).all()
    serializer_class = WaterAllocationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        user = self.request.user
        if hasattr(user, 'current_company') and user.current_company:
            queryset = queryset.filter(
                water_source__farm__company=user.current_company
            )
        
        well_id = self.request.query_params.get('well')
        if well_id:
            queryset = queryset.filter(water_source_id=well_id)
        
        water_year = self.request.query_params.get('water_year')
        if water_year:
            queryset = queryset.filter(water_year=water_year)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get allocation vs extraction summary for all wells."""
        water_year = request.query_params.get('water_year', get_current_water_year())
        wy_dates = get_water_year_dates(water_year)
        
        user = request.user
        if hasattr(user, 'current_company') and user.current_company:
            wells = WaterSource.objects.filter(source_type="well").filter(
                water_source__farm__company=user.current_company,
                status='active'
            )
        else:
            wells = WaterSource.objects.filter(source_type="well").filter(status='active')
        
        summaries = []
        for well in wells:
            allocation = water_source.allocations.filter(
                water_year=water_year
            ).exclude(
                allocation_type='transferred_out'
            ).aggregate(total=Sum('allocated_acre_feet'))['total'] or Decimal('0')
            
            extraction = water_source.readings.filter(
                reading_date__gte=wy_dates['start'],
                reading_date__lte=wy_dates['end']
            ).aggregate(total=Sum('extraction_acre_feet'))['total'] or Decimal('0')
            
            remaining = allocation - extraction
            
            summaries.append({
                'water_year': water_year,
                'well_id': well.id,
                'well_name': well.well_name or well.water_source.name,
                'gsa': well.gsa,
                'total_allocated_af': float(allocation),
                'total_extracted_af': float(extraction),
                'remaining_af': float(remaining),
                'percent_used': float((extraction / allocation * 100) if allocation else 0),
                'is_over_allocation': remaining < 0
            })
        
        return Response(summaries)


# -----------------------------------------------------------------------------
# EXTRACTION REPORT VIEWSET
# -----------------------------------------------------------------------------

class ExtractionReportViewSet(viewsets.ModelViewSet):
    """ViewSet for ExtractionReport model."""
    
    queryset = ExtractionReport.objects.select_related(
        'well', 'water_source', 'water_source__farm'
    ).all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return ExtractionReportListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ExtractionReportCreateSerializer
        return ExtractionReportSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        user = self.request.user
        if hasattr(user, 'current_company') and user.current_company:
            queryset = queryset.filter(
                water_source__farm__company=user.current_company
            )
        
        well_id = self.request.query_params.get('well')
        if well_id:
            queryset = queryset.filter(water_source_id=well_id)
        
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        gsa = self.request.query_params.get('gsa')
        if gsa:
            queryset = queryset.filter(well__gsa=gsa)
        
        return queryset
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Auto-generate extraction report from readings."""
        well_id = request.data.get('well_id')
        period_type = request.data.get('period_type', 'semi_annual_1')
        reporting_period = request.data.get('reporting_period')
        
        if not well_id:
            return Response(
                {'error': 'well_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            well = WaterSource.objects.filter(source_type="well").get(id=well_id)
        except Well.DoesNotExist:
            return Response(
                {'error': 'Well not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Determine period dates
        if not reporting_period:
            period_info = get_current_reporting_period()
            reporting_period = period_info['period']
            period_start = period_info['start']
            period_end = period_info['end']
        else:
            parts = reporting_period.split('-')
            year = int(parts[0])
            period_num = int(parts[1])
            
            if period_num == 1:
                period_start = date(year - 1, 10, 1)
                period_end = date(year, 3, 31)
            else:
                period_start = date(year, 4, 1)
                period_end = date(year, 9, 30)
        
        # Check if report already exists
        if ExtractionReport.objects.filter(
            well=well,
            reporting_period=reporting_period
        ).exists():
            return Response(
                {'error': f'Report for {reporting_period} already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get readings for the period
        readings = WellReading.objects.filter(
            well=well,
            reading_date__gte=period_start,
            reading_date__lte=period_end
        ).order_by('reading_date', 'reading_time')
        
        if not readings.exists():
            return Response(
                {'error': 'No readings found for this period'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        first_reading = readings.first()
        last_reading = readings.last()
        
        pre_period_reading = WellReading.objects.filter(
            well=well,
            reading_date__lt=period_start
        ).order_by('-reading_date', '-reading_time').first()
        
        beginning_reading = pre_period_reading.meter_reading if pre_period_reading else first_reading.meter_reading
        beginning_date = pre_period_reading.reading_date if pre_period_reading else first_reading.reading_date
        
        water_year = f"{period_start.year}-{period_end.year}" if period_start.month >= 10 else f"{period_start.year - 1}-{period_start.year}"
        allocation = water_source.allocations.filter(
            water_year=water_year
        ).exclude(
            allocation_type='transferred_out'
        ).aggregate(total=Sum('allocated_acre_feet'))['total'] or Decimal('0')
        
        period_allocation = allocation / 2 if period_type.startswith('semi_annual') else allocation
        
        report = ExtractionReport.objects.create(
            well=well,
            period_type=period_type,
            reporting_period=reporting_period,
            period_start_date=period_start,
            period_end_date=period_end,
            beginning_meter_reading=beginning_reading,
            beginning_reading_date=beginning_date,
            ending_meter_reading=last_reading.meter_reading,
            ending_reading_date=last_reading.reading_date,
            period_allocation_af=period_allocation,
            status='draft'
        )
        
        serializer = ExtractionReportSerializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Mark report as submitted."""
        report = self.get_object()
        
        if report.status == 'submitted':
            return Response(
                {'error': 'Report already submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        report.status = 'submitted'
        report.submitted_date = date.today()
        report.save()
        
        serializer = ExtractionReportSerializer(report)
        return Response(serializer.data)


# -----------------------------------------------------------------------------
# IRRIGATION EVENT VIEWSET
# -----------------------------------------------------------------------------

class IrrigationEventViewSet(viewsets.ModelViewSet):
    """ViewSet for IrrigationEvent model."""
    
    queryset = IrrigationEvent.objects.select_related(
        'field', 'field__farm', 'well', 'water_source'
    ).all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return IrrigationEventListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return IrrigationEventCreateSerializer
        return IrrigationEventSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        user = self.request.user
        if hasattr(user, 'current_company') and user.current_company:
            queryset = queryset.filter(
                field__farm__company=user.current_company
            )
        
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)
        
        well_id = self.request.query_params.get('well')
        if well_id:
            queryset = queryset.filter(water_source_id=well_id)
        
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(irrigation_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(irrigation_date__lte=end_date)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def by_field(self, request):
        """Get irrigation totals grouped by field."""
        queryset = self.get_queryset()
        
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(irrigation_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(irrigation_date__lte=end_date)
        
        field_data = queryset.values(
            'field__id', 'field__name', 'field__farm__name'
        ).annotate(
            total_af=Sum('water_applied_af'),
            total_gallons=Sum('water_applied_gallons'),
            event_count=Count('id'),
            total_hours=Sum('duration_hours')
        ).order_by('field__farm__name', 'field__name')
        
        return Response(list(field_data))


# -----------------------------------------------------------------------------
# SGMA DASHBOARD VIEW
# -----------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sgma_dashboard(request):
    """
    Get SGMA compliance dashboard data.
    Returns summary statistics, alerts, and status for all wells.
    """
    user = request.user
    
    if hasattr(user, 'current_company') and user.current_company:
        wells = WaterSource.objects.filter(source_type="well").filter(
            water_source__farm__company=user.current_company
        )
    else:
        wells = WaterSource.objects.filter(source_type="well").all()
    
    water_year = get_current_water_year()
    wy_dates = get_water_year_dates(water_year)
    current_period = get_current_reporting_period()
    
    # Well counts
    total_wells = wells.count()
    active_wells = wells.filter(status='active').count()
    wells_with_ami = wells.filter(has_ami=True).count()
    
    # YTD extraction
    ytd_extraction = WellReading.objects.filter(
        well__in=wells,
        reading_date__gte=wy_dates['start'],
        reading_date__lte=date.today()
    ).aggregate(total=Sum('extraction_acre_feet'))['total'] or Decimal('0')
    
    # YTD allocation
    ytd_allocation = WaterAllocation.objects.filter(
        well__in=wells,
        water_year=water_year
    ).exclude(
        allocation_type='transferred_out'
    ).aggregate(total=Sum('allocated_acre_feet'))['total'] or Decimal('0')
    
    allocation_remaining = ytd_allocation - ytd_extraction
    percent_used = (ytd_extraction / ytd_allocation * 100) if ytd_allocation else Decimal('0')
    
    # Current period extraction
    current_period_extraction = WellReading.objects.filter(
        well__in=wells,
        reading_date__gte=current_period['start'],
        reading_date__lte=min(current_period['end'], date.today())
    ).aggregate(total=Sum('extraction_acre_feet'))['total'] or Decimal('0')
    
    # Calibration status
    today = date.today()
    calibrations_current = wells.filter(
        meter_calibration_current=True,
        next_calibration_due__gt=today
    ).count()
    
    calibrations_due_soon = wells.filter(
        next_calibration_due__lte=today + timedelta(days=90),
        next_calibration_due__gt=today
    ).count()
    
    calibrations_overdue = wells.filter(
        Q(next_calibration_due__lte=today) |
        Q(next_calibration_due__isnull=True, has_flowmeter=True),
        status='active'
    ).count()
    
    # Next deadlines
    next_calibration = wells.filter(
        next_calibration_due__gte=today
    ).order_by('next_calibration_due').values_list(
        'next_calibration_due', flat=True
    ).first()
    
    if today.month <= 3:
        next_report_due = date(today.year, 4, 1)
    elif today.month <= 9:
        next_report_due = date(today.year, 10, 1)
    else:
        next_report_due = date(today.year + 1, 4, 1)
    
    # Generate alerts
    alerts = []
    
    if calibrations_overdue > 0:
        alerts.append({
            'type': 'warning',
            'category': 'calibration',
            'message': f'{calibrations_overdue} well(s) have overdue meter calibrations',
            'action': 'Schedule calibration appointments'
        })
    
    if calibrations_due_soon > 0:
        alerts.append({
            'type': 'info',
            'category': 'calibration',
            'message': f'{calibrations_due_soon} well(s) have calibrations due within 90 days',
            'action': 'Plan upcoming calibrations'
        })
    
    if allocation_remaining < 0:
        alerts.append({
            'type': 'error',
            'category': 'allocation',
            'message': f'Over allocation by {abs(float(allocation_remaining)):.2f} AF',
            'action': 'Review extraction and consider purchasing additional allocation'
        })
    elif ytd_allocation > 0 and percent_used > 80:
        alerts.append({
            'type': 'warning',
            'category': 'allocation',
            'message': f'{float(percent_used):.1f}% of annual allocation used',
            'action': 'Monitor extraction closely'
        })
    
    # Wells by GSA
    wells_by_gsa = list(wells.values('gsa').annotate(
        count=Count('id'),
        active=Count('id', filter=Q(status='active')),
        ytd_extraction=Sum(
            'readings__extraction_acre_feet',
            filter=Q(readings__reading_date__gte=wy_dates['start'])
        )
    ).order_by('gsa'))
    
    # Recent readings
    recent_readings = WellReading.objects.filter(
        well__in=wells
    ).select_related('well').order_by('-reading_date', '-reading_time')[:10]
    
    recent_readings_data = WellReadingListSerializer(recent_readings, many=True).data
    
    return Response({
        'total_wells': total_wells,
        'active_wells': active_wells,
        'wells_with_ami': wells_with_ami,
        
        'ytd_extraction_af': float(ytd_extraction),
        'ytd_allocation_af': float(ytd_allocation),
        'allocation_remaining_af': float(allocation_remaining),
        'percent_allocation_used': float(percent_used),
        
        'current_period': current_period['period'],
        'current_period_extraction_af': float(current_period_extraction),
        'current_period_start': current_period['start'],
        'current_period_end': current_period['end'],
        
        'calibrations_current': calibrations_current,
        'calibrations_due_soon': calibrations_due_soon,
        'calibrations_overdue': calibrations_overdue,
        
        'next_report_due': next_report_due,
        'next_calibration_due': next_calibration,
        
        'alerts': alerts,
        'wells_by_gsa': wells_by_gsa,
        'recent_readings': recent_readings_data,
        
        'water_year': water_year,
        'as_of_date': date.today()
    })

# =============================================================================
# NUTRIENT MANAGEMENT VIEWS
# =============================================================================

class FertilizerProductViewSet(viewsets.ModelViewSet):
    """API endpoint for fertilizer products."""
    serializer_class = FertilizerProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'manufacturer', 'product_code']
    ordering_fields = ['name', 'nitrogen_pct', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        user = self.request.user
        company = getattr(user, 'current_company', None)
        queryset = FertilizerProduct.objects.filter(active=True)
        
        if company:
            queryset = queryset.filter(Q(company__isnull=True) | Q(company=company))
        else:
            queryset = queryset.filter(company__isnull=True)
        
        form = self.request.query_params.get('form')
        if form:
            queryset = queryset.filter(form=form)
        
        is_organic = self.request.query_params.get('is_organic')
        if is_organic is not None:
            queryset = queryset.filter(is_organic=is_organic.lower() == 'true')
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return FertilizerProductListSerializer
        return FertilizerProductSerializer
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        q = request.query_params.get('q', '')
        if len(q) < 2:
            return Response([])
        queryset = self.get_queryset().filter(
            Q(name__icontains=q) | Q(manufacturer__icontains=q)
        )[:20]
        return Response(FertilizerProductListSerializer(queryset, many=True).data)
    
    @action(detail=False, methods=['post'])
    def seed_common(self, request):
        from .models import get_common_fertilizers
        created, existing = 0, 0
        for data in get_common_fertilizers():
            _, was_created = FertilizerProduct.objects.get_or_create(name=data['name'], defaults=data)
            created += was_created
            existing += not was_created
        return Response({'created': created, 'existing': existing})


class NutrientApplicationViewSet(viewsets.ModelViewSet):
    """API endpoint for nutrient applications."""
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product__name', 'field__name', 'notes']
    ordering_fields = ['application_date', 'created_at', 'total_lbs_nitrogen']
    ordering = ['-application_date', '-created_at']
    
    def get_queryset(self):
        user = self.request.user
        company = getattr(user, 'current_company', None)
        queryset = NutrientApplication.objects.select_related('field', 'field__farm', 'product', 'water_source')
        
        if company:
            queryset = queryset.filter(field__farm__company=company)
        
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)
        
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            queryset = queryset.filter(field__farm_id=farm_id)
        
        year = self.request.query_params.get('year')
        if year:
            queryset = queryset.filter(application_date__year=year)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return NutrientApplicationListSerializer
        return NutrientApplicationSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def by_field(self, request):
        year = request.query_params.get('year', date.today().year)
        queryset = self.get_queryset().filter(application_date__year=year)
        
        by_field = queryset.values(
            'field__id', 'field__name', 'field__farm__name', 'field__total_acres'
        ).annotate(
            application_count=Count('id'),
            total_lbs_nitrogen=Sum('total_lbs_nitrogen'),
            total_cost=Sum('total_cost')
        ).order_by('field__farm__name', 'field__name')
        
        results = []
        for item in by_field:
            acres = item['field__total_acres'] or Decimal('1')
            total_n = item['total_lbs_nitrogen'] or Decimal('0')
            results.append({
                'field_id': item['field__id'],
                'field_name': item['field__name'],
                'farm_name': item['field__farm__name'],
                'acres': float(acres),
                'application_count': item['application_count'],
                'total_lbs_nitrogen': float(total_n),
                'lbs_nitrogen_per_acre': float(total_n / acres) if acres else 0,
                'total_cost': float(item['total_cost']) if item['total_cost'] else None,
            })
        return Response(results)


class NutrientPlanViewSet(viewsets.ModelViewSet):
    """API endpoint for nitrogen management plans."""
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['year', 'field__name']
    ordering = ['-year', 'field__name']
    
    def get_queryset(self):
        user = self.request.user
        company = getattr(user, 'current_company', None)
        queryset = NutrientPlan.objects.select_related('field', 'field__farm')
        
        if company:
            queryset = queryset.filter(field__farm__company=company)
        
        year = self.request.query_params.get('year')
        if year:
            queryset = queryset.filter(year=year)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return NutrientPlanListSerializer
        return NutrientPlanSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def nitrogen_summary(request):
    """Annual nitrogen summary by field for ILRP compliance."""
    user = request.user
    company = getattr(user, 'current_company', None)
    year = int(request.query_params.get('year', date.today().year))
    
    fields = Field.objects.filter(active=True).select_related('farm')
    if company:
        fields = fields.filter(farm__company=company)
    
    summary = []
    for field in fields:
        apps = field.nutrient_applications.filter(application_date__year=year)
        total_n = apps.aggregate(total=Sum('total_lbs_nitrogen'))['total'] or Decimal('0')
        acres = field.total_acres or Decimal('1')
        plan = field.nutrient_plans.filter(year=year).first()
        
        summary.append({
            'field_id': field.id,
            'field_name': field.name,
            'farm_name': field.farm.name if field.farm else '',
            'acres': float(acres),
            'crop': field.current_crop,
            'total_applications': apps.count(),
            'total_lbs_nitrogen': float(total_n),
            'lbs_nitrogen_per_acre': float(total_n / acres),
            'has_plan': plan is not None,
            'planned_nitrogen_lbs_acre': float(plan.net_planned_nitrogen) if plan else None,
            'variance_lbs_acre': float(plan.nitrogen_variance_per_acre) if plan else None,
        })
    return Response(summary)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def nitrogen_export(request):
    """Export nitrogen summary as Excel."""
    user = request.user
    company = getattr(user, 'current_company', None)
    year = int(request.query_params.get('year', date.today().year))
    
    fields = Field.objects.filter(active=True).select_related('farm')
    if company:
        fields = fields.filter(farm__company=company)
    
    wb = Workbook()
    ws = wb.active
    ws.title = f"Nitrogen Report {year}"
    
    headers = ['Field', 'Farm', 'Acres', 'Crop', 'Total N (lbs)', 'N/Acre (lbs)', 'Applications']
    ws.append(headers)
    
    for field in fields:
        apps = field.nutrient_applications.filter(application_date__year=year)
        total_n = apps.aggregate(total=Sum('total_lbs_nitrogen'))['total'] or 0
        acres = float(field.total_acres or 1)
        
        ws.append([
            field.name,
            field.farm.name if field.farm else '',
            acres,
            field.current_crop,
            round(float(total_n), 1),
            round(float(total_n) / acres, 1),
            apps.count(),
        ])
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    response = HttpResponse(
        output.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="nitrogen_report_{year}.xlsx"'
    return response







































