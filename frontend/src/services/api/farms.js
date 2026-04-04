// =============================================================================
// FARMS, FIELDS, PARCELS, PRODUCTS, MAP, CROPS, ROOTSTOCKS APIs
// =============================================================================

import api, { createCRUDAPI } from './index';

// =============================================================================
// FARMS API
// =============================================================================

export const farmsAPI = {
  ...createCRUDAPI('farms'),
  getFields: (id) => api.get(`/farms/${id}/fields/`),
  bulkAddParcels: (farmId, parcels, replace = false) =>
    api.post(`/farms/${farmId}/bulk-parcels/`, { parcels, replace }),
  updateCoordinates: (id, lat, lng) =>
    api.post(`/farms/${id}/update-coordinates/`, { gps_latitude: lat, gps_longitude: lng }),
};

// =============================================================================
// FIELDS API
// =============================================================================

export const fieldsAPI = {
  ...createCRUDAPI('fields'),
  getApplications: (id) => api.get(`/fields/${id}/applications/`),
};

// =============================================================================
// PRODUCTS API
// =============================================================================

export const productsAPI = {
  ...createCRUDAPI('products'),
  getByEPA: (epaNumber) => api.get(`/products/${epaNumber}/`),
};

// =============================================================================
// FARM PARCELS API
// =============================================================================

export const farmParcelsAPI = {
  ...createCRUDAPI('farm-parcels'),
  getForFarm: (farmId) => api.get(`/farms/${farmId}/parcels/`),
  addToFarm: (farmId, data) => api.post(`/farms/${farmId}/parcels/`, data),
  bulkAdd: (farmId, parcels, replace = false) =>
    api.post(`/farms/${farmId}/bulk-parcels/`, { parcels, replace }),
};

// =============================================================================
// MAP API
// =============================================================================

export const mapAPI = {
  // Geocode an address to GPS coordinates
  // Accepts string or object { address, county, city }
  geocode: (addressOrParams) => {
    if (typeof addressOrParams === 'string') {
      return api.post('/geocode/', { address: addressOrParams });
    }
    return api.post('/geocode/', addressOrParams);
  },

  // Update field boundary from drawn polygon
  updateFieldBoundary: (fieldId, boundaryGeojson, calculatedAcres) =>
    api.post(`/fields/${fieldId}/boundary/`, {
      boundary_geojson: boundaryGeojson,
      calculated_acres: calculatedAcres
    }),

  // Update farm boundary from drawn polygon
  updateFarmBoundary: (farmId, boundaryGeojson, calculatedAcres) =>
    api.post(`/farms/${farmId}/boundary/`, {
      boundary_geojson: boundaryGeojson,
      calculated_acres: calculatedAcres
    }),

  // Auto-derive farm boundary from fields
  autoFarmBoundary: (farmId) =>
    api.post(`/farms/${farmId}/auto-boundary/`),
};

// =============================================================================
// CROP & ROOTSTOCK MANAGEMENT
// =============================================================================

export const cropsAPI = {
  ...createCRUDAPI('crops'),
  getCategories: () => api.get('/crops/categories/'),
  search: (q) => api.get('/crops/search/', { params: { q } }),
};

export const rootstocksAPI = {
  ...createCRUDAPI('rootstocks'),
  forCrop: (cropId) => api.get('/rootstocks/for_crop/', { params: { crop_id: cropId } }),
};

// =============================================================================
// QUARANTINE API
// =============================================================================

export const quarantineAPI = {
  // Check quarantine status for a farm
  checkFarm: (farmId, refresh = false) =>
    api.get('/quarantine/check/', {
      params: { farm_id: farmId, refresh: refresh ? 'true' : 'false' }
    }),

  // Check quarantine status for a field
  checkField: (fieldId, refresh = false) =>
    api.get('/quarantine/check/', {
      params: { field_id: fieldId, refresh: refresh ? 'true' : 'false' }
    }),

  // Get quarantine boundary GeoJSON for map overlay
  getBoundaries: (refresh = false) =>
    api.get('/quarantine/boundaries/', {
      params: { refresh: refresh ? 'true' : 'false' }
    }),
};

// Constants for Field agricultural data
export const FIELD_CONSTANTS = {
  ROW_ORIENTATIONS: [
    { value: 'ns', label: 'North-South' },
    { value: 'ew', label: 'East-West' },
    { value: 'ne_sw', label: 'Northeast-Southwest' },
    { value: 'nw_se', label: 'Northwest-Southeast' },
  ],

  TRELLIS_SYSTEMS: [
    { value: 'none', label: 'None' },
    { value: 'vertical_shoot', label: 'Vertical Shoot Position (VSP)' },
    { value: 'lyre', label: 'Lyre/U-Shape' },
    { value: 'geneva_double', label: 'Geneva Double Curtain' },
    { value: 'high_wire', label: 'High Wire' },
    { value: 'pergola', label: 'Pergola/Arbor' },
    { value: 'espalier', label: 'Espalier' },
    { value: 'stake', label: 'Stake' },
    { value: 'other', label: 'Other' },
  ],

  SOIL_TYPES: [
    { value: 'sandy', label: 'Sandy' },
    { value: 'sandy_loam', label: 'Sandy Loam' },
    { value: 'loam', label: 'Loam' },
    { value: 'clay_loam', label: 'Clay Loam' },
    { value: 'clay', label: 'Clay' },
    { value: 'silty_loam', label: 'Silty Loam' },
    { value: 'silty_clay', label: 'Silty Clay' },
  ],

  IRRIGATION_TYPES: [
    { value: 'drip', label: 'Drip' },
    { value: 'micro_sprinkler', label: 'Micro-Sprinkler' },
    { value: 'sprinkler', label: 'Sprinkler' },
    { value: 'flood', label: 'Flood' },
    { value: 'furrow', label: 'Furrow' },
    { value: 'none', label: 'None/Dryland' },
  ],

  ORGANIC_STATUSES: [
    { value: 'conventional', label: 'Conventional' },
    { value: 'transitional', label: 'Transitional' },
    { value: 'certified', label: 'Certified Organic' },
  ],
};
