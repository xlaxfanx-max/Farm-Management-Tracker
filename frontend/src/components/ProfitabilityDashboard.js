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
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { harvestAnalyticsAPI, packinghousesAPI } from '../services/api';

const ProfitabilityDashboard = () => {
  // Tab state: profitability, deductions, seasons
  const [activeView, setActiveView] = useState('profitability');

  // Data states
  const [profitabilityData, setProfitabilityData] = useState(null);
  const [deductionData, setDeductionData] = useState(null);
  const [seasonData, setSeasonData] = useState(null);
  const [packinghouses, setPackinghouses] = useState([]);

  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    season: '',
    packinghouse: '',
  });
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [expandedFields, setExpandedFields] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});

  // Fetch packinghouses for filter dropdown
  useEffect(() => {
    const fetchPackinghouses = async () => {
      try {
        const response = await packinghousesAPI.getAll();
        // Handle both paginated (results array) and non-paginated responses
        const data = response.data?.results || response.data || [];
        setPackinghouses(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching packinghouses:', err);
        setPackinghouses([]);
      }
    };
    fetchPackinghouses();
  }, []);

  // Fetch data when view or filters change
  useEffect(() => {
    fetchData();
  }, [activeView, filters]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (activeView === 'profitability') {
        const response = await harvestAnalyticsAPI.getProfitability(filters);
        setProfitabilityData(response.data);
        setAvailableSeasons(response.data.available_seasons || []);
        if (!filters.season && response.data.season) {
          setFilters(prev => ({ ...prev, season: response.data.season }));
        }
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

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleFieldExpand = (fieldId) => {
    setExpandedFields(prev => ({
      ...prev,
      [fieldId]: !prev[fieldId]
    }));
  };

  const toggleCategoryExpand = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value, decimals = 0) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const ProfitIndicator = ({ value, showArrow = true }) => {
    if (value === null || value === undefined) return <span className="text-gray-400">-</span>;
    const isPositive = value >= 0;
    const colorClass = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

    return (
      <span className={`flex items-center gap-1 ${colorClass}`}>
        {showArrow && (isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
        {formatCurrency(value)}
      </span>
    );
  };

  const ChangeIndicator = ({ value }) => {
    if (value === null || value === undefined) return <span className="text-gray-400">-</span>;
    const isPositive = value >= 0;
    const colorClass = isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

    return (
      <span className={`flex items-center gap-0.5 text-sm ${colorClass}`}>
        <Icon size={14} />
        {formatPercent(value)}
      </span>
    );
  };

  // Filters Bar Component
  const FiltersBar = () => (
    <div className="flex flex-wrap gap-4 mb-6">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Season</label>
        <select
          value={filters.season}
          onChange={(e) => handleFilterChange('season', e.target.value)}
          className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          {availableSeasons.map(season => (
            <option key={season} value={season}>{season}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Packinghouse</label>
        <select
          value={filters.packinghouse}
          onChange={(e) => handleFilterChange('packinghouse', e.target.value)}
          className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
    const { summary, by_field, by_pool, data_level, message } = profitabilityData;

    const hasFieldData = by_field && by_field.length > 0;
    const hasPoolData = by_pool && by_pool.length > 0;

    return (
      <div className="space-y-6">
        {/* Info Message */}
        {message && (
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <AlertCircle size={18} />
              <span>{message}</span>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total Bins</span>
              <BarChart3 size={18} className="text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatNumber(summary.total_bins)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {hasFieldData ? `${summary.total_fields} fields` : hasPoolData ? `${summary.total_pools} pools` : 'No data'}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Gross Revenue</span>
              <DollarSign size={18} className="text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(summary.gross_revenue)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Fruit sales
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Deductions</span>
              <Minus size={18} className="text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(summary.total_deductions)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Packing, pick/haul, etc.
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Net Return</span>
              <TrendingUp size={18} className="text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(summary.net_settlement)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {summary.return_margin}% of gross
            </div>
          </div>
        </div>

        {/* Per-Bin Summary */}
        {summary.total_bins > 0 && (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Per-Bin Breakdown</h4>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Gross: {formatCurrency(summary.gross_revenue / summary.total_bins)}/bin</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Deductions: {formatCurrency(summary.total_deductions / summary.total_bins)}/bin</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-600 rounded"></div>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Net: {formatCurrency(summary.avg_net_per_bin || summary.net_settlement / summary.total_bins)}/bin
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Field-by-Field Breakdown */}
        {hasFieldData && (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Returns by Field</h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Field</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bins</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gross</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Deductions</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Net Return</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">$/Bin</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {by_field.map((field, idx) => (
                    <React.Fragment key={field.field_id}>
                      <tr
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => toggleFieldExpand(field.field_id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {expandedFields[field.field_id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">{field.field_name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{field.farm_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                          {formatNumber(field.total_bins)}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">
                          {formatCurrency(field.gross_revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400">
                          {formatCurrency(field.total_deductions)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-blue-600 dark:text-blue-400">
                          {formatCurrency(field.net_settlement)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                          {formatCurrency(field.net_per_bin)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            field.return_margin >= 50 ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                            field.return_margin >= 30 ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                            field.return_margin >= 10 ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                            'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          }`}>
                            {field.return_margin}%
                          </span>
                        </td>
                      </tr>
                      {expandedFields[field.field_id] && (
                        <tr>
                          <td colSpan={7} className="bg-gray-50 dark:bg-gray-750 px-4 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Packinghouse:</span>
                                <span className="ml-2 text-gray-900 dark:text-gray-100">{field.packinghouse_name}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Pool:</span>
                                <span className="ml-2 text-gray-900 dark:text-gray-100">{field.pool_name}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Gross/Bin:</span>
                                <span className="ml-2 text-green-600 dark:text-green-400">{formatCurrency(field.gross_per_bin)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Deductions/Bin:</span>
                                <span className="ml-2 text-orange-600 dark:text-orange-400">{formatCurrency(field.deductions_per_bin)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Net/Bin:</span>
                                <span className="ml-2 text-blue-600 dark:text-blue-400">{formatCurrency(field.net_per_bin)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Deliveries:</span>
                                <span className="ml-2 text-gray-900 dark:text-gray-100">{field.delivery_count}</span>
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
          </div>
        )}

        {/* Pool-Level Breakdown (when no field data available) */}
        {!hasFieldData && hasPoolData && (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Returns by Pool</h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pool</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bins</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gross</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Deductions</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Net Return</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">$/Bin</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {by_pool.map((pool) => (
                    <tr key={pool.pool_id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{pool.pool_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{pool.packinghouse_name} - {pool.commodity}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {formatNumber(pool.total_bins)}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">
                        {formatCurrency(pool.gross_revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400">
                        {formatCurrency(pool.total_deductions)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-blue-600 dark:text-blue-400">
                        {formatCurrency(pool.net_settlement)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                        {formatCurrency(pool.net_per_bin)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          pool.return_margin >= 50 ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                          pool.return_margin >= 30 ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                          pool.return_margin >= 10 ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                          'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                        }`}>
                          {pool.return_margin}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No data state */}
        {!hasFieldData && !hasPoolData && (
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">No settlement data available for this season.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Upload packinghouse statements to see profitability analysis.</p>
          </div>
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
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Bins</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatNumber(deductionData.total_bins)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Deductions</div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(deductionData.grand_total)}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Deduction/Bin</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(deductionData.grand_total_per_bin)}
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Deductions by Category</h4>
          </div>

          <div className="divide-y dark:divide-gray-700">
            {deductionData.by_category.map((category) => (
              <div key={category.category}>
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => toggleCategoryExpand(category.category)}
                >
                  <div className="flex items-center gap-3">
                    {expandedCategories[category.category] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{category.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{category.items.length} items</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(category.total_amount)}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatCurrency(category.per_bin)}/bin</span>
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-600 rounded">{category.percent_of_total}%</span>
                    </div>
                  </div>
                </div>

                {expandedCategories[category.category] && (
                  <div className="bg-gray-50 dark:bg-gray-750 px-4 py-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                          <th className="text-left py-2">Description</th>
                          <th className="text-right py-2">Amount</th>
                          <th className="text-right py-2">Per Bin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y dark:divide-gray-600">
                        {category.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 text-gray-700 dark:text-gray-300">{item.description}</td>
                            <td className="py-2 text-right text-gray-700 dark:text-gray-300">{formatCurrency(item.amount)}</td>
                            <td className="py-2 text-right text-gray-500 dark:text-gray-400">{formatCurrency(item.per_bin)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Visual breakdown bar */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Distribution by Category</h4>
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
                  <span className="text-gray-600 dark:text-gray-400">{cat.label} ({cat.percent_of_total}%)</span>
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
      return (
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No multi-season data available for comparison</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Season Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {seasonData.seasons.map((season, idx) => (
            <div key={season.season} className={`bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-4 ${idx === 0 ? 'ring-2 ring-blue-500' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{season.season}</h4>
                {idx === 0 && <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">Current</span>}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Total Bins</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 dark:text-gray-100">{formatNumber(season.total_bins)}</span>
                    {season.volume_change !== null && season.volume_change !== undefined && (
                      <ChangeIndicator value={season.volume_change} />
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Gross Revenue</span>
                  <span className="text-green-600 dark:text-green-400">{formatCurrency(season.gross_revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Deductions</span>
                  <span className="text-orange-600 dark:text-orange-400">{formatCurrency(season.total_deductions)}</span>
                </div>
                <div className="border-t dark:border-gray-600 pt-2 mt-2">
                  <div className="flex justify-between font-medium">
                    <span className="text-gray-700 dark:text-gray-300">Net Return</span>
                    <span className="text-blue-600 dark:text-blue-400">{formatCurrency(season.net_settlement)}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Net/Bin</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(season.net_per_bin)}</span>
                    {season.net_per_bin_change !== null && season.net_per_bin_change !== undefined && (
                      <ChangeIndicator value={season.net_per_bin_change} />
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Return Margin</span>
                  <span className={`font-medium ${season.return_margin >= 50 ? 'text-green-600 dark:text-green-400' : season.return_margin >= 30 ? 'text-blue-600 dark:text-blue-400' : season.return_margin >= 10 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                    {season.return_margin}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trend Table */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-gray-100">Per-Bin Metrics Trend</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Season</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bins</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gross/Bin</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Deductions/Bin</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Net/Bin</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {seasonData.seasons.map((season) => (
                  <tr key={season.season} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{season.season}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{formatNumber(season.total_bins)}</td>
                    <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{formatCurrency(season.gross_per_bin)}</td>
                    <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400">{formatCurrency(season.deductions_per_bin)}</td>
                    <td className="px-4 py-3 text-right font-medium text-blue-600 dark:text-blue-400">{formatCurrency(season.net_per_bin)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        season.return_margin >= 50 ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                        season.return_margin >= 30 ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                        season.return_margin >= 10 ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                        'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      }`}>
                        {season.return_margin}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading analytics...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Tabs */}
      <div className="flex border-b dark:border-gray-700">
        <button
          onClick={() => setActiveView('profitability')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeView === 'profitability'
              ? 'border-green-600 text-green-600 dark:text-green-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <DollarSign size={16} />
            Profitability
          </div>
        </button>
        <button
          onClick={() => setActiveView('deductions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeView === 'deductions'
              ? 'border-orange-600 text-orange-600 dark:text-orange-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <PieChart size={16} />
            Deductions
          </div>
        </button>
        <button
          onClick={() => setActiveView('seasons')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeView === 'seasons'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Calendar size={16} />
            Season Comparison
          </div>
        </button>
      </div>

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
