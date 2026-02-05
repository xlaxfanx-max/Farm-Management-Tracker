"""
Tests for PDF extraction service security and validation.

Covers path traversal protection, file size limits, response validation,
and resource management.
"""

import json
import tempfile
import os
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings

from api.services.pdf_extraction_service import (
    PDFExtractionService,
    ExtractionResult,
    MAX_PDF_FILE_SIZE,
)


class PDFExtractionValidationTests(TestCase):
    """Tests for _validate_extraction_data method."""

    def setUp(self):
        self.service = PDFExtractionService.__new__(PDFExtractionService)

    def test_valid_data_no_warnings(self):
        data = {
            'packinghouse_format': 'vpoa',
            'statement_type': 'packout',
            'confidence': 0.85,
            'grade_lines': [
                {'size': '048', 'quantity': 100, 'percent': 25.5},
            ],
            'financials': {'total_credits': 1500.00, 'total_deductions': 200.00},
            'summary': {'total_bins': 50, 'total_weight_lbs': 25000},
        }
        warnings = self.service._validate_extraction_data(data)
        self.assertEqual(warnings, [])

    def test_unknown_packinghouse_format_defaults_to_generic(self):
        data = {'packinghouse_format': 'unknown_format'}
        warnings = self.service._validate_extraction_data(data)
        self.assertEqual(data['packinghouse_format'], 'generic')
        self.assertTrue(any('Unknown packinghouse_format' in w for w in warnings))

    def test_unknown_statement_type_warns(self):
        data = {'statement_type': 'invalid_type'}
        warnings = self.service._validate_extraction_data(data)
        self.assertTrue(any('Unknown statement_type' in w for w in warnings))

    def test_confidence_clamped_above_1(self):
        data = {'confidence': 1.5}
        warnings = self.service._validate_extraction_data(data)
        self.assertEqual(data['confidence'], 1.0)
        self.assertTrue(any('clamped' in w for w in warnings))

    def test_confidence_clamped_below_0(self):
        data = {'confidence': -0.5}
        warnings = self.service._validate_extraction_data(data)
        self.assertEqual(data['confidence'], 0.0)

    def test_invalid_confidence_defaults_to_half(self):
        data = {'confidence': 'not-a-number'}
        warnings = self.service._validate_extraction_data(data)
        self.assertEqual(data['confidence'], 0.5)
        self.assertTrue(any('Invalid confidence' in w for w in warnings))

    def test_grade_lines_not_list_reset(self):
        data = {'grade_lines': 'not a list'}
        warnings = self.service._validate_extraction_data(data)
        self.assertEqual(data['grade_lines'], [])
        self.assertTrue(any('not a list' in w for w in warnings))

    def test_grade_line_negative_quantity_warns(self):
        data = {'grade_lines': [{'quantity': -50}]}
        warnings = self.service._validate_extraction_data(data)
        self.assertTrue(any('negative quantity' in w for w in warnings))

    def test_grade_line_huge_quantity_warns(self):
        data = {'grade_lines': [{'quantity': 99_000_000}]}
        warnings = self.service._validate_extraction_data(data)
        self.assertTrue(any('suspiciously large' in w for w in warnings))

    def test_grade_line_percent_out_of_range(self):
        data = {'grade_lines': [{'percent': 150}]}
        warnings = self.service._validate_extraction_data(data)
        self.assertTrue(any('percent out of range' in w for w in warnings))

    def test_grade_line_non_numeric_quantity(self):
        data = {'grade_lines': [{'quantity': 'abc'}]}
        warnings = self.service._validate_extraction_data(data)
        self.assertTrue(any('non-numeric quantity' in w for w in warnings))

    def test_negative_financials_warns(self):
        data = {'financials': {'total_credits': -100}}
        warnings = self.service._validate_extraction_data(data)
        self.assertTrue(any('negative' in w for w in warnings))

    def test_negative_summary_warns(self):
        data = {'summary': {'total_bins': -5}}
        warnings = self.service._validate_extraction_data(data)
        self.assertTrue(any('negative' in w for w in warnings))

    def test_non_numeric_financials_warns(self):
        data = {'financials': {'total_credits': 'n/a'}}
        warnings = self.service._validate_extraction_data(data)
        self.assertTrue(any('not numeric' in w for w in warnings))

    def test_valid_packinghouse_formats(self):
        for fmt in ('vpoa', 'sla', 'generic'):
            data = {'packinghouse_format': fmt}
            warnings = self.service._validate_extraction_data(data)
            self.assertEqual(data['packinghouse_format'], fmt)

    def test_valid_statement_types(self):
        for st in ('packout', 'settlement', 'wash_report', 'grower_statement', ''):
            data = {'statement_type': st}
            warnings = self.service._validate_extraction_data(data)
            self.assertFalse(any('Unknown statement_type' in w for w in warnings))


class PDFParseResponseTests(TestCase):
    """Tests for _parse_extraction_response method."""

    def setUp(self):
        self.service = PDFExtractionService.__new__(PDFExtractionService)

    def test_parse_valid_json(self):
        json_str = json.dumps({
            'packinghouse_format': 'vpoa',
            'statement_type': 'packout',
            'confidence': 0.9,
            'grade_lines': [],
        })
        result = self.service._parse_extraction_response(json_str)
        self.assertTrue(result.success)
        self.assertEqual(result.packinghouse_format, 'vpoa')

    def test_parse_json_with_markdown_code_block(self):
        json_str = '```json\n{"packinghouse_format": "sla", "confidence": 0.8}\n```'
        result = self.service._parse_extraction_response(json_str)
        self.assertTrue(result.success)
        self.assertEqual(result.packinghouse_format, 'sla')

    def test_parse_invalid_json(self):
        result = self.service._parse_extraction_response('this is not json')
        self.assertFalse(result.success)
        self.assertIn('parse', result.error.lower())

    def test_parse_non_dict_json(self):
        result = self.service._parse_extraction_response('[1, 2, 3]')
        self.assertFalse(result.success)
        self.assertIn('non-object', result.error)

    def test_parse_empty_string(self):
        result = self.service._parse_extraction_response('')
        self.assertFalse(result.success)


class PDFPathTraversalTests(TestCase):
    """Tests for path traversal protection in _pdf_to_images."""

    def setUp(self):
        self.service = PDFExtractionService.__new__(PDFExtractionService)
        self.service.MAX_PAGES = 10

    @override_settings(MEDIA_ROOT='/app/media')
    def test_path_outside_allowed_dirs_rejected(self):
        """Files outside MEDIA_ROOT and temp dir should be rejected."""
        images = self.service._pdf_to_images(
            pdf_path='/etc/passwd',
            pdf_bytes=None,
        )
        self.assertEqual(images, [])

    @override_settings(MEDIA_ROOT='/app/media')
    def test_path_traversal_attempt_rejected(self):
        """Path traversal attempts should be rejected."""
        images = self.service._pdf_to_images(
            pdf_path='/app/media/../../../etc/passwd',
            pdf_bytes=None,
        )
        self.assertEqual(images, [])

    def test_nonexistent_file_returns_empty(self):
        """Non-existent file paths should return empty list."""
        with tempfile.TemporaryDirectory() as tmpdir:
            images = self.service._pdf_to_images(
                pdf_path=os.path.join(tmpdir, 'nonexistent.pdf'),
                pdf_bytes=None,
            )
            self.assertEqual(images, [])

    def test_no_path_or_bytes_returns_empty(self):
        """Calling with neither path nor bytes should return empty."""
        images = self.service._pdf_to_images(pdf_path=None, pdf_bytes=None)
        self.assertEqual(images, [])


class PDFFileSizeTests(TestCase):
    """Tests for file size limit enforcement."""

    def setUp(self):
        self.service = PDFExtractionService.__new__(PDFExtractionService)
        self.service.client = MagicMock()

    def test_oversized_bytes_rejected(self):
        huge_bytes = b'\x00' * (MAX_PDF_FILE_SIZE + 1)
        result = self.service.extract_from_pdf(pdf_bytes=huge_bytes)
        self.assertFalse(result.success)
        self.assertIn('too large', result.error.lower())

    def test_max_file_size_constant(self):
        self.assertEqual(MAX_PDF_FILE_SIZE, 50 * 1024 * 1024)


class PDFToDecimalTests(TestCase):
    """Tests for _to_decimal helper."""

    def setUp(self):
        self.service = PDFExtractionService.__new__(PDFExtractionService)

    def test_none_returns_default(self):
        self.assertIsNone(self.service._to_decimal(None))
        self.assertEqual(self.service._to_decimal(None, Decimal('0')), Decimal('0'))

    def test_valid_number(self):
        self.assertEqual(self.service._to_decimal('123.45'), Decimal('123.45'))
        self.assertEqual(self.service._to_decimal(42), Decimal('42'))
        self.assertEqual(self.service._to_decimal(3.14), Decimal('3.14'))

    def test_invalid_value_returns_default(self):
        self.assertIsNone(self.service._to_decimal('not-a-number'))
        self.assertEqual(
            self.service._to_decimal('abc', Decimal('0')),
            Decimal('0')
        )
