// =============================================================================
// FSMA RULE 204 TRACEABILITY API
// =============================================================================

import api from './index';

export const traceabilityAPI = {
  // Lots
  getLots: (params = {}) => api.get('/fsma/traceability-lots/', { params }),
  getLot: (id) => api.get(`/fsma/traceability-lots/${id}/`),
  createLot: (data) => api.post('/fsma/traceability-lots/', data),
  updateLot: (id, data) => api.patch(`/fsma/traceability-lots/${id}/`, data),
  deleteLot: (id) => api.delete(`/fsma/traceability-lots/${id}/`),
  createFromHarvest: (data) =>
    api.post('/fsma/traceability-lots/create-from-harvest/', data),
  getFullTrace: (id) => api.get(`/fsma/traceability-lots/${id}/full-trace/`),
  getDashboard: () => api.get('/fsma/traceability-lots/dashboard/'),
  getUnlinkedHarvests: () => api.get('/fsma/traceability-lots/unlinked-harvests/'),

  // Events (CTEs)
  getEvents: (params = {}) => api.get('/fsma/traceability-events/', { params }),
  getEvent: (id) => api.get(`/fsma/traceability-events/${id}/`),
  createEvent: (data) => api.post('/fsma/traceability-events/', data),
  updateEvent: (id, data) => api.patch(`/fsma/traceability-events/${id}/`, data),
  deleteEvent: (id) => api.delete(`/fsma/traceability-events/${id}/`),

  // Dispositions
  getDispositions: (params = {}) => api.get('/fsma/lot-dispositions/', { params }),
  createDisposition: (data) => api.post('/fsma/lot-dispositions/', data),
  updateDisposition: (id, data) => api.patch(`/fsma/lot-dispositions/${id}/`, data),
  deleteDisposition: (id) => api.delete(`/fsma/lot-dispositions/${id}/`),

  // Incidents
  getIncidents: (params = {}) => api.get('/fsma/contamination-incidents/', { params }),
  getIncident: (id) => api.get(`/fsma/contamination-incidents/${id}/`),
  createIncident: (data) => api.post('/fsma/contamination-incidents/', data),
  updateIncident: (id, data) => api.patch(`/fsma/contamination-incidents/${id}/`, data),

  // Corrective Actions
  getCorrectiveActions: (params = {}) =>
    api.get('/fsma/incident-corrective-actions/', { params }),
  createCorrectiveAction: (data) =>
    api.post('/fsma/incident-corrective-actions/', data),
  updateCorrectiveAction: (id, data) =>
    api.patch(`/fsma/incident-corrective-actions/${id}/`, data),
};
