import React, { useState } from 'react';
import { unifiedTreesAPI, UNIFIED_TREE_CONSTANTS } from '../../services/api';

/**
 * TreeFeedbackForm - Form for submitting feedback on tree detections
 *
 * Features:
 * - Select feedback type (false positive, location error, etc.)
 * - Add notes explaining the issue
 * - Optional: select specific observation
 * - Optional: provide location correction
 * - Optional: provide attribute corrections
 */
const TreeFeedbackForm = ({ treeId, observations = [], onSubmit, onCancel }) => {
  const [feedbackType, setFeedbackType] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedObservation, setSelectedObservation] = useState('');
  const [suggestedLatitude, setSuggestedLatitude] = useState('');
  const [suggestedLongitude, setSuggestedLongitude] = useState('');
  const [attributeCorrections, setAttributeCorrections] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!feedbackType) {
      setError('Please select a feedback type');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const data = {
        feedback_type: feedbackType,
        notes: notes,
      };

      // Add optional fields if provided
      if (selectedObservation) {
        data.observation = parseInt(selectedObservation);
      }

      if (feedbackType === 'location_error') {
        if (suggestedLatitude) {
          data.suggested_latitude = parseFloat(suggestedLatitude);
        }
        if (suggestedLongitude) {
          data.suggested_longitude = parseFloat(suggestedLongitude);
        }
      }

      if (feedbackType === 'attribute_error' && Object.keys(attributeCorrections).length > 0) {
        data.suggested_corrections = attributeCorrections;
      }

      await unifiedTreesAPI.submitFeedback(treeId, data);
      onSubmit && onSubmit();
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setError(err.response?.data?.detail || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle attribute correction changes
  const handleAttributeChange = (key, value) => {
    setAttributeCorrections(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900">Flag an Issue</h4>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Feedback Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What's the issue? <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {UNIFIED_TREE_CONSTANTS.FEEDBACK_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setFeedbackType(type.value)}
              className={`p-3 text-left rounded-lg border transition-all ${
                feedbackType === type.value
                  ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start">
                <span
                  className="w-3 h-3 rounded-full mt-0.5 mr-2 flex-shrink-0"
                  style={{ backgroundColor: type.color }}
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">{type.label}</div>
                  <div className="text-xs text-gray-500">{type.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Location Correction (shown for location_error type) */}
      {feedbackType === 'location_error' && (
        <div className="bg-blue-50 rounded-lg p-4">
          <label className="block text-sm font-medium text-blue-900 mb-2">
            Suggested Correction
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-blue-700 mb-1">Latitude</label>
              <input
                type="text"
                value={suggestedLatitude}
                onChange={(e) => setSuggestedLatitude(e.target.value)}
                placeholder="e.g., 36.123456"
                className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-blue-700 mb-1">Longitude</label>
              <input
                type="text"
                value={suggestedLongitude}
                onChange={(e) => setSuggestedLongitude(e.target.value)}
                placeholder="e.g., -119.654321"
                className="w-full px-3 py-2 text-sm border border-blue-200 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-blue-600">
            Enter the correct coordinates if you know them
          </p>
        </div>
      )}

      {/* Attribute Correction (shown for attribute_error type) */}
      {feedbackType === 'attribute_error' && (
        <div className="bg-gray-50 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Attribute Corrections
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Height (m)</label>
              <input
                type="number"
                step="0.1"
                value={attributeCorrections.height_m || ''}
                onChange={(e) => handleAttributeChange('height_m', parseFloat(e.target.value) || null)}
                placeholder="Correct height"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Canopy Diameter (m)</label>
              <input
                type="number"
                step="0.1"
                value={attributeCorrections.canopy_diameter_m || ''}
                onChange={(e) => handleAttributeChange('canopy_diameter_m', parseFloat(e.target.value) || null)}
                placeholder="Correct diameter"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Only fill in attributes that need correction
          </p>
        </div>
      )}

      {/* Link to Specific Observation */}
      {observations.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Specific Observation (optional)
          </label>
          <select
            value={selectedObservation}
            onChange={(e) => setSelectedObservation(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">General feedback (no specific observation)</option>
            {observations.map((obs) => (
              <option key={obs.id} value={obs.id}>
                {obs.source_type === 'lidar' ? 'LiDAR' : 'Satellite'} - {obs.observation_date}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Select if this feedback is about a specific detection
          </p>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Describe the issue in detail..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Helpful: describe what you observed in the field, why this is incorrect, etc.
        </p>
      </div>

      {/* Submit */}
      <div className="flex items-center justify-end space-x-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !feedbackType}
          className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Submitting...
            </span>
          ) : (
            'Submit Feedback'
          )}
        </button>
      </div>
    </form>
  );
};

export default TreeFeedbackForm;
