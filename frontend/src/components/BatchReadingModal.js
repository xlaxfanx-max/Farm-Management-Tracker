// =============================================================================
// BATCH READING MODAL COMPONENT
// =============================================================================
// src/components/BatchReadingModal.js
// Modal for entering meter readings for multiple wells at once
// Ideal for "reading day" when visiting all wells
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, Gauge, Save, AlertCircle, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';

const BatchReadingModal = ({ isOpen, onClose, wells, onSave }) => {
  const [readingDate, setReadingDate] = useState(new Date().toISOString().split('T')[0]);
  const [recordedBy, setRecordedBy] = useState('');
  const [readings, setReadings] = useState({});
  const [previousReadings, setPreviousReadings] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [savedCount, setSavedCount] = useState(0);
  const [expandedWell, setExpandedWell] = useState(null);

  // Fetch previous readings for all wells
  useEffect(() => {
    if (isOpen && wells?.length > 0) {
      fetchPreviousReadings();
      // Initialize readings state
      const initialReadings = {};
      wells.forEach(well => {
        initialReadings[well.id] = {
          meter_reading: '',
          pump_hours: '',
          water_level_ft: '',
          notes: ''
        };
      });
      setReadings(initialReadings);
      setSavedCount(0);
      setErrors({});
    }
  }, [isOpen, wells]);

  const fetchPreviousReadings = async () => {
    setLoading(true);
    try {
      const prevReadings = {};
      // Fetch in parallel for better performance
      await Promise.all(
        wells.map(async (well) => {
          try {
            const response = await api.get('/well-readings/', {
              params: { water_source: well.id, limit: 1 }
            });
            if (response.data?.length > 0) {
              prevReadings[well.id] = response.data[0];
            }
          } catch (err) {
            console.error(`Error fetching reading for well ${well.id}:`, err);
          }
        })
      );
      setPreviousReadings(prevReadings);
    } finally {
      setLoading(false);
    }
  };

  const handleReadingChange = (wellId, field, value) => {
    setReadings(prev => ({
      ...prev,
      [wellId]: {
        ...prev[wellId],
        [field]: value
      }
    }));

    // Clear error for this well
    if (errors[wellId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[wellId];
        return newErrors;
      });
    }
  };

  const calculateExtraction = (wellId, currentReading) => {
    const prev = previousReadings[wellId];
    if (!prev || !currentReading) return null;

    const current = parseFloat(currentReading);
    const previous = parseFloat(prev.meter_reading);

    if (isNaN(current) || isNaN(previous)) return null;
    if (current < previous) return null; // Would need rollover handling

    return (current - previous).toFixed(4);
  };

  const getDaysSinceLastReading = (wellId) => {
    const prev = previousReadings[wellId];
    if (!prev) return null;

    const lastDate = new Date(prev.reading_date);
    const today = new Date();
    const diffTime = Math.abs(today - lastDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getReadingStatus = (wellId) => {
    const days = getDaysSinceLastReading(wellId);
    if (days === null) return { status: 'new', label: 'No readings', color: 'gray' };
    if (days > 90) return { status: 'overdue', label: `${days} days ago`, color: 'red' };
    if (days > 30) return { status: 'due', label: `${days} days ago`, color: 'yellow' };
    return { status: 'current', label: `${days} days ago`, color: 'green' };
  };

  const handleSaveAll = async () => {
    setSaving(true);
    const newErrors = {};
    let successCount = 0;

    for (const well of wells) {
      const reading = readings[well.id];
      if (!reading?.meter_reading) continue; // Skip wells without readings

      // Validate
      const current = parseFloat(reading.meter_reading);
      const prev = previousReadings[well.id];

      if (isNaN(current)) {
        newErrors[well.id] = 'Invalid number';
        continue;
      }

      if (prev && current < parseFloat(prev.meter_reading)) {
        newErrors[well.id] = 'Reading is less than previous. Use individual entry for rollover.';
        continue;
      }

      // Save
      try {
        await api.post('/well-readings/', {
          water_source: well.id,
          reading_date: readingDate,
          meter_reading: reading.meter_reading,
          reading_type: 'manual',
          pump_hours: reading.pump_hours || null,
          water_level_ft: reading.water_level_ft || null,
          recorded_by: recordedBy || null,
          notes: reading.notes || null
        });
        successCount++;
      } catch (err) {
        console.error(`Error saving reading for well ${well.id}:`, err);
        newErrors[well.id] = err.response?.data?.detail || 'Failed to save';
      }
    }

    setErrors(newErrors);
    setSavedCount(successCount);
    setSaving(false);

    if (Object.keys(newErrors).length === 0 && successCount > 0) {
      // All successful, close after brief delay
      setTimeout(() => {
        onSave();
        onClose();
      }, 1000);
    }
  };

  const filledCount = Object.values(readings).filter(r => r?.meter_reading).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-cyan-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <Gauge className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Batch Meter Readings</h2>
              <p className="text-sm text-gray-500">Enter readings for multiple wells at once</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Global Settings */}
        <div className="p-4 border-b bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reading Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={readingDate}
                onChange={(e) => setReadingDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recorded By
              </label>
              <input
                type="text"
                value={recordedBy}
                onChange={(e) => setRecordedBy(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="flex items-end">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 w-full">
                <div className="text-sm text-gray-500">Wells to record</div>
                <div className="text-xl font-bold text-cyan-600">
                  {filledCount} / {wells?.length || 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {savedCount > 0 && (
          <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            Successfully saved {savedCount} reading{savedCount > 1 ? 's' : ''}!
          </div>
        )}

        {/* Wells List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
              <span className="ml-3 text-gray-500">Loading well data...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {wells?.map(well => {
                const prev = previousReadings[well.id];
                const reading = readings[well.id] || {};
                const extraction = calculateExtraction(well.id, reading.meter_reading);
                const status = getReadingStatus(well.id);
                const error = errors[well.id];
                const isExpanded = expandedWell === well.id;

                return (
                  <div
                    key={well.id}
                    className={`border rounded-xl overflow-hidden transition-all ${
                      error ? 'border-red-300 bg-red-50' :
                      reading.meter_reading ? 'border-green-300 bg-green-50' :
                      'border-gray-200 bg-white'
                    }`}
                  >
                    {/* Well Row */}
                    <div className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Status Indicator */}
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          status.color === 'red' ? 'bg-red-500' :
                          status.color === 'yellow' ? 'bg-yellow-500' :
                          status.color === 'green' ? 'bg-green-500' :
                          'bg-gray-400'
                        }`} />

                        {/* Well Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900 truncate">
                              {well.well_name || well.name}
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              status.color === 'red' ? 'bg-red-100 text-red-700' :
                              status.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                              status.color === 'green' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {status.label}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 truncate">
                            {well.farm_name} {well.gsa && `• ${well.gsa.toUpperCase()}`}
                          </p>
                        </div>

                        {/* Previous Reading */}
                        <div className="text-right flex-shrink-0 w-32">
                          <div className="text-xs text-gray-500">Previous</div>
                          <div className="font-medium text-gray-700">
                            {prev ? parseFloat(prev.meter_reading).toLocaleString() : '-'}
                          </div>
                        </div>

                        {/* Meter Reading Input */}
                        <div className="flex-shrink-0 w-40">
                          <input
                            type="number"
                            value={reading.meter_reading || ''}
                            onChange={(e) => handleReadingChange(well.id, 'meter_reading', e.target.value)}
                            placeholder="New reading"
                            step="0.01"
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 text-right font-mono ${
                              error ? 'border-red-500' : 'border-gray-300'
                            }`}
                          />
                        </div>

                        {/* Extraction Preview */}
                        <div className="text-right flex-shrink-0 w-24">
                          <div className="text-xs text-gray-500">Extraction</div>
                          <div className={`font-medium ${extraction ? 'text-cyan-600' : 'text-gray-400'}`}>
                            {extraction ? `${extraction} AF` : '-'}
                          </div>
                        </div>

                        {/* Expand Button */}
                        <button
                          onClick={() => setExpandedWell(isExpanded ? null : well.id)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </div>

                      {/* Error Message */}
                      {error && (
                        <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          {error}
                        </div>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-gray-200 bg-gray-50">
                        <div className="grid grid-cols-3 gap-4 mt-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Pump Hours
                            </label>
                            <input
                              type="number"
                              value={reading.pump_hours || ''}
                              onChange={(e) => handleReadingChange(well.id, 'pump_hours', e.target.value)}
                              placeholder="Hour meter"
                              step="0.1"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Water Level (ft)
                            </label>
                            <input
                              type="number"
                              value={reading.water_level_ft || ''}
                              onChange={(e) => handleReadingChange(well.id, 'water_level_ft', e.target.value)}
                              placeholder="Depth to water"
                              step="0.1"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Notes
                            </label>
                            <input
                              type="text"
                              value={reading.notes || ''}
                              onChange={(e) => handleReadingChange(well.id, 'notes', e.target.value)}
                              placeholder="Any observations"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                        </div>

                        {/* Fee Estimate */}
                        {extraction && well.base_extraction_rate && (
                          <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                            <div className="text-xs font-medium text-gray-500 mb-2">Estimated Fees</div>
                            <div className="flex gap-4 text-sm">
                              {well.base_extraction_rate && (
                                <div>
                                  <span className="text-gray-500">Base: </span>
                                  <span className="font-medium">
                                    ${(parseFloat(extraction) * parseFloat(well.base_extraction_rate)).toFixed(2)}
                                  </span>
                                </div>
                              )}
                              {well.gsp_rate && (
                                <div>
                                  <span className="text-gray-500">GSP: </span>
                                  <span className="font-medium">
                                    ${(parseFloat(extraction) * parseFloat(well.gsp_rate)).toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            {filledCount > 0 ? (
              <span className="text-cyan-600 font-medium">{filledCount} reading{filledCount > 1 ? 's' : ''} ready to save</span>
            ) : (
              <span>Enter meter readings above</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving || filledCount === 0}
              className="flex items-center gap-2 px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Saving...' : `Save ${filledCount} Reading${filledCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchReadingModal;
