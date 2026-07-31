// =============================================================================
// WATER MANAGEMENT CONSTANTS
// =============================================================================

export const GSA_NAMES = {
  'obgma': 'Ojai Basin GMA',
  'uwcd': 'United Water Conservation District',
  'fpbgsa': 'Fillmore & Piru Basins GSA',
  'uvrga': 'Upper Ventura River GA',
  'fcgma': 'Fox Canyon GMA',
  'other': 'Other',
  'none': 'None'
};

export const BASIN_NAMES = {
  'ojai_valley': 'Ojai Valley',
  'fillmore': 'Fillmore',
  'piru': 'Piru',
  'upper_ventura_river': 'Upper Ventura River',
  'santa_paula': 'Santa Paula',
  'other': 'Other'
};

export const SOURCE_TYPE_LABELS = {
  'well': 'Well',
  'municipal': 'Municipal/Public',
  'surface': 'Surface Water',
  'recycled': 'Recycled Water',
  'other': 'Other'
};

export const SOURCE_TYPE_COLORS = {
  'well': 'bg-green-100 text-green-700 border-green-200',
  'municipal': 'bg-orange-100 text-orange-700 border-orange-200',
  'surface': 'bg-green-100 text-green-700 border-green-200',
  'recycled': 'bg-sand-200 text-bark-700 border-sand-200',
  'other': 'bg-cream-100 text-bark-700 border-border'
};

export const STATUS_COLORS = {
  'active': 'bg-green-100 text-green-700',
  'inactive': 'bg-cream-100 text-text',
  'standby': 'bg-yellow-100 text-yellow-800',
  'destroyed': 'bg-danger-bg text-danger',
  'monitoring': 'bg-orange-100 text-orange-700'
};

export const TEST_STATUS_CONFIG = {
  'pending': { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'pass': { label: 'Pass', color: 'bg-green-100 text-green-700 border-green-200' },
  'fail': { label: 'Fail', color: 'bg-danger-bg text-danger border-danger/25' },
};
