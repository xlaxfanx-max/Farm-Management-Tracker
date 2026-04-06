from rest_framework.routers import DefaultRouter

from ..fsma_views import (
    UserSignatureViewSet,
    FacilityLocationViewSet,
    FacilityCleaningLogViewSet,
    VisitorLogViewSet,
    SafetyMeetingViewSet,
    SafetyMeetingAttendeeViewSet,
    FertilizerInventoryViewSet,
    FertilizerInventoryTransactionViewSet,
    MonthlyInventorySnapshotViewSet,
    PHIComplianceCheckViewSet,
    AuditBinderViewSet,
    FSMADashboardViewSet,
)

from ..fsma_water_views import (
    FSMAWaterAssessmentViewSet,
    FSMASourceAssessmentViewSet,
    FSMAFieldAssessmentViewSet,
    FSMAEnvironmentalAssessmentViewSet,
    FSMAMitigationActionViewSet,
)

from ..traceability_views import (
    TraceabilityLotViewSet,
    TraceabilityEventViewSet,
    LotDispositionViewSet,
    ContaminationIncidentViewSet,
    IncidentCorrectiveActionViewSet,
)

router = DefaultRouter()

# FSMA Compliance Module
router.register(r'fsma/user-signature', UserSignatureViewSet, basename='fsma-user-signature')
router.register(r'fsma/facilities', FacilityLocationViewSet, basename='fsma-facility')
router.register(r'fsma/cleaning-logs', FacilityCleaningLogViewSet, basename='fsma-cleaning-log')
router.register(r'fsma/visitor-logs', VisitorLogViewSet, basename='fsma-visitor-log')
router.register(r'fsma/safety-meetings', SafetyMeetingViewSet, basename='fsma-safety-meeting')
router.register(r'fsma/meeting-attendees', SafetyMeetingAttendeeViewSet, basename='fsma-meeting-attendee')
router.register(r'fsma/fertilizer-inventory', FertilizerInventoryViewSet, basename='fsma-fertilizer-inventory')
router.register(r'fsma/inventory-transactions', FertilizerInventoryTransactionViewSet, basename='fsma-inventory-transaction')
router.register(r'fsma/inventory-snapshots', MonthlyInventorySnapshotViewSet, basename='fsma-inventory-snapshot')
router.register(r'fsma/phi-checks', PHIComplianceCheckViewSet, basename='fsma-phi-check')
router.register(r'fsma/audit-binders', AuditBinderViewSet, basename='fsma-audit-binder')
router.register(r'fsma/dashboard', FSMADashboardViewSet, basename='fsma-dashboard')

# FSMA Water Assessment Module
router.register(r'fsma/water-assessments', FSMAWaterAssessmentViewSet, basename='fsma-water-assessment')
router.register(r'fsma/source-assessments', FSMASourceAssessmentViewSet, basename='fsma-source-assessment')
router.register(r'fsma/field-assessments', FSMAFieldAssessmentViewSet, basename='fsma-field-assessment')
router.register(r'fsma/environmental-assessments', FSMAEnvironmentalAssessmentViewSet, basename='fsma-environmental-assessment')
router.register(r'fsma/mitigation-actions', FSMAMitigationActionViewSet, basename='fsma-mitigation-action')

# FSMA Rule 204 Traceability
router.register(r'fsma/traceability-lots', TraceabilityLotViewSet, basename='fsma-traceability-lot')
router.register(r'fsma/traceability-events', TraceabilityEventViewSet, basename='fsma-traceability-event')
router.register(r'fsma/lot-dispositions', LotDispositionViewSet, basename='fsma-lot-disposition')
router.register(r'fsma/contamination-incidents', ContaminationIncidentViewSet, basename='fsma-contamination-incident')
router.register(r'fsma/incident-corrective-actions', IncidentCorrectiveActionViewSet, basename='fsma-incident-ca')

urlpatterns = router.urls
