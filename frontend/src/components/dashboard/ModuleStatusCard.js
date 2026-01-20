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
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      icon: 'text-blue-600',
      hover: 'hover:border-blue-200'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-100',
      icon: 'text-green-600',
      hover: 'hover:border-green-200'
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      icon: 'text-amber-600',
      hover: 'hover:border-amber-200'
    },
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-100',
      icon: 'text-orange-600',
      hover: 'hover:border-orange-200'
    },
    purple: {
      bg: 'bg-purple-50',
      border: 'border-purple-100',
      icon: 'text-purple-600',
      hover: 'hover:border-purple-200'
    },
    cyan: {
      bg: 'bg-cyan-50',
      border: 'border-cyan-100',
      icon: 'text-cyan-600',
      hover: 'hover:border-cyan-200'
    }
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-lg border border-gray-200 p-4
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
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400" />
      </div>

      {/* Alert banner if present */}
      {alert && (
        <div className={`
          mb-3 px-2 py-1.5 rounded text-xs font-medium
          ${alert.type === 'warning' ? 'bg-amber-50 text-amber-700' : ''}
          ${alert.type === 'critical' ? 'bg-red-50 text-red-700' : ''}
          ${alert.type === 'info' ? 'bg-blue-50 text-blue-700' : ''}
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
