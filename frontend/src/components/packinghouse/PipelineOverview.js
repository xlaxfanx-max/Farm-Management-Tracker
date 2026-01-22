// =============================================================================
// PIPELINE OVERVIEW COMPONENT
// Shows the harvest → delivery → packout → settlement flow
// =============================================================================

import React, { useState, useEffect } from 'react';
import {
  Wheat,
  Truck,
  Package,
  DollarSign,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronRight,
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
      case 'harvest': return <Wheat className="w-4 h-4 text-orange-600" />;
      case 'delivery': return <Truck className="w-4 h-4 text-blue-600" />;
      case 'packout': return <Package className="w-4 h-4 text-purple-600" />;
      case 'settlement': return <DollarSign className="w-4 h-4 text-green-600" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getActivityBgColor = (type) => {
    switch (type) {
      case 'harvest': return 'bg-orange-50 border-orange-200';
      case 'delivery': return 'bg-blue-50 border-blue-200';
      case 'packout': return 'bg-purple-50 border-purple-200';
      case 'settlement': return 'bg-green-50 border-green-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-600" />
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

  const { pipeline_stages, pool_status, pipeline_efficiency, recent_activity, current_season, available_seasons } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Harvest to Cash Pipeline
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-gray-600 dark:text-gray-400 flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              Season:
            </span>
            <select
              value={selectedSeason || data?.selected_season || ''}
              onChange={handleSeasonChange}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-800 dark:text-gray-200 dark:bg-gray-700 text-sm font-medium"
            >
              {data?.available_seasons?.map((season) => (
                <option key={season} value={season}>
                  {season}
                </option>
              ))}
            </select>
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              Track fruit from field to payment
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

      {/* Pipeline Flow Visualization */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          {/* Stage 1: Harvest */}
          <div className="flex-1 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 mb-3">
              <Wheat className="w-8 h-8 text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {pipeline_stages.harvest.label}
            </h3>
            <p className="text-2xl font-bold text-orange-600 mt-1">
              {formatNumber(pipeline_stages.harvest.total_bins)}
            </p>
            <p className="text-sm text-gray-500">bins from {pipeline_stages.harvest.total_count} harvests</p>
            <div className="mt-2 flex justify-center gap-2 text-xs">
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                {pipeline_stages.harvest.breakdown.in_progress} active
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                {pipeline_stages.harvest.breakdown.verified} verified
              </span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center px-4">
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-500 mt-1">
              {pipeline_efficiency.harvest_to_delivery}%
            </span>
          </div>

          {/* Stage 2: Delivery */}
          <div className="flex-1 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-3">
              <Truck className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {pipeline_stages.delivery.label}
            </h3>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {formatNumber(pipeline_stages.delivery.total_bins)}
            </p>
            <p className="text-sm text-gray-500">bins in {pipeline_stages.delivery.total_count} deliveries</p>
            <div className="mt-2 flex justify-center gap-2 text-xs">
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                {pipeline_stages.delivery.breakdown.linked} linked
              </span>
              {pipeline_stages.delivery.breakdown.unlinked > 0 && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                  {pipeline_stages.delivery.breakdown.unlinked} unlinked
                </span>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex flex-col items-center px-4">
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-500 mt-1">
              {pipeline_efficiency.delivery_to_packout}%
            </span>
          </div>

          {/* Stage 3: Packout */}
          <div className="flex-1 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-3">
              <Package className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {pipeline_stages.packout.label}
            </h3>
            <p className="text-2xl font-bold text-purple-600 mt-1">
              {formatNumber(pipeline_stages.packout.total_bins)}
            </p>
            <p className="text-sm text-gray-500">bins in {pipeline_stages.packout.total_count} reports</p>
            <div className="mt-2 flex justify-center gap-2 text-xs">
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
          <div className="flex flex-col items-center px-4">
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-500 mt-1">
              {pipeline_efficiency.packout_to_settlement}%
            </span>
          </div>

          {/* Stage 4: Settlement */}
          <div className="flex-1 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {pipeline_stages.settlement.label}
            </h3>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(pipeline_stages.settlement.total_revenue)}
            </p>
            <p className="text-sm text-gray-500">{formatNumber(pipeline_stages.settlement.total_bins)} bins settled</p>
            <div className="mt-2 flex justify-center gap-2 text-xs">
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                ${pipeline_stages.settlement.avg_per_bin}/bin
              </span>
            </div>
          </div>
        </div>

        {/* Overall Efficiency Bar */}
        <div className="mt-6 pt-6 border-t dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Overall Pipeline Efficiency
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {pipeline_efficiency.overall}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-orange-500 via-blue-500 via-purple-500 to-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(pipeline_efficiency.overall, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Percentage of harvested bins that have been settled
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
            <Clock className="w-5 h-5 text-orange-600" />
            Recent Activity
          </h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {recent_activity.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recent activity</p>
            ) : (
              recent_activity.map((item, index) => (
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
      {(pipeline_stages.delivery.breakdown.unlinked > 0 || pool_status.closed > 0) && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Action Items
          </h3>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            {pipeline_stages.delivery.breakdown.unlinked > 0 && (
              <li>
                • {pipeline_stages.delivery.breakdown.unlinked} deliveries not linked to a harvest record
              </li>
            )}
            {pool_status.closed > 0 && (
              <li>
                • {pool_status.closed} pools are closed and awaiting settlement
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PipelineOverview;
