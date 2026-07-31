from rest_framework.routers import DefaultRouter

from ..compliance_views import (
    ComplianceProfileViewSet,
    ComplianceDeadlineViewSet,
    ComplianceAlertViewSet,
    LicenseViewSet,
    WPSTrainingRecordViewSet,
    CentralPostingLocationViewSet,
    REIPostingRecordViewSet,
    ComplianceReportViewSet,
    IncidentReportViewSet,
    NotificationPreferenceViewSet,
    ComplianceDashboardViewSet,
    InspectorReportViewSet,
    NOISubmissionViewSet,
    WaterGMSTVViewSet,
    SGMAReportExportViewSet,
    PHIComplianceCheckViewSet,
)

router = DefaultRouter()

# Compliance Management
router.register(r'compliance/profile', ComplianceProfileViewSet, basename='compliance-profile')
router.register(r'compliance/deadlines', ComplianceDeadlineViewSet, basename='compliance-deadline')
router.register(r'compliance/alerts', ComplianceAlertViewSet, basename='compliance-alert')
router.register(r'compliance/licenses', LicenseViewSet, basename='license')
router.register(r'compliance/wps-training', WPSTrainingRecordViewSet, basename='wps-training')
router.register(r'compliance/posting-locations', CentralPostingLocationViewSet, basename='posting-location')
router.register(r'compliance/rei-postings', REIPostingRecordViewSet, basename='rei-posting')
router.register(r'compliance/reports', ComplianceReportViewSet, basename='compliance-report')
router.register(r'compliance/incidents', IncidentReportViewSet, basename='incident')
router.register(r'compliance/notification-preferences', NotificationPreferenceViewSet, basename='notification-preference')
router.register(r'compliance/inspector-report', InspectorReportViewSet, basename='inspector-report')
router.register(r'compliance/noi-submissions', NOISubmissionViewSet, basename='noi-submission')
router.register(r'compliance/water-gm-stv', WaterGMSTVViewSet, basename='water-gm-stv')
router.register(r'compliance/sgma-export', SGMAReportExportViewSet, basename='sgma-export')
router.register(r'compliance/phi-checks', PHIComplianceCheckViewSet, basename='phi-check')
router.register(r'compliance/dashboard', ComplianceDashboardViewSet, basename='compliance-dashboard')

urlpatterns = router.urls
