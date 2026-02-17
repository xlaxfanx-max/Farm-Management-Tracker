"""
PDF Extraction Service for Packinghouse Statements
===================================================
Uses Claude AI to extract structured data from packinghouse PDF statements.
Supports VPOA and SLA statement formats.
"""

import os
import json
import base64
import logging
import tempfile
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from decimal import Decimal, InvalidOperation
from datetime import date

import anthropic
import fitz  # PyMuPDF - no external dependencies needed
from django.conf import settings

logger = logging.getLogger(__name__)

# Maximum allowed PDF file size (50 MB)
MAX_PDF_FILE_SIZE = 50 * 1024 * 1024


@dataclass
class ExtractionResult:
    """Result of PDF extraction attempt."""
    success: bool
    data: Dict[str, Any] = field(default_factory=dict)
    statement_type: str = ''
    packinghouse_format: str = 'generic'
    confidence: float = 0.0
    error: str = ''


class PDFExtractionService:
    """
    Extract structured data from packinghouse PDFs using Claude.

    Supported statement types:
    - VPOA Packout Statement
    - VPOA Pool Settlement
    - SLA Wash Report
    - SLA Grower Pool Statement
    """

    # Maximum pages to process (to control costs)
    MAX_PAGES = 5

    # Claude model to use
    MODEL = "claude-sonnet-4-20250514"

    def __init__(self):
        """Initialize the extraction service."""
        self.client = None
        api_key = os.environ.get('ANTHROPIC_API_KEY') or getattr(settings, 'ANTHROPIC_API_KEY', None)
        if not api_key:
            logger.warning("PDFExtractionService initialized without API key - extraction will fail")
        else:
            self.client = anthropic.Anthropic(api_key=api_key)
            logger.debug("PDFExtractionService configured")

    def extract_from_pdf(
        self,
        pdf_path: str = None,
        pdf_bytes: bytes = None,
        packinghouse_format: str = None
    ) -> ExtractionResult:
        """
        Extract structured data from a packinghouse PDF.

        Args:
            pdf_path: Path to PDF file
            pdf_bytes: PDF file content as bytes (alternative to path)
            packinghouse_format: Optional hint for packinghouse format ('vpoa', 'sla', 'generic')

        Returns:
            ExtractionResult with extracted data or error
        """
        if not self.client:
            # Re-check environment in case it was loaded after service was imported
            api_key = os.environ.get('ANTHROPIC_API_KEY') or getattr(settings, 'ANTHROPIC_API_KEY', None)
            if api_key:
                self.client = anthropic.Anthropic(api_key=api_key)
                logger.debug("Late-initialized Anthropic client")
            else:
                logger.error("ANTHROPIC_API_KEY not configured")
                return ExtractionResult(
                    success=False,
                    error="Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable. Please restart the Django server after adding the key to your .env file."
                )

        try:
            # Validate file size
            if pdf_path:
                try:
                    file_size = os.path.getsize(pdf_path)
                    if file_size > MAX_PDF_FILE_SIZE:
                        return ExtractionResult(
                            success=False,
                            error=f"PDF too large ({file_size // (1024*1024)}MB). Maximum is {MAX_PDF_FILE_SIZE // (1024*1024)}MB."
                        )
                except OSError as e:
                    return ExtractionResult(success=False, error=f"Cannot access PDF file: {e}")
            elif pdf_bytes:
                if len(pdf_bytes) > MAX_PDF_FILE_SIZE:
                    return ExtractionResult(
                        success=False,
                        error=f"PDF too large ({len(pdf_bytes) // (1024*1024)}MB). Maximum is {MAX_PDF_FILE_SIZE // (1024*1024)}MB."
                    )

            # Convert PDF pages to images
            images = self._pdf_to_images(pdf_path, pdf_bytes)
            if not images:
                return ExtractionResult(
                    success=False,
                    error="Failed to convert PDF to images. Ensure poppler is installed."
                )

            # Send to Claude for extraction
            result = self._extract_with_claude(images, packinghouse_format)
            return result

        except anthropic.APIError as e:
            logger.error(f"Claude API error during extraction: {e}")
            return ExtractionResult(
                success=False,
                error=f"AI extraction failed: {str(e)}"
            )
        except Exception as e:
            logger.exception(f"Unexpected error during PDF extraction: {e}")
            return ExtractionResult(
                success=False,
                error=f"Extraction failed: {str(e)}"
            )

    def _pdf_to_images(
        self,
        pdf_path: str = None,
        pdf_bytes: bytes = None
    ) -> List[str]:
        """
        Convert PDF pages to base64-encoded PNG images using PyMuPDF.

        Returns:
            List of base64 encoded image strings
        """
        doc = None
        try:
            # Open PDF with PyMuPDF
            if pdf_path:
                # Path traversal protection: resolve and validate
                resolved = Path(pdf_path).resolve()
                media_root = Path(settings.MEDIA_ROOT).resolve() if hasattr(settings, 'MEDIA_ROOT') and settings.MEDIA_ROOT else None
                temp_dir = Path(tempfile.gettempdir()).resolve()

                # Allow files under MEDIA_ROOT or the system temp directory
                allowed = False
                if media_root and str(resolved).startswith(str(media_root)):
                    allowed = True
                if str(resolved).startswith(str(temp_dir)):
                    allowed = True

                if not allowed:
                    logger.error(f"PDF path outside allowed directories: {resolved}")
                    raise ValueError("PDF file path is not within an allowed directory")

                if not resolved.exists():
                    raise FileNotFoundError(f"PDF file not found: {pdf_path}")

                doc = fitz.open(str(resolved))
            elif pdf_bytes:
                doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            else:
                raise ValueError("Either pdf_path or pdf_bytes must be provided")

            # Convert each page to base64
            base64_images = []
            num_pages = min(len(doc), self.MAX_PAGES)

            for i in range(num_pages):
                page = doc[i]
                # Render at 200 DPI (default is 72, so scale by 200/72)
                zoom = 200 / 72
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.tobytes("png")

                base64_images.append(base64.standard_b64encode(img_data).decode('utf-8'))
                logger.debug(f"Converted page {i+1} to image ({len(img_data)} bytes)")

            return base64_images

        except Exception as e:
            logger.error(f"Failed to convert PDF to images: {e}")
            return []
        finally:
            if doc:
                doc.close()

    def _extract_with_claude(
        self,
        images: List[str],
        packinghouse_format: str = None
    ) -> ExtractionResult:
        """
        Send images to Claude and extract structured data.

        Args:
            images: List of base64-encoded PNG images
            packinghouse_format: Optional hint for format detection

        Returns:
            ExtractionResult with extracted data
        """
        # Build the extraction prompt
        prompt = self._build_extraction_prompt(packinghouse_format)

        # Build message content with images
        content = []
        for i, img_base64 in enumerate(images):
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": img_base64
                }
            })
        content.append({
            "type": "text",
            "text": prompt
        })

        # Call Claude
        logger.info(f"Sending {len(images)} page(s) to Claude for extraction")
        response = self.client.messages.create(
            model=self.MODEL,
            max_tokens=8192,
            messages=[
                {
                    "role": "user",
                    "content": content
                }
            ]
        )

        # Parse response
        response_text = response.content[0].text
        return self._parse_extraction_response(response_text)

    def _build_extraction_prompt(self, packinghouse_format: str = None) -> str:
        """Build the extraction prompt for Claude."""

        format_hint = ""
        if packinghouse_format == 'vpoa':
            format_hint = """
This appears to be from Villa Park Orchards Association (VPOA).
VPOA formats include:
- Packout statements with grade breakdowns (SK/CH DOMESTIC, sizes like 048, 056, etc.)
- Pool settlement statements with FOB rates, credits, and deductions
"""
        elif packinghouse_format == 'sla':
            format_hint = """
This appears to be from Saticoy Lemon Association (SLA).
SLA formats include:
- Wash reports with run numbers, ticket numbers, bins, and grade percentages
- Grower pool statements with grade/size/rate breakdowns and capital fund info
"""
        elif packinghouse_format == 'mission':
            format_hint = """
This appears to be from Mission Produce.
Mission Produce grower statements typically include:
- Multiple blocks (ranch/grove sections) on a single statement
- A top payment summary table showing per-block harvest payments with gross pounds, gross dollars, deductions (Picking, CAC, HAB, Hauling, Other), net dollars, check number, and check date
- A size breakdown table showing per-block detail: size (32, 36, 40, 48, 60, 70, 84, 96, 120, 2LG, 2ME, 2SM), net pounds, avg price, gross dollars
- Subtotals per block and a Grand Total row
- Variety is typically HassConv (Hass Conventional) for avocados
- Data may span multiple pages — extract ALL blocks from ALL pages
IMPORTANT: Each block may have multiple payment lines in the top table. Each grade/size line in the bottom table belongs to a specific block. You MUST extract data from ALL blocks, not just the first one.
"""

        return f"""Analyze this packinghouse statement PDF and extract all data into structured JSON format.
{format_hint}

First, identify:
1. The packinghouse (VPOA/Villa Park Orchards, SLA/Saticoy Lemon, or other)
2. The statement type (packout, settlement, wash_report, grower_statement)
3. Your confidence level (0.0 to 1.0) in the extraction accuracy

Then extract ALL relevant data. Return a JSON object with this structure:

{{
    "packinghouse_format": "vpoa" | "sla" | "mission" | "generic",
    "packinghouse_name": "string - the full packinghouse name as shown on the document (e.g., 'Villa Park Orchards Association', 'Saticoy Lemon Association')",
    "packinghouse_short_code": "string or null - any abbreviation shown (e.g., 'VPOA', 'SLA')",
    "statement_type": "packout" | "settlement" | "wash_report" | "grower_statement",
    "confidence": 0.0-1.0,

    "header": {{
        "grower_name": "string or null",
        "grower_id": "string or null",
        "pool_id": "string or null",
        "pool_name": "string or null",
        "commodity": "The fruit/crop type (e.g., LEMONS, NAVELS, AVOCADOS, TANGERINES, GRAPEFRUIT, VALENCIAS). Must be the type of fruit, NOT a grower name, ranch name, or block ID.",
        "variety": "string or null",
        "season": "string (e.g., 2024-2025)",
        "report_date": "YYYY-MM-DD",
        "period_start": "YYYY-MM-DD or null",
        "period_end": "YYYY-MM-DD or null",
        "run_numbers": "string or null"
    }},

    "blocks": [
        {{
            "block_id": "string (e.g., '002', '003')",
            "block_name": "string or null (e.g., 'SATICOY 02')",
            "bins": number or null,
            "cartons": number or null,
            "weight_lbs": number or null,
            "gross_dollars": number or null,
            "net_dollars": number or null
        }}
    ],

    "grade_lines": [
        {{
            "block_id": "string or null - the block/grove ID this line belongs to (e.g., '002', '003'). Use null if the statement has no block-level breakdown.",
            "grade": "string (e.g., SUNKIST, CHOICE, STANDARD, JUICE, HassConv)",
            "size": "string or null (e.g., 048, 056, 075, 32, 36, 40, 48, 60, 70, 84)",
            "quantity": number,
            "percent": number,
            "unit": "CARTON" | "BIN" | "LBS",
            "fob_rate": number or null,
            "total_amount": number or null
        }}
    ],

    "summary": {{
        "bins_this_period": number or null,
        "bins_cumulative": number or null,
        "total_bins": number or null,  // Use the total bins from the grade/size breakdown if available, not a gross or field-level total.
        "total_cartons": number or null,
        "total_weight_lbs": number or null,  // Use NET pounds (from grade/size breakdown), NOT gross pounds. If both gross and net are shown, use the net figure that matches the sum of the grade lines.
        "total_packed_percent": number or null,
        "house_avg_packed_percent": number or null,
        "juice_percent": number or null,
        "cull_percent": number or null,
        "fresh_fruit_percent": number or null
    }},

    "financials": {{
        "total_credits": number or null,
        "total_deductions": number or null,
        "net_return": number or null,
        "prior_advances": number or null,
        "amount_due": number or null,
        "net_per_bin": number or null,
        "net_per_lb": number or null,
        "net_per_carton": number or null,
        "house_avg_per_bin": number or null,
        "house_avg_per_carton": number or null
    }},

    "deductions": [
        {{
            "block_id": "string or null - the block/grove ID this deduction belongs to (e.g., '002', '003'). Use null if deductions are not broken out by block.",
            "category": "packing" | "assessment" | "pick_haul" | "capital" | "marketing" | "other",
            "description": "string",
            "quantity": number or null,
            "unit": "string",
            "rate": number or null,
            "amount": number
        }}
    ],

    "quality_notes": "string or null"
}}

Important:
- Extract ALL grade lines visible in the document from ALL blocks/sections and ALL pages
- Extract ALL deduction line items
- Use null for fields that aren't present in the document
- Parse dates in YYYY-MM-DD format
- Parse numbers without currency symbols or commas
- For percentages, use decimal values (e.g., 85.5 not "85.5%")
- Be precise with grade names (SK DOMESTIC, CH DOMESTIC, STANDARD, JUICE, HassConv, etc.)
- Include size codes exactly as shown (048, 056, 072, 075, 088, 095, 32, 36, 40, 48, 60, 70, 84, etc.)
- CRITICAL for multi-block statements: If the document shows data broken out by block/grove (e.g., "002 - SATICOY 02", "003 - SATICOY 03"), include the block_id on EVERY grade line and deduction. Use just the numeric block code (e.g., "002", "003"). Extract grade lines from ALL blocks, not just the first one. The document may span multiple pages — check ALL pages for block data.
- For Mission Produce statements: The grade/size breakdown table continues across pages. Each block has a subtotal row — extract every size line under each block, tagging each with the block_id. Use "AVOCADOS" for commodity. Map deductions from the payment summary table (CAC, HAB columns) as deductions with block_id.
- CRITICAL for bins: Wash reports often show TWO bin values - "This Date" (incremental for the period) and "Pool-to-Date" or "Block-to-Date" (cumulative). Extract BOTH:
  * bins_this_period = the "This Date" or period-specific incremental value
  * bins_cumulative = the "Pool-to-Date", "Block-to-Date", or cumulative running total
  * total_bins = use bins_this_period if available, otherwise the main bin count shown
- For summary totals: Use the Grand Total row values, not subtotals from a single block

Return ONLY the JSON object, no additional text."""

    def _validate_extraction_data(self, data: Dict[str, Any]) -> List[str]:
        """
        Validate extracted data for structural integrity and sensible values.

        Returns a list of warning messages (empty if all valid).
        Raises ValueError for critical issues that should reject the data.
        """
        warnings = []

        # Validate packinghouse_format
        valid_formats = ('vpoa', 'sla', 'mission', 'generic')
        fmt = data.get('packinghouse_format', 'generic')
        if fmt not in valid_formats:
            data['packinghouse_format'] = 'generic'
            warnings.append(f"Unknown packinghouse_format '{fmt}', defaulted to 'generic'")

        # Validate statement_type
        valid_types = ('packout', 'settlement', 'wash_report', 'grower_statement', '')
        st = data.get('statement_type', '')
        if st not in valid_types:
            warnings.append(f"Unknown statement_type '{st}'")

        # Validate confidence is 0-1
        confidence = data.get('confidence', 0.5)
        try:
            confidence = float(confidence)
            if not (0.0 <= confidence <= 1.0):
                data['confidence'] = max(0.0, min(1.0, confidence))
                warnings.append(f"Confidence {confidence} clamped to [0, 1]")
        except (TypeError, ValueError):
            data['confidence'] = 0.5
            warnings.append("Invalid confidence value, defaulted to 0.5")

        # Validate grade lines
        grade_lines = data.get('grade_lines', [])
        if not isinstance(grade_lines, list):
            data['grade_lines'] = []
            warnings.append("grade_lines was not a list, reset to empty")
        else:
            for i, line in enumerate(grade_lines):
                if not isinstance(line, dict):
                    warnings.append(f"grade_lines[{i}] is not a dict, skipping validation")
                    continue
                qty = line.get('quantity')
                if qty is not None:
                    try:
                        qty_val = float(qty)
                        if qty_val < 0:
                            warnings.append(f"grade_lines[{i}] has negative quantity ({qty_val})")
                        if qty_val > 10_000_000:
                            warnings.append(f"grade_lines[{i}] has suspiciously large quantity ({qty_val})")
                    except (TypeError, ValueError):
                        warnings.append(f"grade_lines[{i}] has non-numeric quantity: {qty}")

                pct = line.get('percent')
                if pct is not None:
                    try:
                        pct_val = float(pct)
                        if pct_val < 0 or pct_val > 100:
                            warnings.append(f"grade_lines[{i}] percent out of range: {pct_val}")
                    except (TypeError, ValueError):
                        pass

        # Validate financials
        financials = data.get('financials')
        if financials and isinstance(financials, dict):
            for key in ('total_credits', 'total_deductions'):
                val = financials.get(key)
                if val is not None:
                    try:
                        if float(val) < 0:
                            warnings.append(f"financials.{key} is negative: {val}")
                    except (TypeError, ValueError):
                        warnings.append(f"financials.{key} is not numeric: {val}")

        # Validate summary
        summary = data.get('summary')
        if summary and isinstance(summary, dict):
            for key in ('total_bins', 'total_weight_lbs', 'total_cartons'):
                val = summary.get(key)
                if val is not None:
                    try:
                        if float(val) < 0:
                            warnings.append(f"summary.{key} is negative: {val}")
                    except (TypeError, ValueError):
                        warnings.append(f"summary.{key} is not numeric: {val}")

        return warnings

    def _parse_extraction_response(self, response_text: str) -> ExtractionResult:
        """Parse Claude's response into an ExtractionResult."""
        try:
            # Try to find JSON in the response
            # Claude might include markdown code blocks
            text = response_text.strip()

            # Remove markdown code blocks if present
            if text.startswith('```json'):
                text = text[7:]
            elif text.startswith('```'):
                text = text[3:]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()

            # Parse JSON
            data = json.loads(text)

            if not isinstance(data, dict):
                return ExtractionResult(
                    success=False,
                    error="Extraction returned non-object JSON"
                )

            # Validate extracted data
            validation_warnings = self._validate_extraction_data(data)
            if validation_warnings:
                logger.warning(f"Extraction validation warnings: {validation_warnings}")

            # Extract validated fields
            packinghouse_format = data.get('packinghouse_format', 'generic')
            statement_type = data.get('statement_type', '')
            confidence = float(data.get('confidence', 0.5))

            return ExtractionResult(
                success=True,
                data=data,
                statement_type=statement_type,
                packinghouse_format=packinghouse_format,
                confidence=confidence
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude response as JSON: {e}")
            logger.debug(f"Response text (first 500 chars): {response_text[:500]}")
            return ExtractionResult(
                success=False,
                error=f"Failed to parse extraction results: {str(e)}"
            )

    def create_packout_report_from_data(
        self,
        extracted_data: Dict[str, Any],
        pool,
        field=None
    ) -> Dict[str, Any]:
        """
        Convert extracted data to PackoutReport model fields.

        Args:
            extracted_data: The extracted_data JSON from a statement
            pool: Pool model instance
            field: Field model instance (optional - packouts may aggregate multiple fields)

        Returns:
            Dictionary ready for PackoutReport.objects.create()
        """
        header = extracted_data.get('header', {})
        summary = extracted_data.get('summary', {})

        # Parse dates
        def parse_date(date_str):
            if not date_str:
                return None
            try:
                return date.fromisoformat(date_str)
            except (ValueError, TypeError):
                return None

        report_data = {
            'pool': pool,
            'field': field,
            'report_date': parse_date(header.get('report_date')) or date.today(),
            'period_start': parse_date(header.get('period_start')) or date.today(),
            'period_end': parse_date(header.get('period_end')) or date.today(),
            'run_numbers': header.get('run_numbers') or '',
            'bins_this_period': Decimal(str(
                summary.get('bins_this_period') or summary.get('total_bins', 0) or 0
            )),
            'bins_cumulative': Decimal(str(
                summary.get('bins_cumulative') or summary.get('total_bins', 0) or 0
            )),
            'total_packed_percent': self._to_decimal(summary.get('total_packed_percent')),
            'house_avg_packed_percent': self._to_decimal(summary.get('house_avg_packed_percent')),
            'juice_percent': self._to_decimal(summary.get('juice_percent')),
            'cull_percent': self._to_decimal(summary.get('cull_percent')),
            'quality_notes': extracted_data.get('quality_notes') or '',
            'grade_data_json': extracted_data,
        }

        return report_data

    def create_settlement_from_data(
        self,
        extracted_data: Dict[str, Any],
        pool,
        field=None
    ) -> Dict[str, Any]:
        """
        Convert extracted data to PoolSettlement model fields.

        Args:
            extracted_data: The extracted_data JSON from a statement
            pool: Pool model instance
            field: Field model instance (optional, null for grower summary)

        Returns:
            Dictionary ready for PoolSettlement.objects.create()
        """
        header = extracted_data.get('header', {})
        summary = extracted_data.get('summary', {})
        financials = extracted_data.get('financials', {})

        # Parse date
        def parse_date(date_str):
            if not date_str:
                return None
            try:
                return date.fromisoformat(date_str)
            except (ValueError, TypeError):
                return None

        # Determine if this commodity uses pounds instead of bins
        from api.services.season_service import get_primary_unit_for_commodity
        commodity = header.get('commodity', '')
        unit_info = get_primary_unit_for_commodity(commodity)
        is_weight_based = (unit_info['unit'] == 'LBS')

        total_bins = self._to_decimal(summary.get('total_bins'))
        total_weight_lbs = self._to_decimal(summary.get('total_weight_lbs'))

        # For weight-based commodities (avocados), total_bins can be null
        # For bin-based commodities (citrus), default total_bins to 0
        if not is_weight_based and total_bins is None:
            total_bins = Decimal('0')

        # Calculate net_per_lb from net_return and total_weight if not extracted
        net_per_lb = self._to_decimal(financials.get('net_per_lb'))
        net_return = self._to_decimal(financials.get('net_return'), default=Decimal('0'))
        if not net_per_lb and total_weight_lbs and total_weight_lbs > 0 and net_return:
            net_per_lb = round(net_return / total_weight_lbs, 4)

        settlement_data = {
            'pool': pool,
            'field': field,
            'statement_date': parse_date(header.get('report_date')) or date.today(),
            'total_bins': total_bins,
            'total_cartons': self._to_decimal(summary.get('total_cartons')),
            'total_weight_lbs': total_weight_lbs,
            'total_credits': self._to_decimal(financials.get('total_credits'), default=Decimal('0')),
            'total_deductions': self._to_decimal(financials.get('total_deductions'), default=Decimal('0')),
            'net_return': net_return,
            'prior_advances': self._to_decimal(financials.get('prior_advances'), default=Decimal('0')),
            'amount_due': self._to_decimal(financials.get('amount_due'), default=Decimal('0')),
            'net_per_bin': self._to_decimal(financials.get('net_per_bin')),
            'net_per_carton': self._to_decimal(financials.get('net_per_carton')),
            'net_per_lb': net_per_lb,
            'house_avg_per_bin': self._to_decimal(financials.get('house_avg_per_bin')),
            'house_avg_per_carton': self._to_decimal(financials.get('house_avg_per_carton')),
            'fresh_fruit_percent': self._to_decimal(summary.get('fresh_fruit_percent')),
            'products_percent': self._to_decimal(summary.get('products_percent')),
            'settlement_data_json': extracted_data,
        }

        return settlement_data

    def get_grade_lines_data(
        self,
        extracted_data: Dict[str, Any],
        for_settlement: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Extract grade lines from extracted data.

        Args:
            extracted_data: The extracted_data JSON
            for_settlement: If True, include fob_rate and total_amount fields

        Returns:
            List of dictionaries for grade line creation
        """
        grade_lines = extracted_data.get('grade_lines', [])
        result = []

        for line in grade_lines:
            line_data = {
                'grade': (line.get('grade') or 'UNKNOWN')[:20],
                'size': (line.get('size') or '')[:10],  # Handle None values, truncate to model max_length
                'unit_of_measure': (line.get('unit') or 'CARTON')[:20],
                'block_id': (line.get('block_id') or '')[:20],
            }

            if for_settlement:
                line_data.update({
                    'quantity': self._to_decimal(line.get('quantity'), default=Decimal('0')),
                    'percent_of_total': self._to_decimal(line.get('percent'), default=Decimal('0')),
                    'fob_rate': self._to_decimal(line.get('fob_rate'), default=Decimal('0')),
                    'total_amount': self._to_decimal(line.get('total_amount'), default=Decimal('0')),
                })
            else:
                line_data.update({
                    'quantity_this_period': self._to_decimal(line.get('quantity'), default=Decimal('0')),
                    'percent_this_period': self._to_decimal(line.get('percent'), default=Decimal('0')),
                })

            result.append(line_data)

        return result

    def get_deductions_data(self, extracted_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extract deduction lines from extracted data.

        Args:
            extracted_data: The extracted_data JSON

        Returns:
            List of dictionaries for deduction creation
        """
        deductions = extracted_data.get('deductions', [])
        result = []

        for ded in deductions:
            ded_data = {
                'category': ded.get('category', 'other'),
                'description': ded.get('description', ''),
                'quantity': self._to_decimal(ded.get('quantity'), default=Decimal('0')),
                'unit_of_measure': ded.get('unit') or 'UNIT',
                'rate': self._to_decimal(ded.get('rate'), default=Decimal('0')),
                'amount': self._to_decimal(ded.get('amount'), default=Decimal('0')),
                'block_id': (ded.get('block_id') or '')[:20],
            }
            result.append(ded_data)

        return result

    def _to_decimal(self, value, default=None) -> Optional[Decimal]:
        """Convert a value to Decimal, returning default if not possible."""
        if value is None:
            return default
        try:
            return Decimal(str(value))
        except (ValueError, TypeError, InvalidOperation):
            return default
