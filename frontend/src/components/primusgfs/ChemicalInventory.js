import React, { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  Calendar,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import PrefillBanner from './PrefillBanner';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHEMICAL_TYPES = [
  { value: 'pesticide',  label: 'Pesticide',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'herbicide',  label: 'Herbicide',  color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'fungicide',  label: 'Fungicide',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'fertilizer', label: 'Fertilizer', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'adjuvant',   label: 'Adjuvant',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'sanitizer',  label: 'Sanitizer',  color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { value: 'cleaning',   label: 'Cleaning',   color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'other',      label: 'Other',      color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
];

const TYPE_MAP = Object.fromEntries(CHEMICAL_TYPES.map((t) => [t.value, t]));

const todayStr = () => new Date().toISOString().split('T')[0];

const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const INITIAL_FORM = {
  chemical_name:      '',
  chemical_type:      'pesticide',
  manufacturer:       '',
  epa_registration:   '',
  active_ingredient:  '',
  inventory_date:     todayStr(),
  inventory_year:     currentYear,
  inventory_month:    currentMonth,
  quantity_on_hand:   '',
  unit_of_measure:    '',
  quantity_purchased: '',
  quantity_used:      '',
  storage_location:   '',
  sds_on_file:        false,
  labeled_properly:   false,
  storage_compliant:  false,
  expiration_date:    '',
  notes:              '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const isFullyCompliant = (item) =>
  item.sds_on_file && item.labeled_properly && item.storage_compliant;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const TypeBadge = ({ type }) => {
  const meta = TYPE_MAP[type] || TYPE_MAP['other'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
      {meta.label}
    </span>
  );
};

const ComplianceIndicator = ({ item }) => {
  const ok = isFullyCompliant(item);
  return ok ? (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      title="SDS on file, labeled properly, storage compliant"
    >
      <CheckCircle className="w-3 h-3" /> Compliant
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
      title={[
        !item.sds_on_file       && 'SDS missing',
        !item.labeled_properly  && 'Not labeled',
        !item.storage_compliant && 'Storage non-compliant',
      ].filter(Boolean).join(' | ')}
    >
      <AlertTriangle className="w-3 h-3" /> Review Needed
    </span>
  );
};

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

const ChemicalModal = ({ item, onClose, onSave }) => {
  const [formData, setFormData] = useState(() => {
    if (item) {
      return {
        chemical_name:      item.chemical_name      || '',
        chemical_type:      item.chemical_type      || 'pesticide',
        manufacturer:       item.manufacturer       || '',
        epa_registration:   item.epa_registration   || '',
        active_ingredient:  item.active_ingredient  || '',
        inventory_date:     item.inventory_date     || todayStr(),
        inventory_year:     item.inventory_year     || currentYear,
        inventory_month:    item.inventory_month    || currentMonth,
        quantity_on_hand:   item.quantity_on_hand   ?? '',
        unit_of_measure:    item.unit_of_measure    || '',
        quantity_purchased: item.quantity_purchased  ?? '',
        quantity_used:      item.quantity_used       ?? '',
        storage_location:   item.storage_location   || '',
        sds_on_file:        !!item.sds_on_file,
        labeled_properly:   !!item.labeled_properly,
        storage_compliant:  !!item.storage_compliant,
        expiration_date:    item.expiration_date    || '',
        notes:              item.notes              || '',
      };
    }
    return { ...INITIAL_FORM };
  });
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        ...formData,
        inventory_year:     Number(formData.inventory_year),
        inventory_month:    Number(formData.inventory_month),
        quantity_on_hand:   formData.quantity_on_hand   !== '' ? Number(formData.quantity_on_hand)   : null,
        quantity_purchased: formData.quantity_purchased !== '' ? Number(formData.quantity_purchased)  : null,
        quantity_used:      formData.quantity_used      !== '' ? Number(formData.quantity_used)       : null,
      };
      if (!payload.epa_registration)  delete payload.epa_registration;
      if (!payload.active_ingredient) delete payload.active_ingredient;
      if (!payload.expiration_date)   delete payload.expiration_date;
      if (payload.quantity_purchased === null) delete payload.quantity_purchased;
      if (payload.quantity_used      === null) delete payload.quantity_used;
      await onSave(payload, item?.id);
      onClose();
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm";
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
  const sectionCls = "border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3";
  const sectionTitleCls = "text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2";

  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-green-600" />
            {item ? 'Edit Chemical Inventory' : 'New Chemical Inventory Entry'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
              {saveError}
            </div>
          )}

          {/* Chemical Info */}
          <div className={sectionCls}>
            <p className={sectionTitleCls}>Chemical Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Chemical Name *</label>
                <input
                  type="text"
                  name="chemical_name"
                  required
                  value={formData.chemical_name}
                  onChange={handleChange}
                  placeholder="e.g. Roundup Pro"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Chemical Type *</label>
                <select name="chemical_type" required value={formData.chemical_type} onChange={handleChange} className={inputCls}>
                  {CHEMICAL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Manufacturer *</label>
                <input
                  type="text"
                  name="manufacturer"
                  required
                  value={formData.manufacturer}
                  onChange={handleChange}
                  placeholder="e.g. Bayer"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>EPA Registration #</label>
                <input
                  type="text"
                  name="epa_registration"
                  value={formData.epa_registration}
                  onChange={handleChange}
                  placeholder="Optional"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Active Ingredient</label>
                <input
                  type="text"
                  name="active_ingredient"
                  value={formData.active_ingredient}
                  onChange={handleChange}
                  placeholder="Optional"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Expiration Date</label>
                <input
                  type="date"
                  name="expiration_date"
                  value={formData.expiration_date}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Inventory Tracking */}
          <div className={sectionCls}>
            <p className={sectionTitleCls}>Inventory Tracking</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Inventory Date *</label>
                <input
                  type="date"
                  name="inventory_date"
                  required
                  value={formData.inventory_date}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Storage Location *</label>
                <input
                  type="text"
                  name="storage_location"
                  required
                  value={formData.storage_location}
                  onChange={handleChange}
                  placeholder="e.g. Chemical shed B"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Inventory Year *</label>
                <input
                  type="number"
                  name="inventory_year"
                  required
                  min="2000"
                  max="2100"
                  value={formData.inventory_year}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Inventory Month *</label>
                <select name="inventory_month" required value={formData.inventory_month} onChange={handleChange} className={inputCls}>
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Quantity on Hand *</label>
                <input
                  type="number"
                  name="quantity_on_hand"
                  required
                  min="0"
                  step="0.01"
                  value={formData.quantity_on_hand}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Unit of Measure *</label>
                <input
                  type="text"
                  name="unit_of_measure"
                  required
                  value={formData.unit_of_measure}
                  onChange={handleChange}
                  placeholder="e.g. gal, lbs, oz"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Quantity Purchased</label>
                <input
                  type="number"
                  name="quantity_purchased"
                  min="0"
                  step="0.01"
                  value={formData.quantity_purchased}
                  onChange={handleChange}
                  placeholder="Optional"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Quantity Used</label>
                <input
                  type="number"
                  name="quantity_used"
                  min="0"
                  step="0.01"
                  value={formData.quantity_used}
                  onChange={handleChange}
                  placeholder="Optional"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div className={sectionCls}>
            <p className={sectionTitleCls}>Compliance Checklist</p>
            <div className="space-y-2">
              {[
                ['sds_on_file',       'Safety Data Sheet (SDS) on file'],
                ['labeled_properly',  'Container labeled properly'],
                ['storage_compliant', 'Storage meets regulatory requirements'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    name={key}
                    checked={formData[key]}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500"
                  />
                  {label}
                </label>
              ))}
            </div>
            {/* Live compliance preview */}
            <div className="mt-3">
              {formData.sds_on_file && formData.labeled_properly && formData.storage_compliant ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 font-medium">
                  <CheckCircle className="w-4 h-4" /> All compliance requirements met
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                  <AlertTriangle className="w-4 h-4" /> Compliance requirements incomplete
                </span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Additional notes..."
              className={inputCls}
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : item ? 'Update Entry' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChemicalInventory() {
  const confirm = useConfirm();
  const [items, setItems]           = useState([]);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (typeFilter) params.chemical_type = typeFilter;

      const [itemsRes, summaryRes] = await Promise.all([
        primusGFSAPI.getChemicalInventory(params),
        primusGFSAPI.chemicalMonthlySummary(),
      ]);

      const raw = itemsRes.data?.results ?? itemsRes.data ?? [];
      // Sort by inventory_date descending
      const sorted = [...raw].sort((a, b) =>
        new Date(b.inventory_date) - new Date(a.inventory_date)
      );
      setItems(sorted);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error('Failed to fetch chemical inventory:', err);
      setError('Failed to load chemical inventory. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ---------------------------------------------------------------------------
  // CRUD handlers
  // ---------------------------------------------------------------------------

  const handleSave = async (formData, id) => {
    if (id) {
      await primusGFSAPI.updateChemicalInventory(id, formData);
    } else {
      await primusGFSAPI.createChemicalInventory(formData);
    }
    fetchAll();
  };

  const handleDelete = async (id, name) => {
    const ok = await confirm({ title: 'Are you sure?', message: `Delete "${name}" from chemical inventory? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await primusGFSAPI.deleteChemicalInventory(id);
      fetchAll();
    } catch (err) {
      console.error('Failed to delete chemical inventory entry:', err);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    setShowModal(true);
  };

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------

  const totalItems     = items.length;
  const compliantCount = items.filter(isFullyCompliant).length;
  const nonCompliant   = totalItems - compliantCount;
  const complianceRate = totalItems > 0 ? Math.round((compliantCount / totalItems) * 100) : 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-green-600" />
          Chemical Inventory Log
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Chemical
          </button>
        </div>
      </div>

      {/* Prefill from Pesticide Records */}
      <PrefillBanner
        module="chemical-inventory"
        sourceLabel="Pesticide Records"
        onImport={async (items) => {
          let count = 0;
          for (const item of items) {
            try {
              await primusGFSAPI.createChemicalInventory({
                chemical_name: item.product_name,
                epa_registration_number: item.epa_registration_number || '',
                chemical_type: item.chemical_type || 'pesticide',
                unit_of_measure: item.unit || 'gallons',
                inventory_date: new Date().toISOString().split('T')[0],
                inventory_month: new Date().getMonth() + 1,
                inventory_year: new Date().getFullYear(),
                stock_on_hand: 0,
                counted_by: '',
                notes: `Imported from pesticide records. ${item.manufacturer ? 'Manufacturer: ' + item.manufacturer : ''}`,
              });
              count++;
            } catch (err) {
              console.error('Failed to import chemical:', err);
            }
          }
          fetchAll();
          return { count };
        }}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Entries',  value: totalItems,      color: 'text-gray-900 dark:text-white' },
          { label: 'Compliant',      value: compliantCount,  color: 'text-green-600 dark:text-green-400' },
          { label: 'Review Needed',  value: nonCompliant,    color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Compliance Rate', value: `${complianceRate}%`, color: complianceRate >= 80 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Monthly summary */}
      {summary && Array.isArray(summary) && summary.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-600" /> Monthly Summary
          </h3>
          <div className="flex flex-wrap gap-3">
            {summary.map((s, i) => (
              <div key={i} className="flex flex-col items-center px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg min-w-[90px]">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{s.month_label || `${s.inventory_year}/${s.inventory_month}`}</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{s.count ?? s.total_entries ?? '-'}</span>
                <span className="text-xs text-gray-400">entries</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">Filter by type:</span>
        <button
          onClick={() => setTypeFilter('')}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            typeFilter === ''
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          All
        </button>
        {CHEMICAL_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(typeFilter === t.value ? '' : t.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              typeFilter === t.value
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchAll}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && items.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <FlaskConical className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">No chemical inventory entries found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {typeFilter
              ? `No entries for the selected type. Try removing the filter.`
              : 'Add your first chemical to begin tracking inventory and compliance.'}
          </p>
          {!typeFilter && (
            <button
              onClick={handleAdd}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" /> Add Chemical
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && !error && items.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  {[
                    { label: 'Date',             align: 'left' },
                    { label: 'Chemical Name',    align: 'left' },
                    { label: 'Type',             align: 'left' },
                    { label: 'Qty on Hand',      align: 'right' },
                    { label: 'Storage Location', align: 'left' },
                    { label: 'Expiration',       align: 'left' },
                    { label: 'Compliance',       align: 'left' },
                    { label: 'Actions',          align: 'right' },
                  ].map(({ label, align }) => (
                    <th
                      key={label}
                      className={`px-4 py-3 font-medium text-gray-600 dark:text-gray-300 text-${align}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((item) => {
                  const expired = item.expiration_date && new Date(item.expiration_date) < new Date();
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(item.inventory_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{item.chemical_name}</div>
                        {item.manufacturer && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{item.manufacturer}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={item.chemical_type} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {item.quantity_on_hand != null ? `${item.quantity_on_hand} ${item.unit_of_measure}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {item.storage_location || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.expiration_date ? (
                          <span className={expired ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}>
                            {expired && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                            {formatDate(item.expiration_date)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ComplianceIndicator item={item} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id, item.chemical_name)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <ChemicalModal
          item={editingItem}
          onClose={() => { setShowModal(false); setEditingItem(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
