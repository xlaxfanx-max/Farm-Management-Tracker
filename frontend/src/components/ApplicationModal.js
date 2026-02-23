import React, { useState, useEffect } from 'react';
import { X, Search, AlertTriangle, Info } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

/**
 * Enhanced Application Modal with Smart Product Selection
 * 
 * Features:
 * - Searchable product dropdown
 * - Shows REI/PHI warnings
 * - Displays restricted use indicators
 * - Auto-fills product details
 * - Validation warnings
 */
function EnhancedApplicationModal({ 
  application, 
  onClose, 
  onSave, 
  fields, 
  products 
}) {
  const toast = useToast();
  const [formData, setFormData] = useState(application || {
    application_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    field: '',
    acres_treated: '',
    product: '',
    amount_used: '',
    unit_of_measure: '',
    application_method: '',
    target_pest: '',
    applicator_name: '',
    temperature: '',
    wind_speed: '',
    wind_direction: '',
    notes: '',
    status: 'pending_signature',
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState(products);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [warnings, setWarnings] = useState([]);

  // Filter products based on search
  useEffect(() => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const filtered = products.filter(p =>
        p.product_name?.toLowerCase().includes(search) ||
        p.epa_registration_number?.toLowerCase().includes(search) ||
        p.manufacturer?.toLowerCase().includes(search) ||
        p.active_ingredients?.toLowerCase().includes(search)
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchTerm, products]);

  // Load selected product details
  useEffect(() => {
    if (formData.product) {
      const product = products.find(p => p.id === parseInt(formData.product));
      setSelectedProduct(product);
      if (product) {
        setSearchTerm(product.product_name);
      }
    }
  }, [formData.product, products]);

  // Update warnings when data changes
  useEffect(() => {
    updateWarnings();
  }, [formData, selectedProduct]);

  const updateWarnings = () => {
    const newWarnings = [];

    // Restricted use warning
    if (selectedProduct?.restricted_use && !formData.applicator_name) {
      newWarnings.push({
        type: 'error',
        message: 'Restricted Use Product requires licensed applicator name'
      });
    }

    // Fumigant warning
    if (selectedProduct?.is_fumigant) {
      newWarnings.push({
        type: 'warning',
        message: 'This is a FUMIGANT - Special regulations apply'
      });
    }

    // REI info
    if (selectedProduct?.rei_hours || selectedProduct?.rei_days) {
      const reiHours = selectedProduct.rei_hours || (selectedProduct.rei_days * 24);
      newWarnings.push({
        type: 'info',
        message: `Re-Entry Interval (REI): ${reiHours >= 24 ? `${reiHours/24} days` : `${reiHours} hours`}`
      });
    }

    // PHI info
    if (selectedProduct?.phi_days) {
      newWarnings.push({
        type: 'info',
        message: `Pre-Harvest Interval (PHI): ${selectedProduct.phi_days} days`
      });
    }

    // Missing required fields
    if (formData.field && !formData.acres_treated) {
      const field = fields.find(f => f.id === parseInt(formData.field));
      if (field) {
        newWarnings.push({
          type: 'info',
          message: `Field total acres: ${field.total_acres}. Enter acres actually treated.`
        });
      }
    }

    // Application rate check
    if (selectedProduct?.max_rate_per_application && formData.amount_used && formData.acres_treated) {
      const rate = parseFloat(formData.amount_used) / parseFloat(formData.acres_treated);
      if (rate > selectedProduct.max_rate_per_application) {
        newWarnings.push({
          type: 'error',
          message: `Application rate (${rate.toFixed(2)} ${selectedProduct.max_rate_unit}) exceeds maximum allowed (${selectedProduct.max_rate_per_application} ${selectedProduct.max_rate_unit})`
        });
      }
    }

    setWarnings(newWarnings);
  };

  const handleProductSelect = (product) => {
    setFormData({ ...formData, product: product.id });
    setSelectedProduct(product);
    setSearchTerm(product.product_name);
    setShowProductDropdown(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Check for errors
    const errors = warnings.filter(w => w.type === 'error');
    if (errors.length > 0) {
      toast.error('Please fix all errors before saving:\n' + errors.map(e => '• ' + e.message).join('\n'));
      return;
    }

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {application ? 'Edit Application' : 'New Application'}
            </h2>
            <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Warnings Section */}
          {warnings.length > 0 && (
            <div className="mb-4 space-y-2">
              {warnings.map((warning, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg flex items-start gap-2 ${
                    warning.type === 'error' ? 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800' :
                    warning.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800' :
                    'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                  }`}
                >
                  {warning.type === 'error' ? (
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  )}
                  <span className={`text-sm ${
                    warning.type === 'error' ? 'text-red-800 dark:text-red-300' :
                    warning.type === 'warning' ? 'text-yellow-800 dark:text-yellow-300' :
                    'text-blue-800 dark:text-blue-300'
                  }`}>
                    {warning.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Application Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Application Date *
              </label>
              <input
                type="date"
                required
                value={formData.application_date}
                onChange={(e) => setFormData({ ...formData, application_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Field *
              </label>
              <select
                required
                value={formData.field}
                onChange={(e) => setFormData({ ...formData, field: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select field...</option>
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name} - {field.total_acres} acres ({field.current_crop || 'No crop'})
                  </option>
                ))}
              </select>
            </div>

            {/* Product - Enhanced Searchable Dropdown */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pesticide Product *
              </label>
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowProductDropdown(true);
                      }}
                      onFocus={() => setShowProductDropdown(true)}
                      placeholder="Search by product name, EPA number, or manufacturer..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  {selectedProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, product: '' });
                        setSelectedProduct(null);
                        setSearchTerm('');
                      }}
                      className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Dropdown List */}
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredProducts.slice(0, 20).map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleProductSelect(product)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {product.product_name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              EPA: {product.epa_registration_number} | {product.manufacturer}
                            </div>
                            {product.active_ingredients && (
                              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                                {product.active_ingredients}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            {product.restricted_use && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded">
                                RUP
                              </span>
                            )}
                            {product.product_type && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                {product.product_type}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                    {filteredProducts.length > 20 && (
                      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                        Showing first 20 results. Refine your search for more.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Product Info */}
              {selectedProduct && (
                <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900 dark:text-white">{selectedProduct.product_name}</div>
                    <div className="text-gray-600 dark:text-gray-300 mt-1">
                      <span className="font-medium">EPA:</span> {selectedProduct.epa_registration_number}
                      {selectedProduct.manufacturer && (
                        <> | <span className="font-medium">Manufacturer:</span> {selectedProduct.manufacturer}</>
                      )}
                    </div>
                    {selectedProduct.active_ingredients && (
                      <div className="text-gray-600 dark:text-gray-300 mt-1">
                        <span className="font-medium">Active Ingredient:</span> {selectedProduct.active_ingredients}
                      </div>
                    )}
                    <div className="flex gap-4 mt-2">
                      {selectedProduct.rei_hours && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          REI: {selectedProduct.rei_hours}h
                        </span>
                      )}
                      {selectedProduct.phi_days && (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                          PHI: {selectedProduct.phi_days}d
                        </span>
                      )}
                      {selectedProduct.signal_word && (
                        <span className={`text-xs px-2 py-1 rounded ${
                          selectedProduct.signal_word === 'DANGER' ? 'bg-red-100 text-red-800' :
                          selectedProduct.signal_word === 'WARNING' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedProduct.signal_word}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Amount Used */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount Used *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.amount_used}
                onChange={(e) => setFormData({ ...formData, amount_used: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Unit of Measure */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Unit of Measure *
              </label>
              <select
                required
                value={formData.unit_of_measure}
                onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select unit...</option>
                <option value="lbs">Pounds (lbs)</option>
                <option value="oz">Ounces (oz)</option>
                <option value="gal">Gallons (gal)</option>
                <option value="qt">Quarts (qt)</option>
                <option value="pt">Pints (pt)</option>
                <option value="fl oz">Fluid Ounces (fl oz)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="L">Liters (L)</option>
              </select>
            </div>

            {/* Acres Treated */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Acres Treated *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.acres_treated}
                onChange={(e) => setFormData({ ...formData, acres_treated: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Application Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Application Method
              </label>
              <select
                value={formData.application_method}
                onChange={(e) => setFormData({ ...formData, application_method: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select method...</option>
                <option value="Ground Spray">Ground Spray</option>
                <option value="Aerial Application">Aerial Application</option>
                <option value="Chemigation">Chemigation</option>
                <option value="Soil Injection">Soil Injection</option>
                <option value="Broadcast">Broadcast Application</option>
              </select>
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Applicator Name */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Applicator Name {selectedProduct?.restricted_use && '*'}
              </label>
              <input
                type="text"
                required={selectedProduct?.restricted_use}
                value={formData.applicator_name}
                onChange={(e) => setFormData({ ...formData, applicator_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder={selectedProduct?.restricted_use ? "Required for Restricted Use Products" : "Optional"}
              />
            </div>

            {/* Target Pest */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Target Pest/Disease
              </label>
              <input
                type="text"
                value={formData.target_pest}
                onChange={(e) => setFormData({ ...formData, target_pest: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., Citrus leafminer, Brown rot, Weeds"
              />
            </div>

            {/* Weather Conditions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Temperature (°F)
              </label>
              <input
                type="number"
                value={formData.temperature}
                onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Wind Speed (mph)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.wind_speed}
                onChange={(e) => setFormData({ ...formData, wind_speed: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Wind Direction
              </label>
              <select
                value={formData.wind_direction}
                onChange={(e) => setFormData({ ...formData, wind_direction: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select direction...</option>
                <option value="N">North</option>
                <option value="NE">Northeast</option>
                <option value="E">East</option>
                <option value="SE">Southeast</option>
                <option value="S">South</option>
                <option value="SW">Southwest</option>
                <option value="W">West</option>
                <option value="NW">Northwest</option>
              </select>
            </div>

            {/* Notes */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Additional notes or observations..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Save Application
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EnhancedApplicationModal;