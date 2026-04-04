// =============================================================================
// NUTRIENT MANAGEMENT APIs
// =============================================================================

import api, { createCRUDAPI } from './index';

// =============================================================================
// FERTILIZER PRODUCTS API
// =============================================================================

export const fertilizerProductsAPI = {
  ...createCRUDAPI('fertilizer-products'),
  search: (q) => api.get('/fertilizer-products/search/', { params: { q } }),
  seedCommon: () => api.post('/fertilizer-products/seed_common/'),
};

// =============================================================================
// NUTRIENT APPLICATIONS API
// =============================================================================

export const nutrientApplicationsAPI = {
  ...createCRUDAPI('nutrient-applications'),
  byField: (params = {}) => api.get('/nutrient-applications/by_field/', { params }),
  byProduct: (params = {}) => api.get('/nutrient-applications/by_product/', { params }),
  byMonth: (params = {}) => api.get('/nutrient-applications/by_month/', { params }),
};

// =============================================================================
// NUTRIENT PLANS API
// =============================================================================

export const nutrientPlansAPI = {
  ...createCRUDAPI('nutrient-plans'),
};

// =============================================================================
// NITROGEN REPORTS API
// =============================================================================

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
