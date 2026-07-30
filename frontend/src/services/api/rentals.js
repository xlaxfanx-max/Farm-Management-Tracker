// =============================================================================
// RENTALS API
// =============================================================================
// On-ranch houses and off-ranch investment property. Rental income sits
// alongside a ranch but never inside a farming margin — see the note on
// getRanchSummary below, which is the query-level half of that boundary.
// =============================================================================

import api, { createCRUDAPI } from './index';

export const rentalPropertiesAPI = createCRUDAPI('rentals/properties');
export const rentalUnitsAPI = createCRUDAPI('rentals/units');
export const rentalLeasesAPI = createCRUDAPI('rentals/leases');
export const rentalCategoriesAPI = createCRUDAPI('rentals/categories');
export const rentalLedgerAPI = createCRUDAPI('rentals/ledger');

export const rentalSummaryAPI = {
  /**
   * Portfolio rent roll. Counts units and their active leases — never occupant
   * rows. The May 2026 workbook overstates by 36% by summing 31 occupants
   * against 19 units, which is why unit_count and occupied_count come back as
   * separate fields rather than one number.
   */
  getRentRoll: (params = {}) => api.get('/rentals/rent-roll/', { params }),

  /**
   * Rental income for one ranch. The response deliberately carries no acreage
   * field, so a per-acre rental figure cannot be computed client-side.
   * Do not "helpfully" join this with ranch acres.
   */
  getRanchSummary: (farmId, params = {}) =>
    api.get(`/farms/${farmId}/rental-summary/`, { params }),
};

export const RENTAL_CONSTANTS = {
  LOCATION_TYPES: [
    { value: 'on_ranch', label: 'On-ranch' },
    { value: 'off_ranch', label: 'Off-ranch' },
  ],
  PROPERTY_TYPES: [
    { value: 'dwelling', label: 'Dwelling' },
    { value: 'commercial', label: 'Commercial' },
    { value: 'yard', label: 'Yard / barn' },
    { value: 'land', label: 'Land lease' },
    { value: 'other', label: 'Other' },
  ],
  // Why a figure is the grain it is — rendered as a badge so an annual P&L
  // number is never mistaken for a monthly one.
  GRAIN_LABELS: {
    annual: {
      label: 'Annual',
      hint: 'Booked once a year from the ranch P&L. No monthly detail exists.',
    },
    monthly: {
      label: 'Monthly',
      hint: 'From the property manager statement.',
    },
    mixed: {
      label: 'Mixed grain',
      hint: 'Both annual and monthly rows are present. They are shown separately, never summed into one blended figure.',
    },
  },
};
