"""
Packinghouse Lookup Service
============================
Auto-detects and matches packinghouses from PDF extraction data.
"""

import logging
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from django.db.models import Q

logger = logging.getLogger(__name__)


@dataclass
class PackinghouseLookupResult:
    """Result of packinghouse lookup attempt."""
    found: bool
    packinghouse: Optional[Any] = None  # Packinghouse model instance
    packinghouse_id: Optional[int] = None
    confidence: float = 0.0
    match_reason: str = ''
    suggestions: List[Dict[str, Any]] = None

    def __post_init__(self):
        if self.suggestions is None:
            self.suggestions = []


class PackinghouseLookupService:
    """
    Service to lookup/match packinghouses from PDF extraction data.

    Matching strategies (in order of priority):
    1. Exact short_code match (e.g., "VPOA", "SLA")
    2. Format code match (vpoa -> VPOA packinghouse)
    3. Name contains match
    4. Fuzzy name match
    """

    # Known format codes mapped to common short codes
    FORMAT_TO_SHORT_CODE = {
        'vpoa': ['VPOA', 'VPO', 'VILLA PARK'],
        'sla': ['SLA', 'SATICOY'],
    }

    def __init__(self, company):
        """
        Initialize the lookup service.

        Args:
            company: Company model instance to scope packinghouse queries
        """
        self.company = company

    def lookup_from_extraction(
        self,
        extracted_data: Dict[str, Any]
    ) -> PackinghouseLookupResult:
        """
        Find a packinghouse from PDF extraction data.

        Args:
            extracted_data: The extracted data dict from PDFExtractionService

        Returns:
            PackinghouseLookupResult with matched packinghouse or suggestions
        """
        from ..models import Packinghouse

        packinghouse_format = extracted_data.get('packinghouse_format', 'generic')
        packinghouse_name = extracted_data.get('packinghouse_name', '')
        packinghouse_short_code = extracted_data.get('packinghouse_short_code', '')

        logger.info(
            f"Looking up packinghouse: format={packinghouse_format}, "
            f"name={packinghouse_name}, short_code={packinghouse_short_code}"
        )

        # Get all packinghouses for this company
        packinghouses = Packinghouse.objects.filter(
            company=self.company,
            is_active=True
        )

        if not packinghouses.exists():
            return PackinghouseLookupResult(
                found=False,
                match_reason="No packinghouses configured for this company"
            )

        # Strategy 1: Exact short_code match
        if packinghouse_short_code:
            match = packinghouses.filter(
                short_code__iexact=packinghouse_short_code.strip()
            ).first()
            if match:
                return PackinghouseLookupResult(
                    found=True,
                    packinghouse=match,
                    packinghouse_id=match.id,
                    confidence=1.0,
                    match_reason=f"Exact short code match: {packinghouse_short_code}"
                )

        # Strategy 2: Format code match
        if packinghouse_format and packinghouse_format != 'generic':
            known_codes = self.FORMAT_TO_SHORT_CODE.get(packinghouse_format.lower(), [])
            for code in known_codes:
                match = packinghouses.filter(
                    Q(short_code__iexact=code) | Q(name__icontains=code)
                ).first()
                if match:
                    return PackinghouseLookupResult(
                        found=True,
                        packinghouse=match,
                        packinghouse_id=match.id,
                        confidence=0.95,
                        match_reason=f"Format code match: {packinghouse_format} -> {match.name}"
                    )

        # Strategy 3: Name contains match
        if packinghouse_name:
            # Try direct contains match
            match = packinghouses.filter(
                name__icontains=packinghouse_name.strip()
            ).first()
            if match:
                return PackinghouseLookupResult(
                    found=True,
                    packinghouse=match,
                    packinghouse_id=match.id,
                    confidence=0.9,
                    match_reason=f"Name contains match: {packinghouse_name}"
                )

            # Try matching individual words from the name
            name_words = [w for w in packinghouse_name.split() if len(w) > 3]
            for word in name_words:
                match = packinghouses.filter(
                    Q(name__icontains=word) | Q(short_code__icontains=word)
                ).first()
                if match:
                    return PackinghouseLookupResult(
                        found=True,
                        packinghouse=match,
                        packinghouse_id=match.id,
                        confidence=0.8,
                        match_reason=f"Partial name match: {word} -> {match.name}"
                    )

        # No match found - return suggestions
        suggestions = [
            {
                'id': p.id,
                'name': p.name,
                'short_code': p.short_code
            }
            for p in packinghouses[:5]
        ]

        return PackinghouseLookupResult(
            found=False,
            confidence=0.0,
            match_reason="No matching packinghouse found",
            suggestions=suggestions
        )

    def lookup_by_format(self, packinghouse_format: str) -> PackinghouseLookupResult:
        """
        Find a packinghouse by format code only.

        Args:
            packinghouse_format: Format code (vpoa, sla, generic)

        Returns:
            PackinghouseLookupResult
        """
        return self.lookup_from_extraction({
            'packinghouse_format': packinghouse_format
        })
