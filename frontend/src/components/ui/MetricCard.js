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
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'border-blue-100'
    },
    green: {
      bg: 'bg-green-50',
      text: 'text-green-600',
      border: 'border-green-100'
    },
    orange: {
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      border: 'border-orange-100'
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-100'
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'border-purple-100'
    },
    red: {
      bg: 'bg-red-50',
      text: 'text-red-600',
      border: 'border-red-100'
    },
    gray: {
      bg: 'bg-gray-50',
      text: 'text-gray-600',
      border: 'border-gray-100'
    }
  };

  const colors = colorClasses[color] || colorClasses.blue;
  const isClickable = !!onClick;

  return (
    <div
      className={`
        bg-white rounded-lg border border-gray-200 p-5
        ${isClickable ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600 mb-1 truncate">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 truncate">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center mt-2 text-sm">
              {trendDirection === 'up' ? (
                <TrendingUp className="w-4 h-4 text-green-500 mr-1 flex-shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500 mr-1 flex-shrink-0" />
              )}
              <span className={`font-medium ${trendDirection === 'up' ? 'text-green-600' : 'text-red-600'}`}>
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
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center text-sm text-gray-500 hover:text-gray-700">
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
    blue: 'text-blue-600',
    green: 'text-green-600',
    orange: 'text-orange-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    gray: 'text-gray-600'
  };

  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon className={`w-4 h-4 ${colorClasses[color]}`} />}
      <span className="text-sm text-gray-600">{label}:</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
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
    default: 'bg-gray-400'
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dotColors[color]}`} />
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-semibold text-gray-700">{value}</span>
    </div>
  );
}

export default MetricCard;
