// =============================================================================
// POOL MODAL COMPONENT
// Create/edit pool records
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, Boxes, Save, Loader2 } from 'lucide-react';
import { poolsAPI, PACKINGHOUSE_CONSTANTS } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const PoolModal = ({ pool, packinghouses, onClose, onSave }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    packinghouse: '',
    pool_id: '',
    name: '',
    commodity: '',
    variety: '',
    season: PACKINGHOUSE_CONSTANTS.getCurrentSeason(),
    pool_type: 'fresh',
    status: 'active',
    open_date: '',
    close_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (pool) {
      setFormData({
        packinghouse: pool.packinghouse || '',
        pool_id: pool.pool_id || '',
        name: pool.name || '',
        commodity: pool.commodity || '',
        variety: pool.variety || '',
        season: pool.season || PACKINGHOUSE_CONSTANTS.getCurrentSeason(),
        pool_type: pool.pool_type || 'fresh',
        status: pool.status || 'active',
        open_date: pool.open_date || '',
        close_date: pool.close_date || '',
        notes: pool.notes || '',
      });
    }
  }, [pool]);

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

  const validate = () => {
    const newErrors = {};
    if (!formData.packinghouse) {
      newErrors.packinghouse = 'Packinghouse is required';
    }
    if (!formData.pool_id.trim()) {
      newErrors.pool_id = 'Pool ID is required';
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.commodity.trim()) {
      newErrors.commodity = 'Commodity is required';
    }
    if (!formData.season.trim()) {
      newErrors.season = 'Season is required';
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
        open_date: formData.open_date || null,
        close_date: formData.close_date || null,
      };

      if (pool) {
        await poolsAPI.update(pool.id, data);
      } else {
        await poolsAPI.create(data);
      }
      onSave();
    } catch (error) {
      console.error('Error saving pool:', error);
      if (error.response?.data) {
        setErrors(error.response.data);
      } else {
        toast.error('Failed to save pool');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Boxes className="w-5 h-5 mr-2 text-green-600" />
            {pool ? 'Edit Pool' : 'Add Pool'}
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
          {/* Packinghouse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Packinghouse *
            </label>
            <select
              name="packinghouse"
              value={formData.packinghouse}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                errors.packinghouse ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select Packinghouse</option>
              {packinghouses.map(ph => (
                <option key={ph.id} value={ph.id}>
                  {ph.name} {ph.short_code && `(${ph.short_code})`}
                </option>
              ))}
            </select>
            {errors.packinghouse && (
              <p className="text-red-500 text-xs mt-1">{errors.packinghouse}</p>
            )}
          </div>

          {/* Pool ID and Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pool ID *
              </label>
              <input
                type="text"
                name="pool_id"
                value={formData.pool_id}
                onChange={handleChange}
                placeholder="e.g., 2520000 D2 POOL"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.pool_id ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.pool_id && (
                <p className="text-red-500 text-xs mt-1">{errors.pool_id}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pool Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Friendly name"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>
          </div>

          {/* Commodity and Variety */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Commodity *
              </label>
              <select
                name="commodity"
                value={formData.commodity}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.commodity ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select Commodity</option>
                {PACKINGHOUSE_CONSTANTS.commodities.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {errors.commodity && (
                <p className="text-red-500 text-xs mt-1">{errors.commodity}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Variety
              </label>
              <input
                type="text"
                name="variety"
                value={formData.variety}
                onChange={handleChange}
                placeholder="e.g., Cara Navels"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Season, Type, Status */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Season *
              </label>
              <input
                type="text"
                name="season"
                value={formData.season}
                onChange={handleChange}
                placeholder="e.g., 2024-2025"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                  errors.season ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {errors.season && (
                <p className="text-red-500 text-xs mt-1">{errors.season}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pool Type
              </label>
              <select
                name="pool_type"
                value={formData.pool_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                {PACKINGHOUSE_CONSTANTS.poolTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                {PACKINGHOUSE_CONSTANTS.poolStatuses.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Open Date
              </label>
              <input
                type="date"
                name="open_date"
                value={formData.open_date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Close Date
              </label>
              <input
                type="date"
                name="close_date"
                value={formData.close_date}
                onChange={handleChange}
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
              rows={3}
              placeholder="Additional notes..."
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

export default PoolModal;
