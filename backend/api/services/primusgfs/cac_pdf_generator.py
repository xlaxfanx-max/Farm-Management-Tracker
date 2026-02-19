"""
Top-level orchestrator for generating the filled CAC Food Safety Manual V5.0 PDF.

Pulls data from the CACDataMapper, fills the PDF via CACPDFFieldFiller,
and applies signed signatures from the database.
"""

from datetime import date
import io
import logging

from api.services.primusgfs.cac_pdf_filler import CACPDFFieldFiller
from api.services.primusgfs.cac_data_mapper import (
    CACDataMapper, DOC_PAGE_MAP, SIGNATURE_REQUIREMENTS,
)
from api.models.primusgfs import CACDocumentSignature

logger = logging.getLogger(__name__)


# =============================================================================
# DOC TITLES — human-readable names for each CAC document section
# =============================================================================

DOC_TITLES = {
    '01': 'Ranch Info & Food Safety Policy',
    '02': 'Organizational Structure',
    '03': 'Committee & Mgmt Verification',
    '04': 'Food Safety Committee Log',
    '05': 'Management Verification Review',
    '06': 'Training Management Matrix',
    '09': 'NUOCA Form',
    '09A': 'Employee Non-Conformance',
    '11': 'Product Rejection & Release',
    '14': 'Approved & Emergency Suppliers',
    '15': 'Supplier Verification Log',
    '17': 'Mock Recall',
    '18': 'Food Fraud Assessment',
    '19': 'Food Defense Assessment',
    '20': 'Visitor/Contractor Log',
    '21': 'Emergency Contacts',
    '22': 'Soils & Land Use',
    '23': 'Animals, Wildlife & Livestock',
    '24': 'Perimeter & Water Monitoring',
    '26': 'Fertilizer Application Log',
    '28A': 'Sprayer Calibration Log',
    '29': 'Chemical Inventory Log',
    '37': 'Training Log',
    '38': 'Pre-Season Checklist',
    '39': 'Field Risk Assessment',
}


# =============================================================================
# SIGNATURE COORDINATES — (page_number, signer_role, signer_order) -> position
#
# Positions are in PDF points (72 pts/inch) on a US Letter page (612 x 792).
# These are approximate defaults that will need calibration against the
# actual template once available.
# =============================================================================

SIGNATURE_COORDINATES = {
    # ------------------------------------------------------------------
    # Doc 01 — Page 9 — Coordinator signature at bottom
    # ------------------------------------------------------------------
    (9, 'coordinator', 0): {'x': 200, 'y': 180, 'width': 200, 'height': 40},

    # ------------------------------------------------------------------
    # Doc 04 — Page 16 — 10 attendee signatures + coordinator
    # ------------------------------------------------------------------
    (16, 'attendee', 0): {'x': 350, 'y': 620, 'width': 150, 'height': 30},
    (16, 'attendee', 1): {'x': 350, 'y': 590, 'width': 150, 'height': 30},
    (16, 'attendee', 2): {'x': 350, 'y': 560, 'width': 150, 'height': 30},
    (16, 'attendee', 3): {'x': 350, 'y': 530, 'width': 150, 'height': 30},
    (16, 'attendee', 4): {'x': 350, 'y': 500, 'width': 150, 'height': 30},
    (16, 'attendee', 5): {'x': 350, 'y': 470, 'width': 150, 'height': 30},
    (16, 'attendee', 6): {'x': 350, 'y': 440, 'width': 150, 'height': 30},
    (16, 'attendee', 7): {'x': 350, 'y': 410, 'width': 150, 'height': 30},
    (16, 'attendee', 8): {'x': 350, 'y': 380, 'width': 150, 'height': 30},
    (16, 'attendee', 9): {'x': 350, 'y': 350, 'width': 150, 'height': 30},
    (16, 'coordinator', 0): {'x': 200, 'y': 80, 'width': 200, 'height': 40},

    # ------------------------------------------------------------------
    # Doc 05 — Page 20 — 11 attendee signatures + coordinator
    # ------------------------------------------------------------------
    (20, 'attendee', 0):  {'x': 350, 'y': 620, 'width': 150, 'height': 30},
    (20, 'attendee', 1):  {'x': 350, 'y': 590, 'width': 150, 'height': 30},
    (20, 'attendee', 2):  {'x': 350, 'y': 560, 'width': 150, 'height': 30},
    (20, 'attendee', 3):  {'x': 350, 'y': 530, 'width': 150, 'height': 30},
    (20, 'attendee', 4):  {'x': 350, 'y': 500, 'width': 150, 'height': 30},
    (20, 'attendee', 5):  {'x': 350, 'y': 470, 'width': 150, 'height': 30},
    (20, 'attendee', 6):  {'x': 350, 'y': 440, 'width': 150, 'height': 30},
    (20, 'attendee', 7):  {'x': 350, 'y': 410, 'width': 150, 'height': 30},
    (20, 'attendee', 8):  {'x': 350, 'y': 380, 'width': 150, 'height': 30},
    (20, 'attendee', 9):  {'x': 350, 'y': 350, 'width': 150, 'height': 30},
    (20, 'attendee', 10): {'x': 350, 'y': 320, 'width': 150, 'height': 30},
    (20, 'coordinator', 0): {'x': 200, 'y': 80, 'width': 200, 'height': 40},

    # ------------------------------------------------------------------
    # Doc 09A — Page 29 — supervisor + employee
    # ------------------------------------------------------------------
    (29, 'supervisor', 0): {'x': 150, 'y': 180, 'width': 200, 'height': 40},
    (29, 'employee', 0):   {'x': 150, 'y': 100, 'width': 200, 'height': 40},

    # ------------------------------------------------------------------
    # Doc 15 — Page 47 — coordinator
    # ------------------------------------------------------------------
    (47, 'coordinator', 0): {'x': 200, 'y': 80, 'width': 200, 'height': 40},

    # ------------------------------------------------------------------
    # Doc 17 — Page 51 — coordinator
    # ------------------------------------------------------------------
    (51, 'coordinator', 0): {'x': 200, 'y': 80, 'width': 200, 'height': 40},

    # ------------------------------------------------------------------
    # Doc 18 — Page 53 — coordinator
    # ------------------------------------------------------------------
    (53, 'coordinator', 0): {'x': 200, 'y': 80, 'width': 200, 'height': 40},

    # ------------------------------------------------------------------
    # Doc 19 — Page 56 — coordinator
    # ------------------------------------------------------------------
    (56, 'coordinator', 0): {'x': 200, 'y': 80, 'width': 200, 'height': 40},

    # ------------------------------------------------------------------
    # Doc 22 — Page 61 — owner
    # ------------------------------------------------------------------
    (61, 'owner', 0): {'x': 150, 'y': 120, 'width': 200, 'height': 40},

    # ------------------------------------------------------------------
    # Doc 37 — Page 109 — 18 attendee signatures + coordinator
    # ------------------------------------------------------------------
    (109, 'attendee', 0):  {'x': 350, 'y': 620, 'width': 150, 'height': 25},
    (109, 'attendee', 1):  {'x': 350, 'y': 595, 'width': 150, 'height': 25},
    (109, 'attendee', 2):  {'x': 350, 'y': 570, 'width': 150, 'height': 25},
    (109, 'attendee', 3):  {'x': 350, 'y': 545, 'width': 150, 'height': 25},
    (109, 'attendee', 4):  {'x': 350, 'y': 520, 'width': 150, 'height': 25},
    (109, 'attendee', 5):  {'x': 350, 'y': 495, 'width': 150, 'height': 25},
    (109, 'attendee', 6):  {'x': 350, 'y': 470, 'width': 150, 'height': 25},
    (109, 'attendee', 7):  {'x': 350, 'y': 445, 'width': 150, 'height': 25},
    (109, 'attendee', 8):  {'x': 350, 'y': 420, 'width': 150, 'height': 25},
    (109, 'attendee', 9):  {'x': 350, 'y': 395, 'width': 150, 'height': 25},
    (109, 'attendee', 10): {'x': 350, 'y': 370, 'width': 150, 'height': 25},
    (109, 'attendee', 11): {'x': 350, 'y': 345, 'width': 150, 'height': 25},
    (109, 'attendee', 12): {'x': 350, 'y': 320, 'width': 150, 'height': 25},
    (109, 'attendee', 13): {'x': 350, 'y': 295, 'width': 150, 'height': 25},
    (109, 'attendee', 14): {'x': 350, 'y': 270, 'width': 150, 'height': 25},
    (109, 'attendee', 15): {'x': 350, 'y': 245, 'width': 150, 'height': 25},
    (109, 'attendee', 16): {'x': 350, 'y': 220, 'width': 150, 'height': 25},
    (109, 'attendee', 17): {'x': 350, 'y': 195, 'width': 150, 'height': 25},
    (109, 'coordinator', 0): {'x': 200, 'y': 80, 'width': 200, 'height': 40},

    # ------------------------------------------------------------------
    # Doc 39 — Page 120 — assessor + reviewer
    # ------------------------------------------------------------------
    (120, 'assessor', 0): {'x': 200, 'y': 200, 'width': 200, 'height': 40},
    (120, 'reviewer', 0): {'x': 200, 'y': 120, 'width': 200, 'height': 40},
}


# =============================================================================
# MODEL-TO-DOC MAPPING — which Django model holds data for each CAC document
#
# Each entry is a dict with:
#   'model_label':    dotted import path relative to api.models.primusgfs
#   'related_name':   related manager name on Company (for .exists() checks)
#   'filter_kwargs':  extra filter kwargs (callables receive season_year, farm)
#
# Documents with no dedicated model (20, 23, 26, 28A) are marked with
# model_label=None — they rely on external data or are not yet modeled.
# =============================================================================

_DOC_MODEL_MAP = {
    '01': {
        'model_label': 'FoodSafetyProfile',
        'related_name': 'food_safety_profile',
        'is_one_to_one': True,
    },
    '02': {
        'model_label': 'FoodSafetyRoleAssignment',
        'related_name': 'food_safety_roles',
    },
    '03': {
        'model_label': 'FoodSafetyCommitteeMeeting',
        'related_name': 'committee_meetings',
        'filter_year_field': 'meeting_year',
    },
    '04': {
        'model_label': 'FoodSafetyCommitteeMeeting',
        'related_name': 'committee_meetings',
        'filter_year_field': 'meeting_year',
    },
    '05': {
        'model_label': 'ManagementVerificationReview',
        'related_name': 'management_reviews',
        'filter_year_field': 'review_year',
    },
    '06': {
        'model_label': 'TrainingRecord',
        'related_name': 'training_records',
    },
    '09': {
        'model_label': 'CorrectiveAction',
        'related_name': 'corrective_actions',
        'extra_filter': {'is_nuoca': True},
    },
    '09A': {
        'model_label': 'EmployeeNonConformance',
        'related_name': 'employee_non_conformances',
    },
    '11': {
        'model_label': 'ProductHoldRelease',
        'related_name': 'product_holds',
    },
    '14': {
        'model_label': 'ApprovedSupplier',
        'related_name': 'approved_suppliers',
    },
    '15': {
        'model_label': 'SupplierVerificationLog',
        'related_name': 'supplier_verifications',
    },
    '17': {
        'model_label': 'MockRecall',
        'related_name': 'mock_recalls',
    },
    '18': {
        'model_label': 'FoodFraudAssessment',
        'related_name': 'food_fraud_assessments',
        'filter_year_field': 'assessment_year',
    },
    '19': {
        'model_label': 'FoodDefensePlan',
        'related_name': 'food_defense_plans',
        'filter_year_field': 'plan_year',
    },
    '20': {
        'model_label': None,  # Visitor/Contractor Log — not yet modeled
    },
    '21': {
        'model_label': 'EmergencyContact',
        'related_name': 'emergency_contacts',
    },
    '22': {
        'model_label': 'LandHistoryAssessment',
        'related_name': 'land_assessments',
    },
    '23': {
        'model_label': None,  # Animals, Wildlife & Livestock — not yet modeled
    },
    '24': {
        'model_label': 'PerimeterMonitoringLog',
        'related_name': 'perimeter_logs',
    },
    '26': {
        'model_label': None,  # Fertilizer Application Log — uses Nutrient module
    },
    '28A': {
        'model_label': 'EquipmentCalibration',
        'related_name': 'equipment_calibrations',
        'extra_filter': {'equipment_type': 'sprayer'},
    },
    '29': {
        'model_label': 'ChemicalInventoryLog',
        'related_name': 'chemical_inventory_logs',
    },
    '37': {
        'model_label': 'WorkerTrainingSession',
        'related_name': 'training_sessions',
    },
    '38': {
        'model_label': 'PreSeasonChecklist',
        'related_name': 'pre_season_checklists',
        'filter_year_field': 'season_year',
    },
    '39': {
        'model_label': 'FieldRiskAssessment',
        'related_name': 'field_risk_assessments',
        'filter_year_field': 'season_year',
    },
}


# =============================================================================
# MAIN GENERATOR
# =============================================================================

class CACManualPDFGenerator:
    """
    Top-level orchestrator for generating the filled CAC Food Safety Manual PDF.

    Usage::

        gen = CACManualPDFGenerator(company, farm=farm, season_year=2026)
        pdf_bytes = gen.generate_full()
        section_pdf = gen.generate_section('04')
        preview_png = gen.generate_preview('04', page=15)
        status = gen.get_completion_status()
    """

    def __init__(self, company, farm=None, season_year=None):
        self.company = company
        self.farm = farm
        self.season_year = season_year or date.today().year
        self.mapper = CACDataMapper(
            company, farm=farm, season_year=self.season_year,
        )

    # ------------------------------------------------------------------
    # Internal helper — fill a filler with all data + signatures
    # ------------------------------------------------------------------

    def _fill_filler(self, filler, doc_filter=None):
        """
        Discover actual PDF field names, resolve positional mappings,
        fill text/checkbox fields, and overlay signatures.

        Args:
            filler: CACPDFFieldFiller instance.
            doc_filter: Optional doc_number to restrict signatures.
        """
        # Discover actual PDF form field names from the template
        fields_by_page = CACPDFFieldFiller.discover_fields(
            filler.template_path,
        )

        # Resolve positional field mappings to actual PDF field names
        text_fields = self.mapper.resolve_positional_fields(fields_by_page)
        filler.fill_text_fields(text_fields)

        checkbox_fields = self.mapper.resolve_positional_checkboxes(
            fields_by_page,
        )
        filler.fill_checkboxes(checkbox_fields)

        # Overlay signed signatures
        self._apply_signatures(filler, doc_filter=doc_filter)

    # ------------------------------------------------------------------
    # Full PDF generation
    # ------------------------------------------------------------------

    def generate_full(self):
        """
        Generate the complete 120-page filled PDF with all data and
        signatures.

        Returns:
            io.BytesIO containing the final PDF bytes.
        """
        filler = CACPDFFieldFiller()
        self._fill_filler(filler)
        return filler.get_filled_pdf()

    # ------------------------------------------------------------------
    # Single-section generation
    # ------------------------------------------------------------------

    def generate_section(self, doc_number):
        """
        Generate just the pages for one document section.

        Args:
            doc_number: CAC document number, e.g. '04', '09A'.

        Returns:
            io.BytesIO containing the subset PDF.

        Raises:
            ValueError: If doc_number is not in DOC_PAGE_MAP.
        """
        pages = DOC_PAGE_MAP.get(doc_number, [])
        if not pages:
            raise ValueError(f"Unknown document number: {doc_number}")

        filler = CACPDFFieldFiller()
        self._fill_filler(filler, doc_filter=doc_number)
        return filler.get_pages_as_pdf(pages)

    # ------------------------------------------------------------------
    # Preview (PNG)
    # ------------------------------------------------------------------

    def generate_preview(self, doc_number, page=None):
        """
        Generate a PNG preview of a specific page.

        Args:
            doc_number: CAC document number.
            page: Optional 1-based page number. Defaults to the first page
                  of the section.

        Returns:
            io.BytesIO containing PNG data, or None on error.

        Raises:
            ValueError: If doc_number is not in DOC_PAGE_MAP.
        """
        pages = DOC_PAGE_MAP.get(doc_number, [])
        if not pages:
            raise ValueError(f"Unknown document number: {doc_number}")

        target_page = page or pages[0]

        filler = CACPDFFieldFiller()
        self._fill_filler(filler, doc_filter=doc_number)
        return filler.get_page_as_png(target_page)

    # ------------------------------------------------------------------
    # Signature overlay
    # ------------------------------------------------------------------

    def _apply_signatures(self, filler, doc_filter=None):
        """
        Apply all signed signatures from the database onto the PDF.

        Args:
            filler: CACPDFFieldFiller instance to overlay onto.
            doc_filter: Optional doc_number string to restrict which
                        signatures are applied.
        """
        qs = CACDocumentSignature.objects.filter(
            company=self.company,
            season_year=self.season_year,
            signed=True,
        )
        if doc_filter:
            qs = qs.filter(doc_number=doc_filter)

        for sig in qs:
            if not sig.signature_data:
                continue

            coords = SIGNATURE_COORDINATES.get(
                (sig.page_number, sig.signer_role, sig.signer_order),
                None,
            )
            if coords:
                filler.overlay_signature(
                    sig.page_number,
                    sig.signature_data,
                    coords['x'],
                    coords['y'],
                    coords['width'],
                    coords['height'],
                )
            else:
                logger.warning(
                    "No coordinate mapping for signature on page %d, "
                    "role=%s, order=%d (doc %s)",
                    sig.page_number,
                    sig.signer_role,
                    sig.signer_order,
                    sig.doc_number,
                )

    # ------------------------------------------------------------------
    # Completion / signature status
    # ------------------------------------------------------------------

    def get_completion_status(self):
        """
        Return completion and signature status for each CAC document section.

        Queries each backing Django model to determine whether data has been
        entered, and counts required vs. completed signatures for the
        current season year.

        Returns:
            dict with structure::

                {
                    'season_year': 2026,
                    'documents': {
                        '01': {
                            'title': 'Ranch Info & Food Safety Policy',
                            'has_data': True,
                            'pages': [7, 9],
                            'signatures_required': 1,
                            'signatures_completed': 0,
                        },
                        ...
                    },
                    'overall_completeness': 0.72,
                    'overall_signatures': {
                        'required': 45,
                        'completed': 30,
                    },
                }
        """
        documents = {}
        total_with_data = 0
        total_docs = 0
        total_sigs_required = 0
        total_sigs_completed = 0

        # Pre-fetch all signatures for this company/year in one query
        all_sigs = CACDocumentSignature.objects.filter(
            company=self.company,
            season_year=self.season_year,
        )
        sigs_by_doc = {}
        for sig in all_sigs:
            sigs_by_doc.setdefault(sig.doc_number, []).append(sig)

        for doc_number, title in DOC_TITLES.items():
            pages = DOC_PAGE_MAP.get(doc_number, [])

            # Determine if data exists for this document
            has_data = self._check_has_data(doc_number)

            # Signature counts from the database
            doc_sigs = sigs_by_doc.get(doc_number, [])
            sigs_required = len(doc_sigs) if doc_sigs else self._get_default_sig_count(doc_number)
            sigs_completed = sum(1 for s in doc_sigs if s.signed)

            # Also count from SIGNATURE_REQUIREMENTS if no db rows yet
            if not doc_sigs:
                sig_reqs = SIGNATURE_REQUIREMENTS.get(doc_number, [])
                sigs_required = len(sig_reqs)

            total_docs += 1
            if has_data:
                total_with_data += 1
            total_sigs_required += sigs_required
            total_sigs_completed += sigs_completed

            documents[doc_number] = {
                'title': title,
                'has_data': has_data,
                'pages': pages,
                'signatures_required': sigs_required,
                'signatures_completed': sigs_completed,
            }

        overall_completeness = (
            total_with_data / total_docs if total_docs > 0 else 0.0
        )

        return {
            'season_year': self.season_year,
            'documents': documents,
            'overall_completeness': round(overall_completeness, 2),
            'overall_signatures': {
                'required': total_sigs_required,
                'completed': total_sigs_completed,
            },
        }

    def _check_has_data(self, doc_number):
        """
        Check whether the backing model for a given CAC document number
        contains any relevant records for the current company/season.

        Returns True if data exists, False otherwise.
        """
        mapping = _DOC_MODEL_MAP.get(doc_number)
        if not mapping or mapping.get('model_label') is None:
            # No dedicated model — cannot determine data presence
            return False

        related_name = mapping.get('related_name')
        if not related_name:
            return False

        # OneToOneField (e.g. FoodSafetyProfile)
        if mapping.get('is_one_to_one'):
            try:
                obj = getattr(self.company, related_name, None)
                return obj is not None
            except Exception:
                return False

        # ForeignKey / reverse manager
        try:
            manager = getattr(self.company, related_name)
        except Exception:
            return False

        qs = manager.all()

        # Apply year filter if the model has a season/year field
        year_field = mapping.get('filter_year_field')
        if year_field:
            qs = qs.filter(**{year_field: self.season_year})

        # Apply extra static filters (e.g. is_nuoca=True for Doc 09)
        extra = mapping.get('extra_filter')
        if extra:
            qs = qs.filter(**extra)

        return qs.exists()

    @staticmethod
    def _get_default_sig_count(doc_number):
        """
        Fallback signature count when no CACDocumentSignature rows exist
        for a given document. Based on SIGNATURE_REQUIREMENTS from the
        data mapper; returns 0 if not defined.
        """
        sig_reqs = SIGNATURE_REQUIREMENTS.get(doc_number, [])
        return len(sig_reqs)
