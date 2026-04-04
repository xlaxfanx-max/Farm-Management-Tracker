// =============================================================================
// REMAINING APIs: Weather, Analytics, Season, Tree Detection, Yield Forecast
// =============================================================================

import api from './index';

// =============================================================================
// WEATHER API
// =============================================================================

export const weatherAPI = {
  /**
   * Get current weather for a farm
   * @param {number} farmId - Farm ID
   * @returns Current weather with spray conditions assessment
   */
  getCurrentWeather: (farmId) => api.get(`/weather/current/${farmId}/`),

  /**
   * Get 7-day weather forecast for a farm
   * @param {number} farmId - Farm ID
   * @returns Daily forecast with spray ratings
   */
  getForecast: (farmId) => api.get(`/weather/forecast/${farmId}/`),

  /**
   * Get detailed spray conditions assessment
   * @param {number} farmId - Farm ID
   * @returns Spray conditions with factor breakdown
   */
  getSprayConditions: (farmId) => api.get(`/weather/spray-conditions/${farmId}/`),

  /**
   * Get spray condition thresholds
   * @returns Threshold values and descriptions
   */
  getThresholds: () => api.get('/weather/thresholds/'),

  /**
   * Get weather summary for all farms
   * @returns Weather overview for all company farms
   */
  getAllFarmsWeather: () => api.get('/weather/farms/'),
};

// =============================================================================
// ANALYTICS API
// =============================================================================

export const analyticsAPI = {
  /**
   * Get full analytics dashboard data
   * @param {Object} params - Query parameters (year, start_date, end_date, farm_id)
   * @returns Comprehensive analytics data
   */
  getDashboard: (params = {}) => api.get('/analytics/dashboard/', { params }),

  /**
   * Get quick analytics summary for widget
   * @returns Key metrics summary
   */
  getSummary: () => api.get('/analytics/summary/'),

  /**
   * Get season-specific dashboard data for SeasonProgressCard
   * @param {Object} params - Query parameters (season, crop_category, farm_id)
   * @returns Season progress data with current/last season comparison
   */
  getSeasonDashboard: (params = {}) => api.get('/analytics/season-dashboard/', { params }),

  /**
   * Get season data for all crop categories the user farms
   * @param {Object} params - Query parameters (farm_id)
   * @returns Array of season data grouped by crop category
   */
  getMultiCropSeasons: (params = {}) => api.get('/analytics/multi-crop-seasons/', { params }),
};

// =============================================================================
// SEASON MANAGEMENT API
// =============================================================================

export const seasonAPI = {
  /**
   * Get season information for current context.
   * @param {Object} params - Query parameters
   * @param {number} params.field_id - Optional field for context
   * @param {string} params.crop_category - Optional crop category
   * @param {string} params.date - Optional target date (YYYY-MM-DD)
   * @returns {Promise} - { current_season, available_seasons }
   */
  getSeasonInfo: (params = {}) => api.get('/seasons/info/', { params }),

  /**
   * Get date range for a specific season label.
   * @param {Object} params - Query parameters
   * @param {string} params.season - Season label (required)
   * @param {number} params.field_id - Optional field for context
   * @param {string} params.crop_category - Optional crop category
   * @returns {Promise} - { season, start_date, end_date }
   */
  getSeasonDateRange: (params = {}) => api.get('/seasons/date-range/', { params }),

  /**
   * Get the current season, optionally for a specific field or crop category.
   * Fetches from API for accurate season calculation.
   */
  getCurrentSeason: async (fieldId = null, cropCategory = null) => {
    const params = {};
    if (fieldId) params.field_id = fieldId;
    if (cropCategory) params.crop_category = cropCategory;
    const response = await api.get('/seasons/info/', { params });
    return response.data.current_season;
  },

  // Season Template CRUD
  getSeasonTemplates: (params = {}) => api.get('/season-templates/', { params }),
  getSeasonTemplate: (id) => api.get(`/season-templates/${id}/`),
  createSeasonTemplate: (data) => api.post('/season-templates/', data),
  updateSeasonTemplate: (id, data) => api.put(`/season-templates/${id}/`, data),
  deleteSeasonTemplate: (id) => api.delete(`/season-templates/${id}/`),
  getTemplateForCategory: (category) =>
    api.get('/season-templates/for_category/', { params: { category } }),
  getSystemDefaults: () => api.get('/season-templates/system_defaults/'),

  // Growing Cycle CRUD
  getGrowingCycles: (params = {}) => api.get('/growing-cycles/', { params }),
  getGrowingCycle: (id) => api.get(`/growing-cycles/${id}/`),
  createGrowingCycle: (data) => api.post('/growing-cycles/', data),
  updateGrowingCycle: (id, data) => api.put(`/growing-cycles/${id}/`, data),
  deleteGrowingCycle: (id) => api.delete(`/growing-cycles/${id}/`),
  getActiveCycles: () => api.get('/growing-cycles/active/'),
  getCyclesForField: (fieldId, year = null) => {
    const params = { field_id: fieldId };
    if (year) params.year = year;
    return api.get('/growing-cycles/for_field/', { params });
  },
  completeCycle: (id) => api.post(`/growing-cycles/${id}/complete/`),
  startCycle: (id) => api.post(`/growing-cycles/${id}/start/`),
};

// =============================================================================
// TREE DETECTION API
// =============================================================================

export const treeSurveyAPI = {
  getAll: (params = {}) => api.get('/tree-surveys/', { params }),
  get: (id) => api.get(`/tree-surveys/${id}/`),
  upload: (formData) => api.post('/tree-surveys/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/tree-surveys/${id}/`),
  detect: (id) => api.post(`/tree-surveys/${id}/detect/`),
  getTrees: (id, params = {}) => api.get(`/tree-surveys/${id}/trees/`, { params }),
  getTreesGeoJSON: (id) => api.get(`/tree-surveys/${id}/trees/geojson/`),
  getHealthSummary: (id) => api.get(`/tree-surveys/${id}/health-summary/`),
};

export const TREE_HEALTH_COLORS = {
  healthy: '#22c55e',
  moderate: '#eab308',
  stressed: '#f97316',
  critical: '#ef4444',
  unknown: '#9ca3af',
};

// =============================================================================
// YIELD FORECAST MODULE
// =============================================================================

export const yieldForecastAPI = {
  // Forecasts CRUD
  getAll: (params = {}) => api.get('/yield-forecast/forecasts/', { params }),
  get: (id) => api.get(`/yield-forecast/forecasts/${id}/`),
  create: (data) => api.post('/yield-forecast/forecasts/', data),
  update: (id, data) => api.put(`/yield-forecast/forecasts/${id}/`, data),
  patch: (id, data) => api.patch(`/yield-forecast/forecasts/${id}/`, data),
  delete: (id) => api.delete(`/yield-forecast/forecasts/${id}/`),

  // Actions
  generate: (data) => api.post('/yield-forecast/forecasts/generate/', data),
  backfillActuals: (data) => api.post('/yield-forecast/forecasts/backfill_actuals/', data),

  // Analytics
  getDashboard: (params = {}) => api.get('/yield-forecast/dashboard/', { params }),
  getFieldDetail: (fieldId, params = {}) => api.get(`/yield-forecast/fields/${fieldId}/detail/`, { params }),
  getSeasonComparison: (params = {}) => api.get('/yield-forecast/season-comparison/', { params }),

  // Feature snapshots (read-only)
  getFeatureSnapshots: (params = {}) => api.get('/yield-forecast/feature-snapshots/', { params }),
  getFeatureSnapshot: (id) => api.get(`/yield-forecast/feature-snapshots/${id}/`),

  // Soil survey (read-only)
  getSoilSurvey: (params = {}) => api.get('/yield-forecast/soil-survey/', { params }),

  // External data sources
  getExternalSources: (params = {}) => api.get('/yield-forecast/external-sources/', { params }),
  createExternalSource: (data) => api.post('/yield-forecast/external-sources/', data),
};
