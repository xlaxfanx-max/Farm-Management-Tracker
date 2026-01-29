// =============================================================================
// PROFITABILITY DASHBOARD COMPONENT
// =============================================================================
// Shows true profitability analysis: settlement returns minus harvest costs
// Includes deduction breakdown and season-over-season comparison

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  PieChart,
  Calendar,
  ChevronDown,
  ChevronUp,
  Minus,
} from 'lucide-react';
import { harvestAnalyticsAPI, packinghousesAPI } from '../services/api';
import SeasonSelector from './SeasonSelector';
import { useSeason } from '../contexts/SeasonContext';
import {
  AnalyticsCard,
  AnalyticsTabs,
  LoadingState,
  ErrorState,
  EmptyState,
  SectionCard,
  MarginBadge,
  VarianceIndicator,
  formatCurrency,
  formatNumber,
  formatPercent,
  tableHeaderClass,
  tableCellClass,
} from './analytics/analyticsShared';

const ProfitabilityDashboard = () => {
  const [activeView, setActiveView] = useState('profitability');

  const [profitabilityData, setProfitabilityData] = useState(null);
  const [deductionData, setDeductionData] = useState(null);
  const [seasonData, setSeasonData] = useState(null);
  const [packinghouses, setPackinghouses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPackinghouse, setSelectedPackinghouse] = useState('');
  const [expandedFields, setExpandedFields] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});

  const { selectedSeason, setSelectedSeason } = useSeason();

  useEffect(() => {
    const fetchPackinghouses = async () => {
      try {
        const response = await packinghousesAPI.getAll();
        const data = response.data?.results || response.data || [];
        setPackinghouses(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching packinghouses:', err);
        setPackinghouses([]);
      }
    };
    fetchPackinghouses();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      fetchData();
    }
  }, [activeView, selectedSeason, selectedPackinghouse]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    const filters = {
      season: selectedSeason,
      packinghouse: selectedPackinghouse,
    };

    try {
      if (activeView === 'profitability') {
        const response = await harvestAnalyticsAPI.getProfitability(filters);
        setProfitabilityData(response.data);
      } else if (activeView === 'deductions') {
        const response = await harvestAnalyticsAPI.getDeductionBreakdown(filters);
        setDeductionData(response.data);
      } else if (activeView === 'seasons') {
        const response = await harvestAnalyticsAPI.getSeasonComparison(filters);
        setSeasonData(response.data);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const toggleFieldExpand = (fieldId) => {
    setExpandedFields(prev => ({ ...prev, [fieldId]: !prev[fieldId] }));
  };

  const toggleCategoryExpand = (category) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const ProfitIndicator = ({ value, showArrow = true }) => {
    if (value === null || value === undefined) return <span className="text-gray-400">-</span>;
    const isPositive = value >= 0;
    const colorClass = isPositive ? 'text-green-600' : 'text-red-600';

    return (
      <span className={`flex items-center gap-1 ${colorClass}`}>
        {showArrow && (isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
        {formatCurrency(value)}
      </span>
    );
  };

  const viewTabs = [
    { id: 'profitability', label: 'Profitability', icon: DollarSign },
    { id: 'deductions', label: 'Deductions', icon: PieChart },
    { id: 'seasons', label: 'Season Comparison', icon: Calendar },
  ];

  // Filters Bar
  const FiltersBar = () => (
    <div className="flex flex-wrap gap-4 mb-6">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
        <SeasonSelector
          value={selectedSeason}
          onChange={setSelectedSeason}
          cropCategory="citrus"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="Select Season"
        />
      </div>
      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">Packinghouse</label>
        <select
          value={selectedPackinghouse}
          onChange={(e) => setSelectedPackinghouse(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
        >
          <option value="">All Packinghouses</option>
          {packinghouses.map(ph => (
            <option key={ph.id} value={ph.id}>{ph.name}</option>
          ))}
        </select>
      </div>
    </div>
  );

  // Profitability View
  const ProfitabilityView = () => {
    if (!profitabilityData) return null;
    const { summary, by_field, by_pool, message } = profitabilityData;

    const hasFieldData = by_field && by_field.length > 0;
    const hasPoolData = by_pool && by_pool.length > 0;

    return (
      <div className="space-y-6">
        {message && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-700">
              <BarChart3 size={18} />
              <span>{message}</span>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AnalyticsCard
            title="Total Bins"
            value={formatNumber(summary.total_bins)}
            subtitle={hasFieldData ? `${summary.total_fields} fields` : hasPoolData ? `${summary.total_pools} pools` : 'No data'}
            icon={BarChart3}
            color="blue"
          />
          <AnalyticsCard
            title="Gross Revenue"
            value={formatCurrency(summary.gross_revenue, { compact: true })}
            subtitle="Fruit sales"
            icon={DollarSign}
            color="green"
          />
          <AnalyticsCard
            title="Deductions"
            value={formatCurrency(summary.total_deductions, { compact: true })}
            subtitle="Packing, pick/haul, etc."
            icon={Minus}
            color="orange"
          />
          <AnalyticsCard
            title="Net Return"
            value={formatCurrency(summary.net_settlement, { compact: true })}
            subtitle={`${summary.return_margin}% of gross`}
            icon={TrendingUp}
            color="blue"
          />
        </div>

        {/* Per-Bin Summary */}
        {summary.total_bins > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="text-sm font-medium text-gray-500 mb-3">Per-Bin Breakdown</h4>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-sm text-gray-700">Gross: {formatCurrency(summary.gross_revenue / summary.total_bins)}/bin</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span className="text-sm text-gray-700">Deductions: {formatCurrency(summary.total_deductions / summary.total_bins)}/bin</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-600 rounded"></div>
                <span className="text-sm font-medium text-blue-600">
                  Net: {formatCurrency(summary.avg_net_per_bin || summary.net_settlement / summary.total_bins)}/bin
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Field-by-Field Breakdown */}
        {hasFieldData && (
          <SectionCard title="Returns by Field">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${tableHeaderClass} text-left`}>Field</th>
                    <th className={`${tableHeaderClass} text-right`}>Bins</th>
                    <th className={`${tableHeaderClass} text-right`}>Gross</th>
                    <th className={`${tableHeaderClass} text-right`}>Deductions</th>
                    <th className={`${tableHeaderClass} text-right`}>Net Return</th>
                    <th className={`${tableHeaderClass} text-right`}>$/Bin</th>
                    <th className={`${tableHeaderClass} text-right`}>Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {by_field.map((field) => (
                    <React.Fragment key={field.field_id}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleFieldExpand(field.field_id)}
                      >
                        <td className={tableCellClass}>
                          <div className="flex items-center gap-2">
                            {expandedFields[field.field_id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <div>
                              <div className="font-medium text-gray-900">{field.field_name}</div>
                              <div className="text-xs text-gray-500">{field.farm_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`${tableCellClass} text-right text-gray-700`}>
                          {formatNumber(field.total_bins)}
                        </td>
                        <td className={`${tableCellClass} text-right text-green-600`}>
                          {formatCurrency(field.gross_revenue)}
                        </td>
                        <td className={`${tableCellClass} text-right text-orange-600`}>
                          {formatCurrency(field.total_deductions)}
                        </td>
                        <td className={`${tableCellClass} text-right font-medium text-blue-600`}>
                          {formatCurrency(field.net_settlement)}
                        </td>
                        <td className={`${tableCellClass} text-right font-medium text-gray-700`}>
                          {formatCurrency(field.net_per_bin)}
                        </td>
                        <td className={`${tableCellClass} text-right`}>
                          <MarginBadge value={field.return_margin} />
                        </td>
                      </tr>
                      {expandedFields[field.field_id] && (
                        <tr>
                          <td colSpan={7} className="bg-gray-50 px-4 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Packinghouse:</span>
                                <span className="ml-2 text-gray-900">{field.packinghouse_name}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Pool:</span>
                                <span className="ml-2 text-gray-900">{field.pool_name}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Gross/Bin:</span>
                                <span className="ml-2 text-green-600">{formatCurrency(field.gross_per_bin)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Deductions/Bin:</span>
                                <span className="ml-2 text-orange-600">{formatCurrency(field.deductions_per_bin)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Net/Bin:</span>
                                <span className="ml-2 text-blue-600">{formatCurrency(field.net_per_bin)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Deliveries:</span>
                                <span className="ml-2 text-gray-900">{field.delivery_count}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {/* Pool-Level Breakdown */}
        {!hasFieldData && hasPoolData && (
          <SectionCard title="Returns by Pool">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${tableHeaderClass} text-left`}>Pool</th>
                    <th className={`${tableHeaderClass} text-right`}>Bins</th>
                    <th className={`${tableHeaderClass} text-right`}>Gross</th>
                    <th className={`${tableHeaderClass} text-right`}>Deductions</th>
                    <th className={`${tableHeaderClass} text-right`}>Net Return</th>
                    <th className={`${tableHeaderClass} text-right`}>$/Bin</th>
                    <th className={`${tableHeaderClass} text-right`}>Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {by_pool.map((pool) => (
                    <tr key={pool.pool_id} className="hover:bg-gray-50">
                      <td className={tableCellClass}>
                        <div>
                          <div className="font-medium text-gray-900">{pool.pool_name}</div>
                          <div className="text-xs text-gray-500">{pool.packinghouse_name} - {pool.commodity}</div>
                        </div>
                      </td>
                      <td className={`${tableCellClass} text-right text-gray-700`}>
                        {formatNumber(pool.total_bins)}
                      </td>
                      <td className={`${tableCellClass} text-right text-green-600`}>
                        {formatCurrency(pool.gross_revenue)}
                      </td>
                      <td className={`${tableCellClass} text-right text-orange-600`}>
                        {formatCurrency(pool.total_deductions)}
                      </td>
                      <td className={`${tableCellClass} text-right font-medium text-blue-600`}>
                        {formatCurrency(pool.net_settlement)}
                      </td>
                      <td className={`${tableCellClass} text-right font-medium text-gray-700`}>
                        {formatCurrency(pool.net_per_bin)}
                      </td>
                      <td className={`${tableCellClass} text-right`}>
                        <MarginBadge value={pool.return_margin} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        {!hasFieldData && !hasPoolData && (
          <EmptyState
            message="No settlement data available for this season."
            subtitle="Upload packinghouse statements to see profitability analysis."
          />
        )}
      </div>
    );
  };

  // Deductions View
  const DeductionsView = () => {
    if (!deductionData) return null;

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <AnalyticsCard
            title="Total Bins"
            value={formatNumber(deductionData.total_bins)}
            icon={BarChart3}
            color="blue"
          />
          <AnalyticsCard
            title="Total Deductions"
            value={formatCurrency(deductionData.grand_total, { compact: true })}
            icon={Minus}
            color="orange"
          />
          <AnalyticsCard
            title="Avg Deduction/Bin"
            value={formatCurrency(deductionData.grand_total_per_bin)}
            icon={DollarSign}
            color="blue"
          />
        </div>

        {/* Category Breakdown */}
        <SectionCard title="Deductions by Category">
          <div className="divide-y divide-gray-200">
            {deductionData.by_category.map((category) => (
              <div key={category.category}>
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleCategoryExpand(category.category)}
                >
                  <div className="flex items-center gap-3">
                    {expandedCategories[category.category] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <div>
                      <div className="font-medium text-gray-900">{category.label}</div>
                      <div className="text-xs text-gray-500">{category.items.length} items</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">{formatCurrency(category.total_amount)}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{formatCurrency(category.per_bin)}/bin</span>
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded">{category.percent_of_total}%</span>
                    </div>
                  </div>
                </div>

                {expandedCategories[category.category] && (
                  <div className="bg-gray-50 px-4 py-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase">
                          <th className="text-left py-2">Description</th>
                          <th className="text-right py-2">Amount</th>
                          <th className="text-right py-2">Per Bin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {category.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 text-gray-700">{item.description}</td>
                            <td className="py-2 text-right text-gray-700">{formatCurrency(item.amount)}</td>
                            <td className="py-2 text-right text-gray-500">{formatCurrency(item.per_bin)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Visual breakdown bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Distribution by Category</h4>
          <div className="flex h-8 rounded-lg overflow-hidden">
            {deductionData.by_category.map((cat, idx) => {
              const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-gray-500'];
              return (
                <div
                  key={cat.category}
                  className={`${colors[idx % colors.length]} relative group`}
                  style={{ width: `${cat.percent_of_total}%` }}
                  title={`${cat.label}: ${cat.percent_of_total}%`}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    {cat.percent_of_total > 10 && `${cat.percent_of_total}%`}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            {deductionData.by_category.map((cat, idx) => {
              const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-gray-500'];
              return (
                <div key={cat.category} className="flex items-center gap-2 text-xs">
                  <div className={`w-3 h-3 rounded ${colors[idx % colors.length]}`}></div>
                  <span className="text-gray-600">{cat.label} ({cat.percent_of_total}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Season Comparison View
  const SeasonComparisonView = () => {
    if (!seasonData || !seasonData.seasons || seasonData.seasons.length === 0) {
      return <EmptyState message="No multi-season data available for comparison" />;
    }

    return (
      <div className="space-y-6">
        {/* Season Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {seasonData.seasons.map((season, idx) => (
            <div key={season.season} className={`bg-white rounded-xl border border-gray-200 p-5 ${idx === 0 ? 'ring-2 ring-blue-500' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-900">{season.season}</h4>
                {idx === 0 && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">Current</span>}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Bins</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900">{formatNumber(season.total_bins)}</span>
                    {season.volume_change !== null && season.volume_change !== undefined && (
                      <VarianceIndicator value={season.volume_change} />
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Gross Revenue</span>
                  <span className="text-green-600">{formatCurrency(season.gross_revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Deductions</span>
                  <span className="text-orange-600">{formatCurrency(season.total_deductions)}</span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-medium">
                    <span className="text-gray-700">Net Return</span>
                    <span className="text-blue-600">{formatCurrency(season.net_settlement)}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Net/Bin</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{formatCurrency(season.net_per_bin)}</span>
                    {season.net_per_bin_change !== null && season.net_per_bin_change !== undefined && (
                      <VarianceIndicator value={season.net_per_bin_change} />
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Return Margin</span>
                  <MarginBadge value={season.return_margin} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trend Table */}
        <SectionCard title="Per-Bin Metrics Trend">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className={`${tableHeaderClass} text-left`}>Season</th>
                  <th className={`${tableHeaderClass} text-right`}>Bins</th>
                  <th className={`${tableHeaderClass} text-right`}>Gross/Bin</th>
                  <th className={`${tableHeaderClass} text-right`}>Deductions/Bin</th>
                  <th className={`${tableHeaderClass} text-right`}>Net/Bin</th>
                  <th className={`${tableHeaderClass} text-right`}>Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {seasonData.seasons.map((season) => (
                  <tr key={season.season} className="hover:bg-gray-50">
                    <td className={`${tableCellClass} font-medium text-gray-900`}>{season.season}</td>
                    <td className={`${tableCellClass} text-right text-gray-700`}>{formatNumber(season.total_bins)}</td>
                    <td className={`${tableCellClass} text-right text-green-600`}>{formatCurrency(season.gross_per_bin)}</td>
                    <td className={`${tableCellClass} text-right text-orange-600`}>{formatCurrency(season.deductions_per_bin)}</td>
                    <td className={`${tableCellClass} text-right font-medium text-blue-600`}>{formatCurrency(season.net_per_bin)}</td>
                    <td className={`${tableCellClass} text-right`}>
                      <MarginBadge value={season.return_margin} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    );
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-4">
      {/* View Tabs */}
      <AnalyticsTabs
        tabs={viewTabs}
        activeTab={activeView}
        onChange={setActiveView}
        accentColor="green"
      />

      {/* Filters */}
      {(activeView === 'profitability' || activeView === 'deductions') && <FiltersBar />}

      {/* Content */}
      {activeView === 'profitability' && <ProfitabilityView />}
      {activeView === 'deductions' && <DeductionsView />}
      {activeView === 'seasons' && <SeasonComparisonView />}
    </div>
  );
};

export default ProfitabilityDashboard;
