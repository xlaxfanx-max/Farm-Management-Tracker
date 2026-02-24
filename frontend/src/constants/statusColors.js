/**
 * Centralized status-to-color mappings used across the app.
 * Import from here instead of defining inline per-component.
 *
 * Tailwind classes — badge style: bg-{color}-100 text-{color}-800
 */

// Generic statuses (used by multiple modules)
export const STATUS_BADGE = {
  active:     'bg-green-100 text-green-800',
  inactive:   'bg-gray-100 text-gray-800',
  pending:    'bg-yellow-100 text-yellow-800',
  completed:  'bg-green-100 text-green-800',
  failed:     'bg-red-100 text-red-800',
  draft:      'bg-blue-100 text-blue-800',
  overdue:    'bg-red-100 text-red-800',
  in_progress:'bg-blue-100 text-blue-800',
  standby:    'bg-yellow-100 text-yellow-800',
  destroyed:  'bg-red-100 text-red-800',
  monitoring: 'bg-blue-100 text-blue-800',
  settled:    'bg-purple-100 text-purple-800',
};

// Water source types
export const WATER_SOURCE_TYPE_BADGE = {
  well:      'bg-cyan-100 text-cyan-700 border-cyan-200',
  municipal: 'bg-blue-100 text-blue-700 border-blue-200',
  surface:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  recycled:  'bg-purple-100 text-purple-700 border-purple-200',
  other:     'bg-gray-100 text-gray-700 border-gray-200',
};

// Test results (water tests, compliance checks)
export const TEST_RESULT_BADGE = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  pass:    'bg-green-100 text-green-800 border-green-200',
  fail:    'bg-red-100 text-red-800 border-red-200',
};

// Harvest status colors
export const HARVEST_STATUS_BADGE = {
  planned:   'bg-blue-100 text-blue-800',
  active:    'bg-green-100 text-green-800',
  completed: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-800',
};

// Helper: get badge class with fallback
export function getStatusBadge(status, colorMap = STATUS_BADGE, fallback = 'bg-gray-100 text-gray-800') {
  return colorMap[status] || fallback;
}
