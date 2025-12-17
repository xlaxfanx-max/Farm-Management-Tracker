// =============================================================================
// FERTILIZER PRODUCT MODAL
// =============================================================================
// src/components/FertilizerProductModal.js
// Modal for creating and editing fertilizer products
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, Package, AlertTriangle, Leaf } from 'lucide-react';
import { fertilizerProductsAPI, NUTRIENT_CONSTANTS } from '../services/api';

const FertilizerProductModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  product = null 
}) => {
  // Form state
  const [formData, setFormData] = useState({
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
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Populate form when editing
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
      setFormData({
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
      });
      setShowAdvanced(false);
    }
  }, [product, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {product ? 'Edit Product' : 'Add Fertilizer Product'}
              </h2>
              <p className="text-sm text-gray-500">Enter product analysis from label</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Product Name & Manufacturer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Urea, CAN-17, Triple 15"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
                <input
                  type="text"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleChange}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Code</label>
                <input
                  type="text"
                  name="product_code"
                  value={formData.product_code}
                  onChange={handleChange}
                  placeholder="SKU or UPC"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* NPK Analysis */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Guaranteed Analysis (N-P-K)
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nitrogen (N) %</label>
                  <input
                    type="number"
                    name="nitrogen_pct"
                    value={formData.nitrogen_pct}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-lg font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Phosphate (P₂O₅) %</label>
                  <input
                    type="number"
                    name="phosphorus_pct"
                    value={formData.phosphorus_pct}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-lg font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Potash (K₂O) %</label>
                  <input
                    type="number"
                    name="potassium_pct"
                    value={formData.potassium_pct}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-lg font-medium"
                  />
                </div>
              </div>
              
              <div className="mt-3 text-center">
                <span className="text-3xl font-bold text-green-600">{getNPKDisplay()}</span>
              </div>
            </div>

            {/* Form & Density */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Form</label>
                <select
                  name="form"
                  value={formData.form}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {NUTRIENT_CONSTANTS.FERTILIZER_FORMS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              
              {(formData.form === 'liquid' || formData.form === 'suspension') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Density (lbs/gal)</label>
                  <input
                    type="number"
                    name="density_lbs_per_gallon"
                    value={formData.density_lbs_per_gallon}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    placeholder="e.g., 11.06"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            {/* Organic Certifications */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_organic"
                  checked={formData.is_organic}
                  onChange={handleChange}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-700">Organic Product</span>
              </label>
              
              {formData.is_organic && (
                <div className="ml-6 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="omri_listed"
                      checked={formData.omri_listed}
                      onChange={handleChange}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">OMRI Listed</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="cdfa_organic_registered"
                      checked={formData.cdfa_organic_registered}
                      onChange={handleChange}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">CDFA Organic Registered</span>
                  </label>
                </div>
              )}
            </div>

            {/* Secondary Nutrients */}
            <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
              >
                {showAdvanced ? '▼' : '▶'} Secondary Nutrients (Optional)
              </button>
              
              {showAdvanced && (
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Calcium (Ca) %</label>
                    <input
                      type="number"
                      name="calcium_pct"
                      value={formData.calcium_pct}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Magnesium (Mg) %</label>
                    <input
                      type="number"
                      name="magnesium_pct"
                      value={formData.magnesium_pct}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Sulfur (S) %</label>
                    <input
                      type="number"
                      name="sulfur_pct"
                      value={formData.sulfur_pct}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Additional notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Saving...' : (
                <>
                  <Leaf className="w-4 h-4" />
                  {product ? 'Update Product' : 'Save Product'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FertilizerProductModal;
