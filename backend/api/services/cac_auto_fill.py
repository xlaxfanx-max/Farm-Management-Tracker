"""
CAC Food Safety Manual Auto-Fill Service

Registry of functions that extract data from existing system models
to populate CAC audit binder sections. Each function returns a dict
of field_name → value pairs suitable for display and PDF form filling.
"""

from datetime import date
from django.db.models import Q


# =============================================================================
# REGISTRY
# =============================================================================

AUTO_FILL_REGISTRY = {}


def register(key):
    """Decorator to register an auto-fill function."""
    def decorator(func):
        AUTO_FILL_REGISTRY[key] = func
        return func
    return decorator


def get_auto_fill_data(source_key, company_id, farm_id=None, season_year=None):
    """
    Look up and execute the auto-fill function for the given source key.
    Returns a dict with 'fields' (list of {name, value, source}) and 'warnings'.
    """
    func = AUTO_FILL_REGISTRY.get(source_key)
    if not func:
        return {'fields': [], 'warnings': [f'No auto-fill function registered for "{source_key}"']}

    try:
        return func(company_id, farm_id=farm_id, season_year=season_year)
    except Exception as e:
        return {'fields': [], 'warnings': [f'Auto-fill error: {str(e)}']}


def _field(name, value, source=''):
    """Helper to create a standardized field dict."""
    return {'name': name, 'value': str(value) if value is not None else '', 'source': source}


# =============================================================================
# DOC 01 - RANCH INFORMATION
# =============================================================================

@register('ranch_info')
def fill_ranch_info(company_id, farm_id=None, season_year=None):
    from api.models import Company, Farm, CompanyMembership

    fields = []
    warnings = []

    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        return {'fields': [], 'warnings': ['Company not found']}

    fields.append(_field('Company/Ranch Name', company.name, 'Company'))
    fields.append(_field('Legal Business Name', company.legal_name or company.name, 'Company'))
    fields.append(_field('Address', company.address, 'Company'))
    fields.append(_field('City', company.city, 'Company'))
    fields.append(_field('County', company.county, 'Company'))
    fields.append(_field('State', company.state, 'Company'))
    fields.append(_field('Zip Code', company.zip_code, 'Company'))
    fields.append(_field('Phone', company.phone, 'Company'))
    fields.append(_field('Email', company.email, 'Company'))
    fields.append(_field('Primary Contact', company.primary_contact_name, 'Company'))

    # Farm-specific info
    farm_qs = Farm.objects.filter(company=company)
    if farm_id:
        farm_qs = farm_qs.filter(id=farm_id)

    farms = list(farm_qs)
    if farms:
        farm = farms[0]
        fields.append(_field('Farm/Ranch Name', farm.name, f'Farm: {farm.name}'))
        fields.append(_field('Farm Owner', farm.owner_name, f'Farm: {farm.name}'))
        fields.append(_field('Farm Operator', farm.operator_name, f'Farm: {farm.name}'))
        fields.append(_field('Farm Address', farm.address, f'Farm: {farm.name}'))
        fields.append(_field('Farm Phone', farm.phone, f'Farm: {farm.name}'))
        if farm.has_coordinates:
            fields.append(_field('GPS Coordinates', f'{farm.gps_latitude}, {farm.gps_longitude}', f'Farm: {farm.name}'))
        if farm.has_plss:
            fields.append(_field('PLSS Location', farm.plss_display, f'Farm: {farm.name}'))
        if len(farms) > 1:
            warnings.append(f'Multiple farms found ({len(farms)}). Showing data for: {farm.name}')
    else:
        warnings.append('No farms found for this company.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 02 - ORGANIZATIONAL STRUCTURE
# =============================================================================

@register('org_structure')
def fill_org_structure(company_id, farm_id=None, season_year=None):
    from api.models import Company, CompanyMembership

    fields = []
    warnings = []

    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        return {'fields': [], 'warnings': ['Company not found']}

    fields.append(_field('Organization Name', company.name, 'Company'))

    members = CompanyMembership.objects.filter(
        company=company
    ).select_related('user', 'role').order_by('role__name')

    for i, member in enumerate(members):
        role_name = member.role.name if member.role else 'Staff'
        user = member.user
        fields.append(_field(
            f'Team Member {i+1}',
            f'{user.get_full_name()} - {role_name} ({user.job_title or "N/A"})',
            'CompanyMembership'
        ))

    if not members.exists():
        warnings.append('No team members found. Add staff via Team Management.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 04 - FOOD SAFETY COMMITTEE MEETING LOG
# =============================================================================

@register('committee_log')
def fill_committee_log(company_id, farm_id=None, season_year=None):
    from api.models import SafetyMeeting, SafetyMeetingAttendee

    fields = []
    warnings = []
    year = season_year or date.today().year

    meetings = SafetyMeeting.objects.filter(
        company_id=company_id,
        year=year,
    ).order_by('meeting_date')

    if not meetings.exists():
        meetings = SafetyMeeting.objects.filter(
            company_id=company_id,
        ).order_by('-meeting_date')[:10]
        if meetings.exists():
            warnings.append(f'No meetings found for {year}. Showing most recent meetings.')

    for i, meeting in enumerate(meetings):
        attendees = SafetyMeetingAttendee.objects.filter(meeting=meeting)
        attendee_names = ', '.join(a.attendee_name for a in attendees[:5])
        if attendees.count() > 5:
            attendee_names += f' (+{attendees.count() - 5} more)'

        topics = meeting.topics_covered or []
        topic_str = ', '.join(topics[:3]) if isinstance(topics, list) else str(topics)

        fields.append(_field(f'Meeting {i+1} Date', meeting.meeting_date.strftime('%m/%d/%Y'), 'SafetyMeeting'))
        fields.append(_field(f'Meeting {i+1} Type', meeting.get_meeting_type_display(), 'SafetyMeeting'))
        fields.append(_field(f'Meeting {i+1} Topics', topic_str, 'SafetyMeeting'))
        fields.append(_field(f'Meeting {i+1} Trainer', meeting.trainer_name, 'SafetyMeeting'))
        fields.append(_field(f'Meeting {i+1} Attendees', attendee_names, 'SafetyMeetingAttendee'))
        fields.append(_field(f'Meeting {i+1} Location', meeting.location, 'SafetyMeeting'))

    if not meetings.exists():
        warnings.append('No safety meetings found. Record meetings via FSMA > Safety Meetings.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 20 - VISITOR LOG
# =============================================================================

@register('visitor_log')
def fill_visitor_log(company_id, farm_id=None, season_year=None):
    from api.models import VisitorLog

    fields = []
    warnings = []
    year = season_year or date.today().year

    qs = VisitorLog.objects.filter(
        company_id=company_id,
        visit_date__year=year,
    ).order_by('-visit_date')

    if farm_id:
        qs = qs.filter(Q(facility__farm_id=farm_id) | Q(facility__isnull=True))

    visitors = qs[:50]

    for i, v in enumerate(visitors):
        fields.append(_field(f'Visitor {i+1} Name', v.visitor_name, 'VisitorLog'))
        fields.append(_field(f'Visitor {i+1} Company', v.visitor_company, 'VisitorLog'))
        fields.append(_field(f'Visitor {i+1} Date', v.visit_date.strftime('%m/%d/%Y'), 'VisitorLog'))
        fields.append(_field(f'Visitor {i+1} Time In', v.time_in.strftime('%H:%M') if v.time_in else '', 'VisitorLog'))
        fields.append(_field(f'Visitor {i+1} Time Out', v.time_out.strftime('%H:%M') if v.time_out else '', 'VisitorLog'))
        fields.append(_field(f'Visitor {i+1} Purpose', v.purpose or '', 'VisitorLog'))
        fields.append(_field(f'Visitor {i+1} Health Screening', 'Passed' if v.health_screening_passed else 'N/A', 'VisitorLog'))

    total = qs.count()
    if total > 50:
        warnings.append(f'Showing 50 of {total} visitor records for {year}.')
    if total == 0:
        warnings.append(f'No visitor log entries found for {year}.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 22 - SOILS / LAND USE ASSESSMENT
# =============================================================================

@register('land_history')
def fill_land_history(company_id, farm_id=None, season_year=None):
    from api.models import Farm, LandHistoryAssessment, Field

    fields = []
    warnings = []

    qs = LandHistoryAssessment.objects.filter(company_id=company_id)
    if farm_id:
        qs = qs.filter(field__farm_id=farm_id)

    assessments = qs.select_related('field', 'field__farm').order_by('-assessment_date')

    for i, a in enumerate(assessments):
        field_name = a.field.name if a.field else 'Unknown'
        farm_name = a.field.farm.name if a.field and a.field.farm else 'Unknown'
        prefix = f'Assessment {i+1}'

        fields.append(_field(f'{prefix} Field', f'{field_name} ({farm_name})', 'LandHistoryAssessment'))
        fields.append(_field(f'{prefix} Date', a.assessment_date.strftime('%m/%d/%Y'), 'LandHistoryAssessment'))
        fields.append(_field(f'{prefix} Risk Level', a.get_contamination_risk_display(), 'LandHistoryAssessment'))
        fields.append(_field(f'{prefix} Previous Pesticide Use', 'Yes' if a.previous_pesticide_use else 'No', 'LandHistoryAssessment'))
        fields.append(_field(f'{prefix} Flood Zone', 'Yes' if a.flood_zone else 'No', 'LandHistoryAssessment'))
        fields.append(_field(f'{prefix} Adjacent Risk', 'Yes' if a.adjacent_contamination_risk else 'No', 'LandHistoryAssessment'))
        fields.append(_field(f'{prefix} Soil Testing', 'Yes' if a.soil_testing_conducted else 'No', 'LandHistoryAssessment'))
        if a.risk_justification:
            fields.append(_field(f'{prefix} Justification', a.risk_justification, 'LandHistoryAssessment'))

    # Also pull farm-level data
    farm_qs = Farm.objects.filter(company_id=company_id)
    if farm_id:
        farm_qs = farm_qs.filter(id=farm_id)

    for farm in farm_qs:
        fields.append(_field(f'Farm "{farm.name}" Flooding History', 'Yes' if farm.flooding_history else 'No', 'Farm'))
        if farm.adjacent_land_uses:
            uses = farm.adjacent_land_uses if isinstance(farm.adjacent_land_uses, list) else [farm.adjacent_land_uses]
            fields.append(_field(f'Farm "{farm.name}" Adjacent Land Uses', ', '.join(str(u) for u in uses), 'Farm'))

    if not assessments.exists():
        warnings.append('No land history assessments found. Create one via PrimusGFS > Land History.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 23 - APPROVED SUPPLIER LIST
# =============================================================================

@register('approved_suppliers')
def fill_approved_suppliers(company_id, farm_id=None, season_year=None):
    from api.models import ApprovedSupplier

    fields = []
    warnings = []

    suppliers = ApprovedSupplier.objects.filter(
        company_id=company_id,
    ).exclude(status='removed').order_by('supplier_name')

    for i, s in enumerate(suppliers):
        materials = s.material_types or []
        mat_str = ', '.join(materials) if isinstance(materials, list) else str(materials)
        certs = s.certifications or []
        cert_str = ', '.join(certs) if isinstance(certs, list) else str(certs)

        fields.append(_field(f'Supplier {i+1} Name', s.supplier_name, 'ApprovedSupplier'))
        fields.append(_field(f'Supplier {i+1} Status', s.get_status_display(), 'ApprovedSupplier'))
        fields.append(_field(f'Supplier {i+1} Materials', mat_str, 'ApprovedSupplier'))
        fields.append(_field(f'Supplier {i+1} Contact', s.contact_name, 'ApprovedSupplier'))
        fields.append(_field(f'Supplier {i+1} Phone', s.contact_phone, 'ApprovedSupplier'))
        fields.append(_field(f'Supplier {i+1} Certifications', cert_str, 'ApprovedSupplier'))
        if s.approved_date:
            fields.append(_field(f'Supplier {i+1} Approved Date', s.approved_date.strftime('%m/%d/%Y'), 'ApprovedSupplier'))
        if s.next_review_date:
            fields.append(_field(f'Supplier {i+1} Next Review', s.next_review_date.strftime('%m/%d/%Y'), 'ApprovedSupplier'))

    if not suppliers.exists():
        warnings.append('No approved suppliers found. Add suppliers via PrimusGFS > Suppliers.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 24 - PERIMETER MONITORING
# =============================================================================

@register('perimeter_monitoring')
def fill_perimeter_monitoring(company_id, farm_id=None, season_year=None):
    from api.models import WaterSource, Farm

    fields = []
    warnings = []

    farm_qs = Farm.objects.filter(company_id=company_id)
    if farm_id:
        farm_qs = farm_qs.filter(id=farm_id)

    sources = WaterSource.objects.filter(farm__in=farm_qs).select_related('farm')

    for i, ws in enumerate(sources):
        prefix = f'Water Source {i+1}'
        fields.append(_field(f'{prefix} Name', ws.name, 'WaterSource'))
        fields.append(_field(f'{prefix} Type', ws.get_source_type_display(), 'WaterSource'))
        fields.append(_field(f'{prefix} Farm', ws.farm.name, 'WaterSource'))
        fields.append(_field(f'{prefix} Wellhead Condition', ws.fsma_wellhead_condition or 'N/A', 'WaterSource'))
        fields.append(_field(f'{prefix} Well Cap Secure', 'Yes' if ws.fsma_well_cap_secure else 'No', 'WaterSource'))
        fields.append(_field(f'{prefix} Casing Intact', 'Yes' if ws.fsma_well_casing_intact else 'No', 'WaterSource'))
        fields.append(_field(f'{prefix} Backflow Prevention', 'Yes' if ws.fsma_backflow_prevention else 'No', 'WaterSource'))
        fields.append(_field(f'{prefix} Distribution', ws.fsma_distribution_type or 'N/A', 'WaterSource'))
        fields.append(_field(f'{prefix} Animal Access Risk', 'Yes' if ws.fsma_animal_access_possible else 'No', 'WaterSource'))

    if not sources.exists():
        warnings.append('No water sources found. Add water sources via Water Management.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 26 - FERTILIZER APPLICATION LOG
# =============================================================================

@register('fertilizer_log')
def fill_fertilizer_log(company_id, farm_id=None, season_year=None):
    from api.models import NutrientApplication, Farm

    fields = []
    warnings = []
    year = season_year or date.today().year

    farm_qs = Farm.objects.filter(company_id=company_id)
    if farm_id:
        farm_qs = farm_qs.filter(id=farm_id)

    apps = NutrientApplication.objects.filter(
        field__farm__in=farm_qs,
        application_date__year=year,
    ).select_related('field', 'field__farm', 'product').order_by('application_date')

    for i, app in enumerate(apps):
        prefix = f'Application {i+1}'
        fields.append(_field(f'{prefix} Date', app.application_date.strftime('%m/%d/%Y'), 'NutrientApplication'))
        fields.append(_field(f'{prefix} Field', f'{app.field.name} ({app.field.farm.name})', 'NutrientApplication'))
        fields.append(_field(f'{prefix} Product', app.product.name if app.product else '', 'NutrientApplication'))
        fields.append(_field(f'{prefix} Rate', f'{app.rate} {app.get_rate_unit_display()}', 'NutrientApplication'))
        fields.append(_field(f'{prefix} Acres', str(app.acres_treated), 'NutrientApplication'))
        fields.append(_field(f'{prefix} Method', app.get_application_method_display(), 'NutrientApplication'))
        fields.append(_field(f'{prefix} Applied By', app.applied_by, 'NutrientApplication'))
        if app.product:
            npk = f'{app.product.nitrogen_pct or 0}-{app.product.phosphorus_pct or 0}-{app.product.potassium_pct or 0}'
            fields.append(_field(f'{prefix} NPK', npk, 'FertilizerProduct'))

    total = apps.count()
    if total == 0:
        warnings.append(f'No fertilizer applications found for {year}.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 27 - WATER USAGE & TESTING LOG
# =============================================================================

@register('water_usage')
def fill_water_usage(company_id, farm_id=None, season_year=None):
    from api.models import WaterSource, WaterTest, IrrigationEvent, Farm

    fields = []
    warnings = []
    year = season_year or date.today().year

    farm_qs = Farm.objects.filter(company_id=company_id)
    if farm_id:
        farm_qs = farm_qs.filter(id=farm_id)

    # Water sources
    sources = WaterSource.objects.filter(farm__in=farm_qs).select_related('farm')
    for i, ws in enumerate(sources):
        fields.append(_field(f'Source {i+1} Name', ws.name, 'WaterSource'))
        fields.append(_field(f'Source {i+1} Type', ws.get_source_type_display(), 'WaterSource'))
        fields.append(_field(f'Source {i+1} Used For Irrigation', 'Yes' if ws.used_for_irrigation else 'No', 'WaterSource'))
        fields.append(_field(f'Source {i+1} Used For Washing', 'Yes' if ws.used_for_washing else 'No', 'WaterSource'))

    # Water tests
    tests = WaterTest.objects.filter(
        water_source__farm__in=farm_qs,
        test_date__year=year,
    ).select_related('water_source').order_by('test_date')

    for i, test in enumerate(tests):
        prefix = f'Test {i+1}'
        fields.append(_field(f'{prefix} Source', test.water_source.name, 'WaterTest'))
        fields.append(_field(f'{prefix} Date', test.test_date.strftime('%m/%d/%Y'), 'WaterTest'))
        fields.append(_field(f'{prefix} Lab', test.lab_name, 'WaterTest'))
        fields.append(_field(f'{prefix} E. coli', str(test.ecoli_result or 'N/A'), 'WaterTest'))
        fields.append(_field(f'{prefix} Total Coliform', str(test.total_coliform_result or 'N/A'), 'WaterTest'))
        fields.append(_field(f'{prefix} pH', str(test.ph_level or 'N/A'), 'WaterTest'))
        fields.append(_field(f'{prefix} Status', test.get_status_display(), 'WaterTest'))

    if not tests.exists():
        warnings.append(f'No water tests found for {year}. Record tests via Water Management.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 28 - CROP PROTECTION MATERIALS LOG
# =============================================================================

@register('crop_protection')
def fill_crop_protection(company_id, farm_id=None, season_year=None):
    from api.models import PesticideApplication, Farm

    fields = []
    warnings = []
    year = season_year or date.today().year

    farm_qs = Farm.objects.filter(company_id=company_id)
    if farm_id:
        farm_qs = farm_qs.filter(id=farm_id)

    apps = PesticideApplication.objects.filter(
        field__farm__in=farm_qs,
        application_date__year=year,
    ).select_related('field', 'field__farm', 'product').order_by('application_date')

    for i, app in enumerate(apps):
        prefix = f'Application {i+1}'
        fields.append(_field(f'{prefix} Date', app.application_date.strftime('%m/%d/%Y'), 'PesticideApplication'))
        fields.append(_field(f'{prefix} Field', f'{app.field.name} ({app.field.farm.name})', 'PesticideApplication'))
        fields.append(_field(f'{prefix} Product', app.product.product_name, 'PesticideApplication'))
        fields.append(_field(f'{prefix} EPA Reg #', app.product.epa_registration_number, 'PesticideProduct'))
        fields.append(_field(f'{prefix} Active Ingredient', app.product.active_ingredients, 'PesticideProduct'))
        fields.append(_field(f'{prefix} Amount', f'{app.amount_used} {app.get_unit_of_measure_display()}', 'PesticideApplication'))
        fields.append(_field(f'{prefix} Method', app.get_application_method_display(), 'PesticideApplication'))
        fields.append(_field(f'{prefix} Target Pest', app.target_pest, 'PesticideApplication'))
        fields.append(_field(f'{prefix} Applicator', app.applicator_name, 'PesticideApplication'))
        fields.append(_field(f'{prefix} Acres Treated', str(app.acres_treated), 'PesticideApplication'))

    if not apps.exists():
        warnings.append(f'No pesticide applications found for {year}.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 29 - CHEMICAL INVENTORY
# =============================================================================

@register('chemical_inventory')
def fill_chemical_inventory(company_id, farm_id=None, season_year=None):
    from api.models import PesticideProduct, FertilizerProduct, PesticideApplication, NutrientApplication, Farm

    fields = []
    warnings = []

    farm_qs = Farm.objects.filter(company_id=company_id)
    if farm_id:
        farm_qs = farm_qs.filter(id=farm_id)

    # Get pesticide products used by this company
    used_product_ids = PesticideApplication.objects.filter(
        field__farm__in=farm_qs
    ).values_list('product_id', flat=True).distinct()

    pesticides = PesticideProduct.objects.filter(id__in=used_product_ids).order_by('product_name')

    for i, p in enumerate(pesticides):
        prefix = f'Pesticide {i+1}'
        fields.append(_field(f'{prefix} Name', p.product_name, 'PesticideProduct'))
        fields.append(_field(f'{prefix} EPA Reg #', p.epa_registration_number, 'PesticideProduct'))
        fields.append(_field(f'{prefix} Active Ingredient', p.active_ingredients, 'PesticideProduct'))
        fields.append(_field(f'{prefix} Type', p.get_product_type_display() if p.product_type else '', 'PesticideProduct'))
        fields.append(_field(f'{prefix} Signal Word', p.signal_word or '', 'PesticideProduct'))
        fields.append(_field(f'{prefix} Restricted Use', 'Yes' if p.restricted_use else 'No', 'PesticideProduct'))
        fields.append(_field(f'{prefix} REI (hours)', str(p.rei_hours or 'N/A'), 'PesticideProduct'))

    # Fertilizer products used
    used_fert_ids = NutrientApplication.objects.filter(
        field__farm__in=farm_qs
    ).values_list('product_id', flat=True).distinct()

    fertilizers = FertilizerProduct.objects.filter(id__in=used_fert_ids).order_by('name')

    for i, f in enumerate(fertilizers):
        prefix = f'Fertilizer {i+1}'
        fields.append(_field(f'{prefix} Name', f.name, 'FertilizerProduct'))
        fields.append(_field(f'{prefix} Manufacturer', f.manufacturer, 'FertilizerProduct'))
        npk = f'{f.nitrogen_pct or 0}-{f.phosphorus_pct or 0}-{f.potassium_pct or 0}'
        fields.append(_field(f'{prefix} NPK', npk, 'FertilizerProduct'))
        fields.append(_field(f'{prefix} Form', f.get_form_display() if f.form else '', 'FertilizerProduct'))
        fields.append(_field(f'{prefix} Organic', 'Yes' if f.is_organic else 'No', 'FertilizerProduct'))

    if not pesticides.exists() and not fertilizers.exists():
        warnings.append('No chemicals found in inventory. Record applications first.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 34 - TOILET / HANDWASHING MAINTENANCE LOG
# =============================================================================

@register('toilet_maintenance')
def fill_toilet_maintenance(company_id, farm_id=None, season_year=None):
    from api.models import FacilityCleaningLog, FacilityLocation

    fields = []
    warnings = []
    year = season_year or date.today().year

    facility_qs = FacilityLocation.objects.filter(company_id=company_id)
    if farm_id:
        facility_qs = facility_qs.filter(farm_id=farm_id)

    # Get sanitation-type facilities
    toilet_facilities = facility_qs.filter(
        Q(facility_type='restroom') | Q(facility_type='handwash') | Q(facility_type='portable_toilet')
    )

    logs = FacilityCleaningLog.objects.filter(
        facility__in=toilet_facilities,
        cleaning_date__year=year,
    ).select_related('facility', 'cleaned_by').order_by('-cleaning_date')[:50]

    for i, log in enumerate(logs):
        prefix = f'Cleaning {i+1}'
        fields.append(_field(f'{prefix} Facility', log.facility.name if log.facility else 'Unknown', 'FacilityCleaningLog'))
        fields.append(_field(f'{prefix} Date', log.cleaning_date.strftime('%m/%d/%Y'), 'FacilityCleaningLog'))
        fields.append(_field(f'{prefix} Time', log.cleaning_time.strftime('%H:%M') if log.cleaning_time else '', 'FacilityCleaningLog'))
        cleaner = log.cleaned_by_name or (log.cleaned_by.get_full_name() if log.cleaned_by else '')
        fields.append(_field(f'{prefix} Cleaned By', cleaner, 'FacilityCleaningLog'))
        fields.append(_field(f'{prefix} Supplies Restocked', 'Yes' if log.supplies_restocked else 'No', 'FacilityCleaningLog'))
        fields.append(_field(f'{prefix} Sanitizer Applied', 'Yes' if log.sanitizer_applied else 'No', 'FacilityCleaningLog'))

    if not logs.exists():
        warnings.append(f'No toilet/handwashing cleaning logs found for {year}.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 37 - TRAINING LOG
# =============================================================================

@register('training_log')
def fill_training_log(company_id, farm_id=None, season_year=None):
    from api.models import SafetyMeeting, SafetyMeetingAttendee

    fields = []
    warnings = []
    year = season_year or date.today().year

    meetings = SafetyMeeting.objects.filter(
        company_id=company_id,
        year=year,
    ).order_by('meeting_date')

    if not meetings.exists():
        meetings = SafetyMeeting.objects.filter(
            company_id=company_id,
        ).order_by('-meeting_date')[:10]
        if meetings.exists():
            warnings.append(f'No training records for {year}. Showing most recent.')

    for meeting in meetings:
        attendees = SafetyMeetingAttendee.objects.filter(meeting=meeting).order_by('attendee_name')
        topics = meeting.topics_covered or []
        topic_str = ', '.join(topics) if isinstance(topics, list) else str(topics)

        for j, att in enumerate(attendees):
            prefix = f'{meeting.meeting_date.strftime("%m/%d/%Y")} - {att.attendee_name}'
            fields.append(_field(f'Training: {prefix}',
                                 f'Topics: {topic_str} | Trainer: {meeting.trainer_name}',
                                 'SafetyMeeting + Attendee'))

    if not meetings.exists():
        warnings.append('No training records found. Record safety meetings via FSMA > Safety Meetings.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 38 - PRE-SEASON SELF-ASSESSMENT CHECKLIST
# =============================================================================

@register('pre_season_assessment')
def fill_pre_season_assessment(company_id, farm_id=None, season_year=None):
    from api.models import Farm, WaterSource, WaterTest, Field

    fields = []
    warnings = []

    farm_qs = Farm.objects.filter(company_id=company_id)
    if farm_id:
        farm_qs = farm_qs.filter(id=farm_id)

    for farm in farm_qs:
        prefix = farm.name

        # Ground History
        fields.append(_field(f'{prefix}: Flooding History', 'Yes' if farm.flooding_history else 'No', 'Farm'))
        fields.append(_field(f'{prefix}: Septic Nearby', 'Yes' if farm.septic_nearby else 'No', 'Farm'))
        fields.append(_field(f'{prefix}: Nearest Animal Operation (ft)', str(farm.nearest_animal_operation_ft or 'Unknown'), 'Farm'))

        # Adjacent land
        if farm.adjacent_land_uses:
            uses = farm.adjacent_land_uses if isinstance(farm.adjacent_land_uses, list) else []
            fields.append(_field(f'{prefix}: Adjacent Land Uses', ', '.join(str(u) for u in uses), 'Farm'))

        # Water sources
        sources = WaterSource.objects.filter(farm=farm)
        for ws in sources:
            fields.append(_field(f'{prefix}: Water Source "{ws.name}"', ws.get_source_type_display(), 'WaterSource'))
            fields.append(_field(f'{prefix}: "{ws.name}" Backflow Prevention', 'Yes' if ws.fsma_backflow_prevention else 'No', 'WaterSource'))

            # Latest test
            latest_test = WaterTest.objects.filter(water_source=ws).order_by('-test_date').first()
            if latest_test:
                fields.append(_field(f'{prefix}: "{ws.name}" Last Test', latest_test.test_date.strftime('%m/%d/%Y'), 'WaterTest'))
                fields.append(_field(f'{prefix}: "{ws.name}" Test Status', latest_test.get_status_display(), 'WaterTest'))

        # Fields
        farm_fields = Field.objects.filter(farm=farm)
        for fld in farm_fields:
            fields.append(_field(f'{prefix}: Field "{fld.name}" Irrigation', fld.irrigation_type or 'Unknown', 'Field'))
            fields.append(_field(f'{prefix}: Field "{fld.name}" Acres', str(fld.total_acres or ''), 'Field'))

    if not farm_qs.exists():
        warnings.append('No farms found.')

    return {'fields': fields, 'warnings': warnings}


# =============================================================================
# DOC 39 - FIELD RISK ASSESSMENT
# =============================================================================

@register('field_risk_assessment')
def fill_field_risk_assessment(company_id, farm_id=None, season_year=None):
    from api.models import Farm, Field, WaterSource, WaterTest, LandHistoryAssessment

    fields = []
    warnings = []

    farm_qs = Farm.objects.filter(company_id=company_id)
    if farm_id:
        farm_qs = farm_qs.filter(id=farm_id)

    for farm in farm_qs:
        prefix = farm.name

        # Land / Biological Risk
        fields.append(_field(f'{prefix}: Flooding History', 'Yes' if farm.flooding_history else 'No', 'Farm'))
        fields.append(_field(f'{prefix}: Septic Nearby', 'Yes' if farm.septic_nearby else 'No', 'Farm'))
        fields.append(_field(f'{prefix}: Animal Operation Distance (ft)', str(farm.nearest_animal_operation_ft or 'Unknown'), 'Farm'))

        # Land assessments
        assessments = LandHistoryAssessment.objects.filter(field__farm=farm).select_related('field')
        for a in assessments:
            fld_name = a.field.name if a.field else 'Unknown'
            fields.append(_field(f'{prefix}: Field "{fld_name}" Risk Level', a.get_contamination_risk_display(), 'LandHistoryAssessment'))
            fields.append(_field(f'{prefix}: Field "{fld_name}" Previous Animal Ops', 'Yes' if a.previous_animal_operations else 'No', 'LandHistoryAssessment'))

        # Water Risk
        sources = WaterSource.objects.filter(farm=farm)
        for ws in sources:
            fields.append(_field(f'{prefix}: Water "{ws.name}" Type', ws.get_source_type_display(), 'WaterSource'))
            fields.append(_field(f'{prefix}: Water "{ws.name}" Animal Access', 'Yes' if ws.fsma_animal_access_possible else 'No', 'WaterSource'))
            fields.append(_field(f'{prefix}: Water "{ws.name}" Debris Present', 'Yes' if ws.fsma_debris_present else 'No', 'WaterSource'))

            latest_test = WaterTest.objects.filter(water_source=ws).order_by('-test_date').first()
            if latest_test:
                fields.append(_field(f'{prefix}: Water "{ws.name}" E.coli', str(latest_test.ecoli_result or 'N/A'), 'WaterTest'))
                fields.append(_field(f'{prefix}: Water "{ws.name}" Test Status', latest_test.get_status_display(), 'WaterTest'))

        # Crop protection risk
        farm_fields = Field.objects.filter(farm=farm)
        for fld in farm_fields:
            fields.append(_field(f'{prefix}: Field "{fld.name}" Soil Type', fld.soil_type or 'Unknown', 'Field'))
            fields.append(_field(f'{prefix}: Field "{fld.name}" Irrigation', fld.irrigation_type or 'Unknown', 'Field'))
            fields.append(_field(f'{prefix}: Field "{fld.name}" Water Contacts Crop', 'Yes' if fld.water_contacts_harvestable else 'No', 'Field'))

    if not farm_qs.exists():
        warnings.append('No farms found.')

    return {'fields': fields, 'warnings': warnings}
