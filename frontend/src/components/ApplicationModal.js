import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, AlertTriangle, History, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { unifiedProductsAPI, applicationEventsAPI } from '../services/api';
import CollapsibleSection from './ui/CollapsibleSection';
import Modal from './ui/Modal';

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
    // REI countdowns and PUR filings need the start time, not just the
    // date — default to "now" for records entered as they happen.
    start_time: new Date().toTimeString().slice(0, 5),
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
  const [rotationWarnings, setRotationWarnings] = useState([]);
  const rotationCheckRef = useRef(null);

  // "Copy last spray" — most recent event for the selected farm/field
  const [lastEvent, setLastEvent] = useState(null);
  const [copyingLast, setCopyingLast] = useState(false);

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
        start_time: application.date_started?.includes('T')
          ? application.date_started.split('T')[1].slice(0, 5)
          : '00:00',
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
      const { start_time, ...eventData } = formData;
      const payload = {
        ...eventData,
        // Combine date + time so REI clocks start when the spray did
        date_started: `${formData.date_started}T${start_time || '00:00'}:00`,
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

  // Cost preview per tank-mix line. Only shown when product cost is
  // configured in the same unit the user entered — otherwise silence beats a
  // wrong number.
  const computeLineCost = useCallback((item) => {
    if (!item.product || !item.total_amount) return null;
    const product = allProducts.find(p => p.id === parseInt(item.product));
    if (!product || product.cost_per_unit == null || !product.cost_unit) return null;
    if (product.cost_unit !== item.amount_unit) return null;
    const amt = parseFloat(item.total_amount);
    if (!amt || Number.isNaN(amt)) return null;
    return Number(product.cost_per_unit) * amt;
  }, [allProducts]);

  const totalCost = useMemo(() => {
    const costs = tankMixItems.map(computeLineCost);
    if (costs.some(c => c === null)) return null;
    if (costs.length === 0) return null;
    return costs.reduce((a, b) => a + b, 0);
  }, [tankMixItems, computeLineCost]);

  const costPerAcre = useMemo(() => {
    const acres = parseFloat(formData.treated_area_acres);
    if (totalCost == null || !acres || Number.isNaN(acres)) return null;
    return totalCost / acres;
  }, [totalCost, formData.treated_area_acres]);

  // Fields belonging to the selected farm
  const farmFields = useMemo(
    () => (fields || []).filter(f => String(f.farm) === String(formData.farm) && f.active !== false),
    [fields, formData.farm]
  );

  const handleFieldChange = useCallback((e) => {
    const fieldId = e.target.value;
    setFormData(prev => {
      const next = { ...prev, field: fieldId };
      // Convenience: default treated acres to the block's acreage
      if (fieldId && !prev.treated_area_acres) {
        const f = (fields || []).find(x => String(x.id) === String(fieldId));
        if (f?.total_acres) next.treated_area_acres = String(f.total_acres);
      }
      return next;
    });
  }, [fields]);

  // Look up the most recent application on this farm/field so the grower
  // can repeat a spray program without retyping the tank mix.
  useEffect(() => {
    if (isEdit || (!formData.farm && !formData.field)) {
      setLastEvent(null);
      return undefined;
    }
    let cancelled = false;
    const params = formData.field
      ? { field: formData.field, page_size: 1 }
      : { farm: formData.farm, page_size: 1 };
    applicationEventsAPI.getAll(params)
      .then(res => {
        if (cancelled) return;
        const results = res.data.results || res.data || [];
        setLastEvent(results[0] || null);
      })
      .catch(() => { if (!cancelled) setLastEvent(null); });
    return () => { cancelled = true; };
  }, [isEdit, formData.farm, formData.field]);

  const handleCopyLastSpray = useCallback(async () => {
    if (!lastEvent) return;
    setCopyingLast(true);
    try {
      const res = await applicationEventsAPI.getById(lastEvent.id);
      const ev = res.data;
      setFormData(prev => ({
        ...prev,
        application_method: ev.application_method || prev.application_method,
        applied_by: ev.applied_by || prev.applied_by,
        treated_area_acres: prev.treated_area_acres || ev.treated_area_acres || '',
        field: prev.field || (ev.field != null ? String(ev.field) : ''),
      }));
      if (ev.tank_mix_items?.length) {
        setTankMixItems(ev.tank_mix_items.map(item => ({
          product: item.product || '',
          product_name: item.product_name || '',
          total_amount: item.total_amount || '',
          amount_unit: item.amount_unit || 'Ga',
          rate: item.rate || '',
          rate_unit: item.rate_unit || 'Ga/A',
          dilution_gallons: item.dilution_gallons || '',
        })));
      }
      toast.success('Copied mix and details from the last application');
    } catch (err) {
      toast.error('Could not load the last application');
    } finally {
      setCopyingLast(false);
    }
  }, [lastEvent, toast]);

  // Pre-save MOA rotation check. Debounces so we don't hit the API on every
  // keystroke, and skips the call when inputs are incomplete.
  useEffect(() => {
    const productIds = tankMixItems
      .map(i => i.product)
      .filter(Boolean)
      .map(Number);
    if (!formData.field || !formData.date_started || productIds.length === 0) {
      setRotationWarnings([]);
      return undefined;
    }
    if (rotationCheckRef.current) clearTimeout(rotationCheckRef.current);
    rotationCheckRef.current = setTimeout(() => {
      applicationEventsAPI.checkRotation({
        field_id: parseInt(formData.field),
        date: formData.date_started,
        product_ids: productIds,
        exclude_event_id: application?.id,
      })
        .then(res => setRotationWarnings(res.data || []))
        .catch(() => setRotationWarnings([]));
    }, 400);
    return () => {
      if (rotationCheckRef.current) clearTimeout(rotationCheckRef.current);
    };
  }, [formData.field, formData.date_started, tankMixItems, application?.id]);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEdit ? 'Edit Application Event' : 'New Application Event'}
      size="full"
    >
      <form id="application-form" onSubmit={handleSubmit}>
        {activeSearchIdx !== null && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setActiveSearchIdx(null)}
            aria-hidden="true"
          />
        )}

          {/* Event fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Date & Start Time *</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  required
                  value={formData.date_started}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_started: e.target.value }))}
                  className="flex-1 min-w-0 px-3 py-2 border border-border-strong rounded-lg text-sm"
                />
                <input
                  type="time"
                  required
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  className="w-28 px-2 py-2 border border-border-strong rounded-lg text-sm"
                  title="When the application started — the REI clock runs from this time"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Farm *</label>
              <select
                required
                value={formData.farm}
                onChange={(e) => setFormData(prev => ({ ...prev, farm: e.target.value, field: '' }))}
                className="w-full px-3 py-2 border border-border-strong rounded-lg text-sm"
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
              <label className="block text-sm font-medium text-bark-700 mb-1">Field / Block</label>
              <select
                value={formData.field}
                onChange={handleFieldChange}
                disabled={!formData.farm}
                className="w-full px-3 py-2 border border-border-strong rounded-lg text-sm disabled:bg-cream-100 disabled:text-text-secondary"
              >
                <option value="">
                  {formData.farm ? 'Whole farm (no block)' : 'Select farm first'}
                </option>
                {farmFields.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name}{f.total_acres ? ` — ${f.total_acres} ac` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-text-secondary">
                Block-level records power PHI checks, MOA rotation, and per-block costs
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Acres Treated</label>
              <input
                type="number"
                step="0.01"
                value={formData.treated_area_acres}
                onChange={(e) => setFormData(prev => ({ ...prev, treated_area_acres: e.target.value }))}
                className="w-full px-3 py-2 border border-border-strong rounded-lg text-sm"
                placeholder="Acres"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-bark-700 mb-1">Method</label>
              <select
                value={formData.application_method}
                onChange={(e) => setFormData(prev => ({ ...prev, application_method: e.target.value }))}
                className="w-full px-3 py-2 border border-border-strong rounded-lg text-sm"
              >
                {APPLICATION_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Copy-last-spray shortcut — spray programs repeat; save the retyping */}
          {!isEdit && lastEvent && (
            <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-card flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-green-800 min-w-0">
                <History className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">
                  Last spray {formData.field ? 'on this block' : 'on this farm'}:{' '}
                  <strong>{lastEvent.date_started?.split('T')[0]}</strong>
                  {lastEvent.tank_mix_items?.length
                    ? ` — ${lastEvent.tank_mix_items.length} product${lastEvent.tank_mix_items.length > 1 ? 's' : ''} in mix`
                    : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyLastSpray}
                disabled={copyingLast}
                className="text-sm font-medium px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg transition-colors flex-shrink-0"
              >
                {copyingLast ? 'Copying…' : 'Copy mix & details'}
              </button>
            </div>
          )}

          <CollapsibleSection title="Weather & Additional Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-bark-700 mb-1">Applied By</label>
                <input
                  type="text"
                  value={formData.applied_by}
                  onChange={(e) => setFormData(prev => ({ ...prev, applied_by: e.target.value }))}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg text-sm"
                  placeholder="Applicator name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-bark-700 mb-1">Temperature (F)</label>
                <input
                  type="number"
                  value={formData.temperature_start_f}
                  onChange={(e) => setFormData(prev => ({ ...prev, temperature_start_f: e.target.value }))}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-bark-700 mb-1">Wind (mph)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.wind_velocity_mph}
                  onChange={(e) => setFormData(prev => ({ ...prev, wind_velocity_mph: e.target.value }))}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-bark-700 mb-1">Comments</label>
                <input
                  type="text"
                  value={formData.comments}
                  onChange={(e) => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                  className="w-full px-3 py-2 border border-border-strong rounded-lg text-sm"
                  placeholder="Optional notes"
                />
              </div>
            </div>
          </CollapsibleSection>

          {/* Tank Mix Items */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm text-heading uppercase tracking-wider">
                Tank Mix Products
              </h3>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-link hover:text-orange-700 hover:bg-orange-50 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            </div>

            <div className="space-y-3">
              {tankMixItems.map((item, idx) => {
                const productInfo = item.product ? getProductInfo(item.product) : null;
                return (
                  <div key={idx} className="border border-border rounded-card p-3">
                    <div className="flex items-start gap-3">
                      <span className="text-xs text-text-muted font-mono mt-2.5 w-4">
                        {idx + 1}
                      </span>

                      {/* Product search */}
                      <div className="flex-1 min-w-0">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
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
                            className="w-full pl-9 pr-3 py-2 border border-border-strong rounded-lg text-sm"
                          />

                          {/* Search dropdown */}
                          {activeSearchIdx === idx && searchResults.length > 0 && (
                            <div className="absolute z-20 w-full mt-1 bg-surface-raised border border-border-strong rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {searchResults.map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => handleProductSelect(p, idx)}
                                  className="w-full text-left px-3 py-2 hover:bg-cream-50 border-b border-border text-sm"
                                >
                                  <span className="font-medium">{p.product_name}</span>
                                  {p.epa_registration_number && (
                                    <span className="text-text-muted ml-2 text-xs">
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
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {productInfo.epa_registration_number && (
                              <span className="text-xs text-text-secondary">
                                EPA: {productInfo.epa_registration_number}
                              </span>
                            )}
                            {productInfo.product_type && (
                              <span className="px-1.5 py-0.5 text-xs bg-cream-100 text-bark-600 rounded">
                                {productInfo.product_type}
                              </span>
                            )}
                            {productInfo.moa_code && (
                              <span
                                className="px-1.5 py-0.5 text-xs bg-cream-100 text-bark-700 rounded font-medium"
                                title={productInfo.moa_group_name || ''}
                              >
                                MOA {productInfo.moa_code}
                              </span>
                            )}
                            {productInfo.active_ingredient && (
                              <span className="text-xs text-text-muted truncate max-w-[200px]">
                                {productInfo.active_ingredient}
                              </span>
                            )}
                            {(() => {
                              const cost = computeLineCost(item);
                              if (cost == null) return null;
                              return (
                                <span className="text-xs text-green-700 font-medium">
                                  ${cost.toFixed(2)}
                                </span>
                              );
                            })()}
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
                          className="w-full px-2 py-2 border border-border-strong rounded-lg text-sm"
                        />
                      </div>
                      <div className="w-28">
                        <select
                          value={item.amount_unit}
                          onChange={(e) => handleItemChange(idx, 'amount_unit', e.target.value)}
                          className="w-full px-2 py-2 border border-border-strong rounded-lg text-sm"
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
                          className="w-full px-2 py-2 border border-border-strong rounded-lg text-sm"
                        />
                      </div>
                      <div className="w-28">
                        <select
                          value={item.rate_unit}
                          onChange={(e) => handleItemChange(idx, 'rate_unit', e.target.value)}
                          className="w-full px-2 py-2 border border-border-strong rounded-lg text-sm"
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
                        className="p-1.5 text-text-muted hover:text-danger mt-0.5"
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

          {/* MOA rotation advisories — non-blocking, IRAC/FRAC guidance */}
          {rotationWarnings.length > 0 && (
            <div className="mt-4 space-y-2" data-testid="rotation-warnings">
              {rotationWarnings.map((w, idx) => {
                const isCritical = w.severity === 'critical';
                return (
                  <div
                    key={`${w.product_id || idx}-${w.code}`}
                    className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                      isCritical
                        ? 'bg-danger-bg border border-danger/25 text-danger'
                        : 'bg-yellow-100 border border-yellow-200 text-yellow-800'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">
                        {w.product_name}
                        {isCritical ? ' — resistance risk' : ' — rotation reminder'}
                      </div>
                      <div className="text-xs mt-0.5 opacity-90">{w.message}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Cost preview */}
          {totalCost != null && (
            <div
              className="mt-4 flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm"
              data-testid="cost-preview"
            >
              <span className="text-green-800 font-medium">Estimated cost</span>
              <span className="text-green-800">
                ${totalCost.toFixed(2)}
                {costPerAcre != null && (
                  <span className="ml-3 text-green-700">
                    ${costPerAcre.toFixed(2)}/acre
                  </span>
                )}
              </span>
            </div>
          )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-border mt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving…' : isEdit ? 'Update Application' : 'Save Application'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-border-strong rounded-lg hover:bg-cream-50 text-bark-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default EnhancedApplicationModal;
