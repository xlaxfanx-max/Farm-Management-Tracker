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