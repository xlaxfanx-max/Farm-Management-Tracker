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
    blue: 'from-blue-500 to-blue-600',
    cyan: 'from-cyan-500 to-cyan-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-amber-600',
    red: 'from-red-500 to-red-600',
    purple: 'from-purple-500 to-purple-600',
  };

  return (
    <div
      className={`relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition-all ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs ${trend > 0 ? 'text-primary' : 'text-red-600'}`}>
              <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
              <span>{Math.abs(trend)}% vs last month</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${colorClasses[color]} opacity-60`} />
    </div>
  );
};

// =============================================================================
// ALERT BANNER
// =============================================================================

export const AlertBanner = ({ type, title, message, action, onAction }) => {
  const config = {
    error: { bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800', icon: AlertTriangle, iconColor: 'text-red-500 dark:text-red-400', textColor: 'text-red-800 dark:text-red-200' },
    warning: { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800', icon: AlertCircle, iconColor: 'text-amber-500 dark:text-amber-400', textColor: 'text-amber-800 dark:text-amber-200' },
    info: { bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800', icon: Activity, iconColor: 'text-blue-500 dark:text-blue-400', textColor: 'text-blue-800 dark:text-blue-200' },
    success: { bg: 'bg-primary-light dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800', icon: CheckCircle, iconColor: 'text-green-500 dark:text-green-400', textColor: 'text-green-800 dark:text-green-200' },
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
    blue: 'bg-blue-600 hover:bg-blue-700',
    cyan: 'bg-cyan-600 hover:bg-cyan-700',
    green: 'bg-primary hover:bg-primary-hover',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 ${colorClasses[color]} text-white rounded-lg text-sm font-medium transition-colors shadow-sm`}
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
