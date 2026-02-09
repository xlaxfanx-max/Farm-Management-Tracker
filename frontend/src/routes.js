/**
 * Centralized route configuration
 * Maps view IDs (used internally) to URL paths and metadata
 */

// View ID -> URL path mapping
export const VIEW_TO_PATH = {
  'dashboard': '/dashboard',
  'farms': '/dashboard/farms',
  'weather': '/dashboard/weather',
  'analytics': '/dashboard/analytics',
  'water': '/dashboard/water',
  'nutrients': '/dashboard/nutrients',
  'harvests': '/dashboard/harvests',
  'yield-forecast': '/dashboard/yield-forecast',
  'compliance': '/dashboard/compliance',
  'compliance-deadlines': '/dashboard/compliance/deadlines',
  'compliance-licenses': '/dashboard/compliance/licenses',
  'compliance-wps': '/dashboard/compliance/wps',
  'compliance-reports': '/dashboard/compliance/reports',
  'compliance-settings': '/dashboard/compliance/settings',
  'compliance-fsma': '/dashboard/compliance/fsma',
  'compliance-fsma-visitors': '/dashboard/compliance/fsma/visitors',
  'compliance-fsma-cleaning': '/dashboard/compliance/fsma/cleaning',
  'compliance-fsma-meetings': '/dashboard/compliance/fsma/meetings',
  'compliance-fsma-inventory': '/dashboard/compliance/fsma/inventory',
  'compliance-fsma-phi': '/dashboard/compliance/fsma/phi',
  'compliance-fsma-audit': '/dashboard/compliance/fsma/audit',
  'compliance-pesticide': '/dashboard/compliance/pesticide',
  'disease': '/dashboard/disease',
  'reports': '/dashboard/reports',
  'activity': '/dashboard/activity',
  'team': '/dashboard/team',
  'company': '/dashboard/company',
  'profile': '/dashboard/profile',
};

// Reverse mapping: URL path -> view ID
export const PATH_TO_VIEW = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([viewId, path]) => [path, viewId])
);

// Display names for breadcrumbs and page titles
export const VIEW_NAMES = {
  dashboard: 'Dashboard',
  farms: 'Farms & Fields',
  weather: 'Weather',
  analytics: 'Analytics',
  water: 'Water Management',
  nutrients: 'Nutrients',
  harvests: 'Harvest & Packing',
  'yield-forecast': 'Yield Forecast',
  compliance: 'Compliance',
  'compliance-deadlines': 'Deadlines',
  'compliance-licenses': 'Licenses',
  'compliance-wps': 'WPS Compliance',
  'compliance-reports': 'Reports',
  'compliance-settings': 'Settings',
  'compliance-fsma': 'FSMA',
  'compliance-fsma-visitors': 'Visitors',
  'compliance-fsma-cleaning': 'Cleaning',
  'compliance-fsma-meetings': 'Meetings',
  'compliance-fsma-inventory': 'Inventory',
  'compliance-fsma-phi': 'PHI',
  'compliance-fsma-audit': 'Audit',
  'compliance-pesticide': 'Pesticide',
  disease: 'Disease Prevention',
  reports: 'Reports',
  activity: 'Activity Log',
  team: 'Team',
  company: 'Company Settings',
  profile: 'Profile',
};

// Parent view mappings for breadcrumbs
export const PARENT_VIEWS = {
  'compliance-deadlines': 'compliance',
  'compliance-licenses': 'compliance',
  'compliance-wps': 'compliance',
  'compliance-reports': 'compliance',
  'compliance-settings': 'compliance',
  'compliance-fsma': 'compliance',
  'compliance-fsma-visitors': 'compliance-fsma',
  'compliance-fsma-cleaning': 'compliance-fsma',
  'compliance-fsma-meetings': 'compliance-fsma',
  'compliance-fsma-inventory': 'compliance-fsma',
  'compliance-fsma-phi': 'compliance-fsma',
  'compliance-fsma-audit': 'compliance-fsma',
  'compliance-pesticide': 'compliance',
};
