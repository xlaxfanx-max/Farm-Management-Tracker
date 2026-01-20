import React, { useState, useEffect } from 'react';
import { TreeDeciduous, ArrowUpRight, ArrowDownRight, Calendar, Loader2, RefreshCw } from 'lucide-react';
import { fieldTreesAPI } from '../../services/api';

/**
 * TreeSummaryCard - Display tree count summary for a field
 *
 * Shows:
 * - Satellite detected tree count
 * - Manual tree count (if available)
 * - Difference comparison
 * - Trees per acre
 * - Canopy coverage percentage
 * - Last detection date
 */
const TreeSummaryCard = ({
  fieldId,
  className = '',
  onViewHistory = null,
  onRunDetection = null,
}) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = async () => {
    if (!fieldId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fieldTreesAPI.getSummary(fieldId);
      setSummary(response.data);
    } catch (err) {
      console.error('Failed to fetch tree summary:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
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

  const hasDetectionData = summary?.satellite_tree_count !== null;
  const hasManualData = summary?.manual_tree_count !== null;

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center">
          <TreeDeciduous className="w-5 h-5 text-green-600 mr-2" />
          <h3 className="font-semibold text-gray-900">Tree Inventory</h3>
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
        {!hasDetectionData && !hasManualData ? (
          /* No Data State */
          <div className="text-center py-4">
            <TreeDeciduous className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-3">No tree data available</p>
            {onRunDetection && (
              <button
                onClick={onRunDetection}
                className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
              >
                Run Tree Detection
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Main Count Display */}
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-gray-900">
                {summary.satellite_tree_count?.toLocaleString() ||
                  summary.manual_tree_count?.toLocaleString() ||
                  '—'}
              </div>
              <div className="text-sm text-gray-500">
                {hasDetectionData ? 'Detected Trees' : 'Manual Count'}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Trees per Acre */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-lg font-semibold text-gray-900">
                  {(summary.satellite_trees_per_acre || summary.manual_trees_per_acre)?.toFixed(0) || '—'}
                </div>
                <div className="text-xs text-gray-500">Trees/Acre</div>
              </div>

              {/* Canopy Coverage */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-lg font-semibold text-gray-900">
                  {summary.canopy_coverage_percent?.toFixed(1) || '—'}
                  {summary.canopy_coverage_percent && '%'}
                </div>
                <div className="text-xs text-gray-500">Canopy Coverage</div>
              </div>
            </div>

            {/* Comparison (if both manual and satellite data) */}
            {hasDetectionData && hasManualData && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">vs Manual Count</div>
                  <div className={`flex items-center text-sm font-medium ${
                    summary.count_difference > 0 ? 'text-green-600' :
                    summary.count_difference < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {summary.count_difference > 0 ? (
                      <ArrowUpRight className="w-4 h-4 mr-1" />
                    ) : summary.count_difference < 0 ? (
                      <ArrowDownRight className="w-4 h-4 mr-1" />
                    ) : null}
                    {summary.count_difference > 0 ? '+' : ''}
                    {summary.count_difference} trees
                    {summary.count_difference_percent && (
                      <span className="ml-1 text-xs">
                        ({summary.count_difference_percent > 0 ? '+' : ''}
                        {summary.count_difference_percent}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Manual: {summary.manual_tree_count?.toLocaleString()}
                </div>
              </div>
            )}

            {/* Detection Date */}
            {summary.detection_date && (
              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="w-4 h-4 mr-1" />
                <span>
                  Detected from {new Date(summary.detection_date).toLocaleDateString()} imagery
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex space-x-2">
              {onViewHistory && (
                <button
                  onClick={onViewHistory}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  View History
                </button>
              )}
              {onRunDetection && (
                <button
                  onClick={onRunDetection}
                  className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  New Detection
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TreeSummaryCard;
