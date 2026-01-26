"""
Statement Matcher Service
=========================
Matches extracted PDF data (grower names, block IDs) to farms and fields
using learned mappings and fuzzy matching.
"""

import logging
from dataclasses import dataclass
from typing import Optional, List, Tuple
from decimal import Decimal
from difflib import SequenceMatcher

from django.db.models import Q

logger = logging.getLogger(__name__)


@dataclass
class MatchResult:
    """Result of matching extracted data to farm/field."""
    farm_id: Optional[int] = None
    farm_name: Optional[str] = None
    field_id: Optional[int] = None
    field_name: Optional[str] = None
    confidence: float = 0.0
    match_reason: str = ""
    needs_review: bool = True
    suggestions: Optional[List[dict]] = None  # Alternative matches if ambiguous

    def to_dict(self) -> dict:
        result = {
            'confidence': round(self.confidence, 2),
            'match_reason': self.match_reason,
            'needs_review': self.needs_review,
        }
        if self.farm_id:
            result['farm'] = {
                'id': self.farm_id,
                'name': self.farm_name
            }
        if self.field_id:
            result['field'] = {
                'id': self.field_id,
                'name': self.field_name
            }
        if self.suggestions:
            result['suggestions'] = self.suggestions
        return result


class StatementMatcher:
    """
    Service for matching extracted PDF data to farms and fields.

    Matching Algorithm:
    1. Check PackinghouseGrowerMapping for exact/fuzzy match
       -> If found, use learned farm/field (confidence: 0.9-0.95)

    2. If no mapping, fuzzy match grower_name to:
       - Farm.owner_name
       - Farm.name
       -> Collect all farms with score >= 0.7

    3. If single farm match -> use it
       If multiple farms:
       -> Match block_name/block_id to Field.name/field_number
       -> If blocks match only one farm -> use that farm
       -> If still ambiguous -> flag for review

    4. Calculate confidence score based on match quality
       - High (>0.85): Auto-confirm eligible
       - Medium (0.5-0.85): Show suggestion, user confirms
       - Low (<0.5): Needs manual review
    """

    # Confidence thresholds
    HIGH_CONFIDENCE = 0.85
    MEDIUM_CONFIDENCE = 0.5
    FUZZY_MATCH_THRESHOLD = 0.7

    # Confidence boosts
    LEARNED_MAPPING_CONFIDENCE = 0.92
    LEARNED_MAPPING_WITH_FIELD = 0.95
    EXACT_NAME_MATCH_CONFIDENCE = 0.88
    FUZZY_NAME_MATCH_BASE = 0.7
    BLOCK_DISAMBIGUATION_BOOST = 0.08
    GROWER_ID_MATCH_BOOST = 0.05

    def __init__(self, company):
        """
        Initialize matcher with company context.

        Args:
            company: The Company instance to scope queries to
        """
        self.company = company

    def match_statement(
        self,
        packinghouse_id: int,
        extracted_data: dict
    ) -> MatchResult:
        """
        Match extracted statement data to a farm and optionally field.

        Args:
            packinghouse_id: ID of the packinghouse
            extracted_data: Extracted data from PDF (header, grower_info, etc.)

        Returns:
            MatchResult with farm/field match and confidence
        """
        from ..models import PackinghouseGrowerMapping, Farm, Field

        # Extract relevant fields from data
        header = extracted_data.get('header', {})
        grower_info = extracted_data.get('grower_info', {})

        grower_name = (
            grower_info.get('grower_name') or
            header.get('grower_name') or
            header.get('grower') or
            ''
        ).strip().upper()

        grower_id = (
            grower_info.get('grower_id') or
            header.get('grower_id') or
            header.get('grower_code') or
            ''
        ).strip().upper()

        block_name = (
            header.get('ranch_name') or
            header.get('block_name') or
            header.get('block_id') or
            grower_info.get('ranch') or
            ''
        ).strip().upper()

        block_id = (
            header.get('block_id') or
            header.get('field_number') or
            ''
        ).strip().upper()

        logger.info(
            f"Matching statement: grower='{grower_name}', "
            f"grower_id='{grower_id}', block='{block_name}'"
        )

        if not grower_name and not grower_id:
            return MatchResult(
                confidence=0.0,
                match_reason="No grower name or ID found in extracted data",
                needs_review=True
            )

        # Step 1: Check learned mappings
        result = self._check_learned_mappings(
            packinghouse_id, grower_name, grower_id, block_name
        )
        if result and result.confidence >= self.MEDIUM_CONFIDENCE:
            return result

        # Step 2: Fuzzy match to farms
        result = self._fuzzy_match_farms(
            grower_name, grower_id, block_name, block_id
        )
        return result

    def _check_learned_mappings(
        self,
        packinghouse_id: int,
        grower_name: str,
        grower_id: str,
        block_name: str
    ) -> Optional[MatchResult]:
        """
        Check for learned mappings from previous confirmations.
        """
        from ..models import PackinghouseGrowerMapping

        # Build query for learned mappings
        # Try exact match first, then fuzzy
        mappings = PackinghouseGrowerMapping.objects.filter(
            packinghouse_id=packinghouse_id,
            farm__company=self.company
        ).select_related('farm', 'field')

        # Exact grower name match
        exact_match = mappings.filter(
            grower_name_pattern__iexact=grower_name
        ).first()

        if exact_match:
            # Check if block pattern also matches
            if exact_match.block_name_pattern and block_name:
                if self._fuzzy_compare(
                    exact_match.block_name_pattern.upper(),
                    block_name
                ) >= self.FUZZY_MATCH_THRESHOLD:
                    # Both grower and block match - high confidence
                    return MatchResult(
                        farm_id=exact_match.farm_id,
                        farm_name=exact_match.farm.name,
                        field_id=exact_match.field_id if exact_match.field else None,
                        field_name=exact_match.field.name if exact_match.field else None,
                        confidence=self.LEARNED_MAPPING_WITH_FIELD,
                        match_reason="Learned mapping (grower + block)",
                        needs_review=False
                    )

            # Just grower match
            return MatchResult(
                farm_id=exact_match.farm_id,
                farm_name=exact_match.farm.name,
                field_id=exact_match.field_id if exact_match.field else None,
                field_name=exact_match.field.name if exact_match.field else None,
                confidence=self.LEARNED_MAPPING_CONFIDENCE,
                match_reason="Learned mapping (grower name)",
                needs_review=False
            )

        # Try grower ID match if available
        if grower_id:
            id_match = mappings.filter(
                grower_id_pattern__iexact=grower_id
            ).first()
            if id_match:
                return MatchResult(
                    farm_id=id_match.farm_id,
                    farm_name=id_match.farm.name,
                    field_id=id_match.field_id if id_match.field else None,
                    field_name=id_match.field.name if id_match.field else None,
                    confidence=self.LEARNED_MAPPING_CONFIDENCE,
                    match_reason="Learned mapping (grower ID)",
                    needs_review=False
                )

        # Try fuzzy grower name match on mappings
        best_mapping = None
        best_score = 0.0
        for mapping in mappings:
            score = self._fuzzy_compare(
                mapping.grower_name_pattern.upper(),
                grower_name
            )
            if score > best_score and score >= self.FUZZY_MATCH_THRESHOLD:
                best_score = score
                best_mapping = mapping

        if best_mapping:
            confidence = self.LEARNED_MAPPING_CONFIDENCE * best_score
            return MatchResult(
                farm_id=best_mapping.farm_id,
                farm_name=best_mapping.farm.name,
                field_id=best_mapping.field_id if best_mapping.field else None,
                field_name=best_mapping.field.name if best_mapping.field else None,
                confidence=confidence,
                match_reason=f"Learned mapping (fuzzy: {best_score:.0%})",
                needs_review=confidence < self.HIGH_CONFIDENCE
            )

        return None

    def _fuzzy_match_farms(
        self,
        grower_name: str,
        grower_id: str,
        block_name: str,
        block_id: str
    ) -> MatchResult:
        """
        Fuzzy match grower name to farms in the company.
        Uses owner_name and farm name for matching.
        """
        from ..models import Farm, Field

        farms = Farm.objects.filter(
            company=self.company,
            active=True
        ).prefetch_related('fields')

        matches = []

        for farm in farms:
            # Calculate match score against owner_name and farm name
            owner_score = self._fuzzy_compare(
                farm.owner_name.upper() if farm.owner_name else '',
                grower_name
            ) if grower_name else 0

            name_score = self._fuzzy_compare(
                farm.name.upper(),
                grower_name
            ) if grower_name else 0

            # Also try matching against farm_number
            farm_number_score = 0
            if farm.farm_number and grower_id:
                farm_number_score = self._fuzzy_compare(
                    farm.farm_number.upper(),
                    grower_id
                )

            best_score = max(owner_score, name_score, farm_number_score)

            if best_score >= self.FUZZY_MATCH_THRESHOLD:
                match_type = 'owner_name' if owner_score == best_score else (
                    'farm_name' if name_score == best_score else 'farm_number'
                )
                matches.append({
                    'farm': farm,
                    'score': best_score,
                    'match_type': match_type
                })

        if not matches:
            return MatchResult(
                confidence=0.0,
                match_reason="No farm matches found",
                needs_review=True,
                suggestions=self._get_farm_suggestions(grower_name)
            )

        # Sort by score descending
        matches.sort(key=lambda x: x['score'], reverse=True)

        # If single match or clear winner
        if len(matches) == 1 or matches[0]['score'] > matches[1]['score'] + 0.1:
            best = matches[0]
            farm = best['farm']

            # Try to match field using block hints
            field_match = self._match_field(
                farm, block_name, block_id
            )

            confidence = self.FUZZY_NAME_MATCH_BASE + (
                best['score'] - self.FUZZY_MATCH_THRESHOLD
            ) * 0.5

            if field_match:
                confidence += self.BLOCK_DISAMBIGUATION_BOOST

            return MatchResult(
                farm_id=farm.id,
                farm_name=farm.name,
                field_id=field_match['id'] if field_match else None,
                field_name=field_match['name'] if field_match else None,
                confidence=min(confidence, 0.89),  # Cap below learned mapping
                match_reason=f"Fuzzy match ({best['match_type']}: {best['score']:.0%})",
                needs_review=confidence < self.HIGH_CONFIDENCE
            )

        # Multiple ambiguous matches - try block disambiguation
        if block_name or block_id:
            disambiguated = self._disambiguate_by_block(
                matches, block_name, block_id
            )
            if disambiguated:
                return disambiguated

        # Return best match with suggestions
        best = matches[0]
        suggestions = [
            {
                'farm_id': m['farm'].id,
                'farm_name': m['farm'].name,
                'score': round(m['score'], 2),
                'match_type': m['match_type']
            }
            for m in matches[:5]  # Top 5 suggestions
        ]

        return MatchResult(
            farm_id=best['farm'].id,
            farm_name=best['farm'].name,
            confidence=self.FUZZY_NAME_MATCH_BASE,
            match_reason=f"Multiple matches - best: {best['match_type']}",
            needs_review=True,
            suggestions=suggestions
        )

    def _match_field(
        self,
        farm,
        block_name: str,
        block_id: str
    ) -> Optional[dict]:
        """
        Try to match a specific field within a farm using block hints.
        """
        if not block_name and not block_id:
            return None

        best_field = None
        best_score = 0.0

        for field in farm.fields.all():
            # Try matching field name
            name_score = self._fuzzy_compare(
                field.name.upper(),
                block_name
            ) if block_name else 0

            # Try matching field number
            number_score = 0
            if field.field_number and block_id:
                number_score = self._fuzzy_compare(
                    field.field_number.upper(),
                    block_id
                )

            score = max(name_score, number_score)

            if score > best_score and score >= self.FUZZY_MATCH_THRESHOLD:
                best_score = score
                best_field = field

        if best_field:
            return {
                'id': best_field.id,
                'name': best_field.name,
                'score': best_score
            }

        return None

    def _disambiguate_by_block(
        self,
        matches: List[dict],
        block_name: str,
        block_id: str
    ) -> Optional[MatchResult]:
        """
        When multiple farms match, use block name to disambiguate.
        """
        field_matches = []

        for match in matches:
            farm = match['farm']
            field_match = self._match_field(farm, block_name, block_id)

            if field_match:
                field_matches.append({
                    'farm': farm,
                    'field': field_match,
                    'farm_score': match['score'],
                    'field_score': field_match['score']
                })

        if len(field_matches) == 1:
            # Block uniquely identifies one farm
            m = field_matches[0]
            confidence = (
                self.FUZZY_NAME_MATCH_BASE +
                self.BLOCK_DISAMBIGUATION_BOOST +
                (m['field_score'] - self.FUZZY_MATCH_THRESHOLD) * 0.3
            )

            return MatchResult(
                farm_id=m['farm'].id,
                farm_name=m['farm'].name,
                field_id=m['field']['id'],
                field_name=m['field']['name'],
                confidence=min(confidence, 0.89),
                match_reason=f"Block disambiguation (field: {m['field_score']:.0%})",
                needs_review=confidence < self.HIGH_CONFIDENCE
            )

        return None

    def _get_farm_suggestions(self, grower_name: str) -> List[dict]:
        """
        Get top farm suggestions even below threshold for manual selection.
        """
        from ..models import Farm

        farms = Farm.objects.filter(
            company=self.company,
            active=True
        )[:20]  # Limit to prevent slow queries

        suggestions = []
        for farm in farms:
            owner_score = self._fuzzy_compare(
                farm.owner_name.upper() if farm.owner_name else '',
                grower_name
            ) if grower_name else 0

            name_score = self._fuzzy_compare(
                farm.name.upper(),
                grower_name
            ) if grower_name else 0

            best_score = max(owner_score, name_score)

            suggestions.append({
                'farm_id': farm.id,
                'farm_name': farm.name,
                'owner_name': farm.owner_name or '',
                'score': round(best_score, 2)
            })

        # Sort by score and return top 5
        suggestions.sort(key=lambda x: x['score'], reverse=True)
        return suggestions[:5]

    def _fuzzy_compare(self, s1: str, s2: str) -> float:
        """
        Calculate fuzzy match score between two strings.
        Returns value between 0.0 and 1.0.
        """
        if not s1 or not s2:
            return 0.0

        # Normalize strings
        s1 = s1.strip().upper()
        s2 = s2.strip().upper()

        if s1 == s2:
            return 1.0

        # Use SequenceMatcher for fuzzy comparison
        return SequenceMatcher(None, s1, s2).ratio()

    def save_mapping(
        self,
        packinghouse_id: int,
        grower_name: str,
        grower_id: str,
        farm_id: int,
        field_id: Optional[int] = None,
        block_name: Optional[str] = None,
        source_statement_id: Optional[int] = None,
        user=None
    ) -> 'PackinghouseGrowerMapping':
        """
        Save a confirmed mapping for future use.

        Args:
            packinghouse_id: Packinghouse ID
            grower_name: Grower name pattern from PDF
            grower_id: Grower ID pattern from PDF (optional)
            farm_id: Target farm ID
            field_id: Target field ID (optional)
            block_name: Block name pattern for field matching (optional)
            source_statement_id: Statement that created this mapping
            user: User who confirmed the mapping

        Returns:
            Created or updated PackinghouseGrowerMapping
        """
        from ..models import PackinghouseGrowerMapping

        # Normalize patterns
        grower_name = grower_name.strip().upper() if grower_name else ''
        grower_id = grower_id.strip().upper() if grower_id else ''
        block_name = block_name.strip().upper() if block_name else ''

        if not grower_name:
            raise ValueError("grower_name is required for mapping")

        # Try to find existing mapping
        existing = PackinghouseGrowerMapping.objects.filter(
            packinghouse_id=packinghouse_id,
            grower_name_pattern__iexact=grower_name,
            block_name_pattern__iexact=block_name
        ).first()

        if existing:
            # Update existing mapping
            existing.farm_id = farm_id
            existing.field_id = field_id
            existing.grower_id_pattern = grower_id
            existing.increment_use_count()
            logger.info(f"Updated existing mapping: {existing}")
            return existing

        # Create new mapping
        mapping = PackinghouseGrowerMapping.objects.create(
            packinghouse_id=packinghouse_id,
            grower_name_pattern=grower_name,
            grower_id_pattern=grower_id,
            block_name_pattern=block_name,
            farm_id=farm_id,
            field_id=field_id,
            created_from_statement_id=source_statement_id,
            created_by=user
        )
        logger.info(f"Created new mapping: {mapping}")
        return mapping

    def batch_match(
        self,
        packinghouse_id: int,
        statements: List['PackinghouseStatement']
    ) -> List[Tuple['PackinghouseStatement', MatchResult]]:
        """
        Match multiple statements in batch.

        Args:
            packinghouse_id: Packinghouse ID
            statements: List of PackinghouseStatement objects

        Returns:
            List of (statement, match_result) tuples
        """
        results = []

        for statement in statements:
            if statement.extracted_data:
                match_result = self.match_statement(
                    packinghouse_id,
                    statement.extracted_data
                )
            else:
                match_result = MatchResult(
                    confidence=0.0,
                    match_reason="No extracted data available",
                    needs_review=True
                )

            results.append((statement, match_result))

        return results
