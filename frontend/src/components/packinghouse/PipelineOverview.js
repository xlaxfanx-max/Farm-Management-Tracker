// =============================================================================
// PIPELINE OVERVIEW COMPONENT
// Shows the packout → settlement flow for growers who receive packinghouse reports
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Package,
  DollarSign,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Clock,
  Layers,
  Calendar
} from 'lucide-react';
import { packinghouseAnalyticsAPI } from '../../services/api';

const PipelineOverview = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState('');

  useEffect(() => {
    fetchPipelineData();
  }, [selectedSeason]);

  const fetchPipelineData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = selectedSeason ? { season: selectedSeason } : {};
      const response = await packinghouseAnalyticsAPI.getPipeline(params);
      setData(response.data);
      // Set selected season from response if not already set
      if (!selectedSeason && response.data.selected_season) {
        setSelectedSeason(response.data.selected_season);
      }
    } catch (err) {
      console.error('Error fetching pipeline data:', err);
      setError('Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  };

  const handleSeasonChange = (e) => {
    setSelectedSeason(e.target.value);
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
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'packout': return <Package className="w-4 h-4 text-purple-600" />;
      case 'settlement': return <DollarSign className="w-4 h-4 text-green-600" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActivityBgColor = (type) => {
    switch (type) {
      case 'packout': return 'bg-purple-50 border-purple-200';
      case 'settlement': return 'bg-green-50 border-green-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <AlertCircle className="inline w-5 h-5 mr-2" />
        {error}
        <button
          onClick={fetchPipelineData}
          className="ml-4 text-red-800 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { pipeline_stages, pool_status, pipeline_efficiency, recent_activity } = data;

  // Calculate settlement efficiency based on packed bins
  const packedBins = pipeline_stages.packout.total_bins || 0;
  const settledBins = pipeline_stages.settlement.total_bins || 0;

  // Calculate percentage - if no packouts but have settlements, that's a data issue
  const settlementPercent = packedBins > 0 ? Math.round((settledBins / packedBins) * 100) : (settledBins > 0 ? 999 : 0);
  const hasMissingPackouts = settledBins > packedBins && settledBins > 0;
  const missingPackoutBins = hasMissingPackouts ? Math.round(settledBins - packedBins) : 0;

  // Filter recent activity to only show packout and settlement
  const filteredActivity = recent_activity?.filter(
    item => item.type === 'packout' || item.type === 'settlement'
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Packing to Payment Pipeline
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-gray-600 dark:text-gray-400 flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              Season:
            </span>
            <select
              value={selectedSeason || data?.selected_season || ''}
              onChange={handleSeasonChange}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-800 dark:text-gray-200 dark:bg-gray-700 text-sm font-medium"
            >
              {data?.available_seasons?.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              Track packout reports to settlement
            </span>
          </div>
        </div>
        <button
          onClick={fetchPipelineData}
          className="flex items-center gap-2 px-3 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Pipeline Flow Visualization - Simplified: Packed → Settled */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-center gap-8">
          {/* Stage 1: Packout */}
          <div className="flex-1 max-w-xs text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-3">
              <Package className="w-10 h-10 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
              {pipeline_stages.packout.label}
            </h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">
              {formatNumber(pipeline_stages.packout.total_bins)}
            </p>
            <p className="text-sm text-gray-500">bins in {pipeline_stages.packout.total_count} reports</p>
            <div className="mt-3 flex justify-center gap-2 text-xs">
              <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">
                {pipeline_stages.packout.avg_pack_percent}% packed
              </span>
              {pipeline_stages.packout.avg_house_percent > 0 && (
                <span className={`px-2 py-1 rounded ${
                  pipeline_stages.packout.avg_pack_percent >= pipeline_stages.packout.avg_house_percent
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  vs {pipeline_stages.packout.avg_house_percent}% house
                </span>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center px-6">
            <ArrowRight className="w-10 h-10 text-gray-400" />
            <span className="text-sm text-gray-500 mt-2 font-medium">
              {settlementPercent}%
            </span>
            <span className="text-xs text-gray-400">settled</span>
          </div>

          {/* Stage 2: Settlement */}
          <div className="flex-1 max-w-xs text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
              <DollarSign className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
              {pipeline_stages.settlement.label}
            </h3>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {formatCurrency(pipeline_stages.settlement.total_revenue)}
            </p>
            <p className="text-sm text-gray-500">{formatNumber(pipeline_stages.settlement.total_bins)} bins settled</p>
            <div className="mt-3 flex justify-center gap-2 text-xs">
              {pipeline_stages.settlement.avg_per_bin > 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                  ${formatNumber(pipeline_stages.settlement.avg_per_bin, 2)}/bin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-8 pt-6 border-t dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Settlement Progress
            </span>
            <span className={`text-sm font-bold ${hasMissingPackouts ? 'text-orange-600' : 'text-gray-900 dark:text-gray-100'}`}>
              {hasMissingPackouts ? (
                <span className="flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {formatNumber(settledBins)} / {formatNumber(packedBins)} bins
                </span>
              ) : (
                `${settlementPercent}%`
              )}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                hasMissingPackouts
                  ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                  : 'bg-gradient-to-r from-purple-500 to-green-500'
              }`}
              style={{ width: `${Math.min(settlementPercent, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {hasMissingPackouts
              ? `Settlements exceed packouts by ${formatNumber(missingPackoutBins)} bins - packout reports may be missing`
              : 'Percentage of packed bins that have been settled'
            }
          </p>
        </div>
      </div>

      {/* Pool Status & Recent Activity */}
      <div className="grid grid-cols-3 gap-6">
        {/* Pool Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Pool Status
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                Active
              </span>
              <span className="font-semibold">{pool_status.active}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                Closed (Pending Settlement)
              </span>
              <span className="font-semibold">{pool_status.closed}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                Settled
              </span>
              <span className="font-semibold">{pool_status.settled}</span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            Recent Activity
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {filteredActivity.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            ) : (
              filteredActivity.map((item, index) => (
                <div
                  key={`${item.type}-${item.id}-${index}`}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${getActivityBgColor(item.type)}`}
                >
                  <div className="mt-0.5">
                    {getActivityIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {item.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.field && `${item.field} • `}
                      {item.packinghouse && `${item.packinghouse} • `}
                      {formatDate(item.date)}
                    </p>
                  </div>
                  {item.bins && (
                    <span className="text-sm font-medium text-gray-700">
                      {formatNumber(item.bins)} bins
                    </span>
                  )}
                  {item.pack_percent && (
                    <span className={`text-sm font-medium ${
                      item.pack_percent >= (item.house_avg || 0)
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {item.pack_percent}%
                    </span>
                  )}
                  {item.net_return && (
                    <span className="text-sm font-medium text-green-600">
                      {formatCurrency(item.net_return)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Alerts/Warnings */}
      {(pool_status.closed > 0 || hasMissingPackouts) && (
        <div className={`border rounded-lg p-4 ${
          hasMissingPackouts
            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }`}>
          <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${
            hasMissingPackouts
              ? 'text-orange-800 dark:text-orange-200'
              : 'text-yellow-800 dark:text-yellow-200'
          }`}>
            <AlertCircle className="w-4 h-4" />
            Action Items
          </h3>
          <ul className={`text-sm space-y-1 ${
            hasMissingPackouts
              ? 'text-orange-700 dark:text-orange-300'
              : 'text-yellow-700 dark:text-yellow-300'
          }`}>
            {hasMissingPackouts && (
              <li>
                • <strong>Missing packout reports:</strong> {formatNumber(missingPackoutBins)} more bins have been settled than packed. Upload the corresponding packout reports to reconcile.
              </li>
            )}
            {pool_status.closed > 0 && (
              <li>
                • {pool_status.closed} pool{pool_status.closed > 1 ? 's are' : ' is'} closed and awaiting settlement
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PipelineOverview;
