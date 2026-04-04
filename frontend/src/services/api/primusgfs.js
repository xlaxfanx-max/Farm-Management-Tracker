// =============================================================================
// PRIMUS GFS COMPLIANCE API
// =============================================================================

import api from './index';

// Helper: send as multipart if FormData, otherwise JSON
const _postMaybeFile = (url, data) => {
  if (data instanceof FormData) {
    return api.post(url, data, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
  return api.post(url, data);
};
const _putMaybeFile = (url, data) => {
  if (data instanceof FormData) {
    return api.put(url, data, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
  return api.put(url, data);
};

export const primusGFSAPI = {
  // Dashboard
  getDashboard: () => api.get('/primusgfs/dashboard/'),
  getWhatsNext: () => api.get('/primusgfs/dashboard/whats-next/'),
  getPrefill: (module, params = {}) => api.get(`/primusgfs/dashboard/prefill/${module}/`, { params }),
  copyForward: (data) => api.post('/primusgfs/dashboard/copy-forward/', data),
  getSetupStatus: () => api.get('/primusgfs/dashboard/setup-status/'),

  // Documents
  getDocuments: (params = {}) => api.get('/primusgfs/documents/', { params }),
  getDocument: (id) => api.get(`/primusgfs/documents/${id}/`),
  createDocument: (data) => _postMaybeFile('/primusgfs/documents/', data),
  updateDocument: (id, data) => _putMaybeFile(`/primusgfs/documents/${id}/`, data),
  deleteDocument: (id) => api.delete(`/primusgfs/documents/${id}/`),
  approveDocument: (id, data = {}) => api.post(`/primusgfs/documents/${id}/approve/`, data),
  newRevision: (id, data) => api.post(`/primusgfs/documents/${id}/new_revision/`, data),
  overdueReviews: () => api.get('/primusgfs/documents/overdue_reviews/'),

  // Audits
  getAudits: (params = {}) => api.get('/primusgfs/audits/', { params }),
  getAudit: (id) => api.get(`/primusgfs/audits/${id}/`),
  createAudit: (data) => _postMaybeFile('/primusgfs/audits/', data),
  updateAudit: (id, data) => _putMaybeFile(`/primusgfs/audits/${id}/`, data),
  deleteAudit: (id) => api.delete(`/primusgfs/audits/${id}/`),
  completeAudit: (id, data = {}) => api.post(`/primusgfs/audits/${id}/complete/`, data),
  auditSummary: () => api.get('/primusgfs/audits/summary/'),

  // Findings
  getFindings: (params = {}) => api.get('/primusgfs/findings/', { params }),
  getFinding: (id) => api.get(`/primusgfs/findings/${id}/`),
  createFinding: (data) => api.post('/primusgfs/findings/', data),
  updateFinding: (id, data) => api.put(`/primusgfs/findings/${id}/`, data),
  deleteFinding: (id) => api.delete(`/primusgfs/findings/${id}/`),

  // Corrective Actions
  getCorrectiveActions: (params = {}) => api.get('/primusgfs/corrective-actions/', { params }),
  getCorrectiveAction: (id) => api.get(`/primusgfs/corrective-actions/${id}/`),
  createCorrectiveAction: (data) => api.post('/primusgfs/corrective-actions/', data),
  updateCorrectiveAction: (id, data) => api.put(`/primusgfs/corrective-actions/${id}/`, data),
  deleteCorrectiveAction: (id) => api.delete(`/primusgfs/corrective-actions/${id}/`),
  implementCA: (id, data = {}) => api.post(`/primusgfs/corrective-actions/${id}/implement/`, data),
  verifyCA: (id, data = {}) => api.post(`/primusgfs/corrective-actions/${id}/verify/`, data),
  overdueActions: () => api.get('/primusgfs/corrective-actions/overdue/'),

  // Land Assessments
  getLandAssessments: (params = {}) => api.get('/primusgfs/land-assessments/', { params }),
  getLandAssessment: (id) => api.get(`/primusgfs/land-assessments/${id}/`),
  createLandAssessment: (data) => _postMaybeFile('/primusgfs/land-assessments/', data),
  updateLandAssessment: (id, data) => _putMaybeFile(`/primusgfs/land-assessments/${id}/`, data),
  deleteLandAssessment: (id) => api.delete(`/primusgfs/land-assessments/${id}/`),
  approveLandAssessment: (id, data = {}) => api.post(`/primusgfs/land-assessments/${id}/approve/`, data),
  removeLandDocument: (id) => api.post(`/primusgfs/land-assessments/${id}/remove-document/`),
  getLandAssessmentSummary: () => api.get('/primusgfs/land-assessments/summary/'),

  // Suppliers
  getSuppliers: (params = {}) => api.get('/primusgfs/suppliers/', { params }),
  getSupplier: (id) => api.get(`/primusgfs/suppliers/${id}/`),
  createSupplier: (data) => api.post('/primusgfs/suppliers/', data),
  updateSupplier: (id, data) => api.put(`/primusgfs/suppliers/${id}/`, data),
  deleteSupplier: (id) => api.delete(`/primusgfs/suppliers/${id}/`),
  approveSupplier: (id, data = {}) => api.post(`/primusgfs/suppliers/${id}/approve/`, data),
  suspendSupplier: (id, data = {}) => api.post(`/primusgfs/suppliers/${id}/suspend/`, data),
  suppliersDueForReview: () => api.get('/primusgfs/suppliers/due_for_review/'),

  // Material Verifications
  getMaterialVerifications: (params = {}) => api.get('/primusgfs/material-verifications/', { params }),
  createMaterialVerification: (data) => api.post('/primusgfs/material-verifications/', data),
  updateMaterialVerification: (id, data) => api.put(`/primusgfs/material-verifications/${id}/`, data),
  deleteMaterialVerification: (id) => api.delete(`/primusgfs/material-verifications/${id}/`),

  // Mock Recalls
  getMockRecalls: (params = {}) => api.get('/primusgfs/mock-recalls/', { params }),
  getMockRecall: (id) => api.get(`/primusgfs/mock-recalls/${id}/`),
  createMockRecall: (data) => _postMaybeFile('/primusgfs/mock-recalls/', data),
  updateMockRecall: (id, data) => _putMaybeFile(`/primusgfs/mock-recalls/${id}/`, data),
  deleteMockRecall: (id) => api.delete(`/primusgfs/mock-recalls/${id}/`),
  startMockRecall: (id, data = {}) => api.post(`/primusgfs/mock-recalls/${id}/start/`, data),
  completeMockRecall: (id, data) => api.post(`/primusgfs/mock-recalls/${id}/complete/`, data),
  scoreMockRecall: (id, data = {}) => api.post(`/primusgfs/mock-recalls/${id}/score/`, data),

  // Food Defense
  getFoodDefensePlans: (params = {}) => api.get('/primusgfs/food-defense/', { params }),
  getFoodDefensePlan: (id) => api.get(`/primusgfs/food-defense/${id}/`),
  createFoodDefensePlan: (data) => api.post('/primusgfs/food-defense/', data),
  updateFoodDefensePlan: (id, data) => api.put(`/primusgfs/food-defense/${id}/`, data),
  deleteFoodDefensePlan: (id) => api.delete(`/primusgfs/food-defense/${id}/`),
  approveFoodDefensePlan: (id, data = {}) => api.post(`/primusgfs/food-defense/${id}/approve/`, data),

  // Sanitation Logs
  getSanitationLogs: (params = {}) => api.get('/primusgfs/sanitation-logs/', { params }),
  getSanitationLog: (id) => api.get(`/primusgfs/sanitation-logs/${id}/`),
  createSanitationLog: (data) => api.post('/primusgfs/sanitation-logs/', data),
  updateSanitationLog: (id, data) => api.put(`/primusgfs/sanitation-logs/${id}/`, data),
  deleteSanitationLog: (id) => api.delete(`/primusgfs/sanitation-logs/${id}/`),
  todaySanitationLogs: () => api.get('/primusgfs/sanitation-logs/today/'),
  sanitationComplianceSummary: () => api.get('/primusgfs/sanitation-logs/compliance_summary/'),

  // Equipment Calibration
  getCalibrations: (params = {}) => api.get('/primusgfs/calibrations/', { params }),
  getCalibration: (id) => api.get(`/primusgfs/calibrations/${id}/`),
  createCalibration: (data) => _postMaybeFile('/primusgfs/calibrations/', data),
  updateCalibration: (id, data) => _putMaybeFile(`/primusgfs/calibrations/${id}/`, data),
  deleteCalibration: (id) => api.delete(`/primusgfs/calibrations/${id}/`),
  completeCalibration: (id, data) => api.post(`/primusgfs/calibrations/${id}/complete/`, data),
  overdueCalibrations: () => api.get('/primusgfs/calibrations/overdue/'),
  upcomingCalibrations: () => api.get('/primusgfs/calibrations/upcoming/'),

  // Pest Control Programs
  getPestPrograms: (params = {}) => api.get('/primusgfs/pest-programs/', { params }),
  getPestProgram: (id) => api.get(`/primusgfs/pest-programs/${id}/`),
  createPestProgram: (data) => api.post('/primusgfs/pest-programs/', data),
  updatePestProgram: (id, data) => api.put(`/primusgfs/pest-programs/${id}/`, data),
  deletePestProgram: (id) => api.delete(`/primusgfs/pest-programs/${id}/`),
  approvePestProgram: (id, data = {}) => api.post(`/primusgfs/pest-programs/${id}/approve/`, data),

  // Pest Monitoring Logs
  getPestLogs: (params = {}) => api.get('/primusgfs/pest-logs/', { params }),
  getPestLog: (id) => api.get(`/primusgfs/pest-logs/${id}/`),
  createPestLog: (data) => api.post('/primusgfs/pest-logs/', data),
  updatePestLog: (id, data) => api.put(`/primusgfs/pest-logs/${id}/`, data),
  deletePestLog: (id) => api.delete(`/primusgfs/pest-logs/${id}/`),
  pestTrend: () => api.get('/primusgfs/pest-logs/trend/'),

  // Pre-Harvest Inspections
  getPreHarvestInspections: (params = {}) => api.get('/primusgfs/pre-harvest/', { params }),
  getPreHarvestInspection: (id) => api.get(`/primusgfs/pre-harvest/${id}/`),
  createPreHarvestInspection: (data) => api.post('/primusgfs/pre-harvest/', data),
  updatePreHarvestInspection: (id, data) => api.put(`/primusgfs/pre-harvest/${id}/`, data),
  deletePreHarvestInspection: (id) => api.delete(`/primusgfs/pre-harvest/${id}/`),
  completePreHarvestInspection: (id, data) => api.post(`/primusgfs/pre-harvest/${id}/complete_inspection/`, data),
  approvePreHarvestInspection: (id, data = {}) => api.post(`/primusgfs/pre-harvest/${id}/approve/`, data),
  upcomingHarvests: () => api.get('/primusgfs/pre-harvest/upcoming_harvests/'),

  // === CAC Food Safety Manual V5.0 additions ===

  // Food Safety Profile (singleton)
  getFoodSafetyProfile: () => api.get('/primusgfs/food-safety-profile/'),
  updateFoodSafetyProfile: (id, data) => _putMaybeFile(`/primusgfs/food-safety-profile/${id}/`, data),

  // Org Roles
  getOrgRoles: (params = {}) => api.get('/primusgfs/org-roles/', { params }),
  createOrgRole: (data) => api.post('/primusgfs/org-roles/', data),
  updateOrgRole: (id, data) => api.put(`/primusgfs/org-roles/${id}/`, data),
  deleteOrgRole: (id) => api.delete(`/primusgfs/org-roles/${id}/`),

  // Committee Meetings
  getCommitteeMeetings: (params = {}) => api.get('/primusgfs/committee-meetings/', { params }),
  getCommitteeMeeting: (id) => api.get(`/primusgfs/committee-meetings/${id}/`),
  createCommitteeMeeting: (data) => api.post('/primusgfs/committee-meetings/', data),
  updateCommitteeMeeting: (id, data) => api.put(`/primusgfs/committee-meetings/${id}/`, data),
  deleteCommitteeMeeting: (id) => api.delete(`/primusgfs/committee-meetings/${id}/`),
  quarterlyStatus: () => api.get('/primusgfs/committee-meetings/quarterly_status/'),

  // Management Reviews
  getManagementReviews: (params = {}) => api.get('/primusgfs/management-reviews/', { params }),
  getManagementReview: (id) => api.get(`/primusgfs/management-reviews/${id}/`),
  createManagementReview: (data) => _postMaybeFile('/primusgfs/management-reviews/', data),
  updateManagementReview: (id, data) => _putMaybeFile(`/primusgfs/management-reviews/${id}/`, data),
  deleteManagementReview: (id) => api.delete(`/primusgfs/management-reviews/${id}/`),
  currentYearReview: () => api.get('/primusgfs/management-reviews/current_year/'),

  // Training Matrix
  getTrainingRecords: (params = {}) => api.get('/primusgfs/training-matrix/', { params }),
  getTrainingRecord: (id) => api.get(`/primusgfs/training-matrix/${id}/`),
  createTrainingRecord: (data) => api.post('/primusgfs/training-matrix/', data),
  updateTrainingRecord: (id, data) => api.put(`/primusgfs/training-matrix/${id}/`, data),
  deleteTrainingRecord: (id) => api.delete(`/primusgfs/training-matrix/${id}/`),
  trainingMatrixSummary: () => api.get('/primusgfs/training-matrix/matrix_summary/'),
  trainingExpiringSoon: () => api.get('/primusgfs/training-matrix/expiring_soon/'),

  // Training Sessions
  getTrainingSessions: (params = {}) => api.get('/primusgfs/training-sessions/', { params }),
  getTrainingSession: (id) => api.get(`/primusgfs/training-sessions/${id}/`),
  createTrainingSession: (data) => _postMaybeFile('/primusgfs/training-sessions/', data),
  updateTrainingSession: (id, data) => _putMaybeFile(`/primusgfs/training-sessions/${id}/`, data),
  deleteTrainingSession: (id) => api.delete(`/primusgfs/training-sessions/${id}/`),

  // Perimeter Monitoring Logs
  getPerimeterLogs: (params = {}) => api.get('/primusgfs/perimeter-logs/', { params }),
  getPerimeterLog: (id) => api.get(`/primusgfs/perimeter-logs/${id}/`),
  createPerimeterLog: (data) => api.post('/primusgfs/perimeter-logs/', data),
  updatePerimeterLog: (id, data) => api.put(`/primusgfs/perimeter-logs/${id}/`, data),
  deletePerimeterLog: (id) => api.delete(`/primusgfs/perimeter-logs/${id}/`),
  perimeterWeeklyCompliance: () => api.get('/primusgfs/perimeter-logs/weekly_compliance/'),

  // Pre-Season Checklists
  getPreSeasonChecklists: (params = {}) => api.get('/primusgfs/pre-season-checklists/', { params }),
  getPreSeasonChecklist: (id) => api.get(`/primusgfs/pre-season-checklists/${id}/`),
  createPreSeasonChecklist: (data) => api.post('/primusgfs/pre-season-checklists/', data),
  updatePreSeasonChecklist: (id, data) => api.put(`/primusgfs/pre-season-checklists/${id}/`, data),
  deletePreSeasonChecklist: (id) => api.delete(`/primusgfs/pre-season-checklists/${id}/`),
  currentSeasonChecklist: () => api.get('/primusgfs/pre-season-checklists/current_season/'),

  // Field Risk Assessments
  getFieldRiskAssessments: (params = {}) => api.get('/primusgfs/field-risk-assessments/', { params }),
  getFieldRiskAssessment: (id) => api.get(`/primusgfs/field-risk-assessments/${id}/`),
  createFieldRiskAssessment: (data) => _postMaybeFile('/primusgfs/field-risk-assessments/', data),
  updateFieldRiskAssessment: (id, data) => _putMaybeFile(`/primusgfs/field-risk-assessments/${id}/`, data),
  deleteFieldRiskAssessment: (id) => api.delete(`/primusgfs/field-risk-assessments/${id}/`),
  riskSummary: () => api.get('/primusgfs/field-risk-assessments/risk_summary/'),

  // Non-Conformances
  getNonConformances: (params = {}) => api.get('/primusgfs/non-conformances/', { params }),
  getNonConformance: (id) => api.get(`/primusgfs/non-conformances/${id}/`),
  createNonConformance: (data) => api.post('/primusgfs/non-conformances/', data),
  updateNonConformance: (id, data) => api.put(`/primusgfs/non-conformances/${id}/`, data),
  deleteNonConformance: (id) => api.delete(`/primusgfs/non-conformances/${id}/`),

  // Product Holds
  getProductHolds: (params = {}) => api.get('/primusgfs/product-holds/', { params }),
  getProductHold: (id) => api.get(`/primusgfs/product-holds/${id}/`),
  createProductHold: (data) => api.post('/primusgfs/product-holds/', data),
  updateProductHold: (id, data) => api.put(`/primusgfs/product-holds/${id}/`, data),
  deleteProductHold: (id) => api.delete(`/primusgfs/product-holds/${id}/`),
  activeHolds: () => api.get('/primusgfs/product-holds/active_holds/'),

  // Supplier Verifications
  getSupplierVerifications: (params = {}) => api.get('/primusgfs/supplier-verifications/', { params }),
  getSupplierVerification: (id) => api.get(`/primusgfs/supplier-verifications/${id}/`),
  createSupplierVerification: (data) => api.post('/primusgfs/supplier-verifications/', data),
  updateSupplierVerification: (id, data) => api.put(`/primusgfs/supplier-verifications/${id}/`, data),
  deleteSupplierVerification: (id) => api.delete(`/primusgfs/supplier-verifications/${id}/`),

  // Food Fraud Assessments
  getFoodFraudAssessments: (params = {}) => api.get('/primusgfs/food-fraud-assessments/', { params }),
  getFoodFraudAssessment: (id) => api.get(`/primusgfs/food-fraud-assessments/${id}/`),
  createFoodFraudAssessment: (data) => api.post('/primusgfs/food-fraud-assessments/', data),
  updateFoodFraudAssessment: (id, data) => api.put(`/primusgfs/food-fraud-assessments/${id}/`, data),
  deleteFoodFraudAssessment: (id) => api.delete(`/primusgfs/food-fraud-assessments/${id}/`),

  // Emergency Contacts
  getEmergencyContacts: (params = {}) => api.get('/primusgfs/emergency-contacts/', { params }),
  getEmergencyContact: (id) => api.get(`/primusgfs/emergency-contacts/${id}/`),
  createEmergencyContact: (data) => api.post('/primusgfs/emergency-contacts/', data),
  updateEmergencyContact: (id, data) => api.put(`/primusgfs/emergency-contacts/${id}/`, data),
  deleteEmergencyContact: (id) => api.delete(`/primusgfs/emergency-contacts/${id}/`),

  // Chemical Inventory
  getChemicalInventory: (params = {}) => api.get('/primusgfs/chemical-inventory/', { params }),
  getChemicalInventoryItem: (id) => api.get(`/primusgfs/chemical-inventory/${id}/`),
  createChemicalInventory: (data) => api.post('/primusgfs/chemical-inventory/', data),
  updateChemicalInventory: (id, data) => api.put(`/primusgfs/chemical-inventory/${id}/`, data),
  deleteChemicalInventory: (id) => api.delete(`/primusgfs/chemical-inventory/${id}/`),
  chemicalMonthlySummary: () => api.get('/primusgfs/chemical-inventory/monthly_summary/'),

  // Sanitation Maintenance
  getSanitationMaintenance: (params = {}) => api.get('/primusgfs/sanitation-maintenance/', { params }),
  getSanitationMaintenanceItem: (id) => api.get(`/primusgfs/sanitation-maintenance/${id}/`),
  createSanitationMaintenance: (data) => api.post('/primusgfs/sanitation-maintenance/', data),
  updateSanitationMaintenance: (id, data) => api.put(`/primusgfs/sanitation-maintenance/${id}/`, data),
  deleteSanitationMaintenance: (id) => api.delete(`/primusgfs/sanitation-maintenance/${id}/`),

  // CAC Food Safety Manual PDF
  getCACManualFull: () => api.get('/primusgfs/cac-pdf/full/', { responseType: 'blob' }),
  getCACManualSection: (doc) => api.get(`/primusgfs/cac-pdf/section/`, { params: { doc }, responseType: 'blob' }),
  getCACManualPreview: (doc, page) => api.get('/primusgfs/cac-pdf/preview/', { params: { doc, page }, responseType: 'blob' }),
  getCACManualStatus: (params = {}) => api.get('/primusgfs/cac-pdf/status/', { params }),
  signCACPage: (data) => api.post('/primusgfs/cac-pdf/sign/', data),
  getCACSignatures: (params = {}) => api.get('/primusgfs/cac-pdf/signatures/', { params }),
  deleteCACSignature: (id) => api.delete(`/primusgfs/cac-pdf/${id}/signatures/`),

  // CAC PDF Field Schema & Editing
  getCACFieldSchema: (doc, binderSectionId, params = {}) =>
    api.get('/primusgfs/cac-pdf/field-schema/', {
      params: { doc, binder_section: binderSectionId, ...params },
    }),
  getCACManualSectionWithOverrides: (doc, binderSectionId, params = {}) =>
    api.get('/primusgfs/cac-pdf/section/', {
      params: { doc, binder_section: binderSectionId, ...params },
      responseType: 'blob',
    }),

  // CAC Audit Binder - Templates
  getCACTemplates: (params = {}) => api.get('/primusgfs/cac-templates/', { params }),
  getCACTemplate: (id) => api.get(`/primusgfs/cac-templates/${id}/`),
  createCACTemplate: (data) => _postMaybeFile('/primusgfs/cac-templates/', data),
  updateCACTemplate: (id, data) => _putMaybeFile(`/primusgfs/cac-templates/${id}/`, data),
  deleteCACTemplate: (id) => api.delete(`/primusgfs/cac-templates/${id}/`),
  getDefaultSections: () => api.get('/primusgfs/cac-templates/default_sections/'),

  // CAC Audit Binder - Instances
  getAuditBinders: (params = {}) => api.get('/primusgfs/audit-binders/', { params }),
  getAuditBinder: (id) => api.get(`/primusgfs/audit-binders/${id}/`),
  createAuditBinder: (data) => api.post('/primusgfs/audit-binders/create_from_template/', data),
  updateAuditBinder: (id, data) => api.put(`/primusgfs/audit-binders/${id}/`, data),
  deleteAuditBinder: (id) => api.delete(`/primusgfs/audit-binders/${id}/`),
  getBinderReadiness: (id) => api.get(`/primusgfs/audit-binders/${id}/readiness_summary/`),

  // CAC Audit Binder - Sections
  getBinderSections: (params = {}) => api.get('/primusgfs/binder-sections/', { params }),
  getBinderSection: (id) => api.get(`/primusgfs/binder-sections/${id}/`),
  updateBinderSection: (id, data) => api.patch(`/primusgfs/binder-sections/${id}/`, data),
  markSectionComplete: (id) => api.post(`/primusgfs/binder-sections/${id}/mark_complete/`),
  markSectionNA: (id, data = {}) => api.post(`/primusgfs/binder-sections/${id}/mark_not_applicable/`, data),
  updateSectionSOP: (id, data) => api.post(`/primusgfs/binder-sections/${id}/update_sop/`, data),
  updateSectionNotes: (id, data) => api.post(`/primusgfs/binder-sections/${id}/update_notes/`, data),
  autoFillPreview: (id) => api.get(`/primusgfs/binder-sections/${id}/auto_fill_preview/`),
  applyAutoFill: (id, data = {}) => api.post(`/primusgfs/binder-sections/${id}/apply_auto_fill/`, data),
  savePDFFields: (id, fieldValues) =>
    api.post(`/primusgfs/binder-sections/${id}/save_pdf_fields/`, { field_values: fieldValues }),
  resetPDFFields: (id) =>
    api.post(`/primusgfs/binder-sections/${id}/reset_pdf_fields/`),

  // CAC Audit Binder - Supporting Documents
  getBinderDocuments: (params = {}) => api.get('/primusgfs/binder-documents/', { params }),
  uploadBinderDocument: (data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined) formData.append(key, value);
    });
    return api.post('/primusgfs/binder-documents/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteBinderDocument: (id) => api.delete(`/primusgfs/binder-documents/${id}/`),
};
