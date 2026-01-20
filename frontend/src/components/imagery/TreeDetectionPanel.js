import React, { useState, useEffect } from 'react';
import {
  Scan, CheckCircle, AlertCircle, Clock, Loader2, Settings,
  Play, ChevronDown, ChevronUp, MapPin, TreeDeciduous
} from 'lucide-react';
import {
  satelliteImagesAPI,
  detectionRunsAPI,
  TREE_DETECTION_CONSTANTS
} from '../../services/api';

/**
 * TreeDetectionPanel - Control panel for running tree detection
 *
 * Features:
 * - Select satellite image
 * - Select fields to analyze
 * - Configure detection parameters
 * - Start detection
 * - Show detection progress/status
 * - Display results
 */
const TreeDetectionPanel = ({
  satelliteImageId,
  fields = [], // Array of fields that could be analyzed
  onDetectionComplete,
  onClose,
}) => {
  const [image, setImage] = useState(null);
  const [selectedFieldIds, setSelectedFieldIds] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [parameters, setParameters] = useState(TREE_DETECTION_CONSTANTS.DEFAULT_PARAMETERS);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(false);

  // Fetch image details
  useEffect(() => {
    if (!satelliteImageId) return;

    const fetchImage = async () => {
      try {
        console.log('[TreeDetection] Fetching image:', satelliteImageId);
        const response = await satelliteImagesAPI.get(satelliteImageId);
        console.log('[TreeDetection] Image data:', response.data);
        console.log('[TreeDetection] Covered fields:', response.data.covered_fields);
        setImage(response.data);

        // Auto-select all covered fields with boundaries
        if (response.data.covered_fields) {
          const fieldsWithBoundary = response.data.covered_fields
            .filter(f => f.has_boundary)
            .map(f => f.id);
          console.log('[TreeDetection] Fields with boundary:', fieldsWithBoundary);
          setSelectedFieldIds(fieldsWithBoundary);
        }
      } catch (err) {
        console.error('[TreeDetection] Error fetching image:', err);
        setError('Failed to load image details');
      }
    };

    fetchImage();
  }, [satelliteImageId]);

  // Poll for run status updates
  useEffect(() => {
    if (!polling || runs.length === 0) return;

    const pollInterval = setInterval(async () => {
      const pendingRuns = runs.filter(r =>
        r.status === 'pending' || r.status === 'processing'
      );

      if (pendingRuns.length === 0) {
        setPolling(false);
        return;
      }

      // Fetch updated status for pending runs
      const updatedRuns = await Promise.all(
        runs.map(async (run) => {
          if (run.status === 'pending' || run.status === 'processing') {
            try {
              const response = await detectionRunsAPI.get(run.id);
              return response.data;
            } catch {
              return run;
            }
          }
          return run;
        })
      );

      setRuns(updatedRuns);

      // Check if all complete
      const allComplete = updatedRuns.every(
        r => r.status === 'completed' || r.status === 'failed'
      );

      if (allComplete) {
        setPolling(false);
        if (onDetectionComplete) {
          onDetectionComplete(updatedRuns);
        }
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [polling, runs, onDetectionComplete]);

  // Toggle field selection
  const toggleField = (fieldId) => {
    setSelectedFieldIds(prev =>
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  // Select all fields with boundaries
  const selectAllFields = () => {
    if (image?.covered_fields) {
      const fieldsWithBoundary = image.covered_fields
        .filter(f => f.has_boundary)
        .map(f => f.id);
      setSelectedFieldIds(fieldsWithBoundary);
    }
  };

  // Start detection
  const handleStartDetection = async () => {
    if (selectedFieldIds.length === 0) {
      setError('Please select at least one field');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await satelliteImagesAPI.detectTrees(
        satelliteImageId,
        selectedFieldIds,
        parameters
      );

      // Initialize runs with pending status
      const initialRuns = response.data.run_ids.map((id, index) => ({
        id,
        field_id: selectedFieldIds[index],
        field_name: fields.find(f => f.id === selectedFieldIds[index])?.name || `Field ${selectedFieldIds[index]}`,
        status: 'pending',
        tree_count: null,
      }));

      setRuns(initialRuns);
      setPolling(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start detection');
    } finally {
      setLoading(false);
    }
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const config = TREE_DETECTION_CONSTANTS.RUN_STATUSES.find(s => s.value === status);
    return config?.color || '#6b7280';
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center">
          <Scan className="w-5 h-5 text-green-600 mr-2" />
          <h3 className="font-semibold text-gray-900">Tree Detection</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            &times;
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Image Info */}
        {image && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm">
              <div className="font-medium text-gray-900">{image.farm_name}</div>
              <div className="text-gray-500">
                {image.source} - {new Date(image.capture_date).toLocaleDateString()}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {image.resolution_m}m resolution | {image.bands} bands
                {image.has_nir && ' (NIR available)'}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        )}

        {/* Detection in Progress */}
        {runs.length > 0 ? (
          <div className="space-y-3">
            <div className="font-medium text-gray-900">Detection Progress</div>

            {runs.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center">
                  {getStatusIcon(run.status)}
                  <div className="ml-3">
                    <div className="font-medium text-gray-900 text-sm">
                      {run.field_name}
                    </div>
                    <div
                      className="text-xs capitalize"
                      style={{ color: getStatusColor(run.status) }}
                    >
                      {run.status}
                    </div>
                  </div>
                </div>

                {run.status === 'completed' && run.tree_count !== null && (
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {run.tree_count.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">trees</div>
                  </div>
                )}

                {run.status === 'failed' && run.error_message && (
                  <div className="text-xs text-red-500 max-w-xs truncate">
                    {run.error_message}
                  </div>
                )}
              </div>
            ))}

            {/* Summary when all complete */}
            {!polling && runs.every(r => r.status === 'completed' || r.status === 'failed') && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <div className="flex items-center text-green-700">
                  <TreeDeciduous className="w-5 h-5 mr-2" />
                  <span className="font-medium">Detection Complete</span>
                </div>
                <div className="mt-2 text-sm text-green-600">
                  Total trees detected:{' '}
                  <span className="font-semibold">
                    {runs
                      .filter(r => r.status === 'completed')
                      .reduce((sum, r) => sum + (r.tree_count || 0), 0)
                      .toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Field Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Select Fields to Analyze
                </label>
                <button
                  onClick={selectAllFields}
                  className="text-xs text-green-600 hover:text-green-700"
                >
                  Select All
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {image?.covered_fields?.map((field) => (
                  <label
                    key={field.id}
                    className={`
                      flex items-center p-2 rounded-lg border cursor-pointer transition-colors
                      ${selectedFieldIds.includes(field.id)
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:bg-gray-50'}
                      ${!field.has_boundary ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFieldIds.includes(field.id)}
                      onChange={() => toggleField(field.id)}
                      disabled={!field.has_boundary}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{field.name}</div>
                      <div className="text-xs text-gray-500">
                        {field.total_acres?.toFixed(1)} acres
                        {!field.has_boundary && ' (no boundary)'}
                      </div>
                    </div>
                    {field.has_boundary ? (
                      <MapPin className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-gray-400" />
                    )}
                  </label>
                ))}
              </div>

              {(!image?.covered_fields || image.covered_fields.length === 0) && (
                <div className="text-sm text-gray-500 text-center py-4">
                  <p className="font-medium mb-2">No fields found within image coverage area</p>
                  <p className="text-xs">To run tree detection, you need:</p>
                  <ul className="text-xs list-disc list-inside mt-1">
                    <li>Fields with drawn boundaries (use "Draw Boundary" in the map view)</li>
                    <li>Field boundaries must overlap with the satellite image coverage</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Advanced Parameters */}
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center text-sm text-gray-600 hover:text-gray-800"
              >
                <Settings className="w-4 h-4 mr-1" />
                Advanced Parameters
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4 ml-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-1" />
                )}
              </button>

              {showAdvanced && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">
                      Min Canopy Diameter (m)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={parameters.min_canopy_diameter_m}
                      onChange={(e) => setParameters({
                        ...parameters,
                        min_canopy_diameter_m: parseFloat(e.target.value)
                      })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">
                      Max Canopy Diameter (m)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={parameters.max_canopy_diameter_m}
                      onChange={(e) => setParameters({
                        ...parameters,
                        max_canopy_diameter_m: parseFloat(e.target.value)
                      })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">
                      Min Tree Spacing (m)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={parameters.min_tree_spacing_m}
                      onChange={(e) => setParameters({
                        ...parameters,
                        min_tree_spacing_m: parseFloat(e.target.value)
                      })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">
                      Vegetation Threshold Percentile
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={parameters.vegetation_threshold_percentile}
                      onChange={(e) => setParameters({
                        ...parameters,
                        vegetation_threshold_percentile: parseFloat(e.target.value)
                      })}
                      className="w-full mt-1 px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartDetection}
              disabled={loading || selectedFieldIds.length === 0}
              className={`
                w-full py-3 rounded-lg font-medium flex items-center justify-center
                ${loading || selectedFieldIds.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'}
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Run Tree Detection ({selectedFieldIds.length} field{selectedFieldIds.length !== 1 ? 's' : ''})
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default TreeDetectionPanel;
