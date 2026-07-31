// =============================================================================
// PACKINGHOUSE MODAL COMPONENT
// Create/edit packinghouse records
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, Building2, Save, Loader2 } from 'lucide-react';
import { packinghousesAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const PackinghouseModal = ({ packinghouse, onClose, onSave }) => {
  const toast = useToast();
  const [formData, setFormData] = useState({
    name: '',
    short_code: '',
    address: '',
    city: '',
    state: 'CA',
    zip_code: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    grower_id: '',
    notes: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (packinghouse) {
      setFormData({
        name: packinghouse.name || '',
        short_code: packinghouse.short_code || '',
        address: packinghouse.address || '',
        city: packinghouse.city || '',
        state: packinghouse.state || 'CA',
        zip_code: packinghouse.zip_code || '',
        contact_name: packinghouse.contact_name || '',
        contact_phone: packinghouse.contact_phone || '',
        contact_email: packinghouse.contact_email || '',
        grower_id: packinghouse.grower_id || '',
        notes: packinghouse.notes || '',
        is_active: packinghouse.is_active !== false,
      });
    }
  }, [packinghouse]);

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
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSaving(true);
      if (packinghouse) {
        await packinghousesAPI.update(packinghouse.id, formData);
      } else {
        await packinghousesAPI.create(formData);
      }
      onSave();
    } catch (error) {
      console.error('Error saving packinghouse:', error);
      if (error.response?.data) {
        setErrors(error.response.data);
      } else {
        toast.error('Failed to save packinghouse');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface-raised rounded-card shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg text-heading flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-primary" />
            {packinghouse ? 'Edit Packinghouse' : 'Add Packinghouse'}
          </h2>
          <button aria-label="Close"
            onClick={onClose}
            className="p-2 hover:bg-cream-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-bark-700 mb-1">
                Packinghouse Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Saticoy Lemon Association"
                className={`w-full px-3 py-2 border rounded-card focus:ring-2 focus:ring-primary focus:border-transparent ${
                  errors.name ? 'border-danger' : 'border-border-strong'
                }`}
              />
              {errors.name && (
                <p className="text-danger text-xs mt-1">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">
                Short Code
              </label>
              <input
                type="text"
                name="short_code"
                value={formData.short_code}
                onChange={handleChange}
                placeholder="e.g., SLA"
                maxLength={20}
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">
              Your Grower ID
            </label>
            <input
              type="text"
              name="grower_id"
              value={formData.grower_id}
              onChange={handleChange}
              placeholder="e.g., THACR641"
              className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
            />
            <p className="text-xs text-text-secondary mt-1">
              Your grower identification number with this packinghouse
            </p>
          </div>

          {/* Address */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm text-bark-700 mb-3">Address</h3>
            <div className="space-y-3">
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Street Address"
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City"
                  className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
                />
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="State"
                  maxLength={2}
                  className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
                />
                <input
                  type="text"
                  name="zip_code"
                  value={formData.zip_code}
                  onChange={handleChange}
                  placeholder="ZIP"
                  className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="border-t border-border pt-4">
            <h3 className="text-sm text-bark-700 mb-3">Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleChange}
                placeholder="Contact Name"
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              />
              <input
                type="tel"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
                placeholder="Phone"
                className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
              />
              <div>
                <input
                  type="email"
                  name="contact_email"
                  value={formData.contact_email}
                  onChange={handleChange}
                  placeholder="Email"
                  className={`w-full px-3 py-2 border rounded-card focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.contact_email ? 'border-danger' : 'border-border-strong'
                  }`}
                />
                {errors.contact_email && (
                  <p className="text-danger text-xs mt-1">{errors.contact_email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-bark-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Additional notes..."
              className="w-full px-3 py-2 text-sm rounded-button border border-border-strong bg-surface-raised text-text shadow-inset placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-ring disabled:bg-surface-sunken disabled:cursor-not-allowed transition-all duration-fast ease-out"
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center">
            <input
              type="checkbox"
              name="is_active"
              id="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="rounded border-border-strong text-primary focus:ring-primary"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-bark-700">
              Active (show in lists and dropdowns)
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-bark-700 hover:bg-cream-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
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

export default PackinghouseModal;
