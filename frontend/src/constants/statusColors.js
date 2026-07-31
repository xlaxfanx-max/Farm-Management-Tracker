/**
 * Centralized status-to-color mappings used across the app.
 * Import from here instead of defining inline per-component.
 *
 * Finch badge style: a warm wash background with ink one or two steps darker.
 * Status never reads as colour alone — the label always carries the meaning.
 */

// Generic statuses (used by multiple modules)
export const STATUS_BADGE = {
  active:     'bg-success-bg text-green-700',
  inactive:   'bg-cream-100 text-bark-600',
  pending:    'bg-warning-bg text-yellow-600',
  completed:  'bg-success-bg text-green-700',
  failed:     'bg-danger-bg text-danger',
  draft:      'bg-orange-100 text-orange-700',
  overdue:    'bg-danger-bg text-danger',
  in_progress:'bg-orange-100 text-orange-700',
  standby:    'bg-warning-bg text-yellow-600',
  destroyed:  'bg-danger-bg text-danger',
  monitoring: 'bg-orange-100 text-orange-700',
  settled:    'bg-sand-200 text-bark-700',
};

// Water source types — water reads grove-green in the Finch palette
export const WATER_SOURCE_TYPE_BADGE = {
  well:      'bg-green-100 text-green-700 border-green-200',
  municipal: 'bg-orange-100 text-orange-700 border-orange-200',
  surface:   'bg-yellow-200 text-yellow-600 border-yellow-300',
  recycled:  'bg-green-50 text-green-600 border-green-200',
  other:     'bg-cream-100 text-bark-600 border-sand-200',
};

// Test results (water tests, compliance checks)
export const TEST_RESULT_BADGE = {
  pending: 'bg-warning-bg text-yellow-600 border-yellow-300',
  pass:    'bg-success-bg text-green-700 border-green-200',
  fail:    'bg-danger-bg text-danger border-red-200',
};

// Harvest status colors
export const HARVEST_STATUS_BADGE = {
  planned:   'bg-orange-100 text-orange-700',
  active:    'bg-success-bg text-green-700',
  completed: 'bg-warning-bg text-yellow-600',
  cancelled: 'bg-danger-bg text-danger',
};

// Helper: get badge class with fallback
export function getStatusBadge(status, colorMap = STATUS_BADGE, fallback = 'bg-cream-100 text-bark-600') {
  return colorMap[status] || fallback;
}
