"""
FSMA Water Assessment PDF Generator Service

Generates comprehensive PDF reports for FSMA Pre-Harvest Agricultural Water
Assessments per 21 CFR 112.43 requirements.
"""

import io
from datetime import datetime
from typing import List, Optional
from django.utils import timezone
from django.core.files.base import ContentFile


class WaterAssessmentPDFGenerator:
    """
    Generates PDF reports for FSMA Pre-Harvest Agricultural Water Assessments.

    The PDF includes:
    - Cover page with farm/company info and assessment year
    - Executive summary with risk scores
    - Water source assessments
    - Field assessments
    - Environmental assessment
    - Mitigation action plan
    - Signature pages
    - Appendices (test data)
    """

    def __init__(self, assessment):
        """
        Initialize the generator with an FSMAWaterAssessment instance.

        Args:
            assessment: The FSMAWaterAssessment model instance
        """
        self.assessment = assessment
        self.farm = assessment.farm
        self.company = assessment.company

    def generate(self) -> bool:
        """
        Generate the complete water assessment PDF.

        Returns:
            True if generation was successful, False otherwise
        """
        try:
            # Generate the PDF
            pdf_buffer = self._generate_pdf()

            # Save the file
            filename = f"water_assessment_{self.farm.id}_{self.assessment.assessment_year}.pdf"
            self.assessment.pdf_file.save(filename, ContentFile(pdf_buffer.getvalue()))

            # Update metadata
            self.assessment.pdf_generated_at = timezone.now()
            self.assessment.save(update_fields=['pdf_file', 'pdf_generated_at'])

            return True

        except Exception as e:
            import logging
            logging.error(f"Failed to generate water assessment PDF: {e}")
            return False

    def _generate_pdf(self) -> io.BytesIO:
        """
        Generate the PDF content using ReportLab.

        Returns:
            BytesIO buffer containing the PDF data
        """
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import inch
            from reportlab.platypus import (
                SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                PageBreak
            )
            from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
        except ImportError:
            # If reportlab is not available, generate a simple text-based PDF
            return self._generate_simple_pdf()

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=0.5*inch,
            leftMargin=0.5*inch,
            topMargin=0.75*inch,
            bottomMargin=0.75*inch
        )

        # Build story (content)
        story = []
        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            alignment=TA_CENTER,
            spaceAfter=30
        )
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=16,
            spaceAfter=12
        )
        subheading_style = ParagraphStyle(
            'CustomSubheading',
            parent=styles['Heading3'],
            fontSize=12,
            spaceAfter=8
        )
        normal_style = styles['Normal']

        # Cover Page
        story.extend(self._build_cover_page(title_style, normal_style))
        story.append(PageBreak())

        # Executive Summary
        story.extend(self._build_executive_summary(heading_style, normal_style))
        story.append(PageBreak())

        # Water Source Assessments
        story.extend(self._build_source_assessments(heading_style, subheading_style, normal_style))
        story.append(PageBreak())

        # Field Assessments
        story.extend(self._build_field_assessments(heading_style, subheading_style, normal_style))
        story.append(PageBreak())

        # Environmental Assessment
        story.extend(self._build_environmental_assessment(heading_style, normal_style))
        story.append(PageBreak())

        # Mitigation Actions
        story.extend(self._build_mitigation_actions(heading_style, normal_style))
        story.append(PageBreak())

        # Signatures
        story.extend(self._build_signature_page(heading_style, normal_style))

        # Build the document
        doc.build(story)

        buffer.seek(0)
        return buffer

    def _generate_simple_pdf(self) -> io.BytesIO:
        """
        Generate a simple text-based PDF without ReportLab.
        This is a fallback if ReportLab is not installed.
        """
        buffer = io.BytesIO()

        risk_level = self.assessment.risk_level or 'Not Calculated'
        risk_score = self.assessment.overall_risk_score or 0

        content = f"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
  /Font <<
    /F1 5 0 R
  >>
>>
>>
endobj

4 0 obj
<<
/Length 400
>>
stream
BT
/F1 24 Tf
72 720 Td
(FSMA Pre-Harvest Agricultural) Tj
0 -28 Td
(Water Assessment) Tj
/F1 12 Tf
0 -40 Td
(Farm: {self.farm.name}) Tj
0 -20 Td
(Assessment Year: {self.assessment.assessment_year}) Tj
0 -20 Td
(Overall Risk Score: {risk_score}) Tj
0 -20 Td
(Risk Level: {risk_level}) Tj
0 -20 Td
(FDA Determination: {self.assessment.fda_determination or 'Pending'}) Tj
0 -40 Td
(Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}) Tj
0 -20 Td
(Note: Install reportlab package for full PDF generation) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000716 00000 n

trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
793
%%EOF"""

        buffer.write(content.encode())
        buffer.seek(0)
        return buffer

    def _build_cover_page(self, title_style, normal_style) -> List:
        """Build the cover page content."""
        from reportlab.platypus import Paragraph, Spacer

        story = []

        story.append(Spacer(1, 80))
        story.append(Paragraph("FSMA PRE-HARVEST AGRICULTURAL", title_style))
        story.append(Paragraph("WATER ASSESSMENT", title_style))
        story.append(Spacer(1, 20))
        story.append(Paragraph("21 CFR 112.43 Compliance Document", normal_style))
        story.append(Spacer(1, 50))

        story.append(Paragraph(f"<b>{self.company.name}</b>", normal_style))
        story.append(Spacer(1, 10))

        if self.company.address:
            story.append(Paragraph(self.company.address, normal_style))
        if self.company.city and self.company.state:
            story.append(Paragraph(
                f"{self.company.city}, {self.company.state} {self.company.zip_code or ''}",
                normal_style
            ))

        story.append(Spacer(1, 30))
        story.append(Paragraph(f"<b>Farm:</b> {self.farm.name}", normal_style))
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"<b>Assessment Year:</b> {self.assessment.assessment_year}", normal_style))
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"<b>Assessment Date:</b> {self.assessment.assessment_date or 'Not Set'}", normal_style))
        story.append(Spacer(1, 30))

        # Risk Score Summary Box
        risk_color = self._get_risk_color(self.assessment.risk_level)
        story.append(Paragraph(
            f"<b>Overall Risk Score:</b> {self.assessment.overall_risk_score or 'N/A'} / 100",
            normal_style
        ))
        story.append(Paragraph(
            f"<b>Risk Level:</b> {(self.assessment.risk_level or 'Not Calculated').upper()}",
            normal_style
        ))
        story.append(Paragraph(
            f"<b>FDA Determination:</b> {self._format_fda_determination()}",
            normal_style
        ))

        story.append(Spacer(1, 50))
        story.append(Paragraph(
            f"<b>Generated:</b> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}",
            normal_style
        ))

        if self.assessment.assessor:
            story.append(Paragraph(
                f"<b>Assessor:</b> {self.assessment.assessor.get_full_name() or self.assessment.assessor.email}",
                normal_style
            ))

        return story

    def _build_executive_summary(self, heading_style, normal_style) -> List:
        """Build the executive summary section."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors

        story = []
        story.append(Paragraph("Executive Summary", heading_style))
        story.append(Spacer(1, 10))

        # Overall Risk Score box
        overall_score = self.assessment.overall_risk_score or 0
        risk_level = (self.assessment.risk_level or 'Not Calculated').upper()

        story.append(Paragraph(f"<b>Overall Risk Score:</b> {overall_score:.1f} / 100", normal_style))
        story.append(Paragraph(f"<b>Risk Level:</b> {risk_level}", normal_style))
        story.append(Spacer(1, 20))

        # FDA Determination
        story.append(Paragraph("<b>FDA Determination</b>", normal_style))
        story.append(Spacer(1, 5))
        story.append(Paragraph(self._format_fda_determination(), normal_style))
        if self.assessment.outcome_notes:
            story.append(Spacer(1, 5))
            story.append(Paragraph(self.assessment.outcome_notes, normal_style))
        story.append(Spacer(1, 15))

        # Assessment Summary
        summary_data = [
            ['Item', 'Count'],
            ['Water Sources Assessed', str(self.assessment.source_assessments.count())],
            ['Fields Assessed', str(self.assessment.field_assessments.count())],
        ]

        summary_table = Table(summary_data, colWidths=[200, 100])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 20))

        # Required Actions Summary
        story.append(Paragraph("<b>Required Actions</b>", normal_style))
        story.append(Spacer(1, 5))

        mitigation_actions = self.assessment.mitigation_actions.all()
        if mitigation_actions.exists():
            pending = mitigation_actions.filter(status='pending').count()
            in_progress = mitigation_actions.filter(status='in_progress').count()
            completed = mitigation_actions.filter(status='completed').count()
            story.append(Paragraph(
                f"Total Actions: {mitigation_actions.count()} | "
                f"Pending: {pending} | In Progress: {in_progress} | Completed: {completed}",
                normal_style
            ))
        else:
            story.append(Paragraph("No corrective actions required.", normal_style))

        story.append(Spacer(1, 15))

        # Assessment Notes
        if self.assessment.notes:
            story.append(Paragraph("<b>Assessment Notes</b>", normal_style))
            story.append(Spacer(1, 5))
            story.append(Paragraph(self.assessment.notes, normal_style))

        return story

    def _build_source_assessments(self, heading_style, subheading_style, normal_style) -> List:
        """Build the water source assessments section."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors

        story = []
        story.append(Paragraph("Water Source Assessments", heading_style))
        story.append(Spacer(1, 10))

        source_assessments = self.assessment.source_assessments.select_related('water_source').all()

        if not source_assessments.exists():
            story.append(Paragraph("No water source assessments recorded.", normal_style))
            return story

        for idx, source_assess in enumerate(source_assessments, 1):
            ws = source_assess.water_source
            source_type = ws.get_source_type_display() if hasattr(ws, 'get_source_type_display') else (ws.source_type or 'Unknown')
            story.append(Paragraph(f"{idx}. {ws.source_name} ({source_type})", subheading_style))
            story.append(Spacer(1, 5))

            # Get display values safely
            wellhead_condition = source_assess.get_wellhead_condition_display() if source_assess.wellhead_condition else 'Not Assessed'
            source_control = source_assess.get_source_control_level_display() if source_assess.source_control_level else 'Not Specified'
            distribution_control = source_assess.get_distribution_control_level_display() if source_assess.distribution_control_level else 'Not Specified'

            # Source Details Table
            data = [
                ['Characteristic', 'Value'],
                ['Source Type', source_type],
                ['Wellhead Condition', wellhead_condition],
                ['Source Control Level', source_control],
                ['Distribution Control', distribution_control],
                ['Well Cap Secure', 'Yes' if source_assess.well_cap_secure else 'No' if source_assess.well_cap_secure is False else 'N/A'],
                ['Well Casing Intact', 'Yes' if source_assess.well_casing_intact else 'No' if source_assess.well_casing_intact is False else 'N/A'],
                ['Backflow Prevention', 'Yes' if source_assess.backflow_prevention else 'No' if source_assess.backflow_prevention is False else 'N/A'],
                ['Animal Access Possible', 'Yes' if source_assess.animal_access_possible else 'No'],
                ['Risk Score', f"{source_assess.source_risk_score:.1f}" if source_assess.source_risk_score else 'N/A'],
            ]

            table = Table(data, colWidths=[200, 200])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(table)
            story.append(Spacer(1, 10))

            # Risk Factors
            if source_assess.risk_factors:
                story.append(Paragraph("<b>Identified Risk Factors:</b>", normal_style))
                for factor in source_assess.risk_factors:
                    if isinstance(factor, dict):
                        story.append(Paragraph(f"  - {factor.get('issue', factor)}", normal_style))
                    else:
                        story.append(Paragraph(f"  - {factor}", normal_style))
                story.append(Spacer(1, 5))

            # Notes
            if source_assess.notes:
                story.append(Paragraph(f"<b>Notes:</b> {source_assess.notes}", normal_style))

            story.append(Spacer(1, 15))

        return story

    def _build_field_assessments(self, heading_style, subheading_style, normal_style) -> List:
        """Build the field assessments section."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors

        story = []
        story.append(Paragraph("Field Assessments", heading_style))
        story.append(Spacer(1, 10))

        field_assessments = self.assessment.field_assessments.select_related('field').all()

        if not field_assessments.exists():
            story.append(Paragraph("No field assessments recorded.", normal_style))
            return story

        for idx, field_assess in enumerate(field_assessments, 1):
            field = field_assess.field
            story.append(Paragraph(f"{idx}. {field.name}", subheading_style))
            story.append(Spacer(1, 5))

            # Get display values safely
            application_method = field_assess.get_application_method_display() if field_assess.application_method else 'Not Specified'
            crop_contact = field_assess.get_crop_contact_type_display() if field_assess.crop_contact_type else 'Not Specified'

            # Field Details Table
            data = [
                ['Characteristic', 'Value'],
                ['Crop Type', field.crop_type or 'Not Specified'],
                ['Acreage', f"{field.acreage or 'N/A'} acres"],
                ['Application Method', application_method],
                ['Crop Contact Type', crop_contact],
                ['Days Before Harvest', str(field_assess.typical_days_before_harvest) if field_assess.typical_days_before_harvest else 'N/A'],
                ['Die-off Period Adequate', 'Yes' if field_assess.die_off_period_adequate else 'No' if field_assess.die_off_period_adequate is False else 'N/A'],
                ['Risk Score', f"{field_assess.field_risk_score:.1f}" if field_assess.field_risk_score else 'N/A'],
            ]

            table = Table(data, colWidths=[200, 200])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(table)
            story.append(Spacer(1, 10))

            # Notes
            if field_assess.notes:
                story.append(Paragraph(f"<b>Notes:</b> {field_assess.notes}", normal_style))

            story.append(Spacer(1, 15))

        return story

    def _build_environmental_assessment(self, heading_style, normal_style) -> List:
        """Build the environmental assessment section."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors

        story = []
        story.append(Paragraph("Environmental Assessment", heading_style))
        story.append(Spacer(1, 10))

        # Get the environmental assessment - may be a related object or first in queryset
        env_assess = None
        try:
            env_assess = self.assessment.environmental_assessments.first()
        except Exception:
            pass

        if not env_assess:
            story.append(Paragraph("No environmental assessment recorded.", normal_style))
            return story

        # Get wildlife pressure display safely
        wildlife_display = env_assess.get_wildlife_pressure_display() if hasattr(env_assess, 'get_wildlife_pressure_display') and env_assess.wildlife_pressure else (env_assess.wildlife_pressure or 'Unknown')
        wildlife_risk = 'High' if env_assess.wildlife_pressure == 'high' else 'Medium' if env_assess.wildlife_pressure == 'medium' else 'Low'

        # Get animal operation distance - check for different possible field names
        animal_distance = getattr(env_assess, 'nearest_animal_operation_ft', None) or getattr(env_assess, 'animal_operation_distance_ft', None)
        animal_distance_str = f"{animal_distance} ft" if animal_distance else 'Unknown'
        animal_distance_risk = 'High' if (animal_distance or 9999) < 400 else 'Low'

        # Check for CAFO field with different names
        cafo_nearby = getattr(env_assess, 'cafo_within_1000ft', None) or getattr(env_assess, 'animal_operations_nearby', None)

        # Environmental Factors Table
        data = [
            ['Factor', 'Value', 'Risk Indicator'],
            ['Animal Operations Nearby', 'Yes' if cafo_nearby else 'No',
             'High' if cafo_nearby else 'Low'],
            ['Nearest Animal Operation', animal_distance_str, animal_distance_risk],
            ['Flooding History', 'Yes' if env_assess.flooding_history else 'No',
             'Medium' if env_assess.flooding_history else 'Low'],
            ['Wildlife Pressure', wildlife_display, wildlife_risk],
            ['Risk Score', f"{env_assess.environmental_risk_score:.1f}" if env_assess.environmental_risk_score else 'N/A', ''],
        ]

        table = Table(data, colWidths=[180, 150, 100])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(table)
        story.append(Spacer(1, 15))

        # Adjacent Land Uses
        if env_assess.adjacent_land_uses:
            story.append(Paragraph("<b>Adjacent Land Uses:</b>", normal_style))
            land_uses = env_assess.adjacent_land_uses if isinstance(env_assess.adjacent_land_uses, list) else []
            for use in land_uses:
                story.append(Paragraph(f"  - {use}", normal_style))
            story.append(Spacer(1, 10))

        # Notes
        if env_assess.notes:
            story.append(Paragraph(f"<b>Notes:</b> {env_assess.notes}", normal_style))

        return story

    def _build_mitigation_actions(self, heading_style, normal_style) -> List:
        """Build the mitigation actions section."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors

        story = []
        story.append(Paragraph("Mitigation Action Plan", heading_style))
        story.append(Spacer(1, 10))

        mitigation_actions = self.assessment.mitigation_actions.all().order_by('priority', 'due_date')

        if not mitigation_actions.exists():
            story.append(Paragraph(
                "Based on the assessment results, no corrective actions are required at this time.",
                normal_style
            ))
            return story

        # Actions Table
        data = [['#', 'Action', 'Priority', 'Due Date', 'Status']]

        for idx, action in enumerate(mitigation_actions, 1):
            # Get description - check multiple possible field names
            description = getattr(action, 'mitigation_description', '') or getattr(action, 'title', '') or 'Action'
            if len(description) > 40:
                description = description[:40] + '...'

            priority = action.get_priority_display() if hasattr(action, 'get_priority_display') else action.priority
            status = action.get_status_display() if hasattr(action, 'get_status_display') else action.status

            data.append([
                str(idx),
                description,
                priority or 'Medium',
                str(action.due_date) if action.due_date else 'Not Set',
                status or 'Pending',
            ])

        table = Table(data, colWidths=[25, 220, 70, 90, 80])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(table)
        story.append(Spacer(1, 15))

        # Detailed Action Descriptions
        story.append(Paragraph("<b>Detailed Action Descriptions:</b>", normal_style))
        story.append(Spacer(1, 5))

        for idx, action in enumerate(mitigation_actions, 1):
            title = getattr(action, 'title', '') or f"Action {idx}"
            description = getattr(action, 'mitigation_description', '') or ''
            story.append(Paragraph(f"<b>{idx}. {title}</b>", normal_style))
            if description:
                story.append(Paragraph(description, normal_style))
            story.append(Spacer(1, 8))

        return story

    def _build_signature_page(self, heading_style, normal_style) -> List:
        """Build the signature page."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors

        story = []
        story.append(Paragraph("Certification and Approval", heading_style))
        story.append(Spacer(1, 20))

        story.append(Paragraph(
            "This Pre-Harvest Agricultural Water Assessment has been conducted in accordance with "
            "21 CFR Part 112 Subpart E requirements. The information contained in this document "
            "is accurate and complete to the best of our knowledge.",
            normal_style
        ))
        story.append(Spacer(1, 30))

        # Assessor Signature
        story.append(Paragraph("<b>Assessment Conducted By:</b>", normal_style))
        story.append(Spacer(1, 10))

        if self.assessment.assessor:
            assessor_name = self.assessment.assessor.get_full_name() or self.assessment.assessor.email
        else:
            assessor_name = "________________________"

        assessor_date = str(self.assessment.assessment_date) if self.assessment.assessment_date else "________________________"

        data = [
            ['Name:', assessor_name],
            ['Date:', assessor_date],
            ['Signature:', '________________________'],
        ]
        table = Table(data, colWidths=[80, 300])
        table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
        ]))
        story.append(table)
        story.append(Spacer(1, 30))

        # Approval Signature
        if self.assessment.status == 'approved':
            story.append(Paragraph("<b>Approved By:</b>", normal_style))
            story.append(Spacer(1, 10))

            if self.assessment.approved_by:
                approver_name = self.assessment.approved_by.get_full_name() or self.assessment.approved_by.email
            else:
                approver_name = "________________________"

            approval_date = str(self.assessment.approved_at.date()) if self.assessment.approved_at else "________________________"

            data = [
                ['Name:', approver_name],
                ['Date:', approval_date],
                ['Signature:', '________________________'],
            ]
            table = Table(data, colWidths=[80, 300])
            table.setStyle(TableStyle([
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 15),
            ]))
            story.append(table)

        return story

    def _format_fda_determination(self) -> str:
        """Format the FDA determination for display."""
        determinations = {
            'no_treatment': 'No Treatment Required - Water meets FDA standards',
            'treatment_required': 'Treatment Required - Water must be treated before use',
            'die_off_required': 'Die-off Interval Required - Allow time between application and harvest',
            'testing_required': 'Additional Testing Required - More water quality data needed',
        }
        # Check both possible field names
        fda_outcome = getattr(self.assessment, 'fda_outcome', None) or getattr(self.assessment, 'fda_determination', None)
        return determinations.get(fda_outcome, 'Pending Assessment')

    def _get_risk_color(self, risk_level: Optional[str]) -> str:
        """Get color name for risk level."""
        colors_map = {
            'low': 'green',
            'medium': 'orange',
            'high': 'red',
            'critical': 'darkred',
        }
        return colors_map.get(risk_level, 'grey')
