// =============================================================================
// HARVESTS, HARVEST LOADS, HARVEST LABOR, BUYERS, LABOR CONTRACTORS APIs
// =============================================================================

import api, { createCRUDAPI } from './index';

// =============================================================================
// BUYERS API
// =============================================================================

export const buyersAPI = {
  ...createCRUDAPI('buyers'),
  getSimpleList: () => api.get('/buyers/', { params: { simple: true, active: true } }),
  getLoadHistory: (id) => api.get(`/buyers/${id}/load_history/`),
  getPerformance: (id) => api.get(`/buyers/${id}/performance/`),
};

// =============================================================================
// LABOR CONTRACTORS API
// =============================================================================

export const laborContractorsAPI = {
  ...createCRUDAPI('labor-contractors'),
  getSimpleList: () => api.get('/labor-contractors/', { params: { simple: true, active: true } }),
  getJobHistory: (id) => api.get(`/labor-contractors/${id}/job_history/`),
  getExpiringSoon: () => api.get('/labor-contractors/expiring_soon/'),
  getPerformance: (id) => api.get(`/labor-contractors/${id}/performance/`),
};

// =============================================================================
// HARVESTS API
// =============================================================================

export const harvestsAPI = {
  ...createCRUDAPI('harvests'),
  checkPHI: (fieldId, proposedDate) =>
    api.post('/harvests/check_phi/', { field_id: fieldId, proposed_harvest_date: proposedDate }),
  getStatistics: (params = {}) => api.get('/harvests/statistics/', { params }),
  markComplete: (id) => api.post(`/harvests/${id}/mark_complete/`),
  markVerified: (id) => api.post(`/harvests/${id}/mark_verified/`),
  getByField: (params = {}) => api.get('/harvests/by_field/', { params }),
  getCostAnalysis: (params = {}) => api.get('/harvests/cost_analysis/', { params }),
};

// =============================================================================
// HARVEST LOADS API
// =============================================================================

export const harvestLoadsAPI = {
  ...createCRUDAPI('harvest-loads'),
  markPaid: (id, paymentDate = null) =>
    api.post(`/harvest-loads/${id}/mark_paid/`, { payment_date: paymentDate }),
  getPendingPayments: () => api.get('/harvest-loads/pending_payments/'),
};

// =============================================================================
// HARVEST LABOR API
// =============================================================================

export const harvestLaborAPI = {
  ...createCRUDAPI('harvest-labor'),
  getCostAnalysis: (params = {}) => api.get('/harvest-labor/cost_analysis/', { params }),
};

// =============================================================================
// CROP REPORTS API — ranch-crop level P&L cards
// =============================================================================

export const cropReportsAPI = {
  list: (params = {}) => api.get('/crop-reports/', { params }),
  detail: (params = {}) => api.get('/crop-reports/detail/', { params }),
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
// CONSTANTS FOR HARVESTS
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

// Helper: get unit label for a crop variety
export const getUnitLabelForCropVariety = (cropVariety) => {
  const isWeightBased = HARVEST_CONSTANTS.WEIGHT_BASED_VARIETIES.includes(cropVariety);
  return {
    unit: isWeightBased ? 'LBS' : 'BIN',
    labelPlural: isWeightBased ? 'Lbs' : 'Bins',
    labelSingular: isWeightBased ? 'Lb' : 'Bin',
  };
};
