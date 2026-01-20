import React, { useEffect, useState, useMemo } from 'react';
import { CircleMarker, LayerGroup, Popup, useMap } from 'react-leaflet';
import { fieldTreesAPI, TREE_DETECTION_CONSTANTS } from '../../services/api';

/**
 * TreeMapLayer - Leaflet layer for displaying detected trees
 *
 * Features:
 * - Renders trees as circle markers
 * - Color-coded by confidence, status, or NDVI
 * - Click to see tree details
 * - Optional clustering for many trees
 * - Respects zoom level for visibility
 */
const TreeMapLayer = ({
  fieldId,
  detectionRunId = null,
  visible = true,
  colorBy = 'confidence', // 'confidence' | 'status' | 'ndvi'
  minConfidence = 0,
  showOnlyStatus = null, // null = all, or 'active', 'uncertain', etc.
  onTreeClick = null,
  markerSize = 4,
}) => {
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const map = useMap();

  // Fetch trees when field changes
  useEffect(() => {
    if (!fieldId || !visible) return;

    const fetchTrees = async () => {
      setLoading(true);
      setError(null);

      try {
        let response;
        if (detectionRunId) {
          // Get trees from specific detection run
          response = await fieldTreesAPI.getTrees(fieldId, { run_id: detectionRunId });
        } else {
          // Get trees from latest approved run
          response = await fieldTreesAPI.getTrees(fieldId);
        }

        const treesData = response.data.trees || response.data;
        setTrees(Array.isArray(treesData) ? treesData : []);
      } catch (err) {
        console.error('Failed to fetch trees:', err);
        setError(err.message);
        setTrees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTrees();
  }, [fieldId, detectionRunId, visible]);

  // Filter trees based on props
  const filteredTrees = useMemo(() => {
    let result = trees;

    // Filter by minimum confidence
    if (minConfidence > 0) {
      result = result.filter(t => t.confidence_score >= minConfidence);
    }

    // Filter by status
    if (showOnlyStatus) {
      result = result.filter(t => t.status === showOnlyStatus);
    }

    return result;
  }, [trees, minConfidence, showOnlyStatus]);

  // Get color for tree based on colorBy setting
  const getTreeColor = (tree) => {
    switch (colorBy) {
      case 'status':
        const statusConfig = TREE_DETECTION_CONSTANTS.TREE_STATUSES.find(
          s => s.value === tree.status
        );
        return statusConfig?.color || '#22c55e';

      case 'ndvi':
        // Green gradient based on NDVI (0-1)
        const ndvi = tree.ndvi_value || 0.5;
        if (ndvi < 0.3) return '#fbbf24'; // Yellow - low NDVI
        if (ndvi < 0.5) return '#84cc16'; // Light green
        if (ndvi < 0.7) return '#22c55e'; // Green
        return '#15803d'; // Dark green - high NDVI

      case 'confidence':
      default:
        // Blue gradient based on confidence
        const conf = tree.confidence_score || 0.5;
        if (conf < 0.5) return '#f59e0b'; // Orange - low confidence
        if (conf < 0.7) return '#3b82f6'; // Blue
        if (conf < 0.9) return '#22c55e'; // Green
        return '#16a34a'; // Dark green - high confidence
    }
  };

  // Get opacity based on zoom level
  const getOpacity = () => {
    const zoom = map.getZoom();
    if (zoom < 15) return 0.3;
    if (zoom < 17) return 0.6;
    return 0.8;
  };

  // Get marker size based on zoom
  const getMarkerRadius = () => {
    const zoom = map.getZoom();
    if (zoom < 15) return markerSize * 0.5;
    if (zoom < 17) return markerSize;
    if (zoom < 19) return markerSize * 1.5;
    return markerSize * 2;
  };

  if (!visible || loading || trees.length === 0) {
    return null;
  }

  return (
    <LayerGroup>
      {filteredTrees.map((tree) => (
        <CircleMarker
          key={tree.id}
          center={[tree.latitude, tree.longitude]}
          radius={getMarkerRadius()}
          pathOptions={{
            color: getTreeColor(tree),
            fillColor: getTreeColor(tree),
            fillOpacity: getOpacity(),
            weight: 1,
          }}
          eventHandlers={{
            click: () => onTreeClick && onTreeClick(tree),
          }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold mb-1">Tree #{tree.id}</div>
              <table className="text-xs">
                <tbody>
                  <tr>
                    <td className="pr-2 text-gray-500">Status:</td>
                    <td className="font-medium capitalize">{tree.status}</td>
                  </tr>
                  <tr>
                    <td className="pr-2 text-gray-500">Confidence:</td>
                    <td>{(tree.confidence_score * 100).toFixed(0)}%</td>
                  </tr>
                  {tree.ndvi_value && (
                    <tr>
                      <td className="pr-2 text-gray-500">NDVI:</td>
                      <td>{tree.ndvi_value.toFixed(3)}</td>
                    </tr>
                  )}
                  {tree.canopy_diameter_m && (
                    <tr>
                      <td className="pr-2 text-gray-500">Canopy:</td>
                      <td>{tree.canopy_diameter_m.toFixed(1)}m</td>
                    </tr>
                  )}
                  <tr>
                    <td className="pr-2 text-gray-500">Location:</td>
                    <td className="font-mono text-xs">
                      {tree.latitude.toFixed(6)}, {tree.longitude.toFixed(6)}
                    </td>
                  </tr>
                </tbody>
              </table>
              {tree.is_verified && (
                <div className="mt-1 text-green-600 text-xs">Verified</div>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </LayerGroup>
  );
};

/**
 * TreeMapLegend - Legend component for tree layer
 */
export const TreeMapLegend = ({ colorBy = 'confidence' }) => {
  const getLegendItems = () => {
    switch (colorBy) {
      case 'status':
        return TREE_DETECTION_CONSTANTS.TREE_STATUSES.map(s => ({
          color: s.color,
          label: s.label,
        }));

      case 'ndvi':
        return [
          { color: '#fbbf24', label: 'Low NDVI (<0.3)' },
          { color: '#84cc16', label: 'Medium NDVI (0.3-0.5)' },
          { color: '#22c55e', label: 'Good NDVI (0.5-0.7)' },
          { color: '#15803d', label: 'High NDVI (>0.7)' },
        ];

      case 'confidence':
      default:
        return [
          { color: '#f59e0b', label: 'Low (<50%)' },
          { color: '#3b82f6', label: 'Medium (50-70%)' },
          { color: '#22c55e', label: 'Good (70-90%)' },
          { color: '#16a34a', label: 'High (>90%)' },
        ];
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-3">
      <div className="text-xs font-semibold text-gray-700 mb-2 capitalize">
        Trees by {colorBy}
      </div>
      <div className="space-y-1">
        {getLegendItems().map((item, i) => (
          <div key={i} className="flex items-center text-xs">
            <span
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TreeMapLayer;
