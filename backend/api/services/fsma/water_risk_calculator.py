"""
FSMA Water Assessment Risk Calculator

Calculates risk scores based on FDA Produce Safety Rule criteria (21 CFR 112.43):
- Factor 1: Water source condition and protection
- Factor 2: Water application practices
- Factor 3: Crop characteristics
- Factor 4: Environmental conditions
- Factor 5: Adjacent land uses

Risk Categories and Weights:
- Source Quality (30%): E. coli testing, physical condition, backflow prevention
- Application Method (25%): Irrigation type, crop contact type
- Environmental (25%): CAFO proximity, flooding, wildlife, septic
- Timing (20%): Days before harvest, die-off adequacy
"""

from decimal import Decimal
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from enum import Enum
import math
from datetime import date, timedelta


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class RiskFactor:
    """Individual risk factor identified during assessment."""
    category: str
    issue: str
    severity: str
    points: int
    description: str = ""


@dataclass
class RiskScore:
    """Complete risk calculation result."""
    score: Decimal
    level: RiskLevel
    factors: List[RiskFactor] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)


class FSMAWaterRiskCalculator:
    """
    Calculates FSMA water assessment risk scores.

    Risk score scale: 0-100
    - 0-24: Low risk
    - 25-49: Medium risk
    - 50-74: High risk
    - 75-100: Critical risk
    """

    # Score thresholds for risk levels
    THRESHOLDS = {
        'low': Decimal('25'),
        'medium': Decimal('50'),
        'high': Decimal('75'),
        'critical': Decimal('100'),
    }

    # Weight factors for overall risk calculation
    WEIGHTS = {
        'source': Decimal('0.30'),
        'application': Decimal('0.25'),
        'environmental': Decimal('0.25'),
        'timing': Decimal('0.20'),
    }

    # FDA E. coli standards (CFU/100mL)
    FDA_GM_THRESHOLD = Decimal('126')  # Geometric Mean threshold
    FDA_STV_THRESHOLD = Decimal('410')  # Statistical Threshold Value

    def __init__(self, assessment):
        """
        Initialize calculator with an FSMAWaterAssessment instance.

        Args:
            assessment: FSMAWaterAssessment model instance
        """
        self.assessment = assessment
        self.all_factors: List[RiskFactor] = []
        self.all_recommendations: List[str] = []

    def calculate_overall_risk(self) -> RiskScore:
        """
        Calculate overall assessment risk score using weighted average.

        Returns:
            RiskScore with overall score, level, factors, and recommendations
        """
        # Reset accumulators
        self.all_factors = []
        self.all_recommendations = []

        # Calculate component scores
        source_score = self._calculate_aggregate_source_risk()
        application_score = self._calculate_aggregate_application_risk()
        environmental_score = self._calculate_aggregate_environmental_risk()
        timing_score = self._calculate_timing_risk()

        # Weighted average
        overall = (
            source_score * self.WEIGHTS['source'] +
            application_score * self.WEIGHTS['application'] +
            environmental_score * self.WEIGHTS['environmental'] +
            timing_score * self.WEIGHTS['timing']
        )

        # Ensure score is within bounds
        overall = min(max(overall, Decimal('0')), Decimal('100'))
        level = self._score_to_level(overall)

        # De-duplicate recommendations
        unique_recommendations = list(dict.fromkeys(self.all_recommendations))

        return RiskScore(
            score=overall,
            level=level,
            factors=self.all_factors,
            recommendations=unique_recommendations
        )

    def calculate_source_risk(self, source_assessment) -> RiskScore:
        """
        Calculate risk for a specific water source (Factor 1).

        Evaluates:
        - Source type and control level
        - Physical condition (wellhead, casing, cap)
        - Backflow prevention
        - E. coli testing results
        - Contamination risk factors

        Args:
            source_assessment: FSMASourceAssessment model instance

        Returns:
            RiskScore for this source
        """
        score = Decimal('0')
        factors = []
        recommendations = []
        ws = source_assessment.water_source

        # === SOURCE TYPE ===
        if ws.source_type == 'surface':
            score += Decimal('30')
            factors.append(RiskFactor(
                category='source_type',
                issue='Surface Water Source',
                severity='high',
                points=30,
                description='Surface water has higher contamination risk'
            ))
            recommendations.append('Consider additional treatment for surface water')
        elif ws.source_type == 'well':
            # Well depth assessment
            if ws.well_depth_ft:
                depth = float(ws.well_depth_ft)
                if depth < 50:
                    score += Decimal('20')
                    factors.append(RiskFactor(
                        category='source_type',
                        issue='Shallow Well',
                        severity='medium',
                        points=20,
                        description=f'Well depth ({depth} ft) is less than 50 feet'
                    ))
                    recommendations.append('Consider deeper well or enhanced protection')
                else:
                    score += Decimal('5')
                    factors.append(RiskFactor(
                        category='source_type',
                        issue='Deep Well',
                        severity='low',
                        points=5,
                        description=f'Well depth ({depth} ft) provides natural filtration'
                    ))
        elif ws.source_type == 'municipal':
            score += Decimal('0')
            factors.append(RiskFactor(
                category='source_type',
                issue='Municipal Water',
                severity='low',
                points=0,
                description='Public water system - treated and monitored'
            ))

        # === CONTROL LEVEL ===
        if source_assessment.source_control_level == 'minimal':
            score += Decimal('15')
            factors.append(RiskFactor(
                category='control',
                issue='Minimal Source Control',
                severity='high',
                points=15,
                description='Limited ability to control water source'
            ))
            recommendations.append('Implement additional source protection measures')
        elif source_assessment.source_control_level == 'partial':
            score += Decimal('8')
            factors.append(RiskFactor(
                category='control',
                issue='Partial Source Control',
                severity='medium',
                points=8,
                description='Partial control over water source'
            ))

        # === DISTRIBUTION TYPE ===
        if ws.fsma_distribution_type == 'open':
            score += Decimal('20')
            factors.append(RiskFactor(
                category='distribution',
                issue='Open Distribution System',
                severity='high',
                points=20,
                description='Open canal/ditch system allows contamination'
            ))
            recommendations.append('Consider covering or piping distribution system')
        elif ws.fsma_distribution_type == 'mixed':
            score += Decimal('10')
            factors.append(RiskFactor(
                category='distribution',
                issue='Mixed Distribution System',
                severity='medium',
                points=10,
                description='Mixed open/closed system'
            ))

        # === WELLHEAD CONDITION (for wells) ===
        if ws.source_type == 'well':
            if source_assessment.wellhead_condition == 'poor':
                score += Decimal('25')
                factors.append(RiskFactor(
                    category='infrastructure',
                    issue='Poor Wellhead Condition',
                    severity='critical',
                    points=25,
                    description='Wellhead has significant deficiencies'
                ))
                recommendations.append('Repair or replace wellhead immediately')
            elif source_assessment.wellhead_condition == 'fair':
                score += Decimal('10')
                factors.append(RiskFactor(
                    category='infrastructure',
                    issue='Fair Wellhead Condition',
                    severity='medium',
                    points=10,
                    description='Wellhead has minor issues'
                ))
                recommendations.append('Schedule wellhead maintenance')
            elif source_assessment.wellhead_condition == 'critical':
                score += Decimal('35')
                factors.append(RiskFactor(
                    category='infrastructure',
                    issue='Critical Wellhead Condition',
                    severity='critical',
                    points=35,
                    description='Wellhead requires immediate action'
                ))
                recommendations.append('URGENT: Wellhead repair needed immediately')

            # Well cap
            if source_assessment.well_cap_secure is False:
                score += Decimal('15')
                factors.append(RiskFactor(
                    category='infrastructure',
                    issue='Well Cap Not Secure',
                    severity='high',
                    points=15,
                    description='Well cap is not securely in place'
                ))
                recommendations.append('Secure well cap to prevent contamination')

            # Well casing
            if source_assessment.well_casing_intact is False:
                score += Decimal('20')
                factors.append(RiskFactor(
                    category='infrastructure',
                    issue='Well Casing Compromised',
                    severity='high',
                    points=20,
                    description='Well casing is cracked or damaged'
                ))
                recommendations.append('Repair well casing to prevent infiltration')

            # Backflow prevention
            if source_assessment.backflow_prevention is False:
                score += Decimal('10')
                factors.append(RiskFactor(
                    category='infrastructure',
                    issue='No Backflow Prevention',
                    severity='medium',
                    points=10,
                    description='Backflow prevention device not installed'
                ))
                recommendations.append('Install backflow prevention device')

        # === E. COLI TESTING ===
        if source_assessment.last_generic_ecoli_gm:
            gm = source_assessment.last_generic_ecoli_gm
            if gm > self.FDA_GM_THRESHOLD:
                score += Decimal('40')
                factors.append(RiskFactor(
                    category='testing',
                    issue='E. coli GM Exceeds FDA Threshold',
                    severity='critical',
                    points=40,
                    description=f'GM of {gm} CFU/100mL exceeds 126 CFU/100mL threshold'
                ))
                recommendations.append('Water treatment or die-off period required')
            elif gm > self.FDA_GM_THRESHOLD * Decimal('0.5'):
                score += Decimal('15')
                factors.append(RiskFactor(
                    category='testing',
                    issue='E. coli GM Approaching Threshold',
                    severity='medium',
                    points=15,
                    description=f'GM of {gm} CFU/100mL is above 50% of threshold'
                ))
                recommendations.append('Monitor E. coli levels closely')
        elif source_assessment.last_test_date is None:
            score += Decimal('20')
            factors.append(RiskFactor(
                category='testing',
                issue='No E. coli Testing Data',
                severity='medium',
                points=20,
                description='Water has not been tested for E. coli'
            ))
            recommendations.append('Conduct baseline E. coli testing')

        # Check STV if available
        if source_assessment.last_generic_ecoli_stv:
            stv = source_assessment.last_generic_ecoli_stv
            if stv > self.FDA_STV_THRESHOLD:
                score += Decimal('35')
                factors.append(RiskFactor(
                    category='testing',
                    issue='E. coli STV Exceeds FDA Threshold',
                    severity='critical',
                    points=35,
                    description=f'STV of {stv} CFU/100mL exceeds 410 CFU/100mL threshold'
                ))

        # === CONTAMINATION RISKS ===
        if source_assessment.animal_access_possible:
            score += Decimal('20')
            factors.append(RiskFactor(
                category='contamination',
                issue='Animal Access to Water Source',
                severity='high',
                points=20,
                description='Animals can access the water source'
            ))
            recommendations.append('Install fencing or exclusion measures around water source')

        if source_assessment.debris_present:
            score += Decimal('5')
            factors.append(RiskFactor(
                category='contamination',
                issue='Debris Present',
                severity='low',
                points=5,
                description='Debris observed at or near water source'
            ))
            recommendations.append('Remove debris and maintain clean area around source')

        if source_assessment.standing_water_near_source:
            score += Decimal('10')
            factors.append(RiskFactor(
                category='contamination',
                issue='Standing Water Near Source',
                severity='medium',
                points=10,
                description='Standing water creates contamination risk'
            ))
            recommendations.append('Improve drainage around water source')

        if source_assessment.runoff_exposure:
            score += Decimal('15')
            factors.append(RiskFactor(
                category='contamination',
                issue='Runoff Exposure',
                severity='high',
                points=15,
                description='Water source exposed to runoff'
            ))
            recommendations.append('Implement runoff diversion or protection')

        # === OVERALL CONDITION ===
        if source_assessment.overall_condition == 'poor':
            score += Decimal('15')
            factors.append(RiskFactor(
                category='condition',
                issue='Poor Overall Condition',
                severity='high',
                points=15,
                description='Water system in poor overall condition'
            ))
        elif source_assessment.overall_condition == 'critical':
            score += Decimal('25')
            factors.append(RiskFactor(
                category='condition',
                issue='Critical Overall Condition',
                severity='critical',
                points=25,
                description='Water system requires immediate attention'
            ))

        # Cap score at 100
        score = min(score, Decimal('100'))
        level = self._score_to_level(score)

        return RiskScore(
            score=score,
            level=level,
            factors=factors,
            recommendations=recommendations
        )

    def calculate_field_risk(self, field_assessment) -> RiskScore:
        """
        Calculate risk for field water application (Factor 2 & 3).

        Evaluates:
        - Irrigation method and crop contact
        - Days between irrigation and harvest
        - Crop characteristics (growth position, surface type)
        - Die-off conditions

        Args:
            field_assessment: FSMAFieldAssessment model instance

        Returns:
            RiskScore for this field
        """
        practice_score = Decimal('0')
        crop_score = Decimal('0')
        factors = []
        recommendations = []

        # === FACTOR 2: WATER PRACTICES ===

        # Application method risk
        method_scores = {
            'overhead': Decimal('35'),  # Highest contact risk
            'hand_watering': Decimal('25'),
            'micro_sprinkler': Decimal('20'),
            'furrow': Decimal('15'),
            'drip': Decimal('8'),
            'subsurface': Decimal('3'),
            'none': Decimal('0'),
        }

        method = field_assessment.application_method
        if method in method_scores:
            method_score = method_scores[method]
            practice_score += method_score

            if method == 'overhead':
                factors.append(RiskFactor(
                    category='application',
                    issue='Overhead Sprinkler Irrigation',
                    severity='high',
                    points=int(method_score),
                    description='Overhead irrigation has high crop contact potential'
                ))
                recommendations.append('Consider switching to drip or subsurface irrigation')
            elif method in ['hand_watering', 'micro_sprinkler']:
                factors.append(RiskFactor(
                    category='application',
                    issue=f'{method.replace("_", " ").title()} Irrigation',
                    severity='medium',
                    points=int(method_score),
                    description='Moderate crop contact potential'
                ))

        # Crop contact type
        if field_assessment.crop_contact_type == 'direct':
            practice_score += Decimal('25')
            factors.append(RiskFactor(
                category='application',
                issue='Direct Crop Contact',
                severity='high',
                points=25,
                description='Water directly contacts harvestable portion'
            ))
            recommendations.append('Consider extended die-off period or water treatment')
        elif field_assessment.crop_contact_type == 'indirect':
            practice_score += Decimal('10')
            factors.append(RiskFactor(
                category='application',
                issue='Indirect Crop Contact',
                severity='medium',
                points=10,
                description='Water contacts non-harvestable portions'
            ))

        # Days before harvest
        if field_assessment.typical_days_before_harvest is not None:
            days = field_assessment.typical_days_before_harvest
            if days < 2:
                practice_score += Decimal('35')
                factors.append(RiskFactor(
                    category='timing',
                    issue=f'Very Short Pre-Harvest Interval ({days} days)',
                    severity='critical',
                    points=35,
                    description='Less than 2 days provides minimal die-off time'
                ))
                recommendations.append('CRITICAL: Extend time between final irrigation and harvest')
            elif days < 4:
                practice_score += Decimal('20')
                factors.append(RiskFactor(
                    category='timing',
                    issue=f'Short Pre-Harvest Interval ({days} days)',
                    severity='high',
                    points=20,
                    description='2-3 days may not allow adequate pathogen die-off'
                ))
                recommendations.append('Consider extending pre-harvest interval to 4+ days')
            elif days < 7:
                practice_score += Decimal('10')
                factors.append(RiskFactor(
                    category='timing',
                    issue=f'Moderate Pre-Harvest Interval ({days} days)',
                    severity='medium',
                    points=10,
                    description='4-6 days provides moderate die-off time'
                ))
            elif days < 14:
                practice_score += Decimal('5')
                factors.append(RiskFactor(
                    category='timing',
                    issue=f'Good Pre-Harvest Interval ({days} days)',
                    severity='low',
                    points=5,
                    description='7-13 days provides good die-off time'
                ))
            # 14+ days = 0 additional points (excellent)

        # Foliar applications
        if field_assessment.foliar_applications:
            practice_score += Decimal('15')
            factors.append(RiskFactor(
                category='application',
                issue='Foliar Water Applications',
                severity='medium',
                points=15,
                description='Water used for foliar sprays'
            ))
            recommendations.append('Ensure water quality for foliar applications')

        # === FACTOR 3: CROP CHARACTERISTICS ===

        # Growth position
        position_scores = {
            'tree': Decimal('-10'),  # Negative = risk reduction
            'vine': Decimal('5'),
            'ground': Decimal('20'),
            'root': Decimal('30'),
        }

        position = field_assessment.crop_growth_position
        if position in position_scores:
            pos_score = position_scores[position]
            crop_score += pos_score

            if position == 'tree':
                factors.append(RiskFactor(
                    category='crop',
                    issue='Tree Fruit (Elevated)',
                    severity='low',
                    points=int(pos_score),
                    description='Elevated position reduces splash contamination'
                ))
            elif position == 'ground':
                factors.append(RiskFactor(
                    category='crop',
                    issue='Ground Level Crop',
                    severity='medium',
                    points=int(pos_score),
                    description='Ground contact increases contamination risk'
                ))
            elif position == 'root':
                factors.append(RiskFactor(
                    category='crop',
                    issue='Root Crop',
                    severity='high',
                    points=int(pos_score),
                    description='Root crops have highest soil contact'
                ))

        # Surface type
        surface_scores = {
            'smooth': Decimal('-5'),  # Risk reduction
            'rough': Decimal('10'),
            'netted': Decimal('15'),
            'leafy': Decimal('25'),
        }

        surface = field_assessment.crop_surface_type
        if surface in surface_scores:
            surf_score = surface_scores[surface]
            crop_score += surf_score

            if surface == 'leafy':
                factors.append(RiskFactor(
                    category='crop',
                    issue='Leafy Surface',
                    severity='high',
                    points=int(surf_score),
                    description='Leafy surfaces have highest pathogen attachment'
                ))
            elif surface == 'netted':
                factors.append(RiskFactor(
                    category='crop',
                    issue='Netted Surface',
                    severity='medium',
                    points=int(surf_score),
                    description='Netted surface can trap pathogens'
                ))

        # Internalization risk
        intern_scores = {
            'low': Decimal('0'),
            'medium': Decimal('10'),
            'high': Decimal('20'),
        }

        intern = field_assessment.internalization_risk
        if intern in intern_scores:
            intern_score = intern_scores[intern]
            crop_score += intern_score

            if intern == 'high':
                factors.append(RiskFactor(
                    category='crop',
                    issue='High Internalization Risk',
                    severity='high',
                    points=int(intern_score),
                    description='High susceptibility to pathogen internalization'
                ))
                recommendations.append('Consider water treatment to reduce internalization risk')

        # Die-off adequacy
        if field_assessment.die_off_period_adequate is False:
            practice_score += Decimal('15')
            factors.append(RiskFactor(
                category='timing',
                issue='Inadequate Die-Off Period',
                severity='medium',
                points=15,
                description='Die-off period deemed inadequate'
            ))
            recommendations.append('Extend time between irrigation and harvest')

        # Ensure crop score doesn't go negative
        crop_score = max(crop_score, Decimal('0'))

        # Combined score
        combined_score = min(practice_score + crop_score, Decimal('100'))
        level = self._score_to_level(combined_score)

        return RiskScore(
            score=combined_score,
            level=level,
            factors=factors,
            recommendations=recommendations
        )

    def calculate_environmental_risk(self, env_assessment) -> RiskScore:
        """
        Calculate environmental and adjacent land risk (Factor 4 & 5).

        Evaluates:
        - Flooding history and risk
        - Animal operations proximity
        - Manure application nearby
        - Human waste systems
        - Wildlife pressure
        - Previous contamination history

        Args:
            env_assessment: FSMAEnvironmentalAssessment model instance

        Returns:
            RiskScore for environmental factors
        """
        env_score = Decimal('0')
        adj_score = Decimal('0')
        factors = []
        recommendations = []
        has_adjacent_hazards = False

        # === FACTOR 4: ENVIRONMENTAL CONDITIONS ===

        # Flooding risk
        flood_scores = {
            'high': Decimal('30'),
            'medium': Decimal('15'),
            'low': Decimal('5'),
            'none': Decimal('0'),
        }

        flood_risk = env_assessment.flooding_risk
        if flood_risk in flood_scores:
            flood_score = flood_scores[flood_risk]
            env_score += flood_score

            if flood_risk == 'high':
                factors.append(RiskFactor(
                    category='environmental',
                    issue='High Flooding Risk',
                    severity='critical',
                    points=int(flood_score),
                    description='Frequent flooding events in production area'
                ))
                recommendations.append('Develop flood response protocol')
            elif flood_risk == 'medium':
                factors.append(RiskFactor(
                    category='environmental',
                    issue='Medium Flooding Risk',
                    severity='medium',
                    points=int(flood_score),
                    description='Occasional flooding in production area'
                ))

        # Historical flooding
        if env_assessment.flooding_history:
            env_score += Decimal('15')
            factors.append(RiskFactor(
                category='environmental',
                issue='Flooding History',
                severity='medium',
                points=15,
                description='Previous flooding events documented'
            ))
            recommendations.append('Maintain post-flood assessment procedures')

        # Previous contamination
        if env_assessment.previous_contamination:
            env_score += Decimal('25')
            factors.append(RiskFactor(
                category='environmental',
                issue='Previous Contamination History',
                severity='high',
                points=25,
                description='History of contamination events at this location'
            ))
            recommendations.append('Enhanced monitoring due to contamination history')

        # === FACTOR 5: ADJACENT LAND USES ===

        # CAFO/Animal operations proximity
        proximity_scores = {
            'within_100ft': Decimal('40'),
            '100_400ft': Decimal('25'),
            '400_1000ft': Decimal('12'),
            'over_1000ft': Decimal('5'),
            'none_nearby': Decimal('0'),
        }

        if env_assessment.nearest_cafo_distance:
            cafo_score = proximity_scores.get(env_assessment.nearest_cafo_distance, Decimal('0'))
            adj_score += cafo_score

            if cafo_score >= Decimal('25'):
                has_adjacent_hazards = True
                factors.append(RiskFactor(
                    category='adjacent_land',
                    issue=f'CAFO {env_assessment.nearest_cafo_distance.replace("_", " ")}',
                    severity='critical' if cafo_score >= 40 else 'high',
                    points=int(cafo_score),
                    description='Concentrated animal feeding operation in close proximity'
                ))
                recommendations.append('Implement buffer zones and runoff prevention')

        # Grazing proximity
        if env_assessment.nearest_grazing_distance:
            grazing_score = proximity_scores.get(env_assessment.nearest_grazing_distance, Decimal('0'))
            adj_score += grazing_score * Decimal('0.5')  # Lower weight than CAFO

            if grazing_score >= Decimal('25'):
                has_adjacent_hazards = True
                factors.append(RiskFactor(
                    category='adjacent_land',
                    issue=f'Grazing {env_assessment.nearest_grazing_distance.replace("_", " ")}',
                    severity='high',
                    points=int(grazing_score * Decimal('0.5')),
                    description='Livestock grazing in close proximity'
                ))

        # Animal intrusion history
        if env_assessment.animal_intrusion_history:
            adj_score += Decimal('20')
            has_adjacent_hazards = True
            factors.append(RiskFactor(
                category='adjacent_land',
                issue='Animal Intrusion History',
                severity='high',
                points=20,
                description='History of animal intrusion in production areas'
            ))
            recommendations.append('Strengthen wildlife exclusion measures')

        # Manure application
        if env_assessment.manure_application_nearby:
            adj_score += Decimal('25')
            has_adjacent_hazards = True
            factors.append(RiskFactor(
                category='adjacent_land',
                issue='Manure Application Nearby',
                severity='high',
                points=25,
                description='Manure/BSAAO applied on adjacent land'
            ))
            recommendations.append('Monitor runoff from manure application areas')

        # Human waste / septic
        if env_assessment.human_waste_nearby:
            adj_score += Decimal('20')
            has_adjacent_hazards = True
            factors.append(RiskFactor(
                category='adjacent_land',
                issue='Human Waste Systems Nearby',
                severity='high',
                points=20,
                description='Human waste systems in proximity'
            ))
            recommendations.append('Monitor septic system function')

        if env_assessment.nearest_septic_distance:
            septic_score = proximity_scores.get(env_assessment.nearest_septic_distance, Decimal('0'))
            if septic_score >= Decimal('25'):
                adj_score += septic_score * Decimal('0.5')
                has_adjacent_hazards = True

        # Wildlife pressure
        wildlife_scores = {
            'high': Decimal('20'),
            'medium': Decimal('10'),
            'low': Decimal('3'),
        }

        if env_assessment.wildlife_pressure:
            wildlife_score = wildlife_scores.get(env_assessment.wildlife_pressure, Decimal('0'))
            env_score += wildlife_score

            if env_assessment.wildlife_pressure == 'high':
                factors.append(RiskFactor(
                    category='environmental',
                    issue='High Wildlife Pressure',
                    severity='medium',
                    points=int(wildlife_score),
                    description='High wildlife activity in production areas'
                ))
                recommendations.append('Enhance wildlife exclusion measures')

        # Combine scores
        combined_score = min(env_score + adj_score, Decimal('100'))
        level = self._score_to_level(combined_score)

        # Store adjacent hazard flag for mitigation timing
        result = RiskScore(
            score=combined_score,
            level=level,
            factors=factors,
            recommendations=recommendations
        )

        # Add special attribute for adjacent land hazards
        result.has_adjacent_hazards = has_adjacent_hazards

        return result

    def determine_fda_outcome(self) -> Tuple[str, str]:
        """
        Determine FDA-compliant outcome based on overall risk assessment.

        Returns:
            Tuple of (outcome_code, outcome_description)
        """
        risk = self.calculate_overall_risk()

        if risk.level == RiskLevel.LOW:
            return (
                'no_treatment',
                'Water meets quality standards with no treatment required. '
                'Continue routine monitoring.'
            )

        if risk.level == RiskLevel.MEDIUM:
            # Check if die-off can mitigate
            has_adequate_die_off = self._check_die_off_adequacy()
            if has_adequate_die_off:
                return (
                    'die_off_required',
                    'Die-off period required. Ensure minimum time between '
                    'irrigation and harvest per calculated interval to achieve '
                    'required pathogen reduction.'
                )
            return (
                'testing_required',
                'Additional testing required to characterize water quality. '
                'Conduct E. coli testing to determine appropriate measures.'
            )

        if risk.level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            return (
                'treatment_required',
                'Water treatment required before use. Acceptable options include: '
                'UV treatment, chlorination, ozonation, or other validated methods. '
                'Alternative: implement extended die-off period with verification.'
            )

        return (
            'testing_required',
            'Assessment incomplete. Additional evaluation needed.'
        )

    def calculate_die_off_interval(self, gm_value: Decimal) -> int:
        """
        Calculate required die-off interval using FDA formula.

        Formula: Die-off interval = (log10(GM) - log10(126)) / 0.5

        Where 0.5 represents ~0.5 log reduction per day under adequate conditions
        (good UV exposure, warm temperature, drying).

        Args:
            gm_value: Geometric mean E. coli value in CFU/100mL

        Returns:
            Required die-off interval in days (minimum 0)
        """
        if gm_value <= self.FDA_GM_THRESHOLD:
            return 0

        # Calculate log reduction needed
        log_reduction_needed = math.log10(float(gm_value)) - math.log10(126)

        # Assume 0.5 log reduction per day with adequate UV, temp, drying
        days_needed = int(math.ceil(log_reduction_needed / 0.5))

        return max(0, days_needed)

    def get_mitigation_deadline(self, hazard_source: str, assessment_date: date = None) -> date:
        """
        Calculate mitigation deadline based on hazard type.

        Per FDA requirements:
        - Adjacent land hazards (animal, manure, human waste) = same growing season
        - Other hazards = within 1 year

        Args:
            hazard_source: Type of hazard (from HAZARD_SOURCE_CHOICES)
            assessment_date: Date to calculate from (defaults to today)

        Returns:
            Deadline date for mitigation action
        """
        if assessment_date is None:
            assessment_date = date.today()

        adjacent_sources = [
            'adjacent_animal',
            'adjacent_manure',
            'adjacent_human_waste'
        ]

        if hazard_source in adjacent_sources:
            # Same growing season - assume end of current year for simplicity
            # In practice, this should consider actual harvest dates
            return date(assessment_date.year, 12, 31)
        else:
            # Within 1 year
            return assessment_date + timedelta(days=365)

    # === PRIVATE HELPER METHODS ===

    def _calculate_aggregate_source_risk(self) -> Decimal:
        """Aggregate risk scores from all source assessments."""
        total = Decimal('0')
        count = 0

        for source_assessment in self.assessment.source_assessments.all():
            risk = self.calculate_source_risk(source_assessment)
            total += risk.score
            count += 1
            self.all_factors.extend(risk.factors)
            self.all_recommendations.extend(risk.recommendations)

        return total / max(count, 1)

    def _calculate_aggregate_application_risk(self) -> Decimal:
        """Aggregate risk scores from all field assessments."""
        total = Decimal('0')
        count = 0

        for field_assessment in self.assessment.field_assessments.all():
            risk = self.calculate_field_risk(field_assessment)
            total += risk.score
            count += 1
            self.all_factors.extend(risk.factors)
            self.all_recommendations.extend(risk.recommendations)

        return total / max(count, 1)

    def _calculate_aggregate_environmental_risk(self) -> Decimal:
        """Calculate environmental risk from the first environmental assessment."""
        env = self.assessment.environmental_assessments.first()
        if env:
            risk = self.calculate_environmental_risk(env)
            self.all_factors.extend(risk.factors)
            self.all_recommendations.extend(risk.recommendations)
            return risk.score
        return Decimal('0')

    def _calculate_timing_risk(self) -> Decimal:
        """Calculate timing-related risks across all fields."""
        score = Decimal('0')
        count = 0

        for field_assessment in self.assessment.field_assessments.all():
            if field_assessment.die_off_period_adequate is False:
                score += Decimal('25')
            count += 1

        if count > 0:
            score = score / count

        return min(score, Decimal('100'))

    def _score_to_level(self, score: Decimal) -> RiskLevel:
        """Convert numeric score to risk level category."""
        if score < self.THRESHOLDS['low']:
            return RiskLevel.LOW
        elif score < self.THRESHOLDS['medium']:
            return RiskLevel.MEDIUM
        elif score < self.THRESHOLDS['high']:
            return RiskLevel.HIGH
        return RiskLevel.CRITICAL

    def _check_die_off_adequacy(self) -> bool:
        """Check if die-off conditions are adequate across all fields."""
        for field_assessment in self.assessment.field_assessments.all():
            if field_assessment.die_off_period_adequate is False:
                return False
            if field_assessment.die_off_period_adequate is None:
                # Unknown = not adequate for risk mitigation
                return False
        return True
