from rest_framework.routers import DefaultRouter

from ..primusgfs_views import (
    ControlledDocumentViewSet,
    InternalAuditViewSet,
    AuditFindingViewSet,
    CorrectiveActionViewSet,
    LandHistoryAssessmentViewSet,
    ApprovedSupplierViewSet,
    IncomingMaterialVerificationViewSet,
    MockRecallViewSet,
    FoodDefensePlanViewSet,
    FieldSanitationLogViewSet,
    EquipmentCalibrationViewSet,
    PestControlProgramViewSet,
    PestMonitoringLogViewSet,
    PreHarvestInspectionViewSet,
    PrimusGFSDashboardViewSet,
    # CAC Food Safety Manual V5.0 additions
    FoodSafetyProfileViewSet,
    FoodSafetyRoleAssignmentViewSet,
    FoodSafetyCommitteeMeetingViewSet,
    ManagementVerificationReviewViewSet,
    TrainingRecordViewSet,
    WorkerTrainingSessionViewSet,
    PerimeterMonitoringLogViewSet,
    PreSeasonChecklistViewSet,
    FieldRiskAssessmentViewSet,
    EmployeeNonConformanceViewSet,
    ProductHoldReleaseViewSet,
    SupplierVerificationLogViewSet,
    FoodFraudAssessmentViewSet,
    EmergencyContactViewSet,
    ChemicalInventoryLogViewSet,
    SanitationMaintenanceLogViewSet,
    CACManualPDFViewSet,
)

from ..audit_binder_views import (
    CACBinderTemplateViewSet,
    AuditBinderInstanceViewSet,
    BinderSectionViewSet,
    BinderSupportingDocumentViewSet,
)

router = DefaultRouter()

# Primus GFS Compliance
router.register(r'primusgfs/documents', ControlledDocumentViewSet, basename='primusgfs-document')
router.register(r'primusgfs/audits', InternalAuditViewSet, basename='primusgfs-audit')
router.register(r'primusgfs/findings', AuditFindingViewSet, basename='primusgfs-finding')
router.register(r'primusgfs/corrective-actions', CorrectiveActionViewSet, basename='primusgfs-ca')
router.register(r'primusgfs/land-assessments', LandHistoryAssessmentViewSet, basename='primusgfs-land-assessment')
router.register(r'primusgfs/suppliers', ApprovedSupplierViewSet, basename='primusgfs-supplier')
router.register(r'primusgfs/material-verifications', IncomingMaterialVerificationViewSet, basename='primusgfs-material-verification')
router.register(r'primusgfs/mock-recalls', MockRecallViewSet, basename='primusgfs-mock-recall')
router.register(r'primusgfs/food-defense', FoodDefensePlanViewSet, basename='primusgfs-food-defense')
router.register(r'primusgfs/sanitation-logs', FieldSanitationLogViewSet, basename='primusgfs-sanitation-log')
router.register(r'primusgfs/calibrations', EquipmentCalibrationViewSet, basename='primusgfs-calibration')
router.register(r'primusgfs/pest-programs', PestControlProgramViewSet, basename='primusgfs-pest-program')
router.register(r'primusgfs/pest-logs', PestMonitoringLogViewSet, basename='primusgfs-pest-log')
router.register(r'primusgfs/pre-harvest', PreHarvestInspectionViewSet, basename='primusgfs-pre-harvest')
router.register(r'primusgfs/dashboard', PrimusGFSDashboardViewSet, basename='primusgfs-dashboard')

# CAC Food Safety Manual V5.0 additions
router.register(r'primusgfs/food-safety-profile', FoodSafetyProfileViewSet, basename='primusgfs-fs-profile')
router.register(r'primusgfs/org-roles', FoodSafetyRoleAssignmentViewSet, basename='primusgfs-org-role')
router.register(r'primusgfs/committee-meetings', FoodSafetyCommitteeMeetingViewSet, basename='primusgfs-committee-meeting')
router.register(r'primusgfs/management-reviews', ManagementVerificationReviewViewSet, basename='primusgfs-mgmt-review')
router.register(r'primusgfs/training-matrix', TrainingRecordViewSet, basename='primusgfs-training-record')
router.register(r'primusgfs/training-sessions', WorkerTrainingSessionViewSet, basename='primusgfs-training-session')
router.register(r'primusgfs/perimeter-logs', PerimeterMonitoringLogViewSet, basename='primusgfs-perimeter-log')
router.register(r'primusgfs/pre-season-checklists', PreSeasonChecklistViewSet, basename='primusgfs-pre-season')
router.register(r'primusgfs/field-risk-assessments', FieldRiskAssessmentViewSet, basename='primusgfs-field-risk')
router.register(r'primusgfs/non-conformances', EmployeeNonConformanceViewSet, basename='primusgfs-non-conformance')
router.register(r'primusgfs/product-holds', ProductHoldReleaseViewSet, basename='primusgfs-product-hold')
router.register(r'primusgfs/supplier-verifications', SupplierVerificationLogViewSet, basename='primusgfs-supplier-verification')
router.register(r'primusgfs/food-fraud-assessments', FoodFraudAssessmentViewSet, basename='primusgfs-food-fraud')
router.register(r'primusgfs/emergency-contacts', EmergencyContactViewSet, basename='primusgfs-emergency-contact')
router.register(r'primusgfs/chemical-inventory', ChemicalInventoryLogViewSet, basename='primusgfs-chemical-inventory')
router.register(r'primusgfs/sanitation-maintenance', SanitationMaintenanceLogViewSet, basename='primusgfs-sanitation-maintenance')
router.register(r'primusgfs/cac-pdf', CACManualPDFViewSet, basename='primusgfs-cac-pdf')

# CAC Audit Binder (PrimusGFS)
router.register(r'primusgfs/cac-templates', CACBinderTemplateViewSet, basename='primusgfs-cac-template')
router.register(r'primusgfs/audit-binders', AuditBinderInstanceViewSet, basename='primusgfs-audit-binder')
router.register(r'primusgfs/binder-sections', BinderSectionViewSet, basename='primusgfs-binder-section')
router.register(r'primusgfs/binder-documents', BinderSupportingDocumentViewSet, basename='primusgfs-binder-document')

urlpatterns = router.urls
