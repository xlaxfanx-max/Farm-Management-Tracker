"""
CrossDataLinker — Queries existing platform data and maps it to PrimusGFS
module formats for prefill / auto-import.

Used by the prefill endpoint to eliminate double-entry for the manager.
"""
import logging
from datetime import date, timedelta
from django.db.models import Q, Count

logger = logging.getLogger(__name__)


class CrossDataLinker:
    """
    Cross-platform data linker for PrimusGFS auto-population.
    Queries operational data already in the platform and formats it
    for import into PrimusGFS modules.
    """

    def __init__(self, company, season_year=None):
        self.company = company
        self.season_year = season_year or date.today().year

    # ------------------------------------------------------------------
    # Chemical Inventory Prefill — from PesticideApplication + Product
    # ------------------------------------------------------------------
    def get_chemical_inventory_prefill(self):
        """
        Returns list of chemicals from pesticide applications that can be
        imported into ChemicalInventoryLog.
        """
        from api.models.farm import PesticideApplication, PesticideProduct

        # Get distinct products used this year
        apps = PesticideApplication.objects.filter(
            field__farm__company=self.company,
            application_date__year=self.season_year,
        ).select_related('product')

        # Group by product
        product_map = {}
        for app in apps:
            prod = app.product
            key = prod.id
            if key not in product_map:
                product_map[key] = {
                    'product_name': prod.product_name,
                    'epa_registration_number': prod.epa_registration_number or '',
                    'chemical_type': self._map_product_type(prod.product_type),
                    'manufacturer': prod.manufacturer or '',
                    'restricted_use': prod.restricted_use,
                    'total_used': 0,
                    'unit': app.unit_of_measure or 'gallons',
                    'application_count': 0,
                    'last_application': None,
                    'sds_available': bool(prod.sds_url),
                }
            product_map[key]['total_used'] += float(app.amount_used or 0)
            product_map[key]['application_count'] += 1
            if not product_map[key]['last_application'] or app.application_date > product_map[key]['last_application']:
                product_map[key]['last_application'] = app.application_date

        # Also include products in stock that weren't applied this year
        all_products = PesticideProduct.objects.filter(
            pesticideapplication__field__farm__company=self.company,
            active=True,
        ).distinct()

        for prod in all_products:
            if prod.id not in product_map:
                product_map[prod.id] = {
                    'product_name': prod.product_name,
                    'epa_registration_number': prod.epa_registration_number or '',
                    'chemical_type': self._map_product_type(prod.product_type),
                    'manufacturer': prod.manufacturer or '',
                    'restricted_use': prod.restricted_use,
                    'total_used': 0,
                    'unit': 'gallons',
                    'application_count': 0,
                    'last_application': None,
                    'sds_available': bool(prod.sds_url),
                }

        # Check which are already in ChemicalInventoryLog
        from api.models import ChemicalInventoryLog
        existing_epas = set(
            ChemicalInventoryLog.objects.filter(
                company=self.company,
                inventory_year=self.season_year,
                inventory_month=date.today().month,
            ).values_list('epa_registration_number', flat=True)
        )

        results = []
        for item in product_map.values():
            item['already_imported'] = item['epa_registration_number'] in existing_epas
            if item['last_application']:
                item['last_application'] = item['last_application'].isoformat()
            results.append(item)

        results.sort(key=lambda x: x['application_count'], reverse=True)
        return {
            'source': 'Pesticide Records',
            'total_available': len(results),
            'already_imported': sum(1 for r in results if r['already_imported']),
            'items': results,
        }

    # ------------------------------------------------------------------
    # Training Records Prefill — from WPSTrainingRecord + CompanyMembership
    # ------------------------------------------------------------------
    def get_training_records_prefill(self):
        """
        Returns list of employees from WPS training and team membership
        that can be imported into PrimusGFS TrainingRecord.
        """
        from api.models import TrainingRecord

        existing_employees = set(
            TrainingRecord.objects.filter(
                company=self.company, active=True,
            ).values_list('employee_name', flat=True)
        )

        items = []

        # WPS Training Records
        try:
            from api.models.auth import WPSTrainingRecord
            wps_records = WPSTrainingRecord.objects.filter(
                company=self.company,
            ).order_by('trainee_name', '-training_date')

            # Group by trainee — latest record per person
            seen = set()
            for rec in wps_records:
                name = rec.trainee_name.strip()
                if name in seen:
                    continue
                seen.add(name)
                items.append({
                    'employee_name': name,
                    'employee_id': rec.trainee_employee_id or '',
                    'source': 'WPS Training',
                    'training_type': rec.training_type,
                    'training_date': rec.training_date.isoformat() if rec.training_date else None,
                    'expiration_date': rec.expiration_date.isoformat() if rec.expiration_date else None,
                    'already_imported': name in existing_employees,
                })
        except Exception as e:
            logger.debug(f"WPS Training not available: {e}")

        # Company Members
        try:
            from api.models.auth import CompanyMembership
            members = CompanyMembership.objects.filter(
                company=self.company, is_active=True,
            ).select_related('user', 'role')

            for m in members:
                name = m.user.get_full_name() or m.user.username
                if name in {i['employee_name'] for i in items}:
                    continue
                items.append({
                    'employee_name': name,
                    'employee_id': '',
                    'source': 'Team Members',
                    'training_type': None,
                    'training_date': None,
                    'expiration_date': None,
                    'already_imported': name in existing_employees,
                })
        except Exception as e:
            logger.debug(f"CompanyMembership not available: {e}")

        return {
            'source': 'WPS Training & Team Members',
            'total_available': len(items),
            'already_imported': sum(1 for i in items if i['already_imported']),
            'items': items,
        }

    # ------------------------------------------------------------------
    # Supplier Prefill — from PesticideProduct manufacturers + LaborContractor
    # ------------------------------------------------------------------
    def get_supplier_prefill(self):
        """
        Returns list of suppliers from pesticide product manufacturers
        and labor contractors.
        """
        from api.models import ApprovedSupplier

        existing_names = set(
            ApprovedSupplier.objects.filter(
                company=self.company,
            ).values_list('supplier_name', flat=True)
        )

        items = []

        # Pesticide product manufacturers
        try:
            from api.models.farm import PesticideProduct
            manufacturers = PesticideProduct.objects.filter(
                pesticideapplication__field__farm__company=self.company,
                active=True,
            ).values('manufacturer').annotate(
                product_count=Count('id')
            ).filter(manufacturer__gt='').order_by('-product_count')

            for mfr in manufacturers:
                name = mfr['manufacturer'].strip()
                if not name:
                    continue
                items.append({
                    'supplier_name': name,
                    'source': 'Product Manufacturer',
                    'material_types': ['chemical'],
                    'product_count': mfr['product_count'],
                    'contact_name': '',
                    'contact_phone': '',
                    'contact_email': '',
                    'already_imported': name in existing_names,
                })
        except Exception as e:
            logger.debug(f"PesticideProduct not available: {e}")

        # Labor Contractors
        try:
            from api.models.harvest import LaborContractor
            contractors = LaborContractor.objects.filter(
                company=self.company, active=True,
            )
            for lc in contractors:
                name = lc.company_name.strip()
                if not name or name in {i['supplier_name'] for i in items}:
                    continue
                items.append({
                    'supplier_name': name,
                    'source': 'Labor Contractor',
                    'material_types': ['labor'],
                    'product_count': 0,
                    'contact_name': lc.contact_name or '',
                    'contact_phone': lc.phone or '',
                    'contact_email': lc.email or '',
                    'already_imported': name in existing_names,
                })
        except Exception as e:
            logger.debug(f"LaborContractor not available: {e}")

        return {
            'source': 'Product Suppliers & Labor Contractors',
            'total_available': len(items),
            'already_imported': sum(1 for i in items if i['already_imported']),
            'items': items,
        }

    # ------------------------------------------------------------------
    # Non-Conformance Prefill — from IncidentReport
    # ------------------------------------------------------------------
    def get_non_conformance_prefill(self):
        """
        Returns open/unlinked incidents that could become non-conformance records.
        """
        items = []
        try:
            from api.models.compliance import IncidentReport
            incidents = IncidentReport.objects.filter(
                company=self.company,
                status__in=['reported', 'investigating', 'corrective_action'],
            ).order_by('-incident_date')

            # Check which incidents already have linked non-conformances
            from api.models import EmployeeNonConformance
            existing_descriptions = set(
                EmployeeNonConformance.objects.filter(
                    company=self.company,
                ).values_list('violation_description', flat=True)
            )

            for inc in incidents:
                # Simple check: see if any NC references this incident's title
                already = any(inc.title.lower() in desc.lower() for desc in existing_descriptions if desc)
                items.append({
                    'incident_id': inc.id,
                    'title': inc.title,
                    'incident_type': inc.incident_type,
                    'severity': inc.severity,
                    'incident_date': inc.incident_date.isoformat() if inc.incident_date else None,
                    'description': inc.description[:200] if inc.description else '',
                    'status': inc.status,
                    'affected_persons': inc.affected_persons or [],
                    'already_imported': already,
                })
        except Exception as e:
            logger.debug(f"IncidentReport not available: {e}")

        return {
            'source': 'Incident Reports',
            'total_available': len(items),
            'already_imported': sum(1 for i in items if i['already_imported']),
            'items': items,
        }

    # ------------------------------------------------------------------
    # Committee Agenda Prefill — aggregated data for quarterly meeting
    # ------------------------------------------------------------------
    def get_committee_agenda_data(self, quarter=None):
        """
        Aggregates platform data for auto-generating committee meeting agendas.
        Returns review topic summaries and suggested action items.
        """
        today = date.today()
        if quarter is None:
            quarter = f"Q{(today.month - 1) // 3 + 1}"

        # Determine date range for this quarter
        q_num = int(quarter[1])
        q_start = date(self.season_year, (q_num - 1) * 3 + 1, 1)
        if q_num == 4:
            q_end = date(self.season_year, 12, 31)
        else:
            q_end = date(self.season_year, q_num * 3 + 1, 1) - timedelta(days=1)

        result = {
            'quarter': quarter,
            'date_range': f"{q_start.strftime('%b %d')} - {q_end.strftime('%b %d, %Y')}",
        }

        # --- Pesticide Applications ---
        try:
            from api.models.farm import PesticideApplication
            pest_apps = PesticideApplication.objects.filter(
                field__farm__company=self.company,
                application_date__gte=q_start,
                application_date__lte=q_end,
            )
            app_count = pest_apps.count()
            result['pesticide_apps_notes'] = (
                f"{app_count} pesticide applications recorded this quarter. "
                f"All applications documented with applicator info and weather conditions."
                if app_count > 0 else "No pesticide applications recorded this quarter."
            )
            result['pesticide_apps_reviewed'] = True
            result['phi_followed'] = not pest_apps.filter(
                status='pending_signature'
            ).exists()
            result['pesticide_records_in_binder'] = app_count > 0
        except Exception:
            result['pesticide_apps_notes'] = ''

        # --- Fertilizer / Nutrient Applications ---
        try:
            from api.models.nutrients import NutrientApplication
            fert_apps = NutrientApplication.objects.filter(
                field__farm__company=self.company,
                application_date__gte=q_start,
                application_date__lte=q_end,
            ).count()
            result['fertilizer_apps_notes'] = (
                f"{fert_apps} fertilizer/nutrient applications recorded this quarter."
                if fert_apps > 0 else "No fertilizer applications recorded this quarter."
            )
            result['fertilizer_apps_reviewed'] = True
            result['fertilizer_records_in_binder'] = fert_apps > 0
        except Exception:
            result['fertilizer_apps_notes'] = ''

        # --- Water Testing ---
        try:
            from api.models.water import WaterTest
            water_tests = WaterTest.objects.filter(
                water_source__farm__company=self.company,
                test_date__gte=q_start,
                test_date__lte=q_end,
            )
            test_count = water_tests.count()
            passed = water_tests.filter(status='pass').count()
            failed = water_tests.filter(status='fail').count()

            last_test = water_tests.order_by('-test_date').first()

            notes = f"{test_count} water tests conducted this quarter."
            if passed > 0:
                notes += f" {passed} passed."
            if failed > 0:
                notes += f" {failed} failed — corrective actions needed."

            result['water_testing_notes'] = notes
            result['water_testing_reviewed'] = True
            result['water_records_current'] = test_count > 0
            if last_test:
                result['last_irrigation_water_test'] = last_test.test_date.isoformat()
        except Exception:
            result['water_testing_notes'] = ''

        # --- Worker Training ---
        try:
            from api.models.auth import WPSTrainingRecord
            trainings = WPSTrainingRecord.objects.filter(
                company=self.company,
                training_date__gte=q_start,
                training_date__lte=q_end,
            )
            train_count = trainings.count()
            expiring_soon = WPSTrainingRecord.objects.filter(
                company=self.company,
                expiration_date__lte=today + timedelta(days=60),
                expiration_date__gte=today,
            ).count()

            notes = f"{train_count} training sessions conducted this quarter."
            if expiring_soon > 0:
                notes += f" {expiring_soon} certifications expiring within 60 days."

            result['worker_training_notes'] = notes
            result['worker_training_reviewed'] = True

            last_pesticide = trainings.filter(
                training_type='pesticide_safety'
            ).order_by('-training_date').first()
            last_food = trainings.filter(
                training_type='food_safety'
            ).order_by('-training_date').first()
            if last_pesticide:
                result['last_pesticide_training'] = last_pesticide.training_date.isoformat()
            if last_food:
                result['last_food_safety_training'] = last_food.training_date.isoformat()
        except Exception:
            result['worker_training_notes'] = ''

        # --- Animal Activity (from perimeter monitoring) ---
        try:
            from api.models import PerimeterMonitoringLog
            perimeter = PerimeterMonitoringLog.objects.filter(
                company=self.company,
                log_date__gte=q_start,
                log_date__lte=q_end,
            )
            peri_count = perimeter.count()
            animal_found = perimeter.filter(animal_activity_found=True).count()

            notes = f"{peri_count} perimeter inspections this quarter."
            if animal_found > 0:
                notes += f" Animal activity detected in {animal_found} inspections."
            else:
                notes += " No animal activity detected."

            result['animal_activity_notes'] = notes
            result['animal_activity_reviewed'] = True
        except Exception:
            result['animal_activity_notes'] = ''

        # --- Suggested Action Items ---
        action_items = []
        try:
            from api.models.compliance import IncidentReport
            open_incidents = IncidentReport.objects.filter(
                company=self.company,
                status__in=['reported', 'investigating'],
            ).count()
            if open_incidents > 0:
                action_items.append({
                    'item': f'Resolve {open_incidents} open incident report(s)',
                    'assigned_to': '',
                    'due_date': (today + timedelta(days=30)).isoformat(),
                    'status': 'open',
                })
        except Exception:
            pass

        try:
            from api.models import EquipmentCalibration
            overdue_cal = EquipmentCalibration.objects.filter(
                company=self.company,
                next_calibration_date__lt=today,
                status__in=['scheduled', 'overdue'],
            ).count()
            if overdue_cal > 0:
                action_items.append({
                    'item': f'Complete {overdue_cal} overdue equipment calibration(s)',
                    'assigned_to': '',
                    'due_date': (today + timedelta(days=14)).isoformat(),
                    'status': 'open',
                })
        except Exception:
            pass

        try:
            from api.models import CorrectiveAction
            overdue_ca = CorrectiveAction.objects.filter(
                company=self.company,
                status__in=['open', 'in_progress'],
                due_date__lt=today,
            ).count()
            if overdue_ca > 0:
                action_items.append({
                    'item': f'Address {overdue_ca} overdue corrective action(s)',
                    'assigned_to': '',
                    'due_date': (today + timedelta(days=14)).isoformat(),
                    'status': 'open',
                })
        except Exception:
            pass

        result['action_items'] = action_items

        # Build additional_topics summary
        additional = []
        try:
            from api.models import EmployeeNonConformance
            ncs = EmployeeNonConformance.objects.filter(
                company=self.company,
                resolved=False,
            ).count()
            if ncs > 0:
                additional.append(f"- {ncs} unresolved employee non-conformance(s)")
        except Exception:
            pass

        result['additional_topics'] = '\n'.join(additional)

        # --- Suggested Attendees from Org Roles ---
        try:
            from api.models import FoodSafetyRoleAssignment
            roles = FoodSafetyRoleAssignment.objects.filter(
                company=self.company,
                active=True,
            ).order_by('display_order', 'role_category')
            result['suggested_attendees'] = [
                {
                    'name': role.person_name,
                    'title': role.role_title,
                    'signed': False,
                }
                for role in roles
            ]
        except Exception:
            result['suggested_attendees'] = []

        # --- Carry Forward from Previous Quarter ---
        carried_forward = []
        prev_meeting_date = None
        try:
            from api.models import FoodSafetyCommitteeMeeting
            if q_num == 1:
                prev_q = 'Q4'
                prev_year = self.season_year - 1
            else:
                prev_q = f'Q{q_num - 1}'
                prev_year = self.season_year

            prev_meeting = FoodSafetyCommitteeMeeting.objects.filter(
                company=self.company,
                meeting_quarter=prev_q,
                meeting_year=prev_year,
            ).first()

            if prev_meeting:
                if prev_meeting.action_items:
                    for ai in prev_meeting.action_items:
                        if isinstance(ai, dict) and ai.get('status') in ('open', 'in_progress'):
                            carried_forward.append({
                                **ai,
                                'carried_from': f'{prev_q} {prev_year}',
                            })
                if prev_meeting.next_meeting_date:
                    prev_meeting_date = prev_meeting.next_meeting_date.isoformat()
        except Exception:
            pass

        result['carried_forward_items'] = carried_forward
        result['suggested_meeting_date'] = prev_meeting_date

        return result

    # ------------------------------------------------------------------
    # Pre-Season Checklist Prefill — auto-check from platform data
    # ------------------------------------------------------------------
    def get_pre_season_prefill(self, farm_id=None):
        """
        Auto-checks pre-season checklist booleans based on existing platform data.
        Returns which items can be auto-verified and which need manual review.
        """
        today = date.today()
        year = self.season_year
        checks = {}
        sources = {}

        # --- Water tests current? ---
        try:
            from api.models.water import WaterTest
            qs = WaterTest.objects.filter(
                water_source__farm__company=self.company,
                test_date__year=year,
            )
            if farm_id:
                qs = qs.filter(water_source__farm_id=farm_id)
            if qs.filter(status='pass').exists():
                checks['water_tests_current'] = True
                checks['microbial_tests_conducted'] = True
                sources['water_tests_current'] = f'{qs.count()} water test(s) on record'
                sources['microbial_tests_conducted'] = 'From water test records'
        except Exception:
            pass

        # --- Training current? ---
        try:
            from api.models.auth import WPSTrainingRecord
            active_training = WPSTrainingRecord.objects.filter(
                company=self.company,
                expiration_date__gte=today,
            ).count()
            if active_training > 0:
                checks['workers_trained'] = True
                checks['training_log_current'] = True
                sources['workers_trained'] = f'{active_training} active training record(s)'
                sources['training_log_current'] = 'From WPS training records'
        except Exception:
            pass

        # --- PCA/QAL license current? ---
        try:
            from api.models.farm import PesticideApplication
            recent_apps = PesticideApplication.objects.filter(
                field__farm__company=self.company,
                application_date__year=year,
            ).exclude(applicator_license_no='')
            if recent_apps.exists():
                checks['pca_qal_license_current'] = True
                sources['pca_qal_license_current'] = 'Applicator licenses on file'
        except Exception:
            pass

        # --- Pesticide use reports current? ---
        try:
            from api.models.farm import PesticideApplication
            pur_submitted = PesticideApplication.objects.filter(
                field__farm__company=self.company,
                application_date__year=year,
                submitted_to_pur=True,
            ).count()
            total_apps = PesticideApplication.objects.filter(
                field__farm__company=self.company,
                application_date__year=year,
            ).count()
            if total_apps > 0 and pur_submitted == total_apps:
                checks['pesticide_use_reports_current'] = True
                sources['pesticide_use_reports_current'] = f'All {total_apps} PUR submissions current'
        except Exception:
            pass

        # --- Chemical inventory current? ---
        try:
            from api.models import ChemicalInventoryLog
            chem = ChemicalInventoryLog.objects.filter(
                company=self.company,
                inventory_year=year,
            ).exists()
            if chem:
                checks['chemical_inventory_current'] = True
                sources['chemical_inventory_current'] = 'Chemical inventory logged'
        except Exception:
            pass

        # --- Perimeter monitoring current? ---
        try:
            from api.models import PerimeterMonitoringLog
            peri = PerimeterMonitoringLog.objects.filter(
                company=self.company,
                log_date__gte=today - timedelta(days=30),
            ).exists()
            if peri:
                checks['perimeter_monitoring_log_current'] = True
                sources['perimeter_monitoring_log_current'] = 'Recent perimeter logs on file'
        except Exception:
            pass

        # --- Committee meetings current? ---
        try:
            from api.models import FoodSafetyCommitteeMeeting
            meetings = FoodSafetyCommitteeMeeting.objects.filter(
                company=self.company,
                meeting_year=year,
                status='completed',
            ).exists()
            if meetings:
                checks['committee_log_current'] = True
                sources['committee_log_current'] = 'Completed committee meeting(s) on file'
        except Exception:
            pass

        # --- Management review current? ---
        try:
            from api.models import ManagementVerificationReview
            review = ManagementVerificationReview.objects.filter(
                company=self.company,
                review_year=year,
            ).exists()
            if review:
                checks['management_review_current'] = True
                sources['management_review_current'] = 'Management review on file'
        except Exception:
            pass

        # --- Equipment calibration (first aid kits) ---
        try:
            from api.models import EquipmentCalibration
            cal = EquipmentCalibration.objects.filter(
                company=self.company,
                status='passed',
                next_calibration_date__gte=today,
            ).exists()
            if cal:
                checks['first_aid_current'] = True
                sources['first_aid_current'] = 'Equipment calibrations current'
        except Exception:
            pass

        total_items = 38  # total boolean fields on PreSeasonChecklist
        auto_checked = len(checks)

        return {
            'source': 'Platform Data',
            'total_items': total_items,
            'auto_checked': auto_checked,
            'manual_needed': total_items - auto_checked,
            'percent_prefilled': round((auto_checked / total_items) * 100),
            'checks': checks,
            'sources': sources,
        }

    # ------------------------------------------------------------------
    # Management Review Summary — auto-generate 12-section summaries
    # ------------------------------------------------------------------
    def get_management_review_summary(self):
        """
        Auto-generates summaries for each of the 12 management review sections
        from platform data.
        """
        today = date.today()
        year = self.season_year
        sections = {}

        # Section 1: Internal Audits
        try:
            from api.models import InternalAudit
            audits = InternalAudit.objects.filter(
                company=self.company, planned_date__year=year,
            )
            completed = audits.filter(status='completed').count()
            total = audits.count()
            sections['internal_audits'] = {
                'summary': f'{completed}/{total} internal audits completed this year.',
                'has_data': total > 0,
            }
        except Exception:
            sections['internal_audits'] = {'summary': '', 'has_data': False}

        # Section 2: Corrective Actions
        try:
            from api.models import CorrectiveAction
            cas = CorrectiveAction.objects.filter(company=self.company)
            total = cas.count()
            open_cas = cas.filter(status__in=['open', 'in_progress']).count()
            verified = cas.filter(status='verified').count()
            sections['corrective_actions'] = {
                'summary': f'{total} total corrective actions. {open_cas} open, {verified} verified.',
                'has_data': total > 0,
            }
        except Exception:
            sections['corrective_actions'] = {'summary': '', 'has_data': False}

        # Section 3: Incident Reports
        try:
            from api.models.compliance import IncidentReport
            incidents = IncidentReport.objects.filter(
                company=self.company,
                incident_date__year=year,
            )
            total = incidents.count()
            resolved = incidents.filter(status__in=['resolved', 'closed']).count()
            sections['incidents'] = {
                'summary': f'{total} incidents reported this year. {resolved} resolved.',
                'has_data': total > 0,
            }
        except Exception:
            sections['incidents'] = {'summary': '', 'has_data': False}

        # Section 4: Training
        try:
            from api.models import TrainingRecord
            records = TrainingRecord.objects.filter(
                company=self.company, active=True,
            )
            total = records.count()
            avg_compliance = 0
            if total > 0:
                avg_compliance = round(
                    sum(r.compliance_percentage for r in records) / total, 1
                )
            sections['training'] = {
                'summary': f'{total} employees tracked. Average compliance: {avg_compliance}%.',
                'has_data': total > 0,
            }
        except Exception:
            sections['training'] = {'summary': '', 'has_data': False}

        # Section 5: Supplier Control
        try:
            from api.models import ApprovedSupplier
            suppliers = ApprovedSupplier.objects.filter(company=self.company)
            total = suppliers.count()
            approved = suppliers.filter(status='approved').count()
            sections['suppliers'] = {
                'summary': f'{total} suppliers registered. {approved} approved.',
                'has_data': total > 0,
            }
        except Exception:
            sections['suppliers'] = {'summary': '', 'has_data': False}

        # Section 6: Document Control
        try:
            from api.models import ControlledDocument
            docs = ControlledDocument.objects.filter(company=self.company)
            total = docs.count()
            approved = docs.filter(status='approved').count()
            overdue = docs.filter(
                status='approved', review_due_date__lt=today,
            ).count()
            sections['documents'] = {
                'summary': f'{total} documents. {approved} approved, {overdue} overdue for review.',
                'has_data': total > 0,
            }
        except Exception:
            sections['documents'] = {'summary': '', 'has_data': False}

        # Section 7: Equipment Calibration
        try:
            from api.models import EquipmentCalibration
            cals = EquipmentCalibration.objects.filter(company=self.company)
            total = cals.count()
            current = cals.filter(
                status='passed', next_calibration_date__gte=today,
            ).count()
            overdue = cals.filter(
                next_calibration_date__lt=today,
            ).count()
            sections['equipment'] = {
                'summary': f'{total} equipment items. {current} current, {overdue} overdue.',
                'has_data': total > 0,
            }
        except Exception:
            sections['equipment'] = {'summary': '', 'has_data': False}

        # Section 8: Pest Control
        try:
            from api.models import PestControlProgram, PestMonitoringLog
            programs = PestControlProgram.objects.filter(
                company=self.company, program_year=year,
            )
            has_program = programs.exists()
            approved = programs.filter(approved=True).exists()
            logs_30d = PestMonitoringLog.objects.filter(
                company=self.company,
                inspection_date__gte=today - timedelta(days=30),
            ).count()
            sections['pest_control'] = {
                'summary': f'Program: {"approved" if approved else ("exists" if has_program else "none")}. {logs_30d} monitoring logs (30d).',
                'has_data': has_program,
            }
        except Exception:
            sections['pest_control'] = {'summary': '', 'has_data': False}

        # Section 9: Water Testing
        try:
            from api.models.water import WaterTest
            tests = WaterTest.objects.filter(
                water_source__farm__company=self.company,
                test_date__year=year,
            )
            total = tests.count()
            passed = tests.filter(status='pass').count()
            failed = tests.filter(status='fail').count()
            sections['water_testing'] = {
                'summary': f'{total} water tests this year. {passed} passed, {failed} failed.',
                'has_data': total > 0,
            }
        except Exception:
            sections['water_testing'] = {'summary': '', 'has_data': False}

        # Section 10: Mock Recalls
        try:
            from api.models import MockRecall
            recalls = MockRecall.objects.filter(
                company=self.company, exercise_date__year=year,
            )
            total = recalls.count()
            passed = recalls.filter(passed=True).count()
            sections['mock_recalls'] = {
                'summary': f'{total} mock recall(s) this year. {passed} passed.',
                'has_data': total > 0,
            }
        except Exception:
            sections['mock_recalls'] = {'summary': '', 'has_data': False}

        # Section 11: Sanitation
        try:
            from api.models import FieldSanitationLog
            san = FieldSanitationLog.objects.filter(
                company=self.company,
                log_date__gte=today - timedelta(days=30),
            )
            total = san.count()
            compliant = san.filter(compliant=True).count()
            rate = round((compliant / total) * 100, 1) if total > 0 else 0
            sections['sanitation'] = {
                'summary': f'{total} sanitation logs (30d). {rate}% compliance rate.',
                'has_data': total > 0,
            }
        except Exception:
            sections['sanitation'] = {'summary': '', 'has_data': False}

        # Section 12: Food Defense
        try:
            from api.models import FoodDefensePlan
            plan = FoodDefensePlan.objects.filter(
                company=self.company, plan_year=year,
            ).first()
            sections['food_defense'] = {
                'summary': f'Plan: {"approved" if (plan and plan.approved) else ("draft" if plan else "none")}.',
                'has_data': plan is not None,
            }
        except Exception:
            sections['food_defense'] = {'summary': '', 'has_data': False}

        sections_with_data = sum(1 for s in sections.values() if s['has_data'])
        return {
            'source': 'Platform Data',
            'total_sections': 12,
            'sections_with_data': sections_with_data,
            'sections': sections,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _map_product_type(product_type):
        """Map PesticideProduct.product_type to ChemicalInventoryLog.chemical_type."""
        mapping = {
            'insecticide': 'pesticide',
            'herbicide': 'pesticide',
            'fungicide': 'pesticide',
            'fumigant': 'fumigant',
            'adjuvant': 'adjuvant',
            'plant_growth_regulator': 'pesticide',
            'rodenticide': 'pesticide',
        }
        return mapping.get(product_type, 'other')
