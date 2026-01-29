import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  DollarSign,
  Package,
  Wheat,
  Droplets,
  FileText,
  RefreshCw,
  Users,
  Target,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { analyticsAPI, farmsAPI } from '../services/api';
import SeasonSelector from './SeasonSelector';
import { useSeason } from '../contexts/SeasonContext';
import {
  AnalyticsCard,
  LoadingState,
  ErrorState,
  SectionCard,
  formatCurrency,
  formatNumber,
} from './analytics/analyticsShared';

// =============================================================================
// SIMPLE BAR CHART COMPONENT
// =============================================================================

const BarChart = ({ data, title, valueKey = 'count', labelKey = 'month', height = 200 }) => {
  if (!data || data.length === 0) {
    return (
      <SectionCard title={title}>
        <div className="flex items-center justify-center h-40 text-gray-400 p-6">
          <p>No data available</p>
        </div>
      </SectionCard>
    );
  }

  const maxValue = Math.max(...data.map(d => d[valueKey] || 0), 1);

  return (
    <SectionCard title={title}>
      <div style={{ height: `${height}px` }} className="relative p-6 pt-2">
        {/* Y-axis labels */}
        <div className="absolute left-6 top-2 bottom-10 w-8 flex flex-col justify-between text-xs text-gray-400">
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
    </SectionCard>
  );
};

// =============================================================================
// DONUT CHART COMPONENT
// =============================================================================

const DonutChart = ({ data, title, valueKey = 'revenue', labelKey = 'crop' }) => {
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

  if (!data || data.length === 0) {
    return (
      <SectionCard title={title}>
        <div className="flex items-center justify-center h-40 text-gray-400 p-6">
          <p>No data available</p>
        </div>
      </SectionCard>
    );
  }

  const total = data.reduce((sum, item) => sum + (item[valueKey] || 0), 0);
  let currentAngle = 0;

  return (
    <SectionCard title={title}>
      <div className="flex items-center gap-6 p-6 pt-2">
        {/* Donut */}
        <div className="relative w-40 h-40 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
            {data.map((item, index) => {
              const percentage = total > 0 ? (item[valueKey] || 0) / total : 0;
              const angle = percentage * 360;
              const startAngle = currentAngle;
              currentAngle += angle;

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
            <circle cx="50" cy="50" r="25" fill="white" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-gray-500">Total</span>
            <span className="text-lg font-bold text-gray-900">{formatCurrency(total, { compact: true })}</span>
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
                {formatCurrency(item[valueKey], { compact: true })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
};

// =============================================================================
// HORIZONTAL BAR CHART (FIELD PERFORMANCE)
// =============================================================================

const HorizontalBarChart = ({ data, title }) => {
  if (!data || data.length === 0) {
    return (
      <SectionCard title={title}>
        <div className="flex items-center justify-center h-40 text-gray-400 p-6">
          <p>No data available</p>
        </div>
      </SectionCard>
    );
  }

  const maxProfit = Math.max(...data.map(d => Math.abs(d.profit || 0)), 1);

  return (
    <SectionCard title={title}>
      <div className="space-y-3 p-6 pt-2">
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
                {formatCurrency(field.profit, { compact: true })}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
};

// =============================================================================
// CONTRACTOR TABLE
// =============================================================================

const ContractorTable = ({ contractors }) => {
  return (
    <SectionCard
      title="Contractor Performance"
      icon={Users}
    >
      {!contractors || contractors.length === 0 ? (
        <div className="text-center py-6 text-gray-400 px-6">
          <p>No contractor data available</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Contractor</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Bins</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Cost</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">$/Bin</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase text-right">Bins/Hr</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {contractors.map((c, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatNumber(c.bins)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(c.cost)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(c.cost_per_bin)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatNumber(c.bins_per_hour, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
};

// =============================================================================
// INSIGHTS PANEL
// =============================================================================

const InsightsPanel = ({ topPerformers, needsAttention }) => {
  return (
    <SectionCard title="Insights" icon={Target}>
      <div className="p-5 pt-2">
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
    </SectionCard>
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
  const [selectedFarm, setSelectedFarm] = useState('all');

  const { selectedSeason, setSelectedSeason, seasonDates } = useSeason();

  useEffect(() => {
    loadFarms();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      loadData();
    }
  }, [selectedSeason, selectedFarm, seasonDates]);

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
      const params = {};
      if (selectedSeason) {
        params.season = selectedSeason;
      }
      if (seasonDates) {
        params.start_date = seasonDates.start_date;
        params.end_date = seasonDates.end_date;
      }
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

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-green-600" />
            Analytics {selectedSeason && <span className="text-lg font-normal text-gray-500">• {selectedSeason} Season</span>}
          </h1>
          <p className="text-gray-600">Financial and operational insights for your farm</p>
        </div>

        <div className="flex items-center gap-3">
          <SeasonSelector
            value={selectedSeason}
            onChange={setSelectedSeason}
            cropCategory="citrus"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Select Season"
          />

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
      {loading && <LoadingState />}

      {/* Error State */}
      {error && !loading && <ErrorState message={error} onRetry={loadData} />}

      {/* Analytics Content */}
      {data && !loading && !error && (
        <div className="space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <AnalyticsCard
              title="Total Revenue"
              value={formatCurrency(data.financial?.total_revenue, { compact: true })}
              subtitle={`${data.period?.year}`}
              icon={DollarSign}
              color="green"
            />
            <AnalyticsCard
              title="Net Profit"
              value={formatCurrency(data.financial?.net_profit, { compact: true })}
              subtitle={`${data.financial?.profit_margin || 0}% margin`}
              icon={BarChart3}
              color={data.financial?.net_profit >= 0 ? 'green' : 'red'}
            />
            <AnalyticsCard
              title="Cost per Bin"
              value={formatCurrency(data.financial?.cost_per_bin)}
              subtitle={`${formatNumber(data.harvests?.total_bins)} total bins`}
              icon={Package}
              color="blue"
            />
            <AnalyticsCard
              title="Yield per Acre"
              value={formatNumber(data.harvests?.yield_per_acre, 1)}
              subtitle="bins per acre"
              icon={Wheat}
              color="purple"
            />
            <AnalyticsCard
              title="PUR Compliance"
              value={`${data.applications?.pur_compliance_rate || 0}%`}
              subtitle={`${data.applications?.submitted_to_pur || 0}/${data.applications?.complete || 0}`}
              icon={FileText}
              color={data.applications?.pur_compliance_rate >= 90 ? 'green' : 'orange'}
            />
            <AnalyticsCard
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
            <SectionCard title="Top Products Used">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-5 pt-2">
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
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
}
