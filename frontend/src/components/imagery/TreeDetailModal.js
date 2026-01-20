import React, { useState, useEffect } from 'react';
import { unifiedTreesAPI, UNIFIED_TREE_CONSTANTS } from '../../services/api';
import TreeFeedbackForm from './TreeFeedbackForm';

/**
 * TreeDetailModal - Modal for viewing unified tree details and submitting feedback
 *
 * Features:
 * - Tree attributes (height, canopy, NDVI, status)
 * - Observation timeline from satellite and LiDAR
 * - Feedback submission for flagging issues
 * - Tree verification
 */
const TreeDetailModal = ({ tree, onClose, onTreeUpdate }) => {
  const [activeTab, setActiveTab] = useState('details');
  const [observations, setObservations] = useState([]);
  const [loadingObservations, setLoadingObservations] = useState(false);
  const [fullTree, setFullTree] = useState(tree);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Fetch full tree details and observations
  useEffect(() => {
    if (!tree?.id) return;

    const fetchDetails = async () => {
      try {
        const response = await unifiedTreesAPI.get(tree.id);
        setFullTree(response.data);
      } catch (err) {
        console.error('Failed to fetch tree details:', err);
      }
    };

    const fetchObservations = async () => {
      setLoadingObservations(true);
      try {
        const response = await unifiedTreesAPI.getObservations(tree.id);
        setObservations(response.data);
      } catch (err) {
        console.error('Failed to fetch observations:', err);
      } finally {
        setLoadingObservations(false);
      }
    };

    fetchDetails();
    fetchObservations();
  }, [tree?.id]);

  // Handle verification toggle
  const handleVerify = async () => {
    if (!fullTree) return;

    setVerifying(true);
    try {
      const response = await unifiedTreesAPI.verify(fullTree.id, {
        is_verified: !fullTree.is_verified,
      });
      setFullTree(response.data);
      if (onTreeUpdate) onTreeUpdate(response.data);
    } catch (err) {
      console.error('Failed to verify tree:', err);
    } finally {
      setVerifying(false);
    }
  };

  // Handle feedback submission
  const handleFeedbackSubmit = async () => {
    setShowFeedbackForm(false);
    // Refresh tree details
    try {
      const response = await unifiedTreesAPI.get(tree.id);
      setFullTree(response.data);
      if (onTreeUpdate) onTreeUpdate(response.data);
    } catch (err) {
      console.error('Failed to refresh tree:', err);
    }
  };

  if (!fullTree) return null;

  const getSourceColor = () => {
    const hasSatellite = fullTree.satellite_observation_count > 0;
    const hasLidar = fullTree.lidar_observation_count > 0;
    if (hasSatellite && hasLidar) return '#8b5cf6'; // purple
    if (hasLidar) return '#10b981'; // emerald
    return '#3b82f6'; // blue
  };

  const getSourceLabel = () => {
    const hasSatellite = fullTree.satellite_observation_count > 0;
    const hasLidar = fullTree.lidar_observation_count > 0;
    if (hasSatellite && hasLidar) return 'Satellite + LiDAR';
    if (hasLidar) return 'LiDAR Only';
    return 'Satellite Only';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="relative inline-block w-full max-w-2xl overflow-hidden text-left align-middle transition-all transform bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div
                  className="w-4 h-4 rounded-full mr-3"
                  style={{ backgroundColor: getSourceColor() }}
                />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Tree {fullTree.tree_label || `#${fullTree.id}`}
                  </h3>
                  <p className="text-sm text-gray-500">{getSourceLabel()}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {fullTree.is_verified && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                )}
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex space-x-4">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  activeTab === 'details'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('observations')}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  activeTab === 'observations'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Observations ({observations.length})
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {activeTab === 'details' && (
              <div className="space-y-4">
                {/* Status and Confidence */}
                <div className="flex items-center space-x-4">
                  <div>
                    <span className="text-xs text-gray-500">Status</span>
                    <div className="mt-1">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
                        style={{
                          backgroundColor: UNIFIED_TREE_CONSTANTS.TREE_STATUSES.find(
                            s => s.value === fullTree.status
                          )?.color + '20',
                          color: UNIFIED_TREE_CONSTANTS.TREE_STATUSES.find(
                            s => s.value === fullTree.status
                          )?.color,
                        }}
                      >
                        {fullTree.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Confidence</span>
                    <div className="mt-1">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white capitalize"
                        style={{
                          backgroundColor: UNIFIED_TREE_CONSTANTS.CONFIDENCE_LEVELS.find(
                            c => c.value === fullTree.identity_confidence
                          )?.color,
                        }}
                      >
                        {fullTree.identity_confidence}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Attributes Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <span className="text-xs text-gray-500">Location</span>
                    <div className="text-sm font-mono mt-1">
                      {fullTree.latitude?.toFixed(6)}, {fullTree.longitude?.toFixed(6)}
                    </div>
                  </div>

                  {fullTree.height_m && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <span className="text-xs text-gray-500">Height</span>
                      <div className="text-sm font-medium mt-1">
                        {fullTree.height_m.toFixed(1)}m ({(fullTree.height_m * 3.281).toFixed(1)}ft)
                      </div>
                    </div>
                  )}

                  {fullTree.canopy_diameter_m && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <span className="text-xs text-gray-500">Canopy Diameter</span>
                      <div className="text-sm font-medium mt-1">
                        {fullTree.canopy_diameter_m.toFixed(1)}m
                      </div>
                    </div>
                  )}

                  {fullTree.canopy_area_sqm && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <span className="text-xs text-gray-500">Canopy Area</span>
                      <div className="text-sm font-medium mt-1">
                        {fullTree.canopy_area_sqm.toFixed(1)} m²
                      </div>
                    </div>
                  )}

                  {fullTree.latest_ndvi !== null && fullTree.latest_ndvi !== undefined && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <span className="text-xs text-gray-500">Latest NDVI</span>
                      <div className="text-sm font-medium mt-1">
                        {fullTree.latest_ndvi.toFixed(3)}
                      </div>
                    </div>
                  )}

                  {fullTree.ground_elevation_m && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <span className="text-xs text-gray-500">Ground Elevation</span>
                      <div className="text-sm font-medium mt-1">
                        {fullTree.ground_elevation_m.toFixed(1)}m
                      </div>
                    </div>
                  )}
                </div>

                {/* Observation Stats */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Observation History</h4>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-xl font-bold text-blue-600">
                        {fullTree.satellite_observation_count}
                      </div>
                      <div className="text-xs text-gray-500">Satellite</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-emerald-600">
                        {fullTree.lidar_observation_count}
                      </div>
                      <div className="text-xs text-gray-500">LiDAR</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-600">
                        {fullTree.satellite_observation_count + fullTree.lidar_observation_count}
                      </div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 text-center">
                    First observed: {fullTree.first_observed} • Last observed: {fullTree.last_observed}
                  </div>
                </div>

                {/* Notes */}
                {fullTree.notes && (
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <span className="text-xs text-yellow-700 font-medium">Notes</span>
                    <p className="text-sm text-yellow-800 mt-1">{fullTree.notes}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'observations' && (
              <div className="space-y-3">
                {loadingObservations ? (
                  <div className="text-center py-8 text-gray-500">Loading observations...</div>
                ) : observations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No observations recorded</div>
                ) : (
                  observations.map((obs) => (
                    <div
                      key={obs.id}
                      className={`border rounded-lg p-3 ${
                        obs.source_type === 'lidar'
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-blue-200 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            obs.source_type === 'lidar'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {obs.source_type === 'lidar' ? 'LiDAR' : 'Satellite'}
                        </span>
                        <span className="text-xs text-gray-500">{obs.observation_date}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {obs.observed_height_m && (
                          <div>
                            <span className="text-gray-500">Height:</span>{' '}
                            <span className="font-medium">{obs.observed_height_m.toFixed(1)}m</span>
                          </div>
                        )}
                        {obs.observed_canopy_diameter_m && (
                          <div>
                            <span className="text-gray-500">Canopy:</span>{' '}
                            <span className="font-medium">{obs.observed_canopy_diameter_m.toFixed(1)}m</span>
                          </div>
                        )}
                        {obs.observed_ndvi !== null && obs.observed_ndvi !== undefined && (
                          <div>
                            <span className="text-gray-500">NDVI:</span>{' '}
                            <span className="font-medium">{obs.observed_ndvi.toFixed(3)}</span>
                          </div>
                        )}
                        {obs.match_confidence !== null && (
                          <div>
                            <span className="text-gray-500">Match:</span>{' '}
                            <span className="font-medium">{(obs.match_confidence * 100).toFixed(0)}%</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 text-xs text-gray-400 font-mono">
                        {obs.observed_latitude?.toFixed(6)}, {obs.observed_longitude?.toFixed(6)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            {showFeedbackForm ? (
              <TreeFeedbackForm
                treeId={fullTree.id}
                observations={observations}
                onSubmit={handleFeedbackSubmit}
                onCancel={() => setShowFeedbackForm(false)}
              />
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowFeedbackForm(true)}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Flag Issue
                  </button>

                  <button
                    onClick={handleVerify}
                    disabled={verifying}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      fullTree.is_verified
                        ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                        : 'text-green-700 bg-green-100 hover:bg-green-200'
                    }`}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {verifying ? 'Saving...' : fullTree.is_verified ? 'Unverify' : 'Verify'}
                  </button>
                </div>

                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreeDetailModal;
