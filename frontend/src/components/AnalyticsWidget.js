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
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    orange: 'text-orange-600 bg-orange-50',
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 truncate">{label}</div>
        <div className="text-lg font-bold text-gray-900">{value}</div>
        {subValue && (
          <div className="text-xs text-gray-500 flex items-center gap-1">
            {trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
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
            className="fill-green-400"
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            Analytics
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            Analytics
          </h3>
          <button
            onClick={loadData}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="text-center py-6 text-gray-500">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-400" />
            Analytics
          </h3>
        </div>
        <div className="text-center py-6 text-gray-500">
          <BarChart3 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No data available</p>
        </div>
      </div>
    );
  }

  const { financial, applications, harvests, water } = data;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-green-600" />
          Analytics
        </h3>
        <span className="text-xs text-gray-500">{data.period?.year}</span>
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
          <div className="text-xs text-gray-500 mb-1">Applications Trend</div>
          <MiniSparkline data={applications.by_month} />
        </div>
      )}

      {/* Compliance Indicators */}
      <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          {applications?.pur_compliance_rate >= 90 ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-orange-500" />
          )}
          <span className="text-xs text-gray-600">
            PUR {applications?.pur_compliance_rate || 0}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {water?.pass_rate >= 90 ? (
            <Droplet className="w-4 h-4 text-blue-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-orange-500" />
          )}
          <span className="text-xs text-gray-600">
            Water {water?.pass_rate || 100}%
          </span>
        </div>
      </div>

      {/* View Full Analytics Link */}
      {onViewAnalytics && (
        <button
          onClick={onViewAnalytics}
          className="w-full text-center text-sm text-green-600 hover:text-green-700 font-medium mt-3 pt-3 border-t border-gray-100"
        >
          View Full Analytics →
        </button>
      )}
    </div>
  );
}
