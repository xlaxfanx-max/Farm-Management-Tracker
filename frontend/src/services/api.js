import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Farms API
export const farmsAPI = {
  getAll: () => api.get('/farms/'),
  getById: (id) => api.get(`/farms/${id}/`),
  create: (data) => api.post('/farms/', data),
  update: (id, data) => api.put(`/farms/${id}/`, data),
  delete: (id) => api.delete(`/farms/${id}/`),
  getFields: (id) => api.get(`/farms/${id}/fields/`),
};

// Water Quality APIs
export const waterSourcesAPI = {
  getAll: () => api.get('/water-sources/'),
  getById: (id) => api.get(`/water-sources/${id}/`),
  create: (data) => api.post('/water-sources/', data),
  update: (id, data) => api.put(`/water-sources/${id}/`, data),
  delete: (id) => api.delete(`/water-sources/${id}/`),
  getTests: (id) => api.get(`/water-sources/${id}/tests/`),
  getOverdue: () => api.get('/water-sources/overdue/'),
};

export const waterTestsAPI = {
  getAll: () => api.get('/water-tests/'),
  getById: (id) => api.get(`/water-tests/${id}/`),
  create: (data) => api.post('/water-tests/', data),
  update: (id, data) => api.put(`/water-tests/${id}/`, data),
  delete: (id) => api.delete(`/water-tests/${id}/`),
  getFailed: () => api.get('/water-tests/failed/'),
  getBySource: (sourceId) => api.get(`/water-tests/?water_source=${sourceId}`), // ADD THIS LINE
};

// Fields API
export const fieldsAPI = {
  getAll: () => api.get('/fields/'),
  getById: (id) => api.get(`/fields/${id}/`),
  create: (data) => api.post('/fields/', data),
  update: (id, data) => api.put(`/fields/${id}/`, data),
  delete: (id) => api.delete(`/fields/${id}/`),
  getApplications: (id) => api.get(`/fields/${id}/applications/`),
};

// Products API
export const productsAPI = {
  getAll: () => api.get('/products/'),
  getByEPA: (epaNumber) => api.get(`/products/${epaNumber}/`),
  create: (data) => api.post('/products/', data),
  update: (epaNumber, data) => api.put(`/products/${epaNumber}/`, data),
  delete: (epaNumber) => api.delete(`/products/${epaNumber}/`),
};

// Applications API
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

export default api;

// Reports API (UPDATED with validation)
export const reportsAPI = {
  // Get report statistics
  getStatistics: (params) => 
    axios.get(`${API_BASE_URL}/reports/statistics/`, { params }),
  
  // Validate applications for PUR compliance
  validatePUR: (params) =>
    axios.get(`${API_BASE_URL}/applications/validate_pur/`, { params }),
  
  // Get PUR summary with validation
  getPURSummary: (params) =>
    axios.get(`${API_BASE_URL}/applications/pur_summary/`, { params }),
  
  // Export PUR report (supports multiple formats)
  exportPUR: async (params) => {
    const response = await axios.get(`${API_BASE_URL}/applications/export_pur/`, {
      params,
      responseType: 'blob'  // Important for file download
    });
    return response;
  },
  
  // Generate download URL for PUR export
  getPURExportURL: (params) => {
    const queryString = new URLSearchParams(params).toString();
    return `${API_BASE_URL}/applications/export_pur/?${queryString}`;
  }
};

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

// -----------------------------------------------------------------------------
// BUYERS API
// -----------------------------------------------------------------------------

export const buyersAPI = {
  getAll: (params = {}) => 
    axios.get(`${API_BASE_URL}/buyers/`, { params }),
  
  getSimpleList: () => 
    axios.get(`${API_BASE_URL}/buyers/`, { params: { simple: true, active: true } }),
  
  get: (id) => 
    axios.get(`${API_BASE_URL}/buyers/${id}/`),
  
  create: (data) => 
    axios.post(`${API_BASE_URL}/buyers/`, data),
  
  update: (id, data) => 
    axios.put(`${API_BASE_URL}/buyers/${id}/`, data),
  
  delete: (id) => 
    axios.delete(`${API_BASE_URL}/buyers/${id}/`),
  
  getLoadHistory: (id) => 
    axios.get(`${API_BASE_URL}/buyers/${id}/load_history/`),
};


// -----------------------------------------------------------------------------
// LABOR CONTRACTORS API
// -----------------------------------------------------------------------------

export const laborContractorsAPI = {
  getAll: (params = {}) => 
    axios.get(`${API_BASE_URL}/labor-contractors/`, { params }),
  
  getSimpleList: () => 
    axios.get(`${API_BASE_URL}/labor-contractors/`, { params: { simple: true, active: true } }),
  
  get: (id) => 
    axios.get(`${API_BASE_URL}/labor-contractors/${id}/`),
  
  create: (data) => 
    axios.post(`${API_BASE_URL}/labor-contractors/`, data),
  
  update: (id, data) => 
    axios.put(`${API_BASE_URL}/labor-contractors/${id}/`, data),
  
  delete: (id) => 
    axios.delete(`${API_BASE_URL}/labor-contractors/${id}/`),
  
  getJobHistory: (id) => 
    axios.get(`${API_BASE_URL}/labor-contractors/${id}/job_history/`),
  
  getExpiringSoon: () => 
    axios.get(`${API_BASE_URL}/labor-contractors/expiring_soon/`),
};


// -----------------------------------------------------------------------------
// HARVESTS API
// -----------------------------------------------------------------------------

export const harvestsAPI = {
  getAll: (params = {}) => 
    axios.get(`${API_BASE_URL}/harvests/`, { params }),
  
  get: (id) => 
    axios.get(`${API_BASE_URL}/harvests/${id}/`),
  
  create: (data) => 
    axios.post(`${API_BASE_URL}/harvests/`, data),
  
  update: (id, data) => 
    axios.put(`${API_BASE_URL}/harvests/${id}/`, data),
  
  delete: (id) => 
    axios.delete(`${API_BASE_URL}/harvests/${id}/`),
  
  // PHI checking before harvest
  checkPHI: (fieldId, proposedDate) => 
    axios.post(`${API_BASE_URL}/harvests/check_phi/`, {
      field_id: fieldId,
      proposed_harvest_date: proposedDate
    }),
  
  // Statistics
  getStatistics: (params = {}) => 
    axios.get(`${API_BASE_URL}/harvests/statistics/`, { params }),
  
  // Status updates
  markComplete: (id) => 
    axios.post(`${API_BASE_URL}/harvests/${id}/mark_complete/`),
  
  markVerified: (id) => 
    axios.post(`${API_BASE_URL}/harvests/${id}/mark_verified/`),
  
  // Grouped by field
  getByField: (params = {}) => 
    axios.get(`${API_BASE_URL}/harvests/by_field/`, { params }),
};


// -----------------------------------------------------------------------------
// HARVEST LOADS API
// -----------------------------------------------------------------------------

export const harvestLoadsAPI = {
  getAll: (params = {}) => 
    axios.get(`${API_BASE_URL}/harvest-loads/`, { params }),
  
  get: (id) => 
    axios.get(`${API_BASE_URL}/harvest-loads/${id}/`),
  
  create: (data) => 
    axios.post(`${API_BASE_URL}/harvest-loads/`, data),
  
  update: (id, data) => 
    axios.put(`${API_BASE_URL}/harvest-loads/${id}/`, data),
  
  delete: (id) => 
    axios.delete(`${API_BASE_URL}/harvest-loads/${id}/`),
  
  markPaid: (id, paymentDate = null) => 
    axios.post(`${API_BASE_URL}/harvest-loads/${id}/mark_paid/`, { 
      payment_date: paymentDate 
    }),
  
  getPendingPayments: () => 
    axios.get(`${API_BASE_URL}/harvest-loads/pending_payments/`),
};


// -----------------------------------------------------------------------------
// HARVEST LABOR API
// -----------------------------------------------------------------------------

export const harvestLaborAPI = {
  getAll: (params = {}) => 
    axios.get(`${API_BASE_URL}/harvest-labor/`, { params }),
  
  get: (id) => 
    axios.get(`${API_BASE_URL}/harvest-labor/${id}/`),
  
  create: (data) => 
    axios.post(`${API_BASE_URL}/harvest-labor/`, data),
  
  update: (id, data) => 
    axios.put(`${API_BASE_URL}/harvest-labor/${id}/`, data),
  
  delete: (id) => 
    axios.delete(`${API_BASE_URL}/harvest-labor/${id}/`),
  
  getCostAnalysis: (params = {}) => 
    axios.get(`${API_BASE_URL}/harvest-labor/cost_analysis/`, { params }),
};

// -----------------------------------------------------------------------------
// MAP API
// -----------------------------------------------------------------------------

export const mapAPI = {
  // Geocode an address to GPS coordinates
  geocode: (address) => 
    axios.post(`${API_BASE_URL}/geocode/`, { address }),
  
  // Update field boundary from drawn polygon
  updateFieldBoundary: (fieldId, boundaryGeojson, calculatedAcres) => 
    axios.post(`${API_BASE_URL}/fields/${fieldId}/boundary/`, {
      boundary_geojson: boundaryGeojson,
      calculated_acres: calculatedAcres
    }),
};

// -----------------------------------------------------------------------------
// CONSTANTS FOR DROPDOWNS
// -----------------------------------------------------------------------------

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
  
  // Default bin weights by crop type
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
