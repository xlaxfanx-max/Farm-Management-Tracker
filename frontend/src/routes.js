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
  'harvests': '/dashboard/harvests',
  'rentals': '/dashboard/rentals',
  'rentals-rent-roll': '/dashboard/rentals/rent-roll',
  'compliance': '/dashboard/compliance',
  'compliance-deadlines': '/dashboard/compliance/deadlines',
  'compliance-licenses': '/dashboard/compliance/licenses',
  'compliance-wps': '/dashboard/compliance/wps',
  'compliance-reports': '/dashboard/compliance/reports',
  'compliance-settings': '/dashboard/compliance/settings',
  'compliance-pesticide': '/dashboard/compliance/pesticide',
  'compliance-inspector-checklist': '/dashboard/compliance/inspector-checklist',
  'applications': '/dashboard/applications',
  'pur-import': '/dashboard/pur-import',
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
  harvests: 'Harvest & Packing',
  rentals: 'Rental Income',
  'rentals-rent-roll': 'Rent Roll',
  compliance: 'Compliance',
  'compliance-deadlines': 'Deadlines',
  'compliance-licenses': 'Licenses',
  'compliance-wps': 'WPS Compliance',
  'compliance-reports': 'Reports',
  'compliance-settings': 'Settings',
  'compliance-pesticide': 'Pesticide',
  'compliance-inspector-checklist': 'Inspector Checklist',
  applications: 'Applications',
  'pur-import': 'PUR Import',
  reports: 'Reports',
  activity: 'Activity Log',
  team: 'Team',
  company: 'Company Settings',
  profile: 'Profile',
};

// Parent view mappings for breadcrumbs
export const PARENT_VIEWS = {
  'pur-import': 'applications',
  'rentals-rent-roll': 'rentals',
  'compliance-deadlines': 'compliance',
  'compliance-licenses': 'compliance',
  'compliance-wps': 'compliance',
  'compliance-reports': 'compliance',
  'compliance-settings': 'compliance',
  'compliance-pesticide': 'compliance',
  'compliance-inspector-checklist': 'compliance',
};
