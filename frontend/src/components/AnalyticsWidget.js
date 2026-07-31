import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Wheat,
  BarChart3,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Droplet,
} from 'lucide-react';
import { analyticsAPI } from '../services/api';

// Mini KPI Card component
const MiniKPI = ({ label, value, subValue, icon: Icon, trend, color = 'blue' }) => {
  const colorClasses = {
    blue: 'text-link bg-orange-50',
    green: 'text-primary bg-green-50',
    purple: 'text-bark-700 bg-cream-100',
    orange: 'text-orange-600 bg-orange-50',
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-secondary truncate">{label}</div>
        <div className="text-lg font-bold text-heading">{value}</div>
        {subValue && (
          <div className="text-xs text-text-secondary flex items-center gap-1">
            {trend === 'up' && <TrendingUp className="w-3 h-3 text-green-600" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3 text-danger" />}
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
};

// Mini sparkline for applications trend
const MiniSparkline = ({ data }) => {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data.map(d => d.count), 1);
  const width = 100;
  const height = 30;
  const barWidth = width / data.length - 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-8">
      {data.map((d, i) => {
        const barHeight = (d.count / max) * (height - 4);
        return (
          <rect
            key={d.month}
            x={i * (barWidth + 2) + 1}
            y={height - barHeight - 2}
            width={barWidth}
            height={barHeight}
            rx={1}
            className="fill-green-500"
          />
        );
      })}
    </svg>
  );
};

export default function AnalyticsWidget({ onViewAnalytics }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await analyticsAPI.getDashboard();
      setData(response.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatNumber = (value) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-surface-raised rounded-card shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-heading flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-text-muted" />
            Analytics
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-surface-raised rounded-card shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-heading flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-text-muted" />
            Analytics
          </h3>
          <button aria-label="Refresh"
            onClick={loadData}
            className="p-1.5 text-text-muted hover:text-bark-600 hover:bg-cream-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="text-center py-6 text-text-secondary">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 text-sand-300" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="bg-surface-raised rounded-card shadow-sm border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-heading flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-text-muted" />
            Analytics
          </h3>
        </div>
        <div className="text-center py-6 text-text-secondary">
          <BarChart3 className="w-10 h-10 mx-auto mb-2 text-sand-300" />
          <p className="text-sm">No data available</p>
        </div>
      </div>
    );
  }

  const { financial, applications, harvests, water } = data;

  return (
    <div className="bg-surface-raised rounded-card shadow-sm border border-border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg text-heading flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Analytics
        </h3>
        <span className="text-xs text-text-secondary">{data.period?.year}</span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <MiniKPI
          label="Revenue"
          value={formatCurrency(financial?.total_revenue || 0)}
          subValue={financial?.profit_margin > 0 ? `${financial.profit_margin}% margin` : null}
          icon={DollarSign}
          trend={financial?.profit_margin > 0 ? 'up' : null}
          color="green"
        />
        <MiniKPI
          label="Profit"
          value={formatCurrency(financial?.net_profit || 0)}
          icon={TrendingUp}
          color={financial?.net_profit >= 0 ? 'green' : 'orange'}
        />
        <MiniKPI
          label="Cost/Bin"
          value={`$${(financial?.cost_per_bin || 0).toFixed(2)}`}
          icon={Package}
          color="blue"
        />
        <MiniKPI
          label="Yield"
          value={`${(harvests?.yield_per_acre || 0).toFixed(1)}`}
          subValue="bins/acre"
          icon={Wheat}
          color="purple"
        />
      </div>

      {/* Applications Trend */}
      {applications?.by_month && applications.by_month.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-text-secondary mb-1">Applications Trend</div>
          <MiniSparkline data={applications.by_month} />
        </div>
      )}

      {/* Compliance Indicators */}
      <div className="flex items-center gap-4 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5">
          {applications?.pur_compliance_rate >= 90 ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-orange-500" />
          )}
          <span className="text-xs text-bark-600">
            PUR {applications?.pur_compliance_rate || 0}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {water?.pass_rate >= 90 ? (
            <Droplet className="w-4 h-4 text-orange-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-orange-500" />
          )}
          <span className="text-xs text-bark-600">
            Water {water?.pass_rate || 100}%
          </span>
        </div>
      </div>

      {/* View Full Analytics Link */}
      {onViewAnalytics && (
        <button
          onClick={onViewAnalytics}
          className="w-full text-center text-sm text-primary hover:text-primary-hover font-medium mt-3 pt-3 border-t border-border"
        >
          View Full Analytics →
        </button>
      )}
    </div>
  );
}
