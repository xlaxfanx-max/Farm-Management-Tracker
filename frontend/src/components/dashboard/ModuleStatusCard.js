import React from 'react';
import { ArrowRight } from 'lucide-react';
import { MiniMetric } from '../ui/MetricCard';

/**
 * Module status card for dashboard - shows summary of each module with click to navigate
 */
function ModuleStatusCard({
  title,
  icon: Icon,
  metrics = [],
  color = 'blue',
  onClick,
  alert,
  className = ''
}) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/30',
      border: 'border-blue-100 dark:border-blue-800',
      icon: 'text-blue-600 dark:text-blue-400',
      hover: 'hover:border-blue-200 dark:hover:border-blue-700'
    },
    green: {
      bg: 'bg-primary-light dark:bg-green-900/30',
      border: 'border-green-100 dark:border-green-800',
      icon: 'text-primary dark:text-green-400',
      hover: 'hover:border-green-200 dark:hover:border-green-700'
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/30',
      border: 'border-amber-100 dark:border-amber-800',
      icon: 'text-amber-600 dark:text-amber-400',
      hover: 'hover:border-amber-200 dark:hover:border-amber-700'
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-900/30',
      border: 'border-orange-100 dark:border-orange-800',
      icon: 'text-orange-600 dark:text-orange-400',
      hover: 'hover:border-orange-200 dark:hover:border-orange-700'
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-900/30',
      border: 'border-purple-100 dark:border-purple-800',
      icon: 'text-purple-600 dark:text-purple-400',
      hover: 'hover:border-purple-200 dark:hover:border-purple-700'
    },
    cyan: {
      bg: 'bg-cyan-50 dark:bg-cyan-900/30',
      border: 'border-cyan-100 dark:border-cyan-800',
      icon: 'text-cyan-600 dark:text-cyan-400',
      hover: 'hover:border-cyan-200 dark:hover:border-cyan-700'
    }
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4
        cursor-pointer transition-all
        hover:shadow-md ${colors.hover}
        ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${colors.bg} ${colors.border} border`}>
            <Icon className={`w-4 h-4 ${colors.icon}`} />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400" />
      </div>

      {/* Alert banner if present */}
      {alert && (
        <div className={`
          mb-3 px-2 py-1.5 rounded text-xs font-medium
          ${alert.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : ''}
          ${alert.type === 'critical' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400' : ''}
          ${alert.type === 'info' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : ''}
        `}>
          {alert.message}
        </div>
      )}

      {/* Metrics */}
      <div className="space-y-1.5">
        {metrics.map((metric, index) => (
          <MiniMetric
            key={index}
            label={metric.label}
            value={metric.value}
            color={metric.color}
          />
        ))}
      </div>
    </div>
  );
}

export default ModuleStatusCard;
