import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const VERIFICATION_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'initial', label: 'Initial' },
  { value: 'annual', label: 'Annual' },
  { value: 'triggered', label: 'Triggered' },
  { value: 'follow_up', label: 'Follow-Up' },
];

const OVERALL_RESULT_OPTIONS = [
  { value: 'approved', label: 'Approved' },
  { value: 'conditional', label: 'Conditional' },
  { value: 'rejected', label: 'Rejected' },
];

const resultBadgeStyles = {
  approved: 'bg-green-100 text-primary dark:bg-green-900/30 dark:text-green-400',
  conditional: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const resultLabels = {
  approved: 'Approved',
  conditional: 'Conditional',
  rejected: 'Rejected',
};

const typeLabels = {
  initial: 'Initial',
  annual: 'Annual',
  triggered: 'Triggered',
  follow_up: 'Follow-Up',
};

const ResultBadge = ({ result }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${resultBadgeStyles[result] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
    {resultLabels[result] || result || '-'}
  </span>
);

const BOOL_CHECKS = [
  { name: 'food_safety_cert_verified', label: 'Food Safety Cert Verified' },
  { name: 'insurance_verified', label: 'Insurance Verified' },
  { name: 'audit_report_reviewed', label: 'Audit Report Reviewed' },
  { name: 'facility_inspection_done', label: 'Facility Inspection Done' },
  { name: 'product_testing_done', label: 'Product Testing Done' },
];

const EMPTY_FORM = {
  supplier: '',
  verification_date: '',
  verified_by: '',
  verification_type: 'initial',
  food_safety_cert_verified: false,
  insurance_verified: false,
  audit_report_reviewed: false,
  facility_inspection_done: false,
  product_testing_done: false,
  checklist_items: [],
  overall_result: 'approved',
  conditions_notes: '',
  next_verification_date: '',
  notes: '',
};

const buildFormFromRecord = (record) => ({
  supplier: record.supplier ?? '',
  verification_date: record.verification_date || '',
  verified_by: record.verified_by || '',
  verification_type: record.verification_type || 'initial',
  food_safety_cert_verified: !!record.food_safety_cert_verified,
  insurance_verified: !!record.insurance_verified,
  audit_report_reviewed: !!record.audit_report_reviewed,
  facility_inspection_done: !!record.facility_inspection_done,
  product_testing_done: !!record.product_testing_done,
  checklist_items: Array.isArray(record.checklist_items) ? record.checklist_items.map((ci) => ({
    item: ci.item || '',
    checked: !!ci.checked,
    notes: ci.notes || '',
  })) : [],
  overall_result: record.overall_result || 'approved',
  conditions_notes: record.conditions_notes || '',
  next_verification_date: record.next_verification_date || '',
  notes: record.notes || '',
});

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

const VerificationModal = ({ record, suppliers, onClose, onSave }) => {
  const [formData, setFormData] = useState(() =>
    record ? buildFormFromRecord(record) : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm';
  const checkCls =
    'w-4 h-4 text-primary border-gray-300 dark:border-gray-600 rounded focus:ring-primary';

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // Checklist item helpers
  const addChecklistItem = () =>
    setFormData((prev) => ({
      ...prev,
      checklist_items: [...prev.checklist_items, { item: '', checked: false, notes: '' }],
    }));

  const updateChecklistItem = (idx, field, value) => {
    setFormData((prev) => {
      const items = [...prev.checklist_items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, checklist_items: items };
    });
  };

  const removeChecklistItem = (idx) =>
    setFormData((prev) => ({
      ...prev,
      checklist_items: prev.checklist_items.filter((_, i) => i !== idx),
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(formData, record?.id);
      onClose();
    } catch (err) {
      console.error('Failed to save supplier verification:', err);
      setSaveError(
        err.response?.data?.detail ||
          JSON.stringify(err.response?.data) ||
          'Failed to save. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {record ? 'Edit Supplier Verification' : 'New Supplier Verification'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg">
              {saveError}
            </div>
          )}

          {/* Supplier + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Supplier *
              </label>
              {suppliers.length > 0 ? (
                <select
                  name="supplier"
                  required
                  value={formData.supplier}
                  onChange={handleChange}
                  className={inputCls}
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supplier_name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  name="supplier"
                  required
                  placeholder="Supplier ID"
                  value={formData.supplier}
                  onChange={handleChange}
                  className={inputCls}
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Verification Date *
              </label>
              <input
                type="date"
                name="verification_date"
                required
                value={formData.verification_date}
                onChange={handleChange}
                className={inputCls}
              />
            </div>
          </div>

          {/* Verified By + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Verified By
              </label>
              <input
                type="text"
                name="verified_by"
                value={formData.verified_by}
                onChange={handleChange}
                className={inputCls}
                placeholder="Name of verifier"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Verification Type *
              </label>
              <select
                name="verification_type"
                required
                value={formData.verification_type}
                onChange={handleChange}
                className={inputCls}
              >
                {VERIFICATION_TYPE_OPTIONS.filter((o) => o.value !== '').map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Boolean verification checks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Verification Checklist
            </label>
            <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3">
              {BOOL_CHECKS.map((chk) => (
                <label
                  key={chk.name}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    name={chk.name}
                    checked={!!formData[chk.name]}
                    onChange={handleChange}
                    className={checkCls}
                  />
                  {chk.label}
                </label>
              ))}
            </div>
          </div>

          {/* Dynamic checklist_items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Additional Checklist Items
              </label>
              <button
                type="button"
                onClick={addChecklistItem}
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover dark:text-green-400 dark:hover:text-green-300 font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            {formData.checklist_items.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                No additional checklist items. Click "Add Item" to create one.
              </p>
            ) : (
              <div className="space-y-2">
                {formData.checklist_items.map((ci, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 bg-gray-50 dark:bg-gray-700/40 rounded-lg px-3 py-2"
                  >
                    {/* Checked toggle */}
                    <input
                      type="checkbox"
                      checked={!!ci.checked}
                      onChange={(e) => updateChecklistItem(idx, 'checked', e.target.checked)}
                      className={`${checkCls} mt-2 flex-shrink-0`}
                      title="Mark as completed"
                    />
                    {/* Item name */}
                    <input
                      type="text"
                      placeholder="Item description"
                      value={ci.item}
                      onChange={(e) => updateChecklistItem(idx, 'item', e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                    {/* Notes */}
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={ci.notes}
                      onChange={(e) => updateChecklistItem(idx, 'notes', e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(idx)}
                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400 flex-shrink-0 mt-1.5 transition-colors"
                      title="Remove item"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overall Result */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Overall Result *
            </label>
            <select
              name="overall_result"
              required
              value={formData.overall_result}
              onChange={handleChange}
              className={inputCls}
            >
              {OVERALL_RESULT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Conditions Notes — only shown when conditional */}
          {formData.overall_result === 'conditional' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Conditions / Notes <span className="text-yellow-600 dark:text-yellow-400">(Required for Conditional)</span>
              </label>
              <textarea
                name="conditions_notes"
                value={formData.conditions_notes}
                onChange={handleChange}
                rows={3}
                placeholder="Describe conditions that must be met..."
                className={inputCls}
              />
            </div>
          )}

          {/* Next Verification Date + General Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Next Verification Date
              </label>
              <input
                type="date"
                name="next_verification_date"
                value={formData.next_verification_date}
                onChange={handleChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                className={inputCls}
                placeholder="Any additional notes..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : record ? 'Update Verification' : 'Create Verification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SupplierVerification() {
  const [verifications, setVerifications] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Fetch verifications
  const fetchVerifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filterType) params.verification_type = filterType;
      const res = await primusGFSAPI.getSupplierVerifications(params);
      const raw = res.data?.results ?? res.data ?? [];
      // Sort by date descending
      const sorted = [...raw].sort((a, b) => {
        const da = a.verification_date || '';
        const db = b.verification_date || '';
        return db.localeCompare(da);
      });
      setVerifications(sorted);
    } catch (err) {
      console.error('Failed to fetch supplier verifications:', err);
      setError('Failed to load supplier verifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  // Fetch approved suppliers for dropdown
  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await primusGFSAPI.getSuppliers({ status: 'approved' });
      setSuppliers(res.data?.results ?? res.data ?? []);
    } catch (err) {
      console.error('Failed to load suppliers for dropdown:', err);
      // Non-fatal — form will fall back to ID input
    }
  }, []);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleOpenAdd = () => {
    setEditingRecord(null);
    setShowModal(true);
  };

  const handleOpenEdit = (record) => {
    setEditingRecord(record);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRecord(null);
  };

  const handleSave = async (formData, id) => {
    if (id) {
      await primusGFSAPI.updateSupplierVerification(id, formData);
    } else {
      await primusGFSAPI.createSupplierVerification(formData);
    }
    fetchVerifications();
  };

  const handleDeleteRequest = (id) => {
    setDeleteConfirmId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      await primusGFSAPI.deleteSupplierVerification(deleteConfirmId);
      setDeleteConfirmId(null);
      fetchVerifications();
    } catch (err) {
      console.error('Failed to delete supplier verification:', err);
      setDeleteConfirmId(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
  };

  // Helper: find supplier name from suppliers list
  const supplierName = (record) => {
    if (record.supplier_name) return record.supplier_name;
    const found = suppliers.find((s) => String(s.id) === String(record.supplier));
    return found ? found.supplier_name : record.supplier ? `Supplier #${record.supplier}` : '-';
  };

  // Inline check icon helper
  const CheckIcon = ({ value }) =>
    value ? (
      <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
    ) : (
      <XCircle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
    );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-primary dark:text-green-400" />
          Supplier Verification Log
        </h2>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Verification
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">
            Filter by Type:
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
          >
            {VERIFICATION_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchVerifications}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchVerifications}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <span className="ml-2 text-gray-500 dark:text-gray-400 text-sm">Loading verifications...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && verifications.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-900 dark:text-white">No supplier verifications found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filterType
              ? 'Try clearing the type filter or add a new verification.'
              : 'Add your first supplier verification to get started.'}
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> Add Verification
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && verifications.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Supplier
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Verified By
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Checks
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Result
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Next Verification
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {verifications.map((v) => (
                  <tr
                    key={v.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {supplierName(v)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(v.verification_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {typeLabels[v.verification_type] || v.verification_type || '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {v.verified_by || '-'}
                    </td>
                    {/* Quick check icons for the 5 boolean fields */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1" title={[
                        v.food_safety_cert_verified ? 'Food Safety Cert' : null,
                        v.insurance_verified ? 'Insurance' : null,
                        v.audit_report_reviewed ? 'Audit Report' : null,
                        v.facility_inspection_done ? 'Facility Insp.' : null,
                        v.product_testing_done ? 'Product Testing' : null,
                      ].filter(Boolean).join(', ') || 'None completed'}>
                        <CheckIcon value={v.food_safety_cert_verified} />
                        <CheckIcon value={v.insurance_verified} />
                        <CheckIcon value={v.audit_report_reviewed} />
                        <CheckIcon value={v.facility_inspection_done} />
                        <CheckIcon value={v.product_testing_done} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ResultBadge result={v.overall_result} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(v.next_verification_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(v)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRequest(v.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={handleDeleteCancel} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Verification?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
              This action cannot be undone. The supplier verification record will be permanently
              removed.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <VerificationModal
          record={editingRecord}
          suppliers={suppliers}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
