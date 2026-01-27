"""
PDF Extraction Service for Packinghouse Statements
===================================================
Uses Claude AI to extract structured data from packinghouse PDF statements.
Supports VPOA and SLA statement formats.
"""

import os
import base64
import logging
import tempfile
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from decimal import Decimal
from datetime import date

import anthropic
import fitz  # PyMuPDF - no external dependencies needed
from django.conf import settings

logger = logging.getLogger(__name__)


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
        logger.info(f"PDFExtractionService init - API key present: {bool(api_key)}")
        if not api_key:
            logger.error("ANTHROPIC_API_KEY not found in environment or settings!")
            logger.error(f"os.environ keys: {[k for k in os.environ.keys() if 'ANTHROPIC' in k.upper()]}")
        if api_key:
            self.client = anthropic.Anthropic(api_key=api_key)
            logger.info("Anthropic client initialized successfully")

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
                logger.info("Late-initialized Anthropic client")
            else:
                logger.error(f"API key still not found. Env has ANTHROPIC keys: {[k for k in os.environ.keys() if 'ANTHROP' in k.upper()]}")
                return ExtractionResult(
                    success=False,
                    error="Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable. Please restart the Django server after adding the key to your .env file."
                )

        try:
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
        try:
            # Open PDF with PyMuPDF
            if pdf_path:
                doc = fitz.open(pdf_path)
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

            doc.close()
            return base64_images

        except Exception as e:
            logger.error(f"Failed to convert PDF to images: {e}")
            return []

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
            max_tokens=4096,
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

        return f"""Analyze this packinghouse statement PDF and extract all data into structured JSON format.
{format_hint}

First, identify:
1. The packinghouse (VPOA/Villa Park Orchards, SLA/Saticoy Lemon, or other)
2. The statement type (packout, settlement, wash_report, grower_statement)
3. Your confidence level (0.0 to 1.0) in the extraction accuracy

Then extract ALL relevant data. Return a JSON object with this structure:

{{
    "packinghouse_format": "vpoa" | "sla" | "generic",
    "packinghouse_name": "string - the full packinghouse name as shown on the document (e.g., 'Villa Park Orchards Association', 'Saticoy Lemon Association')",
    "packinghouse_short_code": "string or null - any abbreviation shown (e.g., 'VPOA', 'SLA')",
    "statement_type": "packout" | "settlement" | "wash_report" | "grower_statement",
    "confidence": 0.0-1.0,

    "header": {{
        "grower_name": "string or null",
        "grower_id": "string or null",
        "pool_id": "string or null",
        "pool_name": "string or null",
        "commodity": "string (e.g., LEMONS, NAVELS)",
        "variety": "string or null",
        "season": "string (e.g., 2024-2025)",
        "report_date": "YYYY-MM-DD",
        "period_start": "YYYY-MM-DD or null",
        "period_end": "YYYY-MM-DD or null",
        "run_numbers": "string or null"
    }},

    "blocks": [
        {{
            "block_id": "string",
            "block_name": "string or null",
            "bins": number,
            "cartons": number or null,
            "weight_lbs": number or null
        }}
    ],

    "grade_lines": [
        {{
            "grade": "string (e.g., SUNKIST, CHOICE, STANDARD, JUICE)",
            "size": "string or null (e.g., 048, 056, 075)",
            "quantity": number,
            "percent": number,
            "unit": "CARTON" | "BIN" | "LBS",
            "fob_rate": number or null,
            "total_amount": number or null
        }}
    ],

    "summary": {{
        "total_bins": number or null,
        "total_cartons": number or null,
        "total_weight_lbs": number or null,
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
        "net_per_carton": number or null,
        "house_avg_per_bin": number or null,
        "house_avg_per_carton": number or null
    }},

    "deductions": [
        {{
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
- Extract ALL grade lines visible in the document
- Extract ALL deduction line items
- Use null for fields that aren't present in the document
- Parse dates in YYYY-MM-DD format
- Parse numbers without currency symbols or commas
- For percentages, use decimal values (e.g., 85.5 not "85.5%")
- Be precise with grade names (SK DOMESTIC, CH DOMESTIC, STANDARD, JUICE, etc.)
- Include size codes exactly as shown (048, 056, 072, 075, 088, 095, etc.)

Return ONLY the JSON object, no additional text."""

    def _parse_extraction_response(self, response_text: str) -> ExtractionResult:
        """Parse Claude's response into an ExtractionResult."""
        import json

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

            # Validate required fields
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
            logger.debug(f"Response text: {response_text[:500]}...")
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
            'bins_this_period': Decimal(str(summary.get('total_bins', 0) or 0)),
            'bins_cumulative': Decimal(str(summary.get('total_bins', 0) or 0)),
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

        settlement_data = {
            'pool': pool,
            'field': field,
            'statement_date': parse_date(header.get('report_date')) or date.today(),
            'total_bins': self._to_decimal(summary.get('total_bins'), default=Decimal('0')),
            'total_cartons': self._to_decimal(summary.get('total_cartons')),
            'total_weight_lbs': self._to_decimal(summary.get('total_weight_lbs')),
            'total_credits': self._to_decimal(financials.get('total_credits'), default=Decimal('0')),
            'total_deductions': self._to_decimal(financials.get('total_deductions'), default=Decimal('0')),
            'net_return': self._to_decimal(financials.get('net_return'), default=Decimal('0')),
            'prior_advances': self._to_decimal(financials.get('prior_advances'), default=Decimal('0')),
            'amount_due': self._to_decimal(financials.get('amount_due'), default=Decimal('0')),
            'net_per_bin': self._to_decimal(financials.get('net_per_bin')),
            'net_per_carton': self._to_decimal(financials.get('net_per_carton')),
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
                'grade': line.get('grade') or 'UNKNOWN',
                'size': line.get('size') or '',  # Handle None values
                'unit_of_measure': line.get('unit') or 'CARTON',
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
                'unit_of_measure': ded.get('unit', 'UNIT'),
                'rate': self._to_decimal(ded.get('rate'), default=Decimal('0')),
                'amount': self._to_decimal(ded.get('amount'), default=Decimal('0')),
            }
            result.append(ded_data)

        return result

    def _to_decimal(self, value, default=None) -> Optional[Decimal]:
        """Convert a value to Decimal, returning default if not possible."""
        if value is None:
            return default
        try:
            return Decimal(str(value))
        except (ValueError, TypeError, Decimal.InvalidOperation):
            return default
