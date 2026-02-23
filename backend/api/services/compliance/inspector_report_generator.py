"""
Inspector-Ready Compliance Report Generator

Generates a consolidated PDF covering all compliance areas:
- Active licenses and certifications
- WPS training status
- PUR submission status
- PHI clearance per field
- Water test results (with GM/STV)
- FSMA assessment status
- Upcoming deadlines and active alerts

This is the single highest-value compliance feature - when an inspector
visits, the farmer can hand them one document.
"""

import io
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, Dict, Any, List

from django.db.models import Count, Q, Sum
from django.utils import timezone


class InspectorReportGenerator:
    """Generates a consolidated inspector-ready compliance PDF."""

    def __init__(self, company, farm_id=None):
        self.company = company
        self.farm_id = farm_id

    def generate_report_data(self) -> Dict[str, Any]:
        """
        Generate the full compliance report data structure.
        This can be returned as JSON or used to generate a PDF.
        """
        return {
            'generated_at': timezone.now().isoformat(),
            'company': {
                'name': self.company.name,
                'id': self.company.id,
            },
            'farm_filter': self.farm_id,
            'sections': {
                'licenses': self._get_license_section(),
                'wps_training': self._get_wps_section(),
                'pesticide_compliance': self._get_pesticide_section(),
                'phi_clearance': self._get_phi_section(),
                'water_testing': self._get_water_section(),
                'fsma_status': self._get_fsma_section(),
                'deadlines': self._get_deadline_section(),
                'alerts': self._get_alert_section(),
            },
            'overall_score': self._calculate_overall_score(),
        }

    def _get_license_section(self) -> Dict:
        from api.models import License

        licenses = License.objects.filter(company=self.company)
        today = date.today()

        active = licenses.filter(status='active')
        expiring = licenses.filter(status='expiring_soon')
        expired = licenses.filter(status='expired')

        items = []
        for lic in licenses.order_by('expiration_date'):
            items.append({
                'type': lic.get_license_type_display(),
                'number': lic.license_number,
                'holder': lic.holder_name,
                'issuing_authority': lic.issuing_authority,
                'expiration_date': lic.expiration_date.isoformat(),
                'status': lic.status,
                'days_until_expiration': lic.days_until_expiration,
                'is_valid': lic.is_valid,
            })

        return {
            'summary': {
                'total': licenses.count(),
                'active': active.count(),
                'expiring_soon': expiring.count(),
                'expired': expired.count(),
            },
            'compliant': expired.count() == 0,
            'items': items,
        }

    def _get_wps_section(self) -> Dict:
        from api.models import WPSTrainingRecord

        today = date.today()
        records = WPSTrainingRecord.objects.filter(company=self.company)

        valid = records.filter(expiration_date__gt=today)
        expiring = records.filter(
            expiration_date__gt=today,
            expiration_date__lte=today + timedelta(days=90)
        )
        expired = records.filter(expiration_date__lte=today)

        # Group by worker
        workers = {}
        for rec in records.order_by('trainee_name', '-training_date'):
            name = rec.trainee_name
            if name not in workers:
                workers[name] = {
                    'name': name,
                    'trainings': [],
                    'has_expired': False,
                }
            training_info = {
                'type': rec.get_training_type_display(),
                'training_date': rec.training_date.isoformat(),
                'expiration_date': rec.expiration_date.isoformat() if rec.expiration_date else None,
                'status': 'valid' if rec.expiration_date and rec.expiration_date > today else 'expired',
            }
            workers[name]['trainings'].append(training_info)
            if rec.expiration_date and rec.expiration_date <= today:
                workers[name]['has_expired'] = True

        return {
            'summary': {
                'total_records': records.count(),
                'valid': valid.count(),
                'expiring_soon': expiring.count(),
                'expired': expired.count(),
                'unique_workers': len(workers),
            },
            'compliant': expired.count() == 0,
            'workers': list(workers.values()),
        }

    def _get_pesticide_section(self) -> Dict:
        from api.models import PesticideApplication

        today = date.today()
        year_start = date(today.year, 1, 1)

        apps = PesticideApplication.objects.filter(
            field__farm__company=self.company,
            application_date__gte=year_start,
        )
        if self.farm_id:
            apps = apps.filter(field__farm_id=self.farm_id)

        apps = apps.select_related('product', 'field', 'field__farm')

        total = apps.count()
        submitted = apps.filter(submitted_to_pur=True).count()
        pending = apps.filter(status='pending_signature').count()
        restricted = apps.filter(product__restricted_use=True).count()

        # Check for missing applicator license on restricted use
        restricted_missing_license = apps.filter(
            product__restricted_use=True,
        ).filter(
            Q(applicator_license_no='') | Q(applicator_license_no__isnull=True)
        ).count()

        items = []
        for app in apps.order_by('-application_date')[:50]:
            items.append({
                'date': app.application_date.isoformat(),
                'farm': app.field.farm.name if app.field and app.field.farm else '',
                'field': app.field.name if app.field else '',
                'product': app.product.product_name if app.product else '',
                'acres': float(app.acres_treated) if app.acres_treated else 0,
                'status': app.status,
                'submitted_to_pur': app.submitted_to_pur,
                'restricted_use': app.product.restricted_use if app.product else False,
                'has_license': bool(app.applicator_license_no),
            })

        return {
            'summary': {
                'total_applications': total,
                'submitted_to_pur': submitted,
                'pending_signature': pending,
                'restricted_use': restricted,
                'restricted_missing_license': restricted_missing_license,
                'pur_submission_rate': round(submitted / total * 100, 1) if total > 0 else 100,
            },
            'compliant': pending == 0 and restricted_missing_license == 0,
            'items': items,
        }

    def _get_phi_section(self) -> Dict:
        from api.models import Field, PesticideApplication

        today = date.today()

        fields = Field.objects.filter(farm__company=self.company)
        if self.farm_id:
            fields = fields.filter(farm_id=self.farm_id)

        fields = fields.select_related('farm')

        field_status = []
        blocking_count = 0

        for field in fields:
            # Get all recent applications with PHI
            apps = PesticideApplication.objects.filter(
                field=field,
                application_date__gte=today - timedelta(days=365),
            ).select_related('product').order_by('-application_date')

            worst_clear_date = None
            blocking_product = None

            for app in apps:
                if app.product and app.product.phi_days:
                    clear_date = app.application_date + timedelta(days=app.product.phi_days)
                    if worst_clear_date is None or clear_date > worst_clear_date:
                        worst_clear_date = clear_date
                        blocking_product = app.product.product_name

            is_clear = worst_clear_date is None or worst_clear_date <= today

            if not is_clear:
                blocking_count += 1

            field_status.append({
                'farm': field.farm.name,
                'field': field.name,
                'is_clear': is_clear,
                'clear_date': worst_clear_date.isoformat() if worst_clear_date else None,
                'days_until_clear': (worst_clear_date - today).days if worst_clear_date and worst_clear_date > today else 0,
                'blocking_product': blocking_product if not is_clear else None,
            })

        return {
            'summary': {
                'total_fields': len(field_status),
                'clear_for_harvest': len(field_status) - blocking_count,
                'blocked': blocking_count,
            },
            'compliant': True,  # PHI blocking is informational, not a violation
            'fields': field_status,
        }

    def _get_water_section(self) -> Dict:
        from api.models import WaterSource, WaterTest
        import math

        sources = WaterSource.objects.filter(farm__company=self.company)
        if self.farm_id:
            sources = sources.filter(farm_id=self.farm_id)

        source_data = []
        any_failed = False
        any_overdue = False

        for source in sources:
            tests = WaterTest.objects.filter(
                water_source=source
            ).order_by('-test_date')

            latest_test = tests.first()

            # Calculate GM/STV from last 5+ E. coli results
            ecoli_tests = tests.filter(
                ecoli_result__isnull=False
            ).order_by('-test_date')[:20]

            ecoli_values = [float(t.ecoli_result) for t in ecoli_tests if t.ecoli_result is not None]

            gm = None
            stv = None
            gm_compliant = None
            stv_compliant = None

            if len(ecoli_values) >= 5:
                # Geometric mean: exp(mean(ln(x)))
                log_values = [math.log(max(v, 0.1)) for v in ecoli_values]
                gm = math.exp(sum(log_values) / len(log_values))
                gm_compliant = gm <= 126.0

                # STV: exp(mean(ln) + 0.6745 * std(ln))
                mean_ln = sum(log_values) / len(log_values)
                variance = sum((lv - mean_ln) ** 2 for lv in log_values) / (len(log_values) - 1)
                std_ln = math.sqrt(variance)
                stv = math.exp(mean_ln + 0.6745 * std_ln)
                stv_compliant = stv <= 410.0

            is_overdue = source.is_test_overdue() if hasattr(source, 'is_test_overdue') else False
            if is_overdue:
                any_overdue = True

            if latest_test and latest_test.status == 'fail':
                any_failed = True

            source_data.append({
                'name': source.name,
                'source_type': source.source_type,
                'farm': source.farm.name if source.farm else '',
                'latest_test_date': latest_test.test_date.isoformat() if latest_test else None,
                'latest_test_status': latest_test.status if latest_test else 'no_tests',
                'latest_ecoli': float(latest_test.ecoli_result) if latest_test and latest_test.ecoli_result else None,
                'sample_count': len(ecoli_values),
                'geometric_mean': round(gm, 2) if gm is not None else None,
                'gm_compliant': gm_compliant,
                'stv': round(stv, 2) if stv is not None else None,
                'stv_compliant': stv_compliant,
                'fsma_compliant': (gm_compliant and stv_compliant) if gm_compliant is not None else None,
                'is_test_overdue': is_overdue,
            })

        return {
            'summary': {
                'total_sources': len(source_data),
                'sources_with_gm_stv': sum(1 for s in source_data if s['geometric_mean'] is not None),
                'fsma_compliant': sum(1 for s in source_data if s['fsma_compliant'] is True),
                'fsma_non_compliant': sum(1 for s in source_data if s['fsma_compliant'] is False),
                'insufficient_samples': sum(1 for s in source_data if s['geometric_mean'] is None),
                'overdue_testing': sum(1 for s in source_data if s['is_test_overdue']),
                'failed_tests': sum(1 for s in source_data if s['latest_test_status'] == 'fail'),
            },
            'compliant': not any_failed and not any_overdue,
            'sources': source_data,
        }

    def _get_fsma_section(self) -> Dict:
        from api.models import (
            FSMAWaterAssessment, PHIComplianceCheck, FacilityLocation,
            FacilityCleaningLog
        )

        today = date.today()
        current_year = today.year

        # Water assessments
        assessments = FSMAWaterAssessment.objects.filter(company=self.company)
        current_assessments = assessments.filter(assessment_year=current_year)
        approved = current_assessments.filter(status='approved').count()
        total_assessments = current_assessments.count()

        # PHI checks
        phi_checks = PHIComplianceCheck.objects.filter(
            harvest__field__farm__company=self.company,
            created_at__year=current_year,
        )
        phi_issues = phi_checks.filter(
            status__in=['non_compliant', 'warning']
        ).count()

        # Cleaning compliance (today)
        facilities = FacilityLocation.objects.filter(
            company=self.company, is_active=True
        )
        daily_facilities = facilities.filter(cleaning_frequency='daily')
        cleaned_today = FacilityCleaningLog.objects.filter(
            facility__company=self.company,
            cleaning_date=today,
        ).values('facility').distinct().count()

        return {
            'summary': {
                'water_assessments_approved': approved,
                'water_assessments_total': total_assessments,
                'phi_issues': phi_issues,
                'facilities_total': daily_facilities.count(),
                'facilities_cleaned_today': cleaned_today,
            },
            'compliant': phi_issues == 0 and approved >= total_assessments,
        }

    def _get_deadline_section(self) -> Dict:
        from api.models import ComplianceDeadline

        today = date.today()
        deadlines = ComplianceDeadline.objects.filter(company=self.company)

        overdue = deadlines.filter(status='overdue')
        due_soon = deadlines.filter(status='due_soon')
        upcoming = deadlines.filter(
            status__in=['upcoming', 'due_soon'],
            due_date__lte=today + timedelta(days=30),
        ).order_by('due_date')

        items = []
        for d in upcoming[:20]:
            items.append({
                'name': d.name,
                'category': d.category,
                'regulation': d.regulation,
                'due_date': d.due_date.isoformat(),
                'status': d.status,
                'days_until_due': d.days_until_due,
                'priority': d.priority,
            })

        return {
            'summary': {
                'overdue': overdue.count(),
                'due_soon': due_soon.count(),
                'upcoming_30_days': upcoming.count(),
            },
            'compliant': overdue.count() == 0,
            'items': items,
        }

    def _get_alert_section(self) -> Dict:
        from api.models import ComplianceAlert

        alerts = ComplianceAlert.objects.filter(
            company=self.company,
            is_active=True,
        ).order_by('-priority', '-created_at')

        by_priority = {
            'critical': alerts.filter(priority='critical').count(),
            'high': alerts.filter(priority='high').count(),
            'medium': alerts.filter(priority='medium').count(),
            'low': alerts.filter(priority='low').count(),
        }

        items = []
        for a in alerts[:20]:
            items.append({
                'type': a.alert_type,
                'priority': a.priority,
                'message': a.message,
                'created_at': a.created_at.isoformat(),
            })

        return {
            'summary': {
                'total_active': alerts.count(),
                'by_priority': by_priority,
            },
            'items': items,
        }

    def _calculate_overall_score(self) -> int:
        """Calculate an overall compliance score (0-100)."""
        from api.models import (
            License, WPSTrainingRecord, ComplianceDeadline,
            PesticideApplication
        )

        score = 100
        today = date.today()

        # Expired licenses: -15 each (max -45)
        expired_licenses = License.objects.filter(
            company=self.company, status='expired'
        ).count()
        score -= min(expired_licenses * 15, 45)

        # Expired WPS training: -5 each (max -25)
        expired_training = WPSTrainingRecord.objects.filter(
            company=self.company, expiration_date__lte=today
        ).count()
        score -= min(expired_training * 5, 25)

        # Overdue deadlines: -10 each (max -30)
        overdue_deadlines = ComplianceDeadline.objects.filter(
            company=self.company, status='overdue'
        ).count()
        score -= min(overdue_deadlines * 10, 30)

        # Pending PUR submissions older than 30 days: -5 each (max -20)
        old_pending = PesticideApplication.objects.filter(
            field__farm__company=self.company,
            status='pending_signature',
            application_date__lte=today - timedelta(days=30),
        ).count()
        score -= min(old_pending * 5, 20)

        return max(0, score)

    def generate_pdf(self) -> io.BytesIO:
        """Generate the inspector report as a PDF."""
        data = self.generate_report_data()
        buffer = io.BytesIO()

        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import inch
            from reportlab.lib import colors
            from reportlab.platypus import (
                SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                PageBreak
            )

            doc = SimpleDocTemplate(buffer, pagesize=letter,
                                    topMargin=0.75*inch, bottomMargin=0.75*inch)
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle('Title', parent=styles['Title'], fontSize=18)
            heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=14,
                                           spaceAfter=6)
            normal_style = styles['Normal']

            elements = []

            # Cover page
            elements.append(Paragraph(f"Compliance Report", title_style))
            elements.append(Spacer(1, 12))
            elements.append(Paragraph(f"<b>{data['company']['name']}</b>", normal_style))
            elements.append(Paragraph(f"Generated: {date.today().strftime('%B %d, %Y')}", normal_style))
            elements.append(Paragraph(f"Overall Score: {data['overall_score']}/100", normal_style))
            elements.append(Spacer(1, 24))

            # Licenses section
            lic = data['sections']['licenses']
            elements.append(Paragraph("Licenses & Certifications", heading_style))
            status_text = "COMPLIANT" if lic['compliant'] else "NON-COMPLIANT"
            elements.append(Paragraph(f"Status: <b>{status_text}</b> | Active: {lic['summary']['active']} | "
                                       f"Expiring: {lic['summary']['expiring_soon']} | Expired: {lic['summary']['expired']}", normal_style))

            if lic['items']:
                table_data = [['Type', 'Number', 'Holder', 'Expires', 'Status']]
                for item in lic['items']:
                    table_data.append([
                        item['type'][:30], item['number'], item['holder'][:20],
                        item['expiration_date'], item['status'].upper()
                    ])
                t = Table(table_data, colWidths=[2*inch, 1.2*inch, 1.5*inch, 1*inch, 0.8*inch])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ]))
                elements.append(t)
            elements.append(Spacer(1, 12))

            # WPS Training section
            wps = data['sections']['wps_training']
            elements.append(Paragraph("WPS Training Records", heading_style))
            status_text = "COMPLIANT" if wps['compliant'] else "NON-COMPLIANT"
            elements.append(Paragraph(
                f"Status: <b>{status_text}</b> | Workers: {wps['summary']['unique_workers']} | "
                f"Valid: {wps['summary']['valid']} | Expired: {wps['summary']['expired']}", normal_style))
            elements.append(Spacer(1, 12))

            # Pesticide section
            pest = data['sections']['pesticide_compliance']
            elements.append(Paragraph("Pesticide Use Reporting (PUR)", heading_style))
            elements.append(Paragraph(
                f"Applications YTD: {pest['summary']['total_applications']} | "
                f"Submitted: {pest['summary']['submitted_to_pur']} | "
                f"Pending: {pest['summary']['pending_signature']} | "
                f"PUR Rate: {pest['summary']['pur_submission_rate']}%", normal_style))
            if pest['summary']['restricted_missing_license'] > 0:
                elements.append(Paragraph(
                    f"<b>WARNING:</b> {pest['summary']['restricted_missing_license']} restricted use "
                    f"applications missing applicator license number", normal_style))
            elements.append(Spacer(1, 12))

            # PHI section
            phi = data['sections']['phi_clearance']
            elements.append(Paragraph("Pre-Harvest Interval (PHI) Status", heading_style))
            elements.append(Paragraph(
                f"Fields: {phi['summary']['total_fields']} | "
                f"Clear: {phi['summary']['clear_for_harvest']} | "
                f"Blocked: {phi['summary']['blocked']}", normal_style))

            blocked_fields = [f for f in phi['fields'] if not f['is_clear']]
            if blocked_fields:
                table_data = [['Farm', 'Field', 'Clear Date', 'Days', 'Product']]
                for f in blocked_fields:
                    table_data.append([
                        f['farm'], f['field'], f['clear_date'] or '',
                        str(f['days_until_clear']), f['blocking_product'] or ''
                    ])
                t = Table(table_data, colWidths=[1.3*inch, 1.3*inch, 1.2*inch, 0.6*inch, 2.1*inch])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ]))
                elements.append(t)
            elements.append(Spacer(1, 12))

            # Water section
            water = data['sections']['water_testing']
            elements.append(Paragraph("Water Quality Testing (FSMA)", heading_style))
            elements.append(Paragraph(
                f"Sources: {water['summary']['total_sources']} | "
                f"FSMA Compliant (GM/STV): {water['summary']['fsma_compliant']} | "
                f"Non-compliant: {water['summary']['fsma_non_compliant']} | "
                f"Insufficient samples: {water['summary']['insufficient_samples']}", normal_style))

            if water['sources']:
                table_data = [['Source', 'Type', 'Last Test', 'GM', 'STV', 'FSMA']]
                for s in water['sources']:
                    gm_str = f"{s['geometric_mean']}" if s['geometric_mean'] else 'N/A'
                    stv_str = f"{s['stv']}" if s['stv'] else 'N/A'
                    fsma_str = 'PASS' if s['fsma_compliant'] is True else ('FAIL' if s['fsma_compliant'] is False else 'Need data')
                    table_data.append([
                        s['name'][:25], s['source_type'], s['latest_test_date'] or 'None',
                        gm_str, stv_str, fsma_str
                    ])
                t = Table(table_data, colWidths=[1.8*inch, 0.8*inch, 1*inch, 0.8*inch, 0.8*inch, 1.3*inch])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ]))
                elements.append(t)
            elements.append(Spacer(1, 12))

            # Deadlines section
            dl = data['sections']['deadlines']
            elements.append(Paragraph("Upcoming Deadlines", heading_style))
            elements.append(Paragraph(
                f"Overdue: {dl['summary']['overdue']} | Due Soon: {dl['summary']['due_soon']} | "
                f"Next 30 Days: {dl['summary']['upcoming_30_days']}", normal_style))
            elements.append(Spacer(1, 12))

            doc.build(elements)

        except ImportError:
            # Fallback: generate a simple text-based report
            lines = []
            lines.append(f"COMPLIANCE REPORT - {data['company']['name']}")
            lines.append(f"Generated: {date.today().isoformat()}")
            lines.append(f"Overall Score: {data['overall_score']}/100")
            lines.append("=" * 60)

            for section_name, section in data['sections'].items():
                lines.append(f"\n--- {section_name.upper().replace('_', ' ')} ---")
                if 'summary' in section:
                    for k, v in section['summary'].items():
                        lines.append(f"  {k}: {v}")
                compliant = section.get('compliant')
                if compliant is not None:
                    lines.append(f"  Status: {'COMPLIANT' if compliant else 'NON-COMPLIANT'}")

            content = '\n'.join(lines)
            buffer.write(content.encode('utf-8'))

        buffer.seek(0)
        return buffer
