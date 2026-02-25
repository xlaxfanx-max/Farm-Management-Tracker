import React from 'react';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

/**
 * Reusable metric card for displaying KPIs and statistics
 */
function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendDirection = 'up',
  color = 'blue',
  onClick,
  className = ''
}) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/30',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-100 dark:border-blue-800'
    },
    green: {
      bg: 'bg-primary-light dark:bg-green-900/30',
      text: 'text-primary dark:text-green-400',
      border: 'border-green-100 dark:border-green-800'
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-900/30',
      text: 'text-orange-600 dark:text-orange-400',
      border: 'border-orange-100 dark:border-orange-800'
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/30',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-100 dark:border-amber-800'
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-900/30',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-100 dark:border-purple-800'
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/30',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-100 dark:border-red-800'
    },
    gray: {
      bg: 'bg-gray-50 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-100 dark:border-gray-700'
    }
  };

  const colors = colorClasses[color] || colorClasses.blue;
  const isClickable = !!onClick;

  return (
    <div
      className={`
        bg-surface-raised dark:bg-gray-800 rounded-card border border-border dark:border-gray-700 p-5
        ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-border-strong dark:hover:border-gray-600 transition-all' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1 truncate">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center mt-2 text-sm">
              {trendDirection === 'up' ? (
                <TrendingUp className="w-4 h-4 text-green-500 mr-1 flex-shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500 mr-1 flex-shrink-0" />
              )}
              <span className={`font-medium ${trendDirection === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {trend}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`rounded-lg p-3 ${colors.bg} ${colors.text} ${colors.border} border flex-shrink-0 ml-3`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {isClickable && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
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
export function CompactMetric({ label, value, icon: Icon, color = 'gray' }) {
  const colorClasses = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-primary dark:text-green-400',
    orange: 'text-orange-600 dark:text-orange-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    gray: 'text-gray-600 dark:text-gray-400'
  };

  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className={`w-4 h-4 ${colorClasses[color]}`} />}
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}:</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

/**
 * Mini metric for dashboard strips
 */
export function MiniMetric({ label, value, color = 'default' }) {
  const dotColors = {
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    default: 'bg-gray-400 dark:bg-gray-500'
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dotColors[color]}`} />
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{value}</span>
    </div>
  );
}

export default MetricCard;
