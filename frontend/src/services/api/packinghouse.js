// =============================================================================
// PACKINGHOUSE POOL TRACKING APIs
// =============================================================================

import api, { createCRUDAPI } from './index';

// =============================================================================
// PACKINGHOUSES API
// =============================================================================

export const packinghousesAPI = {
  ...createCRUDAPI('packinghouses'),
  getPools: (id, params = {}) => api.get(`/packinghouses/${id}/pools/`, { params }),
  getLedger: (id, params = {}) => api.get(`/packinghouses/${id}/ledger/`, { params }),
};

export const poolsAPI = {
  ...createCRUDAPI('pools'),
  getDeliveries: (id, params = {}) => api.get(`/pools/${id}/deliveries/`, { params }),
  getPackoutReports: (id, params = {}) => api.get(`/pools/${id}/packout-reports/`, { params }),
  getSettlements: (id, params = {}) => api.get(`/pools/${id}/settlements/`, { params }),
  getSummary: (id) => api.get(`/pools/${id}/summary/`),
};

export const packinghouseDeliveriesAPI = {
  ...createCRUDAPI('packinghouse-deliveries'),
};

export const packoutReportsAPI = {
  ...createCRUDAPI('packout-reports'),
  addGradeLines: (id, gradeLines) => api.post(`/packout-reports/${id}/grade-lines/`, gradeLines),
};

export const poolSettlementsAPI = {
  ...createCRUDAPI('pool-settlements'),
  addGradeLines: (id, gradeLines) => api.post(`/pool-settlements/${id}/grade-lines/`, gradeLines),
  addDeductions: (id, deductions) => api.post(`/pool-settlements/${id}/deductions/`, deductions),
  audit: (id) => api.get(`/pool-settlements/${id}/audit/`),
};

export const growerLedgerAPI = {
  ...createCRUDAPI('grower-ledger'),
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
