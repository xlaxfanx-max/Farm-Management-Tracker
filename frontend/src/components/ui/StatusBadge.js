import React from 'react';

/**
 * Consistent status badge component for use across the application
 */
function StatusBadge({ status, size = 'sm', className = '' }) {
  const statusConfig = {
    // Health/Operational statuses
    healthy: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Healthy'
    },
    good: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Good'
    },
    attention: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      label: 'Needs Attention'
    },
    warning: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      label: 'Warning'
    },
    critical: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'Critical'
    },
    urgent: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'Urgent'
    },

    // Task statuses
    pending: {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      label: 'Pending'
    },
    pending_signature: {
      bg: 'bg-orange-100',
      text: 'text-orange-700',
      label: 'Pending Signature'
    },
    in_progress: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      label: 'In Progress'
    },
    complete: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Complete'
    },
    completed: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Completed'
    },
    submitted: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      label: 'Submitted'
    },

    // Priority levels
    high: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'High'
    },
    medium: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      label: 'Medium'
    },
    low: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      label: 'Low'
    },

    // General statuses
    active: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Active'
    },
    inactive: {
      bg: 'bg-gray-100',
      text: 'text-gray-600',
      label: 'Inactive'
    },
    overdue: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'Overdue'
    },
    due_soon: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      label: 'Due Soon'
    },

    // Default
    default: {
      bg: 'bg-gray-100',
      text: 'text-gray-600',
      label: 'Unknown'
    }
  };

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-sm'
  };

  const config = statusConfig[status] || statusConfig.default;
  const sizeClass = sizeClasses[size] || sizeClasses.sm;

  return (
    <span
      className={`${config.bg} ${config.text} ${sizeClass} font-medium rounded-full inline-flex items-center ${className}`}
    >
      {config.label}
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
