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

# Disease prevention tasks
from .disease_tasks import (
    analyze_field_health,
    check_proximity_alerts,
    sync_external_detections,
    send_disease_alert_digest,
)

# FSMA compliance tasks
from .fsma_tasks import (
    check_cleaning_compliance,
    check_quarterly_meeting_compliance,
    generate_monthly_inventory_snapshot,
    generate_audit_binder,
    check_low_inventory_alerts,
    check_phi_compliance_for_upcoming_harvests,
    send_fsma_daily_reminder,
    generate_water_assessment_pdf,
    cleanup_old_fsma_data,
)
