"""
FSMA Audit Binder Generator Service

Generates comprehensive PDF audit binders containing FSMA compliance
records for inspection and record-keeping purposes.
"""

import io
import os
from datetime import date, datetime
from typing import Optional, List
from django.utils import timezone
from django.core.files.base import ContentFile


class AuditBinderGenerator:
    """
    Generates PDF audit binders containing FSMA compliance records.

    The audit binder includes:
    - Cover page with company info and date range
    - Table of contents
    - Visitor logs section
    - Facility cleaning logs section
    - Safety meeting records with attendance
    - Fertilizer inventory summary
    - PHI compliance reports
    - Harvest records
    """

    def __init__(self, audit_binder):
        """
        Initialize the generator with an AuditBinder instance.

        Args:
            audit_binder: The AuditBinder model instance to generate
        """
        self.binder = audit_binder
        self.company = audit_binder.company
        self.start_date = audit_binder.date_range_start
        self.end_date = audit_binder.date_range_end
        self.farm_ids = audit_binder.farm_ids if audit_binder.farm_ids else None

    def generate(self) -> bool:
        """
        Generate the complete audit binder PDF.

        Returns:
            True if generation was successful, False otherwise
        """
        from api.models import AuditBinder

        try:
            # Update status to generating
            self.binder.status = 'generating'
            self.binder.generation_started = timezone.now()
            self.binder.save(update_fields=['status', 'generation_started'])

            # Generate the PDF
            pdf_buffer = self._generate_pdf()

            # Save the file
            filename = f"audit_binder_{self.company.id}_{self.start_date}_{self.end_date}.pdf"
            self.binder.pdf_file.save(filename, ContentFile(pdf_buffer.getvalue()))

            # Update metadata
            self.binder.file_size = len(pdf_buffer.getvalue())
            self.binder.status = 'completed'
            self.binder.generation_completed = timezone.now()
            self.binder.save()

            return True

        except Exception as e:
            self.binder.status = 'failed'
            self.binder.error_message = str(e)
            self.binder.generation_completed = timezone.now()
            self.binder.save()
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
                PageBreak, Image
            )
            from reportlab.lib.enums import TA_CENTER, TA_LEFT
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
        normal_style = styles['Normal']

        # Cover Page
        story.extend(self._build_cover_page(title_style, normal_style))
        story.append(PageBreak())

        # Table of Contents
        story.extend(self._build_table_of_contents(heading_style, normal_style))
        story.append(PageBreak())

        # Visitor Logs Section
        if self.binder.include_visitor_logs:
            story.extend(self._build_visitor_logs_section(heading_style, normal_style))
            story.append(PageBreak())

        # Cleaning Logs Section
        if self.binder.include_cleaning_logs:
            story.extend(self._build_cleaning_logs_section(heading_style, normal_style))
            story.append(PageBreak())

        # Safety Meetings Section
        if self.binder.include_safety_meetings:
            story.extend(self._build_safety_meetings_section(heading_style, normal_style))
            story.append(PageBreak())

        # Fertilizer Inventory Section
        if self.binder.include_fertilizer_inventory:
            story.extend(self._build_inventory_section(heading_style, normal_style))
            story.append(PageBreak())

        # PHI Compliance Section
        if self.binder.include_phi_reports:
            story.extend(self._build_phi_section(heading_style, normal_style))
            story.append(PageBreak())

        # Harvest Records Section
        if self.binder.include_harvest_records:
            story.extend(self._build_harvest_section(heading_style, normal_style))

        # Primus GFS Internal Audits Section
        if getattr(self.binder, 'include_primus_audits', False):
            story.append(PageBreak())
            story.extend(self._build_primus_audits_section(heading_style, normal_style))

        # Primus GFS Open Findings Section
        if getattr(self.binder, 'include_primus_findings', False):
            story.append(PageBreak())
            story.extend(self._build_primus_findings_section(heading_style, normal_style))

        # Build the document
        doc.build(story)

        # Get page count (approximate based on content)
        buffer.seek(0)
        return buffer

    def _generate_simple_pdf(self) -> io.BytesIO:
        """
        Generate a simple text-based PDF without ReportLab.
        This is a fallback if ReportLab is not installed.
        """
        buffer = io.BytesIO()

        # Simple PDF header (PDF 1.4 compliant)
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
/Length 200
>>
stream
BT
/F1 24 Tf
72 720 Td
(FSMA Compliance Audit Binder) Tj
/F1 12 Tf
0 -30 Td
({self.company.name}) Tj
0 -20 Td
(Date Range: {self.start_date} to {self.end_date}) Tj
0 -20 Td
(Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}) Tj
0 -40 Td
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
0000000516 00000 n

trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
593
%%EOF"""

        buffer.write(content.encode())
        buffer.seek(0)
        return buffer

    def _build_cover_page(self, title_style, normal_style) -> List:
        """Build the cover page content."""
        from reportlab.platypus import Paragraph, Spacer

        story = []

        story.append(Spacer(1, 100))
        story.append(Paragraph("FSMA COMPLIANCE", title_style))
        story.append(Paragraph("AUDIT BINDER", title_style))
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
        story.append(Paragraph(
            f"<b>Reporting Period:</b> {self.start_date} to {self.end_date}",
            normal_style
        ))
        story.append(Spacer(1, 10))
        story.append(Paragraph(
            f"<b>Generated:</b> {datetime.now().strftime('%B %d, %Y at %I:%M %p')}",
            normal_style
        ))

        if self.binder.generated_by:
            story.append(Paragraph(
                f"<b>Generated by:</b> {self.binder.generated_by.get_full_name() or self.binder.generated_by.email}",
                normal_style
            ))

        return story

    def _build_table_of_contents(self, heading_style, normal_style) -> List:
        """Build the table of contents."""
        from reportlab.platypus import Paragraph, Spacer

        story = []
        story.append(Paragraph("Table of Contents", heading_style))
        story.append(Spacer(1, 20))

        sections = []
        if self.binder.include_visitor_logs:
            sections.append("1. Visitor Logs")
        if self.binder.include_cleaning_logs:
            sections.append("2. Facility Cleaning Logs")
        if self.binder.include_safety_meetings:
            sections.append("3. Safety Meeting Records")
        if self.binder.include_fertilizer_inventory:
            sections.append("4. Fertilizer Inventory Summary")
        if self.binder.include_phi_reports:
            sections.append("5. PHI Compliance Reports")
        if self.binder.include_harvest_records:
            sections.append("6. Harvest Records")

        for section in sections:
            story.append(Paragraph(section, normal_style))
            story.append(Spacer(1, 5))

        return story

    def _build_visitor_logs_section(self, heading_style, normal_style) -> List:
        """Build the visitor logs section."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors
        from api.models import VisitorLog

        story = []
        story.append(Paragraph("1. Visitor Logs", heading_style))
        story.append(Spacer(1, 10))

        queryset = VisitorLog.objects.filter(
            company=self.company,
            visit_date__gte=self.start_date,
            visit_date__lte=self.end_date
        ).order_by('visit_date', 'time_in')

        if self.farm_ids:
            queryset = queryset.filter(farm_id__in=self.farm_ids)

        if not queryset.exists():
            story.append(Paragraph("No visitor logs found for this period.", normal_style))
            return story

        # Build table data
        data = [['Date', 'Time In', 'Time Out', 'Visitor', 'Company', 'Type', 'Farm', 'Signed']]

        for log in queryset:
            data.append([
                str(log.visit_date),
                str(log.time_in)[:5] if log.time_in else '',
                str(log.time_out)[:5] if log.time_out else '',
                log.visitor_name[:20],
                log.visitor_company[:15] if log.visitor_company else '',
                log.get_visitor_type_display()[:12],
                log.farm.name[:15] if log.farm else '',
                'Yes' if log.signature_data else 'No'
            ])

        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ]))

        story.append(table)
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"Total Visitors: {queryset.count()}", normal_style))

        return story

    def _build_cleaning_logs_section(self, heading_style, normal_style) -> List:
        """Build the cleaning logs section."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors
        from api.models import FacilityCleaningLog

        story = []
        story.append(Paragraph("2. Facility Cleaning Logs", heading_style))
        story.append(Spacer(1, 10))

        queryset = FacilityCleaningLog.objects.filter(
            facility__company=self.company,
            cleaning_date__gte=self.start_date,
            cleaning_date__lte=self.end_date
        ).select_related('facility', 'cleaned_by').order_by('cleaning_date', 'cleaning_time')

        if self.farm_ids:
            queryset = queryset.filter(facility__farm_id__in=self.farm_ids)

        if not queryset.exists():
            story.append(Paragraph("No cleaning logs found for this period.", normal_style))
            return story

        data = [['Date', 'Time', 'Facility', 'Type', 'Cleaned By', 'Surfaces', 'Floors', 'Trash', 'Sanitized', 'Signed']]

        for log in queryset:
            cleaned_by = ''
            if log.cleaned_by:
                cleaned_by = log.cleaned_by.get_full_name()[:15] or log.cleaned_by.email[:15]
            elif log.cleaned_by_name:
                cleaned_by = log.cleaned_by_name[:15]

            data.append([
                str(log.cleaning_date),
                str(log.cleaning_time)[:5],
                log.facility.name[:15],
                log.facility.get_facility_type_display()[:12],
                cleaned_by,
                'Y' if log.surfaces_cleaned else 'N',
                'Y' if log.floors_cleaned else 'N',
                'Y' if log.trash_removed else 'N',
                'Y' if log.sanitizer_applied else 'N',
                'Y' if log.signature_data else 'N'
            ])

        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 7),
            ('FONTSIZE', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ]))

        story.append(table)
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"Total Cleaning Events: {queryset.count()}", normal_style))

        return story

    def _build_safety_meetings_section(self, heading_style, normal_style) -> List:
        """Build the safety meetings section."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors
        from api.models import SafetyMeeting

        story = []
        story.append(Paragraph("3. Safety Meeting Records", heading_style))
        story.append(Spacer(1, 10))

        meetings = SafetyMeeting.objects.filter(
            company=self.company,
            meeting_date__gte=self.start_date,
            meeting_date__lte=self.end_date
        ).prefetch_related('attendees').order_by('meeting_date')

        if not meetings.exists():
            story.append(Paragraph("No safety meetings found for this period.", normal_style))
            return story

        for meeting in meetings:
            story.append(Paragraph(
                f"<b>{meeting.get_meeting_type_display()}</b> - {meeting.meeting_date}",
                normal_style
            ))
            story.append(Spacer(1, 5))

            if meeting.location:
                story.append(Paragraph(f"Location: {meeting.location}", normal_style))
            if meeting.trainer_name:
                story.append(Paragraph(f"Trainer: {meeting.trainer_name}", normal_style))
            if meeting.duration_minutes:
                story.append(Paragraph(f"Duration: {meeting.duration_minutes} minutes", normal_style))

            story.append(Spacer(1, 10))

            # Attendees table
            attendees = meeting.attendees.all()
            if attendees:
                data = [['Attendee Name', 'Employee ID', 'Department', 'Signed', 'Signed At']]
                for att in attendees:
                    data.append([
                        att.attendee_name,
                        att.employee_id or '',
                        att.department or '',
                        'Yes' if att.signature_data else 'No',
                        str(att.signed_at)[:16] if att.signed_at else ''
                    ])

                table = Table(data, repeatRows=1)
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                ]))
                story.append(table)

            story.append(Spacer(1, 20))

        return story

    def _build_inventory_section(self, heading_style, normal_style) -> List:
        """Build the fertilizer inventory section."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors
        from api.models import FertilizerInventory

        story = []
        story.append(Paragraph("4. Fertilizer Inventory Summary", heading_style))
        story.append(Spacer(1, 10))

        inventory = FertilizerInventory.objects.filter(
            company=self.company
        ).select_related('product')

        if not inventory.exists():
            story.append(Paragraph("No fertilizer inventory records found.", normal_style))
            return story

        data = [['Product', 'NPK', 'Quantity', 'Unit', 'Reorder Point', 'Storage Location', 'Low Stock']]

        for inv in inventory:
            npk = f"{inv.product.nitrogen_pct}-{inv.product.phosphorus_pct}-{inv.product.potassium_pct}"
            data.append([
                inv.product.name[:25],
                npk,
                str(inv.quantity_on_hand),
                inv.unit,
                str(inv.reorder_point) if inv.reorder_point else 'N/A',
                inv.storage_location[:15] if inv.storage_location else '',
                'Yes' if inv.is_low_stock else 'No'
            ])

        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ]))

        story.append(table)
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"Snapshot as of: {datetime.now().strftime('%Y-%m-%d')}", normal_style))

        return story

    def _build_phi_section(self, heading_style, normal_style) -> List:
        """Build the PHI compliance section."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors
        from api.models import PHIComplianceCheck

        story = []
        story.append(Paragraph("5. PHI Compliance Reports", heading_style))
        story.append(Spacer(1, 10))

        checks = PHIComplianceCheck.objects.filter(
            harvest__field__farm__company=self.company,
            harvest__harvest_date__gte=self.start_date,
            harvest__harvest_date__lte=self.end_date
        ).select_related('harvest', 'harvest__field').order_by('harvest__harvest_date')

        if self.farm_ids:
            checks = checks.filter(harvest__field__farm_id__in=self.farm_ids)

        if not checks.exists():
            story.append(Paragraph("No PHI compliance checks found for this period.", normal_style))
            return story

        data = [['Harvest Date', 'Field', 'Status', 'Applications Checked', 'Warnings', 'Safe Harvest Date']]

        for check in checks:
            data.append([
                str(check.harvest.harvest_date),
                check.harvest.field.name[:20] if check.harvest.field else '',
                check.get_status_display(),
                str(len(check.applications_checked)),
                str(len(check.warnings)),
                str(check.earliest_safe_harvest) if check.earliest_safe_harvest else 'N/A'
            ])

        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ]))

        story.append(table)

        # Summary
        compliant = checks.filter(status='compliant').count()
        warning = checks.filter(status='warning').count()
        non_compliant = checks.filter(status='non_compliant').count()

        story.append(Spacer(1, 10))
        story.append(Paragraph(
            f"Summary: {compliant} Compliant, {warning} Warnings, {non_compliant} Non-Compliant",
            normal_style
        ))

        return story

    def _build_harvest_section(self, heading_style, normal_style) -> List:
        """Build the harvest records section."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors
        from api.models import Harvest

        story = []
        story.append(Paragraph("6. Harvest Records", heading_style))
        story.append(Spacer(1, 10))

        harvests = Harvest.objects.filter(
            field__farm__company=self.company,
            harvest_date__gte=self.start_date,
            harvest_date__lte=self.end_date
        ).select_related('field', 'field__farm').order_by('harvest_date')

        if self.farm_ids:
            harvests = harvests.filter(field__farm_id__in=self.farm_ids)

        if not harvests.exists():
            story.append(Paragraph("No harvest records found for this period.", normal_style))
            return story

        data = [['Date', 'Farm', 'Field', 'Crop', 'Acres', 'Bins', 'Pick #']]

        for harvest in harvests:
            data.append([
                str(harvest.harvest_date),
                harvest.field.farm.name[:15] if harvest.field.farm else '',
                harvest.field.name[:15] if harvest.field else '',
                harvest.get_crop_variety_display()[:15],
                str(harvest.acres_harvested),
                str(harvest.total_bins),
                str(harvest.harvest_number)
            ])

        table = Table(data, repeatRows=1)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ]))

        story.append(table)
        story.append(Spacer(1, 10))

        total_bins = sum(h.total_bins for h in harvests)
        total_acres = sum(float(h.acres_harvested) for h in harvests)
        story.append(Paragraph(
            f"Total Harvests: {harvests.count()} | Total Bins: {total_bins} | Total Acres: {total_acres:.1f}",
            normal_style
        ))

        return story

    def _build_primus_audits_section(self, heading_style, normal_style) -> List:
        """Build Primus GFS Internal Audits section."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors
        from reportlab.lib.units import inch

        story = []
        story.append(Paragraph("Primus GFS Internal Audits", heading_style))
        story.append(Spacer(1, 0.2 * inch))

        try:
            from api.models.primusgfs import InternalAudit
            audits = InternalAudit.objects.filter(
                company=self.company,
                planned_date__range=[self.start_date, self.end_date]
            ).order_by('-planned_date')

            if audits.exists():
                data = [['Audit #', 'Title', 'Type', 'Date', 'Status', 'Score']]
                for audit in audits:
                    data.append([
                        audit.audit_number or '-',
                        (audit.title or '')[:40],
                        audit.get_audit_type_display() if hasattr(audit, 'get_audit_type_display') else (audit.audit_type or '-'),
                        str(audit.planned_date) if audit.planned_date else '-',
                        audit.get_status_display() if hasattr(audit, 'get_status_display') else (audit.status or '-'),
                        str(audit.overall_score) if audit.overall_score is not None else '-',
                    ])

                table = Table(data, colWidths=[1*inch, 2.5*inch, 1.2*inch, 1*inch, 1*inch, 0.8*inch])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0d9488')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0fdfa')]),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#99f6e4')),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('PADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(table)
            else:
                story.append(Paragraph("No internal audits found for the selected period.", normal_style))
        except Exception:
            story.append(Paragraph("Primus GFS audit data not available.", normal_style))

        return story

    def _build_primus_findings_section(self, heading_style, normal_style) -> List:
        """Build Primus GFS Open Findings / Non-Conformances section."""
        from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors
        from reportlab.lib.units import inch

        story = []
        story.append(Paragraph("Primus GFS Open Findings & Corrective Actions", heading_style))
        story.append(Spacer(1, 0.2 * inch))

        try:
            from api.models.primusgfs import AuditFinding
            findings = AuditFinding.objects.filter(
                audit__company=self.company,
                status__in=['open', 'in_progress']
            ).select_related('audit').order_by('audit__planned_date', 'id')

            if findings.exists():
                data = [['Audit', 'Finding', 'Severity', 'Status', 'Due Date']]
                for f in findings:
                    data.append([
                        (f.audit.audit_number or '') if f.audit else '-',
                        (f.description or '')[:50],
                        f.get_severity_display() if hasattr(f, 'get_severity_display') else (f.severity or '-'),
                        f.get_status_display() if hasattr(f, 'get_status_display') else (f.status or '-'),
                        str(f.due_date) if hasattr(f, 'due_date') and f.due_date else '-',
                    ])

                table = Table(data, colWidths=[1*inch, 2.8*inch, 1*inch, 1*inch, 0.8*inch])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dc2626')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#fef2f2')]),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#fecaca')),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('PADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(table)
                story.append(Spacer(1, 0.1 * inch))
                story.append(Paragraph(f"Total open/in-progress findings: {findings.count()}", normal_style))
            else:
                story.append(Paragraph("No open findings — all Primus GFS non-conformances resolved.", normal_style))
        except Exception:
            story.append(Paragraph("Primus GFS findings data not available.", normal_style))

        return story
