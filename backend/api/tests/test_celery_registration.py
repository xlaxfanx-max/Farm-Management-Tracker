"""
Guards against silent Celery task failures.

If tasks/__init__.py omits a submodule, @shared_task never runs for that
submodule and workers reject the task as unregistered. That used to happen
silently for fsma_tasks and disease_tasks — this test blocks the regression.
"""

from django.conf import settings
from django.test import SimpleTestCase

from pesticide_tracker.celery import app as celery_app


class CeleryTaskRegistrationTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # autodiscover_tasks() is lazy — in the worker it fires on startup,
        # but in tests we need to force it so registrations are visible.
        celery_app.loader.import_default_modules()

    def test_all_beat_schedule_tasks_are_registered(self):
        registered = set(celery_app.tasks.keys())
        scheduled = {
            entry['task']
            for entry in settings.CELERY_BEAT_SCHEDULE.values()
        }
        missing = scheduled - registered
        self.assertFalse(
            missing,
            f"Beat schedule references tasks that are not registered with the "
            f"worker — they will fail silently in production: {sorted(missing)}",
        )

    def test_expected_task_modules_loaded(self):
        registered = set(celery_app.tasks.keys())
        expected = {
            'api.tasks.compliance_tasks.check_compliance_deadlines',
            'api.tasks.disease_tasks.analyze_field_health',
            'api.tasks.disease_tasks.sync_external_detections',
            'api.tasks.fsma_tasks.check_cleaning_compliance',
            'api.tasks.fsma_tasks.generate_audit_binder',
            'api.tasks.tree_detection_tasks.run_tree_detection_task',
        }
        missing = expected - registered
        self.assertFalse(
            missing,
            f"Expected tasks missing from Celery registry: {sorted(missing)}",
        )
