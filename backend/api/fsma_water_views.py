"""
FSMA Water Assessment Views

API endpoints for Pre-Harvest Agricultural Water Assessment management.
Following patterns from fsma_views.py for consistency.
"""

from datetime import date, timedelta
from django.db.models import Q, Count
from django.utils import timezone
from django.http import FileResponse
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers as drf_serializers

from .permissions import HasCompanyAccess
from .audit_utils import AuditLogMixin
from .models import (
    FSMAWaterAssessment, FSMASourceAssessment, FSMAFieldAssessment,
    FSMAEnvironmentalAssessment, FSMAMitigationAction,
    Farm, Field, WaterSource
)
from .serializers import (
    FSMAWaterAssessmentSerializer, FSMAWaterAssessmentListSerializer,
    FSMAWaterAssessmentDetailSerializer,
    FSMASourceAssessmentSerializer,
    FSMAFieldAssessmentSerializer,
    FSMAEnvironmentalAssessmentSerializer,
    FSMAMitigationActionSerializer,
)
from .services.fsma.water_risk_calculator import FSMAWaterRiskCalculator


from .view_helpers import get_user_company, require_company


# =============================================================================
# FSMA WATER ASSESSMENT VIEWSET
# =============================================================================

class FSMAWaterAssessmentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for FSMA Water Assessments.

    Supports:
    - CRUD operations
    - Risk calculation
    - Submission and approval workflow
    - PDF generation and download
    - Duplication for new assessment year

    Endpoints:
    - GET /api/fsma/water-assessments/ - List all assessments
    - POST /api/fsma/water-assessments/ - Create new assessment
    - GET /api/fsma/water-assessments/{id}/ - Retrieve assessment details
    - PUT /api/fsma/water-assessments/{id}/ - Update assessment
    - DELETE /api/fsma/water-assessments/{id}/ - Delete assessment

    Custom Actions:
    - POST /api/fsma/water-assessments/{id}/calculate_risk/ - Calculate risk scores
    - POST /api/fsma/water-assessments/{id}/submit/ - Submit for review
    - POST /api/fsma/water-assessments/{id}/approve/ - Approve assessment
    - GET /api/fsma/water-assessments/{id}/download/ - Download PDF
    - POST /api/fsma/water-assessments/{id}/duplicate/ - Duplicate for new year
    - GET /api/fsma/water-assessments/summary/ - Get summary statistics
    """
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['farm__name', 'assessor_name']
    ordering_fields = ['assessment_year', 'farm__name', 'status', 'created_at']
    ordering = ['-assessment_year', 'farm__name']

    def get_serializer_class(self):
        if self.action == 'list':
            return FSMAWaterAssessmentListSerializer
        if self.action == 'retrieve':
            return FSMAWaterAssessmentDetailSerializer
        return FSMAWaterAssessmentSerializer

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FSMAWaterAssessment.objects.none()

        queryset = FSMAWaterAssessment.objects.filter(
            company=company
        ).select_related('farm', 'submitted_by', 'approved_by')

        # Filter by farm
        farm_id = self.request.query_params.get('farm')
        if farm_id:
            queryset = queryset.filter(farm_id=farm_id)

        # Filter by year
        year = self.request.query_params.get('year')
        if year:
            try:
                queryset = queryset.filter(assessment_year=int(year))
            except ValueError:
                pass

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.prefetch_related(
            'source_assessments',
            'field_assessments',
            'environmental_assessments',
            'mitigation_actions'
        )

    def perform_create(self, serializer):
        company = require_company(self.request.user)
        user = self.request.user

        # Auto-set assessor information from the logged-in user
        assessor_name = serializer.validated_data.get('assessor_name')
        if not assessor_name:
            assessor_name = user.get_full_name() or user.email

        serializer.save(
            company=company,
            assessor=user,
            assessor_name=assessor_name
        )

    @action(detail=True, methods=['post'])
    def calculate_risk(self, request, pk=None):
        """
        Calculate risk scores for the assessment.

        Updates the assessment and all sub-assessments with calculated scores.
        Also auto-generates mitigation actions based on identified risks.
        """
        assessment = self.get_object()

        # Validate that we have sub-assessments
        if not assessment.source_assessments.exists():
            return Response(
                {'error': 'At least one water source assessment is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        calculator = FSMAWaterRiskCalculator(assessment)
        overall_risk = calculator.calculate_overall_risk()
        outcome_code, outcome_description = calculator.determine_fda_outcome()

        # Update assessment with calculated values
        assessment.overall_risk_score = overall_risk.score
        assessment.risk_level = overall_risk.level.value
        assessment.fda_outcome = outcome_code
        assessment.outcome_notes = outcome_description
        assessment.save()

        # Update source assessments
        for source_assessment in assessment.source_assessments.all():
            source_risk = calculator.calculate_source_risk(source_assessment)
            source_assessment.source_risk_score = source_risk.score
            source_assessment.source_risk_level = source_risk.level.value
            source_assessment.risk_factors = [
                {
                    'category': f.category,
                    'issue': f.issue,
                    'severity': f.severity,
                    'points': f.points,
                    'description': f.description
                }
                for f in source_risk.factors
            ]
            source_assessment.save()

        # Update field assessments
        for field_assessment in assessment.field_assessments.all():
            field_risk = calculator.calculate_field_risk(field_assessment)
            field_assessment.field_risk_score = field_risk.score
            field_assessment.field_risk_level = field_risk.level.value
            # Split scores if needed
            practice_factors = [f for f in field_risk.factors if f.category in ['application', 'timing']]
            crop_factors = [f for f in field_risk.factors if f.category == 'crop']
            field_assessment.practice_risk_score = sum(f.points for f in practice_factors)
            field_assessment.crop_risk_score = sum(f.points for f in crop_factors)
            field_assessment.save()

        # Update environmental assessment
        env_assessment = assessment.environmental_assessments.first()
        if env_assessment:
            env_risk = calculator.calculate_environmental_risk(env_assessment)
            env_assessment.environmental_risk_score = env_risk.score
            env_assessment.environmental_risk_level = env_risk.level.value
            env_assessment.has_adjacent_land_hazards = getattr(env_risk, 'has_adjacent_hazards', False)
            # Split environmental vs adjacent
            adj_factors = [f for f in env_risk.factors if f.category == 'adjacent_land']
            env_assessment.adjacent_land_risk_score = sum(f.points for f in adj_factors)
            env_assessment.save()

        # Auto-generate mitigation actions based on recommendations
        self._create_mitigation_actions(
            assessment,
            overall_risk.recommendations,
            overall_risk.factors
        )

        # Return comprehensive response
        return Response({
            'overall_risk_score': float(overall_risk.score),
            'risk_level': overall_risk.level.value,
            'fda_outcome': outcome_code,
            'outcome_description': outcome_description,
            'factors': [
                {
                    'category': f.category,
                    'issue': f.issue,
                    'severity': f.severity,
                    'points': f.points,
                    'description': f.description
                }
                for f in overall_risk.factors
            ],
            'recommendations': overall_risk.recommendations,
            'mitigation_actions_created': assessment.mitigation_actions.filter(status='pending').count(),
        })

    def _create_mitigation_actions(self, assessment, recommendations, factors):
        """Create mitigation actions from risk factors and recommendations."""
        for rec in recommendations:
            # Determine priority and category based on recommendation text
            priority = 'medium'
            category = 'operational'
            hazard_source = ''

            # Check recommendation text for clues
            rec_lower = rec.lower()

            if 'urgent' in rec_lower or 'critical' in rec_lower or 'immediate' in rec_lower:
                priority = 'critical'
            elif 'repair' in rec_lower or 'replace' in rec_lower:
                priority = 'high'
                category = 'infrastructure'
            elif 'test' in rec_lower:
                category = 'testing'
            elif 'treatment' in rec_lower or 'treat' in rec_lower:
                category = 'treatment'
            elif 'fencing' in rec_lower or 'exclusion' in rec_lower:
                category = 'exclusion'
            elif 'runoff' in rec_lower or 'buffer' in rec_lower:
                category = 'infrastructure'

            # Determine hazard source
            if 'animal' in rec_lower or 'cafo' in rec_lower or 'livestock' in rec_lower:
                hazard_source = 'adjacent_animal'
            elif 'manure' in rec_lower:
                hazard_source = 'adjacent_manure'
            elif 'septic' in rec_lower or 'human waste' in rec_lower:
                hazard_source = 'adjacent_human_waste'
            elif 'wellhead' in rec_lower or 'well cap' in rec_lower or 'casing' in rec_lower:
                hazard_source = 'water_system'
            elif 'flood' in rec_lower or 'wildlife' in rec_lower:
                hazard_source = 'environmental'
            else:
                hazard_source = 'on_farm'

            # Calculate due date
            due_days = {
                'critical': 1,
                'high': 7,
                'medium': 30,
                'low': 365,
            }
            due_date = date.today() + timedelta(days=due_days[priority])

            # Check for adjacent land hazard requiring same-season action
            requires_same_season = hazard_source in [
                'adjacent_animal', 'adjacent_manure', 'adjacent_human_waste'
            ]

            # Only create if doesn't already exist
            FSMAMitigationAction.objects.get_or_create(
                assessment=assessment,
                title=rec[:200],
                defaults={
                    'mitigation_description': rec,
                    'category': category,
                    'hazard_source': hazard_source,
                    'priority': priority,
                    'due_date': due_date,
                    'requires_same_season': requires_same_season,
                    'status': 'pending',
                }
            )

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """
        Submit assessment for review or auto-approve if user is owner/admin.

        Company owners and admins can self-approve their assessments since
        FDA requires a "qualified individual" to sign off, which includes
        the farm owner or their designated representative.
        """
        import logging
        logger = logging.getLogger(__name__)

        try:
            assessment = self.get_object()

            if assessment.status not in ['draft', 'in_progress']:
                # If already approved, just return success with the data
                if assessment.status == 'approved':
                    return Response(FSMAWaterAssessmentDetailSerializer(assessment).data)
                return Response(
                    {'error': f'Only draft or in-progress assessments can be submitted. Current status: {assessment.status}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate completeness
            errors = self._validate_assessment_completeness(assessment)
            if errors:
                return Response(
                    {'error': 'Assessment incomplete', 'details': errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Handle signature (accept both 'signature' and 'signature_data' keys)
            signature = request.data.get('signature') or request.data.get('signature_data')
            if signature:
                assessment.assessor_signature = signature
                assessment.assessor_signature_date = timezone.now()

            assessment.submitted_at = timezone.now()
            assessment.submitted_by = request.user

            # Check if user can self-approve (owner, admin, manager, or superuser)
            # FDA requires a "qualified individual" to sign off, which includes
            # the farm owner, manager, or their designated representative.
            user = request.user
            company = assessment.company

            # Get user's role in this company
            membership = user.company_memberships.filter(company=company, is_active=True).first()
            user_role_codename = membership.role.codename if membership else None

            logger.info(f"User {user.email} submitting assessment {assessment.id}, role: {user_role_codename}")

            # Roles that can self-approve water assessments
            self_approve_roles = ['owner', 'admin', 'manager']

            can_self_approve = (
                user.is_superuser or
                user_role_codename in self_approve_roles
            )

            if can_self_approve:
                # Auto-approve for qualified individuals
                assessment.status = 'approved'
                assessment.approved_at = timezone.now()
                assessment.approved_by = user
                assessment.approver_signature = signature  # Same signature for self-approval
                assessment.approver_signature_date = timezone.now()
                assessment.valid_until = date.today() + timedelta(days=365)
                assessment.save()

                logger.info(f"Assessment {assessment.id} auto-approved for user {user.email}")

                # Queue PDF generation asynchronously (don't block the response)
                try:
                    from .tasks.fsma_tasks import generate_water_assessment_pdf
                    generate_water_assessment_pdf.delay(assessment.id)
                    logger.info(f"PDF generation queued for assessment {assessment.id}")
                except Exception as e:
                    # Celery not available - PDF can be generated manually via download endpoint
                    logger.info(f"Celery not available for async PDF generation: {e}. PDF can be generated on demand.")
            else:
                # Requires supervisor review
                assessment.status = 'pending_review'
                assessment.save()
                logger.info(f"Assessment {assessment.id} submitted for review by user {user.email}")

            return Response(FSMAWaterAssessmentDetailSerializer(assessment).data)

        except Exception as e:
            logger.error(f"Error in submit action: {e}", exc_info=True)
            return Response(
                {'error': f'An error occurred: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _validate_assessment_completeness(self, assessment):
        """Validate that assessment is complete for submission."""
        errors = []

        if not assessment.source_assessments.exists():
            errors.append('At least one water source assessment is required')

        if not assessment.field_assessments.exists():
            errors.append('At least one field assessment is required')

        if not assessment.environmental_assessments.exists():
            errors.append('Environmental assessment is required')

        if assessment.overall_risk_score is None:
            errors.append('Risk calculation must be performed before submission')

        return errors

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """
        Approve a submitted assessment.

        Requires approver signature and triggers PDF generation.
        """
        assessment = self.get_object()

        if assessment.status != 'pending_review':
            return Response(
                {'error': 'Only pending assessments can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Handle signature
        signature = request.data.get('signature')
        if signature:
            assessment.approver_signature = signature
            assessment.approver_signature_date = timezone.now()

        assessment.status = 'approved'
        assessment.approved_at = timezone.now()
        assessment.approved_by = request.user
        assessment.approval_notes = request.data.get('notes', '')
        assessment.valid_until = date.today() + timedelta(days=365)
        assessment.save()

        # Trigger PDF generation asynchronously
        try:
            from .tasks.fsma_tasks import generate_water_assessment_pdf
            generate_water_assessment_pdf.delay(assessment.id)
        except Exception as e:
            # Log but don't fail approval if Celery not available
            import logging
            logging.warning(f"Could not queue PDF generation: {e}")

        return Response(FSMAWaterAssessmentDetailSerializer(assessment).data)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download the generated PDF, generating on-demand if needed."""
        import logging
        logger = logging.getLogger(__name__)

        assessment = self.get_object()

        # Generate PDF on-demand if it doesn't exist yet
        if not assessment.pdf_file:
            if assessment.status != 'approved':
                return Response(
                    {'error': 'Assessment must be approved before PDF can be generated'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                from api.services.fsma.water_assessment_pdf_generator import WaterAssessmentPDFGenerator
                generator = WaterAssessmentPDFGenerator(assessment)
                if generator.generate():
                    assessment.refresh_from_db()
                    logger.info(f"PDF generated on-demand for assessment {assessment.id}")
                else:
                    return Response(
                        {'error': 'Failed to generate PDF'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            except Exception as e:
                logger.error(f"PDF generation error: {e}", exc_info=True)
                return Response(
                    {'error': f'Failed to generate PDF: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        return FileResponse(
            assessment.pdf_file.open('rb'),
            as_attachment=True,
            filename=f'water_assessment_{assessment.farm.name}_{assessment.assessment_year}.pdf'
        )

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """
        Duplicate assessment for a new year.

        Creates a new draft assessment with copied structure and data
        from the source assessment.
        """
        assessment = self.get_object()
        new_year = request.data.get('year', date.today().year)

        # Validate new year
        try:
            new_year = int(new_year)
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid year specified'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if assessment already exists for new year
        if FSMAWaterAssessment.objects.filter(
            farm=assessment.farm,
            assessment_year=new_year
        ).exists():
            return Response(
                {'error': f'Assessment for {new_year} already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create new assessment
        new_assessment = FSMAWaterAssessment.objects.create(
            company=assessment.company,
            farm=assessment.farm,
            assessment_year=new_year,
            assessment_date=date.today(),
            assessor_name=request.user.get_full_name() or request.user.email,
            assessor_title=assessment.assessor_title,
            status='draft',
        )

        # Duplicate source assessments
        for source in assessment.source_assessments.all():
            FSMASourceAssessment.objects.create(
                assessment=new_assessment,
                water_source=source.water_source,
                source_control_level=source.source_control_level,
                distribution_control_level=source.distribution_control_level,
                wellhead_condition=source.wellhead_condition,
                well_cap_secure=source.well_cap_secure,
                well_casing_intact=source.well_casing_intact,
                backflow_prevention=source.backflow_prevention,
                distribution_type=source.distribution_type,
                overall_condition=source.overall_condition,
                protection_description=source.protection_description,
                notes=f"Duplicated from {assessment.assessment_year} assessment"
            )

        # Duplicate field assessments
        for field_asmt in assessment.field_assessments.all():
            FSMAFieldAssessment.objects.create(
                assessment=new_assessment,
                field=field_asmt.field,
                water_source=field_asmt.water_source,
                application_method=field_asmt.application_method,
                crop_contact_type=field_asmt.crop_contact_type,
                typical_days_before_harvest=field_asmt.typical_days_before_harvest,
                minimum_days_before_harvest=field_asmt.minimum_days_before_harvest,
                foliar_applications=field_asmt.foliar_applications,
                crop_growth_position=field_asmt.crop_growth_position,
                crop_surface_type=field_asmt.crop_surface_type,
                internalization_risk=field_asmt.internalization_risk,
                notes=f"Duplicated from {assessment.assessment_year} assessment"
            )

        # Duplicate environmental assessment
        for env in assessment.environmental_assessments.all():
            FSMAEnvironmentalAssessment.objects.create(
                assessment=new_assessment,
                flooding_risk=env.flooding_risk,
                flooding_history=env.flooding_history,
                heavy_rain_frequency=env.heavy_rain_frequency,
                adjacent_land_uses=env.adjacent_land_uses,
                animal_operations_nearby=env.animal_operations_nearby,
                animal_operation_type=env.animal_operation_type,
                animal_operation_distance_ft=env.animal_operation_distance_ft,
                nearest_cafo_distance=env.nearest_cafo_distance,
                nearest_grazing_distance=env.nearest_grazing_distance,
                manure_application_nearby=env.manure_application_nearby,
                human_waste_nearby=env.human_waste_nearby,
                human_waste_type=env.human_waste_type,
                nearest_septic_distance=env.nearest_septic_distance,
                wildlife_pressure=env.wildlife_pressure,
                wildlife_exclusion_measures=env.wildlife_exclusion_measures,
                notes=f"Duplicated from {assessment.assessment_year} assessment"
            )

        return Response(
            FSMAWaterAssessmentDetailSerializer(new_assessment).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get summary statistics across all assessments."""
        company = require_company(request.user)

        assessments = FSMAWaterAssessment.objects.filter(company=company)
        current_year = date.today().year

        # Get farms without current year assessment
        farms_with_assessment = assessments.filter(
            assessment_year=current_year
        ).values_list('farm_id', flat=True)

        farms_without = Farm.objects.filter(
            company=company,
            active=True
        ).exclude(id__in=farms_with_assessment).count()

        return Response({
            'total_assessments': assessments.count(),
            'current_year_assessments': assessments.filter(
                assessment_year=current_year
            ).count(),
            'approved_assessments': assessments.filter(status='approved').count(),
            'pending_assessments': assessments.filter(status='pending_review').count(),
            'draft_assessments': assessments.filter(status='draft').count(),
            'expiring_soon': assessments.filter(
                valid_until__lte=date.today() + timedelta(days=30),
                valid_until__gte=date.today()
            ).count(),
            'expired': assessments.filter(
                valid_until__lt=date.today()
            ).count(),
            'by_risk_level': {
                'low': assessments.filter(risk_level='low').count(),
                'medium': assessments.filter(risk_level='medium').count(),
                'high': assessments.filter(risk_level='high').count(),
                'critical': assessments.filter(risk_level='critical').count(),
            },
            'farms_without_current_assessment': farms_without,
            'pending_mitigations': FSMAMitigationAction.objects.filter(
                assessment__company=company,
                status__in=['pending', 'in_progress']
            ).count(),
            'overdue_mitigations': FSMAMitigationAction.objects.filter(
                assessment__company=company,
                status__in=['pending', 'in_progress'],
                due_date__lt=date.today()
            ).count(),
        })


# =============================================================================
# FSMA SOURCE ASSESSMENT VIEWSET
# =============================================================================

class FSMASourceAssessmentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for water source assessments within a main assessment.

    Endpoints:
    - GET /api/fsma/source-assessments/?assessment=ID - List for assessment
    - POST /api/fsma/source-assessments/ - Create new source assessment
    - PUT /api/fsma/source-assessments/{id}/ - Update source assessment
    - DELETE /api/fsma/source-assessments/{id}/ - Delete source assessment
    """
    serializer_class = FSMASourceAssessmentSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FSMASourceAssessment.objects.none()

        queryset = FSMASourceAssessment.objects.filter(
            assessment__company=company
        ).select_related('assessment', 'water_source', 'water_source__farm')

        # Filter by assessment
        assessment_id = self.request.query_params.get('assessment')
        if assessment_id:
            queryset = queryset.filter(assessment_id=assessment_id)

        # Filter by water source
        water_source_id = self.request.query_params.get('water_source')
        if water_source_id:
            queryset = queryset.filter(water_source_id=water_source_id)

        return queryset


# =============================================================================
# FSMA FIELD ASSESSMENT VIEWSET
# =============================================================================

class FSMAFieldAssessmentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for field assessments within a main assessment.

    Endpoints:
    - GET /api/fsma/field-assessments/?assessment=ID - List for assessment
    - POST /api/fsma/field-assessments/ - Create new field assessment
    - PUT /api/fsma/field-assessments/{id}/ - Update field assessment
    - DELETE /api/fsma/field-assessments/{id}/ - Delete field assessment
    """
    serializer_class = FSMAFieldAssessmentSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FSMAFieldAssessment.objects.none()

        queryset = FSMAFieldAssessment.objects.filter(
            assessment__company=company
        ).select_related('assessment', 'field', 'field__farm', 'water_source')

        # Filter by assessment
        assessment_id = self.request.query_params.get('assessment')
        if assessment_id:
            queryset = queryset.filter(assessment_id=assessment_id)

        # Filter by field
        field_id = self.request.query_params.get('field')
        if field_id:
            queryset = queryset.filter(field_id=field_id)

        return queryset


# =============================================================================
# FSMA ENVIRONMENTAL ASSESSMENT VIEWSET
# =============================================================================

class FSMAEnvironmentalAssessmentViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for environmental assessments.

    Endpoints:
    - GET /api/fsma/environmental-assessments/?assessment=ID - List
    - POST /api/fsma/environmental-assessments/ - Create
    - PUT /api/fsma/environmental-assessments/{id}/ - Update
    - DELETE /api/fsma/environmental-assessments/{id}/ - Delete
    """
    serializer_class = FSMAEnvironmentalAssessmentSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FSMAEnvironmentalAssessment.objects.none()

        queryset = FSMAEnvironmentalAssessment.objects.filter(
            assessment__company=company
        ).select_related('assessment', 'assessment__farm')

        # Filter by assessment
        assessment_id = self.request.query_params.get('assessment')
        if assessment_id:
            queryset = queryset.filter(assessment_id=assessment_id)

        return queryset


# =============================================================================
# FSMA MITIGATION ACTION VIEWSET
# =============================================================================

class FSMAMitigationActionViewSet(AuditLogMixin, viewsets.ModelViewSet):
    """
    API endpoint for mitigation action tracking.

    Endpoints:
    - GET /api/fsma/mitigation-actions/?assessment=ID - List for assessment
    - GET /api/fsma/mitigation-actions/?status=pending - Filter by status
    - GET /api/fsma/mitigation-actions/?overdue=true - Get overdue actions
    - POST /api/fsma/mitigation-actions/ - Create new action
    - PUT /api/fsma/mitigation-actions/{id}/ - Update action
    - DELETE /api/fsma/mitigation-actions/{id}/ - Delete action

    Custom Actions:
    - POST /api/fsma/mitigation-actions/{id}/complete/ - Mark as complete
    - POST /api/fsma/mitigation-actions/{id}/verify/ - Verify completion
    """
    serializer_class = FSMAMitigationActionSerializer
    permission_classes = [IsAuthenticated, HasCompanyAccess]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['priority', 'due_date', 'status', 'created_at']
    ordering = ['-priority', 'due_date']

    def get_queryset(self):
        company = get_user_company(self.request.user)
        if not company:
            return FSMAMitigationAction.objects.none()

        queryset = FSMAMitigationAction.objects.filter(
            assessment__company=company
        ).select_related('assessment', 'assessment__farm', 'completed_by', 'verified_by')

        # Filter by assessment
        assessment_id = self.request.query_params.get('assessment')
        if assessment_id:
            queryset = queryset.filter(assessment_id=assessment_id)

        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Filter by overdue
        overdue = self.request.query_params.get('overdue')
        if overdue and overdue.lower() == 'true':
            queryset = queryset.filter(
                due_date__lt=date.today(),
                status__in=['pending', 'in_progress']
            )

        # Filter by priority
        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)

        return queryset

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark a mitigation action as complete."""
        action_item = self.get_object()

        if action_item.status == 'completed':
            return Response(
                {'error': 'Action is already completed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        action_item.status = 'completed'
        action_item.completed_date = date.today()
        action_item.completed_by = request.user
        action_item.completion_notes = request.data.get('notes', '')
        action_item.save()

        return Response(FSMAMitigationActionSerializer(action_item).data)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Verify a completed mitigation action."""
        action_item = self.get_object()

        if action_item.status != 'completed':
            return Response(
                {'error': 'Only completed actions can be verified'},
                status=status.HTTP_400_BAD_REQUEST
            )

        action_item.verified_by = request.user
        action_item.verified_date = date.today()
        action_item.save()

        return Response(FSMAMitigationActionSerializer(action_item).data)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get mitigation actions dashboard data."""
        company = require_company(request.user)

        actions = FSMAMitigationAction.objects.filter(
            assessment__company=company
        )

        return Response({
            'total': actions.count(),
            'pending': actions.filter(status='pending').count(),
            'in_progress': actions.filter(status='in_progress').count(),
            'completed': actions.filter(status='completed').count(),
            'overdue': actions.filter(
                due_date__lt=date.today(),
                status__in=['pending', 'in_progress']
            ).count(),
            'due_this_week': actions.filter(
                due_date__gte=date.today(),
                due_date__lte=date.today() + timedelta(days=7),
                status__in=['pending', 'in_progress']
            ).count(),
            'by_priority': {
                'critical': actions.filter(
                    priority='critical',
                    status__in=['pending', 'in_progress']
                ).count(),
                'high': actions.filter(
                    priority='high',
                    status__in=['pending', 'in_progress']
                ).count(),
                'medium': actions.filter(
                    priority='medium',
                    status__in=['pending', 'in_progress']
                ).count(),
                'low': actions.filter(
                    priority='low',
                    status__in=['pending', 'in_progress']
                ).count(),
            },
            'by_category': {
                cat[0]: actions.filter(category=cat[0], status__in=['pending', 'in_progress']).count()
                for cat in FSMAMitigationAction.CATEGORY_CHOICES
            },
        })
