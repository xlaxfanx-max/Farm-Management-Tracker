// =============================================================================
// AUTHENTICATION, COMPANY, ROLES, INVITATIONS, ONBOARDING APIs
// =============================================================================

import api, { API_BASE_URL } from './index';
import axios from 'axios';

// =============================================================================
// AUTHENTICATION API
// =============================================================================

export const authAPI = {
  // Register new user and company
  register: (data) =>
    axios.post(`${API_BASE_URL}/auth/register/`, data, { withCredentials: true }),

  // Login — backend sets HttpOnly cookies on the response
  login: (email, password) =>
    axios.post(`${API_BASE_URL}/auth/login/`, { email, password }, { withCredentials: true }),

  // Logout — backend clears HttpOnly cookies and blacklists refresh token
  logout: () =>
    api.post('/auth/logout/', {}),

  // Refresh token — backend reads refresh token from HttpOnly cookie
  refresh: () =>
    axios.post(`${API_BASE_URL}/auth/refresh/`, {}, { withCredentials: true }),

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
// COMPANY API
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
// REFERENCE DATA API
// =============================================================================

export const referenceAPI = {
  // Get California counties list
  getCaliforniaCounties: () => api.get('/reference/california-counties/'),

  // Get primary crop options
  getPrimaryCrops: () => api.get('/reference/primary-crops/'),
};

// =============================================================================
// ROLES API
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
// INVITATIONS API
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
// AUDIT LOG API
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
// ONBOARDING API
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
