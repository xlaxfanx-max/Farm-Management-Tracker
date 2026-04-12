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
  'well': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  'municipal': 'bg-blue-100 text-blue-700 border-blue-200',
  'surface': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'recycled': 'bg-purple-100 text-purple-700 border-purple-200',
  'other': 'bg-gray-100 text-gray-700 border-gray-200'
};

export const STATUS_COLORS = {
  'active': 'bg-green-100 text-green-800',
  'inactive': 'bg-gray-100 text-gray-800',
  'standby': 'bg-yellow-100 text-yellow-800',
  'destroyed': 'bg-red-100 text-red-800',
  'monitoring': 'bg-blue-100 text-blue-800'
};

export const TEST_STATUS_CONFIG = {
  'pending': { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  'pass': { label: 'Pass', color: 'bg-green-100 text-green-800 border-green-200' },
  'fail': { label: 'Fail', color: 'bg-red-100 text-red-800 border-red-200' },
};
