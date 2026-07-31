import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import { laborContractorsAPI } from '../services/api';
import Modal from './ui/Modal';
import FormField, { inputClasses, textareaClasses } from './ui/FormField';

const EMPTY_FORM = {
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
  notes: '',
};

const LaborContractorModal = ({ isOpen, onClose, onSave, contractor = null }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
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
          default_piece_rate: contractor.default_piece_rate || '',
        });
      } else {
        setFormData(EMPTY_FORM);
      }
      setErrors({});
    }
  }, [isOpen, contractor]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
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
        default_hourly_rate: formData.default_hourly_rate
          ? parseFloat(formData.default_hourly_rate)
          : null,
        default_piece_rate: formData.default_piece_rate
          ? parseFloat(formData.default_piece_rate)
          : null,
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

  const dateInputClass = (dateStr) => {
    if (isExpired(dateStr)) return `${inputClasses} border-red-500 bg-red-50`;
    if (isExpiringSoon(dateStr)) return `${inputClasses} border-yellow-500 bg-yellow-50`;
    return inputClasses;
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-button border border-gray-300 text-gray-700 hover:bg-gray-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="labor-contractor-form"
        disabled={saving}
        className="px-4 py-2 rounded-button bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
      >
        {saving ? 'Saving…' : contractor ? 'Update Contractor' : 'Add Contractor'}
      </button>
    </>
  );

  const sectionHeading = 'text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={contractor ? 'Edit Labor Contractor' : 'Add New Labor Contractor'}
      icon={Users}
      size="lg"
      footer={footer}
    >
      <form id="labor-contractor-form" onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className={sectionHeading}>Company Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Company Name" htmlFor="lc-company" required error={errors.company_name}>
              <input
                id="lc-company"
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                className={inputClasses}
                required
              />
            </FormField>
            <FormField label="Contact Name" htmlFor="lc-contact">
              <input
                id="lc-contact"
                type="text"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleChange}
                className={inputClasses}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <FormField label="Phone" htmlFor="lc-phone">
              <input
                id="lc-phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Email" htmlFor="lc-email">
              <input
                id="lc-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={inputClasses}
              />
            </FormField>
          </div>

          <div className="mt-4">
            <FormField label="Address" htmlFor="lc-address">
              <input
                id="lc-address"
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className={inputClasses}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <FormField label="City" htmlFor="lc-city">
              <input
                id="lc-city"
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className={inputClasses}
              />
            </FormField>
            <FormField label="State" htmlFor="lc-state">
              <input
                id="lc-state"
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                maxLength={2}
                className={inputClasses}
              />
            </FormField>
            <FormField label="ZIP Code" htmlFor="lc-zip">
              <input
                id="lc-zip"
                type="text"
                name="zip_code"
                value={formData.zip_code}
                onChange={handleChange}
                className={inputClasses}
              />
            </FormField>
          </div>
        </div>

        <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
          <h3 className={sectionHeading}>License & Insurance</h3>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="FLC License Number" htmlFor="lc-license">
              <input
                id="lc-license"
                type="text"
                name="contractor_license"
                value={formData.contractor_license}
                onChange={handleChange}
                className={inputClasses}
                placeholder="Farm Labor Contractor License"
              />
            </FormField>

            <FormField label="License Expiration" htmlFor="lc-licenseexp">
              <input
                id="lc-licenseexp"
                type="date"
                name="license_expiration"
                value={formData.license_expiration}
                onChange={handleChange}
                className={dateInputClass(formData.license_expiration)}
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
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <FormField label="Insurance Carrier" htmlFor="lc-ins-carrier">
              <input
                id="lc-ins-carrier"
                type="text"
                name="insurance_carrier"
                value={formData.insurance_carrier}
                onChange={handleChange}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Policy Number" htmlFor="lc-ins-policy">
              <input
                id="lc-ins-policy"
                type="text"
                name="insurance_policy_number"
                value={formData.insurance_policy_number}
                onChange={handleChange}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Insurance Expiration" htmlFor="lc-ins-exp">
              <input
                id="lc-ins-exp"
                type="date"
                name="insurance_expiration"
                value={formData.insurance_expiration}
                onChange={handleChange}
                className={dateInputClass(formData.insurance_expiration)}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <FormField label="Workers Comp Carrier" htmlFor="lc-wc-carrier">
              <input
                id="lc-wc-carrier"
                type="text"
                name="workers_comp_carrier"
                value={formData.workers_comp_carrier}
                onChange={handleChange}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Workers Comp Policy" htmlFor="lc-wc-policy">
              <input
                id="lc-wc-policy"
                type="text"
                name="workers_comp_policy"
                value={formData.workers_comp_policy}
                onChange={handleChange}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Workers Comp Expiration" htmlFor="lc-wc-exp">
              <input
                id="lc-wc-exp"
                type="date"
                name="workers_comp_expiration"
                value={formData.workers_comp_expiration}
                onChange={handleChange}
                className={dateInputClass(formData.workers_comp_expiration)}
              />
            </FormField>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <h3 className={sectionHeading}>Food Safety Training</h3>

            <label className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                name="food_safety_training_current"
                checked={formData.food_safety_training_current}
                onChange={handleChange}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">Training is current</span>
            </label>

            <FormField label="Training Expiration" htmlFor="lc-training-exp">
              <input
                id="lc-training-exp"
                type="date"
                name="training_expiration"
                value={formData.training_expiration}
                onChange={handleChange}
                className={inputClasses}
              />
            </FormField>
          </div>

          <div className="border border-green-200 rounded-lg p-4 bg-primary-light">
            <h3 className={sectionHeading}>Default Rates</h3>

            <div className="space-y-4">
              <FormField label="Hourly Rate ($/hour)" htmlFor="lc-hourly">
                <input
                  id="lc-hourly"
                  type="number"
                  name="default_hourly_rate"
                  value={formData.default_hourly_rate}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Piece Rate ($/bin)" htmlFor="lc-piece">
                <input
                  id="lc-piece"
                  type="number"
                  name="default_piece_rate"
                  value={formData.default_piece_rate}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  className={inputClasses}
                />
              </FormField>
            </div>
          </div>
        </div>

        <FormField label="Notes" htmlFor="lc-notes">
          <textarea
            id="lc-notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={2}
            className={textareaClasses}
          />
        </FormField>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="active"
            checked={formData.active}
            onChange={handleChange}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-gray-700">Active contractor</span>
        </label>
      </form>
    </Modal>
  );
};

export default LaborContractorModal;
