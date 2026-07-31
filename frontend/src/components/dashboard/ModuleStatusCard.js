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
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      icon: 'text-link',
      hover: 'hover:border-orange-200'
    },
    green: {
      bg: 'bg-primary-light',
      border: 'border-green-100',
      icon: 'text-primary',
      hover: 'hover:border-green-200'
    },
    amber: {
      bg: 'bg-yellow-100',
      border: 'border-yellow-200',
      icon: 'text-yellow-600',
      hover: 'hover:border-yellow-200'
    },
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-100',
      icon: 'text-orange-600',
      hover: 'hover:border-orange-200'
    },
    purple: {
      bg: 'bg-cream-100',
      border: 'border-sand-200',
      icon: 'text-bark-700',
      hover: 'hover:border-sand-200'
    },
    cyan: {
      bg: 'bg-green-50',
      border: 'border-green-100',
      icon: 'text-green-600',
      hover: 'hover:border-green-200'
    }
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-lg border border-border p-4
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
          <h3 className="font-semibold text-heading text-sm">{title}</h3>
        </div>
        <ArrowRight className="w-4 h-4 text-text-muted" />
      </div>

      {/* Alert banner if present */}
      {alert && (
        <div className={`
          mb-3 px-2 py-1.5 rounded text-xs font-medium
          ${alert.type === 'warning' ? 'bg-yellow-100 text-yellow-700' : ''}
          ${alert.type === 'critical' ? 'bg-danger-bg text-danger' : ''}
          ${alert.type === 'info' ? 'bg-orange-50 text-orange-700' : ''}
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
