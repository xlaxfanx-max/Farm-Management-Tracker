// =============================================================================
// GROVE MASTER API SERVICE - Shared Infrastructure & Re-exports
// =============================================================================
// This file contains the axios instance, interceptors, and CRUD helpers.
// All domain-specific APIs are in their own files and re-exported here
// so that `import { farmsAPI } from '../services/api'` still works.
// =============================================================================

import axios from 'axios';

// Use environment variable in production, fallback to localhost for development
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

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

// ---------------------------------------------------------------------------
// Auth session expiry event — AuthContext listens for this to clear state
// and redirect via React Router instead of a hard window.location redirect.
// ---------------------------------------------------------------------------
export const AUTH_SESSION_EXPIRED_EVENT = 'auth:session-expired';

function emitSessionExpired() {
  window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
}

// ---------------------------------------------------------------------------
// Refresh mutex — ensures only one refresh request runs at a time.
// Concurrent 401s queue behind the first refresh attempt.
// ---------------------------------------------------------------------------
let refreshPromise = null;

function refreshAccessToken() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = axios.post(
    `${API_BASE_URL}/auth/refresh/`,
    {},  // Backend reads refresh token from HttpOnly cookie
    { withCredentials: true }
  ).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

// Request interceptor — cookies are sent automatically via withCredentials,
// no need to manually attach Authorization headers.
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        await refreshAccessToken();
        // Cookies are updated by the backend response — just retry
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — notify AuthContext to clear state & redirect
        emitSessionExpired();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// =============================================================================
// CRUD API FACTORY
// =============================================================================
// Generates standard getAll/get/getById/create/update/delete methods for a
// given endpoint prefix. Spread the result and add custom methods per API.
//
//   export const foosAPI = {
//     ...createCRUDAPI('foos'),
//     myCustomAction: (id) => api.post(`/foos/${id}/custom/`),
//   };
// =============================================================================

export function createCRUDAPI(endpoint) {
  const base = `/${endpoint}/`;
  return {
    getAll: (params = {}) => api.get(base, { params }),
    get: (id) => api.get(`${base}${id}/`),
    getById: (id) => api.get(`${base}${id}/`),
    create: (data) => api.post(base, data),
    update: (id, data) => api.put(`${base}${id}/`, data),
    patch: (id, data) => api.patch(`${base}${id}/`, data),
    delete: (id) => api.delete(`${base}${id}/`),
  };
}

// Variant for endpoints that accept FormData (file uploads).
// Uses multipart/form-data header when data is FormData, JSON otherwise.
export function createCRUDAPIWithFiles(endpoint) {
  const base = `/${endpoint}/`;
  const maybeFile = (method, url, data) => {
    if (data instanceof FormData) {
      return api[method](url, data, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api[method](url, data);
  };
  return {
    getAll: (params = {}) => api.get(base, { params }),
    get: (id) => api.get(`${base}${id}/`),
    getById: (id) => api.get(`${base}${id}/`),
    create: (data) => maybeFile('post', base, data),
    update: (id, data) => maybeFile('put', `${base}${id}/`, data),
    patch: (id, data) => maybeFile('patch', `${base}${id}/`, data),
    delete: (id) => api.delete(`${base}${id}/`),
  };
}

// =============================================================================
// HELPER FUNCTIONS
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
// RE-EXPORT ALL DOMAIN APIs
// =============================================================================
// This ensures backward compatibility: `import { farmsAPI } from '../services/api'`
// continues to work exactly as before.
// =============================================================================

export * from './auth';
export * from './farms';
export * from './applications';
export * from './harvest';
export * from './water';
export * from './nutrients';
export * from './compliance';
export * from './disease';
export * from './packinghouse';
export * from './fsma';
export * from './traceability';
export * from './primusgfs';
export * from './other';

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default api;
