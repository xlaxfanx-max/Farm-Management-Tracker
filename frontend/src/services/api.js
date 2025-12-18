// =============================================================================
// FARM TRACKER API SERVICE
// =============================================================================
// Updated with authentication support while preserving all existing functionality
// =============================================================================

import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

// =============================================================================
// AXIOS INSTANCE WITH AUTH INTERCEPTORS
// =============================================================================

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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

      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        try {
          // Use base axios to avoid infinite loop
          const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
            refresh: refreshToken,
          });

          const newAccessToken = response.data.access;
          localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed - clear tokens and redirect to login
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
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
    axios.post(`${API_BASE_URL}/auth/register/`, data),

  // Login
  login: (email, password) => 
    axios.post(`${API_BASE_URL}/auth/login/`, { email, password }),

  // Logout
  logout: (refreshToken) => 
    api.post('/auth/logout/', { refresh: refreshToken }),

  // Refresh token
  refresh: (refreshToken) => 
    axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh: refreshToken }),

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
    }),

  // Validate invitation token
  validateInvitation: (token) => 
    axios.get(`${API_BASE_URL}/auth/invitation/${token}/`),
};

// =============================================================================
// COMPANY API (NEW)
// =============================================================================

export const companyAPI = {
  // List user's companies
  list: () => api.get('/companies/'),

  // Get company details
  get: (id) => api.get(`/companies/${id}/`),

  // Update company settings
  update: (id, data) => api.put(`/companies/${id}/`, data),

  // Get company statistics
  statistics: (id) => api.get(`/companies/${id}/statistics/`),

  // Get company farms
  farms: (id) => api.get(`/companies/${id}/farms/`),

  // List company members
  members: (companyId) => api.get(`/companies/${companyId}/members/`),

  // Update member role
  updateMember: (companyId, memberId, data) => 
    api.put(`/companies/${companyId}/members/${memberId}/`, data),

  // Remove member
  removeMember: (companyId, memberId) => 
    api.delete(`/companies/${companyId}/members/${memberId}/`),

  // Transfer ownership
  transferOwnership: (companyId, memberId) => 
    api.post(`/companies/${companyId}/members/${memberId}/transfer_ownership/`),
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

  // Revoke invitation
  revoke: (id) => api.post(`/invitations/${id}/revoke/`),
};

// =============================================================================
// AUDIT LOG API (NEW)
// =============================================================================

export const auditAPI = {
  // List audit logs
  list: (params = {}) => api.get('/audit-logs/', { params }),
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
// FARMS API (EXISTING - now uses authenticated api instance)
// =============================================================================

export const farmsAPI = {
  getAll: () => api.get('/farms/'),
  getById: (id) => api.get(`/farms/${id}/`),
  create: (data) => api.post('/farms/', data),
  update: (id, data) => api.put(`/farms/${id}/`, data),
  delete: (id) => api.delete(`/farms/${id}/`),
  getFields: (id) => api.get(`/farms/${id}/fields/`),
  bulkAddParcels: (farmId, parcels, replace = false) => 
   api.post(`/farms/${farmId}/bulk-parcels/`, { parcels, replace }),
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
  geocode: (address) => 
    api.post('/geocode/', { address }),
  
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
    { value: 'other', label: 'Other' },
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
// DEFAULT EXPORT
// =============================================================================

export default api;