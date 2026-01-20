"""
Celery tasks for disease prevention platform.

These tasks run on schedules or are triggered async to:
- Check proximity alerts for all companies
- Analyze field health from satellite data
- Sync external detection data from CDFA
- Send disease alert digests
- Generate disease alerts based on rules
"""

import logging
from datetime import timedelta
from decimal import Decimal
from celery import shared_task
from django.utils import timezone
from django.db.models import Avg, Count

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def analyze_field_health(self, field_id: int, analysis_id: int = None):
    """
    Async task to analyze field health from satellite data.

    Creates or updates DiseaseAnalysisRun with health metrics,
    and generates alerts if risk levels are elevated.

    Args:
        field_id: Field to analyze
        analysis_id: Optional existing analysis run to update
    """
    from api.models import (
        Field, DiseaseAnalysisRun, DiseaseAlert,
        TreeDetectionRun, DetectedTree
    )

    try:
        field = Field.objects.select_related('farm', 'crop').get(id=field_id)
        company = field.farm.company

        # Get or create analysis run
        if analysis_id:
            analysis = DiseaseAnalysisRun.objects.get(id=analysis_id)
        else:
            analysis = DiseaseAnalysisRun.objects.create(
                company=company,
                field=field,
                status='processing'
            )

        analysis.status = 'processing'
        analysis.save()

        # Get latest tree detection data
        latest_run = field.detection_runs.filter(
            status='completed',
            is_approved=True
        ).order_by('-completed_at').first()

        if not latest_run:
            analysis.status = 'failed'
            analysis.error_message = "No approved tree detection run found for this field"
            analysis.save()
            return {'status': 'failed', 'error': analysis.error_message}

        # Get tree-level NDVI data
        trees = latest_run.trees.filter(status='active')
        tree_stats = trees.aggregate(
            avg_ndvi=Avg('ndvi_value'),
            total_count=Count('id')
        )

        if not tree_stats['total_count']:
            analysis.status = 'failed'
            analysis.error_message = "No active trees found in detection run"
            analysis.save()
            return {'status': 'failed', 'error': analysis.error_message}

        # Calculate health metrics
        avg_ndvi = tree_stats['avg_ndvi'] or 0

        # Classify trees by health status
        trees_healthy = trees.filter(ndvi_value__gte=0.65).count()
        trees_mild_stress = trees.filter(ndvi_value__lt=0.65, ndvi_value__gte=0.55).count()
        trees_moderate_stress = trees.filter(ndvi_value__lt=0.55, ndvi_value__gte=0.45).count()
        trees_severe_stress = trees.filter(ndvi_value__lt=0.45).count()

        # Calculate health score (0-100)
        total_trees = tree_stats['total_count']
        health_score = _calculate_health_score(
            avg_ndvi=avg_ndvi,
            trees_healthy=trees_healthy,
            trees_mild_stress=trees_mild_stress,
            trees_moderate_stress=trees_moderate_stress,
            trees_severe_stress=trees_severe_stress,
            total_trees=total_trees
        )

        # Determine risk level
        risk_level = _determine_risk_level(health_score)

        # Build risk factors list
        risk_factors = _identify_risk_factors(
            avg_ndvi=avg_ndvi,
            trees_severe_stress=trees_severe_stress,
            trees_moderate_stress=trees_moderate_stress,
            total_trees=total_trees
        )

        # Generate recommendations
        recommendations = _generate_recommendations(risk_level, risk_factors)

        # Update analysis record
        analysis.status = 'completed'
        analysis.completed_at = timezone.now()
        analysis.tree_detection_run = latest_run
        analysis.avg_ndvi = Decimal(str(round(avg_ndvi, 3)))
        analysis.canopy_coverage_percent = latest_run.canopy_coverage_percent
        analysis.total_trees_analyzed = total_trees
        analysis.trees_healthy = trees_healthy
        analysis.trees_mild_stress = trees_mild_stress
        analysis.trees_moderate_stress = trees_moderate_stress
        analysis.trees_severe_stress = trees_severe_stress
        analysis.health_score = health_score
        analysis.risk_level = risk_level
        analysis.risk_factors = risk_factors
        analysis.recommendations = recommendations
        analysis.save()

        # Update field with latest analysis
        field.last_health_analysis = analysis
        field.last_health_analysis_date = timezone.now().date()
        field.current_health_score = health_score
        field.current_risk_level = risk_level

        # Set baseline if not established
        if not field.baseline_ndvi:
            field.baseline_ndvi = Decimal(str(round(avg_ndvi, 3)))
            field.baseline_canopy_coverage = latest_run.canopy_coverage_percent
            field.baseline_established_date = timezone.now().date()

        field.save()

        # Generate alerts if needed
        if risk_level in ['high', 'critical']:
            _create_health_alert(analysis, company, field)

        logger.info(f"Health analysis completed for field {field_id}: score={health_score}, risk={risk_level}")
        return {
            'status': 'completed',
            'analysis_id': analysis.id,
            'health_score': health_score,
            'risk_level': risk_level
        }

    except Exception as e:
        logger.error(f"Health analysis failed for field {field_id}: {str(e)}")
        if analysis_id:
            try:
                analysis = DiseaseAnalysisRun.objects.get(id=analysis_id)
                analysis.status = 'failed'
                analysis.error_message = str(e)
                analysis.save()
            except DiseaseAnalysisRun.DoesNotExist:
                pass
        raise self.retry(exc=e)


@shared_task
def check_proximity_alerts():
    """
    Daily task to check all farms against external detections
    and generate proximity alerts.

    Runs at 6 AM daily after external data sync.

    Returns:
        Dictionary with alert statistics
    """
    from api.models import Company, Farm, DiseaseAlert, DiseaseAlertRule, ExternalDetection
    from api.services.proximity_calculator import ProximityCalculator

    calculator = ProximityCalculator()
    stats = {
        'companies_checked': 0,
        'alerts_created': 0,
        'alerts_skipped': 0,
    }

    # Get all companies with farms that have GPS coordinates
    companies = Company.objects.filter(
        farms__gps_latitude__isnull=False
    ).distinct()

    for company in companies:
        stats['companies_checked'] += 1

        # Get company's proximity rules
        rules = DiseaseAlertRule.objects.filter(
            company=company,
            rule_type='proximity',
            is_active=True
        )

        if not rules.exists():
            # Use default thresholds if no rules configured
            rules = [
                {
                    'conditions': {'disease_types': ['hlb'], 'radius_miles': 10},
                    'alert_priority': 'critical'
                },
                {
                    'conditions': {'disease_types': ['acp'], 'radius_miles': 10},
                    'alert_priority': 'high'
                }
            ]

        # Get proximity risks
        risks = calculator.get_proximity_risks_for_company(
            company_id=company.id,
            radius_miles=15.0
        )

        for farm_risk in risks['farms']:
            farm_id = farm_risk['farm_id']

            for risk in farm_risk['risks']:
                # Check against rules
                for rule in rules:
                    conditions = rule['conditions'] if isinstance(rule, dict) else rule.conditions
                    priority = rule['alert_priority'] if isinstance(rule, dict) else rule.alert_priority

                    # Check if disease type matches
                    disease_types = conditions.get('disease_types', [])
                    if disease_types and risk['disease_type'] not in disease_types:
                        continue

                    # Check if within alert radius
                    alert_radius = conditions.get('radius_miles', 10)
                    if risk['distance_miles'] > alert_radius:
                        continue

                    # Check if alert already exists
                    existing = DiseaseAlert.objects.filter(
                        company=company,
                        farm_id=farm_id,
                        related_detection_id=risk['detection_id'],
                        is_active=True
                    ).exists()

                    if existing:
                        stats['alerts_skipped'] += 1
                        continue

                    # Create alert
                    alert_type = f"proximity_{risk['disease_type']}"
                    DiseaseAlert.objects.create(
                        company=company,
                        farm_id=farm_id,
                        alert_type=alert_type,
                        priority=priority,
                        title=f"{risk['disease_name']} detected {risk['distance_miles']} miles away",
                        message=f"A {risk['disease_name']} detection has been confirmed {risk['distance_miles']} miles from {farm_risk['farm_name']} in {risk['county']} County.",
                        distance_miles=Decimal(str(risk['distance_miles'])),
                        related_detection_id=risk['detection_id'],
                        recommended_actions=[
                            "Increase pest monitoring frequency",
                            "Inspect trees for symptoms",
                            "Review ACP treatment schedule",
                            "Contact local agricultural commissioner for guidance"
                        ]
                    )
                    stats['alerts_created'] += 1

    logger.info(f"Proximity check complete: {stats}")
    return stats


@shared_task(bind=True, max_retries=3, default_retry_delay=600)
def sync_external_detections(self):
    """
    Daily task to sync disease detections from CDFA and other sources.

    Syncs:
    - HLB detections from CDFA announcements
    - ACP detections and trap data
    - Quarantine zone boundaries from CDFA ArcGIS API

    Runs at 5 AM daily before proximity alert check.

    Returns:
        Dictionary with sync statistics
    """
    try:
        from api.services.cdfa_data_sync import CDFADataSync

        logger.info("Starting CDFA data sync...")
        sync = CDFADataSync()
        results = sync.sync_all()

        summary = results.get('summary', {})
        logger.info(
            f"CDFA sync complete: {summary.get('total_created', 0)} created, "
            f"{summary.get('total_updated', 0)} updated, "
            f"{summary.get('total_errors', 0)} errors"
        )

        # Trigger proximity check after successful sync
        check_proximity_alerts.delay()

        return results

    except Exception as e:
        logger.error(f"CDFA sync failed: {str(e)}")
        raise self.retry(exc=e)


@shared_task
def send_disease_alert_digest():
    """
    Send daily digest of disease alerts to users.

    Runs at 7 AM daily to send summary of:
    - New alerts from past 24 hours
    - Critical/high priority items
    - Recommended actions
    """
    from api.models import Company, DiseaseAlert, User
    from django.core.mail import send_mail
    from django.template.loader import render_to_string
    from django.conf import settings

    yesterday = timezone.now() - timedelta(days=1)
    stats = {'emails_sent': 0, 'companies_notified': 0}

    # Get companies with new alerts
    companies = Company.objects.filter(
        disease_alerts__created_at__gte=yesterday,
        disease_alerts__is_active=True
    ).distinct()

    for company in companies:
        alerts = DiseaseAlert.objects.filter(
            company=company,
            created_at__gte=yesterday,
            is_active=True
        ).order_by('-priority', '-created_at')

        if not alerts.exists():
            continue

        # Get users to notify (company admins/owners)
        users = User.objects.filter(
            current_company=company,
            is_active=True
        )

        critical_count = alerts.filter(priority='critical').count()
        high_count = alerts.filter(priority='high').count()

        for user in users:
            try:
                # Build email content
                subject = f"Disease Alert Digest - {company.name}"
                if critical_count:
                    subject = f"[CRITICAL] {subject}"

                # Simple text email for now
                message_lines = [
                    f"Disease Alert Summary for {company.name}",
                    f"Generated: {timezone.now().strftime('%Y-%m-%d %H:%M')}",
                    "",
                    f"Total New Alerts: {alerts.count()}",
                    f"Critical: {critical_count}",
                    f"High Priority: {high_count}",
                    "",
                    "Recent Alerts:",
                    "-" * 40,
                ]

                for alert in alerts[:10]:
                    message_lines.append(f"[{alert.priority.upper()}] {alert.title}")
                    if alert.distance_miles:
                        message_lines.append(f"  Distance: {alert.distance_miles} miles")
                    message_lines.append("")

                message_lines.extend([
                    "-" * 40,
                    "Log in to Grove Master to view details and take action.",
                ])

                message = "\n".join(message_lines)

                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=True,
                )
                stats['emails_sent'] += 1

            except Exception as e:
                logger.error(f"Failed to send digest to {user.email}: {e}")

        stats['companies_notified'] += 1

    logger.info(f"Disease digest sent: {stats}")
    return stats


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _calculate_health_score(
    avg_ndvi: float,
    trees_healthy: int,
    trees_mild_stress: int,
    trees_moderate_stress: int,
    trees_severe_stress: int,
    total_trees: int
) -> int:
    """
    Calculate overall health score 0-100.

    Components:
    - NDVI component (40 points max)
    - Tree health distribution (40 points max)
    - Severe stress penalty (20 points max)
    """
    score = 0

    # NDVI component (40 points)
    # NDVI of 0.8+ = full points, scales down from there
    if avg_ndvi:
        ndvi_score = min(40, int(avg_ndvi * 50))
        score += ndvi_score

    # Health distribution (40 points)
    if total_trees > 0:
        healthy_pct = trees_healthy / total_trees
        score += int(healthy_pct * 40)

    # Severe stress penalty (up to -20 points)
    if total_trees > 0:
        severe_pct = trees_severe_stress / total_trees
        penalty = int(severe_pct * 20)
        score = max(0, score - penalty)

    return min(100, max(0, score))


def _determine_risk_level(health_score: int) -> str:
    """Map health score to risk level."""
    if health_score >= 80:
        return 'low'
    elif health_score >= 60:
        return 'moderate'
    elif health_score >= 40:
        return 'high'
    else:
        return 'critical'


def _identify_risk_factors(
    avg_ndvi: float,
    trees_severe_stress: int,
    trees_moderate_stress: int,
    total_trees: int
) -> list:
    """Identify contributing risk factors."""
    factors = []

    if avg_ndvi < 0.55:
        factors.append(f"Low average NDVI ({avg_ndvi:.2f}) indicates field-wide stress")
    elif avg_ndvi < 0.65:
        factors.append(f"Below-optimal NDVI ({avg_ndvi:.2f}) suggests mild stress")

    if total_trees > 0:
        severe_pct = (trees_severe_stress / total_trees) * 100
        moderate_pct = (trees_moderate_stress / total_trees) * 100

        if severe_pct >= 5:
            factors.append(f"{trees_severe_stress} trees ({severe_pct:.1f}%) showing severe stress")
        if moderate_pct >= 10:
            factors.append(f"{trees_moderate_stress} trees ({moderate_pct:.1f}%) showing moderate stress")

    return factors


def _generate_recommendations(risk_level: str, risk_factors: list) -> list:
    """Generate recommendations based on risk assessment."""
    recommendations = []

    if risk_level == 'critical':
        recommendations.extend([
            "Immediate ground inspection recommended",
            "Contact agricultural consultant or extension office",
            "Document symptoms with photos for diagnosis",
            "Isolate affected area if disease is suspected"
        ])
    elif risk_level == 'high':
        recommendations.extend([
            "Schedule ground inspection within 1-2 weeks",
            "Increase monitoring frequency",
            "Review irrigation and nutrition programs",
            "Check for pest or disease symptoms"
        ])
    elif risk_level == 'moderate':
        recommendations.extend([
            "Monitor stressed areas during next field visit",
            "Consider targeted soil or tissue sampling",
            "Review recent weather impacts"
        ])
    else:
        recommendations.append("Continue regular monitoring schedule")

    return recommendations


def _create_health_alert(analysis, company, field):
    """Create a disease alert based on health analysis results."""
    from api.models import DiseaseAlert

    # Check if similar alert already exists
    existing = DiseaseAlert.objects.filter(
        company=company,
        field=field,
        alert_type='ndvi_anomaly',
        is_active=True,
        created_at__gte=timezone.now() - timedelta(days=7)
    ).exists()

    if existing:
        return None

    priority_map = {
        'critical': 'critical',
        'high': 'high',
        'moderate': 'medium',
        'low': 'low'
    }

    alert = DiseaseAlert.objects.create(
        company=company,
        farm=field.farm,
        field=field,
        alert_type='ndvi_anomaly',
        priority=priority_map.get(analysis.risk_level, 'medium'),
        title=f"Health Alert: {field.name}",
        message=f"Field '{field.name}' has a health score of {analysis.health_score}/100 ({analysis.risk_level} risk). {len(analysis.risk_factors)} risk factors identified.",
        related_analysis=analysis,
        recommended_actions=analysis.recommendations
    )

    return alert
