// =============================================================================
// NUTRIENT APPLICATION MODAL
// =============================================================================
// src/components/NutrientApplicationModal.js
// Modal for creating and editing fertilizer applications
// =============================================================================

import React, { useState, useEffect } from 'react';
import { X, Leaf, Search, AlertTriangle, Calculator } from 'lucide-react';
import { 
  nutrientApplicationsAPI, 
  fertilizerProductsAPI,
  NUTRIENT_CONSTANTS 
} from '../services/api';

const NutrientApplicationModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  application = null,
  farms = [],
  fields = [],
  waterSources = []
}) => {
  // Form state
  const [formData, setFormData] = useState({
    field: '',
    product: '',
    application_date: new Date().toISOString().split('T')[0],
    rate: '',
    rate_unit: 'lbs_acre',
    acres_treated: '',
    application_method: 'broadcast',
    water_source: '',
    applied_by: '',
    custom_applicator: false,
    applicator_company: '',
    cost_per_unit: '',
    cost_unit: '',
    total_product_cost: '',
    application_cost: '',
    notes: '',
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedField, setSelectedField] = useState(null);

  // Calculated values preview
  const [preview, setPreview] = useState({
    lbs_nitrogen_per_acre: null,
    total_lbs_nitrogen: null,
  });

  // Load products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fertilizerProductsAPI.getAll();
        setProducts(response.data.results || response.data || []);
      } catch (err) {
        console.error('Error loading products:', err);
      }
    };
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  // Populate form when editing
  useEffect(() => {
    if (application) {
      setFormData({
        field: application.field || '',
        product: application.product || '',
        application_date: application.application_date || new Date().toISOString().split('T')[0],
        rate: application.rate || '',
        rate_unit: application.rate_unit || 'lbs_acre',
        acres_treated: application.acres_treated || '',
        application_method: application.application_method || 'broadcast',
        water_source: application.water_source || '',
        applied_by: application.applied_by || '',
        custom_applicator: application.custom_applicator || false,
        applicator_company: application.applicator_company || '',
        cost_per_unit: application.cost_per_unit || '',
        cost_unit: application.cost_unit || '',
        total_product_cost: application.total_product_cost || '',
        application_cost: application.application_cost || '',
        notes: application.notes || '',
      });
      
      // Set selected product
      if (application.product) {
        const prod = products.find(p => p.id === application.product);
        if (prod) {
          setSelectedProduct(prod);
          setProductSearch(prod.name);
        }
      }
    } else {
      // Reset form for new application
      setFormData({
        field: '',
        product: '',
        application_date: new Date().toISOString().split('T')[0],
        rate: '',
        rate_unit: 'lbs_acre',
        acres_treated: '',
        application_method: 'broadcast',
        water_source: '',
        applied_by: '',
        custom_applicator: false,
        applicator_company: '',
        cost_per_unit: '',
        cost_unit: '',
        total_product_cost: '',
        application_cost: '',
        notes: '',
      });
      setSelectedProduct(null);
      setProductSearch('');
    }
  }, [application, products, isOpen]);

  // Update selected field when field changes
  useEffect(() => {
    if (formData.field) {
      const field = fields.find(f => f.id === parseInt(formData.field));
      setSelectedField(field);
    } else {
      setSelectedField(null);
    }
  }, [formData.field, fields]);

  // Calculate preview
  useEffect(() => {
    if (selectedProduct && formData.rate) {
      const rate = parseFloat(formData.rate);
      let rateLbsPerAcre = rate;
      
      // Convert rate to lbs/acre based on unit
      if (formData.rate_unit === 'tons_acre') {
        rateLbsPerAcre = rate * 2000;
      } else if (formData.rate_unit === 'gal_acre') {
        const density = selectedProduct.density_lbs_per_gallon || 10;
        rateLbsPerAcre = rate * density;
      } else if (formData.rate_unit === 'oz_acre') {
        rateLbsPerAcre = rate / 16;
      } else if (formData.rate_unit === 'lbs_1000sqft') {
        rateLbsPerAcre = rate * 43.56;
      }
      
      const nitrogenPct = parseFloat(selectedProduct.nitrogen_pct) / 100;
      const lbsNPerAcre = rateLbsPerAcre * nitrogenPct;
      
      const acres = formData.acres_treated 
        ? parseFloat(formData.acres_treated) 
        : (selectedField?.total_acres || 0);
      
      setPreview({
        lbs_nitrogen_per_acre: lbsNPerAcre,
        total_lbs_nitrogen: lbsNPerAcre * acres,
      });
    } else {
      setPreview({
        lbs_nitrogen_per_acre: null,
        total_lbs_nitrogen: null,
      });
    }
  }, [selectedProduct, formData.rate, formData.rate_unit, formData.acres_treated, selectedField]);

  // Filter products based on search
  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.npk_display?.includes(productSearch)
  );

  // Get fields for selected farm or all fields
  const availableFields = fields;

  // Get water sources that can be used for fertigation
  const fertigationSources = waterSources.filter(ws => 
    ws.used_for_irrigation && ws.active
  );

  // Handle input change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle product selection
  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setProductSearch(product.name);
    setFormData(prev => ({ ...prev, product: product.id }));
    setShowProductDropdown(false);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.field) throw new Error('Please select a field');
      if (!formData.product) throw new Error('Please select a product');
      if (!formData.rate || parseFloat(formData.rate) <= 0) throw new Error('Please enter a valid rate');

      // Prepare data
      const data = {
        ...formData,
        field: parseInt(formData.field),
        product: parseInt(formData.product),
        rate: parseFloat(formData.rate),
        acres_treated: formData.acres_treated ? parseFloat(formData.acres_treated) : null,
        water_source: formData.water_source ? parseInt(formData.water_source) : null,
        cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null,
        total_product_cost: formData.total_product_cost ? parseFloat(formData.total_product_cost) : null,
        application_cost: formData.application_cost ? parseFloat(formData.application_cost) : null,
      };

      if (application?.id) {
        await nutrientApplicationsAPI.update(application.id, data);
      } else {
        await nutrientApplicationsAPI.create(data);
      }

      if (onSave) onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to save application');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Leaf className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {application ? 'Edit Application' : 'Add Nutrient Application'}
              </h2>
              <p className="text-sm text-gray-500">Record fertilizer application details</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Field & Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Field <span className="text-red-500">*</span>
                </label>
                <select
                  name="field"
                  value={formData.field}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select field...</option>
                  {availableFields.map(field => (
                    <option key={field.id} value={field.id}>
                      {field.name} ({field.total_acres} ac) - {field.farm_name || farms.find(f => f.id === field.farm)?.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Application Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="application_date"
                  value={formData.application_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fertilizer Product <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    placeholder="Search products by name or NPK..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredProducts.map(product => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleProductSelect(product)}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-50 flex justify-between items-center ${
                          selectedProduct?.id === product.id ? 'bg-green-50' : ''
                        }`}
                      >
                        <div>
                          <div className="font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.manufacturer}</div>
                        </div>
                        <span className="text-green-600 font-medium">{product.npk_display}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {selectedProduct && (
                <div className="mt-2 p-3 bg-green-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-green-800">{selectedProduct.name}</span>
                    <span className="text-2xl font-bold text-green-600">{selectedProduct.npk_display}</span>
                  </div>
                  <div className="text-sm text-green-700 mt-1">
                    {selectedProduct.nitrogen_pct}% Nitrogen • {selectedProduct.form}
                    {selectedProduct.is_organic && ' • Organic'}
                  </div>
                </div>
              )}
            </div>

            {/* Rate & Unit */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rate <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="rate"
                  value={formData.rate}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  required
                  placeholder="e.g., 200"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit
                </label>
                <select
                  name="rate_unit"
                  value={formData.rate_unit}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {NUTRIENT_CONSTANTS.RATE_UNITS.map(unit => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Acres Treated
                </label>
                <input
                  type="number"
                  name="acres_treated"
                  value={formData.acres_treated}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder={selectedField ? `${selectedField.total_acres} (field total)` : 'Optional'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Nitrogen Preview */}
            {preview.lbs_nitrogen_per_acre !== null && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Calculated Nitrogen</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {preview.lbs_nitrogen_per_acre.toFixed(1)} lbs/ac
                    </div>
                    <div className="text-sm text-blue-700">Nitrogen per acre</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {preview.total_lbs_nitrogen.toFixed(0)} lbs
                    </div>
                    <div className="text-sm text-blue-700">Total nitrogen applied</div>
                  </div>
                </div>
              </div>
            )}

            {/* Application Method */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Application Method
                </label>
                <select
                  name="application_method"
                  value={formData.application_method}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {NUTRIENT_CONSTANTS.APPLICATION_METHODS.map(method => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>
              
              {(formData.application_method === 'fertigation' || formData.application_method === 'drip') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Water Source
                  </label>
                  <select
                    name="water_source"
                    value={formData.water_source}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select water source...</option>
                    {fertigationSources.map(ws => (
                      <option key={ws.id} value={ws.id}>{ws.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Applicator Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 border-b pb-2">Applicator Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Applied By
                  </label>
                  <input
                    type="text"
                    name="applied_by"
                    value={formData.applied_by}
                    onChange={handleChange}
                    placeholder="Name of applicator"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="custom_applicator"
                      checked={formData.custom_applicator}
                      onChange={handleChange}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-sm text-gray-700">Custom/Commercial Applicator</span>
                  </label>
                </div>
              </div>
              
              {formData.custom_applicator && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Applicator Company
                  </label>
                  <input
                    type="text"
                    name="applicator_company"
                    value={formData.applicator_company}
                    onChange={handleChange}
                    placeholder="Company name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>

            {/* Cost Tracking (Collapsible) */}
            <details className="border border-gray-200 rounded-lg">
              <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cost Tracking (Optional)
              </summary>
              <div className="px-4 pb-4 pt-2 space-y-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Cost
                    </label>
                    <input
                      type="number"
                      name="total_product_cost"
                      value={formData.total_product_cost}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      placeholder="$0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Application Cost
                    </label>
                    <input
                      type="number"
                      name="application_cost"
                      value={formData.application_cost}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      placeholder="$0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </details>

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
                placeholder="Additional notes about this application..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Saving...
                </>
              ) : (
                <>
                  <Leaf className="w-4 h-4" />
                  {application ? 'Update Application' : 'Save Application'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NutrientApplicationModal;
