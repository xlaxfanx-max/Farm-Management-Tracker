// =============================================================================
// PACKINGHOUSE ANALYTICS COMPONENT
// Analytics and comparison views for packinghouse data
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  BarChart3,
  RefreshCw,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  DollarSign,
  Package
} from 'lucide-react';
import {
  packinghouseAnalyticsAPI,
  packinghousesAPI,
  PACKINGHOUSE_CONSTANTS
} from '../../services/api';

// Fixed color palette for size codes (smaller number = larger fruit)
const SIZE_COLORS = [
  '#1e40af', // 048 - deep blue (largest)
  '#2563eb', // 056
  '#3b82f6', // 072
  '#06b6d4', // 075
  '#10b981', // 088
  '#22c55e', // 113
  '#eab308', // 138
  '#f97316', // 165
  '#ef4444', // 200+ (smallest)
  '#a855f7', // overflow
];

const getSizeColor = (index) => SIZE_COLORS[index % SIZE_COLORS.length];

const PackinghouseAnalytics = () => {
  const [activeView, setActiveView] = useState('block-performance');
  const [packinghouses, setPackinghouses] = useState([]);
  const [blockPerformance, setBlockPerformance] = useState([]);
  const [packoutTrends, setPackoutTrends] = useState([]);
  const [settlementComparison, setSettlementComparison] = useState([]);
  const [sizeDistribution, setSizeDistribution] = useState(null);
  const [sizePricing, setSizePricing] = useState(null);
  const [groupBy, setGroupBy] = useState('farm');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    season: PACKINGHOUSE_CONSTANTS.getCurrentSeason(),
    packinghouse: '',
    commodity: '',
  });

  useEffect(() => {
    fetchPackinghouses();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [activeView, filters, groupBy]);

  const fetchPackinghouses = async () => {
    try {
      const response = await packinghousesAPI.getAll({ is_active: true });
      setPackinghouses(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching packinghouses:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.season) params.season = filters.season;
      if (filters.packinghouse) params.packinghouse = filters.packinghouse;
      if (filters.commodity) params.commodity = filters.commodity;

      if (activeView === 'block-performance') {
        const response = await packinghouseAnalyticsAPI.getBlockPerformance(params);
        setBlockPerformance(response.data);
      } else if (activeView === 'packout-trends') {
        const response = await packinghouseAnalyticsAPI.getPackoutTrends(params);
        setPackoutTrends(response.data);
      } else if (activeView === 'settlement-comparison') {
        const response = await packinghouseAnalyticsAPI.getSettlementComparison(params);
        setSettlementComparison(response.data);
      } else if (activeView === 'size-distribution') {
        params.group_by = groupBy;
        const response = await packinghouseAnalyticsAPI.getSizeDistribution(params);
        setSizeDistribution(response.data);
      } else if (activeView === 'size-pricing') {
        const response = await packinghouseAnalyticsAPI.getSizePricing(params);
        setSizePricing(response.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value, decimals = 0) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const getVarianceIndicator = (variance) => {
    if (variance === null || variance === undefined) {
      return <Minus className="w-4 h-4 text-gray-400" />;
    }
    if (variance > 0) {
      return <ArrowUpRight className="w-4 h-4 text-green-500" />;
    }
    if (variance < 0) {
      return <ArrowDownRight className="w-4 h-4 text-red-500" />;
    }
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getVarianceColor = (variance) => {
    if (variance === null || variance === undefined) return 'text-gray-500';
    if (variance > 0) return 'text-green-600';
    if (variance < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  const views = [
    { id: 'block-performance', label: 'Block Performance' },
    { id: 'packout-trends', label: 'Packout Trends' },
    { id: 'settlement-comparison', label: 'Settlement Comparison' },
    { id: 'size-distribution', label: 'Size Distribution' },
    { id: 'size-pricing', label: 'Size Pricing' },
  ];

  const showGroupByToggle = activeView === 'size-distribution';

  return (
    <div className="space-y-6">
      {/* View Selection and Filters */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {views.map(view => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeView === view.id
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-3">
          {showGroupByToggle && (
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="farm">Group by Farm</option>
              <option value="field">Group by Field</option>
            </select>
          )}
          <input
            type="text"
            value={filters.season}
            onChange={(e) => setFilters(prev => ({ ...prev, season: e.target.value }))}
            placeholder="Season"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-32"
          />
          <select
            value={filters.packinghouse}
            onChange={(e) => setFilters(prev => ({ ...prev, packinghouse: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Packinghouses</option>
            {packinghouses.map(ph => (
              <option key={ph.id} value={ph.id}>{ph.name}</option>
            ))}
          </select>
          <select
            value={filters.commodity}
            onChange={(e) => setFilters(prev => ({ ...prev, commodity: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Commodities</option>
            {PACKINGHOUSE_CONSTANTS.commodities.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <button
            onClick={fetchAnalytics}
            className="p-2 text-gray-400 hover:text-gray-600"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-green-600" />
        </div>
      ) : (
        <>
          {/* Block Performance View */}
          {activeView === 'block-performance' && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-green-600" />
                  Block Performance Comparison
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Compare pack percentages and returns across your blocks
                </p>
              </div>

              {blockPerformance.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No data available for the selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Block</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pool</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bins</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pack %</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">House Avg</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">$/Bin</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">vs House</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {blockPerformance.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{row.field_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.pool_name}</td>
                          <td className="px-4 py-3 text-sm text-right">{formatNumber(row.total_bins, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                            {row.pack_percent ? `${row.pack_percent}%` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">
                            {row.house_avg_pack_percent ? `${row.house_avg_pack_percent}%` : '-'}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right ${getVarianceColor(row.pack_variance)}`}>
                            <span className="flex items-center justify-end">
                              {getVarianceIndicator(row.pack_variance)}
                              {row.pack_variance !== null ? `${row.pack_variance > 0 ? '+' : ''}${formatNumber(row.pack_variance, 1)}%` : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                            {formatCurrency(row.net_per_bin)}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right ${getVarianceColor(row.return_variance)}`}>
                            <span className="flex items-center justify-end">
                              {getVarianceIndicator(row.return_variance)}
                              {row.return_variance !== null ? formatCurrency(row.return_variance) : '-'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Packout Trends View */}
          {activeView === 'packout-trends' && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                  Packout Percentage Trends
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Track pack percentages over time
                </p>
              </div>

              {packoutTrends.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No data available for the selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pack %</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">House Avg</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {packoutTrends.map((row, idx) => {
                        const variance = row.house_avg_packed_percent
                          ? parseFloat(row.total_packed_percent) - parseFloat(row.house_avg_packed_percent)
                          : null;
                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">
                              {new Date(row.report_date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {row.field_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                              {row.total_packed_percent}%
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-500">
                              {row.house_avg_packed_percent ? `${row.house_avg_packed_percent}%` : '-'}
                            </td>
                            <td className={`px-4 py-3 text-sm text-right ${getVarianceColor(variance)}`}>
                              <span className="flex items-center justify-end">
                                {getVarianceIndicator(variance)}
                                {variance !== null ? `${variance > 0 ? '+' : ''}${formatNumber(variance, 1)}%` : '-'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Settlement Comparison View */}
          {activeView === 'settlement-comparison' && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-green-600" />
                  Settlement Comparison
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Compare returns across packinghouses
                </p>
              </div>

              {settlementComparison.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No settlement data available. Select a season to compare packinghouse returns.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Packinghouse</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commodity</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bins</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net Return</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">$/Bin</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fresh %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {settlementComparison.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{row.packinghouse_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{row.commodity}</td>
                          <td className="px-4 py-3 text-sm text-right">{formatNumber(row.total_bins, 2)}</td>
                          <td className="px-4 py-3 text-sm text-right">{formatCurrency(row.net_return)}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                            {formatCurrency(row.net_per_bin)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-blue-600">
                            {row.fresh_fruit_percent ? `${row.fresh_fruit_percent}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Size Distribution View */}
          {activeView === 'size-distribution' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800 flex items-center">
                    <Package className="w-5 h-5 mr-2 text-green-600" />
                    Size Distribution by {groupBy === 'farm' ? 'Farm' : 'Field'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Compare fruit size breakdown across your {groupBy === 'farm' ? 'farms' : 'fields'}. Smaller size numbers = larger fruit.
                  </p>
                </div>

                {!sizeDistribution || sizeDistribution.groups.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No size distribution data available for the selected filters.
                  </div>
                ) : (
                  <>
                    {/* Size Legend */}
                    <div className="px-4 pt-4 flex flex-wrap gap-3">
                      {sizeDistribution.all_sizes.map((size, idx) => (
                        <div key={size} className="flex items-center space-x-1.5 text-xs">
                          <div
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: getSizeColor(idx) }}
                          />
                          <span className="text-gray-600">Size {size}</span>
                        </div>
                      ))}
                    </div>

                    {/* Stacked Bar Chart */}
                    <div className="p-4 space-y-3">
                      {sizeDistribution.groups.map((group) => {
                        const maxQty = Math.max(...sizeDistribution.groups.map(g => parseFloat(g.total_quantity) || 0));
                        const barWidth = maxQty > 0 ? (parseFloat(group.total_quantity) / maxQty) * 100 : 0;

                        return (
                          <div key={group.group_id} className="flex items-center gap-3">
                            <div className="w-32 text-sm text-gray-700 font-medium truncate text-right" title={group.group_name}>
                              {group.group_name}
                            </div>
                            <div className="flex-1">
                              <div className="flex h-7 rounded overflow-hidden" style={{ width: `${Math.max(barWidth, 5)}%` }}>
                                {group.sizes.map((s, sIdx) => {
                                  const colorIdx = sizeDistribution.all_sizes.indexOf(s.size);
                                  return (
                                    <div
                                      key={s.size}
                                      className="h-full relative group"
                                      style={{
                                        backgroundColor: getSizeColor(colorIdx >= 0 ? colorIdx : sIdx),
                                        width: `${parseFloat(s.percent)}%`,
                                        minWidth: parseFloat(s.percent) > 0 ? '2px' : '0',
                                      }}
                                      title={`Size ${s.size}: ${formatNumber(s.quantity)} (${s.percent}%)`}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                            <div className="w-20 text-xs text-gray-500 text-right">
                              {formatNumber(group.total_quantity)} ctns
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Detail Table */}
                    <div className="border-t border-gray-200">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                {groupBy === 'farm' ? 'Farm' : 'Field'}
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">%</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">House Avg %</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Variance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {sizeDistribution.groups.flatMap((group) =>
                              group.sizes.map((s, sIdx) => {
                                const variance = s.house_avg_percent !== null
                                  ? parseFloat(s.percent) - parseFloat(s.house_avg_percent)
                                  : null;
                                return (
                                  <tr key={`${group.group_id}-${s.size}`} className="hover:bg-gray-50">
                                    {sIdx === 0 ? (
                                      <td className="px-4 py-3 font-medium text-gray-900" rowSpan={group.sizes.length}>
                                        {group.group_name}
                                      </td>
                                    ) : null}
                                    <td className="px-4 py-3 text-sm">
                                      <span className="inline-flex items-center space-x-1.5">
                                        <span
                                          className="w-2.5 h-2.5 rounded-sm inline-block"
                                          style={{ backgroundColor: getSizeColor(sizeDistribution.all_sizes.indexOf(s.size)) }}
                                        />
                                        <span>{s.size}</span>
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right">{formatNumber(s.quantity)}</td>
                                    <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                                      {s.percent}%
                                    </td>
                                    <td className="px-4 py-3 text-sm text-right text-gray-500">
                                      {s.house_avg_percent !== null ? `${s.house_avg_percent}%` : '-'}
                                    </td>
                                    <td className={`px-4 py-3 text-sm text-right ${getVarianceColor(variance)}`}>
                                      <span className="flex items-center justify-end">
                                        {getVarianceIndicator(variance)}
                                        {variance !== null ? `${variance > 0 ? '+' : ''}${formatNumber(variance, 1)}%` : '-'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Size Pricing View */}
          {activeView === 'size-pricing' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              {sizePricing && sizePricing.totals && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                      <DollarSign className="w-4 h-4" />
                      <span>Total Revenue</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(sizePricing.totals.total_revenue)}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span>Overall Avg FOB</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(sizePricing.totals.overall_avg_fob)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">per carton</div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
                      <Package className="w-4 h-4" />
                      <span>Total Cartons</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatNumber(sizePricing.totals.total_quantity)}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                    FOB Pricing by Size
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Revenue and pricing breakdown by fruit size from settlements
                  </p>
                </div>

                {!sizePricing || sizePricing.sizes.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No size pricing data available for the selected filters.
                  </div>
                ) : (
                  <>
                    {/* Revenue by Size Bar Chart */}
                    <div className="p-4 space-y-2">
                      {sizePricing.sizes.map((s, idx) => {
                        const maxRev = Math.max(...sizePricing.sizes.map(x => parseFloat(x.total_revenue) || 0));
                        const barWidth = maxRev > 0 ? (parseFloat(s.total_revenue) / maxRev) * 100 : 0;

                        return (
                          <div key={s.size} className="flex items-center gap-3">
                            <div className="w-16 text-sm text-gray-700 font-medium text-right">
                              Size {s.size}
                            </div>
                            <div className="flex-1">
                              <div
                                className="h-6 rounded"
                                style={{
                                  backgroundColor: getSizeColor(idx),
                                  width: `${Math.max(barWidth, 2)}%`,
                                }}
                                title={`${formatCurrency(s.total_revenue)} (${s.percent_of_total_revenue}%)`}
                              />
                            </div>
                            <div className="w-28 text-xs text-gray-600 text-right">
                              {formatCurrency(s.total_revenue)}
                            </div>
                            <div className="w-12 text-xs text-gray-400 text-right">
                              {s.percent_of_total_revenue}%
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Detail Table */}
                    <div className="border-t border-gray-200 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg FOB Rate</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {sizePricing.sizes.map((s, idx) => (
                            <tr key={s.size} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">
                                <span className="inline-flex items-center space-x-1.5">
                                  <span
                                    className="w-2.5 h-2.5 rounded-sm inline-block"
                                    style={{ backgroundColor: getSizeColor(idx) }}
                                  />
                                  <span>{s.size}</span>
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-right">{formatNumber(s.total_quantity)}</td>
                              <td className="px-4 py-3 text-sm text-right text-gray-500">{s.percent_of_total_quantity}%</td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                                {formatCurrency(s.weighted_avg_fob)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                                {formatCurrency(s.total_revenue)}
                              </td>
                              <td className="px-4 py-3 text-sm text-right text-gray-500">{s.percent_of_total_revenue}%</td>
                            </tr>
                          ))}
                        </tbody>
                        {sizePricing.totals && (
                          <tfoot className="bg-gray-50">
                            <tr className="font-semibold">
                              <td className="px-4 py-3 text-gray-900">Total</td>
                              <td className="px-4 py-3 text-right">{formatNumber(sizePricing.totals.total_quantity)}</td>
                              <td className="px-4 py-3 text-right">100%</td>
                              <td className="px-4 py-3 text-right text-blue-600">{formatCurrency(sizePricing.totals.overall_avg_fob)}</td>
                              <td className="px-4 py-3 text-right text-green-600">{formatCurrency(sizePricing.totals.total_revenue)}</td>
                              <td className="px-4 py-3 text-right">100%</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PackinghouseAnalytics;
