"""
CAC Food Safety Manual V5.0 — Data Mapper

Maps PrimusGFS Django model data to PDF form field names for the CAC Food
Safety Manual V5.0 fillable PDF (1077 fields across 37 pages).

Each ``get_docNN_fields()`` method queries the relevant Django model(s) and
returns a dict whose keys are *exact* PDF AcroForm field names (e.g.
``1-a-100``, ``4-a-CheckBox1``) and whose values are the strings or booleans
to write.

Usage::

    from api.services.primusgfs.cac_data_mapper import CACDataMapper

    mapper = CACDataMapper(company=company, farm=farm, season_year=2026)
    text_fields = mapper.get_all_fields()
    checkbox_fields = mapper.get_all_checkboxes()
"""

import logging
from datetime import date, datetime
from decimal import Decimal

logger = logging.getLogger(__name__)


# ============================================================================
# Constants
# ============================================================================

DOC_PAGE_MAP = {
    '01': [7, 9],
    '02': [11, 12],
    '03': [13],
    '04': [15, 16],
    '05': [17, 18, 19, 20],
    '06': [21],
    '09': [27],
    '09A': [29],
    '11': [35],
    '14': [43, 45],
    '15': [47],
    '17': [51],
    '18': [53],
    '19': [56],
    '20': [57],
    '21': [59],
    '22': [61],
    '23': [65],
    '24': [67],
    '26': [73],
    '28A': [83],
    '29': [85],
    '37': [109],
    '38': [113, 114],
    '39': [115, 116, 117, 118, 119, 120],
}

SIGNATURE_REQUIREMENTS = {
    '01': [
        {'page': 9, 'role': 'coordinator', 'label': 'Food Safety Coordinator'},
    ],
    '04': [
        {'page': 16, 'role': 'attendee', 'label': 'Committee Attendee', 'count': 10},
        {'page': 16, 'role': 'coordinator', 'label': 'Coordinator Sign-off'},
    ],
    '05': [
        {'page': 20, 'role': 'attendee', 'label': 'Review Attendee', 'count': 11},
        {'page': 20, 'role': 'coordinator', 'label': 'Coordinator Sign-off'},
    ],
    '09A': [
        {'page': 29, 'role': 'supervisor', 'label': 'Supervisor'},
        {'page': 29, 'role': 'employee', 'label': 'Employee'},
    ],
    '15': [
        {'page': 47, 'role': 'coordinator', 'label': 'Coordinator'},
    ],
    '17': [
        {'page': 51, 'role': 'coordinator', 'label': 'Coordinator'},
    ],
    '18': [
        {'page': 53, 'role': 'coordinator', 'label': 'Coordinator'},
    ],
    '19': [
        {'page': 56, 'role': 'coordinator', 'label': 'Coordinator'},
    ],
    '22': [
        {'page': 61, 'role': 'owner', 'label': 'Property Owner'},
    ],
    '37': [
        {'page': 109, 'role': 'attendee', 'label': 'Training Attendee', 'count': 18},
        {'page': 109, 'role': 'coordinator', 'label': 'Coordinator'},
    ],
    '39': [
        {'page': 120, 'role': 'assessor', 'label': 'Assessor'},
        {'page': 120, 'role': 'reviewer', 'label': 'Reviewer'},
    ],
}


# ============================================================================
# Helpers
# ============================================================================

def _fmt_date(d):
    """Format a date (or None) as MM/DD/YYYY string."""
    if d is None:
        return ''
    if isinstance(d, datetime):
        d = d.date()
    if isinstance(d, date):
        return d.strftime('%m/%d/%Y')
    return str(d)


def _fmt_time(t):
    """Format a time (or None) as HH:MM string."""
    if t is None:
        return ''
    if hasattr(t, 'strftime'):
        return t.strftime('%H:%M')
    return str(t)


def _fmt_decimal(val, places=2):
    """Format a Decimal or float to string."""
    if val is None:
        return ''
    if isinstance(val, Decimal):
        return str(round(float(val), places))
    return str(val)


def _fmt_bool(val):
    """Format a boolean as Yes/No string."""
    if val is None:
        return ''
    return 'Yes' if val else 'No'


def _fmt_json_list(val, key=None, separator=', '):
    """Format a JSON list field to a readable string."""
    if not val:
        return ''
    if isinstance(val, list):
        if key:
            return separator.join(str(item.get(key, '')) for item in val if isinstance(item, dict))
        return separator.join(str(item) for item in val)
    return str(val)


def _safe_str(val):
    """Return empty string for None, else str()."""
    if val is None:
        return ''
    return str(val)


def _get_first_or_none(qs):
    """Return first result from a queryset or None."""
    try:
        return qs.first()
    except Exception:
        return None


# ============================================================================
# Main Mapper
# ============================================================================

class CACDataMapper:
    """
    Maps Django model data to CAC Food Safety Manual V5.0 PDF field names.

    Args:
        company: The Company model instance.
        farm: Optional Farm instance (for farm-specific documents).
        season_year: Season year (defaults to current year).
    """

    def __init__(self, company, farm=None, season_year=None):
        self.company = company
        self.farm = farm
        self.season_year = season_year or date.today().year

    # ------------------------------------------------------------------
    # Lazy model imports (avoids circular import issues at module level)
    # ------------------------------------------------------------------
    # Role codename → food safety role title mapping
    ROLE_TO_FS_TITLE = {
        'owner': 'Owner / Grower',
        'admin': 'Administrator',
        'manager': 'Manager / Foreman',
        'applicator': 'Pesticide Applicator',
        'worker': 'Worker',
        'viewer': 'View Only',
        'pca': 'PCA / QAL',
        'accountant': 'Accountant',
    }

    @staticmethod
    def _get_models():
        """Import and return all needed model classes."""
        from api.models.primusgfs import (
            FoodSafetyProfile,
            FoodSafetyRoleAssignment,
            FoodSafetyCommitteeMeeting,
            ManagementVerificationReview,
            TrainingRecord,
            WorkerTrainingSession,
            CorrectiveAction,
            EmployeeNonConformance,
            ProductHoldRelease,
            ApprovedSupplier,
            SupplierVerificationLog,
            MockRecall,
            FoodFraudAssessment,
            FoodDefensePlan,
            EmergencyContact,
            LandHistoryAssessment,
            PerimeterMonitoringLog,
            ChemicalInventoryLog,
            EquipmentCalibration,
            PreSeasonChecklist,
            FieldRiskAssessment,
            SanitationMaintenanceLog,
        )
        from api.models.nutrients import NutrientApplication
        from api.models.farm import (
            PesticideApplication, PesticideProduct, Field,
        )
        from api.models.water import WaterTest, WaterSource
        from api.models.harvest import Harvest, HarvestLabor, LaborContractor
        from api.models.auth import CompanyMembership, Role
        return {
            'FoodSafetyProfile': FoodSafetyProfile,
            'FoodSafetyRoleAssignment': FoodSafetyRoleAssignment,
            'FoodSafetyCommitteeMeeting': FoodSafetyCommitteeMeeting,
            'ManagementVerificationReview': ManagementVerificationReview,
            'TrainingRecord': TrainingRecord,
            'WorkerTrainingSession': WorkerTrainingSession,
            'CorrectiveAction': CorrectiveAction,
            'EmployeeNonConformance': EmployeeNonConformance,
            'ProductHoldRelease': ProductHoldRelease,
            'ApprovedSupplier': ApprovedSupplier,
            'SupplierVerificationLog': SupplierVerificationLog,
            'MockRecall': MockRecall,
            'FoodFraudAssessment': FoodFraudAssessment,
            'FoodDefensePlan': FoodDefensePlan,
            'EmergencyContact': EmergencyContact,
            'LandHistoryAssessment': LandHistoryAssessment,
            'PerimeterMonitoringLog': PerimeterMonitoringLog,
            'ChemicalInventoryLog': ChemicalInventoryLog,
            'EquipmentCalibration': EquipmentCalibration,
            'PreSeasonChecklist': PreSeasonChecklist,
            'FieldRiskAssessment': FieldRiskAssessment,
            'SanitationMaintenanceLog': SanitationMaintenanceLog,
            'NutrientApplication': NutrientApplication,
            # Cross-data models for auto-population
            'PesticideApplication': PesticideApplication,
            'PesticideProduct': PesticideProduct,
            'Field': Field,
            'WaterTest': WaterTest,
            'WaterSource': WaterSource,
            'Harvest': Harvest,
            'HarvestLabor': HarvestLabor,
            'LaborContractor': LaborContractor,
            'CompanyMembership': CompanyMembership,
            'Role': Role,
        }

    # ==================================================================
    # Doc 01 — Ranch Info (Page 7) + Food Safety Policy (Page 9)
    # ==================================================================
    def get_doc01_fields(self):
        """
        Map FoodSafetyProfile + Company + Farm data to Doc 01 fields.

        Page 7 fields (1-a-100 through 1-a-112):
            100=Ranch Name, 101=Physical Address, 102=City, 103=State,
            104=Country, 105=APN/GPS, 106=Commodities,
            107=Number of planted acres, 108=Total planted acres,
            109=Food Safety Coordinator, 110=Phone Number,
            111=Alternate Coordinator, 112=Alternate Phone

        Page 9 fields (1-a-114 through 1-a-117):
            114=Company name, 115=Policy statement/signature name,
            116=Coordinator title, 117=Date Reviewed
        """
        models = self._get_models()
        profile = _get_first_or_none(
            models['FoodSafetyProfile'].objects.filter(company=self.company)
        )

        farm = self.farm
        fields = {}

        # Page 7 — Ranch Info
        farm_name = farm.name if farm else self.company.name
        fields['1-a-100'] = _safe_str(farm_name)
        fields['1-a-101'] = _safe_str(
            farm.address if farm else self.company.address
        )
        fields['1-a-102'] = _safe_str(self.company.city)
        fields['1-a-103'] = _safe_str(self.company.state)
        fields['1-a-104'] = 'USA'

        # GPS / APN
        gps_str = ''
        if farm and hasattr(farm, 'gps_latitude') and farm.gps_latitude:
            gps_str = f"{farm.gps_latitude}, {farm.gps_longitude}"
        fields['1-a-105'] = gps_str

        # Commodities
        commodities = ''
        if profile and profile.commodities_grown:
            commodities = _fmt_json_list(profile.commodities_grown)
        fields['1-a-106'] = commodities

        # Planted acres
        farm_fields_qs = None
        if farm:
            from api.models.farm import Field
            farm_fields_qs = Field.objects.filter(farm=farm)
            num_planted = farm_fields_qs.count()
            total_acres = sum(
                float(f.total_acres) for f in farm_fields_qs
                if f.total_acres
            )
        else:
            num_planted = 0
            total_acres = 0
            if profile and profile.total_planted_acres:
                total_acres = float(profile.total_planted_acres)

        fields['1-a-107'] = str(num_planted) if num_planted else ''
        fields['1-a-108'] = _fmt_decimal(total_acres) if total_acres else ''

        # Coordinator info
        fields['1-a-109'] = _safe_str(
            profile.coordinator_name if profile else ''
        )
        fields['1-a-110'] = _safe_str(
            profile.coordinator_phone if profile else ''
        )
        fields['1-a-111'] = _safe_str(
            profile.alternate_coordinator_name if profile else ''
        )
        fields['1-a-112'] = _safe_str(
            profile.alternate_coordinator_phone if profile else ''
        )

        # Page 9 — Food Safety Policy
        fields['1-a-114'] = _safe_str(self.company.name)
        fields['1-a-115'] = _safe_str(
            profile.policy_approved_by if profile else ''
        )
        fields['1-a-116'] = _safe_str(
            profile.policy_approved_title if profile else ''
        )
        fields['1-a-117'] = _fmt_date(
            profile.policy_reviewed_date if profile else None
        )

        return fields

    def get_doc01_checkboxes(self):
        """Doc 01 has no checkboxes."""
        return {}

    # ==================================================================
    # Doc 02 — Organizational Structure (Pages 11-12)
    # ==================================================================
    def _get_team_as_roles(self):
        """
        Fallback: derive org-chart rows from CompanyMembership when no
        FoodSafetyRoleAssignment records exist.  Returns a list of dicts
        with keys matching what the doc02 mapper expects.
        """
        models = self._get_models()
        memberships = list(
            models['CompanyMembership'].objects
            .filter(company=self.company, is_active=True)
            .select_related('user', 'role')
            .order_by('role__codename', 'user__last_name')
        )

        rows = []
        for m in memberships:
            user = m.user
            full_name = f"{user.first_name} {user.last_name}".strip() or user.email
            title = self.ROLE_TO_FS_TITLE.get(
                m.role.codename, m.role.name
            )
            rows.append({
                'role_title': title,
                'person_name': full_name,
                'alternate_name': '',
                'role_category': m.role.codename,
                'responsibilities': [],
            })
        return rows

    def get_doc02_fields(self):
        """
        Map FoodSafetyRoleAssignment data to Doc 02 fields.
        Falls back to CompanyMembership (team) data when no dedicated
        role assignments have been created.

        Page 11 fields (a21122-1 through a21122-19):
            a21122-1=Date, then role rows:
            a21122-2=Title1, a21122-3=Name1, a21122-4=Alternate1,
            a21122-5=Title2, a21122-6=Name2, a21122-7=Alternate2,
            ... through a21122-19

        Page 12 fields (a21122-20 through a21122-24):
            Additional "Other Worker" description fields.
        """
        models = self._get_models()
        roles = list(
            models['FoodSafetyRoleAssignment'].objects
            .filter(company=self.company, active=True)
            .order_by('display_order', 'role_category')
        )

        # Fallback: auto-populate from team if no role assignments exist
        use_team_fallback = len(roles) == 0
        if use_team_fallback:
            team_rows = self._get_team_as_roles()
        else:
            team_rows = []

        fields = {}

        # Date
        fields['a21122-1'] = _fmt_date(date.today())

        # Fill role rows: fields 2-19 = 6 rows x 3 cols (title, name, alternate)
        field_idx = 2
        for i in range(6):
            if use_team_fallback:
                row = team_rows[i] if i < len(team_rows) else None
                fields[f'a21122-{field_idx}'] = _safe_str(
                    row['role_title'] if row else ''
                )
                fields[f'a21122-{field_idx + 1}'] = _safe_str(
                    row['person_name'] if row else ''
                )
                fields[f'a21122-{field_idx + 2}'] = _safe_str(
                    row['alternate_name'] if row else ''
                )
            else:
                role = roles[i] if i < len(roles) else None
                fields[f'a21122-{field_idx}'] = _safe_str(
                    role.role_title if role else ''
                )
                fields[f'a21122-{field_idx + 1}'] = _safe_str(
                    role.person_name if role else ''
                )
                fields[f'a21122-{field_idx + 2}'] = _safe_str(
                    role.alternate_name if role else ''
                )
            field_idx += 3

        # Page 12 — additional worker description rows (a21122-20 through 24)
        if use_team_fallback:
            worker_rows = [r for r in team_rows if r['role_category'] == 'worker']
            for i in range(5):
                row = worker_rows[i] if i < len(worker_rows) else None
                fields[f'a21122-{20 + i}'] = _safe_str(
                    row['person_name'] if row else ''
                )
        else:
            worker_roles = [r for r in roles if r.role_category == 'worker']
            for i in range(5):
                role = worker_roles[i] if i < len(worker_roles) else None
                resp_str = ''
                if role and role.responsibilities:
                    resp_str = _fmt_json_list(role.responsibilities)
                fields[f'a21122-{20 + i}'] = _safe_str(
                    f"{role.person_name}: {resp_str}" if role else ''
                )

        return fields

    def get_doc02_checkboxes(self):
        """Doc 02 has no checkboxes."""
        return {}

    # ==================================================================
    # Doc 03 — Committee Members List (Page 13)
    # ==================================================================
    def get_doc03_fields(self):
        """
        Map FoodSafetyRoleAssignment (committee members) to Doc 03.
        Falls back to CompanyMembership (owner, manager roles) if no
        role assignments exist.

        Page 13: 3-a-100 = comma-separated list of committee members.
        """
        models = self._get_models()
        roles = list(
            models['FoodSafetyRoleAssignment'].objects
            .filter(company=self.company, active=True)
            .filter(role_category__in=[
                'coordinator', 'alternate_coordinator', 'committee_member',
                'owner', 'manager',
            ])
            .order_by('display_order')
        )

        if roles:
            members_str = ', '.join(
                f"{r.person_name} ({r.role_title})" for r in roles
            )
        else:
            # Fallback: pull from team members with leadership roles
            team_rows = self._get_team_as_roles()
            committee_cats = {'owner', 'admin', 'manager', 'pca'}
            committee_rows = [r for r in team_rows if r['role_category'] in committee_cats]
            members_str = ', '.join(
                f"{r['person_name']} ({r['role_title']})" for r in committee_rows
            )

        return {'3-a-100': members_str}

    def get_doc03_checkboxes(self):
        return {}

    # ------------------------------------------------------------------
    # Auto-population helpers — build summaries from existing platform data
    # ------------------------------------------------------------------
    def _build_pesticide_summary(self):
        """Summarize recent pesticide applications for committee notes."""
        models = self._get_models()
        filters = {'field__farm__company': self.company}
        if self.farm:
            filters['field__farm'] = self.farm
        apps = list(
            models['PesticideApplication'].objects
            .filter(**filters, application_date__year=self.season_year)
            .select_related('product', 'field')
            .order_by('-application_date')[:10]
        )
        if not apps:
            return ''
        lines = [f"{len(apps)} pesticide application(s) this season:"]
        for a in apps[:5]:
            lines.append(
                f"  {_fmt_date(a.application_date)} - {a.product.product_name} "
                f"on {a.field.name} ({a.acres_treated} ac, {a.applicator_name})"
            )
        if len(apps) > 5:
            lines.append(f"  ... and {len(apps) - 5} more")
        return '\n'.join(lines)

    def _build_fertilizer_summary(self):
        """Summarize recent nutrient applications for committee notes."""
        models = self._get_models()
        filters = {}
        if self.farm:
            field_ids = models['Field'].objects.filter(
                farm=self.farm
            ).values_list('id', flat=True)
            filters['field__in'] = field_ids
        apps = list(
            models['NutrientApplication'].objects
            .filter(**filters, application_date__year=self.season_year)
            .select_related('field', 'product')
            .order_by('-application_date')[:10]
        )
        if not apps:
            return ''
        lines = [f"{len(apps)} fertilizer application(s) this season:"]
        for a in apps[:5]:
            product_name = a.product.name if a.product else 'Unknown'
            field_name = a.field.name if a.field else ''
            lines.append(
                f"  {_fmt_date(a.application_date)} - {product_name} on {field_name}"
            )
        if len(apps) > 5:
            lines.append(f"  ... and {len(apps) - 5} more")
        return '\n'.join(lines)

    def _build_water_test_summary(self):
        """Summarize recent water test results for committee notes."""
        models = self._get_models()
        filters = {}
        if self.farm:
            filters['water_source__farm'] = self.farm
        tests = list(
            models['WaterTest'].objects
            .filter(**filters, test_date__year=self.season_year)
            .select_related('water_source')
            .order_by('-test_date')[:10]
        )
        if not tests:
            return ''
        pass_count = sum(1 for t in tests if t.status == 'pass')
        fail_count = sum(1 for t in tests if t.status == 'fail')
        lines = [
            f"{len(tests)} water test(s) this season: "
            f"{pass_count} passed, {fail_count} failed"
        ]
        for t in tests[:3]:
            lines.append(
                f"  {_fmt_date(t.test_date)} - {t.water_source.name}: {t.status}"
            )
        return '\n'.join(lines)

    def _get_latest_water_test_date(self):
        """Return the most recent water test date for the farm."""
        models = self._get_models()
        filters = {}
        if self.farm:
            filters['water_source__farm'] = self.farm
        test = _get_first_or_none(
            models['WaterTest'].objects
            .filter(**filters, test_date__year=self.season_year)
            .order_by('-test_date')
        )
        return test.test_date if test else None

    def _build_training_summary(self):
        """Summarize recent worker training sessions for committee notes."""
        models = self._get_models()
        filters = {'company': self.company}
        if self.farm:
            filters['farm'] = self.farm
        sessions = list(
            models['WorkerTrainingSession'].objects
            .filter(**filters, training_date__year=self.season_year)
            .order_by('-training_date')[:10]
        )
        if not sessions:
            return ''
        total_attendees = sum(s.attendee_count for s in sessions)
        lines = [
            f"{len(sessions)} training session(s) this season, "
            f"{total_attendees} total attendees:"
        ]
        for s in sessions[:3]:
            lines.append(
                f"  {_fmt_date(s.training_date)} - {s.training_topic} "
                f"({s.attendee_count} attendees, {s.instructor_name})"
            )
        return '\n'.join(lines)

    def _check_phi_compliance(self):
        """Check if all harvests this season had PHI verified."""
        models = self._get_models()
        filters = {'field__farm__company': self.company}
        if self.farm:
            filters['field__farm'] = self.farm
        harvests = models['Harvest'].objects.filter(
            **filters, harvest_date__year=self.season_year
        )
        total = harvests.count()
        if total == 0:
            return None  # No harvests = can't determine
        verified = harvests.filter(phi_verified=True).count()
        return verified == total

    # ==================================================================
    # Doc 04 — Committee Meeting Log (Pages 15-16)
    # ==================================================================
    def get_doc04_fields(self):
        """
        Map FoodSafetyCommitteeMeeting to Doc 04 fields.
        Empty notes fields are auto-populated from existing platform data
        (pesticide apps, water tests, fertilizer, training).

        Page 15 fields (4-a-100 through 4-a-112):
            100=Date, 101=Time, 102=Ranch,
            103=Animal activity notes, 104=Pesticide notes,
            105=Pesticide records in binder note,
            106=PHI followed note,
            107=Fertilizer notes, 108=Fertilizer records note,
            109=Water testing notes, 110=Last irrigation water test,
            111=Worker training notes, 112=Additional topics

        Page 16 fields (4-a-113 through 4-a-123):
            113=Coordinator signature name, 123=Date Reviewed,
            114-122=Attendee names (9 rows)
        """
        models = self._get_models()

        # Get the most recent meeting for this season year
        meeting = _get_first_or_none(
            models['FoodSafetyCommitteeMeeting'].objects.filter(
                company=self.company,
                meeting_year=self.season_year,
            ).order_by('-meeting_date')
        )

        fields = {}

        if meeting:
            # Page 15
            fields['4-a-100'] = _fmt_date(meeting.meeting_date)
            fields['4-a-101'] = _fmt_time(meeting.meeting_time)
            fields['4-a-102'] = _safe_str(
                meeting.farm.name if meeting.farm else (
                    self.farm.name if self.farm else ''
                )
            )
            fields['4-a-103'] = _safe_str(meeting.animal_activity_notes)

            # Pesticide notes — auto-fill from PUR data if empty
            pest_notes = _safe_str(meeting.pesticide_apps_notes)
            if not pest_notes:
                pest_notes = self._build_pesticide_summary()
            fields['4-a-104'] = pest_notes

            fields['4-a-105'] = _fmt_bool(meeting.pesticide_records_in_binder)

            # PHI — auto-check from harvest records if not set
            phi_val = meeting.phi_followed
            if phi_val is None:
                phi_val = self._check_phi_compliance()
            fields['4-a-106'] = _fmt_bool(phi_val)

            # Fertilizer notes — auto-fill if empty
            fert_notes = _safe_str(meeting.fertilizer_apps_notes)
            if not fert_notes:
                fert_notes = self._build_fertilizer_summary()
            fields['4-a-107'] = fert_notes

            fields['4-a-108'] = _fmt_bool(meeting.fertilizer_records_in_binder)

            # Water testing notes — auto-fill if empty
            water_notes = _safe_str(meeting.water_testing_notes)
            if not water_notes:
                water_notes = self._build_water_test_summary()
            fields['4-a-109'] = water_notes

            # Last irrigation water test — auto-fill if empty
            last_test = meeting.last_irrigation_water_test
            if not last_test:
                last_test = self._get_latest_water_test_date()
            fields['4-a-110'] = _fmt_date(last_test)

            # Worker training notes — auto-fill if empty
            training_notes = _safe_str(meeting.worker_training_notes)
            if not training_notes:
                training_notes = self._build_training_summary()
            fields['4-a-111'] = training_notes

            fields['4-a-112'] = _safe_str(meeting.additional_topics)

            # Page 16 — Coordinator signature name
            profile = _get_first_or_none(
                models['FoodSafetyProfile'].objects.filter(
                    company=self.company
                )
            )
            fields['4-a-113'] = _safe_str(
                profile.coordinator_name if profile else ''
            )
            fields['4-a-123'] = _fmt_date(meeting.coordinator_signature_date)

            # Attendee names
            attendees = meeting.attendees or []
            for i in range(9):
                att = attendees[i] if i < len(attendees) else {}
                name = att.get('name', '') if isinstance(att, dict) else str(att)
                fields[f'4-a-{114 + i}'] = _safe_str(name)
        else:
            # No meeting exists — still auto-populate data summaries
            fields['4-a-100'] = ''
            fields['4-a-101'] = ''
            fields['4-a-102'] = _safe_str(
                self.farm.name if self.farm else self.company.name
            )
            fields['4-a-103'] = ''
            fields['4-a-104'] = self._build_pesticide_summary()
            fields['4-a-105'] = ''
            phi_val = self._check_phi_compliance()
            fields['4-a-106'] = _fmt_bool(phi_val)
            fields['4-a-107'] = self._build_fertilizer_summary()
            fields['4-a-108'] = ''
            fields['4-a-109'] = self._build_water_test_summary()
            fields['4-a-110'] = _fmt_date(self._get_latest_water_test_date())
            fields['4-a-111'] = self._build_training_summary()
            fields['4-a-112'] = ''
            # Coordinator from profile
            profile = _get_first_or_none(
                models['FoodSafetyProfile'].objects.filter(
                    company=self.company
                )
            )
            fields['4-a-113'] = _safe_str(
                profile.coordinator_name if profile else ''
            )
            fields['4-a-123'] = ''
            for i in range(9):
                fields[f'4-a-{114 + i}'] = ''

        return fields

    def get_doc04_checkboxes(self):
        """
        Doc 04 checkboxes (4-a-CheckBox1 through 4-a-CheckBox8):
            1=Animal activity reviewed, 2=Pesticide apps reviewed,
            3=Pesticide records in binder, 4=PHI followed,
            5=Fertilizer apps reviewed, 6=Fertilizer records in binder,
            7=Water testing reviewed, 8=Worker training reviewed
        """
        models = self._get_models()
        meeting = _get_first_or_none(
            models['FoodSafetyCommitteeMeeting'].objects.filter(
                company=self.company,
                meeting_year=self.season_year,
            ).order_by('-meeting_date')
        )

        cbs = {}
        if meeting:
            cbs['4-a-CheckBox1'] = bool(meeting.animal_activity_reviewed)
            cbs['4-a-CheckBox2'] = bool(meeting.pesticide_apps_reviewed)
            cbs['4-a-CheckBox3'] = bool(meeting.pesticide_records_in_binder)
            cbs['4-a-CheckBox4'] = bool(meeting.phi_followed)
            cbs['4-a-CheckBox5'] = bool(meeting.fertilizer_apps_reviewed)
            cbs['4-a-CheckBox6'] = bool(meeting.fertilizer_records_in_binder)
            cbs['4-a-CheckBox7'] = bool(meeting.water_testing_reviewed)
            cbs['4-a-CheckBox8'] = bool(meeting.worker_training_reviewed)
        else:
            for i in range(1, 9):
                cbs[f'4-a-CheckBox{i}'] = False

        return cbs

    # ==================================================================
    # Doc 05 — Management Verification Review (Pages 17-20)
    # ==================================================================
    def get_doc05_fields(self):
        """
        Map ManagementVerificationReview to Doc 05 fields.

        Page 17 (5-a-100 to 5-a-102):
            100=Internal audits analysis/comments
            101=External audits analysis/comments
            102=Incidents analysis/comments

        Page 18 (5-a-103 to 5-a-106):
            103=Complaints analysis/comments
            104=Objectives analysis/comments
            105=Org structure analysis/comments
            106=SOPs analysis/comments

        Page 19 (5-a-107 to 5-a-111):
            107=Training analysis/comments
            108=Equipment analysis/comments
            109=Job roles analysis/comments
            110=Supplier program analysis/comments
            111=Committee analysis/comments

        Page 20 (5-a-112 to 5-a-122):
            112-122=Attendee names (11 rows)
        """
        models = self._get_models()
        review = _get_first_or_none(
            models['ManagementVerificationReview'].objects.filter(
                company=self.company,
                review_year=self.season_year,
            )
        )

        fields = {}

        if review:
            # Page 17
            fields['5-a-100'] = _safe_str(
                f"{review.internal_audits_analysis}\n{review.internal_audits_comments}".strip()
            )
            fields['5-a-101'] = _safe_str(
                f"{review.external_audits_analysis}\n{review.external_audits_comments}".strip()
            )
            fields['5-a-102'] = _safe_str(
                f"{review.incidents_analysis}\n{review.incidents_comments}".strip()
            )

            # Page 18
            fields['5-a-103'] = _safe_str(
                f"{review.complaints_analysis}\n{review.complaints_comments}".strip()
            )
            fields['5-a-104'] = _safe_str(
                f"{review.objectives_analysis}\n{review.objectives_comments}".strip()
            )
            fields['5-a-105'] = _safe_str(
                f"{review.org_structure_analysis}\n{review.org_structure_comments}".strip()
            )
            fields['5-a-106'] = _safe_str(
                f"{review.sops_analysis}\n{review.sops_comments}".strip()
            )

            # Page 19
            fields['5-a-107'] = _safe_str(
                f"{review.training_analysis}\n{review.training_comments}".strip()
            )
            fields['5-a-108'] = _safe_str(
                f"{review.equipment_analysis}\n{review.equipment_comments}".strip()
            )
            fields['5-a-109'] = _safe_str(
                f"{review.job_roles_analysis}\n{review.job_roles_comments}".strip()
            )
            fields['5-a-110'] = _safe_str(
                f"{review.supplier_program_analysis}\n{review.supplier_program_comments}".strip()
            )
            fields['5-a-111'] = _safe_str(
                f"{review.committee_analysis}\n{review.committee_comments}".strip()
            )

            # Page 20 — Attendee names
            attendees = review.attendees or []
            for i in range(11):
                att = attendees[i] if i < len(attendees) else {}
                name = att.get('name', '') if isinstance(att, dict) else str(att)
                fields[f'5-a-{112 + i}'] = _safe_str(name)
        else:
            for fnum in range(100, 123):
                fields[f'5-a-{fnum}'] = ''

        return fields

    def get_doc05_checkboxes(self):
        """Doc 05 has no checkboxes."""
        return {}

    # ==================================================================
    # Doc 06 — Training Management Matrix (Page 21)
    # ==================================================================
    def get_doc06_fields(self):
        """
        Map TrainingRecord data to Doc 06 training matrix.

        Page 21 has 81 text fields for a matrix: rows = employees,
        columns = training categories + dates.

        Since exact field names follow PDF positional order, we generate
        rows of data and map them to sequential field indices. The
        matrix has approximately 9 columns per row (Name, Role, PSA date,
        Animal date, Food Safety date, Hygiene date, Bleeding date,
        Inspections date, Crop Protection date) x 9 employee rows = 81 fields.

        Field names are discovered dynamically. Here we return a list of
        row dicts keyed by position.
        """
        models = self._get_models()
        records = list(
            models['TrainingRecord'].objects
            .filter(company=self.company, active=True)
            .order_by('employee_name')[:9]
        )

        # Build row data: 9 columns x 9 rows = 81 values
        row_values = []
        for rec in records:
            row_values.extend([
                _safe_str(rec.employee_name),
                _safe_str(rec.employee_role),
                _fmt_date(rec.psa_training_date),
                _fmt_date(rec.animal_intrusion_date),
                _fmt_date(rec.food_safety_date),
                _fmt_date(rec.worker_hygiene_date),
                _fmt_date(rec.bleeding_illness_date),
                _fmt_date(rec.inspections_date),
                _fmt_date(rec.crop_protection_date),
            ])

        # Pad remaining cells to 81
        while len(row_values) < 81:
            row_values.append('')

        # Since exact field names for page 21 are discovery-dependent,
        # return as a special keyed dict. The orchestrator should call
        # CACPDFFieldFiller.discover_fields() for page 21 and map positionally.
        return {
            '_doc06_matrix_values': row_values,
            '_doc06_row_count': len(records),
        }

    def get_doc06_positional_fields(self, field_names):
        """
        Map training matrix values to actual PDF field names.

        Args:
            field_names: List of PDF field names from page 21 in positional
                         order (from discover_fields()).

        Returns:
            Dict mapping field_name -> value.
        """
        data = self.get_doc06_fields()
        values = data.get('_doc06_matrix_values', [])
        fields = {}

        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''

        return fields

    def get_doc06_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 09 — NUOCA (Page 27)
    # ==================================================================
    def get_doc09_fields(self):
        """
        Map CorrectiveAction (is_nuoca=True) to Doc 09 fields.

        Page 27 text fields:
            Date012=Occurrence date, Time012=Occurrence time,
            Reported012=Reported by, Date1012=Due date,
            Time2012=Implemented date, Release2012=CA number,
            Reason012=Description, Reason1012=Root cause,
            Reason2012=Corrective steps
        """
        models = self._get_models()
        nuoca = _get_first_or_none(
            models['CorrectiveAction'].objects.filter(
                company=self.company,
                is_nuoca=True,
            ).order_by('-created_at')
        )

        fields = {}

        if nuoca:
            fields['Date012'] = _fmt_date(nuoca.due_date)
            fields['Time012'] = _fmt_time(nuoca.occurrence_time)
            fields['Reported012'] = _safe_str(nuoca.reported_by_name)
            fields['Date1012'] = _fmt_date(nuoca.due_date)
            fields['Time2012'] = _fmt_date(nuoca.implemented_date)
            fields['Release2012'] = _safe_str(nuoca.ca_number)
            fields['Reason012'] = _safe_str(nuoca.description)
            fields['Reason1012'] = _safe_str(nuoca.root_cause)
            fields['Reason2012'] = _safe_str(nuoca.corrective_steps)
        else:
            for fn in ['Date012', 'Time012', 'Reported012', 'Date1012',
                        'Time2012', 'Release2012', 'Reason012', 'Reason1012',
                        'Reason2012']:
                fields[fn] = ''

        return fields

    def get_doc09_checkboxes(self):
        """
        Doc 09 checkboxes:
            a91122a=Food safety incident, a91122b=Contamination suspected,
            a91122c=Animal intrusion, a91122d=Chemical spill
        """
        models = self._get_models()
        nuoca = _get_first_or_none(
            models['CorrectiveAction'].objects.filter(
                company=self.company,
                is_nuoca=True,
            ).order_by('-created_at')
        )

        cbs = {}
        category = nuoca.nuoca_category if nuoca else ''
        cbs['a91122a'] = category == 'food_safety_incident'
        cbs['a91122b'] = category == 'contamination_suspected'
        cbs['a91122c'] = category == 'animal_intrusion'
        cbs['a91122d'] = category == 'chemical_spill'

        return cbs

    # ==================================================================
    # Doc 09A — Employee Non-Conformance (Page 29)
    # ==================================================================
    def get_doc09a_fields(self):
        """
        Map EmployeeNonConformance to Doc 09A fields.

        Page 29 has 20 text fields for non-conformance details.
        We map the most recent non-conformance record positionally:
            Fields cover: employee name, employee ID, violation date,
            violation type, violation description, supervisor name,
            warning level, warning description, employee acknowledged,
            employee signature date, follow-up required, follow-up date,
            follow-up notes, resolved, plus additional context fields.
        """
        models = self._get_models()
        nc_list = list(
            models['EmployeeNonConformance'].objects
            .filter(company=self.company)
            .order_by('-violation_date')[:1]
        )
        nc = nc_list[0] if nc_list else None

        # 20 text fields — mapped positionally
        values = []
        if nc:
            values = [
                _safe_str(nc.employee_name),
                _safe_str(nc.employee_id),
                _fmt_date(nc.violation_date),
                nc.get_violation_type_display() if hasattr(nc, 'get_violation_type_display') else _safe_str(nc.violation_type),
                _safe_str(nc.violation_description),
                _safe_str(nc.supervisor_name),
                str(nc.warning_level),
                nc.get_warning_level_display() if hasattr(nc, 'get_warning_level_display') else '',
                _safe_str(nc.warning_description),
                _fmt_bool(nc.employee_acknowledged),
                _fmt_date(nc.employee_signature_date),
                _fmt_bool(nc.follow_up_required),
                _fmt_date(nc.follow_up_date),
                _safe_str(nc.follow_up_notes),
                _fmt_bool(nc.resolved),
                _safe_str(nc.notes),
                '',  # spare
                '',  # spare
                '',  # spare
                '',  # spare
            ]
        else:
            values = [''] * 20

        return {
            '_doc09a_positional_values': values,
        }

    def get_doc09a_positional_fields(self, field_names):
        """Map non-conformance values to discovered PDF field names."""
        data = self.get_doc09a_fields()
        values = data.get('_doc09a_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc09a_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 11/12 — Product Hold & Release (Page 35)
    # ==================================================================
    def get_doc11_fields(self):
        """
        Map ProductHoldRelease to Doc 11/12 fields.

        Page 35 has 9 text fields for the most recent product hold.
        Positional mapping: hold number, hold date, product description,
        lot numbers, hold reason, hold initiated by, status,
        release date, release authorized by.
        """
        models = self._get_models()
        hold = _get_first_or_none(
            models['ProductHoldRelease'].objects
            .filter(company=self.company)
            .order_by('-hold_date')
        )

        values = []
        if hold:
            values = [
                _safe_str(hold.hold_number),
                _fmt_date(hold.hold_date),
                _safe_str(hold.product_description),
                _fmt_json_list(hold.lot_numbers),
                hold.get_hold_reason_display() if hasattr(hold, 'get_hold_reason_display') else _safe_str(hold.hold_reason),
                _safe_str(hold.hold_initiated_by),
                hold.get_status_display() if hasattr(hold, 'get_status_display') else _safe_str(hold.status),
                _fmt_date(hold.release_date),
                _safe_str(hold.release_authorized_by),
            ]
        else:
            values = [''] * 9

        return {'_doc11_positional_values': values}

    def get_doc11_positional_fields(self, field_names):
        """Map product hold values to discovered PDF field names."""
        data = self.get_doc11_fields()
        values = data.get('_doc11_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc11_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 14 — Approved Suppliers (Pages 43 + 45)
    # ==================================================================
    def get_doc14_fields(self):
        """
        Map ApprovedSupplier to Doc 14 table fields.

        Page 43: 80 text fields (approved supplier table).
            8 columns x 10 rows: Supplier Name, Supplier Code, Contact,
            Phone, Materials, Status, Approved Date, Next Review Date.

        Page 45: 72 text fields (emergency supplier table).
            Same structure but for emergency/conditional suppliers.
        """
        models = self._get_models()
        approved = list(
            models['ApprovedSupplier'].objects
            .filter(company=self.company, status='approved')
            .order_by('supplier_name')[:10]
        )
        emergency = list(
            models['ApprovedSupplier'].objects
            .filter(company=self.company, status__in=['conditional', 'pending_approval'])
            .order_by('supplier_name')[:9]
        )

        # Page 43 — 8 cols x 10 rows = 80 fields
        p43_values = []
        for sup in approved:
            p43_values.extend([
                _safe_str(sup.supplier_name),
                _safe_str(sup.supplier_code),
                _safe_str(sup.contact_name),
                _safe_str(sup.contact_phone),
                _fmt_json_list(sup.material_types),
                sup.get_status_display() if hasattr(sup, 'get_status_display') else _safe_str(sup.status),
                _fmt_date(sup.approved_date),
                _fmt_date(sup.next_review_date),
            ])
        while len(p43_values) < 80:
            p43_values.append('')

        # Page 45 — 8 cols x 9 rows = 72 fields
        p45_values = []
        for sup in emergency:
            p45_values.extend([
                _safe_str(sup.supplier_name),
                _safe_str(sup.supplier_code),
                _safe_str(sup.contact_name),
                _safe_str(sup.contact_phone),
                _fmt_json_list(sup.material_types),
                sup.get_status_display() if hasattr(sup, 'get_status_display') else _safe_str(sup.status),
                _fmt_date(sup.approved_date),
                _fmt_date(sup.next_review_date),
            ])
        while len(p45_values) < 72:
            p45_values.append('')

        return {
            '_doc14_p43_values': p43_values,
            '_doc14_p45_values': p45_values,
        }

    def get_doc14_positional_fields(self, p43_field_names, p45_field_names):
        """Map supplier table values to discovered PDF field names."""
        data = self.get_doc14_fields()
        fields = {}

        p43_values = data.get('_doc14_p43_values', [])
        for i, name in enumerate(p43_field_names):
            fields[name] = p43_values[i] if i < len(p43_values) else ''

        p45_values = data.get('_doc14_p45_values', [])
        for i, name in enumerate(p45_field_names):
            fields[name] = p45_values[i] if i < len(p45_values) else ''

        return fields

    def get_doc14_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 15 — Supplier Verification Log (Page 47)
    # ==================================================================
    def get_doc15_fields(self):
        """
        Map SupplierVerificationLog to Doc 15 fields.

        Page 47: 46 text fields for supplier verification checklist.
        Multiple verification records laid out in table rows.
        """
        models = self._get_models()
        verifications = list(
            models['SupplierVerificationLog'].objects
            .filter(company=self.company)
            .select_related('supplier')
            .order_by('-verification_date')[:6]
        )

        # Approximately 7-8 columns per row: supplier name, verification type,
        # date, verified by, overall result, deficiencies, next verification, notes
        values = []
        for v in verifications:
            values.extend([
                _safe_str(v.supplier.supplier_name if v.supplier else ''),
                v.get_verification_type_display() if hasattr(v, 'get_verification_type_display') else _safe_str(v.verification_type),
                _fmt_date(v.verification_date),
                _safe_str(v.verified_by),
                v.get_overall_result_display() if hasattr(v, 'get_overall_result_display') else _safe_str(v.overall_result),
                _safe_str(v.deficiencies),
                _fmt_date(v.next_verification_date),
                _fmt_bool(v.satisfied_with_service),
            ])
        while len(values) < 46:
            values.append('')
        values = values[:46]

        return {'_doc15_positional_values': values}

    def get_doc15_positional_fields(self, field_names):
        """Map supplier verification values to discovered PDF field names."""
        data = self.get_doc15_fields()
        values = data.get('_doc15_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc15_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 17 — Mock Recall (Page 51)
    # ==================================================================
    def get_doc17_fields(self):
        """
        Map MockRecall to Doc 17 fields.

        Page 51: 32 text fields covering recall exercise details.
        """
        models = self._get_models()
        recall = _get_first_or_none(
            models['MockRecall'].objects
            .filter(company=self.company)
            .order_by('-exercise_date')
        )

        values = []
        if recall:
            values = [
                _safe_str(recall.recall_number),
                _fmt_date(recall.exercise_date),
                _safe_str(recall.scenario_description),
                _safe_str(recall.trigger_reason),
                _safe_str(recall.target_product),
                _fmt_json_list(recall.target_lot_numbers),
                recall.get_status_display() if hasattr(recall, 'get_status_display') else _safe_str(recall.status),
                _fmt_date(recall.trace_start_time),
                _fmt_date(recall.trace_end_time),
                str(recall.trace_duration_minutes or ''),
                _fmt_decimal(recall.product_accounted_percent),
                _fmt_json_list(recall.lots_traced_forward, key='name' if recall.lots_traced_forward and isinstance(recall.lots_traced_forward[0], dict) else None),
                _fmt_json_list(recall.lots_traced_backward, key='name' if recall.lots_traced_backward and isinstance(recall.lots_traced_backward[0], dict) else None),
                _fmt_decimal(recall.effectiveness_score),
                _fmt_bool(recall.passed),
                _fmt_json_list(recall.participants, key='name'),
                _safe_str(recall.notes),
            ]
        else:
            values = []

        while len(values) < 32:
            values.append('')
        values = values[:32]

        return {'_doc17_positional_values': values}

    def get_doc17_positional_fields(self, field_names):
        """Map mock recall values to discovered PDF field names."""
        data = self.get_doc17_fields()
        values = data.get('_doc17_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc17_checkboxes(self):
        """
        Doc 17: 8 checkboxes (positional — trace result indicators).
        Returns empty dict; orchestrator maps from discovered field names.
        """
        models = self._get_models()
        recall = _get_first_or_none(
            models['MockRecall'].objects
            .filter(company=self.company)
            .order_by('-exercise_date')
        )

        cbs = {}
        if recall:
            cbs['_doc17_passed'] = bool(recall.passed)
            cbs['_doc17_within_time'] = bool(recall.within_time_limit)
        return cbs

    # ==================================================================
    # Doc 18 — Food Fraud Assessment (Page 53)
    # ==================================================================
    def get_doc18_fields(self):
        """
        Map FoodFraudAssessment to Doc 18.

        Page 53: 1 text field for the overall vulnerability assessment summary.
        """
        models = self._get_models()
        assessment = _get_first_or_none(
            models['FoodFraudAssessment'].objects
            .filter(company=self.company, assessment_year=self.season_year)
        )

        summary = ''
        if assessment:
            parts = [
                f"Assessment Year: {assessment.assessment_year}",
                f"Assessed By: {assessment.assessed_by}",
                f"Overall Vulnerability: {assessment.get_overall_vulnerability_display() if hasattr(assessment, 'get_overall_vulnerability_display') else assessment.overall_vulnerability}",
            ]
            if assessment.mitigation_summary:
                parts.append(f"Mitigation: {assessment.mitigation_summary}")
            if assessment.fraud_assessments:
                for fa in assessment.fraud_assessments[:3]:
                    if isinstance(fa, dict):
                        ft = fa.get('fraud_type', '')
                        sig = 'Yes' if fa.get('significant') else 'No'
                        parts.append(f"  - {ft}: Significant={sig}")
            summary = '\n'.join(parts)

        return {'_doc18_text': summary}

    def get_doc18_positional_fields(self, field_names):
        """Map food fraud text to discovered PDF field names."""
        data = self.get_doc18_fields()
        text = data.get('_doc18_text', '')
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = text if i == 0 else ''
        return fields

    def get_doc18_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 19 — Food Defense Plan (Page 56)
    # ==================================================================
    def get_doc19_fields(self):
        """
        Map FoodDefensePlan to Doc 19.

        Page 56: 1 text field for defense plan summary.
        """
        models = self._get_models()
        plan = _get_first_or_none(
            models['FoodDefensePlan'].objects
            .filter(company=self.company, plan_year=self.season_year)
        )

        summary = ''
        if plan:
            parts = [
                f"Plan Year: {plan.plan_year}",
                f"Threat Level: {plan.get_overall_threat_level_display() if hasattr(plan, 'get_overall_threat_level_display') else plan.overall_threat_level}",
                f"Coordinator: {plan.food_defense_coordinator}",
            ]
            if plan.perimeter_security:
                parts.append(f"Perimeter Security: {plan.perimeter_security[:200]}")
            if plan.tampering_response_procedure:
                parts.append(f"Tampering Response: {plan.tampering_response_procedure[:200]}")
            summary = '\n'.join(parts)

        return {'_doc19_text': summary}

    def get_doc19_positional_fields(self, field_names):
        """Map food defense text to discovered PDF field names."""
        data = self.get_doc19_fields()
        text = data.get('_doc19_text', '')
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = text if i == 0 else ''
        return fields

    def get_doc19_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 20 — Visitor Log (Page 57)
    # ==================================================================
    def get_doc20_fields(self):
        """
        Map to Doc 20 visitor log fields.

        Page 57: Header (Ranch name, Coordinator, Date) + visitor rows.
        Auto-populates visitor entries from HarvestLabor records —
        harvest crews visiting the farm are documented visitors.
        Each row: Date, Name/Company, Purpose, Time In, Time Out, # People.
        """
        models = self._get_models()
        profile = _get_first_or_none(
            models['FoodSafetyProfile'].objects.filter(company=self.company)
        )

        farm_name = self.farm.name if self.farm else self.company.name
        coordinator = profile.coordinator_name if profile else ''

        values = [
            _safe_str(farm_name),
            _safe_str(coordinator),
            _fmt_date(date.today()),
        ]

        # Auto-populate visitor entries from harvest labor records
        labor_filters = {'harvest__field__farm__company': self.company}
        if self.farm:
            labor_filters['harvest__field__farm'] = self.farm

        labor_records = list(
            models['HarvestLabor'].objects
            .filter(**labor_filters, harvest__harvest_date__year=self.season_year)
            .select_related('harvest', 'harvest__field', 'contractor')
            .order_by('-harvest__harvest_date')[:10]
        )

        for lr in labor_records:
            harvest_date = lr.harvest.harvest_date if lr.harvest else None
            contractor_name = ''
            if lr.contractor:
                contractor_name = lr.contractor.company_name
            elif lr.crew_name:
                contractor_name = lr.crew_name
            visitor_name = lr.foreman_name or contractor_name or 'Harvest Crew'
            if contractor_name and lr.foreman_name:
                visitor_name = f"{lr.foreman_name} ({contractor_name})"

            values.extend([
                _fmt_date(harvest_date),
                _safe_str(visitor_name),
                'Harvest',
                _fmt_time(lr.start_time.time() if lr.start_time else None),
                _fmt_time(lr.end_time.time() if lr.end_time else None),
                str(lr.worker_count),
            ])

        return {
            '_doc20_positional_values': values,
        }

    def get_doc20_positional_fields(self, field_names):
        """Map visitor log header to discovered PDF field names."""
        data = self.get_doc20_fields()
        values = data.get('_doc20_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc20_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 21 — Emergency Contacts (Page 59)
    # ==================================================================
    def get_doc21_fields(self):
        """
        Map EmergencyContact to Doc 21 fields.

        Page 59: 13 text fields for key emergency contacts.
        Positional: org1, phone1, org2, phone2, ... plus header fields.
        """
        models = self._get_models()
        contacts = list(
            models['EmergencyContact'].objects
            .filter(company=self.company, active=True)
            .order_by('display_order')[:6]
        )

        values = [
            _safe_str(self.farm.name if self.farm else self.company.name),
        ]
        for c in contacts:
            values.extend([
                _safe_str(f"{c.organization} ({c.get_contact_type_display()})"),
                _safe_str(c.phone_primary),
            ])
        while len(values) < 13:
            values.append('')

        return {'_doc21_positional_values': values}

    def get_doc21_positional_fields(self, field_names):
        """Map emergency contacts to discovered PDF field names."""
        data = self.get_doc21_fields()
        values = data.get('_doc21_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc21_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 22 — Soils/Land Use History (Page 61)
    # ==================================================================
    def get_doc22_fields(self):
        """
        Map LandHistoryAssessment to Doc 22 fields.

        Page 61: 28 text fields covering land use history, risk factors,
        soil testing, and mitigation.
        """
        models = self._get_models()

        filters = {'company': self.company}
        if self.farm:
            from api.models.farm import Field
            field_ids = Field.objects.filter(farm=self.farm).values_list('id', flat=True)
            filters['field__in'] = field_ids

        assessment = _get_first_or_none(
            models['LandHistoryAssessment'].objects
            .filter(**filters)
            .order_by('-assessment_date')
        )

        values = []
        if assessment:
            # Land use history entries
            history_entries = assessment.land_use_history or []
            history_strs = []
            for entry in history_entries[:5]:
                if isinstance(entry, dict):
                    history_strs.append(
                        f"{entry.get('year_start', '')}-{entry.get('year_end', '')}: "
                        f"{entry.get('land_use', '')} - {entry.get('details', '')}"
                    )

            values = [
                _safe_str(assessment.field.name if assessment.field else ''),
                _fmt_date(assessment.assessment_date),
                _safe_str(assessment.information_source),
                # Land use history rows
                history_strs[0] if len(history_strs) > 0 else '',
                history_strs[1] if len(history_strs) > 1 else '',
                history_strs[2] if len(history_strs) > 2 else '',
                history_strs[3] if len(history_strs) > 3 else '',
                history_strs[4] if len(history_strs) > 4 else '',
                # Risk factors
                _fmt_bool(assessment.previous_pesticide_use),
                _fmt_bool(assessment.previous_chemical_storage),
                _fmt_bool(assessment.previous_waste_disposal),
                _fmt_bool(assessment.previous_mining),
                _fmt_bool(assessment.flood_zone),
                _fmt_bool(assessment.adjacent_contamination_risk),
                _fmt_bool(assessment.previous_animal_operations),
                _safe_str(assessment.animal_operation_details),
                # Soil testing
                _fmt_bool(assessment.soil_testing_conducted),
                _fmt_date(assessment.soil_test_date),
                _safe_str(assessment.soil_test_lab),
                _fmt_bool(assessment.soil_test_passed),
                # Overall
                assessment.get_contamination_risk_display() if hasattr(assessment, 'get_contamination_risk_display') else _safe_str(assessment.contamination_risk),
                _safe_str(assessment.risk_justification),
                _safe_str(assessment.mitigation_measures),
                # Buffer period
                str(assessment.buffer_period_months or ''),
                _fmt_bool(assessment.buffer_period_adequate),
                # Remediation
                _fmt_bool(assessment.remediation_required),
                _safe_str(assessment.remediation_description),
                _fmt_date(assessment.remediation_completion_date),
            ]
        else:
            values = [''] * 28

        return {'_doc22_positional_values': values}

    def get_doc22_positional_fields(self, field_names):
        """Map land history values to discovered PDF field names."""
        data = self.get_doc22_fields()
        values = data.get('_doc22_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc22_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 23 — Animals/Wildlife Assessment (Page 65)
    # ==================================================================
    def get_doc23_fields(self):
        """
        Map perimeter monitoring data to Doc 23 (1 text field summary).

        Page 65: 1 text field (summary) + 7 checkboxes.
        """
        models = self._get_models()

        filters = {'company': self.company}
        if self.farm:
            filters['farm'] = self.farm

        logs = list(
            models['PerimeterMonitoringLog'].objects
            .filter(**filters)
            .order_by('-log_date')[:10]
        )

        summary_parts = []
        for log in logs[:3]:
            parts = [f"Week {log.week_number} ({_fmt_date(log.log_date)})"]
            if log.animal_activity_found:
                parts.append(f"Animals: {log.animal_species_observed}")
            if log.fecal_matter_found:
                parts.append("Fecal matter found")
            summary_parts.append('; '.join(parts))

        summary = '\n'.join(summary_parts) if summary_parts else 'No recent animal activity logged.'

        return {'_doc23_text': summary}

    def get_doc23_positional_fields(self, field_names):
        """Map animal/wildlife text to discovered PDF field names."""
        data = self.get_doc23_fields()
        text = data.get('_doc23_text', '')
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = text if i == 0 else ''
        return fields

    def get_doc23_checkboxes(self):
        """
        Doc 23: 7 checkboxes for animal types observed.
        Best-effort mapping from recent perimeter monitoring data.
        """
        models = self._get_models()

        filters = {'company': self.company}
        if self.farm:
            filters['farm'] = self.farm

        logs = list(
            models['PerimeterMonitoringLog'].objects
            .filter(**filters, animal_activity_found=True)
            .order_by('-log_date')[:20]
        )

        # Aggregate species across recent logs
        all_species = ' '.join(
            (log.animal_species_observed or '').lower() for log in logs
        )

        # Best-effort species-to-checkbox mapping
        return {
            '_doc23_cb_deer': 'deer' in all_species,
            '_doc23_cb_coyote': 'coyote' in all_species or 'canine' in all_species,
            '_doc23_cb_rodent': 'rodent' in all_species or 'rat' in all_species or 'mouse' in all_species,
            '_doc23_cb_bird': 'bird' in all_species or 'crow' in all_species or 'hawk' in all_species,
            '_doc23_cb_feral_pig': 'pig' in all_species or 'boar' in all_species or 'feral' in all_species,
            '_doc23_cb_rabbit': 'rabbit' in all_species or 'hare' in all_species,
            '_doc23_cb_other': bool(logs) and any(
                s not in ('deer', 'coyote', 'rodent', 'bird', 'pig', 'rabbit')
                for s in all_species.split()
            ),
        }

    # ==================================================================
    # Doc 24 — Perimeter Monitoring Log (Page 67)
    # ==================================================================
    def get_doc24_fields(self):
        """
        Map PerimeterMonitoringLog to Doc 24 table fields.

        Page 67: 9 text fields (header: ranch, year, inspector, etc.)
        + 51 checkboxes for weekly monitoring grid.
        """
        models = self._get_models()

        filters = {'company': self.company}
        if self.farm:
            filters['farm'] = self.farm

        logs = list(
            models['PerimeterMonitoringLog'].objects
            .filter(**filters)
            .order_by('log_date')
        )

        # Header fields
        profile = _get_first_or_none(
            models['FoodSafetyProfile'].objects.filter(company=self.company)
        )

        values = [
            _safe_str(self.farm.name if self.farm else self.company.name),
            str(self.season_year),
            _safe_str(profile.coordinator_name if profile else ''),
            _safe_str(profile.coordinator_phone if profile else ''),
            '',  # Additional header
            '',  # Additional header
            '',  # Additional header
            '',  # Additional header
            '',  # Additional header
        ]

        return {'_doc24_positional_values': values}

    def get_doc24_positional_fields(self, field_names):
        """Map perimeter monitoring header to discovered PDF field names."""
        data = self.get_doc24_fields()
        values = data.get('_doc24_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc24_checkboxes(self):
        """
        Doc 24: 51 checkboxes for weekly perimeter monitoring grid.
        Each checkbox = one week's check for a specific monitoring item.
        """
        models = self._get_models()

        filters = {'company': self.company}
        if self.farm:
            filters['farm'] = self.farm

        logs = list(
            models['PerimeterMonitoringLog'].objects
            .filter(**filters)
            .order_by('log_date')
        )

        # Build week-based check grid: up to 52 weeks, 3 checks per week
        # (perimeter_intact, gates_secured, signage_in_place) but the PDF
        # has 51 checkboxes. We map the first 51 entries positionally.
        cb_values = []
        for log in logs[:17]:
            cb_values.append(bool(log.perimeter_intact))
            cb_values.append(bool(log.gates_secured))
            cb_values.append(bool(log.signage_in_place))

        while len(cb_values) < 51:
            cb_values.append(False)
        cb_values = cb_values[:51]

        return {'_doc24_checkbox_values': cb_values}

    # ==================================================================
    # Doc 26 — Fertilizer Application Log (Page 73)
    # ==================================================================
    def get_doc26_fields(self):
        """
        Map NutrientApplication to Doc 26 fertilizer log.

        Page 73: 120 text fields (table: ~12 columns x 10 rows).
        Columns: Date, Field, Product, Rate, Unit, Acres, Applied By,
        Method, N lbs/ac, P lbs/ac, K lbs/ac, Notes.
        """
        models = self._get_models()

        filters = {}
        if self.farm:
            from api.models.farm import Field
            field_ids = Field.objects.filter(farm=self.farm).values_list('id', flat=True)
            filters['field__in'] = field_ids

        apps = list(
            models['NutrientApplication'].objects
            .filter(**filters)
            .select_related('field', 'product')
            .order_by('-application_date')[:10]
        )

        values = []
        for app in apps:
            values.extend([
                _fmt_date(app.application_date),
                _safe_str(app.field.name if app.field else ''),
                _safe_str(app.product.name if app.product else ''),
                _fmt_decimal(app.rate),
                app.get_rate_unit_display() if hasattr(app, 'get_rate_unit_display') else _safe_str(app.rate_unit),
                _fmt_decimal(app.acres_treated),
                _safe_str(app.applied_by),
                app.get_application_method_display() if hasattr(app, 'get_application_method_display') else _safe_str(app.application_method),
                _fmt_decimal(app.lbs_nitrogen_per_acre),
                _fmt_decimal(app.lbs_phosphorus_per_acre),
                _fmt_decimal(app.lbs_potassium_per_acre),
                '',  # Notes column
            ])

        while len(values) < 120:
            values.append('')
        values = values[:120]

        return {'_doc26_positional_values': values}

    def get_doc26_positional_fields(self, field_names):
        """Map fertilizer log values to discovered PDF field names."""
        data = self.get_doc26_fields()
        values = data.get('_doc26_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc26_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 27 — Pesticide Application Log (Page ~75)
    # Auto-populated from PesticideApplication records (PUR data)
    # ==================================================================
    def get_doc27_fields(self):
        """
        Map PesticideApplication records to the crop protection / pesticide
        use log section.  This was previously unmapped — the platform already
        tracks every pesticide application for PUR compliance, so we
        auto-populate the CAC log directly.

        Columns: Date, Field, Product, EPA Reg#, Amount, Unit, Method,
        Applicator, License#, Target Pest, Weather (temp/wind).
        Up to 10 rows × 11 columns = 110 values.
        """
        models = self._get_models()
        filters = {'field__farm__company': self.company}
        if self.farm:
            filters['field__farm'] = self.farm

        apps = list(
            models['PesticideApplication'].objects
            .filter(**filters, application_date__year=self.season_year)
            .select_related('product', 'field')
            .order_by('-application_date')[:10]
        )

        values = []
        for a in apps:
            weather = ''
            if a.temperature:
                weather = f"{a.temperature}°F"
            if a.wind_speed:
                weather += f", {a.wind_speed} mph {a.wind_direction or ''}"
            weather = weather.strip().strip(',').strip()

            values.extend([
                _fmt_date(a.application_date),
                _safe_str(a.field.name if a.field else ''),
                _safe_str(a.product.product_name if a.product else ''),
                _safe_str(a.product.epa_registration_number if a.product else ''),
                _fmt_decimal(a.amount_used),
                a.get_unit_of_measure_display() if hasattr(a, 'get_unit_of_measure_display') else _safe_str(a.unit_of_measure),
                a.get_application_method_display() if hasattr(a, 'get_application_method_display') else _safe_str(a.application_method),
                _safe_str(a.applicator_name),
                _safe_str(a.applicator_license_no),
                _safe_str(a.target_pest),
                weather,
            ])

        while len(values) < 110:
            values.append('')
        values = values[:110]

        return {'_doc27_positional_values': values}

    def get_doc27_positional_fields(self, field_names):
        """Map pesticide application log values to discovered PDF field names."""
        data = self.get_doc27_fields()
        values = data.get('_doc27_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc27_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 28A — Sprayer Calibration (Page 83)
    # ==================================================================
    def get_doc28a_fields(self):
        """
        Map EquipmentCalibration (sprayer type) to Doc 28A.

        Page 83: 85 text fields for sprayer calibration records.
        ~17 columns x 5 rows.
        """
        models = self._get_models()
        calibrations = list(
            models['EquipmentCalibration'].objects
            .filter(company=self.company, equipment_type='sprayer')
            .order_by('-calibration_date')[:5]
        )

        values = []
        for cal in calibrations:
            values.extend([
                _safe_str(cal.equipment_name),
                _safe_str(cal.equipment_id),
                _safe_str(cal.manufacturer),
                _safe_str(cal.model_number),
                _safe_str(cal.location),
                _fmt_date(cal.calibration_date),
                _fmt_date(cal.next_calibration_date),
                cal.get_calibration_method_display() if hasattr(cal, 'get_calibration_method_display') else _safe_str(cal.calibration_method),
                _safe_str(cal.calibrated_by),
                _safe_str(cal.calibration_standard),
                cal.get_status_display() if hasattr(cal, 'get_status_display') else _safe_str(cal.status),
                _safe_str(cal.reading_before),
                _safe_str(cal.reading_after),
                _safe_str(cal.tolerance),
                _fmt_bool(cal.within_tolerance),
                _safe_str(cal.corrective_action_taken),
                _safe_str(cal.certificate_number),
            ])

        while len(values) < 85:
            values.append('')
        values = values[:85]

        return {'_doc28a_positional_values': values}

    def get_doc28a_positional_fields(self, field_names):
        """Map sprayer calibration values to discovered PDF field names."""
        data = self.get_doc28a_fields()
        values = data.get('_doc28a_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc28a_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 29 — Chemical Inventory (Page 85)
    # ==================================================================
    def get_doc29_fields(self):
        """
        Map ChemicalInventoryLog to Doc 29 fields.
        Falls back to PesticideProduct records (chemicals used in applications)
        when no manual inventory log entries exist.

        Page 85: 84 text fields (table: ~7 columns x 12 rows).
        Columns: Chemical Name, EPA Reg#, Type, Storage, Unit, Stock, Counted By.
        """
        models = self._get_models()
        inventory = list(
            models['ChemicalInventoryLog'].objects
            .filter(company=self.company, inventory_year=self.season_year)
            .order_by('chemical_name', '-inventory_date')
        )

        # Deduplicate by chemical name (keep most recent per chemical)
        seen = set()
        unique_entries = []
        for inv in inventory:
            if inv.chemical_name not in seen:
                seen.add(inv.chemical_name)
                unique_entries.append(inv)
            if len(unique_entries) >= 12:
                break

        values = []
        if unique_entries:
            for inv in unique_entries:
                values.extend([
                    _safe_str(inv.chemical_name),
                    _safe_str(inv.epa_registration_number),
                    inv.get_chemical_type_display() if hasattr(inv, 'get_chemical_type_display') else _safe_str(inv.chemical_type),
                    _safe_str(inv.storage_location),
                    inv.get_unit_of_measure_display() if hasattr(inv, 'get_unit_of_measure_display') else _safe_str(inv.unit_of_measure),
                    _fmt_decimal(inv.stock_on_hand),
                    _safe_str(inv.counted_by),
                ])
        else:
            # Fallback: derive from PesticideProduct used in applications
            app_filters = {'field__farm__company': self.company}
            if self.farm:
                app_filters['field__farm'] = self.farm

            product_ids = (
                models['PesticideApplication'].objects
                .filter(**app_filters, application_date__year=self.season_year)
                .values_list('product_id', flat=True)
                .distinct()
            )
            products = list(
                models['PesticideProduct'].objects
                .filter(id__in=product_ids)
                .order_by('product_name')[:12]
            )
            for p in products:
                product_type = ''
                if hasattr(p, 'get_product_type_display') and p.product_type:
                    product_type = p.get_product_type_display()
                values.extend([
                    _safe_str(p.product_name),
                    _safe_str(p.epa_registration_number),
                    product_type,
                    '',  # storage location — not tracked on product
                    '',  # unit
                    '',  # stock — not tracked on product
                    '',  # counted by
                ])

        while len(values) < 84:
            values.append('')
        values = values[:84]

        return {'_doc29_positional_values': values}

    def get_doc29_positional_fields(self, field_names):
        """Map chemical inventory values to discovered PDF field names."""
        data = self.get_doc29_fields()
        values = data.get('_doc29_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc29_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 37 — Training Session Log (Page 109)
    # ==================================================================
    def get_doc37_fields(self):
        """
        Map WorkerTrainingSession to Doc 37 fields.

        Page 109: 25 text fields.
        Fields: Training topic, date, instructor, category, language,
        location, duration, then 18 attendee signature name fields.
        """
        models = self._get_models()

        filters = {'company': self.company}
        if self.farm:
            filters['farm'] = self.farm

        session = _get_first_or_none(
            models['WorkerTrainingSession'].objects
            .filter(**filters)
            .order_by('-training_date')
        )

        values = []
        if session:
            values = [
                _safe_str(session.training_topic),
                _fmt_date(session.training_date),
                _safe_str(session.instructor_name),
                session.get_training_category_display() if hasattr(session, 'get_training_category_display') else _safe_str(session.training_category),
                session.get_language_display() if hasattr(session, 'get_language_display') else _safe_str(session.language),
                _safe_str(session.location),
                str(session.duration_minutes or ''),
            ]

            # 18 attendee signature name fields
            attendees = session.attendees or []
            for i in range(18):
                att = attendees[i] if i < len(attendees) else {}
                name = att.get('name', '') if isinstance(att, dict) else str(att)
                values.append(_safe_str(name))
        else:
            values = [''] * 25

        return {'_doc37_positional_values': values}

    def get_doc37_positional_fields(self, field_names):
        """Map training session values to discovered PDF field names."""
        data = self.get_doc37_fields()
        values = data.get('_doc37_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc37_checkboxes(self):
        return {}

    # ==================================================================
    # Doc 38 — Pre-Season Self-Assessment (Pages 113-114)
    # ==================================================================
    def _get_water_sources_for_farm(self):
        """Return list of water source type names for this farm."""
        models = self._get_models()
        filters = {}
        if self.farm:
            filters['farm'] = self.farm
        else:
            filters['farm__company'] = self.company
        sources = models['WaterSource'].objects.filter(**filters, active=True)
        types = set()
        for s in sources:
            if hasattr(s, 'source_type') and s.source_type:
                types.add(s.source_type)
        return list(types)

    def _check_data_exists(self, model_key, extra_filters=None):
        """Check if any records exist for the company/season."""
        models = self._get_models()
        filters = {}
        if extra_filters:
            filters.update(extra_filters)
        return models[model_key].objects.filter(**filters).exists()

    def get_doc38_fields(self):
        """
        Map PreSeasonChecklist to Doc 38 fields.
        Auto-populates water sources and notes from existing platform data
        when the checklist is missing or fields are empty.

        Pages 113-114: 29+19=48 text fields + 88 checkboxes.
        Text fields cover header info and notes for each section.
        """
        models = self._get_models()

        filters = {'company': self.company, 'season_year': self.season_year}
        if self.farm:
            filters['farm'] = self.farm

        checklist = _get_first_or_none(
            models['PreSeasonChecklist'].objects.filter(**filters)
        )

        # Auto-derive water sources from WaterSource model
        auto_water_sources = self._get_water_sources_for_farm()
        auto_water_sources_str = ', '.join(auto_water_sources) if auto_water_sources else ''

        values = []
        if checklist:
            # Water sources — auto-fill if empty
            water_sources_val = _fmt_json_list(checklist.water_sources)
            if not water_sources_val:
                water_sources_val = auto_water_sources_str

            values = [
                # Header
                _safe_str(checklist.farm.name if checklist.farm else ''),
                str(checklist.season_year),
                _fmt_date(checklist.assessment_date),
                _safe_str(checklist.assessed_by),
                # Ground History notes
                _safe_str(checklist.ground_history_notes),
                # Adjacent Land notes
                _safe_str(checklist.adjacent_land_notes),
                # Fertilizer notes — auto-fill if empty
                _safe_str(checklist.fertilizer_notes) or self._build_fertilizer_summary(),
                # Water notes
                _safe_str(checklist.water_notes) or self._build_water_test_summary(),
                _safe_str(checklist.water_risk_factors_detail),
                water_sources_val,
                # Hygiene notes
                _safe_str(checklist.hygiene_notes),
                # Records notes
                _safe_str(checklist.records_notes),
                # Overall
                _fmt_bool(checklist.deficiencies_found),
                _fmt_json_list(checklist.deficiency_list, key='item'),
                _fmt_bool(checklist.approved_for_season),
                _safe_str(checklist.approved_by),
                _fmt_date(checklist.approval_date),
                _safe_str(checklist.notes),
            ]
        else:
            # No checklist — auto-populate what we can
            values = [
                # Header
                _safe_str(self.farm.name if self.farm else self.company.name),
                str(self.season_year),
                '',  # assessment_date
                '',  # assessed_by
                '',  # ground_history_notes
                '',  # adjacent_land_notes
                self._build_fertilizer_summary(),
                self._build_water_test_summary(),
                '',  # water_risk_factors_detail
                auto_water_sources_str,
                '',  # hygiene_notes
                '',  # records_notes
                '',  # deficiencies_found
                '',  # deficiency_list
                '',  # approved_for_season
                '',  # approved_by
                '',  # approval_date
                '',  # notes
            ]

        while len(values) < 48:
            values.append('')
        values = values[:48]

        return {'_doc38_positional_values': values}

    def get_doc38_positional_fields(self, field_names):
        """Map pre-season checklist values to discovered PDF field names."""
        data = self.get_doc38_fields()
        values = data.get('_doc38_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc38_checkboxes(self):
        """
        Doc 38: 88 checkboxes across sections.
        Maps PreSeasonChecklist boolean fields to checkbox values.
        When no checklist exists, auto-derives checkboxes from existing
        platform data (water tests, training, PUR submissions, etc.).
        """
        models = self._get_models()

        filters = {'company': self.company, 'season_year': self.season_year}
        if self.farm:
            filters['farm'] = self.farm

        checklist = _get_first_or_none(
            models['PreSeasonChecklist'].objects.filter(**filters)
        )

        cb_values = []
        if checklist:
            # Ground History section
            cb_values.extend([
                bool(checklist.non_ag_previous_use),
                bool(checklist.animal_husbandry_previous),
                bool(checklist.waste_storage_previous),
                bool(checklist.animal_activity_evidence),
                bool(checklist.flooding_occurred),
                bool(checklist.new_purchase_or_lease),
            ])

            # Adjacent Land section
            cb_values.extend([
                bool(checklist.adjacent_livestock),
                bool(checklist.adjacent_manure_storage),
            ])

            # Fertilizer section
            cb_values.extend([
                bool(checklist.raw_manure_used),
                bool(checklist.biosolids_used),
                bool(checklist.composted_manure_used),
                bool(checklist.heat_treated_manure_used),
                bool(checklist.soil_amendments_used),
                bool(checklist.nonsynthetic_treatments_used),
                bool(checklist.fertilizer_storage_safe),
            ])

            # Water section — auto-derive microbial_tests if not set
            microbial = checklist.microbial_tests_conducted
            if microbial is None:
                wt_filters = {'test_date__year': self.season_year}
                if self.farm:
                    wt_filters['water_source__farm'] = self.farm
                microbial = models['WaterTest'].objects.filter(**wt_filters).exists()
            cb_values.extend([
                bool(microbial),
                bool(checklist.backflow_prevention_in_use),
                bool(checklist.water_delivery_good_condition),
                bool(checklist.water_risk_factors_identified),
            ])

            # Worker Hygiene section — auto-derive workers_trained if not set
            workers_trained = checklist.workers_trained
            if workers_trained is None:
                ws_filters = {'company': self.company, 'training_date__year': self.season_year}
                if self.farm:
                    ws_filters['farm'] = self.farm
                workers_trained = models['WorkerTrainingSession'].objects.filter(**ws_filters).exists()
            cb_values.extend([
                bool(checklist.toilet_facilities_available),
                bool(checklist.toilet_facilities_maintained),
                bool(workers_trained),
                bool(checklist.first_aid_current),
                bool(checklist.access_roads_safe),
                bool(checklist.toilet_location_suitable),
                bool(checklist.service_company_procedures),
            ])

            # Necessary Records section — auto-derive from existing data
            # PCA/QAL license — check if team has PCA role member
            pca_current = checklist.pca_qal_license_current
            if pca_current is None:
                pca_current = models['CompanyMembership'].objects.filter(
                    company=self.company, is_active=True, role__codename='pca'
                ).exists()

            # PUR reports — check if submitted applications exist
            pur_current = checklist.pesticide_use_reports_current
            if pur_current is None:
                pur_filters = {'field__farm__company': self.company, 'submitted_to_pur': True}
                if self.farm:
                    pur_filters['field__farm'] = self.farm
                pur_current = models['PesticideApplication'].objects.filter(**pur_filters).exists()

            # Water tests current
            water_current = checklist.water_tests_current
            if water_current is None:
                wt_filters = {'test_date__year': self.season_year, 'status': 'pass'}
                if self.farm:
                    wt_filters['water_source__farm'] = self.farm
                water_current = models['WaterTest'].objects.filter(**wt_filters).exists()

            # Perimeter monitoring
            perim_current = checklist.perimeter_monitoring_log_current
            if perim_current is None:
                pm_filters = {'company': self.company}
                if self.farm:
                    pm_filters['farm'] = self.farm
                perim_current = models['PerimeterMonitoringLog'].objects.filter(**pm_filters).exists()

            # Restroom maintenance
            restroom_current = checklist.restroom_maintenance_log_current
            if restroom_current is None:
                sm_filters = {'company': self.company}
                if self.farm:
                    sm_filters['farm'] = self.farm
                restroom_current = models['SanitationMaintenanceLog'].objects.filter(**sm_filters).exists()

            # Training log
            training_current = checklist.training_log_current
            if training_current is None:
                training_current = bool(workers_trained)

            # Committee log
            committee_current = checklist.committee_log_current
            if committee_current is None:
                committee_current = models['FoodSafetyCommitteeMeeting'].objects.filter(
                    company=self.company, meeting_year=self.season_year
                ).exists()

            # Management review
            mgmt_current = checklist.management_review_current
            if mgmt_current is None:
                mgmt_current = models['ManagementVerificationReview'].objects.filter(
                    company=self.company, review_year=self.season_year
                ).exists()

            # Fertilizer log
            fert_current = checklist.fertilizer_log_current
            if fert_current is None:
                fert_filters = {'application_date__year': self.season_year}
                if self.farm:
                    field_ids = models['Field'].objects.filter(farm=self.farm).values_list('id', flat=True)
                    fert_filters['field__in'] = field_ids
                fert_current = models['NutrientApplication'].objects.filter(**fert_filters).exists()

            # Chemical inventory
            chem_current = checklist.chemical_inventory_current
            if chem_current is None:
                chem_current = models['ChemicalInventoryLog'].objects.filter(
                    company=self.company, inventory_year=self.season_year
                ).exists()

            cb_values.extend([
                bool(pca_current),
                bool(checklist.letters_of_guarantee_current),
                bool(pur_current),
                bool(water_current),
                bool(perim_current),
                bool(restroom_current),
                bool(training_current),
                bool(committee_current),
                bool(mgmt_current),
                bool(fert_current),
                bool(checklist.nuoca_forms_current),
                bool(chem_current),
            ])

            # Overall
            cb_values.extend([
                bool(checklist.deficiencies_found),
                bool(checklist.approved_for_season),
            ])

        # Pad to 88
        while len(cb_values) < 88:
            cb_values.append(False)
        cb_values = cb_values[:88]

        return {'_doc38_checkbox_values': cb_values}

    # ==================================================================
    # Doc 39 — Field Risk Assessment (Pages 115-120)
    # ==================================================================
    def get_doc39_fields(self):
        """
        Map FieldRiskAssessment to Doc 39 fields.

        Pages 115-120: 28 text fields + 21 checkboxes.
        """
        models = self._get_models()

        filters = {'company': self.company, 'season_year': self.season_year}
        if self.farm:
            filters['farm'] = self.farm

        assessment = _get_first_or_none(
            models['FieldRiskAssessment'].objects.filter(**filters)
        )

        values = []
        if assessment:
            # Auto-fill empty fields from existing data
            water_desc = _safe_str(assessment.water_sources_description)
            if not water_desc:
                ws_types = self._get_water_sources_for_farm()
                water_desc = ', '.join(ws_types) if ws_types else ''

            fert_suppliers = _safe_str(assessment.fertilizer_suppliers)
            if not fert_suppliers:
                fert_sups = list(
                    models['ApprovedSupplier'].objects
                    .filter(company=self.company, status='approved')
                    .order_by('supplier_name')
                )
                fert_list = [
                    s.supplier_name for s in fert_sups
                    if s.material_types and any(
                        'fert' in str(mt).lower() for mt in s.material_types
                    )
                ]
                fert_suppliers = ', '.join(fert_list)

            pest_suppliers = _safe_str(assessment.pesticide_suppliers)
            if not pest_suppliers:
                pest_list = [
                    s.supplier_name for s in fert_sups
                    if s.material_types and any(
                        'pest' in str(mt).lower() or 'chem' in str(mt).lower()
                        for mt in s.material_types
                    )
                ]
                pest_suppliers = ', '.join(pest_list)

            # Total acres — auto-derive from field/farm if empty
            total_acres = assessment.total_acres
            if not total_acres and self.farm:
                farm_fields = models['Field'].objects.filter(farm=self.farm)
                total_acres = sum(
                    float(f.total_acres) for f in farm_fields if f.total_acres
                )

            # Crops — auto-derive from field data if empty
            crops = assessment.crops_grown
            if not crops and self.farm:
                farm_fields = models['Field'].objects.filter(farm=self.farm)
                crop_set = set()
                for f in farm_fields:
                    if hasattr(f, 'crop') and f.crop:
                        crop_set.add(str(f.crop))
                crops = list(crop_set)

            # Harvest crew certification — auto-check
            harvest_arranged = _safe_str(assessment.harvest_arranged_by)
            if not harvest_arranged:
                labor_filters = {'harvest__field__farm__company': self.company}
                if self.farm:
                    labor_filters['harvest__field__farm'] = self.farm
                recent_labor = _get_first_or_none(
                    models['HarvestLabor'].objects
                    .filter(**labor_filters, harvest__harvest_date__year=self.season_year)
                    .select_related('contractor')
                    .order_by('-harvest__harvest_date')
                )
                if recent_labor and recent_labor.contractor:
                    harvest_arranged = recent_labor.contractor.company_name

            values = [
                # Header
                _safe_str(assessment.farm.name if assessment.farm else ''),
                _safe_str(assessment.field.name if assessment.field else ''),
                str(assessment.season_year),
                _fmt_date(assessment.assessment_date),
                _safe_str(assessment.assessed_by),
                _fmt_decimal(total_acres),
                _fmt_json_list(crops),
                _safe_str(assessment.structures_on_property),
                _safe_str(assessment.previous_land_use),
                _safe_str(assessment.adjacent_land_use),
                # Water sources detail
                water_desc,
                # Inputs detail
                fert_suppliers,
                pest_suppliers,
                # Worker detail
                _safe_str(assessment.toilet_type),
                _safe_str(assessment.maintenance_provider),
                _safe_str(assessment.labor_hired_by),
                harvest_arranged,
                # Risk summary JSON excerpts
                _fmt_json_list(assessment.land_contamination_risks, key='hazard', separator='; ')[:300],
                _fmt_json_list(assessment.water_source_risks, key='hazard', separator='; ')[:300],
                _fmt_json_list(assessment.agricultural_input_risks, key='hazard', separator='; ')[:300],
                _fmt_json_list(assessment.worker_hygiene_risks, key='hazard', separator='; ')[:300],
                _fmt_json_list(assessment.labor_harvesting_risks, key='hazard', separator='; ')[:300],
                # Summary
                assessment.get_overall_risk_level_display() if hasattr(assessment, 'get_overall_risk_level_display') else _safe_str(assessment.overall_risk_level),
                str(assessment.critical_risks_count),
                str(assessment.high_risks_count),
                # Sign-off
                _safe_str(assessment.reviewed_by),
                _fmt_date(assessment.review_date),
                _safe_str(assessment.notes),
            ]
        else:
            # No assessment — auto-populate from existing data
            farm_name = self.farm.name if self.farm else self.company.name
            total_acres = 0
            crops = []
            if self.farm:
                farm_fields = list(models['Field'].objects.filter(farm=self.farm))
                total_acres = sum(
                    float(f.total_acres) for f in farm_fields if f.total_acres
                )
                crop_set = set()
                for f in farm_fields:
                    if hasattr(f, 'crop') and f.crop:
                        crop_set.add(str(f.crop))
                crops = list(crop_set)

            ws_types = self._get_water_sources_for_farm()
            water_desc = ', '.join(ws_types) if ws_types else ''

            # Suppliers
            suppliers = list(
                models['ApprovedSupplier'].objects
                .filter(company=self.company, status='approved')
                .order_by('supplier_name')
            )
            fert_suppliers = ', '.join(
                s.supplier_name for s in suppliers
                if s.material_types and any(
                    'fert' in str(mt).lower() for mt in s.material_types
                )
            )
            pest_suppliers = ', '.join(
                s.supplier_name for s in suppliers
                if s.material_types and any(
                    'pest' in str(mt).lower() or 'chem' in str(mt).lower()
                    for mt in s.material_types
                )
            )

            values = [
                farm_name,
                '',  # field name
                str(self.season_year),
                '',  # assessment_date
                '',  # assessed_by
                _fmt_decimal(total_acres) if total_acres else '',
                _fmt_json_list(crops),
                '',  # structures
                '',  # previous_land_use
                '',  # adjacent_land_use
                water_desc,
                fert_suppliers,
                pest_suppliers,
                '',  # toilet_type
                '',  # maintenance_provider
                '',  # labor_hired_by
                '',  # harvest_arranged_by
                '',  # land risks
                '',  # water risks
                '',  # input risks
                '',  # hygiene risks
                '',  # labor risks
                '',  # overall risk
                '',  # critical count
                '',  # high count
                '',  # reviewed_by
                '',  # review_date
                '',  # notes
            ]

        return {'_doc39_positional_values': values}

    def get_doc39_positional_fields(self, field_names):
        """Map field risk assessment values to discovered PDF field names."""
        data = self.get_doc39_fields()
        values = data.get('_doc39_positional_values', [])
        fields = {}
        for i, name in enumerate(field_names):
            fields[name] = values[i] if i < len(values) else ''
        return fields

    def get_doc39_checkboxes(self):
        """
        Doc 39: 21 checkboxes for risk assessment matrix.
        Maps boolean fields from FieldRiskAssessment.
        """
        models = self._get_models()

        filters = {'company': self.company, 'season_year': self.season_year}
        if self.farm:
            filters['farm'] = self.farm

        assessment = _get_first_or_none(
            models['FieldRiskAssessment'].objects.filter(**filters)
        )

        cb_values = []
        if assessment:
            cb_values = [
                bool(assessment.recent_flood_event),
                bool(assessment.water_tests_conducted),
                bool(assessment.animal_amendments_used),
                bool(assessment.harvest_crew_certified),
            ]

            # Risk level indicators from JSON risk entries
            for risk_list_attr in [
                'land_contamination_risks', 'water_source_risks',
                'agricultural_input_risks', 'worker_hygiene_risks',
                'labor_harvesting_risks',
            ]:
                risk_list = getattr(assessment, risk_list_attr, []) or []
                # One checkbox per risk category for "has any risk entry"
                cb_values.append(bool(risk_list))
                # Check for high/critical
                has_high = any(
                    isinstance(r, dict) and r.get('probability') in ('high', 'critical')
                    for r in risk_list
                )
                cb_values.append(has_high)

            cb_values.append(assessment.approved)
        else:
            cb_values = []

        while len(cb_values) < 21:
            cb_values.append(False)
        cb_values = cb_values[:21]

        return {'_doc39_checkbox_values': cb_values}

    # ==================================================================
    # Aggregate Accessors
    # ==================================================================
    def get_all_fields(self):
        """
        Return a combined dict of all directly-mapped text field values.

        Fields whose names are known exactly (Doc 01-05, 09) are included
        directly. For table-based documents with positional fields, the
        returned dict includes special ``_docNN_*`` keys that the
        orchestrator resolves via ``discover_fields()`` and the
        ``get_docNN_positional_fields()`` helper.
        """
        fields = {}

        # Documents with known field names
        fields.update(self.get_doc01_fields())
        fields.update(self.get_doc02_fields())
        fields.update(self.get_doc03_fields())
        fields.update(self.get_doc04_fields())
        fields.update(self.get_doc05_fields())
        fields.update(self.get_doc09_fields())

        # Documents requiring positional mapping
        fields.update(self.get_doc06_fields())
        fields.update(self.get_doc09a_fields())
        fields.update(self.get_doc11_fields())
        fields.update(self.get_doc14_fields())
        fields.update(self.get_doc15_fields())
        fields.update(self.get_doc17_fields())
        fields.update(self.get_doc18_fields())
        fields.update(self.get_doc19_fields())
        fields.update(self.get_doc20_fields())
        fields.update(self.get_doc21_fields())
        fields.update(self.get_doc22_fields())
        fields.update(self.get_doc23_fields())
        fields.update(self.get_doc24_fields())
        fields.update(self.get_doc26_fields())
        fields.update(self.get_doc27_fields())
        fields.update(self.get_doc28a_fields())
        fields.update(self.get_doc29_fields())
        fields.update(self.get_doc37_fields())
        fields.update(self.get_doc38_fields())
        fields.update(self.get_doc39_fields())

        return fields

    def get_all_checkboxes(self):
        """
        Return a combined dict of all checkbox field values.

        Directly-named checkboxes (Doc 04, 09) are included. Documents
        with positional checkboxes (Doc 24, 38, 39) include
        ``_docNN_checkbox_values`` lists for the orchestrator to
        resolve via ``discover_fields()``.
        """
        checkboxes = {}

        checkboxes.update(self.get_doc01_checkboxes())
        checkboxes.update(self.get_doc02_checkboxes())
        checkboxes.update(self.get_doc03_checkboxes())
        checkboxes.update(self.get_doc04_checkboxes())
        checkboxes.update(self.get_doc05_checkboxes())
        checkboxes.update(self.get_doc06_checkboxes())
        checkboxes.update(self.get_doc09_checkboxes())
        checkboxes.update(self.get_doc09a_checkboxes())
        checkboxes.update(self.get_doc11_checkboxes())
        checkboxes.update(self.get_doc14_checkboxes())
        checkboxes.update(self.get_doc15_checkboxes())
        checkboxes.update(self.get_doc17_checkboxes())
        checkboxes.update(self.get_doc18_checkboxes())
        checkboxes.update(self.get_doc19_checkboxes())
        checkboxes.update(self.get_doc20_checkboxes())
        checkboxes.update(self.get_doc21_checkboxes())
        checkboxes.update(self.get_doc22_checkboxes())
        checkboxes.update(self.get_doc23_checkboxes())
        checkboxes.update(self.get_doc24_checkboxes())
        checkboxes.update(self.get_doc26_checkboxes())
        checkboxes.update(self.get_doc27_checkboxes())
        checkboxes.update(self.get_doc28a_checkboxes())
        checkboxes.update(self.get_doc29_checkboxes())
        checkboxes.update(self.get_doc37_checkboxes())
        checkboxes.update(self.get_doc38_checkboxes())
        checkboxes.update(self.get_doc39_checkboxes())

        return checkboxes

    def get_directly_mapped_fields(self):
        """
        Return only the text fields that have exact PDF field name keys
        (no ``_docNN_*`` positional placeholders). Safe to pass directly
        to ``CACPDFFieldFiller.fill_text_fields()``.
        """
        all_fields = self.get_all_fields()
        return {
            k: v for k, v in all_fields.items()
            if not k.startswith('_')
        }

    def get_directly_mapped_checkboxes(self):
        """
        Return only the checkboxes that have exact PDF field name keys
        (no ``_docNN_*`` positional placeholders). Safe to pass directly
        to ``CACPDFFieldFiller.fill_checkboxes()``.
        """
        all_cbs = self.get_all_checkboxes()
        return {
            k: v for k, v in all_cbs.items()
            if not k.startswith('_')
        }

    def resolve_positional_fields(self, fields_by_page):
        """
        Given a ``fields_by_page`` dict from
        ``CACPDFFieldFiller.discover_fields()``, resolve all positional
        document field mappings and return the complete text field dict.

        Args:
            fields_by_page: Dict mapping page_number -> list of
                            {'name': ..., 'type': ...} entries.

        Returns:
            Dict mapping PDF field names to values, ready for
            ``fill_text_fields()``.
        """
        resolved = dict(self.get_directly_mapped_fields())

        def _text_names_for_page(page_num):
            """Get text field names from a page in order."""
            return [
                f['name'] for f in fields_by_page.get(page_num, [])
                if f.get('type') == 'text'
            ]

        def _cb_names_for_page(page_num):
            """Get checkbox field names from a page in order."""
            return [
                f['name'] for f in fields_by_page.get(page_num, [])
                if f.get('type') == 'checkbox'
            ]

        # Doc 06 — Training Matrix (page 21)
        p21_names = _text_names_for_page(21)
        if p21_names:
            resolved.update(self.get_doc06_positional_fields(p21_names))

        # Doc 09A — Employee Non-Conformance (page 29)
        p29_names = _text_names_for_page(29)
        if p29_names:
            resolved.update(self.get_doc09a_positional_fields(p29_names))

        # Doc 11 — Product Hold (page 35)
        p35_names = _text_names_for_page(35)
        if p35_names:
            resolved.update(self.get_doc11_positional_fields(p35_names))

        # Doc 14 — Suppliers (pages 43 + 45)
        p43_names = _text_names_for_page(43)
        p45_names = _text_names_for_page(45)
        if p43_names or p45_names:
            resolved.update(
                self.get_doc14_positional_fields(p43_names, p45_names)
            )

        # Doc 15 — Supplier Verification (page 47)
        p47_names = _text_names_for_page(47)
        if p47_names:
            resolved.update(self.get_doc15_positional_fields(p47_names))

        # Doc 17 — Mock Recall (page 51)
        p51_names = _text_names_for_page(51)
        if p51_names:
            resolved.update(self.get_doc17_positional_fields(p51_names))

        # Doc 18 — Food Fraud (page 53)
        p53_names = _text_names_for_page(53)
        if p53_names:
            resolved.update(self.get_doc18_positional_fields(p53_names))

        # Doc 19 — Food Defense (page 56)
        p56_names = _text_names_for_page(56)
        if p56_names:
            resolved.update(self.get_doc19_positional_fields(p56_names))

        # Doc 20 — Visitor Log (page 57)
        p57_names = _text_names_for_page(57)
        if p57_names:
            resolved.update(self.get_doc20_positional_fields(p57_names))

        # Doc 21 — Emergency Contacts (page 59)
        p59_names = _text_names_for_page(59)
        if p59_names:
            resolved.update(self.get_doc21_positional_fields(p59_names))

        # Doc 22 — Soils/Land Use (page 61)
        p61_names = _text_names_for_page(61)
        if p61_names:
            resolved.update(self.get_doc22_positional_fields(p61_names))

        # Doc 23 — Animals/Wildlife (page 65)
        p65_names = _text_names_for_page(65)
        if p65_names:
            resolved.update(self.get_doc23_positional_fields(p65_names))

        # Doc 24 — Perimeter Monitoring (page 67)
        p67_names = _text_names_for_page(67)
        if p67_names:
            resolved.update(self.get_doc24_positional_fields(p67_names))

        # Doc 26 — Fertilizer Log (page 73)
        p73_names = _text_names_for_page(73)
        if p73_names:
            resolved.update(self.get_doc26_positional_fields(p73_names))

        # Doc 28A — Sprayer Calibration (page 83)
        p83_names = _text_names_for_page(83)
        if p83_names:
            resolved.update(self.get_doc28a_positional_fields(p83_names))

        # Doc 29 — Chemical Inventory (page 85)
        p85_names = _text_names_for_page(85)
        if p85_names:
            resolved.update(self.get_doc29_positional_fields(p85_names))

        # Doc 37 — Training Log (page 109)
        p109_names = _text_names_for_page(109)
        if p109_names:
            resolved.update(self.get_doc37_positional_fields(p109_names))

        # Doc 38 — Pre-Season (pages 113-114)
        p113_114_names = _text_names_for_page(113) + _text_names_for_page(114)
        if p113_114_names:
            resolved.update(self.get_doc38_positional_fields(p113_114_names))

        # Doc 39 — Field Risk (pages 115-120)
        p39_names = []
        for pg in range(115, 121):
            p39_names.extend(_text_names_for_page(pg))
        if p39_names:
            resolved.update(self.get_doc39_positional_fields(p39_names))

        return resolved

    def resolve_positional_checkboxes(self, fields_by_page):
        """
        Given a ``fields_by_page`` dict, resolve all positional checkbox
        mappings and return the complete checkbox dict.

        Args:
            fields_by_page: Dict from ``CACPDFFieldFiller.discover_fields()``.

        Returns:
            Dict mapping PDF checkbox field names to booleans.
        """
        resolved = dict(self.get_directly_mapped_checkboxes())

        def _cb_names_for_page(page_num):
            return [
                f['name'] for f in fields_by_page.get(page_num, [])
                if f.get('type') == 'checkbox'
            ]

        # Doc 23 — Animals checkboxes (page 65)
        p65_cbs = _cb_names_for_page(65)
        if p65_cbs:
            cb_data = self.get_doc23_checkboxes()
            # Map positional keys to actual field names
            positional_keys = [
                '_doc23_cb_deer', '_doc23_cb_coyote', '_doc23_cb_rodent',
                '_doc23_cb_bird', '_doc23_cb_feral_pig', '_doc23_cb_rabbit',
                '_doc23_cb_other',
            ]
            for i, name in enumerate(p65_cbs):
                if i < len(positional_keys):
                    resolved[name] = cb_data.get(positional_keys[i], False)
                else:
                    resolved[name] = False

        # Doc 24 — Perimeter monitoring checkboxes (page 67)
        p67_cbs = _cb_names_for_page(67)
        if p67_cbs:
            cb_data = self.get_doc24_checkboxes()
            values = cb_data.get('_doc24_checkbox_values', [])
            for i, name in enumerate(p67_cbs):
                resolved[name] = values[i] if i < len(values) else False

        # Doc 38 — Pre-season checkboxes (pages 113-114)
        p38_cbs = _cb_names_for_page(113) + _cb_names_for_page(114)
        if p38_cbs:
            cb_data = self.get_doc38_checkboxes()
            values = cb_data.get('_doc38_checkbox_values', [])
            for i, name in enumerate(p38_cbs):
                resolved[name] = values[i] if i < len(values) else False

        # Doc 39 — Field risk checkboxes (pages 115-120)
        p39_cbs = []
        for pg in range(115, 121):
            p39_cbs.extend(_cb_names_for_page(pg))
        if p39_cbs:
            cb_data = self.get_doc39_checkboxes()
            values = cb_data.get('_doc39_checkbox_values', [])
            for i, name in enumerate(p39_cbs):
                resolved[name] = values[i] if i < len(values) else False

        return resolved

    def fill_pdf(self, filler):
        """
        Convenience method: discover fields, resolve all mappings,
        and fill the given ``CACPDFFieldFiller`` instance.

        Args:
            filler: A ``CACPDFFieldFiller`` instance (from cac_pdf_filler.py).

        Returns:
            The same filler instance (for chaining).
        """
        from api.services.primusgfs.cac_pdf_filler import CACPDFFieldFiller

        # Discover all PDF form fields
        fields_by_page = filler.discover_fields(filler.template_path)

        # Resolve text fields
        text_fields = self.resolve_positional_fields(fields_by_page)
        filler.fill_text_fields(text_fields)

        # Resolve checkboxes
        checkbox_fields = self.resolve_positional_checkboxes(fields_by_page)
        filler.fill_checkboxes(checkbox_fields)

        # Apply signatures
        self._apply_signatures(filler)

        return filler

    def _apply_signatures(self, filler):
        """
        Overlay any captured signatures from CACDocumentSignature.
        """
        from api.models.primusgfs import CACDocumentSignature

        signatures = CACDocumentSignature.objects.filter(
            company=self.company,
            season_year=self.season_year,
            signed=True,
        ).exclude(signature_data='')

        for sig in signatures:
            if sig.signature_data:
                # Default placement: centered on signature line area
                # These positions would be refined per-document in production
                filler.overlay_signature(
                    page_number=sig.page_number,
                    signature_base64=sig.signature_data,
                    x=150,
                    y=100,
                    width=150,
                    height=40,
                )
