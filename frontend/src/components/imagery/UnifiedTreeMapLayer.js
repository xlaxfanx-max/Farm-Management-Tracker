import React, { useEffect, useState, useMemo } from 'react';
import { CircleMarker, LayerGroup, Popup, useMap } from 'react-leaflet';
import { unifiedTreesAPI, UNIFIED_TREE_CONSTANTS } from '../../services/api';

/**
 * UnifiedTreeMapLayer - Leaflet layer for displaying unified trees
 *
 * Features:
 * - Renders unified trees (correlated from satellite + LiDAR) as circle markers
 * - Color by confidence, source, or status
 * - Visual indicators for verified and flagged trees
 * - Click to view details or open modal
 * - Zoom-responsive marker sizes
 */
const UnifiedTreeMapLayer = ({
  fieldId,
  visible = true,
  colorBy = 'source', // 'source' | 'confidence' | 'status'
  showOnlyStatus = null,
  showOnlyConfidence = null,
  showOnlySource = null,
  onTreeClick = null,
  highlightedTreeId = null,
}) => {
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState(null);
  const map = useMap();

  // Fetch unified trees when field changes
  useEffect(() => {
    if (!fieldId || !visible) return;

    const fetchTrees = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('[UnifiedTreeMapLayer] Fetching trees for field:', fieldId);
        const response = await unifiedTreesAPI.getForField(fieldId);
        console.log('[UnifiedTreeMapLayer] API response:', response.data);
        const treesData = response.data.trees || response.data || [];
        console.log('[UnifiedTreeMapLayer] Trees found:', treesData.length);
        setTrees(Array.isArray(treesData) ? treesData : []);
      } catch (err) {
        console.error('[UnifiedTreeMapLayer] Failed to fetch unified trees:', err);
        setError(err.message);
        setTrees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTrees();
  }, [fieldId, visible]);

  // Determine source type for a tree
  const getTreeSource = (tree) => {
    const hasSatellite = tree.satellite_observation_count > 0;
    const hasLidar = tree.lidar_observation_count > 0;
    if (hasSatellite && hasLidar) return 'both';
    if (hasLidar) return 'lidar';
    return 'satellite';
  };

  // Filter trees based on props
  const filteredTrees = useMemo(() => {
    let result = trees;

    // Filter by status
    if (showOnlyStatus) {
      result = result.filter(t => t.status === showOnlyStatus);
    }

    // Filter by confidence
    if (showOnlyConfidence) {
      result = result.filter(t => t.identity_confidence === showOnlyConfidence);
    }

    // Filter by source
    if (showOnlySource) {
      result = result.filter(t => {
        const source = getTreeSource(t);
        return source === showOnlySource;
      });
    }

    return result;
  }, [trees, showOnlyStatus, showOnlyConfidence, showOnlySource]);

  // Get color for tree based on colorBy setting
  const getTreeColor = (tree) => {
    switch (colorBy) {
      case 'confidence':
        const confidenceConfig = UNIFIED_TREE_CONSTANTS.CONFIDENCE_LEVELS.find(
          c => c.value === tree.identity_confidence
        );
        return confidenceConfig?.color || '#f59e0b';

      case 'status':
        const statusConfig = UNIFIED_TREE_CONSTANTS.TREE_STATUSES.find(
          s => s.value === tree.status
        );
        return statusConfig?.color || '#22c55e';

      case 'source':
      default:
        const source = getTreeSource(tree);
        const sourceConfig = UNIFIED_TREE_CONSTANTS.DATA_SOURCES.find(
          s => s.value === source
        );
        return sourceConfig?.color || '#3b82f6';
    }
  };

  // Get opacity based on zoom level
  const getOpacity = (tree) => {
    const zoom = map.getZoom();
    const baseOpacity = zoom < 16 ? 0.6 : zoom < 18 ? 0.7 : 0.8;

    // Highlight the selected tree
    if (tree.id === highlightedTreeId) return 1;

    return baseOpacity;
  };

  // Get marker size based on zoom
  const getMarkerRadius = (tree) => {
    const zoom = map.getZoom();
    let radius;
    if (zoom < 16) radius = 2;
    else if (zoom < 17) radius = 3;
    else if (zoom < 18) radius = 4;
    else if (zoom < 19) radius = 5;
    else radius = 6;

    // Larger radius for highlighted tree
    if (tree.id === highlightedTreeId) {
      radius += 2;
    }

    return radius;
  };

  // Get border style for special indicators
  const getBorderStyle = (tree) => {
    // Verified trees get double ring
    if (tree.is_verified) {
      return {
        weight: 2,
        dashArray: null,
      };
    }

    // Trees with feedback get dashed border
    if (tree.has_pending_feedback) {
      return {
        weight: 2,
        dashArray: '3,3',
      };
    }

    // Highlighted tree
    if (tree.id === highlightedTreeId) {
      return {
        weight: 3,
        dashArray: null,
      };
    }

    return {
      weight: 0.5,
      dashArray: null,
    };
  };

  // Format observation count string
  const formatObservationCount = (tree) => {
    const parts = [];
    if (tree.satellite_observation_count > 0) {
      parts.push(`${tree.satellite_observation_count} satellite`);
    }
    if (tree.lidar_observation_count > 0) {
      parts.push(`${tree.lidar_observation_count} LiDAR`);
    }
    return parts.join(', ') || 'No observations';
  };

  if (!visible || loading || trees.length === 0) {
    return null;
  }

  return (
    <LayerGroup>
      {filteredTrees.map((tree) => {
        const borderStyle = getBorderStyle(tree);
        const treeColor = getTreeColor(tree);

        return (
          <CircleMarker
            key={tree.id}
            center={[tree.latitude, tree.longitude]}
            radius={getMarkerRadius(tree)}
            pathOptions={{
              color: tree.id === highlightedTreeId ? '#1f2937' : treeColor,
              fillColor: treeColor,
              fillOpacity: getOpacity(tree),
              weight: borderStyle.weight,
              dashArray: borderStyle.dashArray,
            }}
            eventHandlers={{
              click: () => onTreeClick && onTreeClick(tree),
            }}
          >
            <Popup>
              <div className="text-sm min-w-[200px]">
                <div className="font-semibold mb-1 flex items-center justify-between">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Tree {tree.tree_label || `#${tree.id}`}
                  </span>
                  {tree.is_verified && (
                    <span className="text-green-600" title="Verified">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </div>

                <table className="text-xs w-full">
                  <tbody>
                    <tr>
                      <td className="pr-2 text-gray-500">Status:</td>
                      <td className="font-medium capitalize">{tree.status}</td>
                    </tr>
                    <tr>
                      <td className="pr-2 text-gray-500">Confidence:</td>
                      <td>
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-white text-xs capitalize"
                          style={{
                            backgroundColor: UNIFIED_TREE_CONSTANTS.CONFIDENCE_LEVELS.find(
                              c => c.value === tree.identity_confidence
                            )?.color || '#f59e0b'
                          }}
                        >
                          {tree.identity_confidence}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-2 text-gray-500">Sources:</td>
                      <td>{formatObservationCount(tree)}</td>
                    </tr>
                    {tree.height_m && (
                      <tr>
                        <td className="pr-2 text-gray-500">Height:</td>
                        <td>{tree.height_m.toFixed(1)}m ({(tree.height_m * 3.281).toFixed(1)}ft)</td>
                      </tr>
                    )}
                    {tree.canopy_diameter_m && (
                      <tr>
                        <td className="pr-2 text-gray-500">Canopy:</td>
                        <td>{tree.canopy_diameter_m.toFixed(1)}m diameter</td>
                      </tr>
                    )}
                    {tree.latest_ndvi !== null && tree.latest_ndvi !== undefined && (
                      <tr>
                        <td className="pr-2 text-gray-500">NDVI:</td>
                        <td>{tree.latest_ndvi.toFixed(3)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="pr-2 text-gray-500">Observed:</td>
                      <td>{tree.first_observed} to {tree.last_observed}</td>
                    </tr>
                  </tbody>
                </table>

                {onTreeClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTreeClick(tree);
                    }}
                    className="mt-2 w-full text-xs bg-purple-600 hover:bg-purple-700 text-white py-1 px-2 rounded flex items-center justify-center"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Details
                  </button>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </LayerGroup>
  );
};

/**
 * UnifiedTreeMapLegend - Legend component for unified tree layer
 */
export const UnifiedTreeMapLegend = ({ colorBy = 'source', onColorByChange }) => {
  const getLegendItems = () => {
    switch (colorBy) {
      case 'confidence':
        return UNIFIED_TREE_CONSTANTS.CONFIDENCE_LEVELS;

      case 'status':
        return UNIFIED_TREE_CONSTANTS.TREE_STATUSES;

      case 'source':
      default:
        return UNIFIED_TREE_CONSTANTS.DATA_SOURCES;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-700 flex items-center">
          <svg className="w-4 h-4 mr-1 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          Unified Trees
        </div>
        {onColorByChange && (
          <select
            value={colorBy}
            onChange={(e) => onColorByChange(e.target.value)}
            className="text-xs border rounded px-1 py-0.5"
          >
            <option value="source">By Source</option>
            <option value="confidence">By Confidence</option>
            <option value="status">By Status</option>
          </select>
        )}
      </div>
      <div className="space-y-1">
        {getLegendItems().map((item, i) => (
          <div key={i} className="flex items-center text-xs">
            <span
              className="w-3 h-3 rounded-full mr-2 border border-gray-300"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="flex items-center text-xs text-gray-500">
          <span className="w-3 h-3 rounded-full mr-2 border-2 border-gray-400" />
          <span>Verified</span>
        </div>
        <div className="flex items-center text-xs text-gray-500 mt-1">
          <span className="w-3 h-3 rounded-full mr-2 border border-dashed border-gray-400" />
          <span>Has Feedback</span>
        </div>
      </div>
    </div>
  );
};

/**
 * UnifiedTreeSummaryCard - Summary statistics card for unified trees
 */
export const UnifiedTreeSummaryCard = ({ fieldId }) => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fieldId) return;

    const fetchSummary = async () => {
      setLoading(true);
      try {
        const response = await unifiedTreesAPI.getSummary(fieldId);
        setSummary(response.data);
      } catch (err) {
        console.error('Failed to fetch tree summary:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [fieldId]);

  if (loading || !summary) {
    return (
      <div className="bg-white rounded-lg shadow p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
        <svg className="w-4 h-4 mr-1 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Unified Tree Summary
      </h3>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-2xl font-bold text-gray-900">{summary.total_trees}</div>
          <div className="text-xs text-gray-500">Total Trees</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600">{summary.active_trees}</div>
          <div className="text-xs text-gray-500">Active</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="text-xs font-medium text-gray-600 mb-2">By Source</div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <div className="font-semibold text-blue-600">{summary.trees_with_satellite - summary.trees_with_both}</div>
            <div className="text-gray-500">Satellite</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-emerald-600">{summary.trees_with_lidar - summary.trees_with_both}</div>
            <div className="text-gray-500">LiDAR</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-purple-600">{summary.trees_with_both}</div>
            <div className="text-gray-500">Both</div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="text-xs font-medium text-gray-600 mb-2">By Confidence</div>
        <div className="flex gap-1">
          {summary.high_confidence_count > 0 && (
            <div
              className="h-2 rounded bg-green-500"
              style={{ width: `${(summary.high_confidence_count / summary.total_trees) * 100}%` }}
              title={`High: ${summary.high_confidence_count}`}
            />
          )}
          {summary.medium_confidence_count > 0 && (
            <div
              className="h-2 rounded bg-amber-500"
              style={{ width: `${(summary.medium_confidence_count / summary.total_trees) * 100}%` }}
              title={`Medium: ${summary.medium_confidence_count}`}
            />
          )}
          {summary.low_confidence_count > 0 && (
            <div
              className="h-2 rounded bg-red-500"
              style={{ width: `${(summary.low_confidence_count / summary.total_trees) * 100}%` }}
              title={`Low: ${summary.low_confidence_count}`}
            />
          )}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{summary.high_confidence_count} high</span>
          <span>{summary.medium_confidence_count} medium</span>
          <span>{summary.low_confidence_count} low</span>
        </div>
      </div>

      {summary.verified_trees > 0 && (
        <div className="mt-2 text-xs text-green-600 flex items-center">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {summary.verified_trees} verified trees
        </div>
      )}
    </div>
  );
};

export default UnifiedTreeMapLayer;
