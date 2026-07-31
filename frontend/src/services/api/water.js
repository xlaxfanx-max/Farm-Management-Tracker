// =============================================================================
// WATER SOURCES, WATER TESTS, WELLS, SGMA, IRRIGATION APIs
// =============================================================================

import api, { createCRUDAPI } from './index';

// =============================================================================
// WATER SOURCES API
// =============================================================================

export const waterSourcesAPI = {
  ...createCRUDAPI('water-sources'),
  getTests: (id) => api.get(`/water-sources/${id}/tests/`),
  getOverdue: () => api.get('/water-sources/overdue/'),
};

// =============================================================================
// WATER TESTS API
// =============================================================================

export const waterTestsAPI = {
  ...createCRUDAPI('water-tests'),
  getFailed: () => api.get('/water-tests/failed/'),
  getBySource: (sourceId) => api.get(`/water-tests/?water_source=${sourceId}`),
};

// =============================================================================
// WELLS & SGMA API
// =============================================================================

// Wells are now part of the unified WaterSource model with source_type='well'
export const wellsAPI = {
  // Wells CRUD - uses water-sources with source_type filter
  getAll: (params = {}) => api.get('/water-sources/', { params: { ...params, source_type: 'well' } }),
  get: (id) => api.get(`/water-sources/${id}/`),
  create: (data) => api.post('/water-sources/', { ...data, source_type: 'well' }),
  update: (id, data) => api.put(`/water-sources/${id}/`, data),
  delete: (id) => api.delete(`/water-sources/${id}/`),

  // Well-specific endpoints - now query by water_source
  getReadings: (id, params = {}) => api.get('/well-readings/', { params: { ...params, water_source: id } }),
  getCalibrations: (id) => api.get('/meter-calibrations/', { params: { water_source: id } }),
  getAllocations: (id, params = {}) => api.get('/water-allocations/', { params: { ...params, water_source: id } }),
  getExtractionSummary: (id, params = {}) => api.get(`/water-sources/${id}/extraction_summary/`, { params }),

  // Filtered lists
  byGSA: (gsa) => api.get('/water-sources/', { params: { source_type: 'well', gsa } }),
  calibrationDue: (days = 30) => api.get('/water-sources/', { params: { source_type: 'well', calibration_due: days } }),
};

export const wellReadingsAPI = {
  ...createCRUDAPI('well-readings'),
  byPeriod: (params = {}) => api.get('/well-readings/by_period/', { params }),
};

export const meterCalibrationsAPI = {
  ...createCRUDAPI('meter-calibrations'),
  expiring: (days = 90) => api.get('/meter-calibrations/expiring/', { params: { days } }),
};

export const waterAllocationsAPI = {
  ...createCRUDAPI('water-allocations'),
  summary: (params = {}) => api.get('/water-allocations/summary/', { params }),
};

export const extractionReportsAPI = {
  ...createCRUDAPI('extraction-reports'),
  generate: (data) => api.post('/extraction-reports/generate/', data),
  submit: (id) => api.post(`/extraction-reports/${id}/submit/`),
  confirm: (id, data) => api.post(`/extraction-reports/${id}/confirm/`, data),
};

export const sgmaAPI = {
  dashboard: () => api.get('/sgma/dashboard/'),
};

export const irrigationEventsAPI = {
  ...createCRUDAPI('irrigation-events'),
  byField: (params = {}) => api.get('/irrigation-events/by_field/', { params }),
  byWell: (params = {}) => api.get('/irrigation-events/by_well/', { params }),
};
