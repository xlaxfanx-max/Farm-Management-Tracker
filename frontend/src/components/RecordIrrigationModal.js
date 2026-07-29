import React, { useState, useEffect } from 'react';
import { Save, Droplet, AlertCircle, Calculator } from 'lucide-react';
import { irrigationZonesAPI, IRRIGATION_CONSTANTS } from '../services/api';
import Modal from './ui/Modal';
import FormField, { inputClasses, selectClasses, textareaClasses } from './ui/FormField';

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

  useEffect(() => {
    if (zone?.recommendation?.needed) {
      setFormData((prev) => ({
        ...prev,
        depth_inches: zone.recommendation.depth_inches?.toFixed(2) || '',
        duration_hours: zone.recommendation.hours?.toFixed(1) || '',
      }));
    }
  }, [zone]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'duration_hours' && zone?.application_rate && value) {
      const calculatedDepth = parseFloat(value) * parseFloat(zone.application_rate);
      setFormData((prev) => ({ ...prev, depth_inches: calculatedDepth.toFixed(2) }));
    }

    if (name === 'depth_inches' && zone?.application_rate && value) {
      const calculatedDuration = parseFloat(value) / parseFloat(zone.application_rate);
      setFormData((prev) => ({ ...prev, duration_hours: calculatedDuration.toFixed(1) }));
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
        as_of_date: formData.date,
      });

      const calc = response.data?.calculation;
      if (calc) {
        setFormData((prev) => ({
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

  const zoneLabel = zone?.zone_name || zone?.name;
  const subtitle = zone?.field_name ? `${zoneLabel} · ${zone.field_name}` : zoneLabel;

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className="px-4 py-2 rounded-button border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="record-irrigation-form"
        disabled={loading || (!formData.depth_inches && !formData.duration_hours)}
        className="flex items-center gap-2 px-4 py-2 rounded-button bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {loading ? 'Saving…' : 'Record'}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Record Irrigation"
      subtitle={subtitle}
      icon={Droplet}
      size="sm"
      footer={footer}
    >
      {zone?.depletion_pct !== undefined && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg px-4 py-2 text-xs text-blue-700 dark:text-blue-300">
          Current depletion: {zone.depletion_pct.toFixed(0)}%
        </div>
      )}

      <form id="record-irrigation-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-red-700 dark:text-red-300"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <FormField label="Date" htmlFor="ri-date" required>
          <input
            id="ri-date"
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            max={today}
            required
            className={inputClasses}
          />
        </FormField>

        <button
          type="button"
          onClick={handleCalculate}
          disabled={calculating}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-button bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          <Calculator className="w-4 h-4" />
          {calculating ? 'Calculating…' : 'Calculate Recommended Amount'}
        </button>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Depth Applied (in)" htmlFor="ri-depth">
            <input
              id="ri-depth"
              type="number"
              name="depth_inches"
              value={formData.depth_inches}
              onChange={handleChange}
              step="0.01"
              min="0"
              className={inputClasses}
              placeholder="e.g., 1.25"
            />
          </FormField>

          <FormField label="Duration (hr)" htmlFor="ri-duration">
            <input
              id="ri-duration"
              type="number"
              name="duration_hours"
              value={formData.duration_hours}
              onChange={handleChange}
              step="0.5"
              min="0"
              className={inputClasses}
              placeholder="e.g., 8.0"
            />
          </FormField>
        </div>

        {zone?.application_rate && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Application rate: {zone.application_rate} in/hr
          </p>
        )}

        <FormField label="Method" htmlFor="ri-method">
          <select
            id="ri-method"
            name="method"
            value={formData.method}
            onChange={handleChange}
            className={selectClasses}
          >
            {IRRIGATION_CONSTANTS.EVENT_METHODS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Notes" htmlFor="ri-notes">
          <textarea
            id="ri-notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={2}
            className={textareaClasses}
            placeholder="Optional notes about this irrigation event…"
          />
        </FormField>
      </form>
    </Modal>
  );
}

export default RecordIrrigationModal;
