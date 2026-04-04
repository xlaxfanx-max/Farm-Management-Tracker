// =============================================================================
// COMPLIANCE MANAGEMENT APIs
// =============================================================================

import api, { createCRUDAPI } from './index';

/**
 * Compliance Profile - Company-level compliance configuration
 */
export const complianceProfileAPI = {
  /** Get compliance profile for current company */
  get: () => api.get('/compliance/profile/'),

  /** Update compliance profile */
  update: (data) => api.put('/compliance/profile/', data),

  /** Generate recurring deadlines from profile */
  generateDeadlines: () => api.post('/compliance/profile/generate_deadlines/'),
};

/**
 * Compliance Deadlines - Track regulatory deadlines
 */
export const complianceDeadlinesAPI = {
  ...createCRUDAPI('compliance/deadlines'),
  complete: (id, data = {}) => api.post(`/compliance/deadlines/${id}/complete/`, data),
  skip: (id, reason = '') => api.post(`/compliance/deadlines/${id}/skip/`, { reason }),
  upcoming: (days = 30) => api.get('/compliance/deadlines/upcoming/', { params: { days } }),
  overdue: () => api.get('/compliance/deadlines/overdue/'),
};

/**
 * Compliance Alerts - System-generated compliance alerts
 */
export const complianceAlertsAPI = {
  /** Get all active alerts */
  getAll: (params = {}) => api.get('/compliance/alerts/', { params }),

  /** Get a specific alert */
  get: (id) => api.get(`/compliance/alerts/${id}/`),

  /** Acknowledge an alert */
  acknowledge: (id) => api.post(`/compliance/alerts/${id}/acknowledge/`),

  /** Dismiss an alert */
  dismiss: (id) => api.post(`/compliance/alerts/${id}/dismiss/`),

  /** Get alert summary counts */
  summary: () => api.get('/compliance/alerts/summary/'),
};

/**
 * Licenses - Track applicator licenses, certifications, etc.
 */
export const licensesAPI = {
  ...createCRUDAPI('compliance/licenses'),
  expiring: (days = 90) => api.get('/compliance/licenses/expiring/', { params: { days } }),
  startRenewal: (id) => api.post(`/compliance/licenses/${id}/start_renewal/`),
};

/**
 * WPS Training Records - Worker Protection Standard training tracking
 */
export const wpsTrainingAPI = {
  ...createCRUDAPI('compliance/wps-training'),
  expiring: (days = 90) => api.get('/compliance/wps-training/expiring/', { params: { days } }),
  byWorker: (workerId) => api.get('/compliance/wps-training/by_worker/', { params: { worker_id: workerId } }),
  dashboard: () => api.get('/compliance/wps-training/dashboard/'),
};

/**
 * Central Posting Locations - WPS poster/SDS display locations
 */
export const postingLocationsAPI = {
  ...createCRUDAPI('compliance/posting-locations'),
  verify: (id, data = {}) => api.post(`/compliance/posting-locations/${id}/verify/`, data),
};

/**
 * REI Posting Records - Restricted Entry Interval tracking
 */
export const reiPostingsAPI = {
  /** Get all REI postings */
  getAll: (params = {}) => api.get('/compliance/rei-postings/', { params }),

  /** Get active REI postings */
  active: () => api.get('/compliance/rei-postings/active/'),

  /** Mark posting as displayed */
  markPosted: (id, data = {}) => api.post(`/compliance/rei-postings/${id}/mark_posted/`, data),

  /** Mark posting as removed */
  markRemoved: (id, data = {}) => api.post(`/compliance/rei-postings/${id}/mark_removed/`, data),
};

/**
 * Compliance Reports - Generated regulatory reports (PUR, SGMA, etc.)
 */
export const complianceReportsAPI = {
  ...createCRUDAPI('compliance/reports'),
  generate: (data) => api.post('/compliance/reports/generate/', data),
  validate: (id) => api.post(`/compliance/reports/${id}/validate/`),
  submit: (id, data = {}) => api.post(`/compliance/reports/${id}/submit/`, data),
  generatePUR: (periodStart, periodEnd) =>
    api.post('/compliance/reports/generate-pur/', { period_start: periodStart, period_end: periodEnd }),
};

/**
 * Incident Reports - Safety incidents, spills, exposures
 */
export const incidentReportsAPI = {
  ...createCRUDAPI('compliance/incidents'),
  startInvestigation: (id) => api.post(`/compliance/incidents/${id}/start_investigation/`),
  resolve: (id, data) => api.post(`/compliance/incidents/${id}/resolve/`, data),
};

/**
 * Notification Preferences - User notification settings
 */
export const notificationPreferencesAPI = {
  /** Get current user's notification preferences */
  get: () => api.get('/compliance/notification-preferences/'),

  /** Update notification preferences */
  update: (data) => api.put('/compliance/notification-preferences/', data),
};

/**
 * Compliance Dashboard - Unified compliance overview
 */
export const complianceDashboardAPI = {
  /** Get dashboard data */
  get: () => api.get('/compliance/dashboard/'),

  /** Get additive compliance score with breakdown */
  getSmartScore: () => api.get('/compliance/dashboard/smart-score/'),

  /** Get today's priority compliance actions */
  getToday: () => api.get('/compliance/dashboard/today/'),

  /** Get proactive smart suggestions */
  getSuggestions: () => api.get('/compliance/dashboard/suggestions/'),

  /** Get calendar data */
  calendar: (params = {}) => api.get('/compliance/dashboard/calendar/', { params }),
};

/**
 * Inspector Report - One-click consolidated compliance report
 */
export const inspectorReportAPI = {
  /** Get full inspector report as JSON */
  get: (params = {}) => api.get('/compliance/inspector-report/', { params }),

  /** Download as PDF */
  downloadPDF: (params = {}) => api.get('/compliance/inspector-report/pdf/', {
    params,
    responseType: 'blob',
  }),

  /** Get inspector readiness checklist */
  getChecklist: () => api.get('/compliance/inspector-report/checklist/'),
};

/**
 * NOI Submissions - Notice of Intent for restricted materials
 */
export const noiSubmissionAPI = {
  ...createCRUDAPI('compliance/noi-submissions'),
  submit: (id, data = {}) => api.post(`/compliance/noi-submissions/${id}/submit/`, data),
  confirm: (id, data) => api.post(`/compliance/noi-submissions/${id}/confirm/`, data),
  pending: () => api.get('/compliance/noi-submissions/pending/'),
  overdue: () => api.get('/compliance/noi-submissions/overdue/'),
};

/**
 * Water GM/STV - FSMA water quality calculations
 */
export const waterGMSTVAPI = {
  /** Get GM/STV for all water sources */
  getAll: (params = {}) => api.get('/compliance/water-gm-stv/', { params }),

  /** Get detailed trend for a specific source */
  getBySource: (sourceId) => api.get(`/compliance/water-gm-stv/source/${sourceId}/`),
};

/**
 * SGMA Report Export
 */
export const sgmaExportAPI = {
  /** Get SGMA report data as JSON */
  get: (params = {}) => api.get('/compliance/sgma-export/', { params }),

  /** Download as Excel */
  downloadExcel: (params = {}) => api.get('/compliance/sgma-export/export_excel/', {
    params,
    responseType: 'blob',
  }),
};

// Constants for Compliance Management
export const COMPLIANCE_CONSTANTS = {
  DEADLINE_CATEGORIES: [
    { value: 'reporting', label: 'Reporting' },
    { value: 'training', label: 'Training' },
    { value: 'testing', label: 'Testing' },
    { value: 'renewal', label: 'Renewal' },
    { value: 'inspection', label: 'Inspection' },
    { value: 'other', label: 'Other' },
  ],

  DEADLINE_FREQUENCIES: [
    { value: 'once', label: 'One-time' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'semi_annual', label: 'Semi-Annual' },
    { value: 'annual', label: 'Annual' },
  ],

  DEADLINE_STATUSES: [
    { value: 'upcoming', label: 'Upcoming', color: '#6b7280' },
    { value: 'due_soon', label: 'Due Soon', color: '#f59e0b' },
    { value: 'overdue', label: 'Overdue', color: '#ef4444' },
    { value: 'completed', label: 'Completed', color: '#22c55e' },
    { value: 'skipped', label: 'Skipped', color: '#9ca3af' },
  ],

  ALERT_PRIORITIES: [
    { value: 'critical', label: 'Critical', color: '#dc2626' },
    { value: 'high', label: 'High', color: '#f59e0b' },
    { value: 'medium', label: 'Medium', color: '#3b82f6' },
    { value: 'low', label: 'Low', color: '#6b7280' },
  ],

  LICENSE_TYPES: [
    { value: 'applicator_qal', label: 'Qualified Applicator License (QAL)' },
    { value: 'applicator_qac', label: 'Qualified Applicator Certificate (QAC)' },
    { value: 'pca', label: 'Pest Control Advisor (PCA)' },
    { value: 'pilot', label: 'Agricultural Aircraft Pilot' },
    { value: 'organic_handler', label: 'Organic Handler Certificate' },
    { value: 'food_safety', label: 'Food Safety Certification' },
    { value: 'wps_trainer', label: 'WPS Trainer Certification' },
    { value: 'other', label: 'Other' },
  ],

  LICENSE_STATUSES: [
    { value: 'active', label: 'Active', color: '#22c55e' },
    { value: 'expiring_soon', label: 'Expiring Soon', color: '#f59e0b' },
    { value: 'expired', label: 'Expired', color: '#ef4444' },
    { value: 'suspended', label: 'Suspended', color: '#dc2626' },
    { value: 'pending_renewal', label: 'Pending Renewal', color: '#3b82f6' },
  ],

  WPS_TRAINING_TYPES: [
    { value: 'pesticide_safety', label: 'Pesticide Safety Training (Worker)' },
    { value: 'handler', label: 'Handler Training' },
    { value: 'early_entry', label: 'Early Entry Training' },
    { value: 'respirator', label: 'Respirator Fit/Training' },
    { value: 'annual_refresher', label: 'Annual Refresher' },
  ],

  REPORT_TYPES: [
    { value: 'pur_monthly', label: 'PUR Monthly Report' },
    { value: 'sgma_semi_annual', label: 'SGMA Semi-Annual Report' },
    { value: 'ilrp_annual', label: 'ILRP Annual Report' },
    { value: 'wps_annual', label: 'WPS Annual Summary' },
    { value: 'organic_annual', label: 'Organic Certification Report' },
    { value: 'buyer_audit', label: 'Buyer Audit Report' },
  ],

  REPORT_STATUSES: [
    { value: 'draft', label: 'Draft', color: '#6b7280' },
    { value: 'pending_review', label: 'Pending Review', color: '#f59e0b' },
    { value: 'ready', label: 'Ready to Submit', color: '#3b82f6' },
    { value: 'submitted', label: 'Submitted', color: '#22c55e' },
    { value: 'accepted', label: 'Accepted', color: '#059669' },
    { value: 'rejected', label: 'Rejected', color: '#ef4444' },
  ],

  INCIDENT_TYPES: [
    { value: 'exposure', label: 'Pesticide Exposure' },
    { value: 'spill', label: 'Chemical Spill' },
    { value: 'equipment', label: 'Equipment Failure' },
    { value: 'injury', label: 'Work Injury' },
    { value: 'near_miss', label: 'Near Miss' },
    { value: 'environmental', label: 'Environmental Release' },
  ],

  INCIDENT_SEVERITIES: [
    { value: 'minor', label: 'Minor', color: '#6b7280' },
    { value: 'moderate', label: 'Moderate', color: '#f59e0b' },
    { value: 'serious', label: 'Serious', color: '#ef4444' },
    { value: 'critical', label: 'Critical', color: '#dc2626' },
  ],

  US_STATES: [
    { value: 'CA', label: 'California' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'TX', label: 'Texas' },
    { value: 'FL', label: 'Florida' },
    { value: 'WA', label: 'Washington' },
    { value: 'OR', label: 'Oregon' },
    { value: 'ID', label: 'Idaho' },
    { value: 'NV', label: 'Nevada' },
    // Add more states as needed
  ],
};
