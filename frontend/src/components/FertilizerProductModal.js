import React, { useState, useEffect } from 'react';
import { Package, AlertTriangle, Leaf } from 'lucide-react';
import { fertilizerProductsAPI, NUTRIENT_CONSTANTS } from '../services/api';
import Modal from './ui/Modal';
import FormField, { inputClasses, selectClasses, textareaClasses } from './ui/FormField';

const EMPTY_FORM = {
  name: '',
  manufacturer: '',
  product_code: '',
  nitrogen_pct: '',
  phosphorus_pct: '',
  potassium_pct: '',
  form: 'granular',
  density_lbs_per_gallon: '',
  is_organic: false,
  omri_listed: false,
  cdfa_organic_registered: false,
  calcium_pct: '',
  magnesium_pct: '',
  sulfur_pct: '',
  notes: '',
};

const FertilizerProductModal = ({ isOpen, onClose, onSave, product = null }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        manufacturer: product.manufacturer || '',
        product_code: product.product_code || '',
        nitrogen_pct: product.nitrogen_pct || '',
        phosphorus_pct: product.phosphorus_pct || '',
        potassium_pct: product.potassium_pct || '',
        form: product.form || 'granular',
        density_lbs_per_gallon: product.density_lbs_per_gallon || '',
        is_organic: product.is_organic || false,
        omri_listed: product.omri_listed || false,
        cdfa_organic_registered: product.cdfa_organic_registered || false,
        calcium_pct: product.calcium_pct || '',
        magnesium_pct: product.magnesium_pct || '',
        sulfur_pct: product.sulfur_pct || '',
        notes: product.notes || '',
      });
      if (product.calcium_pct || product.magnesium_pct || product.sulfur_pct) {
        setShowAdvanced(true);
      }
    } else {
      setFormData(EMPTY_FORM);
      setShowAdvanced(false);
    }
  }, [product, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const getNPKDisplay = () => {
    const n = formData.nitrogen_pct || 0;
    const p = formData.phosphorus_pct || 0;
    const k = formData.potassium_pct || 0;
    return `${n}-${p}-${k}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.name.trim()) throw new Error('Please enter a product name');

      const data = {
        ...formData,
        nitrogen_pct: parseFloat(formData.nitrogen_pct) || 0,
        phosphorus_pct: parseFloat(formData.phosphorus_pct) || 0,
        potassium_pct: parseFloat(formData.potassium_pct) || 0,
        density_lbs_per_gallon: formData.density_lbs_per_gallon
          ? parseFloat(formData.density_lbs_per_gallon)
          : null,
        calcium_pct: formData.calcium_pct ? parseFloat(formData.calcium_pct) : null,
        magnesium_pct: formData.magnesium_pct ? parseFloat(formData.magnesium_pct) : null,
        sulfur_pct: formData.sulfur_pct ? parseFloat(formData.sulfur_pct) : null,
      };

      if (product?.id) {
        await fertilizerProductsAPI.update(product.id, data);
      } else {
        await fertilizerProductsAPI.create(data);
      }

      if (onSave) onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const centeredInput = `${inputClasses} text-center text-lg font-medium`;

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-button text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="fert-product-form"
        disabled={loading}
        className="px-4 py-2 rounded-button bg-primary text-white hover:bg-primary-hover disabled:opacity-50 flex items-center gap-2"
      >
        {loading ? (
          'Saving…'
        ) : (
          <>
            <Leaf className="w-4 h-4" />
            {product ? 'Update Product' : 'Save Product'}
          </>
        )}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Edit Product' : 'Add Fertilizer Product'}
      subtitle="Enter product analysis from label"
      icon={Package}
      size="md"
      footer={footer}
    >
      <form id="fert-product-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div
            className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-center gap-2"
            role="alert"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FormField label="Product Name" htmlFor="fp-name" required>
              <input
                id="fp-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g., Urea, CAN-17, Triple 15"
                className={inputClasses}
              />
            </FormField>
          </div>

          <FormField label="Manufacturer" htmlFor="fp-mfr">
            <input
              id="fp-mfr"
              type="text"
              name="manufacturer"
              value={formData.manufacturer}
              onChange={handleChange}
              placeholder="Optional"
              className={inputClasses}
            />
          </FormField>

          <FormField label="Product Code" htmlFor="fp-code">
            <input
              id="fp-code"
              type="text"
              name="product_code"
              value={formData.product_code}
              onChange={handleChange}
              placeholder="SKU or UPC"
              className={inputClasses}
            />
          </FormField>
        </div>

        <div>
          <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Guaranteed Analysis (N-P-K)
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Nitrogen (N) %" htmlFor="fp-n">
              <input
                id="fp-n"
                type="number"
                name="nitrogen_pct"
                value={formData.nitrogen_pct}
                onChange={handleChange}
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
                className={centeredInput}
              />
            </FormField>
            <FormField label="Phosphate (P₂O₅) %" htmlFor="fp-p">
              <input
                id="fp-p"
                type="number"
                name="phosphorus_pct"
                value={formData.phosphorus_pct}
                onChange={handleChange}
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
                className={centeredInput}
              />
            </FormField>
            <FormField label="Potash (K₂O) %" htmlFor="fp-k">
              <input
                id="fp-k"
                type="number"
                name="potassium_pct"
                value={formData.potassium_pct}
                onChange={handleChange}
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
                className={centeredInput}
              />
            </FormField>
          </div>

          <div className="mt-3 text-center">
            <span className="text-3xl font-bold text-primary dark:text-green-400">
              {getNPKDisplay()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Form" htmlFor="fp-form">
            <select
              id="fp-form"
              name="form"
              value={formData.form}
              onChange={handleChange}
              className={selectClasses}
            >
              {NUTRIENT_CONSTANTS.FERTILIZER_FORMS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </FormField>

          {(formData.form === 'liquid' || formData.form === 'suspension') && (
            <FormField label="Density (lbs/gal)" htmlFor="fp-density">
              <input
                id="fp-density"
                type="number"
                name="density_lbs_per_gallon"
                value={formData.density_lbs_per_gallon}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="e.g., 11.06"
                className={inputClasses}
              />
            </FormField>
          )}
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="is_organic"
              checked={formData.is_organic}
              onChange={handleChange}
              className="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
            />
            <span className="text-sm text-gray-700 dark:text-gray-200">Organic Product</span>
          </label>

          {formData.is_organic && (
            <div className="ml-6 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="omri_listed"
                  checked={formData.omri_listed}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">OMRI Listed</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="cdfa_organic_registered"
                  checked={formData.cdfa_organic_registered}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary"
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  CDFA Organic Registered
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 flex items-center gap-1"
            aria-expanded={showAdvanced}
          >
            {showAdvanced ? '▼' : '▶'} Secondary Nutrients (Optional)
          </button>

          {showAdvanced && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              <FormField label="Calcium (Ca) %" htmlFor="fp-ca">
                <input
                  id="fp-ca"
                  type="number"
                  name="calcium_pct"
                  value={formData.calcium_pct}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="0"
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Magnesium (Mg) %" htmlFor="fp-mg">
                <input
                  id="fp-mg"
                  type="number"
                  name="magnesium_pct"
                  value={formData.magnesium_pct}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="0"
                  className={inputClasses}
                />
              </FormField>
              <FormField label="Sulfur (S) %" htmlFor="fp-s">
                <input
                  id="fp-s"
                  type="number"
                  name="sulfur_pct"
                  value={formData.sulfur_pct}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="0"
                  className={inputClasses}
                />
              </FormField>
            </div>
          )}
        </div>

        <FormField label="Notes" htmlFor="fp-notes">
          <textarea
            id="fp-notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={2}
            placeholder="Additional notes…"
            className={textareaClasses}
          />
        </FormField>
      </form>
    </Modal>
  );
};

export default FertilizerProductModal;
