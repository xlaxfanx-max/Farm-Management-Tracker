import React from 'react';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

// Only the icon chip is tinted — the figure itself is always bark ink.
const chipColors = {
  orange: 'bg-orange-50 text-orange-600 border-orange-100',
  green: 'bg-green-50 text-green-600 border-green-100',
  warning: 'bg-warning-bg text-yellow-600 border-yellow-300',
  danger: 'bg-danger-bg text-danger border-danger/25',
  neutral: 'bg-surface-sunken text-bark-500 border-border',
};

// Legacy `color` values map onto the sanctioned chip tints.
const legacyChip = {
  blue: 'orange',
  purple: 'neutral',
  gray: 'neutral',
  amber: 'warning',
  red: 'danger',
  green: 'green',
  orange: 'orange',
};

/**
 * Finch StatCard — uppercase tracked label, serif figure, mono delta.
 * Exported as both `MetricCard` (legacy name) and `StatCard`.
 */
function MetricCard({
  title,
  label,
  value,
  unit,
  subtitle,
  caption,
  icon: Icon,
  trend,
  trendDirection = 'up',
  color = 'orange',
  onClick,
  className = '',
}) {
  const chip = chipColors[color] || chipColors[legacyChip[color]] || chipColors.orange;
  const isClickable = !!onClick;
  const heading = label ?? title;
  const foot = caption ?? subtitle;

  return (
    <div
      className={`
        bg-surface-raised rounded-card border border-border p-5
        ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-border-strong transition-all' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-caps text-text-secondary mb-2 truncate">
            {heading}
          </p>
          <p className="font-display text-3xl text-heading leading-none">
            {value}
            {unit && <span className="ml-1.5 font-mono text-base text-text-secondary">{unit}</span>}
          </p>
          {foot && <p className="mt-2 text-sm text-text-secondary truncate">{foot}</p>}
          {trend && (
            <div className="flex items-center mt-2.5 text-sm">
              {trendDirection === 'up' ? (
                <TrendingUp className="w-4 h-4 text-success mr-1 flex-shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 text-danger mr-1 flex-shrink-0" />
              )}
              <span
                className={`font-mono tabular-nums font-medium ${
                  trendDirection === 'up' ? 'text-success' : 'text-danger'
                }`}
              >
                {trend}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`rounded-button border w-[30px] h-[30px] flex items-center justify-center flex-shrink-0 ${chip}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      {isClickable && (
        <div className="mt-3 pt-3 border-t border-border flex items-center text-sm text-text-secondary hover:text-text">
          <span>View details</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      )}
    </div>
  );
}

/**
 * Compact metric display for use in grids or lists
 */
export function CompactMetric({ label, value, icon: Icon, color = 'neutral' }) {
  const colorClasses = {
    green: 'text-green-600',
    orange: 'text-orange-600',
    warning: 'text-yellow-600',
    danger: 'text-danger',
    neutral: 'text-text-secondary',
    // legacy
    blue: 'text-orange-600',
    amber: 'text-yellow-600',
    red: 'text-danger',
    gray: 'text-text-secondary',
  };

  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className={`w-4 h-4 ${colorClasses[color] || colorClasses.neutral}`} />}
      <span className="text-sm text-text-secondary">{label}:</span>
      <span className="text-sm font-mono tabular-nums font-semibold text-text">{value}</span>
    </div>
  );
}

/**
 * Mini metric for dashboard strips
 */
export function MiniMetric({ label, value, color = 'default' }) {
  const dotColors = {
    green: 'bg-success',
    amber: 'bg-warning',
    warning: 'bg-warning',
    red: 'bg-danger',
    danger: 'bg-danger',
    blue: 'bg-orange-500',
    orange: 'bg-orange-500',
    default: 'bg-bark-400',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dotColors[color] || dotColors.default}`} />
      <span className="text-xs text-text-secondary">{label}</span>
      <span className="text-xs font-mono tabular-nums font-semibold text-bark-700">{value}</span>
    </div>
  );
}

export const StatCard = MetricCard;

export default MetricCard;
