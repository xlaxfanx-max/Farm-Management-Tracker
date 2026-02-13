"""Celery task for async tree detection processing."""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def run_tree_detection_task(self, survey_id):
    """Run YOLO/DeepForest tree detection on a survey image."""
    from api.services.yolo_tree_detection import run_tree_detection

    logger.info(f"Starting tree detection task for survey {survey_id}")
    try:
        run_tree_detection(survey_id)
        logger.info(f"Tree detection completed for survey {survey_id}")
    except Exception as exc:
        logger.error(f"Tree detection failed for survey {survey_id}: {exc}")
        raise self.retry(exc=exc)
