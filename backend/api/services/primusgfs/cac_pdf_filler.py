"""
Core PDF form-filling engine for the CAC Food Safety Manual V5.0.

Uses PyPDF2 to fill AcroForm text fields and checkboxes in the official
120-page fillable PDF template. Uses ReportLab for signature overlay and
PyMuPDF (fitz) for page-to-PNG conversion.
"""

import io
import os
import base64
import copy
import logging

from PyPDF2 import PdfReader, PdfWriter
from PyPDF2.generic import (
    NameObject, TextStringObject, ArrayObject, BooleanObject,
    NumberObject, IndirectObject,
)

logger = logging.getLogger(__name__)

# Path to the PDF template
TEMPLATE_PATH = os.path.join(
    os.path.dirname(__file__), '..', '..', 'static', 'templates',
    'cac_food_safety_manual_v5.pdf'
)


class CACPDFFieldFiller:
    """
    Low-level PDF form field operations.

    Usage::

        filler = CACPDFFieldFiller()
        filler.fill_text_field('1-a-100', 'Sunrise Ranch')
        filler.fill_checkbox('4-a-CheckBox1', True)
        filler.overlay_signature(15, sig_base64, 150, 100, 200, 50)
        pdf_bytes = filler.get_filled_pdf()
    """

    def __init__(self, template_path=None):
        self.template_path = template_path or TEMPLATE_PATH
        self.reader = PdfReader(self.template_path)
        self.writer = PdfWriter()
        self.writer.append_pages_from_reader(self.reader)
        self._field_updates = {}
        self._checkbox_updates = {}
        self._signature_overlays = []

        # Copy the AcroForm from the reader into the writer so that
        # form fields stay interactive after writing.  PyPDF2's
        # append_pages_from_reader copies pages but not the AcroForm.
        self._copy_acroform_to_writer()

    def _copy_acroform_to_writer(self):
        """Copy the AcroForm dictionary from the template reader to the writer."""
        try:
            source_root = self.reader.trailer['/Root']
            if isinstance(source_root, IndirectObject):
                source_root = source_root.get_object()
            if '/AcroForm' not in source_root:
                return

            source_acroform = source_root['/AcroForm']
            if isinstance(source_acroform, IndirectObject):
                source_acroform = source_acroform.get_object()

            # Build a new AcroForm dict for the writer with
            # NeedAppearances=True so viewers regenerate field visuals.
            from PyPDF2.generic import DictionaryObject
            new_acroform = DictionaryObject()
            new_acroform[NameObject('/NeedAppearances')] = BooleanObject(True)

            # Copy over font resources (/DR) if present — needed for
            # text field rendering in many PDF viewers.
            if '/DR' in source_acroform:
                new_acroform[NameObject('/DR')] = source_acroform['/DR']
            if '/DA' in source_acroform:
                new_acroform[NameObject('/DA')] = source_acroform['/DA']

            if hasattr(self.writer, '_root_object'):
                writer_root = self.writer._root_object
            else:
                writer_root = self.writer._root
            writer_root[NameObject('/AcroForm')] = new_acroform

        except Exception as e:
            logger.warning(f"Could not copy AcroForm to writer: {e}")

    # ------------------------------------------------------------------
    # Text fields
    # ------------------------------------------------------------------
    def fill_text_field(self, field_name, value):
        """Queue a text field value for writing."""
        if value is not None:
            self._field_updates[field_name] = str(value)

    def fill_text_fields(self, field_dict):
        """Queue multiple text fields at once."""
        for name, value in field_dict.items():
            self.fill_text_field(name, value)

    # ------------------------------------------------------------------
    # Checkboxes
    # ------------------------------------------------------------------
    def fill_checkbox(self, field_name, checked):
        """Queue a checkbox state for writing."""
        self._checkbox_updates[field_name] = bool(checked)

    def fill_checkboxes(self, checkbox_dict):
        """Queue multiple checkboxes at once."""
        for name, checked in checkbox_dict.items():
            self.fill_checkbox(name, checked)

    # ------------------------------------------------------------------
    # Signatures
    # ------------------------------------------------------------------
    def overlay_signature(self, page_number, signature_base64, x, y,
                          width=150, height=50):
        """
        Queue a signature PNG overlay at specific coordinates on a page.

        Args:
            page_number: 1-based PDF page number.
            signature_base64: Base64-encoded PNG (with or without data URI prefix).
            x, y: Bottom-left corner in PDF points (72 pts/inch).
            width, height: Signature image dimensions in points.
        """
        self._signature_overlays.append({
            'page': page_number,
            'data': signature_base64,
            'x': x, 'y': y,
            'width': width, 'height': height,
        })

    # ------------------------------------------------------------------
    # Apply & Output
    # ------------------------------------------------------------------
    def _apply_form_fields(self):
        """Write all queued text field and checkbox values into the PDF."""
        # Process ALL pages to ensure every field is editable, even if
        # no data updates were queued (user may want to fill fields in
        # the PDF viewer directly).
        for page_num in range(len(self.writer.pages)):
            page = self.writer.pages[page_num]
            if '/Annots' not in page:
                continue

            annots = page['/Annots']
            for annot_ref in annots:
                annot = annot_ref.get_object()
                field_name = annot.get('/T')
                if field_name is None:
                    continue
                field_name = str(field_name)

                # Clear ReadOnly bit on EVERY field so the PDF is fully
                # editable in any viewer (Chrome, Acrobat, Preview, etc.)
                if '/Ff' in annot:
                    ff = int(annot['/Ff'])
                    if ff & 1:  # ReadOnly bit is set
                        annot.update({
                            NameObject('/Ff'): NumberObject(ff & ~1),
                        })

                # Handle text fields that have queued values
                if field_name in self._field_updates:
                    value = self._field_updates[field_name]
                    annot.update({
                        NameObject('/V'): TextStringObject(value),
                    })
                    # Delete cached appearance so the viewer regenerates it
                    if '/AP' in annot:
                        del annot['/AP']

                # Handle checkboxes that have queued values
                if field_name in self._checkbox_updates:
                    checked = self._checkbox_updates[field_name]
                    if checked:
                        annot.update({
                            NameObject('/V'): NameObject('/Yes'),
                            NameObject('/AS'): NameObject('/Yes'),
                        })
                    else:
                        annot.update({
                            NameObject('/V'): NameObject('/Off'),
                            NameObject('/AS'): NameObject('/Off'),
                        })

        # Tell the PDF viewer to regenerate appearances
        if hasattr(self.writer, '_root_object'):
            root = self.writer._root_object
        else:
            root = self.writer._root

        if '/AcroForm' in root:
            acroform = root['/AcroForm']
            acroform.update({
                NameObject('/NeedAppearances'): BooleanObject(True),
            })

    def _apply_signature_overlays(self):
        """Overlay all queued signature images onto their target pages."""
        if not self._signature_overlays:
            return

        try:
            from reportlab.pdfgen import canvas
            from reportlab.lib.utils import ImageReader
        except ImportError:
            logger.warning(
                "ReportLab not installed — signature overlays will be skipped. "
                "Install with: pip install reportlab"
            )
            return

        from PIL import Image

        for sig in self._signature_overlays:
            page_idx = sig['page'] - 1  # Convert to 0-based
            if page_idx < 0 or page_idx >= len(self.writer.pages):
                logger.warning(f"Signature page {sig['page']} out of range")
                continue

            page = self.writer.pages[page_idx]

            # Decode base64 signature
            sig_data = sig['data']
            if ',' in sig_data:
                sig_data = sig_data.split(',', 1)[1]

            try:
                img_bytes = base64.b64decode(sig_data)
            except Exception as e:
                logger.warning(f"Failed to decode signature: {e}")
                continue

            # Create a one-page PDF with just the signature image
            packet = io.BytesIO()
            page_width = float(page.mediabox.width)
            page_height = float(page.mediabox.height)

            c = canvas.Canvas(packet, pagesize=(page_width, page_height))
            c.drawImage(
                ImageReader(io.BytesIO(img_bytes)),
                sig['x'], sig['y'],
                width=sig['width'], height=sig['height'],
                mask='auto',
            )
            c.save()

            # Merge the overlay onto the target page
            packet.seek(0)
            overlay_reader = PdfReader(packet)
            overlay_page = overlay_reader.pages[0]
            page.merge_page(overlay_page)

    def get_filled_pdf(self):
        """
        Apply all queued changes and return the completed PDF as BytesIO.
        """
        self._apply_form_fields()
        self._apply_signature_overlays()

        output = io.BytesIO()
        self.writer.write(output)
        output.seek(0)
        return output

    def get_page_as_png(self, page_number, dpi=150):
        """
        Render a single page of the filled PDF as a PNG image.

        Args:
            page_number: 1-based page number.
            dpi: Resolution for rendering.

        Returns:
            BytesIO containing PNG data.
        """
        # First generate the filled PDF
        filled_pdf = self.get_filled_pdf()

        try:
            import fitz  # PyMuPDF
        except ImportError:
            logger.warning("PyMuPDF not installed — cannot generate PNG preview")
            return None

        doc = fitz.open(stream=filled_pdf.read(), filetype='pdf')
        page_idx = page_number - 1

        if page_idx < 0 or page_idx >= len(doc):
            logger.warning(f"Page {page_number} out of range")
            return None

        page = doc.load_page(page_idx)
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)

        img_bytes = io.BytesIO(pix.tobytes('png'))
        doc.close()
        return img_bytes

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------
    def get_pages_as_pdf(self, page_numbers):
        """
        Extract specific pages from the filled PDF into a new PDF,
        preserving the AcroForm dictionary so form fields remain
        interactive and editable in PDF viewers.

        Args:
            page_numbers: List of 1-based page numbers.

        Returns:
            BytesIO containing the subset PDF.
        """
        # Apply all updates first (field values, ReadOnly clearing, etc.)
        self._apply_form_fields()
        self._apply_signature_overlays()

        # Build section writer with only the requested pages
        from PyPDF2.generic import DictionaryObject
        section_writer = PdfWriter()

        for pn in page_numbers:
            idx = pn - 1
            if 0 <= idx < len(self.writer.pages):
                section_writer.add_page(self.writer.pages[idx])

        # Copy AcroForm from the main writer into the section writer
        # so form fields remain interactive and editable.
        try:
            if hasattr(self.writer, '_root_object'):
                main_root = self.writer._root_object
            else:
                main_root = self.writer._root

            if hasattr(section_writer, '_root_object'):
                sec_root = section_writer._root_object
            else:
                sec_root = section_writer._root

            if '/AcroForm' in main_root:
                sec_root[NameObject('/AcroForm')] = main_root['/AcroForm']
            else:
                # Build a minimal AcroForm so viewers treat this as a form
                new_acroform = DictionaryObject()
                new_acroform[NameObject('/NeedAppearances')] = BooleanObject(True)
                sec_root[NameObject('/AcroForm')] = new_acroform
        except Exception as e:
            logger.warning(f"Could not copy AcroForm to section PDF: {e}")

        output = io.BytesIO()
        section_writer.write(output)
        output.seek(0)
        return output

    @staticmethod
    def discover_fields(template_path=None):
        """
        Discover all form fields in the PDF template.
        Returns dict: {page_number: [{'name': ..., 'type': ...}, ...]}
        """
        path = template_path or TEMPLATE_PATH
        reader = PdfReader(path)
        fields_by_page = {}

        for i, page in enumerate(reader.pages):
            page_num = i + 1
            if '/Annots' not in page:
                continue

            annots = page['/Annots']
            page_fields = []
            for annot_ref in annots:
                try:
                    annot = annot_ref.get_object()
                    subtype = str(annot.get('/Subtype', ''))
                    if subtype == '/Widget':
                        field_name = str(annot.get('/T', 'unnamed'))
                        field_type = str(annot.get('/FT', 'unknown'))
                        ft = 'text' if field_type == '/Tx' else (
                            'checkbox' if field_type == '/Btn' else 'other'
                        )
                        page_fields.append({
                            'name': field_name,
                            'type': ft,
                        })
                except Exception:
                    pass

            if page_fields:
                fields_by_page[page_num] = page_fields

        return fields_by_page
