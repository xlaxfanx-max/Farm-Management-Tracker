// =============================================================================
// APPLICATIONS, PUR/TANK MIX, UNIFIED PRODUCTS, APPLICATORS, PUR IMPORT APIs
// =============================================================================

import api, { createCRUDAPI, API_BASE_URL } from './index';

// =============================================================================
// APPLICATIONS API
// =============================================================================

export const applicationsAPI = {
  ...createCRUDAPI('applications'),
  getPending: () => api.get('/applications/pending/'),
  getReadyForPUR: () => api.get('/applications/ready_for_pur/'),
  markComplete: (id) => api.post(`/applications/${id}/mark_complete/`),
  markSubmitted: (id) => api.post(`/applications/${id}/mark_submitted/`),
};

// =============================================================================
// PUR / TANK MIX API
// =============================================================================

export const applicationEventsAPI = {
  ...createCRUDAPI('application-events'),
  validatePUR: (data) => api.post('/application-events/validate_pur/', data),
  purSummary: (data) => api.post('/application-events/pur_summary/', data),
  exportPURCSV: (data) => api.post('/application-events/export_pur_csv/', data, {
    responseType: 'blob',
  }),
  checkRotation: (data) => api.post('/application-events/check-rotation/', data),
};

export const unifiedProductsAPI = {
  ...createCRUDAPI('unified-products'),
  search: (params) => api.get('/unified-products/search/', { params }),
};

export const applicatorsAPI = {
  ...createCRUDAPI('applicators'),
};

export const purImportAPI = {
  upload: (formData) => api.post('/pur-import/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }),
  confirm: (data) => api.post('/pur-import/confirm/', data),
  matchProducts: (params) => api.get('/pur-import/match-products/', { params }),
  matchFarms: (params) => api.get('/pur-import/match-farms/', { params }),
  getBatches: () => api.get('/pur-import/batches/'),
  getBatchDetail: (batchId) => api.get(`/pur-import/batches/${batchId}/`),
  getBatchPdf: (batchId) => api.get(`/pur-import/batches/${batchId}/pdf/`, {
    responseType: 'blob',
  }),
};

// =============================================================================
// REPORTS API
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
