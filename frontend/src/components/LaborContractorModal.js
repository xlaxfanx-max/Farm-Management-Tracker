// =============================================================================
// LABOR CONTRACTOR MODAL COMPONENT
// Save as: frontend/src/components/LaborContractorModal.js
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, Users, AlertTriangle } from 'lucide-react';
import { laborContractorsAPI } from '../services/api';

const LaborContractorModal = ({ isOpen, onClose, onSave, contractor = null }) => {
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: 'CA',
    zip_code: '',
    contractor_license: '',
    license_expiration: '',
    insurance_carrier: '',
    insurance_policy_number: '',
    insurance_expiration: '',
    workers_comp_carrier: '',
    workers_comp_policy: '',
    workers_comp_expiration: '',
    food_safety_training_current: false,
    training_expiration: '',
    default_hourly_rate: '',
    default_piece_rate: '',
    active: true,
    notes: ''
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (contractor) {
        setFormData({ 
          ...contractor,
          license_expiration: contractor.license_expiration || '',
          insurance_expiration: contractor.insurance_expiration || '',
          workers_comp_expiration: contractor.workers_comp_expiration || '',
          training_expiration: contractor.training_expiration || '',
          default_hourly_rate: contractor.default_hourly_rate || '',
          default_piece_rate: contractor.default_piece_rate || ''
        });
      } else {
        setFormData({
          company_name: '',
          contact_name: '',
          phone: '',
          email: '',
          address: '',
          city: '',
          state: 'CA',
          zip_code: '',
          contractor_license: '',
          license_expiration: '',
          insurance_carrier: '',
          insurance_policy_number: '',
          insurance_expiration: '',
          workers_comp_carrier: '',
          workers_comp_policy: '',
          workers_comp_expiration: '',
          food_safety_training_current: false,
          training_expiration: '',
          default_hourly_rate: '',
          default_piece_rate: '',
          active: true,
          notes: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, contractor]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.company_name) newErrors.company_name = 'Company name is required';
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
        license_expiration: formData.license_expiration || null,
        insurance_expiration: formData.insurance_expiration || null,
        workers_comp_expiration: formData.workers_comp_expiration || null,
        training_expiration: formData.training_expiration || null,
        default_hourly_rate: formData.default_hourly_rate ? parseFloat(formData.default_hourly_rate) : null,
        default_piece_rate: formData.default_piece_rate ? parseFloat(formData.default_piece_rate) : null
      };

      if (contractor) {
        await laborContractorsAPI.update(contractor.id, dataToSave);
      } else {
        await laborContractorsAPI.create(dataToSave);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving contractor:', error);
      if (error.response?.data) {
        setErrors(error.response.data);
      }
    } finally {
      setSaving(false);
    }
  };

  // Check for expiring dates
  const isExpiringSoon = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return date <= thirtyDaysFromNow;
  };

  const isExpired = (dateStr) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <Users className="text-purple-600" size={24} />
            <h2 className="text-xl font-semibold">
              {contractor ? 'Edit Labor Contractor' : 'Add New Labor Contractor'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Company Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Company Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 ${errors.company_name ? 'border-red-500' : ''}`}
                  required
                />
                {errors.company_name && <p className="text-red-500 text-sm mt-1">{errors.company_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  name="contact_name"
                  value={formData.contact_name}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  maxLength={2}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP Code
                </label>
                <input
                  type="text"
                  name="zip_code"
                  value={formData.zip_code}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* License & Insurance */}
          <div className="border rounded-lg p-4 bg-yellow-50">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              License & Insurance
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  FLC License Number
                </label>
                <input
                  type="text"
                  name="contractor_license"
                  value={formData.contractor_license}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Farm Labor Contractor License"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License Expiration
                </label>
                <input
                  type="date"
                  name="license_expiration"
                  value={formData.license_expiration}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 ${
                    isExpired(formData.license_expiration) ? 'border-red-500 bg-red-50' :
                    isExpiringSoon(formData.license_expiration) ? 'border-yellow-500 bg-yellow-50' : ''
                  }`}
                />
                {isExpired(formData.license_expiration) && (
                  <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> Expired
                  </p>
                )}
                {!isExpired(formData.license_expiration) && isExpiringSoon(formData.license_expiration) && (
                  <p className="text-yellow-600 text-xs mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> Expiring soon
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Insurance Carrier
                </label>
                <input
                  type="text"
                  name="insurance_carrier"
                  value={formData.insurance_carrier}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy Number
                </label>
                <input
                  type="text"
                  name="insurance_policy_number"
                  value={formData.insurance_policy_number}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Insurance Expiration
                </label>
                <input
                  type="date"
                  name="insurance_expiration"
                  value={formData.insurance_expiration}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 ${
                    isExpired(formData.insurance_expiration) ? 'border-red-500 bg-red-50' :
                    isExpiringSoon(formData.insurance_expiration) ? 'border-yellow-500 bg-yellow-50' : ''
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workers Comp Carrier
                </label>
                <input
                  type="text"
                  name="workers_comp_carrier"
                  value={formData.workers_comp_carrier}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workers Comp Policy
                </label>
                <input
                  type="text"
                  name="workers_comp_policy"
                  value={formData.workers_comp_policy}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workers Comp Expiration
                </label>
                <input
                  type="date"
                  name="workers_comp_expiration"
                  value={formData.workers_comp_expiration}
                  onChange={handleChange}
                  className={`w-full border rounded-lg px-3 py-2 ${
                    isExpired(formData.workers_comp_expiration) ? 'border-red-500 bg-red-50' :
                    isExpiringSoon(formData.workers_comp_expiration) ? 'border-yellow-500 bg-yellow-50' : ''
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Training & Rates */}
          <div className="grid grid-cols-2 gap-6">
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Food Safety Training
              </h3>
              
              <label className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  name="food_safety_training_current"
                  checked={formData.food_safety_training_current}
                  onChange={handleChange}
                  className="rounded"
                />
                <span className="text-sm">Training is current</span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Training Expiration
                </label>
                <input
                  type="date"
                  name="training_expiration"
                  value={formData.training_expiration}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div className="border rounded-lg p-4 bg-green-50">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Default Rates
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hourly Rate ($/hour)
                  </label>
                  <input
                    type="number"
                    name="default_hourly_rate"
                    value={formData.default_hourly_rate}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Piece Rate ($/bin)
                  </label>
                  <input
                    type="number"
                    name="default_piece_rate"
                    value={formData.default_piece_rate}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>
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
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="active"
              checked={formData.active}
              onChange={handleChange}
              className="rounded"
            />
            <span className="text-sm">Active contractor</span>
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : (contractor ? 'Update Contractor' : 'Add Contractor')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LaborContractorModal;
