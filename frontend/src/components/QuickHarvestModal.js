// =============================================================================
// QUICK HARVEST MODAL COMPONENT
// =============================================================================
// Simplified harvest entry with only essential fields for fast data entry

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Zap } from 'lucide-react';
import { harvestsAPI, HARVEST_CONSTANTS, getUnitLabelForCropVariety } from '../services/api';
import { useToast } from '../contexts/ToastContext';

const QuickHarvestModal = ({
  isOpen,
  onClose,
  onSave,
  fields = [],
  onSwitchToAdvanced
}) => {
  const [formData, setFormData] = useState({
    field: '',
    harvest_date: new Date().toISOString().split('T')[0],
    total_bins: '',
    crop_variety: 'navel_orange',
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [lastCropUsed, setLastCropUsed] = useState(null);
  // Quick entry still needs the PHI guardrail — a violating harvest can
  // mean the whole load is rejected at the packinghouse.
  const [phiCheck, setPhiCheck] = useState(null);
  const [phiOverride, setPhiOverride] = useState(false);
  const toast = useToast();

  // Dynamic unit label based on selected crop variety
  const unitInfo = getUnitLabelForCropVariety(formData.crop_variety);

  // Load last used crop variety
  useEffect(() => {
    if (isOpen) {
      loadLastCropUsed();
      resetForm();
    }
  }, [isOpen]);

  const loadLastCropUsed = async () => {
    try {
      const response = await harvestsAPI.getAll({ ordering: '-harvest_date', limit: 1 });
      if (response.data.results && response.data.results.length > 0) {
        const lastHarvest = response.data.results[0];
        setLastCropUsed(lastHarvest.crop_variety);
        setFormData(prev => ({
          ...prev,
          crop_variety: lastHarvest.crop_variety
        }));
      }
    } catch (error) {
      console.error('Error loading last crop:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      field: '',
      harvest_date: new Date().toISOString().split('T')[0],
      total_bins: '',
      crop_variety: lastCropUsed || 'navel_orange',
      notes: ''
    });
    setErrors({});
    setPhiCheck(null);
    setPhiOverride(false);
  };

  // Live PHI check whenever field or date changes
  useEffect(() => {
    if (!formData.field || !formData.harvest_date) {
      setPhiCheck(null);
      return;
    }
    let cancelled = false;
    setPhiOverride(false);
    harvestsAPI.checkPHI(formData.field, formData.harvest_date)
      .then(res => { if (!cancelled) setPhiCheck(res.data); })
      .catch(() => { if (!cancelled) setPhiCheck(null); });
    return () => { cancelled = true; };
  }, [formData.field, formData.harvest_date]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.field) {
      newErrors.field = 'Field is required';
    }

    if (!formData.harvest_date) {
      newErrors.harvest_date = 'Harvest date is required';
    }

    if (!formData.total_bins || formData.total_bins <= 0) {
      newErrors.total_bins = `Total ${unitInfo.labelPlural.toLowerCase()} must be greater than 0`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (phiCheck?.is_compliant === false && !phiOverride) {
      toast.error(
        'This harvest date violates the Pre-Harvest Interval. '
        + 'Acknowledge the warning to record it anyway.'
      );
      return;
    }

    setSaving(true);

    try {
      // Get field info for auto-filling acres
      const selectedField = fields.find(f => f.id === parseInt(formData.field));

      // Get default bin weight for crop
      const cropChoice = HARVEST_CONSTANTS.CROP_VARIETIES.find(c => c.value === formData.crop_variety);
      const defaultBinWeight = cropChoice?.default_bin_weight || 900;

      // Auto-calculate pick number (get next pick for this field)
      let pickNumber = 1;
      try {
        const existingHarvests = await harvestsAPI.getAll({ field: formData.field, ordering: '-harvest_number' });
        if (existingHarvests.data.results && existingHarvests.data.results.length > 0) {
          pickNumber = existingHarvests.data.results[0].harvest_number + 1;
        }
      } catch (error) {
        console.log('Could not determine pick number, using 1');
      }

      // Build complete harvest data with auto-filled values
      const harvestData = {
        field: parseInt(formData.field),
        harvest_date: formData.harvest_date,
        harvest_number: pickNumber,
        crop_variety: formData.crop_variety,
        total_bins: parseInt(formData.total_bins),
        acres_harvested: selectedField?.total_acres || 0,
        bin_weight_lbs: defaultBinWeight,
        phi_verified: false,
        equipment_cleaned: false,
        no_contamination_observed: false,
        status: 'in_progress',
        notes: formData.notes || '',
        field_conditions: '',
        supervisor_name: ''
      };

      await harvestsAPI.create(harvestData);

      onSave();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error saving harvest:', error);
      if (error.response?.data) {
        setErrors(error.response.data);
      } else {
        toast.error('Failed to save harvest. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToAdvanced = () => {
    // Pass current form data to advanced modal
    onSwitchToAdvanced(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-orange-600" />
            <h2 className="text-xl font-semibold text-heading">Quick Harvest Entry</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-cream-100 rounded text-text-secondary">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Field Selection */}
          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">
              Field <span className="text-danger">*</span>
            </label>
            <select
              name="field"
              value={formData.field}
              onChange={handleChange}
              className={`w-full border rounded-lg px-3 py-2 bg-white text-heading ${errors.field ? 'border-danger' : ''}`}
              required
            >
              <option value="">Select a field...</option>
              {fields
                .sort((a, b) => {
                  if (a.farm_name !== b.farm_name) {
                    return a.farm_name.localeCompare(b.farm_name);
                  }
                  return a.name.localeCompare(b.name);
                })
                .map(field => (
                  <option key={field.id} value={field.id}>
                    {field.name} ({field.farm_name}) - {field.total_acres} acres
                  </option>
                ))}
            </select>
            {errors.field && <p className="text-danger text-sm mt-1">{errors.field}</p>}
          </div>

          {/* Harvest Date */}
          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">
              Harvest Date <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              name="harvest_date"
              value={formData.harvest_date}
              onChange={handleChange}
              className={`w-full border rounded-lg px-3 py-2 bg-white text-heading ${errors.harvest_date ? 'border-danger' : ''}`}
              required
            />
            {errors.harvest_date && <p className="text-danger text-sm mt-1">{errors.harvest_date}</p>}
          </div>

          {/* PHI Violation Warning */}
          {phiCheck && phiCheck.is_compliant === false && (
            <div className="p-3 bg-danger-bg border border-danger/25 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-danger flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-sm font-semibold text-danger">PHI Violation Warning</p>
                  {phiCheck.warning_message && (
                    <p className="text-xs text-danger mt-1">{phiCheck.warning_message}</p>
                  )}
                  <label className="mt-2 flex items-start gap-2 text-xs font-medium text-danger cursor-pointer">
                    <input
                      type="checkbox"
                      checked={phiOverride}
                      onChange={(e) => setPhiOverride(e.target.checked)}
                      className="mt-0.5 rounded border-danger/60 text-danger focus:ring-danger"
                    />
                    <span>I understand this harvest may violate the PHI and want to record it anyway</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Total Bins/Lbs */}
          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">
              Total {unitInfo.labelPlural} <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              name="total_bins"
              value={formData.total_bins}
              onChange={handleChange}
              min="1"
              className={`w-full border rounded-lg px-3 py-2 bg-white text-heading ${errors.total_bins ? 'border-danger' : ''}`}
              placeholder={`Number of ${unitInfo.labelPlural.toLowerCase()} harvested`}
              required
            />
            {errors.total_bins && <p className="text-danger text-sm mt-1">{errors.total_bins}</p>}
          </div>

          {/* Crop Variety */}
          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">
              Crop Variety <span className="text-danger">*</span>
            </label>
            <select
              name="crop_variety"
              value={formData.crop_variety}
              onChange={handleChange}
              className="w-full border rounded-lg px-3 py-2 bg-white text-heading"
              required
            >
              {HARVEST_CONSTANTS.CROP_VARIETIES.map(crop => (
                <option key={crop.value} value={crop.value}>
                  {crop.label}
                  {crop.value === lastCropUsed && ' (Last Used)'}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 bg-white text-heading"
              placeholder="Any additional notes..."
            />
          </div>

          {/* Auto-filled Info Notice */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-xs text-orange-700">
              <strong>Auto-filled:</strong> Acres (from field), bin weight (default for crop), pick number (auto-increment), status (In Progress)
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Saving...' : 'Save Harvest'}
            </button>
            <button
              type="button"
              onClick={handleSwitchToAdvanced}
              className="w-full px-4 py-2 border border-border-strong text-bark-700 rounded-lg hover:bg-cream-50"
            >
              Switch to Advanced Mode
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 text-bark-600 hover:bg-cream-100 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickHarvestModal;
