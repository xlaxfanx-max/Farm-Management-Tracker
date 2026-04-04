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

// =============================================================================
// IRRIGATION SCHEDULING API
// =============================================================================

export const irrigationZonesAPI = {
  ...createCRUDAPI('irrigation-zones'),
  getStatus: (id) => api.get(`/irrigation-zones/${id}/status/`),
  calculate: (id, data = {}) => api.post(`/irrigation-zones/${id}/calculate/`, data),
  getEvents: (id) => api.get(`/irrigation-zones/${id}/events/`),
  recordEvent: (id, data) => api.post(`/irrigation-zones/${id}/events/`, data),
  getRecommendations: (id) => api.get(`/irrigation-zones/${id}/recommendations/`),
  getWeather: (id, days = 7) => api.get(`/irrigation-zones/${id}/weather/`, { params: { days } }),
  byField: (fieldId) => api.get('/irrigation-zones/', { params: { field: fieldId } }),
  byFarm: (farmId) => api.get('/irrigation-zones/', { params: { farm: farmId } }),
};

export const irrigationRecommendationsAPI = {
  // Standard CRUD
  getAll: (params = {}) => api.get('/irrigation-recommendations/', { params }),
  get: (id) => api.get(`/irrigation-recommendations/${id}/`),

  // Actions
  apply: (id, data = {}) => api.post(`/irrigation-recommendations/${id}/apply/`, data),
  skip: (id) => api.post(`/irrigation-recommendations/${id}/skip/`),

  // Filtered lists
  pending: () => api.get('/irrigation-recommendations/', { params: { status: 'pending' } }),
  byZone: (zoneId) => api.get('/irrigation-recommendations/', { params: { zone: zoneId } }),
};

export const kcProfilesAPI = {
  ...createCRUDAPI('kc-profiles'),
  defaults: () => api.get('/kc-profiles/', { params: { zone__isnull: true } }),
};

export const soilMoistureReadingsAPI = {
  ...createCRUDAPI('soil-moisture-readings'),
  byZone: (zoneId) => api.get('/soil-moisture-readings/', { params: { zone: zoneId } }),
};

export const irrigationEventsAPI = {
  ...createCRUDAPI('irrigation-events'),
  byField: (params = {}) => api.get('/irrigation-events/by_field/', { params }),
  byWell: (params = {}) => api.get('/irrigation-events/by_well/', { params }),
};

export const irrigationDashboardAPI = {
  // Get full dashboard data
  get: () => api.get('/irrigation/dashboard/'),

  // Get CIMIS station list (for zone setup)
  getCIMISStations: (lat, lng, limit = 5) =>
    api.get('/irrigation/cimis-stations/', { params: { lat, lng, limit } }),
};

// Constants for Irrigation Scheduling dropdowns
export const IRRIGATION_CONSTANTS = {
  IRRIGATION_METHODS: [
    { value: 'drip', label: 'Drip' },
    { value: 'micro_sprinkler', label: 'Micro-Sprinkler' },
    { value: 'flood', label: 'Flood' },
    { value: 'furrow', label: 'Furrow' },
    { value: 'sprinkler', label: 'Sprinkler' },
  ],

  SOIL_TYPES: [
    { value: 'sandy', label: 'Sandy' },
    { value: 'sandy_loam', label: 'Sandy Loam' },
    { value: 'loam', label: 'Loam' },
    { value: 'clay_loam', label: 'Clay Loam' },
    { value: 'clay', label: 'Clay' },
  ],

  // Typical water holding capacities by soil type (inches per foot)
  SOIL_WHC: {
    sandy: 0.75,
    sandy_loam: 1.25,
    loam: 1.75,
    clay_loam: 2.0,
    clay: 2.25,
  },

  CROP_TYPES: [
    { value: 'citrus', label: 'Citrus' },
    { value: 'avocado', label: 'Avocado' },
    { value: 'grapes', label: 'Grapes' },
    { value: 'almonds', label: 'Almonds' },
    { value: 'walnuts', label: 'Walnuts' },
    { value: 'pistachios', label: 'Pistachios' },
    { value: 'olives', label: 'Olives' },
    { value: 'stone_fruit', label: 'Stone Fruit' },
    { value: 'vegetables', label: 'Vegetables' },
    { value: 'other', label: 'Other' },
  ],

  CIMIS_TARGET_TYPES: [
    { value: 'station', label: 'CIMIS Station' },
    { value: 'spatial', label: 'Spatial CIMIS (Zip Code)' },
  ],

  RECOMMENDATION_STATUSES: [
    { value: 'pending', label: 'Pending' },
    { value: 'applied', label: 'Applied' },
    { value: 'skipped', label: 'Skipped' },
    { value: 'expired', label: 'Expired' },
  ],

  EVENT_METHODS: [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'manual', label: 'Manual' },
    { value: 'rainfall', label: 'Rainfall' },
  ],

  // Default MAD values by crop type
  DEFAULT_MAD: {
    citrus: 50,
    avocado: 40,
    grapes: 45,
    almonds: 55,
    walnuts: 50,
    pistachios: 60,
    olives: 65,
    stone_fruit: 50,
    vegetables: 40,
    other: 50,
  },

  // Default root depths by crop type (inches)
  DEFAULT_ROOT_DEPTH: {
    citrus: 36,
    avocado: 24,
    grapes: 36,
    almonds: 48,
    walnuts: 60,
    pistachios: 48,
    olives: 48,
    stone_fruit: 36,
    vegetables: 18,
    other: 36,
  },
};
