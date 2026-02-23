// =============================================================================
// SHARED ANALYTICS COMPONENTS & UTILITIES
// =============================================================================
// Consistent building blocks used across all analytics views

import React from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import MetricCard from '../ui/MetricCard';

// =============================================================================
// FORMATTING UTILITIES
// =============================================================================

/**
 * Format a number as currency. Uses Intl.NumberFormat for precision.
 * @param {number} value
 * @param {object} options - { compact: true } for abbreviated (K/M) display
 */
export const formatCurrency = (value, options = {}) => {
  if (value === null || value === undefined) return '-';
  if (options.compact) {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Format a number with locale-aware separators.
 */
export const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Format a percentage value with sign.
 */
export const formatPercent = (value) => {
  if (value === null || value === undefined) return '-';
  return `${value >= 0 ? '+' : ''}${Number(value).toFixed(1)}%`;
};

// =============================================================================
// ANALYTICS CARD (KPI Card)
// =============================================================================

// AnalyticsCard now wraps the shared MetricCard for dark mode and consistency
export const AnalyticsCard = ({ title, value, subtitle, icon, trend, trendValue, color = 'blue', onClick, className = '' }) => (
  <MetricCard
    title={title}
    value={value}
    subtitle={subtitle}
    icon={icon}
    trend={trendValue}
    trendDirection={trend}
    color={color}
    onClick={onClick}
    className={className}
  />
);

// =============================================================================
// LOADING STATE
// =============================================================================

export const LoadingState = ({ message = 'Loading analytics...' }) => (
  <div className="flex items-center justify-center py-16">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto"></div>
      <p className="mt-4 text-gray-500">{message}</p>
    </div>
  </div>
);

// =============================================================================
// ERROR STATE
// =============================================================================

export const ErrorState = ({ message = 'Failed to load analytics data', onRetry }) => (
  <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
    <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
    <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Analytics</h3>
    <p className="text-red-600">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Try Again
      </button>
    )}
  </div>
);

// =============================================================================
// EMPTY STATE
// =============================================================================

export const EmptyState = ({ message = 'No data available', subtitle }) => (
  <div className="py-12 text-center">
    <p className="text-gray-500">{message}</p>
    {subtitle && <p className="text-sm text-gray-400 mt-2">{subtitle}</p>}
  </div>
);

// =============================================================================
// VARIANCE / CHANGE INDICATOR
// =============================================================================

export const VarianceIndicator = ({ value, format = 'percent' }) => {
  if (value === null || value === undefined) {
    return <Minus className="w-4 h-4 text-gray-400" />;
  }
  const isPositive = value > 0;
  const isNegative = value < 0;
  const colorClass = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500';
  const Icon = isPositive ? ArrowUpRight : isNegative ? ArrowDownRight : Minus;

  let displayValue;
  if (format === 'currency') {
    displayValue = formatCurrency(value);
  } else if (format === 'number') {
    displayValue = `${isPositive ? '+' : ''}${formatNumber(value, 1)}`;
  } else {
    displayValue = `${isPositive ? '+' : ''}${Number(value).toFixed(1)}%`;
  }

  return (
    <span className={`inline-flex items-center gap-0.5 ${colorClass}`}>
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{displayValue}</span>
    </span>
  );
};

// =============================================================================
// SECTION CARD (wraps a chart or table section)
// =============================================================================

export const SectionCard = ({ title, subtitle, icon: Icon, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
    {(title || subtitle) && (
      <div className="p-5 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-green-600" />}
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    )}
    {children}
  </div>
);

// =============================================================================
// ANALYTICS TABS (underline style)
// =============================================================================

export const AnalyticsTabs = ({ tabs, activeTab, onChange, accentColor = 'green' }) => {
  const activeColorMap = {
    green: 'border-green-600 text-green-600',
    orange: 'border-orange-600 text-orange-600',
    blue: 'border-blue-600 text-blue-600',
  };

  return (
    <div className="flex border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === tab.id
              ? activeColorMap[accentColor] || activeColorMap.green
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          {tab.icon && (
            <span className="inline-flex items-center gap-2">
              <tab.icon size={16} />
              {tab.label}
            </span>
          )}
          {!tab.icon && tab.label}
        </button>
      ))}
    </div>
  );
};

// =============================================================================
// TABLE HELPERS
// =============================================================================

/**
 * Consistent table header class
 */
export const tableHeaderClass = 'px-4 py-3 text-xs font-medium text-gray-500 uppercase';

/**
 * Consistent table cell class
 */
export const tableCellClass = 'px-4 py-3 text-sm';

/**
 * Margin badge (colored based on threshold)
 */
export const MarginBadge = ({ value }) => {
  if (value === null || value === undefined) return <span className="text-gray-400">-</span>;
  const badgeClass =
    value >= 50 ? 'bg-green-100 text-green-800' :
    value >= 30 ? 'bg-blue-100 text-blue-800' :
    value >= 10 ? 'bg-yellow-100 text-yellow-800' :
    'bg-red-100 text-red-800';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>
      {value}%
    </span>
  );
};
