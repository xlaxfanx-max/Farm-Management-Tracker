import React from 'react';

/**
 * Consistent status badge component for use across the application.
 *
 * @param {string} status - Status key used to look up colors and default label.
 * @param {string} [label] - Override the default label text for this status.
 * @param {string} [colorScheme] - Override color scheme: 'green', 'red', 'amber', 'blue', 'orange', 'gray', 'purple', 'yellow'.
 * @param {string} [size='sm'] - Badge size: 'xs', 'sm', 'md', or 'lg'.
 * @param {string} [className] - Additional CSS classes.
 */
function StatusBadge({ status, label, colorScheme, size = 'sm', className = '' }) {
  const statusConfig = {
    // Health/Operational statuses
    healthy: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      label: 'Healthy'
    },
    good: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      label: 'Good'
    },
    attention: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      label: 'Needs Attention'
    },
    warning: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      label: 'Warning'
    },
    critical: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-300',
      label: 'Critical'
    },
    urgent: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-300',
      label: 'Urgent'
    },

    // Task statuses
    pending: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-700 dark:text-orange-300',
      label: 'Pending'
    },
    pending_signature: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-700 dark:text-orange-300',
      label: 'Pending Signature'
    },
    in_progress: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-300',
      label: 'In Progress'
    },
    complete: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      label: 'Complete'
    },
    completed: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      label: 'Completed'
    },
    submitted: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-300',
      label: 'Submitted'
    },

    // Priority levels
    high: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-300',
      label: 'High'
    },
    medium: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      label: 'Medium'
    },
    low: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-300',
      label: 'Low'
    },

    // General statuses
    active: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-300',
      label: 'Active'
    },
    inactive: {
      bg: 'bg-gray-100 dark:bg-gray-700',
      text: 'text-gray-600 dark:text-gray-300',
      label: 'Inactive'
    },
    overdue: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-300',
      label: 'Overdue'
    },
    due_soon: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-300',
      label: 'Due Soon'
    },

    // Default
    default: {
      bg: 'bg-gray-100 dark:bg-gray-700',
      text: 'text-gray-600 dark:text-gray-300',
      label: 'Unknown'
    }
  };

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-sm'
  };

  const colorSchemes = {
    green:  { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
    red:    { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
    amber:  { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
    blue:   { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
    gray:   { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
    yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
  };

  const config = statusConfig[status] || statusConfig.default;
  const colors = colorScheme ? (colorSchemes[colorScheme] || config) : config;
  const sizeClass = sizeClasses[size] || sizeClasses.sm;
  const displayLabel = label || config.label;

  return (
    <span
      className={`${colors.bg} ${colors.text} ${sizeClass} font-medium rounded-full inline-flex items-center ${className}`}
    >
      {displayLabel}
    </span>
  );
}

/**
 * Dot indicator for compact status display
 */
export function StatusDot({ status, size = 'md', className = '' }) {
  const statusColors = {
    healthy: 'bg-green-500',
    good: 'bg-green-500',
    attention: 'bg-amber-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
    urgent: 'bg-red-500',
    pending: 'bg-orange-500',
    active: 'bg-green-500',
    inactive: 'bg-gray-400',
    default: 'bg-gray-400'
  };

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  };

  const color = statusColors[status] || statusColors.default;
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <span
      className={`${color} ${sizeClass} rounded-full inline-block ${className}`}
      title={status}
    />
  );
}

export default StatusBadge;
