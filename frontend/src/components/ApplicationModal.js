import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, AlertTriangle, Info, Plus, Trash2, GripVertical } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { unifiedProductsAPI, applicationEventsAPI } from '../services/api';

/**
 * Application Event Modal with Tank Mix Support
 *
 * Creates/edits an ApplicationEvent with multiple TankMixItems (products).
 * Each row in the tank mix section represents one product in the spray mix.
 */

const AMOUNT_UNITS = [
  { value: 'Lb', label: 'Pounds (Lb)' },
  { value: 'Oz', label: 'Ounces (Oz)' },
  { value: 'Ga', label: 'Gallons (Ga)' },
  { value: 'Qt', label: 'Quarts (Qt)' },
  { value: 'Pt', label: 'Pints (Pt)' },
  { value: 'Fl Oz', label: 'Fluid Ounces (Fl Oz)' },
  { value: 'Kg', label: 'Kilograms (Kg)' },
  { value: 'L', label: 'Liters (L)' },
];

const RATE_UNITS = [
  { value: 'Lb/A', label: 'Lb/Acre' },
  { value: 'Oz/A', label: 'Oz/Acre' },
  { value: 'Ga/A', label: 'Gal/Acre' },
  { value: 'Qt/A', label: 'Qt/Acre' },
  { value: 'Pt/A', label: 'Pt/Acre' },
  { value: 'Fl Oz/A', label: 'Fl Oz/Acre' },
];

const APPLICATION_METHODS = [
  { value: 'ground', label: 'Ground Spray' },
  { value: 'aerial', label: 'Aerial Application' },
  { value: 'chemigation', label: 'Chemigation' },
  { value: 'soil_injection', label: 'Soil Injection' },
  { value: 'broadcast', label: 'Broadcast' },
  { value: 'hand', label: 'Hand Application' },
];

const EMPTY_ITEM = {
  product: '',
  product_name: '',
  total_amount: '',
  amount_unit: 'Ga',
  rate: '',
  rate_unit: 'Ga/A',
  dilution_gallons: '',
};

function EnhancedApplicationModal({
  application,
  onClose,
  onSave,
  farms,
  fields,
  products: legacyProducts, // from DataContext (old PesticideProducts)
}) {
  const toast = useToast();
  const isEdit = Boolean(application?.id);

  // Event-level form state
  const [formData, setFormData] = useState({
    farm: '',
    field: '',
    date_started: new Date().toISOString().split('T')[0],
    date_completed: '',
    treated_area_acres: '',
    application_method: 'ground',
    applied_by: '',
    temperature_start_f: '',
    wind_velocity_mph: '',
    wind_direction_degrees: '',
    comments: '',
    pur_status: 'draft',
  });

  // Tank mix items — array of product line items
  const [tankMixItems, setTankMixItems] = useState([{ ...EMPTY_ITEM }]);

  // Product search state
  const [allProducts, setAllProducts] = useState([]);
  const [activeSearchIdx, setActiveSearchIdx] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchTimeoutRef = useRef(null);

  const [saving, setSaving] = useState(false);

  // Load unified products
  useEffect(() => {
    unifiedProductsAPI.getAll().then(res => {
      const data = res.data.results || res.data || [];
      setAllProducts(data);
    }).catch(() => {});
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (application) {
      setFormData({
        farm: application.farm || '',
        field: application.field || '',
        date_started: application.date_started?.split('T')[0] || '',
        date_completed: application.date_completed?.split('T')[0] || '',
        treated_area_acres: application.treated_area_acres || '',
        application_method: application.application_method || 'ground',
        applied_by: application.applied_by || '',
        temperature_start_f: application.temperature_start_f || '',
        wind_velocity_mph: application.wind_velocity_mph || '',
        wind_direction_degrees: application.wind_direction_degrees || '',
        comments: application.comments || '',
        pur_status: application.pur_status || 'draft',
      });

      // Load tank mix items from existing event
      if (application.tank_mix_items?.length > 0) {
        setTankMixItems(application.tank_mix_items.map(item => ({
          product: item.product || '',
          product_name: item.product_name || '',
          total_amount: item.total_amount || '',
          amount_unit: item.amount_unit || 'Ga',
          rate: item.rate || '',
          rate_unit: item.rate_unit || 'Ga/A',
          dilution_gallons: item.dilution_gallons || '',
        })));
      }
    }
  }, [application]);

  // Product search with debounce
  const handleProductSearch = useCallback((term, idx) => {
    setSearchTerm(term);
    setActiveSearchIdx(idx);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (term.length < 2) {
      setSearchResults(allProducts.slice(0, 20));
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      const lower = term.toLowerCase();
      const filtered = allProducts.filter(p =>
        p.product_name?.toLowerCase().includes(lower) ||
        p.epa_registration_number?.toLowerCase().includes(lower) ||
        p.manufacturer?.toLowerCase().includes(lower)
      ).slice(0, 20);
      setSearchResults(filtered);
    }, 200);
  }, [allProducts]);

  const handleProductSelect = useCallback((product, idx) => {
    setTankMixItems(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        product: product.id,
        product_name: product.product_name,
      };
      return next;
    });
    setActiveSearchIdx(null);
    setSearchTerm('');
  }, []);

  const handleItemChange = useCallback((idx, field, value) => {
    setTankMixItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  const addItem = useCallback(() => {
    setTankMixItems(prev => [...prev, { ...EMPTY_ITEM }]);
  }, []);

  const removeItem = useCallback((idx) => {
    setTankMixItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate at least one product
    const validItems = tankMixItems.filter(item => item.product);
    if (validItems.length === 0) {
      toast.error('Add at least one product to the tank mix');
      return;
    }

    if (!formData.farm) {
      toast.error('Please select a farm');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        farm: parseInt(formData.farm),
        field: formData.field ? parseInt(formData.field) : null,
        treated_area_acres: formData.treated_area_acres ? parseFloat(formData.treated_area_acres) : null,
        temperature_start_f: formData.temperature_start_f ? parseFloat(formData.temperature_start_f) : null,
        wind_velocity_mph: formData.wind_velocity_mph ? parseFloat(formData.wind_velocity_mph) : null,
        wind_direction_degrees: formData.wind_direction_degrees ? parseFloat(formData.wind_direction_degrees) : null,
        date_completed: formData.date_completed || null,
        tank_mix_items: validItems.map((item, idx) => ({
          product: parseInt(item.product),
          total_amount: parseFloat(item.total_amount) || 0,
          amount_unit: item.amount_unit,
          rate: parseFloat(item.rate) || 0,
          rate_unit: item.rate_unit,
          dilution_gallons: item.dilution_gallons ? parseFloat(item.dilution_gallons) : null,
          sort_order: idx,
        })),
      };

      if (isEdit) {
        await applicationEventsAPI.update(application.id, payload);
      } else {
        await applicationEventsAPI.create(payload);
      }

      toast.success(isEdit ? 'Application updated' : 'Application created');
      onSave?.(payload);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Get selected product info for a tank mix item
  const getProductInfo = (productId) => {
    return allProducts.find(p => p.id === parseInt(productId));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {isEdit ? 'Edit Application Event' : 'New Application Event'}
            </h2>
            <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Event fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={formData.date_started}
                onChange={(e) => setFormData(prev => ({ ...prev, date_started: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Farm *</label>
              <select
                required
                value={formData.farm}
                onChange={(e) => setFormData(prev => ({ ...prev, farm: e.target.value, field: '' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">Select farm...</option>
                {(farms || []).map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} — {f.county || ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Acres Treated</label>
              <input
                type="number"
                step="0.01"
                value={formData.treated_area_acres}
                onChange={(e) => setFormData(prev => ({ ...prev, treated_area_acres: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Acres"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
              <select
                value={formData.application_method}
                onChange={(e) => setFormData(prev => ({ ...prev, application_method: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {APPLICATION_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Applied By</label>
              <input
                type="text"
                value={formData.applied_by}
                onChange={(e) => setFormData(prev => ({ ...prev, applied_by: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Applicator name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (F)</label>
              <input
                type="number"
                value={formData.temperature_start_f}
                onChange={(e) => setFormData(prev => ({ ...prev, temperature_start_f: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wind (mph)</label>
              <input
                type="number"
                step="0.1"
                value={formData.wind_velocity_mph}
                onChange={(e) => setFormData(prev => ({ ...prev, wind_velocity_mph: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
              <input
                type="text"
                value={formData.comments}
                onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Optional notes"
              />
            </div>
          </div>

          {/* Tank Mix Items */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                Tank Mix Products
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            </div>

            <div className="space-y-3">
              {tankMixItems.map((item, idx) => {
                const productInfo = item.product ? getProductInfo(item.product) : null;
                return (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-gray-400 font-mono mt-2.5 w-4">
                        {idx + 1}
                      </span>

                      {/* Product search */}
                      <div className="flex-1 min-w-0">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={activeSearchIdx === idx ? searchTerm : (item.product_name || '')}
                            onChange={(e) => handleProductSearch(e.target.value, idx)}
                            onFocus={() => {
                              setActiveSearchIdx(idx);
                              setSearchTerm(item.product_name || '');
                              setSearchResults(allProducts.slice(0, 20));
                            }}
                            placeholder="Search product name or EPA #..."
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm"
                          />

                          {/* Search dropdown */}
                          {activeSearchIdx === idx && searchResults.length > 0 && (
                            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {searchResults.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleProductSelect(p, idx)}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 text-sm"
                                >
                                  <span className="font-medium">{p.product_name}</span>
                                  {p.epa_registration_number && (
                                    <span className="text-gray-400 ml-2 text-xs">
                                      EPA: {p.epa_registration_number}
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Product badges */}
                        {productInfo && (
                          <div className="flex items-center gap-2 mt-1.5">
                            {productInfo.epa_registration_number && (
                              <span className="text-xs text-gray-500">
                                EPA: {productInfo.epa_registration_number}
                              </span>
                            )}
                            {productInfo.product_type && (
                              <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                {productInfo.product_type}
                              </span>
                            )}
                            {productInfo.active_ingredient && (
                              <span className="text-xs text-gray-400 truncate max-w-[200px]">
                                {productInfo.active_ingredient}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="w-28">
                        <input
                          type="number"
                          step="0.01"
                          value={item.total_amount}
                          onChange={(e) => handleItemChange(idx, 'total_amount', e.target.value)}
                          placeholder="Amount"
                          className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div className="w-28">
                        <select
                          value={item.amount_unit}
                          onChange={(e) => handleItemChange(idx, 'amount_unit', e.target.value)}
                          className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm"
                        >
                          {AMOUNT_UNITS.map(u => (
                            <option key={u.value} value={u.value}>{u.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Rate */}
                      <div className="w-24">
                        <input
                          type="number"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                          placeholder="Rate"
                          className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm"
                        />
                      </div>
                      <div className="w-28">
                        <select
                          value={item.rate_unit}
                          onChange={(e) => handleItemChange(idx, 'rate_unit', e.target.value)}
                          className="w-full px-2 py-2 border border-gray-300 rounded-md text-sm"
                        >
                          {RATE_UNITS.map(u => (
                            <option key={u.value} value={u.value}>{u.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 mt-0.5"
                        disabled={tankMixItems.length <= 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Saving...' : (isEdit ? 'Update Application' : 'Save Application')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Click outside search to close dropdown */}
      {activeSearchIdx !== null && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setActiveSearchIdx(null)}
        />
      )}
    </div>
  );
}

export default EnhancedApplicationModal;
