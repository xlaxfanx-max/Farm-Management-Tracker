// =============================================================================
// PACKINGHOUSE ANALYTICS COMPONENT
// Analytics and comparison views for packinghouse data
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  BarChart3,
  RefreshCw,
  DollarSign,
  Package
} from 'lucide-react';
import {
  packinghouseAnalyticsAPI,
  packinghousesAPI,
  PACKINGHOUSE_CONSTANTS
} from '../../services/api';
import SeasonSelector from '../SeasonSelector';
import { useSeason } from '../../contexts/SeasonContext';
import {
  AnalyticsCard,
  AnalyticsTabs,
  LoadingState,
  EmptyState,
  SectionCard,
  VarianceIndicator,
  formatCurrency,
  formatNumber,
  tableHeaderClass,
  tableCellClass,
} from '../analytics/analyticsShared';

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
  const [selectedPackinghouse, setSelectedPackinghouse] = useState('');
  const [selectedCommodity, setSelectedCommodity] = useState('');

  const { selectedSeason, setSelectedSeason } = useSeason();

  useEffect(() => {
    fetchPackinghouses();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      fetchAnalytics();
    }
  }, [activeView, selectedSeason, selectedPackinghouse, selectedCommodity, groupBy]);

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
      if (selectedSeason) params.season = selectedSeason;
      if (selectedPackinghouse) params.packinghouse = selectedPackinghouse;
      if (selectedCommodity) params.commodity = selectedCommodity;

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

  const views = [
    { id: 'block-performance', label: 'Block Performance' },
    { id: 'packout-trends', label: 'Packout Trends' },
    { id: 'settlement-comparison', label: 'Settlement Comparison' },
    { id: 'size-distribution', label: 'Size Distribution' },
    { id: 'size-pricing', label: 'Size Pricing' },
  ];

  const showGroupByToggle = activeView === 'size-distribution';

  return (
    <div className="space-y-4">
      {/* View Tabs (underline style) */}
      <AnalyticsTabs
        tabs={views}
        activeTab={activeView}
        onChange={setActiveView}
        accentColor="green"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {showGroupByToggle && (
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="farm">Group by Farm</option>
            <option value="field">Group by Field</option>
          </select>
        )}
        <SeasonSelector
          value={selectedSeason}
          onChange={setSelectedSeason}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Select Season"
        />
        <select
          value={selectedPackinghouse}
          onChange={(e) => setSelectedPackinghouse(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="">All Packinghouses</option>
          {packinghouses.map(ph => (
            <option key={ph.id} value={ph.id}>{ph.name}</option>
          ))}
        </select>
        <select
          value={selectedCommodity}
          onChange={(e) => setSelectedCommodity(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
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

      {/* Content */}
      {loading ? (
        <LoadingState />
      ) : (
        <>
          {/* Block Performance View */}
          {activeView === 'block-performance' && (
            <SectionCard
              title="Block Performance Comparison"
              subtitle="Compare pack percentages and returns across your blocks"
              icon={BarChart3}
            >
              {blockPerformance.length === 0 ? (
                <EmptyState message="No data available for the selected filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className={`${tableHeaderClass} text-left`}>Block</th>
                        <th className={`${tableHeaderClass} text-left`}>Pool</th>
                        <th className={`${tableHeaderClass} text-right`}>Bins</th>
                        <th className={`${tableHeaderClass} text-right`}>Pack %</th>
                        <th className={`${tableHeaderClass} text-right`}>House Avg</th>
                        <th className={`${tableHeaderClass} text-right`}>Variance</th>
                        <th className={`${tableHeaderClass} text-right`}>$/Bin</th>
                        <th className={`${tableHeaderClass} text-right`}>vs House</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {blockPerformance.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className={`${tableCellClass} font-medium text-gray-900`}>{row.field_name}</td>
                          <td className={`${tableCellClass} text-gray-600`}>{row.pool_name}</td>
                          <td className={`${tableCellClass} text-right`}>{formatNumber(row.total_bins, 2)}</td>
                          <td className={`${tableCellClass} text-right font-semibold text-blue-600`}>
                            {row.pack_percent ? `${row.pack_percent}%` : '-'}
                          </td>
                          <td className={`${tableCellClass} text-right text-gray-500`}>
                            {row.house_avg_pack_percent ? `${row.house_avg_pack_percent}%` : '-'}
                          </td>
                          <td className={`${tableCellClass} text-right`}>
                            <VarianceIndicator value={row.pack_variance} />
                          </td>
                          <td className={`${tableCellClass} text-right font-semibold text-green-600`}>
                            {formatCurrency(row.net_per_bin)}
                          </td>
                          <td className={`${tableCellClass} text-right`}>
                            <VarianceIndicator value={row.return_variance} format="currency" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* Packout Trends View */}
          {activeView === 'packout-trends' && (
            <SectionCard
              title="Packout Percentage Trends"
              subtitle="Track pack percentages over time"
              icon={TrendingUp}
            >
              {packoutTrends.length === 0 ? (
                <EmptyState message="No data available for the selected filters." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className={`${tableHeaderClass} text-left`}>Date</th>
                        <th className={`${tableHeaderClass} text-left`}>Field</th>
                        <th className={`${tableHeaderClass} text-right`}>Pack %</th>
                        <th className={`${tableHeaderClass} text-right`}>House Avg</th>
                        <th className={`${tableHeaderClass} text-right`}>Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {packoutTrends.map((row, idx) => {
                        const variance = row.house_avg_packed_percent
                          ? parseFloat(row.total_packed_percent) - parseFloat(row.house_avg_packed_percent)
                          : null;
                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className={tableCellClass}>
                              {new Date(row.report_date).toLocaleDateString()}
                            </td>
                            <td className={`${tableCellClass} font-medium text-gray-900`}>
                              {row.field_name}
                            </td>
                            <td className={`${tableCellClass} text-right font-semibold text-blue-600`}>
                              {row.total_packed_percent}%
                            </td>
                            <td className={`${tableCellClass} text-right text-gray-500`}>
                              {row.house_avg_packed_percent ? `${row.house_avg_packed_percent}%` : '-'}
                            </td>
                            <td className={`${tableCellClass} text-right`}>
                              <VarianceIndicator value={variance} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* Settlement Comparison View */}
          {activeView === 'settlement-comparison' && (
            <SectionCard
              title="Settlement Comparison"
              subtitle="Compare returns across packinghouses"
              icon={BarChart3}
            >
              {settlementComparison.length === 0 ? (
                <EmptyState message="No settlement data available. Select a season to compare packinghouse returns." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className={`${tableHeaderClass} text-left`}>Packinghouse</th>
                        <th className={`${tableHeaderClass} text-left`}>Commodity</th>
                        <th className={`${tableHeaderClass} text-right`}>Bins</th>
                        <th className={`${tableHeaderClass} text-right`}>Net Return</th>
                        <th className={`${tableHeaderClass} text-right`}>$/Bin</th>
                        <th className={`${tableHeaderClass} text-right`}>Fresh %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {settlementComparison.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className={`${tableCellClass} font-medium text-gray-900`}>{row.packinghouse_name}</td>
                          <td className={`${tableCellClass} text-gray-600`}>{row.commodity}</td>
                          <td className={`${tableCellClass} text-right`}>{formatNumber(row.total_bins, 2)}</td>
                          <td className={`${tableCellClass} text-right`}>{formatCurrency(row.net_return)}</td>
                          <td className={`${tableCellClass} text-right font-semibold text-green-600`}>
                            {formatCurrency(row.net_per_bin)}
                          </td>
                          <td className={`${tableCellClass} text-right text-blue-600`}>
                            {row.fresh_fruit_percent ? `${row.fresh_fruit_percent}%` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* Size Distribution View */}
          {activeView === 'size-distribution' && (
            <div className="space-y-6">
              <SectionCard
                title={`Size Distribution by ${groupBy === 'farm' ? 'Farm' : 'Field'}`}
                subtitle={`Compare fruit size breakdown across your ${groupBy === 'farm' ? 'farms' : 'fields'}. Smaller size numbers = larger fruit.`}
                icon={Package}
              >
                {!sizeDistribution || sizeDistribution.groups.length === 0 ? (
                  <EmptyState message="No size distribution data available for the selected filters." />
                ) : (
                  <>
                    {/* Size Legend */}
                    <div className="px-5 pt-4 flex flex-wrap gap-3">
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
                    <div className="p-5 space-y-3">
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
                              <th className={`${tableHeaderClass} text-left`}>
                                {groupBy === 'farm' ? 'Farm' : 'Field'}
                              </th>
                              <th className={`${tableHeaderClass} text-left`}>Size</th>
                              <th className={`${tableHeaderClass} text-right`}>Quantity</th>
                              <th className={`${tableHeaderClass} text-right`}>%</th>
                              <th className={`${tableHeaderClass} text-right`}>House Avg %</th>
                              <th className={`${tableHeaderClass} text-right`}>Variance</th>
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
                                      <td className={`${tableCellClass} font-medium text-gray-900`} rowSpan={group.sizes.length}>
                                        {group.group_name}
                                      </td>
                                    ) : null}
                                    <td className={tableCellClass}>
                                      <span className="inline-flex items-center space-x-1.5">
                                        <span
                                          className="w-2.5 h-2.5 rounded-sm inline-block"
                                          style={{ backgroundColor: getSizeColor(sizeDistribution.all_sizes.indexOf(s.size)) }}
                                        />
                                        <span>{s.size}</span>
                                      </span>
                                    </td>
                                    <td className={`${tableCellClass} text-right`}>{formatNumber(s.quantity)}</td>
                                    <td className={`${tableCellClass} text-right font-semibold text-blue-600`}>
                                      {s.percent}%
                                    </td>
                                    <td className={`${tableCellClass} text-right text-gray-500`}>
                                      {s.house_avg_percent !== null ? `${s.house_avg_percent}%` : '-'}
                                    </td>
                                    <td className={`${tableCellClass} text-right`}>
                                      <VarianceIndicator value={variance} />
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
              </SectionCard>
            </div>
          )}

          {/* Size Pricing View */}
          {activeView === 'size-pricing' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              {sizePricing && sizePricing.totals && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <AnalyticsCard
                    title="Total Revenue"
                    value={formatCurrency(sizePricing.totals.total_revenue, { compact: true })}
                    icon={DollarSign}
                    color="green"
                  />
                  <AnalyticsCard
                    title="Overall Avg FOB"
                    value={formatCurrency(sizePricing.totals.overall_avg_fob)}
                    subtitle="per carton"
                    icon={TrendingUp}
                    color="blue"
                  />
                  <AnalyticsCard
                    title="Total Cartons"
                    value={formatNumber(sizePricing.totals.total_quantity)}
                    icon={Package}
                    color="purple"
                  />
                </div>
              )}

              <SectionCard
                title="FOB Pricing by Size"
                subtitle="Revenue and pricing breakdown by fruit size from settlements"
                icon={DollarSign}
              >
                {!sizePricing || sizePricing.sizes.length === 0 ? (
                  <EmptyState message="No size pricing data available for the selected filters." />
                ) : (
                  <>
                    {/* Revenue by Size Bar Chart */}
                    <div className="p-5 space-y-2">
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
                            <th className={`${tableHeaderClass} text-left`}>Size</th>
                            <th className={`${tableHeaderClass} text-right`}>Quantity</th>
                            <th className={`${tableHeaderClass} text-right`}>% of Total</th>
                            <th className={`${tableHeaderClass} text-right`}>Avg FOB Rate</th>
                            <th className={`${tableHeaderClass} text-right`}>Revenue</th>
                            <th className={`${tableHeaderClass} text-right`}>% of Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {sizePricing.sizes.map((s, idx) => (
                            <tr key={s.size} className="hover:bg-gray-50">
                              <td className={`${tableCellClass} font-medium text-gray-900`}>
                                <span className="inline-flex items-center space-x-1.5">
                                  <span
                                    className="w-2.5 h-2.5 rounded-sm inline-block"
                                    style={{ backgroundColor: getSizeColor(idx) }}
                                  />
                                  <span>{s.size}</span>
                                </span>
                              </td>
                              <td className={`${tableCellClass} text-right`}>{formatNumber(s.total_quantity)}</td>
                              <td className={`${tableCellClass} text-right text-gray-500`}>{s.percent_of_total_quantity}%</td>
                              <td className={`${tableCellClass} text-right font-semibold text-blue-600`}>
                                {formatCurrency(s.weighted_avg_fob)}
                              </td>
                              <td className={`${tableCellClass} text-right font-semibold text-green-600`}>
                                {formatCurrency(s.total_revenue)}
                              </td>
                              <td className={`${tableCellClass} text-right text-gray-500`}>{s.percent_of_total_revenue}%</td>
                            </tr>
                          ))}
                        </tbody>
                        {sizePricing.totals && (
                          <tfoot className="bg-gray-50">
                            <tr className="font-semibold">
                              <td className={`${tableCellClass} text-gray-900`}>Total</td>
                              <td className={`${tableCellClass} text-right`}>{formatNumber(sizePricing.totals.total_quantity)}</td>
                              <td className={`${tableCellClass} text-right`}>100%</td>
                              <td className={`${tableCellClass} text-right text-blue-600`}>{formatCurrency(sizePricing.totals.overall_avg_fob)}</td>
                              <td className={`${tableCellClass} text-right text-green-600`}>{formatCurrency(sizePricing.totals.total_revenue)}</td>
                              <td className={`${tableCellClass} text-right`}>100%</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </>
                )}
              </SectionCard>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PackinghouseAnalytics;
