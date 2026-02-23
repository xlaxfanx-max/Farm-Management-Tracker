import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, AlertCircle, HelpCircle } from 'lucide-react';
import { irrigationZonesAPI, IRRIGATION_CONSTANTS } from '../services/api';
import { useData } from '../contexts/DataContext';
import { useConfirm } from '../contexts/ConfirmContext';

function IrrigationZoneModal({ zone, onClose, onSave }) {
  const { fields, waterSources } = useData();
  const confirm = useConfirm();
  const isEditing = !!zone?.id;

  const [formData, setFormData] = useState({
    name: '',
    field: '',
    water_source: '',
    acres: '',
    crop_type: 'citrus',
    tree_age: '',
    tree_spacing_ft: '',
    irrigation_method: 'drip',
    emitters_per_tree: '',
    emitter_gph: '',
    application_rate: '',
    distribution_uniformity: '85',
    soil_type: 'loam',
    soil_water_holding_capacity: '',
    root_depth_inches: '',
    management_allowable_depletion: '',
    cimis_target: '',
    cimis_target_type: 'station',
    notes: '',
    active: true,
  });

  const [loading, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (zone) {
      setFormData({
        name: zone.name || '',
        field: zone.field || '',
        water_source: zone.water_source || '',
        acres: zone.acres || '',
        crop_type: zone.crop_type || 'citrus',
        tree_age: zone.tree_age || '',
        tree_spacing_ft: zone.tree_spacing_ft || '',
        irrigation_method: zone.irrigation_method || 'drip',
        emitters_per_tree: zone.emitters_per_tree || '',
        emitter_gph: zone.emitter_gph || '',
        application_rate: zone.application_rate || '',
        distribution_uniformity: zone.distribution_uniformity || '85',
        soil_type: zone.soil_type || 'loam',
        soil_water_holding_capacity: zone.soil_water_holding_capacity || '',
        root_depth_inches: zone.root_depth_inches || '',
        management_allowable_depletion: zone.management_allowable_depletion || '',
        cimis_target: zone.cimis_target || '',
        cimis_target_type: zone.cimis_target_type || 'station',
        notes: zone.notes || '',
        active: zone.active !== false,
      });
    }
  }, [zone]);

  // Auto-fill defaults based on crop type and soil type
  useEffect(() => {
    if (!isEditing) {
      const defaults = {};

      // Set default MAD based on crop type
      if (!formData.management_allowable_depletion && formData.crop_type) {
        defaults.management_allowable_depletion = IRRIGATION_CONSTANTS.DEFAULT_MAD[formData.crop_type] || 50;
      }

      // Set default root depth based on crop type
      if (!formData.root_depth_inches && formData.crop_type) {
        defaults.root_depth_inches = IRRIGATION_CONSTANTS.DEFAULT_ROOT_DEPTH[formData.crop_type] || 36;
      }

      // Set default WHC based on soil type
      if (!formData.soil_water_holding_capacity && formData.soil_type) {
        defaults.soil_water_holding_capacity = IRRIGATION_CONSTANTS.SOIL_WHC[formData.soil_type] || 1.5;
      }

      if (Object.keys(defaults).length > 0) {
        setFormData(prev => ({ ...prev, ...defaults }));
      }
    }
  }, [formData.crop_type, formData.soil_type, isEditing]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Convert numeric fields
      const submitData = {
        ...formData,
        acres: formData.acres ? parseFloat(formData.acres) : null,
        tree_age: formData.tree_age ? parseInt(formData.tree_age) : null,
        tree_spacing_ft: formData.tree_spacing_ft ? parseFloat(formData.tree_spacing_ft) : null,
        emitters_per_tree: formData.emitters_per_tree ? parseInt(formData.emitters_per_tree) : null,
        emitter_gph: formData.emitter_gph ? parseFloat(formData.emitter_gph) : null,
        application_rate: formData.application_rate ? parseFloat(formData.application_rate) : null,
        distribution_uniformity: formData.distribution_uniformity ? parseInt(formData.distribution_uniformity) : 85,
        soil_water_holding_capacity: formData.soil_water_holding_capacity ? parseFloat(formData.soil_water_holding_capacity) : null,
        root_depth_inches: formData.root_depth_inches ? parseInt(formData.root_depth_inches) : null,
        management_allowable_depletion: formData.management_allowable_depletion ? parseInt(formData.management_allowable_depletion) : 50,
        water_source: formData.water_source || null,
      };

      if (isEditing) {
        await irrigationZonesAPI.update(zone.id, submitData);
      } else {
        await irrigationZonesAPI.create(submitData);
      }

      onSave();
    } catch (err) {
      console.error('Failed to save zone:', err);
      setError(err.response?.data?.detail || 'Failed to save irrigation zone');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Are you sure?',
      message: 'Are you sure you want to delete this irrigation zone?',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    setSaving(true);
    try {
      await irrigationZonesAPI.delete(zone.id);
      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete zone');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-80 transition-opacity" onClick={onClose} />

        <div className="relative inline-block w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">
              {isEditing ? 'Edit Irrigation Zone' : 'Add Irrigation Zone'}
            </h3>
            <button onClick={onClose} className="text-white hover:text-blue-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                <span className="text-red-700 dark:text-red-300">{error}</span>
              </div>
            )}

            {/* Basic Info */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b dark:border-gray-700">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zone Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Block A - North"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field *</label>
                  <select
                    name="field"
                    value={formData.field}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select Field</option>
                    {fields.filter(f => f.active).map(field => (
                      <option key={field.id} value={field.id}>
                        {field.farm_name} - {field.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Water Source</label>
                  <select
                    name="water_source"
                    value={formData.water_source}
                    onChange={handleChange}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select Water Source</option>
                    {waterSources.filter(ws => ws.active).map(ws => (
                      <option key={ws.id} value={ws.id}>
                        {ws.farm_name} - {ws.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zone Acres</label>
                  <input
                    type="number"
                    name="acres"
                    value={formData.acres}
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Crop Info */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b dark:border-gray-700">Crop Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Crop Type</label>
                  <select
                    name="crop_type"
                    value={formData.crop_type}
                    onChange={handleChange}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {IRRIGATION_CONSTANTS.CROP_TYPES.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tree Age (years)</label>
                  <input
                    type="number"
                    name="tree_age"
                    value={formData.tree_age}
                    onChange={handleChange}
                    min="0"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tree Spacing (ft)</label>
                  <input
                    type="number"
                    name="tree_spacing_ft"
                    value={formData.tree_spacing_ft}
                    onChange={handleChange}
                    step="0.5"
                    min="0"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., 22"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Root Depth (inches)</label>
                  <input
                    type="number"
                    name="root_depth_inches"
                    value={formData.root_depth_inches}
                    onChange={handleChange}
                    min="6"
                    max="96"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Irrigation System */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b dark:border-gray-700">Irrigation System</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Method</label>
                  <select
                    name="irrigation_method"
                    value={formData.irrigation_method}
                    onChange={handleChange}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {IRRIGATION_CONSTANTS.IRRIGATION_METHODS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Distribution Uniformity (%)</label>
                  <input
                    type="number"
                    name="distribution_uniformity"
                    value={formData.distribution_uniformity}
                    onChange={handleChange}
                    min="50"
                    max="100"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                {(formData.irrigation_method === 'drip' || formData.irrigation_method === 'micro_sprinkler') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emitters per Tree</label>
                      <input
                        type="number"
                        name="emitters_per_tree"
                        value={formData.emitters_per_tree}
                        onChange={handleChange}
                        min="1"
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emitter GPH</label>
                      <input
                        type="number"
                        name="emitter_gph"
                        value={formData.emitter_gph}
                        onChange={handleChange}
                        step="0.1"
                        min="0"
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., 1.0"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Application Rate (in/hr)
                    <span className="ml-1 text-gray-400" title="Gross application rate of irrigation system">
                      <HelpCircle className="w-3 h-3 inline" />
                    </span>
                  </label>
                  <input
                    type="number"
                    name="application_rate"
                    value={formData.application_rate}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., 0.05"
                  />
                </div>
              </div>
            </div>

            {/* Soil Info */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b dark:border-gray-700">Soil Properties</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Soil Type</label>
                  <select
                    name="soil_type"
                    value={formData.soil_type}
                    onChange={handleChange}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {IRRIGATION_CONSTANTS.SOIL_TYPES.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Water Holding Capacity (in/ft)
                    <span className="ml-1 text-gray-400" title="Available water per foot of soil depth">
                      <HelpCircle className="w-3 h-3 inline" />
                    </span>
                  </label>
                  <input
                    type="number"
                    name="soil_water_holding_capacity"
                    value={formData.soil_water_holding_capacity}
                    onChange={handleChange}
                    step="0.1"
                    min="0.5"
                    max="3"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Management Allowable Depletion (%)
                    <span className="ml-1 text-gray-400" title="Trigger irrigation when this % of soil water is depleted">
                      <HelpCircle className="w-3 h-3 inline" />
                    </span>
                  </label>
                  <input
                    type="number"
                    name="management_allowable_depletion"
                    value={formData.management_allowable_depletion}
                    onChange={handleChange}
                    min="20"
                    max="80"
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* CIMIS Configuration */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b dark:border-gray-700">Weather Data (CIMIS)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Type</label>
                  <select
                    name="cimis_target_type"
                    value={formData.cimis_target_type}
                    onChange={handleChange}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {IRRIGATION_CONSTANTS.CIMIS_TARGET_TYPES.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {formData.cimis_target_type === 'station' ? 'Station ID' : 'Zip Code'}
                  </label>
                  <input
                    type="text"
                    name="cimis_target"
                    value={formData.cimis_target}
                    onChange={handleChange}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder={formData.cimis_target_type === 'station' ? 'e.g., 80' : 'e.g., 93274'}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                CIMIS provides ETo (reference evapotranspiration) data for irrigation calculations.
                Find your nearest station at <a href="https://cimis.water.ca.gov/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">cimis.water.ca.gov</a>
              </p>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center mb-6">
              <input
                type="checkbox"
                name="active"
                id="active"
                checked={formData.active}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Active zone
              </label>
            </div>
          </form>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex items-center justify-between">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex items-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save Zone'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IrrigationZoneModal;
