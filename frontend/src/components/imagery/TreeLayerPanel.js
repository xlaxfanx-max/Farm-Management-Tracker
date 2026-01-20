import React, { useEffect, useMemo, useState } from 'react';
import { TreeDeciduous, Mountain, Layers, RefreshCw } from 'lucide-react';
import { fieldTreesAPI, fieldLidarAPI, unifiedTreesAPI } from '../../services/api';

const TreeLayerPanel = ({
  fieldId,
  fieldName,
  showSatellite,
  showLidar,
  showUnified,
  onToggleSatellite,
  onToggleLidar,
  onToggleUnified,
}) => {
  const [satSummary, setSatSummary] = useState(null);
  const [lidarSummary, setLidarSummary] = useState(null);
  const [unifiedTrees, setUnifiedTrees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refreshAll = async () => {
    if (!fieldId) return;
    setLoading(true);
    try {
      const [satResponse, lidarResponse, unifiedResponse] = await Promise.all([
        fieldTreesAPI.getSummary(fieldId),
        fieldLidarAPI.getSummary(fieldId).catch((err) => {
          if (err.response?.status === 404) return { data: null };
          throw err;
        }),
        unifiedTreesAPI.getForField(fieldId),
      ]);

      setSatSummary(satResponse.data || null);
      setLidarSummary(lidarResponse?.data || null);
      const trees = unifiedResponse.data?.trees || unifiedResponse.data || [];
      setUnifiedTrees(Array.isArray(trees) ? trees : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[TreeLayerPanel] Failed to load summaries:', err);
      setSatSummary(null);
      setLidarSummary(null);
      setUnifiedTrees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, [fieldId]);

  const unifiedSummary = useMemo(() => {
    const total = unifiedTrees.length;
    const active = unifiedTrees.filter((t) => t.status === 'active').length;
    const both = unifiedTrees.filter(
      (t) => t.satellite_observation_count > 0 && t.lidar_observation_count > 0
    ).length;
    const satelliteOnly = unifiedTrees.filter(
      (t) => t.satellite_observation_count > 0 && t.lidar_observation_count === 0
    ).length;
    const lidarOnly = unifiedTrees.filter(
      (t) => t.lidar_observation_count > 0 && t.satellite_observation_count === 0
    ).length;

    return {
      total,
      active,
      both,
      satelliteOnly,
      lidarOnly,
    };
  }, [unifiedTrees]);

  return (
    <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-200 p-4 w-[320px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-600" />
          <div>
            <div className="text-sm font-semibold text-gray-800">Tree Layers</div>
            {fieldName && (
              <div className="text-xs text-gray-500 truncate max-w-[200px]">
                {fieldName}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={refreshAll}
          className="p-1 rounded hover:bg-gray-100"
          title="Refresh summaries"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-gray-400' : 'text-gray-500'}`} />
        </button>
      </div>

      <div className="space-y-2 mb-3">
        <button
          onClick={onToggleSatellite}
          className={`w-full flex items-center justify-between px-3 py-2 rounded border text-sm ${
            showSatellite ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'
          }`}
        >
          <span className="flex items-center gap-2">
            <TreeDeciduous className="w-4 h-4" />
            Satellite
          </span>
          <span className="text-xs font-semibold">
            {satSummary?.satellite_tree_count ?? '--'}
          </span>
        </button>

        <button
          onClick={onToggleLidar}
          className={`w-full flex items-center justify-between px-3 py-2 rounded border text-sm ${
            showLidar ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600'
          }`}
        >
          <span className="flex items-center gap-2">
            <Mountain className="w-4 h-4" />
            LiDAR
          </span>
          <span className="text-xs font-semibold">
            {lidarSummary?.lidar_tree_count ?? '--'}
          </span>
        </button>

        <button
          onClick={onToggleUnified}
          className={`w-full flex items-center justify-between px-3 py-2 rounded border text-sm ${
            showUnified ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            Unified
          </span>
          <span className="text-xs font-semibold">
            {unifiedSummary.total || '--'}
          </span>
        </button>
      </div>

      <div className="border-t border-gray-200 pt-3 text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <span>Unified active</span>
          <span className="font-semibold text-gray-800">{unifiedSummary.active || 0}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span>Both sources</span>
          <span className="font-semibold text-purple-700">{unifiedSummary.both || 0}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span>Satellite only</span>
          <span className="font-semibold text-green-700">{unifiedSummary.satelliteOnly || 0}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span>LiDAR only</span>
          <span className="font-semibold text-emerald-700">{unifiedSummary.lidarOnly || 0}</span>
        </div>
      </div>

      {lastUpdated && (
        <div className="text-[11px] text-gray-400 mt-2">
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default TreeLayerPanel;
