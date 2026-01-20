import React, { useState, useEffect } from 'react';
import { Calendar, Loader2, RefreshCw, ArrowUp, Mountain, Thermometer } from 'lucide-react';
import { fieldLidarAPI, LIDAR_CONSTANTS } from '../../services/api';

/**
 * LiDARSummaryCard - Display LiDAR tree detection and terrain summary for a field
 *
 * Shows:
 * - LiDAR detected tree count
 * - Average/min/max tree height
 * - Trees per acre
 * - Terrain info (slope, elevation range)
 * - Frost risk level
 * - Last processing date
 */
const LiDARSummaryCard = ({
  fieldId,
  className = '',
  onViewTrees = null,
  onUploadLiDAR = null,
}) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = async () => {
    if (!fieldId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fieldLidarAPI.getSummary(fieldId);
      setSummary(response.data);
    } catch (err) {
      console.error('Failed to fetch LiDAR summary:', err);
      // If no data, just set empty summary
      if (err.response?.status === 404) {
        setSummary(null);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldId]);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  const hasData = summary?.lidar_tree_count > 0;
  const frostRiskConfig = LIDAR_CONSTANTS.FROST_RISK_LEVELS.find(
    f => f.value === summary?.frost_risk_level
  );

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="font-semibold text-gray-900">LiDAR Analysis</h3>
        </div>
        <button
          onClick={fetchSummary}
          className="p-1 hover:bg-gray-100 rounded"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {!hasData ? (
          /* No Data State */
          <div className="text-center py-4">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-gray-500 text-sm mb-3">No LiDAR data available</p>
            {onUploadLiDAR && (
              <button
                onClick={onUploadLiDAR}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                Upload LiDAR Data
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Main Count Display */}
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-gray-900">
                {summary.lidar_tree_count?.toLocaleString() || '—'}
              </div>
              <div className="text-sm text-gray-500">
                LiDAR Detected Trees
              </div>
            </div>

            {/* Height Stats */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <ArrowUp className="w-4 h-4 mr-1 text-green-600" />
                  Tree Heights
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {summary.lidar_min_tree_height_m?.toFixed(1) || '—'}m
                  </div>
                  <div className="text-xs text-gray-500">Min</div>
                </div>
                <div className="border-l border-r border-gray-200">
                  <div className="text-lg font-semibold text-green-700">
                    {summary.lidar_avg_tree_height_m?.toFixed(1) || '—'}m
                  </div>
                  <div className="text-xs text-gray-500">Average</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900">
                    {summary.lidar_max_tree_height_m?.toFixed(1) || '—'}m
                  </div>
                  <div className="text-xs text-gray-500">Max</div>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Trees per Acre */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-lg font-semibold text-gray-900">
                  {summary.lidar_trees_per_acre?.toFixed(0) || '—'}
                </div>
                <div className="text-xs text-gray-500">Trees/Acre</div>
              </div>

              {/* Average Slope */}
              {summary.avg_slope_degrees && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-lg font-semibold text-gray-900 flex items-center">
                    <Mountain className="w-4 h-4 mr-1 text-gray-400" />
                    {summary.avg_slope_degrees?.toFixed(1)}°
                  </div>
                  <div className="text-xs text-gray-500">Avg Slope</div>
                </div>
              )}
            </div>

            {/* Frost Risk */}
            {summary.frost_risk_level && (
              <div className={`rounded-lg p-3 mb-4 ${
                summary.frost_risk_level === 'LOW' ? 'bg-green-50' :
                summary.frost_risk_level === 'MODERATE' ? 'bg-yellow-50' :
                'bg-red-50'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center">
                    <Thermometer className="w-4 h-4 mr-1" />
                    Frost Risk
                  </span>
                  <span
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: frostRiskConfig?.color + '20',
                      color: frostRiskConfig?.color
                    }}
                  >
                    {frostRiskConfig?.label || summary.frost_risk_level}
                  </span>
                </div>
                {summary.frost_risk_area_percent && (
                  <div className="text-xs text-gray-500 mt-1">
                    {summary.frost_risk_area_percent.toFixed(1)}% of field in high-risk zones
                  </div>
                )}
              </div>
            )}

            {/* Processing Date */}
            {summary.latest_lidar_date && (
              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="w-4 h-4 mr-1" />
                <span>
                  Processed {new Date(summary.latest_lidar_date).toLocaleDateString()}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex space-x-2">
              {onViewTrees && (
                <button
                  onClick={onViewTrees}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  View Trees on Map
                </button>
              )}
              {onUploadLiDAR && (
                <button
                  onClick={onUploadLiDAR}
                  className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Upload New Data
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LiDARSummaryCard;
