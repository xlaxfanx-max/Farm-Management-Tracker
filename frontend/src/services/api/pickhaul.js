// =============================================================================
// PICK & HAUL API
// =============================================================================
// Contractor invoices vs. packinghouse charge-backs. Receipts and house
// charges are pushed from the local pipeline and are read-only here; invoices
// and manual picks are entered on the platform.
// =============================================================================

import api, { createCRUDAPI } from './index';

export const pickHaulInvoicesAPI = {
  ...createCRUDAPI('pickhaul/invoices'),
  getContractors: () => api.get('/pickhaul/invoices/contractors/'),
  addLink: (invoiceId, receiptId) =>
    api.post(`/pickhaul/invoices/${invoiceId}/links/`, { receipt: receiptId }),
  removeLink: (invoiceId, receiptId) =>
    api.delete(`/pickhaul/invoices/${invoiceId}/links/${receiptId}/`),
};

export const pickHaulManualPicksAPI = {
  ...createCRUDAPI('pickhaul/manual-picks'),
  getSourceSheets: () => api.get('/pickhaul/manual-picks/source_sheets/'),
};

export const pickHaulReceiptsAPI = {
  getAll: (params = {}) => api.get('/pickhaul/receipts/', { params }),
  getBlocks: (params = {}) => api.get('/pickhaul/receipts/blocks/', { params }),
};

export const pickHaulChargesAPI = {
  getAll: (params = {}) => api.get('/pickhaul/house-charges/', { params }),
};

export const pickHaulEntitiesAPI = {
  getAll: () => api.get('/pickhaul/entities/'),
};

export const pickHaulStatusAPI = {
  getSummary: (params = {}) => api.get('/pickhaul/summary/aging/', { params }),
  getChecks: (params = {}) => api.get('/pickhaul/checks/', { params }),
  getSyncStatus: (params = {}) => api.get('/pickhaul/sync-status/', { params }),
  getSyncBatches: (params = {}) => api.get('/pickhaul/sync-batches/', { params }),
  // The season's real deliveries: receipts + manual picks with allocated costs.
  getHarvestActivity: (params = {}) => api.get('/pickhaul/harvest-activity/', { params }),
};

export const PICKHAUL_CONSTANTS = {
  KINDS: [
    { value: 'PICK', label: 'Pick' },
    { value: 'HAUL', label: 'Haul' },
  ],
  // Plain-English explanations for the matcher's methods, shown in detail views.
  MATCH_METHODS: {
    exact: {
      label: 'Exact',
      color: 'green',
      explanation: 'One house charge row equals this invoice to the penny.',
    },
    reference: {
      label: 'Reference',
      color: 'blue',
      explanation: "All charge rows under one AP reference sum to this invoice.",
    },
    block: {
      label: 'Block',
      color: 'blue',
      explanation: "One AP reference's rows for this block sum to this invoice.",
    },
    subset: {
      label: 'Subset',
      color: 'blue',
      explanation: "Some of one AP reference's rows sum to this invoice.",
    },
    'reference+combined': {
      label: 'Reference (pick+haul)',
      color: 'blue',
      explanation:
        'The house posted pick and haul separately under one AP reference; together they equal this invoice.',
    },
    'block+combined': {
      label: 'Block (pick+haul)',
      color: 'blue',
      explanation:
        "Pick and haul rows for this block under one AP reference sum to this invoice.",
    },
    'subset+combined': {
      label: 'Subset (pick+haul)',
      color: 'blue',
      explanation:
        "Some pick and haul rows under one AP reference sum to this invoice.",
    },
    unmatched: {
      label: 'Unmatched',
      color: 'gray',
      explanation: 'No house charge accounts for this invoice yet.',
    },
  },
  AGING_BUCKETS: [
    { key: '0_30', label: '0–30 days', color: 'gray' },
    { key: '31_60', label: '31–60 days', color: 'amber' },
    { key: '61_90', label: '61–90 days', color: 'orange' },
    { key: '90_plus', label: '90+ days', color: 'red' },
  ],
};
