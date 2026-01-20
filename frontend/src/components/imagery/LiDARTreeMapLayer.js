import React, { useEffect, useState, useMemo } from 'react';
import { CircleMarker, LayerGroup, Popup, useMap } from 'react-leaflet';
import { fieldLidarAPI, LIDAR_CONSTANTS } from '../../services/api';

/**
 * LiDARTreeMapLayer - Leaflet layer for displaying LiDAR-detected trees
 *
 * Features:
 * - Renders LiDAR trees as circle markers with height-based colors
 * - Shows tree height, canopy diameter, ground elevation
 * - Click to see tree details
 * - Zoom-responsive marker sizes
 */
const LiDARTreeMapLayer = ({
  fieldId,
  visible = true,
  colorBy = 'height', // 'height' | 'status' | 'canopy'
  minHeight = 0,
  showOnlyStatus = null,
  onTreeClick = null,
  markerSize = 5,
}) => {
  const [trees, setTrees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [, setError] = useState(null);
  const map = useMap();

  // Fetch LiDAR trees when field changes
  useEffect(() => {
    if (!fieldId || !visible) return;

    const fetchTrees = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fieldLidarAPI.getTrees(fieldId);
        const treesData = response.data.trees || response.data || [];
        setTrees(Array.isArray(treesData) ? treesData : []);
      } catch (err) {
        console.error('Failed to fetch LiDAR trees:', err);
        setError(err.message);
        setTrees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTrees();
  }, [fieldId, visible]);

  // Filter trees based on props
  const filteredTrees = useMemo(() => {
    let result = trees;

    // Filter by minimum height
    if (minHeight > 0) {
      result = result.filter(t => t.height_m >= minHeight);
    }

    // Filter by status
    if (showOnlyStatus) {
      result = result.filter(t => t.status === showOnlyStatus);
    }

    return result;
  }, [trees, minHeight, showOnlyStatus]);

  // Get color for tree based on colorBy setting
  const getTreeColor = (tree) => {
    switch (colorBy) {
      case 'status':
        const statusConfig = LIDAR_CONSTANTS.TREE_STATUSES.find(
          s => s.value === tree.status
        );
        return statusConfig?.color || '#22c55e';

      case 'canopy':
        // Size gradient based on canopy diameter
        const canopy = tree.canopy_diameter_m || 2;
        if (canopy < 1.5) return '#93c5fd'; // Light blue - small
        if (canopy < 2.5) return '#3b82f6'; // Blue - medium
        if (canopy < 3.5) return '#22c55e'; // Green - large
        return '#15803d'; // Dark green - very large

      case 'height':
      default:
        // Green gradient based on height (typical citrus 2-10m)
        const height = tree.height_m || 0;
        if (height < 3) return '#fbbf24'; // Yellow - very short
        if (height < 5) return '#84cc16'; // Light green - short
        if (height < 7) return '#22c55e'; // Green - medium
        if (height < 10) return '#16a34a'; // Dark green - tall
        return '#14532d'; // Very dark green - very tall
    }
  };

  // Get opacity based on zoom level
  const getOpacity = () => {
    const zoom = map.getZoom();
    if (zoom < 16) return 0.6;
    if (zoom < 18) return 0.7;
    return 0.8;
  };

  // Get marker size based on zoom - small fixed dots, no canopy scaling
  const getMarkerRadius = () => {
    const zoom = map.getZoom();
    // Small, consistent dot sizes that don't overlap
    if (zoom < 16) return 2;
    if (zoom < 17) return 3;
    if (zoom < 18) return 4;
    if (zoom < 19) return 5;
    return 6;
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
            weight: 0.5,
          }}
          eventHandlers={{
            click: () => onTreeClick && onTreeClick(tree),
          }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold mb-1 flex items-center">
                <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                LiDAR Tree #{tree.id}
              </div>
              <table className="text-xs">
                <tbody>
                  <tr>
                    <td className="pr-2 text-gray-500">Height:</td>
                    <td className="font-medium">{tree.height_m?.toFixed(1)}m ({(tree.height_m * 3.281).toFixed(1)}ft)</td>
                  </tr>
                  {tree.canopy_diameter_m && (
                    <tr>
                      <td className="pr-2 text-gray-500">Canopy:</td>
                      <td>{tree.canopy_diameter_m.toFixed(1)}m diameter</td>
                    </tr>
                  )}
                  {tree.canopy_area_sqm && (
                    <tr>
                      <td className="pr-2 text-gray-500">Crown Area:</td>
                      <td>{tree.canopy_area_sqm.toFixed(1)} m²</td>
                    </tr>
                  )}
                  {tree.ground_elevation_m && (
                    <tr>
                      <td className="pr-2 text-gray-500">Elevation:</td>
                      <td>{tree.ground_elevation_m.toFixed(1)}m</td>
                    </tr>
                  )}
                  <tr>
                    <td className="pr-2 text-gray-500">Status:</td>
                    <td className="font-medium capitalize">{tree.status || 'active'}</td>
                  </tr>
                  <tr>
                    <td className="pr-2 text-gray-500">Location:</td>
                    <td className="font-mono text-xs">
                      {tree.latitude?.toFixed(6)}, {tree.longitude?.toFixed(6)}
                    </td>
                  </tr>
                </tbody>
              </table>
              {tree.is_verified && (
                <div className="mt-1 text-green-600 text-xs flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified
                </div>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </LayerGroup>
  );
};

/**
 * LiDARTreeMapLegend - Legend component for LiDAR tree layer
 */
export const LiDARTreeMapLegend = ({ colorBy = 'height' }) => {
  const getLegendItems = () => {
    switch (colorBy) {
      case 'status':
        return LIDAR_CONSTANTS.TREE_STATUSES.map(s => ({
          color: s.color,
          label: s.label,
        }));

      case 'canopy':
        return [
          { color: '#93c5fd', label: 'Small (<1.5m)' },
          { color: '#3b82f6', label: 'Medium (1.5-2.5m)' },
          { color: '#22c55e', label: 'Large (2.5-3.5m)' },
          { color: '#15803d', label: 'Very Large (>3.5m)' },
        ];

      case 'height':
      default:
        return [
          { color: '#fbbf24', label: 'Very Short (<3m)' },
          { color: '#84cc16', label: 'Short (3-5m)' },
          { color: '#22c55e', label: 'Medium (5-7m)' },
          { color: '#16a34a', label: 'Tall (7-10m)' },
          { color: '#14532d', label: 'Very Tall (>10m)' },
        ];
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-3">
      <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
        <svg className="w-4 h-4 mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        LiDAR Trees by {colorBy}
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
    </div>
  );
};

export default LiDARTreeMapLayer;
