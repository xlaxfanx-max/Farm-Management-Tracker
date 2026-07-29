import React, { useState, useEffect } from 'react';
import { Building } from 'lucide-react';
import { buyersAPI, HARVEST_CONSTANTS } from '../services/api';
import Modal from './ui/Modal';
import FormField, { inputClasses, selectClasses, textareaClasses } from './ui/FormField';

const EMPTY_BUYER = {
  name: '',
  buyer_type: 'packing_house',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: 'CA',
  zip_code: '',
  license_number: '',
  payment_terms: '',
  active: true,
  notes: '',
};

const BuyerModal = ({ isOpen, onClose, onSave, buyer = null }) => {
  const [formData, setFormData] = useState(EMPTY_BUYER);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(buyer ? { ...buyer } : EMPTY_BUYER);
      setErrors({});
    }
  }, [isOpen, buyer]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Buyer name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      if (buyer) {
        await buyersAPI.update(buyer.id, formData);
      } else {
        await buyersAPI.create(formData);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving buyer:', error);
      if (error.response?.data) {
        setErrors(error.response.data);
      }
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-button border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="buyer-form"
        disabled={saving}
        className="px-4 py-2 rounded-button bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {saving ? 'Saving…' : buyer ? 'Update Buyer' : 'Add Buyer'}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={buyer ? 'Edit Buyer' : 'Add New Buyer'}
      icon={Building}
      size="lg"
      footer={footer}
    >
      <form id="buyer-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Buyer Name" htmlFor="buyer-name" required error={errors.name}>
            <input
              id="buyer-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={inputClasses}
              placeholder="Company or buyer name"
              required
            />
          </FormField>

          <FormField label="Buyer Type" htmlFor="buyer-type">
            <select
              id="buyer-type"
              name="buyer_type"
              value={formData.buyer_type}
              onChange={handleChange}
              className={selectClasses}
            >
              {HARVEST_CONSTANTS.BUYER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Contact Name" htmlFor="buyer-contact">
            <input
              id="buyer-contact"
              type="text"
              name="contact_name"
              value={formData.contact_name}
              onChange={handleChange}
              className={inputClasses}
            />
          </FormField>

          <FormField label="Phone" htmlFor="buyer-phone">
            <input
              id="buyer-phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={inputClasses}
            />
          </FormField>

          <FormField label="Email" htmlFor="buyer-email">
            <input
              id="buyer-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={inputClasses}
            />
          </FormField>
        </div>

        <FormField label="Address" htmlFor="buyer-address">
          <input
            id="buyer-address"
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className={inputClasses}
          />
        </FormField>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="City" htmlFor="buyer-city">
            <input
              id="buyer-city"
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className={inputClasses}
            />
          </FormField>

          <FormField label="State" htmlFor="buyer-state">
            <input
              id="buyer-state"
              type="text"
              name="state"
              value={formData.state}
              onChange={handleChange}
              maxLength={2}
              className={inputClasses}
            />
          </FormField>

          <FormField label="ZIP Code" htmlFor="buyer-zip">
            <input
              id="buyer-zip"
              type="text"
              name="zip_code"
              value={formData.zip_code}
              onChange={handleChange}
              className={inputClasses}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="License Number" htmlFor="buyer-license">
            <input
              id="buyer-license"
              type="text"
              name="license_number"
              value={formData.license_number}
              onChange={handleChange}
              className={inputClasses}
              placeholder="Packer/shipper license"
            />
          </FormField>

          <FormField label="Payment Terms" htmlFor="buyer-terms">
            <input
              id="buyer-terms"
              type="text"
              name="payment_terms"
              value={formData.payment_terms}
              onChange={handleChange}
              className={inputClasses}
              placeholder="e.g., Net 30"
            />
          </FormField>
        </div>

        <FormField label="Notes" htmlFor="buyer-notes">
          <textarea
            id="buyer-notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={2}
            className={textareaClasses}
          />
        </FormField>

        <label className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            name="active"
            checked={formData.active}
            onChange={handleChange}
            className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
          />
          <span className="text-sm text-gray-700 dark:text-gray-200">Active buyer</span>
        </label>
      </form>
    </Modal>
  );
};

export default BuyerModal;
