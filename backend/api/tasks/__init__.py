# Tree detection tasks
from .tree_detection_tasks import run_tree_detection_task

# Compliance management tasks
from .compliance_tasks import (
    check_compliance_deadlines,
    generate_recurring_deadlines,
    check_license_expirations,
    check_wps_training_expirations,
    send_compliance_reminder_emails,
    auto_generate_monthly_pur_report,
    generate_rei_posting_records,
    check_active_reis,
    send_daily_compliance_digest,
    cleanup_old_alerts,
)
