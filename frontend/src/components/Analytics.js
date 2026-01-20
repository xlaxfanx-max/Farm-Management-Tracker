import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Wheat,
  Droplets,
  FileText,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  Calendar,
  Users,
  Target,
  Award,
} from 'lucide-react';
import { analyticsAPI, farmsAPI } from '../services/api';

// =============================================================================
// KPI CARD COMPONENT
// =============================================================================

const KPICard = ({ title, value, subtitle, icon: Icon, trend, trendValue, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && trendValue && (
            <div className="flex items-center gap-1 mt-2">
              {trend === 'up' ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {trendValue}
              </span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// SIMPLE BAR CHART COMPONENT
// =============================================================================

const BarChart = ({ data, title, valueKey = 'count', labelKey = 'month', height = 200 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-40 text-gray-400">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const barWidth = 100 / data.length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div style={{ height: `${height}px` }} className="relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-xs text-gray-400">
          <span>{maxValue}</span>
          <span>{Math.round(maxValue / 2)}</span>
          <span>0</span>
        </div>

        {/* Chart area */}
        <div className="ml-10 h-full flex items-end gap-1">
          {data.map((item, index) => {
            const barHeight = ((item[valueKey] || 0) / maxValue) * 100;
            return (
              <div
                key={index}
                className="flex-1 flex flex-col items-center"
                style={{ maxWidth: `${barWidth}%` }}
              >
                <div
                  className="w-full bg-green-500 rounded-t hover:bg-green-600 transition-colors cursor-pointer"
                  style={{ height: `${Math.max(barHeight, 2)}%` }}
                  title={`${item[labelKey]}: ${item[valueKey]}`}
                />
                <span className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                  {item[labelKey]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// DONUT CHART COMPONENT
// =============================================================================

const DonutChart = ({ data, title, valueKey = 'revenue', labelKey = 'crop' }) => {
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-40 text-gray-400">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + (item[valueKey] || 0), 0);
  let currentAngle = 0;

  const formatCurrency = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="relative w-40 h-40 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            {data.map((item, index) => {
              const percentage = total > 0 ? (item[valueKey] || 0) / total : 0;
              const angle = percentage * 360;
              const startAngle = currentAngle;
              currentAngle += angle;

              // Calculate arc path
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = ((startAngle + angle) * Math.PI) / 180;
              const x1 = 50 + 40 * Math.cos(startRad);
              const y1 = 50 + 40 * Math.sin(startRad);
              const x2 = 50 + 40 * Math.cos(endRad);
              const y2 = 50 + 40 * Math.sin(endRad);
              const largeArc = angle > 180 ? 1 : 0;

              if (percentage === 0) return null;

              return (
                <path
                  key={index}
                  d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                  fill={colors[index % colors.length]}
                  stroke="white"
                  strokeWidth="1"
                />
              );
            })}
            {/* Center hole */}
            <circle cx="50" cy="50" r="25" fill="white" />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-gray-500">Total</span>
            <span className="text-lg font-bold text-gray-900">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {data.slice(0, 5).map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="text-sm text-gray-600 truncate flex-1">{item[labelKey]}</span>
              <span className="text-sm font-medium text-gray-900">
                {formatCurrency(item[valueKey])}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// HORIZONTAL BAR CHART (FIELD PERFORMANCE)
// =============================================================================

const HorizontalBarChart = ({ data, title }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-40 text-gray-400">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const maxProfit = Math.max(...data.map(d => Math.abs(d.profit || 0)), 1);

  const formatCurrency = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {data.slice(0, 8).map((field, index) => {
          const width = (Math.abs(field.profit) / maxProfit) * 100;
          const isPositive = field.profit >= 0;

          return (
            <div key={index} className="flex items-center gap-3">
              <div className="w-24 text-sm text-gray-600 truncate" title={field.name}>
                {field.name}
              </div>
              <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all ${
                    isPositive ? 'bg-green-500' : 'bg-red-400'
                  }`}
                  style={{ width: `${Math.max(width, 5)}%` }}
                />
              </div>
              <div className={`w-20 text-sm font-medium text-right ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(field.profit)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// =============================================================================
// CONTRACTOR TABLE
// =============================================================================

const ContractorTable = ({ contractors }) => {
  if (!contractors || contractors.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-400" />
          Contractor Performance
        </h3>
        <div className="text-center py-6 text-gray-400">
          <p>No contractor data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-gray-400" />
        Contractor Performance
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200">
              <th className="pb-3 font-medium text-gray-500">Contractor</th>
              <th className="pb-3 font-medium text-gray-500 text-right">Bins</th>
              <th className="pb-3 font-medium text-gray-500 text-right">Cost</th>
              <th className="pb-3 font-medium text-gray-500 text-right">$/Bin</th>
              <th className="pb-3 font-medium text-gray-500 text-right">Bins/Hr</th>
            </tr>
          </thead>
          <tbody>
            {contractors.map((c, index) => (
              <tr key={index} className="border-b border-gray-100 last:border-0">
                <td className="py-3 font-medium text-gray-900">{c.name}</td>
                <td className="py-3 text-right text-gray-600">{c.bins.toLocaleString()}</td>
                <td className="py-3 text-right text-gray-600">${c.cost.toLocaleString()}</td>
                <td className="py-3 text-right font-medium text-gray-900">${c.cost_per_bin.toFixed(2)}</td>
                <td className="py-3 text-right text-gray-600">{c.bins_per_hour.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =============================================================================
// INSIGHTS PANEL
// =============================================================================

const InsightsPanel = ({ topPerformers, needsAttention }) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-gray-400" />
        Insights
      </h3>

      {/* Top Performers */}
      {topPerformers && topPerformers.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-green-500" />
            Top Performing Fields
          </h4>
          <div className="space-y-2">
            {topPerformers.slice(0, 3).map((field, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                <span className="text-sm font-medium text-green-700">{field.name}</span>
                <span className="text-sm text-green-600">{field.yield_per_acre} bins/acre</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Needs Attention */}
      {needsAttention && needsAttention.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Needs Attention
          </h4>
          <div className="space-y-2">
            {needsAttention.slice(0, 3).map((field, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                <span className="text-sm font-medium text-orange-700">{field.name}</span>
                <span className="text-sm text-orange-600">{field.issue}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!topPerformers || topPerformers.length === 0) && (!needsAttention || needsAttention.length === 0) && (
        <div className="text-center py-6 text-gray-400">
          <p>Add harvests to see insights</p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// MAIN ANALYTICS COMPONENT
// =============================================================================

export default function Analytics() {
  const [data, setData] = useState(null);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedFarm, setSelectedFarm] = useState('all');

  useEffect(() => {
    loadFarms();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedFarm]);

  const loadFarms = async () => {
    try {
      const response = await farmsAPI.getAll();
      setFarms(response.data.results || response.data || []);
    } catch (err) {
      console.error('Failed to load farms:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = { year: selectedYear };
      if (selectedFarm !== 'all') {
        params.farm_id = selectedFarm;
      }

      const response = await analyticsAPI.getDashboard(params);
      setData(response.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (!value) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y);
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-green-600" />
            Analytics
          </h1>
          <p className="text-gray-600">Financial and operational insights for your farm</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Farm Selector */}
          <select
            value={selectedFarm}
            onChange={(e) => setSelectedFarm(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">All Farms</option>
            {farms.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading analytics...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Analytics</h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Analytics Content */}
      {data && !loading && !error && (
        <div className="space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <KPICard
              title="Total Revenue"
              value={formatCurrency(data.financial?.total_revenue)}
              subtitle={`${data.period?.year}`}
              icon={DollarSign}
              color="green"
            />
            <KPICard
              title="Net Profit"
              value={formatCurrency(data.financial?.net_profit)}
              subtitle={`${data.financial?.profit_margin || 0}% margin`}
              icon={TrendingUp}
              color={data.financial?.net_profit >= 0 ? 'green' : 'red'}
            />
            <KPICard
              title="Cost per Bin"
              value={`$${(data.financial?.cost_per_bin || 0).toFixed(2)}`}
              subtitle={`${data.harvests?.total_bins || 0} total bins`}
              icon={Package}
              color="blue"
            />
            <KPICard
              title="Yield per Acre"
              value={`${(data.harvests?.yield_per_acre || 0).toFixed(1)}`}
              subtitle="bins per acre"
              icon={Wheat}
              color="purple"
            />
            <KPICard
              title="PUR Compliance"
              value={`${data.applications?.pur_compliance_rate || 0}%`}
              subtitle={`${data.applications?.submitted_to_pur || 0}/${data.applications?.complete || 0}`}
              icon={FileText}
              color={data.applications?.pur_compliance_rate >= 90 ? 'green' : 'orange'}
            />
            <KPICard
              title="Water Test Pass"
              value={`${data.water?.pass_rate || 100}%`}
              subtitle={`${data.water?.tests_passed || 0}/${data.water?.tests_total || 0} tests`}
              icon={Droplets}
              color={data.water?.pass_rate >= 90 ? 'blue' : 'orange'}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BarChart
              data={data.applications?.by_month}
              title="Applications by Month"
              valueKey="count"
              labelKey="month"
            />
            <DonutChart
              data={data.harvests?.by_crop}
              title="Revenue by Crop"
              valueKey="revenue"
              labelKey="crop"
            />
          </div>

          {/* Field Performance and Contractors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HorizontalBarChart
              data={data.fields?.all_performance}
              title="Profit by Field"
            />
            <ContractorTable contractors={data.contractors} />
          </div>

          {/* Insights */}
          <InsightsPanel
            topPerformers={data.fields?.top_performers}
            needsAttention={data.fields?.needs_attention}
          />

          {/* Top Products Used */}
          {data.applications?.top_products && data.applications.top_products.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products Used</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {data.applications.top_products.map((product, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-900 truncate" title={product.product_name}>
                      {product.product_name}
                    </div>
                    <div className="text-lg font-bold text-green-600">{product.count}</div>
                    <div className="text-xs text-gray-500">applications</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
