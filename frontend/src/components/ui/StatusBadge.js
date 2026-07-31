import React from 'react';
import Badge from './Badge';

/**
 * Consistent status badge for use across the application.
 * Routes every status through a Finch Badge tone — status is never colour-only,
 * the label always carries the meaning.
 *
 * @param {string} status - Status key used to look up tone and default label.
 * @param {string} [label] - Override the default label text for this status.
 * @param {string} [colorScheme] - Override tone: 'green', 'red', 'amber', 'blue', 'orange', 'gray', 'purple', 'yellow'.
 * @param {string} [size='sm'] - Badge size: 'xs', 'sm', 'md', or 'lg'.
 * @param {string} [className] - Additional CSS classes.
 */
const statusConfig = {
  // Health / operational
  healthy:           { tone: 'success', label: 'Healthy' },
  good:              { tone: 'success', label: 'Good' },
  attention:         { tone: 'warning', label: 'Needs attention' },
  warning:           { tone: 'warning', label: 'Warning' },
  critical:          { tone: 'danger',  label: 'Critical' },
  urgent:            { tone: 'danger',  label: 'Urgent' },

  // Task statuses
  pending:           { tone: 'warning', label: 'Pending' },
  pending_signature: { tone: 'warning', label: 'Pending signature' },
  in_progress:       { tone: 'orange',  label: 'In progress' },
  draft:             { tone: 'orange',  label: 'Draft' },
  complete:          { tone: 'success', label: 'Complete' },
  completed:         { tone: 'success', label: 'Completed' },
  submitted:         { tone: 'orange',  label: 'Submitted' },

  // Priority levels
  high:              { tone: 'danger',  label: 'High' },
  medium:            { tone: 'warning', label: 'Medium' },
  low:               { tone: 'neutral', label: 'Low' },

  // General
  active:            { tone: 'success', label: 'Active' },
  inactive:          { tone: 'neutral', label: 'Inactive' },
  settled:           { tone: 'neutral', label: 'Settled' },
  overdue:           { tone: 'danger',  label: 'Overdue' },
  failed:            { tone: 'danger',  label: 'Failed' },
  due_soon:          { tone: 'warning', label: 'Due soon' },

  default:           { tone: 'neutral', label: 'Unknown' },
};

// Legacy colorScheme names → Finch tones.
const schemeToTone = {
  green: 'success',
  red: 'danger',
  amber: 'warning',
  yellow: 'warning',
  blue: 'orange',
  orange: 'orange',
  gray: 'neutral',
  purple: 'neutral',
};

const sizeToBadgeSize = { xs: 'xs', sm: 'sm', md: 'md', lg: 'md' };

function StatusBadge({ status, label, colorScheme, size = 'sm', className = '' }) {
  const config = statusConfig[status] || statusConfig.default;
  const tone = colorScheme ? (schemeToTone[colorScheme] || config.tone) : config.tone;

  return (
    <Badge
      tone={tone}
      size={sizeToBadgeSize[size] || 'sm'}
      className={`${size === 'lg' ? 'px-3 py-1.5' : ''} ${className}`}
    >
      {label || config.label}
    </Badge>
  );
}

/**
 * Dot indicator for compact status display
 */
export function StatusDot({ status, size = 'md', className = '' }) {
  const statusColors = {
    healthy: 'bg-success',
    good: 'bg-success',
    active: 'bg-success',
    complete: 'bg-success',
    completed: 'bg-success',
    attention: 'bg-warning',
    warning: 'bg-warning',
    pending: 'bg-warning',
    due_soon: 'bg-warning',
    critical: 'bg-danger',
    urgent: 'bg-danger',
    overdue: 'bg-danger',
    failed: 'bg-danger',
    in_progress: 'bg-orange-500',
    draft: 'bg-orange-500',
    submitted: 'bg-orange-500',
    inactive: 'bg-bark-400',
    default: 'bg-bark-400',
  };

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
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
