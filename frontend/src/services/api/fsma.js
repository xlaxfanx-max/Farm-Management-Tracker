// =============================================================================
// FSMA COMPLIANCE API
// =============================================================================

import api from './index';

export const fsmaAPI = {
  // -------------------------------------------------------------------------
  // User Signature
  // -------------------------------------------------------------------------
  getUserSignature: () => api.get('/fsma/user-signature/'),
  saveUserSignature: (signatureData) =>
    api.post('/fsma/user-signature/save_signature/', { signature_data: signatureData }),

  // -------------------------------------------------------------------------
  // Facilities
  // -------------------------------------------------------------------------
  getFacilities: (params = {}) => api.get('/fsma/facilities/', { params }),
  getFacility: (id) => api.get(`/fsma/facilities/${id}/`),
  createFacility: (data) => api.post('/fsma/facilities/', data),
  updateFacility: (id, data) => api.put(`/fsma/facilities/${id}/`, data),
  deleteFacility: (id) => api.delete(`/fsma/facilities/${id}/`),

  // -------------------------------------------------------------------------
  // Cleaning Logs
  // -------------------------------------------------------------------------
  getCleaningLogs: (params = {}) => api.get('/fsma/cleaning-logs/', { params }),
  getCleaningLog: (id) => api.get(`/fsma/cleaning-logs/${id}/`),
  createCleaningLog: (data) => api.post('/fsma/cleaning-logs/', data),
  updateCleaningLog: (id, data) => api.put(`/fsma/cleaning-logs/${id}/`, data),
  deleteCleaningLog: (id) => api.delete(`/fsma/cleaning-logs/${id}/`),
  getTodaySchedule: () => api.get('/fsma/cleaning-logs/today_schedule/'),
  getCleaningComplianceStatus: () => api.get('/fsma/cleaning-logs/compliance_status/'),

  // -------------------------------------------------------------------------
  // Visitor Logs
  // -------------------------------------------------------------------------
  getVisitorLogs: (params = {}) => api.get('/fsma/visitor-logs/', { params }),
  getVisitorLog: (id) => api.get(`/fsma/visitor-logs/${id}/`),
  createVisitorLog: (data) => api.post('/fsma/visitor-logs/', data),
  updateVisitorLog: (id, data) => api.put(`/fsma/visitor-logs/${id}/`, data),
  deleteVisitorLog: (id) => api.delete(`/fsma/visitor-logs/${id}/`),
  quickEntryVisitor: (data) => api.post('/fsma/visitor-logs/quick_entry/', data),
  signOutVisitor: (id, data) => api.post(`/fsma/visitor-logs/${id}/sign_out/`, data),
  checkHarvestOverlap: (data) => api.post('/fsma/visitor-logs/harvest_overlap/', data),
  linkVisitorToHarvest: (id, harvestId) =>
    api.post(`/fsma/visitor-logs/${id}/link_harvest/`, { harvest_id: harvestId }),

  // -------------------------------------------------------------------------
  // Safety Meetings
  // -------------------------------------------------------------------------
  getSafetyMeetings: (params = {}) => api.get('/fsma/safety-meetings/', { params }),
  getSafetyMeeting: (id) => api.get(`/fsma/safety-meetings/${id}/`),
  createSafetyMeeting: (data) => api.post('/fsma/safety-meetings/', data),
  updateSafetyMeeting: (id, data) => api.put(`/fsma/safety-meetings/${id}/`, data),
  deleteSafetyMeeting: (id) => api.delete(`/fsma/safety-meetings/${id}/`),
  addMeetingAttendee: (meetingId, data) =>
    api.post(`/fsma/safety-meetings/${meetingId}/add_attendee/`, data),
  removeMeetingAttendee: (meetingId, attendeeId) =>
    api.delete(`/fsma/meeting-attendees/${attendeeId}/`),
  getQuarterlyMeetingCompliance: () =>
    api.get('/fsma/safety-meetings/quarterly_compliance/'),

  // -------------------------------------------------------------------------
  // Fertilizer Inventory
  // -------------------------------------------------------------------------
  getFertilizerInventory: (params = {}) => api.get('/fsma/fertilizer-inventory/', { params }),
  getFertilizerInventoryItem: (id) => api.get(`/fsma/fertilizer-inventory/${id}/`),
  adjustInventory: (id, data) =>
    api.post(`/fsma/fertilizer-inventory/${id}/adjust/`, data),
  getLowStockItems: () => api.get('/fsma/fertilizer-inventory/low_stock/'),
  getInventoryTransactions: (inventoryId) =>
    api.get(`/fsma/fertilizer-inventory/${inventoryId}/transactions/`),
  recordInventoryPurchase: (data) =>
    api.post('/fsma/inventory-transactions/purchase/', data),
  getFertilizerProducts: () => api.get('/fertilizer-products/'),

  // -------------------------------------------------------------------------
  // Monthly Inventory Snapshots
  // -------------------------------------------------------------------------
  getInventorySnapshots: (params = {}) => api.get('/fsma/inventory-snapshots/', { params }),
  generateInventorySnapshot: (data) =>
    api.post('/fsma/inventory-snapshots/generate/', data),

  // -------------------------------------------------------------------------
  // PHI Compliance Checks
  // -------------------------------------------------------------------------
  getPHIChecks: (params = {}) => api.get('/fsma/phi-checks/', { params }),
  getPHICheck: (id) => api.get(`/fsma/phi-checks/${id}/`),
  runPHIPreCheck: (data) => api.post('/fsma/phi-checks/pre_check/', data),
  verifyPHICheck: (id) => api.post(`/fsma/phi-checks/${id}/verify/`),
  overridePHICheck: (id, data) => api.post(`/fsma/phi-checks/${id}/override/`, data),

  // -------------------------------------------------------------------------
  // Audit Binders
  // -------------------------------------------------------------------------
  getAuditBinders: (params = {}) => api.get('/fsma/audit-binders/', { params }),
  getAuditBinder: (id) => api.get(`/fsma/audit-binders/${id}/`),
  generateAuditBinder: (data) => api.post('/fsma/audit-binders/generate/', data),
  getAuditBinderStatus: (id) => api.get(`/fsma/audit-binders/${id}/status/`),
  downloadAuditBinder: (id) =>
    api.get(`/fsma/audit-binders/${id}/download/`, { responseType: 'blob' }),
  deleteAuditBinder: (id) => api.delete(`/fsma/audit-binders/${id}/`),

  // -------------------------------------------------------------------------
  // FSMA Dashboard
  // -------------------------------------------------------------------------
  getDashboard: () => api.get('/fsma/dashboard/'),
  getDashboardMetrics: () => api.get('/fsma/dashboard/metrics/'),

  // -------------------------------------------------------------------------
  // Water Assessments (21 CFR 112.43)
  // -------------------------------------------------------------------------
  getWaterAssessments: (params = {}) => api.get('/fsma/water-assessments/', { params }),
  getWaterAssessment: (id) => api.get(`/fsma/water-assessments/${id}/`),
  createWaterAssessment: (data) => api.post('/fsma/water-assessments/', data),
  updateWaterAssessment: (id, data) => api.put(`/fsma/water-assessments/${id}/`, data),
  deleteWaterAssessment: (id) => api.delete(`/fsma/water-assessments/${id}/`),
  calculateWaterRisk: (id) => api.post(`/fsma/water-assessments/${id}/calculate_risk/`),
  submitWaterAssessment: (id, data) => api.post(`/fsma/water-assessments/${id}/submit/`, data),
  approveWaterAssessment: (id, data) => api.post(`/fsma/water-assessments/${id}/approve/`, data),
  downloadWaterAssessmentPdf: (id) =>
    api.get(`/fsma/water-assessments/${id}/download/`, { responseType: 'blob' }),
  duplicateWaterAssessment: (id, data) =>
    api.post(`/fsma/water-assessments/${id}/duplicate/`, data),
  getWaterAssessmentSummary: () => api.get('/fsma/water-assessments/summary/'),

  // -------------------------------------------------------------------------
  // Source Assessments (Water Assessment sub-resource)
  // -------------------------------------------------------------------------
  getSourceAssessments: (params = {}) => api.get('/fsma/source-assessments/', { params }),
  getSourceAssessment: (id) => api.get(`/fsma/source-assessments/${id}/`),
  createSourceAssessment: (data) => api.post('/fsma/source-assessments/', data),
  updateSourceAssessment: (id, data) => api.put(`/fsma/source-assessments/${id}/`, data),
  deleteSourceAssessment: (id) => api.delete(`/fsma/source-assessments/${id}/`),

  // -------------------------------------------------------------------------
  // Field Assessments (Water Assessment sub-resource)
  // -------------------------------------------------------------------------
  getFieldAssessments: (params = {}) => api.get('/fsma/field-assessments/', { params }),
  getFieldAssessment: (id) => api.get(`/fsma/field-assessments/${id}/`),
  createFieldAssessment: (data) => api.post('/fsma/field-assessments/', data),
  updateFieldAssessment: (id, data) => api.put(`/fsma/field-assessments/${id}/`, data),
  deleteFieldAssessment: (id) => api.delete(`/fsma/field-assessments/${id}/`),

  // -------------------------------------------------------------------------
  // Environmental Assessments (Water Assessment sub-resource)
  // -------------------------------------------------------------------------
  getEnvironmentalAssessments: (params = {}) =>
    api.get('/fsma/environmental-assessments/', { params }),
  getEnvironmentalAssessment: (id) => api.get(`/fsma/environmental-assessments/${id}/`),
  createEnvironmentalAssessment: (data) =>
    api.post('/fsma/environmental-assessments/', data),
  updateEnvironmentalAssessment: (id, data) =>
    api.put(`/fsma/environmental-assessments/${id}/`, data),
  deleteEnvironmentalAssessment: (id) =>
    api.delete(`/fsma/environmental-assessments/${id}/`),

  // -------------------------------------------------------------------------
  // Mitigation Actions (Water Assessment sub-resource)
  // -------------------------------------------------------------------------
  getMitigationActions: (params = {}) => api.get('/fsma/mitigation-actions/', { params }),
  getMitigationAction: (id) => api.get(`/fsma/mitigation-actions/${id}/`),
  createMitigationAction: (data) => api.post('/fsma/mitigation-actions/', data),
  updateMitigationAction: (id, data) => api.put(`/fsma/mitigation-actions/${id}/`, data),
  deleteMitigationAction: (id) => api.delete(`/fsma/mitigation-actions/${id}/`),
  completeMitigationAction: (id, data) =>
    api.post(`/fsma/mitigation-actions/${id}/complete/`, data),
  verifyMitigationAction: (id, data) =>
    api.post(`/fsma/mitigation-actions/${id}/verify/`, data),

  // -------------------------------------------------------------------------
  // Related data helpers (reuse existing APIs)
  // -------------------------------------------------------------------------
  getFarms: () => api.get('/farms/'),
  getFields: () => api.get('/fields/'),
};
