// =============================================================================
// WELL READING MODAL COMPONENT
// =============================================================================
// src/components/WellReadingModal.js
// Modal for entering meter readings
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, Gauge, Save, AlertCircle, Camera, Info } from 'lucide-react';
import api from '../services/api';

const WellReadingModal = ({ isOpen, onClose, reading, wellId, wellName, onSave }) => {
  const [formData, setFormData] = useState({
    well: wellId || '',
    reading_date: new Date().toISOString().split('T')[0],
    reading_time: new Date().toTimeString().slice(0, 5),
    meter_reading: '',
    reading_type: 'manual',
    pump_hours: '',
    water_level_ft: '',
    recorded_by: '',
    notes: ''
  });

  const [previousReading, setPreviousReading] = useState(null);
  const [calculatedExtraction, setCalculatedExtraction] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchingPrevious, setFetchingPrevious] = useState(false);

  useEffect(() => {
    if (wellId) {
      setFormData(prev => ({ ...prev, well: wellId }));
      fetchPreviousReading(wellId);
    }
  }, [wellId]);

  useEffect(() => {
    if (reading) {
      setFormData({
        well: reading.well,
        reading_date: reading.reading_date,
        reading_time: reading.reading_time || '',
        meter_reading: reading.meter_reading,
        reading_type: reading.reading_type || 'manual',
        pump_hours: reading.pump_hours || '',
        water_level_ft: reading.water_level_ft || '',
        recorded_by: reading.recorded_by || '',
        notes: reading.notes || ''
      });
    } else {
      setFormData({
        well: wellId || '',
        reading_date: new Date().toISOString().split('T')[0],
        reading_time: new Date().toTimeString().slice(0, 5),
        meter_reading: '',
        reading_type: 'manual',
        pump_hours: '',
        water_level_ft: '',
        recorded_by: '',
        notes: ''
      });
    }
    setErrors({});
    setCalculatedExtraction(null);
  }, [reading, isOpen, wellId]);

  const fetchPreviousReading = async (wId) => {
    try {
      setFetchingPrevious(true);
      const response = await api.get(`/wells/${wId}/readings/`);
      if (response.data && response.data.length > 0) {
        setPreviousReading(response.data[0]);
      } else {
        setPreviousReading(null);
      }
    } catch (err) {
      console.error('Error fetching previous reading:', err);
      setPreviousReading(null);
    } finally {
      setFetchingPrevious(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Calculate estimated extraction when meter reading changes
    if (name === 'meter_reading' && previousReading && value) {
      const current = parseFloat(value);
      const previous = parseFloat(previousReading.meter_reading);
      if (current > previous) {
        setCalculatedExtraction((current - previous).toFixed(4));
      } else if (current === previous) {
        setCalculatedExtraction('0');
      } else {
        setCalculatedExtraction(null);
      }
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.well) {
      newErrors.well = 'Well is required';
    }
    if (!formData.reading_date) {
      newErrors.reading_date = 'Reading date is required';
    }
    if (!formData.meter_reading) {
      newErrors.meter_reading = 'Meter reading is required';
    } else if (isNaN(parseFloat(formData.meter_reading))) {
      newErrors.meter_reading = 'Must be a valid number';
    }
    
    // Warn if reading is less than previous
    if (previousReading && formData.meter_reading) {
      const current = parseFloat(formData.meter_reading);
      const previous = parseFloat(previousReading.meter_reading);
      if (current < previous && formData.reading_type !== 'initial') {
        newErrors.meter_reading = `Reading is less than previous (${previous}). Use "Initial Reading" type if meter was replaced.`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    try {
      const cleanData = { ...formData };
      Object.keys(cleanData).forEach(key => {
        if (cleanData[key] === '') cleanData[key] = null;
      });
      
      if (reading?.id) {
        await api.put(`/well-readings/${reading.id}/`, cleanData);
      } else {
        await api.post('/well-readings/', cleanData);
      }
      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving reading:', err);
      setErrors(err.response?.data || { general: 'Failed to save reading' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <Gauge className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {reading ? 'Edit Reading' : 'Add Meter Reading'}
              </h2>
              {wellName && (
                <p className="text-sm text-gray-500">{wellName}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Error Display */}
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                {errors.general}
              </div>
            )}

            {/* Previous Reading Info */}
            {previousReading && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <Info className="w-4 h-4" />
                  Previous Reading
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{previousReading.reading_date}</span>
                  <span className="font-medium text-gray-900">{previousReading.meter_reading}</span>
                </div>
                {previousReading.extraction_acre_feet && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500">Extraction:</span>
                    <span className="text-cyan-600">{previousReading.extraction_acre_feet.toFixed(4)} AF</span>
                  </div>
                )}
              </div>
            )}

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reading Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="reading_date"
                  value={formData.reading_date}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 ${
                    errors.reading_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.reading_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.reading_date}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  name="reading_time"
                  value={formData.reading_time}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Meter Reading */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meter Reading <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="meter_reading"
                value={formData.meter_reading}
                onChange={handleChange}
                step="0.0001"
                placeholder="Enter totalizer reading"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 ${
                  errors.meter_reading ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.meter_reading && (
                <p className="text-red-500 text-sm mt-1">{errors.meter_reading}</p>
              )}
              
              {/* Calculated Extraction Preview */}
              {calculatedExtraction && (
                <div className="mt-2 p-2 bg-cyan-50 border border-cyan-200 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-cyan-700">Estimated Extraction:</span>
                    <span className="font-medium text-cyan-900">{calculatedExtraction} units</span>
                  </div>
                  <p className="text-xs text-cyan-600 mt-1">
                    Final calculation will apply multiplier and unit conversion
                  </p>
                </div>
              )}
            </div>

            {/* Reading Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reading Type
              </label>
              <select
                name="reading_type"
                value={formData.reading_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              >
                <option value="manual">Manual Reading</option>
                <option value="ami_automatic">AMI Automatic</option>
                <option value="estimated">Estimated</option>
                <option value="initial">Initial Reading (Meter Replacement)</option>
                <option value="final">Final Reading</option>
              </select>
              {formData.reading_type === 'initial' && (
                <p className="text-sm text-yellow-600 mt-1">
                  Initial readings reset the meter baseline - no extraction will be calculated from previous reading.
                </p>
              )}
            </div>

            {/* Optional Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pump Hours
                </label>
                <input
                  type="number"
                  name="pump_hours"
                  value={formData.pump_hours}
                  onChange={handleChange}
                  step="0.1"
                  placeholder="Hour meter reading"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Water Level (ft)
                </label>
                <input
                  type="number"
                  name="water_level_ft"
                  value={formData.water_level_ft}
                  onChange={handleChange}
                  step="0.1"
                  placeholder="Depth to water"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Recorded By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recorded By
              </label>
              <input
                type="text"
                name="recorded_by"
                value={formData.recorded_by}
                onChange={handleChange}
                placeholder="Your name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Any observations or notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Saving...' : (reading ? 'Update Reading' : 'Save Reading')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WellReadingModal;
