// =============================================================================
// DELIVERY MODAL COMPONENT
// Record packinghouse deliveries
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, Truck, Save, Loader2, Wheat, Link2 } from 'lucide-react';
import { packinghouseDeliveriesAPI, fieldsAPI, harvestsAPI } from '../../services/api';

const DeliveryModal = ({ poolId, delivery, onClose, onSave }) => {
  const [fields, setFields] = useState([]);
  const [harvests, setHarvests] = useState([]);
  const [loadingHarvests, setLoadingHarvests] = useState(false);
  const [formData, setFormData] = useState({
    pool: poolId,
    field: '',
    harvest: '',
    ticket_number: '',
    delivery_date: new Date().toISOString().split('T')[0],
    bins: '',
    field_boxes: '',
    weight_lbs: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchFields();
  }, []);

  useEffect(() => {
    if (delivery) {
      setFormData({
        pool: delivery.pool || poolId,
        field: delivery.field || '',
        harvest: delivery.harvest || '',
        ticket_number: delivery.ticket_number || '',
        delivery_date: delivery.delivery_date || new Date().toISOString().split('T')[0],
        bins: delivery.bins || '',
        field_boxes: delivery.field_boxes || '',
        weight_lbs: delivery.weight_lbs || '',
        notes: delivery.notes || '',
      });
      // Fetch harvests if field is set
      if (delivery.field) {
        fetchHarvests(delivery.field);
      }
    }
  }, [delivery, poolId]);

  // Fetch harvests when field changes
  useEffect(() => {
    if (formData.field) {
      fetchHarvests(formData.field);
    } else {
      setHarvests([]);
      setFormData(prev => ({ ...prev, harvest: '' }));
    }
  }, [formData.field]);

  const fetchFields = async () => {
    try {
      const response = await fieldsAPI.getAll();
      setFields(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching fields:', error);
    }
  };

  const fetchHarvests = async (fieldId) => {
    try {
      setLoadingHarvests(true);
      // Fetch harvests for the selected field (current season, not fully delivered)
      const response = await harvestsAPI.getAll({
        field: fieldId,
        season: new Date().getFullYear()
      });
      const harvestData = response.data.results || response.data || [];
      setHarvests(harvestData);
    } catch (error) {
      console.error('Error fetching harvests:', error);
      setHarvests([]);
    } finally {
      setLoadingHarvests(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Handle harvest selection - auto-fill bins from harvest record
  const handleHarvestChange = (e) => {
    const harvestId = e.target.value;
    setFormData(prev => ({ ...prev, harvest: harvestId }));

    if (harvestId) {
      const selectedHarvest = harvests.find(h => h.id === parseInt(harvestId));
      if (selectedHarvest) {
        // Auto-fill bins from harvest if not already set
        if (!formData.bins) {
          setFormData(prev => ({
            ...prev,
            harvest: harvestId,
            bins: selectedHarvest.total_bins || ''
          }));
        }
        // Auto-fill delivery date from harvest date if not already set
        if (!delivery && selectedHarvest.harvest_date) {
          setFormData(prev => ({
            ...prev,
            harvest: harvestId,
            delivery_date: selectedHarvest.harvest_date
          }));
        }
      }
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.field) {
      newErrors.field = 'Field is required';
    }
    if (!formData.ticket_number.trim()) {
      newErrors.ticket_number = 'Ticket number is required';
    }
    if (!formData.delivery_date) {
      newErrors.delivery_date = 'Delivery date is required';
    }
    if (!formData.bins || parseFloat(formData.bins) <= 0) {
      newErrors.bins = 'Bins must be greater than 0';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSaving(true);
      const data = {
        ...formData,
        bins: parseFloat(formData.bins),
        field_boxes: formData.field_boxes ? parseFloat(formData.field_boxes) : null,
        weight_lbs: formData.weight_lbs ? parseFloat(formData.weight_lbs) : null,
        harvest: formData.harvest ? parseInt(formData.harvest) : null,
      };

      if (delivery) {
        await packinghouseDeliveriesAPI.update(delivery.id, data);
      } else {
        await packinghouseDeliveriesAPI.create(data);
      }
      onSave();
    } catch (error) {
      console.error('Error saving delivery:', error);
      if (error.response?.data) {
        setErrors(error.response.data);
      } else {
        alert('Failed to save delivery');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Truck className="w-5 h-5 mr-2 text-green-600" />
            {delivery ? 'Edit Delivery' : 'Record Delivery'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Field Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field/Block *
            </label>
            <select
              name="field"
              value={formData.field}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                errors.field ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select Field</option>
              {fields.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.farm_name && `(${f.farm_name})`}
                </option>
              ))}
            </select>
            {errors.field && (
              <p className="text-red-500 text-xs mt-1">{errors.field}</p>
            )}
          </div>

          {/* Harvest Linking */}
          {formData.field && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-orange-600" />
                Link to Harvest Record
              </label>
              {loadingHarvests ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading harvests...
                </div>
              ) : harvests.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">
                  No harvest records found for this field.
                </p>
              ) : (
                <>
                  <select
                    name="harvest"
                    value={formData.harvest}
                    onChange={handleHarvestChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">-- No harvest link (optional) --</option>
                    {harvests.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.harvest_date} - Pick #{h.harvest_number || 1} ({h.total_bins} bins) - {h.crop_variety_display || h.crop_variety}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Linking connects this delivery to a harvest for complete traceability
                  </p>
                </>
              )}
            </div>
          )}

          {/* Ticket Number and Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ticket Number *
              </label>
              <input
                type="text"
                name="ticket_number"
                value={formData.ticket_number}
                onChange={handleChange}
                placeholder="e.g., 182622"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.ticket_number ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.ticket_number && (
                <p className="text-red-500 text-xs mt-1">{errors.ticket_number}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Date *
              </label>
              <input
                type="date"
                name="delivery_date"
                value={formData.delivery_date}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.delivery_date ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.delivery_date && (
                <p className="text-red-500 text-xs mt-1">{errors.delivery_date}</p>
              )}
            </div>
          </div>

          {/* Quantity */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bins *
              </label>
              <input
                type="number"
                name="bins"
                value={formData.bins}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="0.00"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.bins ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.bins && (
                <p className="text-red-500 text-xs mt-1">{errors.bins}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Boxes
              </label>
              <input
                type="number"
                name="field_boxes"
                value={formData.field_boxes}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="Optional"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weight (lbs)
              </label>
              <input
                type="number"
                name="weight_lbs"
                value={formData.weight_lbs}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="Optional"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
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
              placeholder="Optional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeliveryModal;
