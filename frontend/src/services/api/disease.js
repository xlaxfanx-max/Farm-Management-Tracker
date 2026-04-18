// =============================================================================
// DISEASE PREVENTION APIs
// =============================================================================

import api, { createCRUDAPI } from './index';

/**
 * External Detections - Official disease detections from CDFA, USDA, etc.
 */
export const externalDetectionsAPI = {
  ...createCRUDAPI('disease/external-detections'),
  sync: () => api.post('/disease/external-detections/sync/'),
  nearPoint: (lat, lng, radiusMiles = 15) =>
    api.get('/disease/external-detections/near_point/', {
      params: { latitude: lat, longitude: lng, radius_miles: radiusMiles },
    }),
};

/**
 * Disease Alerts - User-facing disease notifications
 */
export const diseaseAlertsAPI = {
  /** Get all alerts with optional filters */
  getAll: (params = {}) => api.get('/disease/alerts/', { params }),

  /** Get active alerts only */
  active: () => api.get('/disease/alerts/active/'),

  /** Get a specific alert */
  get: (id) => api.get(`/disease/alerts/${id}/`),

  /** Acknowledge an alert */
  acknowledge: (id) => api.post(`/disease/alerts/${id}/acknowledge/`),

  /** Dismiss an alert */
  dismiss: (id) => api.post(`/disease/alerts/${id}/dismiss/`),

  /** Get alert summary counts */
  summary: () => api.get('/disease/alerts/summary/'),

  /** Get alerts for a specific farm */
  byFarm: (farmId) => api.get('/disease/alerts/', { params: { farm: farmId } }),
};

/**
 * Disease Alert Rules - Configurable alert triggers
 */
export const diseaseAlertRulesAPI = {
  ...createCRUDAPI('disease/alert-rules'),
  toggle: (id, isActive) => api.patch(`/disease/alert-rules/${id}/`, { is_active: isActive }),
};

/**
 * Disease Analysis Runs - Field health analysis
 */
export const diseaseAnalysesAPI = {
  /** Get all analysis runs */
  getAll: (params = {}) => api.get('/disease/analyses/', { params }),

  /** Get a specific analysis run */
  get: (id) => api.get(`/disease/analyses/${id}/`),

  /** Get trees with health data for an analysis */
  getTrees: (id, params = {}) => api.get(`/disease/analyses/${id}/trees/`, { params }),

  /** Trigger analysis for a field */
  analyzeField: (fieldId, params = {}) =>
    api.post(`/disease/analyses/analyze_field/`, { field_id: fieldId, ...params }),
};

/**
 * Scouting Reports - Crowdsourced disease observations
 */
export const scoutingReportsAPI = {
  ...createCRUDAPI('disease/scouting'),
  verify: (id, data) => api.post(`/disease/scouting/${id}/verify/`, data),
  addPhoto: (id, formData) =>
    api.post(`/disease/scouting/${id}/photos/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  byField: (fieldId) => api.get('/disease/scouting/', { params: { field: fieldId } }),
};

/**
 * Disease Dashboard - Unified disease prevention overview
 */
export const diseaseDashboardAPI = {
  /** Get dashboard data */
  get: () => api.get('/disease/dashboard/'),

  /** Get proximity risks for company */
  getProximityRisks: () => api.get('/disease/dashboard/proximity_risks/'),

  /** Get company risk score */
  getRiskScore: () => api.get('/disease/dashboard/risk_score/'),

  /** Get regional threat map data */
  getRegionalData: (params = {}) => api.get('/disease/dashboard/regional/', { params }),

  /** Get threat map data (farms, detections, quarantine zones) */
  getMapData: () => api.get('/disease/dashboard/map_data/'),

  /** HLB risk per field (all fields by default, or ?field_id=X for one) */
  getHLBRisk: (params = {}) => api.get('/disease/dashboard/hlb-risk/', { params }),
};

/**
 * Combined Disease API - alias for backward compatibility and convenience
 */
export const diseaseAPI = {
  ...diseaseDashboardAPI,
  getMapData: () => api.get('/disease/dashboard/map_data/'),
};

/**
 * Field Health API - Field-specific health endpoints
 */
export const fieldHealthAPI = {
  /** Get health summary for a field */
  getSummary: (fieldId) => api.get(`/fields/${fieldId}/health/`),

  /** Get health history for a field */
  getHistory: (fieldId, params = {}) =>
    api.get(`/fields/${fieldId}/health/history/`, { params }),

  /** Trigger health analysis for a field */
  analyze: (fieldId) => api.post(`/fields/${fieldId}/health/analyze/`),

  /** Get trees with health data for a field */
  getTrees: (fieldId, params = {}) =>
    api.get(`/fields/${fieldId}/health/trees/`, { params }),
};

// Constants for Disease Prevention
export const DISEASE_CONSTANTS = {
  DISEASE_TYPES: [
    { value: 'hlb', label: 'Huanglongbing (Citrus Greening)', color: '#dc2626' },
    { value: 'acp', label: 'Asian Citrus Psyllid', color: '#f97316' },
    { value: 'ctvd', label: 'Citrus Tristeza Virus', color: '#eab308' },
    { value: 'cyvcv', label: 'Citrus Yellow Vein Clearing Virus', color: '#84cc16' },
    { value: 'canker', label: 'Citrus Canker', color: '#ef4444' },
    { value: 'phytophthora', label: 'Phytophthora Root Rot', color: '#8b5cf6' },
    { value: 'laurel_wilt', label: 'Laurel Wilt', color: '#6366f1' },
    { value: 'other', label: 'Other', color: '#6b7280' },
  ],

  HEALTH_STATUSES: [
    { value: 'healthy', label: 'Healthy', color: '#22c55e' },
    { value: 'mild_stress', label: 'Mild Stress', color: '#84cc16' },
    { value: 'moderate_stress', label: 'Moderate Stress', color: '#eab308' },
    { value: 'severe_stress', label: 'Severe Stress', color: '#f97316' },
  ],

  RISK_LEVELS: [
    { value: 'low', label: 'Low', color: '#22c55e' },
    { value: 'moderate', label: 'Moderate', color: '#eab308' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'critical', label: 'Critical', color: '#dc2626' },
  ],

  ALERT_TYPES: [
    { value: 'proximity_hlb', label: 'HLB Detected Nearby', icon: '🔴' },
    { value: 'proximity_acp', label: 'ACP Activity Nearby', icon: '🟠' },
    { value: 'proximity_other', label: 'Other Disease Nearby', icon: '🟡' },
    { value: 'ndvi_anomaly', label: 'NDVI Anomaly Detected', icon: '📉' },
    { value: 'tree_decline', label: 'Tree Decline Detected', icon: '🌳' },
    { value: 'canopy_loss', label: 'Canopy Loss Detected', icon: '🍂' },
    { value: 'regional_trend', label: 'Regional Health Trend', icon: '📊' },
    { value: 'scouting_verified', label: 'Verified Scouting Report', icon: '✅' },
  ],

  ALERT_PRIORITIES: [
    { value: 'critical', label: 'Critical', color: '#dc2626' },
    { value: 'high', label: 'High', color: '#f97316' },
    { value: 'medium', label: 'Medium', color: '#eab308' },
    { value: 'low', label: 'Low', color: '#3b82f6' },
  ],

  SCOUTING_REPORT_TYPES: [
    { value: 'disease_symptom', label: 'Disease Symptom' },
    { value: 'pest_sighting', label: 'Pest Sighting' },
    { value: 'tree_decline', label: 'Tree Decline' },
    { value: 'tree_death', label: 'Tree Death' },
    { value: 'acp_sighting', label: 'Asian Citrus Psyllid' },
    { value: 'other', label: 'Other' },
  ],

  SCOUTING_SEVERITIES: [
    { value: 'low', label: 'Low - Minor/Isolated', color: '#22c55e' },
    { value: 'medium', label: 'Medium - Several Trees', color: '#eab308' },
    { value: 'high', label: 'High - Significant Area', color: '#ef4444' },
  ],

  SCOUTING_STATUSES: [
    { value: 'submitted', label: 'Submitted', color: '#6b7280' },
    { value: 'under_review', label: 'Under Review', color: '#3b82f6' },
    { value: 'verified', label: 'Verified', color: '#22c55e' },
    { value: 'false_alarm', label: 'False Alarm', color: '#ef4444' },
    { value: 'inconclusive', label: 'Inconclusive', color: '#f59e0b' },
  ],

  // HLB Symptom Checklist
  SYMPTOM_CHECKLIST: [
    { key: 'yellowing_asymmetric', label: 'Yellowing of leaves (asymmetric/blotchy)' },
    { key: 'green_islands', label: 'Green islands on yellow leaves' },
    { key: 'fruit_lopsided', label: 'Lopsided or misshapen fruit' },
    { key: 'fruit_drop', label: 'Premature fruit drop' },
    { key: 'twig_dieback', label: 'Twig dieback' },
    { key: 'overall_decline', label: 'Tree in overall decline' },
    { key: 'acp_adult', label: 'Spotted Asian citrus psyllid (adult)' },
    { key: 'acp_nymph', label: 'Waxy psyllid nymphs on new growth' },
  ],

  DETECTION_SOURCES: [
    { value: 'cdfa', label: 'California Dept of Food & Agriculture' },
    { value: 'usda', label: 'USDA APHIS' },
    { value: 'county_ag', label: 'County Agricultural Commissioner' },
    { value: 'uc_anr', label: 'UC Agriculture & Natural Resources' },
    { value: 'manual', label: 'Manual Entry' },
  ],

  LOCATION_TYPES: [
    { value: 'residential', label: 'Residential/Backyard' },
    { value: 'commercial', label: 'Commercial Grove' },
    { value: 'nursery', label: 'Nursery' },
    { value: 'unknown', label: 'Unknown' },
  ],

  RULE_TYPES: [
    { value: 'proximity', label: 'Proximity Alert' },
    { value: 'ndvi_threshold', label: 'NDVI Threshold' },
    { value: 'ndvi_change', label: 'NDVI Change Rate' },
    { value: 'canopy_loss', label: 'Canopy Loss' },
    { value: 'tree_count_change', label: 'Tree Count Change' },
    { value: 'regional_trend', label: 'Regional Trend' },
  ],
};
