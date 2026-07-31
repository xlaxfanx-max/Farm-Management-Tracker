// =============================================================================
// SHARED REUSABLE COMPONENTS FOR WATER MANAGEMENT
// =============================================================================

import React from 'react';
import {
  AlertTriangle, CheckCircle, AlertCircle, Activity,
  TrendingUp, ArrowUpRight
} from 'lucide-react';

// =============================================================================
// METRIC CARD
// =============================================================================

export const MetricCard = ({ title, value, subtitle, icon: Icon, trend, color = 'blue', onClick }) => {
  const colorClasses = {
    blue: 'bg-orange-500',
    cyan: 'bg-green-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-500',
    red: 'bg-danger',
    purple: 'bg-bark-500',
  };

  return (
    <div
      className={`relative overflow-hidden bg-surface-raised rounded-card shadow-sm border border-border p-5 hover:shadow-md transition-all ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-text-secondary">{title}</p>
          <p className="text-2xl font-bold text-heading mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-text-muted mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${trend > 0 ? 'text-primary' : 'text-danger'}`}>
              <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
              <span>{Math.abs(trend)}% vs last month</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-card ${colorClasses[color]} shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 ${colorClasses[color]}`} />
    </div>
  );
};

// =============================================================================
// ALERT BANNER
// =============================================================================

export const AlertBanner = ({ type, title, message, action, onAction }) => {
  const config = {
    error: { bg: 'bg-danger-bg', border: 'border-danger/25', icon: AlertTriangle, iconColor: 'text-danger', textColor: 'text-danger' },
    warning: { bg: 'bg-yellow-100', border: 'border-yellow-200', icon: AlertCircle, iconColor: 'text-yellow-500', textColor: 'text-yellow-800' },
    info: { bg: 'bg-orange-50', border: 'border-orange-200', icon: Activity, iconColor: 'text-orange-500', textColor: 'text-orange-700' },
    success: { bg: 'bg-primary-light', border: 'border-green-200', icon: CheckCircle, iconColor: 'text-green-600', textColor: 'text-green-700' },
  };

  const { bg, border, icon: Icon, iconColor, textColor } = config[type] || config.info;

  return (
    <div className={`${bg} ${border} border rounded-xl p-4 flex items-start gap-3`}>
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

export const QuickActionButton = ({ icon: Icon, label, onClick, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-primary hover:bg-primary-hover',
    cyan: 'bg-green-600 hover:bg-green-700',
    green: 'bg-primary hover:bg-primary-hover',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 ${colorClasses[color]} text-white rounded-card text-sm font-medium transition-colors shadow-sm`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
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
