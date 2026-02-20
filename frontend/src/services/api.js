// =============================================================================
// GROVE MASTER API SERVICE
// =============================================================================
// Updated with authentication support while preserving all existing functionality
// =============================================================================

import axios from 'axios';

// Use environment variable in production, fallback to localhost for development
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// =============================================================================
// AXIOS INSTANCE WITH AUTH INTERCEPTORS
// =============================================================================

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // Send HttpOnly cookies with every request
  timeout: 30000,  // 30 second timeout to prevent hanging requests
});

// Token storage keys
const ACCESS_TOKEN_KEY = 'farm_tracker_access_token';
const REFRESH_TOKEN_KEY = 'farm_tracker_refresh_token';

// Request interceptor - add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Try refreshing - the backend reads the refresh token from HttpOnly cookie
      // or from the request body (localStorage fallback for migration)
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh/`,
          refreshToken ? { refresh: refreshToken } : {},
          { withCredentials: true }  // Send cookies for cookie-based refresh
        );

        const newAccessToken = response.data.access;
        const newRefreshToken = response.data.refresh;

        // Keep localStorage in sync during migration
        if (newAccessToken) {
          localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
        }
        if (newRefreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
        }

        // Retry original request (cookies set by backend, header set here as fallback)
        if (newAccessToken) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear tokens and redirect to login
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// =============================================================================
// AUTHENTICATION API (NEW)
// =============================================================================

export const authAPI = {
  // Register new user and company
  register: (data) =>
    axios.post(`${API_BASE_URL}/auth/register/`, data, { withCredentials: true }),

  // Login
  login: (email, password) =>
    axios.post(`${API_BASE_URL}/auth/login/`, { email, password }, { withCredentials: true }),

  // Logout
  logout: (refreshToken) =>
    api.post('/auth/logout/', { refresh: refreshToken }),

  // Refresh token
  refresh: (refreshToken) =>
    axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh: refreshToken }, { withCredentials: true }),

  // Get current user
  me: () => api.get('/auth/me/'),

  // Update profile
  updateProfile: (data) => api.put('/auth/profile/', data),

  // Change password
  changePassword: (currentPassword, newPassword) => 
    api.post('/auth/change-password/', {
      current_password: currentPassword,
      new_password: newPassword,
    }),

  // Switch company
  switchCompany: (companyId) => 
    api.post('/auth/switch-company/', { company_id: companyId }),

  // Invite user
  invite: (email, role, message = '') => 
    api.post('/auth/invite/', { email, role, message }),

  // Accept invitation
  acceptInvitation: (token, password, firstName, lastName) =>
    axios.post(`${API_BASE_URL}/auth/accept-invitation/`, {
      token,
      password,
      first_name: firstName,
      last_name: lastName,
    }, { withCredentials: true }),

  // Accept invitation for existing user (authenticated)
  acceptInvitationExisting: (token) =>
    api.post('/auth/accept-invitation-existing/', { token }),

  // Validate invitation token
  validateInvitation: (token) =>
    axios.get(`${API_BASE_URL}/auth/invitation/${token}/`),

  // Password reset - request reset email
  forgotPassword: (email) =>
    axios.post(`${API_BASE_URL}/auth/forgot-password/`, { email }),

  // Password reset - validate token
  validateResetToken: (token) =>
    axios.get(`${API_BASE_URL}/auth/reset-password/${token}/`),

  // Password reset - set new password
  resetPassword: (token, password) =>
    axios.post(`${API_BASE_URL}/auth/reset-password/`, { token, password }),
};

// =============================================================================
// COMPANY API (UPDATED - Now includes company settings endpoints)
// =============================================================================

export const companyAPI = {
  // Get company details (includes user's role in response)
  get: (id) => api.get(`/companies/${id}/`),

  // Update company settings (owner only)
  update: (id, data) => api.put(`/companies/${id}/update/`, data),

  // Get company statistics (farm count, user count, etc.)
  getStats: (id) => api.get(`/companies/${id}/stats/`),

  // List company members
  members: (companyId) => api.get(`/companies/${companyId}/members/`),

  // Update member role
  updateMember: (companyId, memberId, data) => 
    api.put(`/companies/${companyId}/members/${memberId}/`, data),

  // Remove member
  removeMember: (companyId, memberId) => 
    api.delete(`/companies/${companyId}/members/${memberId}/`),

  // Transfer ownership (owner only - transfers to another member)
  transferOwnership: (companyId, newOwnerId) =>
    api.post(`/companies/${companyId}/transfer-ownership/`, { new_owner_id: newOwnerId }),
};

// =============================================================================
// REFERENCE DATA API (NEW)
// =============================================================================

export const referenceAPI = {
  // Get California counties list
  getCaliforniaCounties: () => api.get('/reference/california-counties/'),
  
  // Get primary crop options
  getPrimaryCrops: () => api.get('/reference/primary-crops/'),
};

// =============================================================================
// ROLES API (NEW)
// =============================================================================

export const rolesAPI = {
  // List all roles
  list: () => api.get('/roles/'),

  // Get available roles (for assignment)
  available: () => api.get('/roles/available/'),

  // Get role details
  get: (id) => api.get(`/roles/${id}/`),
};

// =============================================================================
// INVITATIONS API (NEW)
// =============================================================================

export const invitationsAPI = {
  // List company invitations
  list: () => api.get('/invitations/'),

  // Resend invitation
  resend: (id) => api.post(`/invitations/${id}/resend/`),

  // Revoke/delete invitation (uses DELETE method)
  revoke: (id) => api.delete(`/invitations/${id}/`),
};

// =============================================================================
// AUDIT LOG API (NEW)
// =============================================================================

export const auditAPI = {
  // List audit logs with filtering and pagination
  list: (params = {}) => api.get('/audit-logs/', { params }),
  
  // Get single audit log entry
  get: (id) => api.get(`/audit-logs/${id}/`),
  
  // Get filter options (users, actions, model names)
  getFilters: () => api.get('/audit-logs/filters/'),
  
  // Export audit logs to Excel
  export: (params = {}) => api.get('/audit-logs/export/', { 
    params, 
    responseType: 'blob' 
  }),
  
  // Get statistics for dashboard
  getStatistics: (params = {}) => api.get('/audit-logs/statistics/', { params }),
};

// =============================================================================
// ONBOARDING API (NEW)
// =============================================================================

export const onboardingAPI = {
  /**
   * Get onboarding status for current company
   */
  getStatus: () => api.get('/onboarding/status/'),
  
  /**
   * Update current onboarding step
   * @param {string} step - One of: company_info, boundary, fields, water, complete
   */
  updateStep: (step) => api.post('/onboarding/step/', { step }),
  
  /**
   * Mark onboarding as complete
   */
  complete: () => api.post('/onboarding/complete/'),
  
  /**
   * Skip onboarding
   */
  skip: () => api.post('/onboarding/skip/'),
  
  /**
   * Reset onboarding (for testing)
   */
  reset: () => api.post('/onboarding/reset/'),
};

// =============================================================================
// WEATHER API (NEW)
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
// ANALYTICS API (NEW)
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
// FARMS API (EXISTING - now uses authenticated api instance)
// =============================================================================

export const farmsAPI = {
  getAll: () => api.get('/farms/'),
  getById: (id) => api.get(`/farms/${id}/`),
  create: (data) => api.post('/farms/', data),
  update: (id, data) => api.put(`/farms/${id}/`, data),
  patch: (id, data) => api.patch(`/farms/${id}/`, data),
  delete: (id) => api.delete(`/farms/${id}/`),
  getFields: (id) => api.get(`/farms/${id}/fields/`),
  bulkAddParcels: (farmId, parcels, replace = false) =>
    api.post(`/farms/${farmId}/bulk-parcels/`, { parcels, replace }),
  updateCoordinates: (id, lat, lng) =>
    api.post(`/farms/${id}/update-coordinates/`, { gps_latitude: lat, gps_longitude: lng }),
};

// =============================================================================
// FIELDS API (EXISTING)
// =============================================================================

export const fieldsAPI = {
  getAll: () => api.get('/fields/'),
  getById: (id) => api.get(`/fields/${id}/`),
  create: (data) => api.post('/fields/', data),
  update: (id, data) => api.put(`/fields/${id}/`, data),
  delete: (id) => api.delete(`/fields/${id}/`),
  getApplications: (id) => api.get(`/fields/${id}/applications/`),
};

// =============================================================================
// PRODUCTS API (EXISTING)
// =============================================================================

export const productsAPI = {
  getAll: () => api.get('/products/'),
  getByEPA: (epaNumber) => api.get(`/products/${epaNumber}/`),
  create: (data) => api.post('/products/', data),
  update: (epaNumber, data) => api.put(`/products/${epaNumber}/`, data),
  delete: (epaNumber) => api.delete(`/products/${epaNumber}/`),
};

// =============================================================================
// APPLICATIONS API (EXISTING)
// =============================================================================

export const applicationsAPI = {
  getAll: () => api.get('/applications/'),
  getById: (id) => api.get(`/applications/${id}/`),
  create: (data) => api.post('/applications/', data),
  update: (id, data) => api.put(`/applications/${id}/`, data),
  delete: (id) => api.delete(`/applications/${id}/`),
  getPending: () => api.get('/applications/pending/'),
  getReadyForPUR: () => api.get('/applications/ready_for_pur/'),
  markComplete: (id) => api.post(`/applications/${id}/mark_complete/`),
  markSubmitted: (id) => api.post(`/applications/${id}/mark_submitted/`),
};

// =============================================================================
// WATER SOURCES API (EXISTING)
// =============================================================================

export const waterSourcesAPI = {
  getAll: () => api.get('/water-sources/'),
  getById: (id) => api.get(`/water-sources/${id}/`),
  create: (data) => api.post('/water-sources/', data),
  update: (id, data) => api.put(`/water-sources/${id}/`, data),
  delete: (id) => api.delete(`/water-sources/${id}/`),
  getTests: (id) => api.get(`/water-sources/${id}/tests/`),
  getOverdue: () => api.get('/water-sources/overdue/'),
};

// =============================================================================
// WATER TESTS API (EXISTING)
// =============================================================================

export const waterTestsAPI = {
  getAll: () => api.get('/water-tests/'),
  getById: (id) => api.get(`/water-tests/${id}/`),
  create: (data) => api.post('/water-tests/', data),
  update: (id, data) => api.put(`/water-tests/${id}/`, data),
  delete: (id) => api.delete(`/water-tests/${id}/`),
  getFailed: () => api.get('/water-tests/failed/'),
  getBySource: (sourceId) => api.get(`/water-tests/?water_source=${sourceId}`),
};

// =============================================================================
// REPORTS API (EXISTING)
// =============================================================================

export const reportsAPI = {
  // Get report statistics
  getStatistics: (params) => 
    api.get('/reports/statistics/', { params }),
  
  // Validate applications for PUR compliance
  validatePUR: (params) =>
    api.get('/applications/validate_pur/', { params }),
  
  // Get PUR summary with validation
  getPURSummary: (params) =>
    api.get('/applications/pur_summary/', { params }),
  
  // Export PUR report (supports multiple formats)
  exportPUR: async (params) => {
    const response = await api.get('/applications/export_pur/', {
      params,
      responseType: 'blob'
    });
    return response;
  },
  
  // Generate download URL for PUR export
  getPURExportURL: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return `${API_BASE_URL}/applications/export_pur/?${queryString}`;
  }
};

// =============================================================================
// BUYERS API (EXISTING)
// =============================================================================

export const buyersAPI = {
  getAll: (params = {}) => 
    api.get('/buyers/', { params }),
  
  getSimpleList: () => 
    api.get('/buyers/', { params: { simple: true, active: true } }),
  
  get: (id) => 
    api.get(`/buyers/${id}/`),
  
  create: (data) => 
    api.post('/buyers/', data),
  
  update: (id, data) => 
    api.put(`/buyers/${id}/`, data),
  
  delete: (id) =>
    api.delete(`/buyers/${id}/`),

  getLoadHistory: (id) =>
    api.get(`/buyers/${id}/load_history/`),

  getPerformance: (id) =>
    api.get(`/buyers/${id}/performance/`),
};

// =============================================================================
// LABOR CONTRACTORS API (EXISTING)
// =============================================================================

export const laborContractorsAPI = {
  getAll: (params = {}) => 
    api.get('/labor-contractors/', { params }),
  
  getSimpleList: () => 
    api.get('/labor-contractors/', { params: { simple: true, active: true } }),
  
  get: (id) => 
    api.get(`/labor-contractors/${id}/`),
  
  create: (data) => 
    api.post('/labor-contractors/', data),
  
  update: (id, data) => 
    api.put(`/labor-contractors/${id}/`, data),
  
  delete: (id) => 
    api.delete(`/labor-contractors/${id}/`),
  
  getJobHistory: (id) =>
    api.get(`/labor-contractors/${id}/job_history/`),

  getExpiringSoon: () =>
    api.get('/labor-contractors/expiring_soon/'),

  getPerformance: (id) =>
    api.get(`/labor-contractors/${id}/performance/`),
};

// =============================================================================
// HARVESTS API (EXISTING)
// =============================================================================

export const harvestsAPI = {
  getAll: (params = {}) => 
    api.get('/harvests/', { params }),
  
  get: (id) => 
    api.get(`/harvests/${id}/`),
  
  create: (data) => 
    api.post('/harvests/', data),
  
  update: (id, data) => 
    api.put(`/harvests/${id}/`, data),
  
  delete: (id) => 
    api.delete(`/harvests/${id}/`),
  
  checkPHI: (fieldId, proposedDate) => 
    api.post('/harvests/check_phi/', {
      field_id: fieldId,
      proposed_harvest_date: proposedDate
    }),
  
  getStatistics: (params = {}) => 
    api.get('/harvests/statistics/', { params }),
  
  markComplete: (id) => 
    api.post(`/harvests/${id}/mark_complete/`),
  
  markVerified: (id) =>
    api.post(`/harvests/${id}/mark_verified/`),

  getByField: (params = {}) =>
    api.get('/harvests/by_field/', { params }),

  getCostAnalysis: (params = {}) =>
    api.get('/harvests/cost_analysis/', { params }),
};

// =============================================================================
// HARVEST LOADS API (EXISTING)
// =============================================================================

export const harvestLoadsAPI = {
  getAll: (params = {}) => 
    api.get('/harvest-loads/', { params }),
  
  get: (id) => 
    api.get(`/harvest-loads/${id}/`),
  
  create: (data) => 
    api.post('/harvest-loads/', data),
  
  update: (id, data) => 
    api.put(`/harvest-loads/${id}/`, data),
  
  delete: (id) => 
    api.delete(`/harvest-loads/${id}/`),
  
  markPaid: (id, paymentDate = null) => 
    api.post(`/harvest-loads/${id}/mark_paid/`, { 
      payment_date: paymentDate 
    }),
  
  getPendingPayments: () => 
    api.get('/harvest-loads/pending_payments/'),
};

// =============================================================================
// HARVEST LABOR API (EXISTING)
// =============================================================================

export const harvestLaborAPI = {
  getAll: (params = {}) => 
    api.get('/harvest-labor/', { params }),
  
  get: (id) => 
    api.get(`/harvest-labor/${id}/`),
  
  create: (data) => 
    api.post('/harvest-labor/', data),
  
  update: (id, data) => 
    api.put(`/harvest-labor/${id}/`, data),
  
  delete: (id) => 
    api.delete(`/harvest-labor/${id}/`),
  
  getCostAnalysis: (params = {}) => 
    api.get('/harvest-labor/cost_analysis/', { params }),
};

// =============================================================================
// WELLS & SGMA API (Updated to use unified water-sources endpoint)
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
  getAll: (params = {}) => api.get('/well-readings/', { params }),
  get: (id) => api.get(`/well-readings/${id}/`),
  create: (data) => api.post('/well-readings/', data),
  update: (id, data) => api.put(`/well-readings/${id}/`, data),
  delete: (id) => api.delete(`/well-readings/${id}/`),
  byPeriod: (params = {}) => api.get('/well-readings/by_period/', { params }),
};

export const meterCalibrationsAPI = {
  getAll: (params = {}) => api.get('/meter-calibrations/', { params }),
  get: (id) => api.get(`/meter-calibrations/${id}/`),
  create: (data) => api.post('/meter-calibrations/', data),
  update: (id, data) => api.put(`/meter-calibrations/${id}/`, data),
  delete: (id) => api.delete(`/meter-calibrations/${id}/`),
  expiring: (days = 90) => api.get('/meter-calibrations/expiring/', { params: { days } }),
};

export const waterAllocationsAPI = {
  getAll: (params = {}) => api.get('/water-allocations/', { params }),
  get: (id) => api.get(`/water-allocations/${id}/`),
  create: (data) => api.post('/water-allocations/', data),
  update: (id, data) => api.put(`/water-allocations/${id}/`, data),
  delete: (id) => api.delete(`/water-allocations/${id}/`),
  summary: (params = {}) => api.get('/water-allocations/summary/', { params }),
};

export const extractionReportsAPI = {
  getAll: (params = {}) => api.get('/extraction-reports/', { params }),
  get: (id) => api.get(`/extraction-reports/${id}/`),
  create: (data) => api.post('/extraction-reports/', data),
  update: (id, data) => api.put(`/extraction-reports/${id}/`, data),
  delete: (id) => api.delete(`/extraction-reports/${id}/`),
  generate: (data) => api.post('/extraction-reports/generate/', data),
  submit: (id) => api.post(`/extraction-reports/${id}/submit/`),
  confirm: (id, data) => api.post(`/extraction-reports/${id}/confirm/`, data),
};

export const irrigationEventsAPI = {
  getAll: (params = {}) => api.get('/irrigation-events/', { params }),
  get: (id) => api.get(`/irrigation-events/${id}/`),
  create: (data) => api.post('/irrigation-events/', data),
  update: (id, data) => api.put(`/irrigation-events/${id}/`, data),
  delete: (id) => api.delete(`/irrigation-events/${id}/`),
  byField: (params = {}) => api.get('/irrigation-events/by_field/', { params }),
  byWell: (params = {}) => api.get('/irrigation-events/by_well/', { params }),
};

export const sgmaAPI = {
  dashboard: () => api.get('/sgma/dashboard/'),
};

// =============================================================================
// NUTRIENT MANAGEMENT API (NEW)
// =============================================================================

export const fertilizerProductsAPI = {
  getAll: (params = {}) => api.get('/fertilizer-products/', { params }),
  get: (id) => api.get(`/fertilizer-products/${id}/`),
  create: (data) => api.post('/fertilizer-products/', data),
  update: (id, data) => api.put(`/fertilizer-products/${id}/`, data),
  delete: (id) => api.delete(`/fertilizer-products/${id}/`),
  search: (q) => api.get('/fertilizer-products/search/', { params: { q } }),
  seedCommon: () => api.post('/fertilizer-products/seed_common/'),
};

export const nutrientApplicationsAPI = {
  getAll: (params = {}) => api.get('/nutrient-applications/', { params }),
  get: (id) => api.get(`/nutrient-applications/${id}/`),
  create: (data) => api.post('/nutrient-applications/', data),
  update: (id, data) => api.put(`/nutrient-applications/${id}/`, data),
  delete: (id) => api.delete(`/nutrient-applications/${id}/`),
  byField: (params = {}) => api.get('/nutrient-applications/by_field/', { params }),
  byProduct: (params = {}) => api.get('/nutrient-applications/by_product/', { params }),
  byMonth: (params = {}) => api.get('/nutrient-applications/by_month/', { params }),
};

export const nutrientPlansAPI = {
  getAll: (params = {}) => api.get('/nutrient-plans/', { params }),
  get: (id) => api.get(`/nutrient-plans/${id}/`),
  create: (data) => api.post('/nutrient-plans/', data),
  update: (id, data) => api.put(`/nutrient-plans/${id}/`, data),
  delete: (id) => api.delete(`/nutrient-plans/${id}/`),
};

export const nitrogenReportsAPI = {
  summary: (params = {}) => api.get('/reports/nitrogen-summary/', { params }),
  export: (params = {}) => api.get('/reports/nitrogen-export/', { 
    params, 
    responseType: 'blob' 
  }),
};

// Constants for Nutrient Management dropdowns
export const NUTRIENT_CONSTANTS = {
  RATE_UNITS: [
    { value: 'lbs_acre', label: 'lbs/acre' },
    { value: 'tons_acre', label: 'tons/acre' },
    { value: 'gal_acre', label: 'gallons/acre' },
    { value: 'oz_acre', label: 'oz/acre' },
    { value: 'lbs_1000sqft', label: 'lbs/1000 sq ft' },
    { value: 'units_acre', label: 'units/acre' },
  ],
  
  APPLICATION_METHODS: [
    { value: 'broadcast', label: 'Broadcast' },
    { value: 'banded', label: 'Banded' },
    { value: 'foliar', label: 'Foliar Spray' },
    { value: 'fertigation', label: 'Fertigation' },
    { value: 'injection', label: 'Soil Injection' },
    { value: 'sidedress', label: 'Sidedress' },
    { value: 'topdress', label: 'Topdress' },
    { value: 'incorporated', label: 'Pre-plant Incorporated' },
    { value: 'drip', label: 'Drip/Micro-irrigation' },
    { value: 'aerial', label: 'Aerial Application' },
  ],
  
  FERTILIZER_FORMS: [
    { value: 'granular', label: 'Granular' },
    { value: 'liquid', label: 'Liquid' },
    { value: 'soluble', label: 'Water Soluble' },
    { value: 'organic', label: 'Organic' },
    { value: 'foliar', label: 'Foliar' },
    { value: 'controlled_release', label: 'Controlled Release' },
  ],
  
  PLAN_STATUSES: [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
  ],
};

// =============================================================================
// MAP API (EXISTING)
// =============================================================================

export const mapAPI = {
  // Geocode an address to GPS coordinates
  // Accepts string or object { address, county, city }
  geocode: (addressOrParams) => {
    if (typeof addressOrParams === 'string') {
      return api.post('/geocode/', { address: addressOrParams });
    }
    return api.post('/geocode/', addressOrParams);
  },
  
  // Update field boundary from drawn polygon
  updateFieldBoundary: (fieldId, boundaryGeojson, calculatedAcres) => 
    api.post(`/fields/${fieldId}/boundary/`, {
      boundary_geojson: boundaryGeojson,
      calculated_acres: calculatedAcres
    }),
};

// =============================================================================
// HELPER FUNCTIONS (EXISTING)
// =============================================================================

// Helper function to download file from blob
export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// =============================================================================
// CONSTANTS FOR DROPDOWNS (EXISTING)
// =============================================================================

export const HARVEST_CONSTANTS = {
  BUYER_TYPES: [
    { value: 'packing_house', label: 'Packing House' },
    { value: 'processor', label: 'Processor' },
    { value: 'direct_sale', label: 'Direct Sale' },
    { value: 'farmers_market', label: 'Farmers Market' },
    { value: 'distributor', label: 'Distributor' },
    { value: 'export', label: 'Export' },
  ],
  
  CROP_VARIETIES: [
    { value: 'navel_orange', label: 'Navel Orange' },
    { value: 'valencia_orange', label: 'Valencia Orange' },
    { value: 'cara_cara', label: 'Cara Cara Orange' },
    { value: 'blood_orange', label: 'Blood Orange' },
    { value: 'meyer_lemon', label: 'Meyer Lemon' },
    { value: 'eureka_lemon', label: 'Eureka Lemon' },
    { value: 'lisbon_lemon', label: 'Lisbon Lemon' },
    { value: 'lime', label: 'Lime' },
    { value: 'grapefruit_white', label: 'White Grapefruit' },
    { value: 'grapefruit_ruby', label: 'Ruby Red Grapefruit' },
    { value: 'mandarin', label: 'Mandarin' },
    { value: 'tangerine', label: 'Tangerine' },
    { value: 'clementine', label: 'Clementine' },
    { value: 'satsuma', label: 'Satsuma' },
    { value: 'tangelo', label: 'Tangelo' },
    { value: 'kumquat', label: 'Kumquat' },
    { value: 'hass_avocado', label: 'Hass Avocado' },
    { value: 'lamb_hass_avocado', label: 'Lamb Hass Avocado' },
    { value: 'gem_avocado', label: 'GEM Avocado' },
    { value: 'reed_avocado', label: 'Reed Avocado' },
    { value: 'fuerte_avocado', label: 'Fuerte Avocado' },
    { value: 'bacon_avocado', label: 'Bacon Avocado' },
    { value: 'other', label: 'Other' },
  ],

  // Crop varieties that are weight-based (lbs) instead of bin-based
  WEIGHT_BASED_VARIETIES: [
    'hass_avocado', 'lamb_hass_avocado', 'gem_avocado',
    'reed_avocado', 'fuerte_avocado', 'bacon_avocado',
  ],
  
  DEFAULT_BIN_WEIGHTS: {
    'navel_orange': 900,
    'valencia_orange': 900,
    'cara_cara': 900,
    'blood_orange': 900,
    'meyer_lemon': 900,
    'eureka_lemon': 900,
    'lisbon_lemon': 900,
    'lime': 850,
    'grapefruit_white': 800,
    'grapefruit_ruby': 800,
    'mandarin': 800,
    'tangerine': 800,
    'clementine': 800,
    'satsuma': 800,
    'tangelo': 850,
    'kumquat': 800,
    'hass_avocado': 800,
    'lamb_hass_avocado': 800,
    'gem_avocado': 800,
    'reed_avocado': 800,
    'fuerte_avocado': 800,
    'bacon_avocado': 800,
    'other': 900,
  },
  
  GRADES: [
    { value: 'fancy', label: 'Fancy' },
    { value: 'choice', label: 'Choice' },
    { value: 'standard', label: 'Standard' },
    { value: 'juice', label: 'Juice Grade' },
    { value: 'reject', label: 'Reject/Cull' },
  ],
  
  SIZE_GRADES: [
    { value: '48', label: '48' },
    { value: '56', label: '56' },
    { value: '72', label: '72' },
    { value: '88', label: '88' },
    { value: '113', label: '113' },
    { value: '138', label: '138' },
    { value: '163', label: '163' },
    { value: '180', label: '180' },
    { value: '200', label: '200' },
    { value: '235', label: '235' },
    { value: 'mixed', label: 'Mixed' },
  ],
  
  PRICE_UNITS: [
    { value: 'per_bin', label: 'Per Bin' },
    { value: 'per_lb', label: 'Per Pound' },
    { value: 'per_ton', label: 'Per Ton' },
    { value: 'per_box', label: 'Per Box' },
    { value: 'per_carton', label: 'Per Carton' },
    { value: 'flat_rate', label: 'Flat Rate' },
  ],
  
  PAYMENT_STATUSES: [
    { value: 'pending', label: 'Pending' },
    { value: 'invoiced', label: 'Invoiced' },
    { value: 'partial', label: 'Partially Paid' },
    { value: 'paid', label: 'Paid' },
    { value: 'disputed', label: 'Disputed' },
  ],
  
  HARVEST_STATUSES: [
    { value: 'in_progress', label: 'In Progress' },
    { value: 'complete', label: 'Complete' },
    { value: 'verified', label: 'Verified' },
  ],
  
  PAY_TYPES: [
    { value: 'hourly', label: 'Hourly' },
    { value: 'piece_rate', label: 'Piece Rate (per bin)' },
    { value: 'contract', label: 'Contract/Flat Rate' },
  ],
};

export const farmParcelsAPI = {
  // Standard CRUD
  getAll: (params = {}) => api.get('/farm-parcels/', { params }),
  get: (id) => api.get(`/farm-parcels/${id}/`),
  create: (data) => api.post('/farm-parcels/', data),
  update: (id, data) => api.put(`/farm-parcels/${id}/`, data),
  delete: (id) => api.delete(`/farm-parcels/${id}/`),

  // Farm-specific endpoints
  getForFarm: (farmId) => api.get(`/farms/${farmId}/parcels/`),
  addToFarm: (farmId, data) => api.post(`/farms/${farmId}/parcels/`, data),
  bulkAdd: (farmId, parcels, replace = false) =>
    api.post(`/farms/${farmId}/bulk-parcels/`, { parcels, replace }),
};

// =============================================================================
// QUARANTINE API
// =============================================================================

export const quarantineAPI = {
  // Check quarantine status for a farm
  checkFarm: (farmId, refresh = false) =>
    api.get('/quarantine/check/', {
      params: { farm_id: farmId, refresh: refresh ? 'true' : 'false' }
    }),

  // Check quarantine status for a field
  checkField: (fieldId, refresh = false) =>
    api.get('/quarantine/check/', {
      params: { field_id: fieldId, refresh: refresh ? 'true' : 'false' }
    }),

  // Get quarantine boundary GeoJSON for map overlay
  getBoundaries: (refresh = false) =>
    api.get('/quarantine/boundaries/', {
      params: { refresh: refresh ? 'true' : 'false' }
    }),
};

// =============================================================================
// IRRIGATION SCHEDULING API
// =============================================================================

export const irrigationZonesAPI = {
  // Standard CRUD
  getAll: (params = {}) => api.get('/irrigation-zones/', { params }),
  get: (id) => api.get(`/irrigation-zones/${id}/`),
  create: (data) => api.post('/irrigation-zones/', data),
  update: (id, data) => api.put(`/irrigation-zones/${id}/`, data),
  delete: (id) => api.delete(`/irrigation-zones/${id}/`),

  // Zone actions
  getStatus: (id) => api.get(`/irrigation-zones/${id}/status/`),
  calculate: (id, data = {}) => api.post(`/irrigation-zones/${id}/calculate/`, data),
  getEvents: (id) => api.get(`/irrigation-zones/${id}/events/`),
  recordEvent: (id, data) => api.post(`/irrigation-zones/${id}/events/`, data),
  getRecommendations: (id) => api.get(`/irrigation-zones/${id}/recommendations/`),
  getWeather: (id, days = 7) => api.get(`/irrigation-zones/${id}/weather/`, { params: { days } }),

  // Filtered lists
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
  // Standard CRUD
  getAll: (params = {}) => api.get('/kc-profiles/', { params }),
  get: (id) => api.get(`/kc-profiles/${id}/`),
  create: (data) => api.post('/kc-profiles/', data),
  update: (id, data) => api.put(`/kc-profiles/${id}/`, data),
  delete: (id) => api.delete(`/kc-profiles/${id}/`),

  // Get system defaults
  defaults: () => api.get('/kc-profiles/', { params: { zone__isnull: true } }),
};

export const soilMoistureReadingsAPI = {
  // Standard CRUD
  getAll: (params = {}) => api.get('/soil-moisture-readings/', { params }),
  get: (id) => api.get(`/soil-moisture-readings/${id}/`),
  create: (data) => api.post('/soil-moisture-readings/', data),
  update: (id, data) => api.put(`/soil-moisture-readings/${id}/`, data),
  delete: (id) => api.delete(`/soil-moisture-readings/${id}/`),

  // Filtered lists
  byZone: (zoneId) => api.get('/soil-moisture-readings/', { params: { zone: zoneId } }),
};

export const irrigationDashboardAPI = {
  // Get full dashboard data
  get: () => api.get('/irrigation/dashboard/'),

  // Get CIMIS station list (for zone setup)
  getCIMISStations: (lat, lng, limit = 5) =>
    api.get('/irrigation/cimis-stations/', { params: { lat, lng, limit } }),
};

// =============================================================================
// CROP & ROOTSTOCK MANAGEMENT
// =============================================================================

export const cropsAPI = {
  getAll: (params = {}) => api.get('/crops/', { params }),
  getById: (id) => api.get(`/crops/${id}/`),
  create: (data) => api.post('/crops/', data),
  update: (id, data) => api.put(`/crops/${id}/`, data),
  delete: (id) => api.delete(`/crops/${id}/`),
  getCategories: () => api.get('/crops/categories/'),
  search: (q) => api.get('/crops/search/', { params: { q } }),
};

export const rootstocksAPI = {
  getAll: (params = {}) => api.get('/rootstocks/', { params }),
  getById: (id) => api.get(`/rootstocks/${id}/`),
  create: (data) => api.post('/rootstocks/', data),
  update: (id, data) => api.put(`/rootstocks/${id}/`, data),
  delete: (id) => api.delete(`/rootstocks/${id}/`),
  forCrop: (cropId) => api.get('/rootstocks/for_crop/', { params: { crop_id: cropId } }),
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

// Helper: get unit label for a crop variety
export const getUnitLabelForCropVariety = (cropVariety) => {
  const isWeightBased = HARVEST_CONSTANTS.WEIGHT_BASED_VARIETIES.includes(cropVariety);
  return {
    unit: isWeightBased ? 'LBS' : 'BIN',
    labelPlural: isWeightBased ? 'Lbs' : 'Bins',
    labelSingular: isWeightBased ? 'Lb' : 'Bin',
  };
};

// Constants for Field agricultural data
export const FIELD_CONSTANTS = {
  ROW_ORIENTATIONS: [
    { value: 'ns', label: 'North-South' },
    { value: 'ew', label: 'East-West' },
    { value: 'ne_sw', label: 'Northeast-Southwest' },
    { value: 'nw_se', label: 'Northwest-Southeast' },
  ],

  TRELLIS_SYSTEMS: [
    { value: 'none', label: 'None' },
    { value: 'vertical_shoot', label: 'Vertical Shoot Position (VSP)' },
    { value: 'lyre', label: 'Lyre/U-Shape' },
    { value: 'geneva_double', label: 'Geneva Double Curtain' },
    { value: 'high_wire', label: 'High Wire' },
    { value: 'pergola', label: 'Pergola/Arbor' },
    { value: 'espalier', label: 'Espalier' },
    { value: 'stake', label: 'Stake' },
    { value: 'other', label: 'Other' },
  ],

  SOIL_TYPES: [
    { value: 'sandy', label: 'Sandy' },
    { value: 'sandy_loam', label: 'Sandy Loam' },
    { value: 'loam', label: 'Loam' },
    { value: 'clay_loam', label: 'Clay Loam' },
    { value: 'clay', label: 'Clay' },
    { value: 'silty_loam', label: 'Silty Loam' },
    { value: 'silty_clay', label: 'Silty Clay' },
  ],

  IRRIGATION_TYPES: [
    { value: 'drip', label: 'Drip' },
    { value: 'micro_sprinkler', label: 'Micro-Sprinkler' },
    { value: 'sprinkler', label: 'Sprinkler' },
    { value: 'flood', label: 'Flood' },
    { value: 'furrow', label: 'Furrow' },
    { value: 'none', label: 'None/Dryland' },
  ],

  ORGANIC_STATUSES: [
    { value: 'conventional', label: 'Conventional' },
    { value: 'transitional', label: 'Transitional' },
    { value: 'certified', label: 'Certified Organic' },
  ],
};

// =============================================================================
// TREE DETECTION API (YOLO/DeepForest)
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
// COMPLIANCE MANAGEMENT API
// =============================================================================

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
  /** Get all deadlines with optional filters */
  getAll: (params = {}) => api.get('/compliance/deadlines/', { params }),

  /** Get a specific deadline */
  get: (id) => api.get(`/compliance/deadlines/${id}/`),

  /** Create a new deadline */
  create: (data) => api.post('/compliance/deadlines/', data),

  /** Update a deadline */
  update: (id, data) => api.put(`/compliance/deadlines/${id}/`, data),

  /** Delete a deadline */
  delete: (id) => api.delete(`/compliance/deadlines/${id}/`),

  /** Mark deadline as completed */
  complete: (id, data = {}) => api.post(`/compliance/deadlines/${id}/complete/`, data),

  /** Skip a deadline */
  skip: (id, reason = '') => api.post(`/compliance/deadlines/${id}/skip/`, { reason }),

  /** Get upcoming deadlines */
  upcoming: (days = 30) => api.get('/compliance/deadlines/upcoming/', { params: { days } }),

  /** Get overdue deadlines */
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
  /** Get all licenses */
  getAll: (params = {}) => api.get('/compliance/licenses/', { params }),

  /** Get a specific license */
  get: (id) => api.get(`/compliance/licenses/${id}/`),

  /** Create a new license */
  create: (data) => api.post('/compliance/licenses/', data),

  /** Update a license */
  update: (id, data) => api.put(`/compliance/licenses/${id}/`, data),

  /** Delete a license */
  delete: (id) => api.delete(`/compliance/licenses/${id}/`),

  /** Get expiring licenses */
  expiring: (days = 90) => api.get('/compliance/licenses/expiring/', { params: { days } }),

  /** Start renewal process */
  startRenewal: (id) => api.post(`/compliance/licenses/${id}/start_renewal/`),
};

/**
 * WPS Training Records - Worker Protection Standard training tracking
 */
export const wpsTrainingAPI = {
  /** Get all training records */
  getAll: (params = {}) => api.get('/compliance/wps-training/', { params }),

  /** Get a specific training record */
  get: (id) => api.get(`/compliance/wps-training/${id}/`),

  /** Create a new training record */
  create: (data) => api.post('/compliance/wps-training/', data),

  /** Update a training record */
  update: (id, data) => api.put(`/compliance/wps-training/${id}/`, data),

  /** Delete a training record */
  delete: (id) => api.delete(`/compliance/wps-training/${id}/`),

  /** Get expiring training */
  expiring: (days = 90) => api.get('/compliance/wps-training/expiring/', { params: { days } }),

  /** Get training by worker */
  byWorker: (workerId) => api.get('/compliance/wps-training/by_worker/', { params: { worker_id: workerId } }),

  /** Get WPS dashboard data */
  dashboard: () => api.get('/compliance/wps-training/dashboard/'),
};

/**
 * Central Posting Locations - WPS poster/SDS display locations
 */
export const postingLocationsAPI = {
  /** Get all posting locations */
  getAll: (params = {}) => api.get('/compliance/posting-locations/', { params }),

  /** Get a specific posting location */
  get: (id) => api.get(`/compliance/posting-locations/${id}/`),

  /** Create a new posting location */
  create: (data) => api.post('/compliance/posting-locations/', data),

  /** Update a posting location */
  update: (id, data) => api.put(`/compliance/posting-locations/${id}/`, data),

  /** Delete a posting location */
  delete: (id) => api.delete(`/compliance/posting-locations/${id}/`),

  /** Verify posting location requirements */
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
  /** Get all compliance reports */
  getAll: (params = {}) => api.get('/compliance/reports/', { params }),

  /** Get a specific report */
  get: (id) => api.get(`/compliance/reports/${id}/`),

  /** Create a new report */
  create: (data) => api.post('/compliance/reports/', data),

  /** Update a report */
  update: (id, data) => api.put(`/compliance/reports/${id}/`, data),

  /** Delete a report */
  delete: (id) => api.delete(`/compliance/reports/${id}/`),

  /** Generate a new report */
  generate: (data) => api.post('/compliance/reports/generate/', data),

  /** Validate report data */
  validate: (id) => api.post(`/compliance/reports/${id}/validate/`),

  /** Submit report */
  submit: (id, data = {}) => api.post(`/compliance/reports/${id}/submit/`, data),
};

/**
 * Incident Reports - Safety incidents, spills, exposures
 */
export const incidentReportsAPI = {
  /** Get all incident reports */
  getAll: (params = {}) => api.get('/compliance/incidents/', { params }),

  /** Get a specific incident */
  get: (id) => api.get(`/compliance/incidents/${id}/`),

  /** Create a new incident report */
  create: (data) => api.post('/compliance/incidents/', data),

  /** Update an incident report */
  update: (id, data) => api.put(`/compliance/incidents/${id}/`, data),

  /** Delete an incident report */
  delete: (id) => api.delete(`/compliance/incidents/${id}/`),

  /** Start investigation */
  startInvestigation: (id) => api.post(`/compliance/incidents/${id}/start_investigation/`),

  /** Resolve incident */
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

  /** Get calendar data */
  calendar: (params = {}) => api.get('/compliance/dashboard/calendar/', { params }),
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

// =============================================================================
// DISEASE PREVENTION API
// =============================================================================

/**
 * External Detections - Official disease detections from CDFA, USDA, etc.
 */
export const externalDetectionsAPI = {
  /** Get all external detections with optional filters */
  getAll: (params = {}) => api.get('/disease/external-detections/', { params }),

  /** Get a specific detection */
  get: (id) => api.get(`/disease/external-detections/${id}/`),

  /** Create a new detection (admin only) */
  create: (data) => api.post('/disease/external-detections/', data),

  /** Update a detection */
  update: (id, data) => api.put(`/disease/external-detections/${id}/`, data),

  /** Delete a detection */
  delete: (id) => api.delete(`/disease/external-detections/${id}/`),

  /** Trigger sync with external data sources */
  sync: () => api.post('/disease/external-detections/sync/'),

  /** Get detections near a point */
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
  /** Get all alert rules */
  getAll: () => api.get('/disease/alert-rules/'),

  /** Get a specific rule */
  get: (id) => api.get(`/disease/alert-rules/${id}/`),

  /** Create a new rule */
  create: (data) => api.post('/disease/alert-rules/', data),

  /** Update a rule */
  update: (id, data) => api.put(`/disease/alert-rules/${id}/`, data),

  /** Delete a rule */
  delete: (id) => api.delete(`/disease/alert-rules/${id}/`),

  /** Toggle rule active status */
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
  /** Get all scouting reports */
  getAll: (params = {}) => api.get('/disease/scouting/', { params }),

  /** Get a specific report */
  get: (id) => api.get(`/disease/scouting/${id}/`),

  /** Create a new scouting report */
  create: (data) => api.post('/disease/scouting/', data),

  /** Update a report */
  update: (id, data) => api.put(`/disease/scouting/${id}/`, data),

  /** Delete a report */
  delete: (id) => api.delete(`/disease/scouting/${id}/`),

  /** Verify a report (admin) */
  verify: (id, data) => api.post(`/disease/scouting/${id}/verify/`, data),

  /** Add photos to a report */
  addPhoto: (id, formData) =>
    api.post(`/disease/scouting/${id}/photos/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  /** Get reports for a specific field */
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

// =============================================================================
// PACKINGHOUSE POOL TRACKING API
// =============================================================================

export const packinghousesAPI = {
  getAll: (params = {}) =>
    api.get('/packinghouses/', { params }),

  get: (id) =>
    api.get(`/packinghouses/${id}/`),

  create: (data) =>
    api.post('/packinghouses/', data),

  update: (id, data) =>
    api.put(`/packinghouses/${id}/`, data),

  delete: (id) =>
    api.delete(`/packinghouses/${id}/`),

  getPools: (id, params = {}) =>
    api.get(`/packinghouses/${id}/pools/`, { params }),

  getLedger: (id, params = {}) =>
    api.get(`/packinghouses/${id}/ledger/`, { params }),
};

export const poolsAPI = {
  getAll: (params = {}) =>
    api.get('/pools/', { params }),

  get: (id) =>
    api.get(`/pools/${id}/`),

  create: (data) =>
    api.post('/pools/', data),

  update: (id, data) =>
    api.put(`/pools/${id}/`, data),

  delete: (id) =>
    api.delete(`/pools/${id}/`),

  getDeliveries: (id, params = {}) =>
    api.get(`/pools/${id}/deliveries/`, { params }),

  getPackoutReports: (id, params = {}) =>
    api.get(`/pools/${id}/packout-reports/`, { params }),

  getSettlements: (id, params = {}) =>
    api.get(`/pools/${id}/settlements/`, { params }),

  getSummary: (id) =>
    api.get(`/pools/${id}/summary/`),
};

export const packinghouseDeliveriesAPI = {
  getAll: (params = {}) =>
    api.get('/packinghouse-deliveries/', { params }),

  get: (id) =>
    api.get(`/packinghouse-deliveries/${id}/`),

  create: (data) =>
    api.post('/packinghouse-deliveries/', data),

  update: (id, data) =>
    api.put(`/packinghouse-deliveries/${id}/`, data),

  delete: (id) =>
    api.delete(`/packinghouse-deliveries/${id}/`),
};

export const packoutReportsAPI = {
  getAll: (params = {}) =>
    api.get('/packout-reports/', { params }),

  get: (id) =>
    api.get(`/packout-reports/${id}/`),

  create: (data) =>
    api.post('/packout-reports/', data),

  update: (id, data) =>
    api.put(`/packout-reports/${id}/`, data),

  delete: (id) =>
    api.delete(`/packout-reports/${id}/`),

  addGradeLines: (id, gradeLines) =>
    api.post(`/packout-reports/${id}/grade-lines/`, gradeLines),
};

export const poolSettlementsAPI = {
  getAll: (params = {}) =>
    api.get('/pool-settlements/', { params }),

  get: (id) =>
    api.get(`/pool-settlements/${id}/`),

  create: (data) =>
    api.post('/pool-settlements/', data),

  update: (id, data) =>
    api.put(`/pool-settlements/${id}/`, data),

  delete: (id) =>
    api.delete(`/pool-settlements/${id}/`),

  addGradeLines: (id, gradeLines) =>
    api.post(`/pool-settlements/${id}/grade-lines/`, gradeLines),

  addDeductions: (id, deductions) =>
    api.post(`/pool-settlements/${id}/deductions/`, deductions),
};

export const growerLedgerAPI = {
  getAll: (params = {}) =>
    api.get('/grower-ledger/', { params }),

  get: (id) =>
    api.get(`/grower-ledger/${id}/`),

  create: (data) =>
    api.post('/grower-ledger/', data),

  update: (id, data) =>
    api.put(`/grower-ledger/${id}/`, data),

  delete: (id) =>
    api.delete(`/grower-ledger/${id}/`),
};

export const packinghouseAnalyticsAPI = {
  getBlockPerformance: (params = {}) =>
    api.get('/packinghouse-analytics/block-performance/', { params }),

  getPackoutTrends: (params = {}) =>
    api.get('/packinghouse-analytics/packout-trends/', { params }),

  getSettlementComparison: (params = {}) =>
    api.get('/packinghouse-analytics/settlement-comparison/', { params }),

  getSizeDistribution: (params = {}) =>
    api.get('/packinghouse-analytics/size-distribution/', { params }),

  getSizePricing: (params = {}) =>
    api.get('/packinghouse-analytics/size-pricing/', { params }),

  getDashboard: (params = {}) =>
    api.get('/packinghouse-analytics/dashboard/', { params }),

  // Unified harvest-to-packing pipeline overview
  getPipeline: (params = {}) =>
    api.get('/harvest-packing/pipeline/', { params }),

  // Settlement Intelligence endpoints
  getCommodityROI: (params = {}) =>
    api.get('/packinghouse-analytics/commodity-roi/', { params }),

  getDeductionCreep: (params = {}) =>
    api.get('/packinghouse-analytics/deduction-creep/', { params }),

  getPriceTrends: (params = {}) =>
    api.get('/packinghouse-analytics/price-trends/', { params }),

  getReportCard: (params = {}) =>
    api.get('/packinghouse-analytics/report-card/', { params }),

  getPackImpact: (params = {}) =>
    api.get('/packinghouse-analytics/pack-impact/', { params }),
};

// =============================================================================
// HARVEST PROFITABILITY ANALYTICS API
// =============================================================================

export const harvestAnalyticsAPI = {
  /**
   * Get true profitability analysis - settlement returns minus harvest costs
   * @param {Object} params - { season, field_id, packinghouse }
   * @returns Profitability breakdown by field
   */
  getProfitability: (params = {}) =>
    api.get('/harvest-analytics/profitability/', { params }),

  /**
   * Get detailed breakdown of packinghouse deductions
   * @param {Object} params - { season, field_id, packinghouse }
   * @returns Deductions grouped by category
   */
  getDeductionBreakdown: (params = {}) =>
    api.get('/harvest-analytics/deductions/', { params }),

  /**
   * Get year-over-year season comparison
   * @param {Object} params - { field_id, packinghouse }
   * @returns Metrics across seasons with YoY changes
   */
  getSeasonComparison: (params = {}) =>
    api.get('/harvest-analytics/seasons/', { params }),
};

// =============================================================================
// PACKINGHOUSE STATEMENT UPLOAD API (PDF Extraction)
// =============================================================================

export const packinghouseStatementsAPI = {
  // List statements with optional filters
  getAll: (params = {}) =>
    api.get('/packinghouse-statements/', { params }),

  // Get single statement
  get: (id) =>
    api.get(`/packinghouse-statements/${id}/`),

  // Upload PDF and extract data
  // formData should contain: pdf_file, packinghouse, packinghouse_format (optional)
  upload: (formData) =>
    api.post('/packinghouse-statements/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),

  // Delete statement (only if not processed)
  delete: (id) =>
    api.delete(`/packinghouse-statements/${id}/`),

  // Get extracted data for preview
  getExtractedData: (id) =>
    api.get(`/packinghouse-statements/${id}/extracted-data/`),

  // Confirm and create PackoutReport or PoolSettlement
  // data should contain: pool_id, field_id (optional), edited_data (optional)
  confirm: (id, data) =>
    api.post(`/packinghouse-statements/${id}/confirm/`, data),

  // Reprocess PDF extraction
  // data can contain: packinghouse_format (optional hint)
  reprocess: (id, data = {}) =>
    api.post(`/packinghouse-statements/${id}/reprocess/`, data, {
      timeout: 300000,  // 5 min - PDF extraction via Claude AI is slow
    }),

  // Batch upload multiple PDFs
  // formData should contain: files[], packinghouse, packinghouse_format (optional)
  batchUpload: (formData) =>
    api.post('/packinghouse-statements/batch-upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,  // 5 min - PDF extraction via Claude AI is slow
    }),

  // Batch confirm multiple statements
  // data: { statements: [{id, farm_id?, field_id?, skip?}], save_mappings: bool }
  batchConfirm: (data) =>
    api.post('/packinghouse-statements/batch-confirm/', data),

  // Get batch status
  getBatchStatus: (batchId) =>
    api.get(`/packinghouse-statements/batch-status/${batchId}/`),

  // Get learned grower mappings
  getGrowerMappings: (packinghouseId) =>
    api.get('/packinghouse-statements/grower-mappings/', {
      params: { packinghouse: packinghouseId }
    }),

  // Delete a grower mapping
  deleteGrowerMapping: (mappingId) =>
    api.delete(`/packinghouse-statements/grower-mappings/${mappingId}/`),
};

export const PACKINGHOUSE_CONSTANTS = {
  poolTypes: [
    { value: 'fresh', label: 'Fresh Market' },
    { value: 'juice', label: 'Juice/Processing' },
    { value: 'mixed', label: 'Mixed' },
  ],
  poolStatuses: [
    { value: 'active', label: 'Active' },
    { value: 'closed', label: 'Closed' },
    { value: 'settled', label: 'Settled' },
  ],
  commodities: [
    { value: 'LEMONS', label: 'Lemons' },
    { value: 'NAVELS', label: 'Navels' },
    { value: 'VALENCIAS', label: 'Valencias' },
    { value: 'TANGERINES', label: 'Tangerines' },
    { value: 'MANDARINS', label: 'Mandarins' },
    { value: 'GRAPEFRUIT', label: 'Grapefruit' },
    { value: 'AVOCADOS', label: 'Avocados' },
    { value: 'OTHER', label: 'Other' },
  ],
  gradeTypes: [
    { value: 'SUNKIST', label: 'Sunkist' },
    { value: 'CHOICE', label: 'Choice' },
    { value: 'STANDARD', label: 'Standard' },
    { value: 'JUICE', label: 'Juice' },
    { value: 'CULL', label: 'Cull' },
  ],
  deductionCategories: [
    { value: 'packing', label: 'Packing Charges' },
    { value: 'assessment', label: 'Assessments' },
    { value: 'pick_haul', label: 'Pick & Haul' },
    { value: 'capital', label: 'Capital Funds' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'other', label: 'Other' },
  ],
  ledgerEntryTypes: [
    { value: 'advance', label: 'Advance' },
    { value: 'pool_close', label: 'Pool Close' },
    { value: 'adjustment', label: 'Adjustment' },
    { value: 'refund', label: 'Refund' },
    { value: 'payment', label: 'Payment' },
    { value: 'capital_equity', label: 'Capital/Equity' },
  ],
  // Common California citrus sizes
  sizes: [
    '032', '036', '040', '048', '056', '063', '072', '075', '088',
    '095', '113', '138', '163', '180', '200', '235', '285'
  ],
  getCurrentSeason: () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    // California citrus season typically starts in October
    if (month >= 9) {
      return `${year}-${year + 1}`;
    }
    return `${year - 1}-${year}`;
  },
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
// FSMA COMPLIANCE API
// =============================================================================

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

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the full API URL for a given path.
 * Useful for constructing URLs for <a href> tags that need to point to the API.
 * @param {string} path - The API path (e.g., '/api/packinghouse-statements/123/pdf/')
 * @returns {string} The full URL including the API base
 */
export const getApiUrl = (path) => {
  // Remove /api prefix if present since API_BASE_URL already includes it
  const cleanPath = path.startsWith('/api/') ? path.slice(4) : path;
  // Remove leading slash if API_BASE_URL ends with /api
  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  return `${API_BASE_URL}${normalizedPath}`;
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

// =============================================================================
// PRIMUS GFS COMPLIANCE API
// =============================================================================

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
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default api;
