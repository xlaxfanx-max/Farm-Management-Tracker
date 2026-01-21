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
  Minus
} from 'lucide-react';
import {
  packinghouseAnalyticsAPI,
  packinghousesAPI,
  PACKINGHOUSE_CONSTANTS
} from '../../services/api';

const PackinghouseAnalytics = () => {
  const [activeView, setActiveView] = useState('block-performance');
  const [packinghouses, setPackinghouses] = useState([]);
  const [blockPerformance, setBlockPerformance] = useState([]);
  const [packoutTrends, setPackoutTrends] = useState([]);
  const [settlementComparison, setSettlementComparison] = useState([]);
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
  }, [activeView, filters]);

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
  ];

  return (
    <div className="space-y-6">
      {/* View Selection and Filters */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex space-x-2">
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
        </>
      )}
    </div>
  );
};

export default PackinghouseAnalytics;
