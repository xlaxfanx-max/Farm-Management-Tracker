// =============================================================================
// HARVEST MODAL COMPONENT
// Save as: frontend/src/components/HarvestModal.js
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { harvestsAPI, HARVEST_CONSTANTS, getUnitLabelForCropVariety } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import CollapsibleSection from './ui/CollapsibleSection';

const HarvestModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  harvest = null, 
  fields = [],
  farms = [],
  preselectedFieldId = null 
}) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    field: '',
    harvest_date: new Date().toISOString().split('T')[0],
    harvest_number: 1,
    crop_variety: 'navel_orange',
    acres_harvested: '',
    total_bins: '',
    bin_weight_lbs: 900,
    phi_verified: false,
    field_conditions: '',
    equipment_cleaned: false,
    no_contamination_observed: false,
    supervisor_name: '',
    status: 'in_progress',
    notes: ''
  });

  const [phiCheck, setPhiCheck] = useState(null);
  const [phiLoading, setPhiLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [reconciliationStatus, setReconciliationStatus] = useState(null);

  // Dynamic unit label based on selected crop variety
  const unitInfo = getUnitLabelForCropVariety(formData.crop_variety);
  const isWeightBased = unitInfo.unit === 'LBS';

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (harvest) {
        // Editing existing harvest
        setFormData({
          field: harvest.field,
          harvest_date: harvest.harvest_date,
          harvest_number: harvest.harvest_number,
          crop_variety: harvest.crop_variety,
          acres_harvested: harvest.acres_harvested,
          total_bins: harvest.total_bins,
          bin_weight_lbs: harvest.bin_weight_lbs,
          phi_verified: harvest.phi_verified,
          field_conditions: harvest.field_conditions || '',
          equipment_cleaned: harvest.equipment_cleaned,
          no_contamination_observed: harvest.no_contamination_observed,
          supervisor_name: harvest.supervisor_name || '',
          status: harvest.status,
          notes: harvest.notes || ''
        });
        setPhiCheck({
          is_compliant: harvest.phi_compliant,
          days_since_application: harvest.days_since_last_application,
          phi_required_days: harvest.phi_required_days,
          last_application_product: harvest.last_application_product
        });
        // Set reconciliation status if available
        if (harvest.bins_reconciliation_status) {
          setReconciliationStatus(harvest.bins_reconciliation_status);
        }
      } else {
        // New harvest
        setFormData(prev => ({
          ...prev,
          field: preselectedFieldId || '',
          harvest_date: new Date().toISOString().split('T')[0],
          harvest_number: 1,
          crop_variety: 'navel_orange',
          acres_harvested: '',
          total_bins: '',
          bin_weight_lbs: 900,
          phi_verified: false,
          field_conditions: '',
          equipment_cleaned: false,
          no_contamination_observed: false,
          supervisor_name: '',
          status: 'in_progress',
          notes: ''
        }));
        setPhiCheck(null);
      }
      setErrors({});
    }
  }, [isOpen, harvest, preselectedFieldId]);

  // Check PHI when field or date changes
  useEffect(() => {
    if (formData.field && formData.harvest_date) {
      checkPHI();
    }
  }, [formData.field, formData.harvest_date]);

  // Update bin weight when crop variety changes
  useEffect(() => {
    const defaultWeight = HARVEST_CONSTANTS.DEFAULT_BIN_WEIGHTS[formData.crop_variety] || 900;
    setFormData(prev => ({ ...prev, bin_weight_lbs: defaultWeight }));
  }, [formData.crop_variety]);

  // Auto-fill acres from field
  useEffect(() => {
    if (formData.field && !formData.acres_harvested) {
      const selectedField = fields.find(f => f.id === parseInt(formData.field));
      if (selectedField?.total_acres) {
        setFormData(prev => ({ ...prev, acres_harvested: selectedField.total_acres }));
      }
    }
  }, [formData.field, fields]);

  const checkPHI = async () => {
    setPhiLoading(true);
    try {
      const response = await harvestsAPI.checkPHI(formData.field, formData.harvest_date);
      setPhiCheck(response.data);
    } catch (error) {
      console.error('Error checking PHI:', error);
      setPhiCheck(null);
    } finally {
      setPhiLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.field) newErrors.field = 'Field is required';
    if (!formData.harvest_date) newErrors.harvest_date = 'Harvest date is required';
    if (!formData.acres_harvested || formData.acres_harvested <= 0) {
      newErrors.acres_harvested = 'Acres harvested must be greater than 0';
    }
    if (!formData.total_bins || formData.total_bins < 0) {
      newErrors.total_bins = `Total ${unitInfo.labelPlural.toLowerCase()} is required`;
    }
    
    // Validate acres don't exceed field total
    const selectedField = fields.find(f => f.id === parseInt(formData.field));
    if (selectedField && parseFloat(formData.acres_harvested) > parseFloat(selectedField.total_acres)) {
      newErrors.acres_harvested = `Cannot exceed field total of ${selectedField.total_acres} acres`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        field: parseInt(formData.field),
        harvest_number: parseInt(formData.harvest_number),
        acres_harvested: parseFloat(formData.acres_harvested),
        total_bins: parseInt(formData.total_bins),
        bin_weight_lbs: parseInt(formData.bin_weight_lbs)
      };

      if (harvest) {
        await harvestsAPI.update(harvest.id, dataToSave);
      } else {
        await harvestsAPI.create(dataToSave);
      }
      
      onSave();
      onClose();
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

  // Get fields for selected farm (or all fields)
  const getAvailableFields = () => {
    return fields.filter(f => f.active !== false);
  };

  // Get selected field details
  const getSelectedField = () => {
    return fields.find(f => f.id === parseInt(formData.field));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {harvest ? 'Edit Harvest' : 'Record New Harvest'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400">
            <X size={24} />
          </button>
        </div>

        {/* PHI Warning Banner */}
        {phiCheck && phiCheck.is_compliant === false && (
          <div className="mx-4 mt-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={24} />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-300">PHI Violation Warning</p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-1">{phiCheck.warning_message}</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  Proceeding may violate Pre-Harvest Interval requirements. 
                  Consider selecting a later harvest date.
                </p>
              </div>
            </div>
          </div>
        )}

        {phiCheck && phiCheck.is_compliant === true && (
          <div className="mx-4 mt-4 p-3 bg-primary-light dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-primary dark:text-green-400" size={20} />
              <span className="text-green-800 dark:text-green-300">{phiCheck.warning_message}</span>
            </div>
          </div>
        )}

        {phiLoading && (
          <div className="mx-4 mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-blue-700 dark:text-blue-300">Checking PHI compliance...</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Field Selection & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Field <span className="text-red-500">*</span>
              </label>
              <select
                name="field"
                value={formData.field}
                onChange={handleChange}
                className={`w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.field ? 'border-red-500' : ''}`}
                required
              >
                <option value="">Select a field...</option>
                {getAvailableFields().map(field => (
                  <option key={field.id} value={field.id}>
                    {field.name} ({field.farm_name}) - {field.total_acres} acres
                  </option>
                ))}
              </select>
              {errors.field && <p className="text-red-500 text-sm mt-1">{errors.field}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Harvest Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="harvest_date"
                value={formData.harvest_date}
                onChange={handleChange}
                className={`w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.harvest_date ? 'border-red-500' : ''}`}
                required
              />
              {errors.harvest_date && <p className="text-red-500 text-sm mt-1">{errors.harvest_date}</p>}
            </div>
          </div>

          {/* Crop & Pick Number */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Crop Variety <span className="text-red-500">*</span>
              </label>
              <select
                name="crop_variety"
                value={formData.crop_variety}
                onChange={handleChange}
                className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              >
                {HARVEST_CONSTANTS.CROP_VARIETIES.map(crop => (
                  <option key={crop.value} value={crop.value}>{crop.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pick Number
              </label>
              <input
                type="number"
                name="harvest_number"
                value={formData.harvest_number}
                onChange={handleChange}
                min="1"
                className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Which pick this season (1st, 2nd, etc.)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {HARVEST_CONSTANTS.HARVEST_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Acres Harvested <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="acres_harvested"
                value={formData.acres_harvested}
                onChange={handleChange}
                step="0.01"
                min="0.01"
                className={`w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.acres_harvested ? 'border-red-500' : ''}`}
                required
              />
              {errors.acres_harvested && <p className="text-red-500 text-sm mt-1">{errors.acres_harvested}</p>}
              {getSelectedField() && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Field total: {getSelectedField().total_acres} acres
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Total {unitInfo.labelPlural} <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="total_bins"
                value={formData.total_bins}
                onChange={handleChange}
                min="0"
                className={`w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.total_bins ? 'border-red-500' : ''}`}
                required
              />
              {errors.total_bins && <p className="text-red-500 text-sm mt-1">{errors.total_bins}</p>}
            </div>

            {!isWeightBased && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bin Weight (lbs)
                </label>
                <input
                  type="number"
                  name="bin_weight_lbs"
                  value={formData.bin_weight_lbs}
                  onChange={handleChange}
                  min="1"
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Est. weight: {((formData.total_bins || 0) * formData.bin_weight_lbs).toLocaleString()} lbs
                </p>
              </div>
            )}
          </div>

          {/* GAP/GHP Section - Collapsible */}
          <CollapsibleSection title="GAP/GHP Compliance">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="phi_verified"
                    checked={formData.phi_verified}
                    onChange={handleChange}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">PHI compliance verified</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="equipment_cleaned"
                    checked={formData.equipment_cleaned}
                    onChange={handleChange}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Harvest equipment cleaned/sanitized</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="no_contamination_observed"
                    checked={formData.no_contamination_observed}
                    onChange={handleChange}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">No contamination observed (glass, metal, animals)</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Supervisor Name
                </label>
                <input
                  type="text"
                  name="supervisor_name"
                  value={formData.supervisor_name}
                  onChange={handleChange}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Person responsible for this harvest"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Field Conditions
              </label>
              <textarea
                name="field_conditions"
                value={formData.field_conditions}
                onChange={handleChange}
                rows={2}
                className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Weather, ground conditions, any observations..."
              />
            </div>
          </CollapsibleSection>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Any additional notes..."
            />
          </div>

          {/* Bins Reconciliation Widget - Only show when editing existing harvest */}
          {harvest && reconciliationStatus && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Info size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="font-medium text-blue-800 dark:text-blue-300">{unitInfo.labelSingular} Tracking Status</h3>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                {/* Total Harvest */}
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Total Harvest</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {reconciliationStatus.total_harvest_bins} {unitInfo.labelPlural.toLowerCase()}
                  </p>
                </div>

                {/* Loads Status */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-gray-600 dark:text-gray-400">In Loads</p>
                    {reconciliationStatus.loads_status === 'match' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        ✓ Complete
                      </span>
                    )}
                    {reconciliationStatus.loads_status === 'under' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        ⚠ Incomplete
                      </span>
                    )}
                    {reconciliationStatus.loads_status === 'over' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        ✗ Over
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {reconciliationStatus.total_load_bins} {unitInfo.labelPlural.toLowerCase()}
                  </p>
                  {reconciliationStatus.loads_message && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{reconciliationStatus.loads_message}</p>
                  )}
                </div>

                {/* Labor Status */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-gray-600 dark:text-gray-400">By Labor</p>
                    {reconciliationStatus.labor_status === 'match' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        ✓ Complete
                      </span>
                    )}
                    {reconciliationStatus.labor_status === 'under' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        ⚠ Incomplete
                      </span>
                    )}
                    {reconciliationStatus.labor_status === 'over' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        ✗ Over
                      </span>
                    )}
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {reconciliationStatus.total_labor_bins} {unitInfo.labelPlural.toLowerCase()}
                  </p>
                  {reconciliationStatus.labor_message && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{reconciliationStatus.labor_message}</p>
                  )}
                </div>
              </div>

              {/* Progress Bars */}
              <div className="space-y-2">
                {/* Loads Progress */}
                <div>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span>Loads Progress</span>
                    <span>{Math.round((reconciliationStatus.total_load_bins / reconciliationStatus.total_harvest_bins) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        reconciliationStatus.loads_status === 'match' ? 'bg-green-500' :
                        reconciliationStatus.loads_status === 'over' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`}
                      style={{width: `${Math.min((reconciliationStatus.total_load_bins / reconciliationStatus.total_harvest_bins) * 100, 100)}%`}}
                    ></div>
                  </div>
                </div>

                {/* Labor Progress */}
                <div>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span>Labor Progress</span>
                    <span>{Math.round((reconciliationStatus.total_labor_bins / reconciliationStatus.total_harvest_bins) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        reconciliationStatus.labor_status === 'match' ? 'bg-green-500' :
                        reconciliationStatus.labor_status === 'over' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`}
                      style={{width: `${Math.min((reconciliationStatus.total_labor_bins / reconciliationStatus.total_harvest_bins) * 100, 100)}%`}}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : (harvest ? 'Update Harvest' : 'Record Harvest')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HarvestModal;
