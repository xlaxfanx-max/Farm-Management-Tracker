import React, { useState, useEffect } from 'react';
import { X, Save, Droplet, Clock, Calendar, AlertCircle, Calculator } from 'lucide-react';
import { irrigationZonesAPI, IRRIGATION_CONSTANTS } from '../services/api';

function RecordIrrigationModal({ zone, onClose, onSave }) {
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    date: today,
    depth_inches: '',
    duration_hours: '',
    method: 'scheduled',
    source: 'manual',
    notes: '',
  });

  const [loading, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [calculating, setCalculating] = useState(false);

  // If zone has a recommendation, pre-fill the values
  useEffect(() => {
    if (zone?.recommendation?.needed) {
      setFormData(prev => ({
        ...prev,
        depth_inches: zone.recommendation.depth_inches?.toFixed(2) || '',
        duration_hours: zone.recommendation.hours?.toFixed(1) || '',
      }));
    }
  }, [zone]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // If duration changes and we have application rate, calculate depth
    if (name === 'duration_hours' && zone?.application_rate && value) {
      const calculatedDepth = parseFloat(value) * parseFloat(zone.application_rate);
      setFormData(prev => ({
        ...prev,
        depth_inches: calculatedDepth.toFixed(2)
      }));
    }

    // If depth changes and we have application rate, calculate duration
    if (name === 'depth_inches' && zone?.application_rate && value) {
      const calculatedDuration = parseFloat(value) / parseFloat(zone.application_rate);
      setFormData(prev => ({
        ...prev,
        duration_hours: calculatedDuration.toFixed(1)
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const submitData = {
        date: formData.date,
        depth_inches: formData.depth_inches ? parseFloat(formData.depth_inches) : null,
        duration_hours: formData.duration_hours ? parseFloat(formData.duration_hours) : null,
        method: formData.method,
        source: formData.source,
        notes: formData.notes,
      };

      await irrigationZonesAPI.recordEvent(zone.zone_id || zone.id, submitData);
      onSave();
    } catch (err) {
      console.error('Failed to record irrigation:', err);
      setError(err.response?.data?.detail || 'Failed to record irrigation event');
    } finally {
      setSaving(false);
    }
  };

  const handleCalculate = async () => {
    setCalculating(true);
    setError(null);

    try {
      const response = await irrigationZonesAPI.calculate(zone.zone_id || zone.id, {
        as_of_date: formData.date
      });

      const calc = response.data?.calculation;
      if (calc) {
        setFormData(prev => ({
          ...prev,
          depth_inches: calc.recommended_depth_inches?.toFixed(2) || '',
          duration_hours: calc.recommended_hours?.toFixed(1) || '',
        }));
      }
    } catch (err) {
      console.error('Failed to calculate:', err);
      setError('Failed to calculate recommendation. Please enter values manually.');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="relative inline-block w-full max-w-md bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center">
              <Droplet className="w-5 h-5 text-white mr-2" />
              <h3 className="text-lg font-semibold text-white">Record Irrigation</h3>
            </div>
            <button onClick={onClose} className="text-white hover:text-blue-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Zone Info */}
          <div className="bg-blue-50 px-6 py-3 border-b border-blue-100">
            <p className="text-sm text-blue-900">
              <span className="font-medium">{zone?.zone_name || zone?.name}</span>
              {zone?.field_name && <span className="text-blue-700"> - {zone.field_name}</span>}
            </p>
            {zone?.depletion_pct !== undefined && (
              <p className="text-xs text-blue-700 mt-1">
                Current depletion: {zone.depletion_pct.toFixed(0)}%
              </p>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}

            {/* Date */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                max={today}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Calculate Button */}
            <div className="mb-4">
              <button
                type="button"
                onClick={handleCalculate}
                disabled={calculating}
                className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                <Calculator className="w-4 h-4 mr-2" />
                {calculating ? 'Calculating...' : 'Calculate Recommended Amount'}
              </button>
            </div>

            {/* Depth and Duration */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Droplet className="w-4 h-4 inline mr-1" />
                  Depth Applied (inches)
                </label>
                <input
                  type="number"
                  name="depth_inches"
                  value={formData.depth_inches}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 1.25"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Duration (hours)
                </label>
                <input
                  type="number"
                  name="duration_hours"
                  value={formData.duration_hours}
                  onChange={handleChange}
                  step="0.5"
                  min="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 8.0"
                />
              </div>
            </div>

            {zone?.application_rate && (
              <p className="text-xs text-gray-500 mb-4">
                Application rate: {zone.application_rate} in/hr
              </p>
            )}

            {/* Method */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
              <select
                name="method"
                value={formData.method}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {IRRIGATION_CONSTANTS.EVENT_METHODS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optional notes about this irrigation event..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || (!formData.depth_inches && !formData.duration_hours)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Record'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RecordIrrigationModal;
