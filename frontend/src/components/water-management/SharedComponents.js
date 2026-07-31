// =============================================================================
// SHARED REUSABLE COMPONENTS FOR WATER MANAGEMENT
// =============================================================================

import React from 'react';
import Button from '../ui/Button';
import {
  AlertTriangle, CheckCircle, AlertCircle, Activity,
  TrendingUp, ArrowUpRight
} from 'lucide-react';

// =============================================================================
// METRIC CARD
// =============================================================================

export const MetricCard = ({ title, value, subtitle, icon: Icon, trend, color = 'blue', onClick }) => {
  // Only the icon chip carries the tint; the figure is always bark ink.
  const chipClasses = {
    blue: 'bg-orange-50 text-orange-600 border-orange-100',
    cyan: 'bg-green-50 text-green-600 border-green-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    yellow: 'bg-warning-bg text-yellow-600 border-yellow-300',
    red: 'bg-danger-bg text-danger border-danger/25',
    purple: 'bg-surface-sunken text-bark-500 border-border',
  };

  return (
    <div
      className={`bg-surface-raised rounded-card shadow-sm border border-border p-5 transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:border-border-strong' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-caps text-text-secondary mb-2 leading-tight">{title}</p>
          <p className="font-display text-2xl xl:text-3xl text-heading leading-tight">{value}</p>
          {subtitle && (
            <p className="text-sm text-text-secondary mt-2">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2.5 text-sm font-mono tabular-nums ${trend > 0 ? 'text-success' : 'text-danger'}`}>
              <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
              <span>{Math.abs(trend)}% vs last month</span>
            </div>
          )}
        </div>
        <div className={`w-[30px] h-[30px] flex items-center justify-center rounded-button border flex-shrink-0 ${chipClasses[color] || chipClasses.blue}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// ALERT BANNER
// =============================================================================

export const AlertBanner = ({ type, title, message, action, onAction }) => {
  const config = {
    error: { bg: 'bg-danger-bg', border: 'border-danger/25', icon: AlertTriangle, iconColor: 'text-danger', textColor: 'text-danger' },
    warning: { bg: 'bg-warning-bg', border: 'border-yellow-300', icon: AlertCircle, iconColor: 'text-yellow-600', textColor: 'text-yellow-700' },
    info: { bg: 'bg-green-50', border: 'border-green-200', icon: Activity, iconColor: 'text-info', textColor: 'text-green-700' },
    success: { bg: 'bg-success-bg', border: 'border-green-200', icon: CheckCircle, iconColor: 'text-success', textColor: 'text-green-700' },
  };

  const { bg, border, icon: Icon, iconColor, textColor } = config[type] || config.info;

  return (
    <div className={`${bg} ${border} border rounded-card p-4 flex items-start gap-3`}>
      <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${textColor}`}>{title}</p>
        {message && <p className={`text-sm ${textColor} opacity-80 mt-0.5`}>{message}</p>}
      </div>
      {action && (
        <button
          onClick={onAction}
          className={`text-sm font-medium ${textColor} hover:underline flex items-center gap-1`}
        >
          {action}
          <ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

// =============================================================================
// QUICK ACTION BUTTON
// =============================================================================

export const QuickActionButton = ({ icon: Icon, label, onClick, color = 'blue', variant }) => {
  // Actions in a row read as one set — the lead action is the orange primary,
  // the rest are neutral outlines. Colour here never encodes meaning.
  const resolved = variant || (color === 'blue' ? 'primary' : 'secondary');
  return (
    <Button variant={resolved} size="md" icon={Icon} onClick={onClick}>
      {label}
    </Button>
  );
};

// =============================================================================
// HELPERS
// =============================================================================

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

export const formatNumber = (num, decimals = 1) => {
  if (num === null || num === undefined) return '-';
  return Number(num).toFixed(decimals);
};
