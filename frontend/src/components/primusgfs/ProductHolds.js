import React, { useState, useEffect, useCallback } from 'react';
import {
  PackageX,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

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

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ' +
  'bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm ' +
  'focus:ring-2 focus:ring-green-500 focus:border-green-500';

const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOLD_REASON_OPTIONS = [
  { value: 'contamination', label: 'Contamination' },
  { value: 'foreign_material', label: 'Foreign Material' },
  { value: 'labeling', label: 'Labeling Issue' },
  { value: 'temperature', label: 'Temperature Abuse' },
  { value: 'chemical', label: 'Chemical Residue' },
  { value: 'allergen', label: 'Allergen' },
  { value: 'quality', label: 'Quality' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'customer_complaint', label: 'Customer Complaint' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'on_hold', label: 'On Hold' },
  { value: 'under_investigation', label: 'Under Investigation' },
  { value: 'released', label: 'Released' },
  { value: 'destroyed', label: 'Destroyed' },
  { value: 'returned', label: 'Returned' },
];

const FILTER_STATUS_OPTIONS = [{ value: '', label: 'All Statuses' }, ...STATUS_OPTIONS];

const DISPOSITION_OPTIONS = [
  { value: '', label: '- None -' },
  { value: 'released_for_sale', label: 'Released for Sale' },
  { value: 'reworked', label: 'Reworked' },
  { value: 'destroyed', label: 'Destroyed' },
  { value: 'returned_to_supplier', label: 'Returned to Supplier' },
  { value: 'other', label: 'Other' },
];

const STATUS_BADGE = {
  on_hold: {
    cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    label: 'On Hold',
  },
  under_investigation: {
    cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    label: 'Under Investigation',
  },
  released: {
    cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    label: 'Released',
  },
  destroyed: {
    cls: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    label: 'Destroyed',
  },
  returned: {
    cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    label: 'Returned',
  },
};

const EMPTY_FORM = {
  hold_number: '',
  hold_date: '',
  product_description: '',
  lot_number: '',
  quantity: '',
  hold_reason: 'contamination',
  hold_reason_detail: '',
  status: 'on_hold',
  held_by: '',
  hold_location: '',
  investigation_notes: '',
  investigation_date: '',
  disposition: '',
  disposition_notes: '',
  disposition_date: '',
  released_by: '',
  corrective_action: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatusBadge = ({ status }) => {
  const cfg = STATUS_BADGE[status] || {
    cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    label: status,
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

const HoldModal = ({ hold, onClose, onSave }) => {
  const isEdit = Boolean(hold);

  const [formData, setFormData] = useState(() =>
    hold
      ? {
          hold_number: hold.hold_number || '',
          hold_date: hold.hold_date || '',
          product_description: hold.product_description || '',
          lot_number: hold.lot_number || '',
          quantity: hold.quantity || '',
          hold_reason: hold.hold_reason || 'contamination',
          hold_reason_detail: hold.hold_reason_detail || '',
          status: hold.status || 'on_hold',
          held_by: hold.held_by || '',
          hold_location: hold.hold_location || '',
          investigation_notes: hold.investigation_notes || '',
          investigation_date: hold.investigation_date || '',
          disposition: hold.disposition || '',
          disposition_notes: hold.disposition_notes || '',
          disposition_date: hold.disposition_date || '',
          released_by: hold.released_by || '',
          corrective_action: hold.corrective_action || '',
          notes: hold.notes || '',
        }
      : { ...EMPTY_FORM }
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(formData, hold?.id);
    } catch (err) {
      setSaveError(err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to save hold.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <PackageX className="w-5 h-5 text-red-500" />
            {isEdit ? 'Edit Product Hold' : 'New Product Hold'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* --- Section 1: Hold Information --- */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Hold Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Hold Number</label>
                <input
                  type="text"
                  name="hold_number"
                  value={formData.hold_number}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="Auto-generated (e.g., PH-001)"
                />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Leave blank to auto-generate</p>
              </div>
              <div>
                <label className={labelCls}>Hold Date</label>
                <input
                  type="date"
                  name="hold_date"
                  value={formData.hold_date}
                  onChange={handleChange}
                  className={inputCls}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Product Description <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="product_description"
                  value={formData.product_description}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="e.g., Romaine Lettuce, Heads"
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Lot Number</label>
                <input
                  type="text"
                  name="lot_number"
                  value={formData.lot_number}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="e.g., LOT-2026-001"
                />
              </div>
              <div>
                <label className={labelCls}>Quantity</label>
                <input
                  type="text"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="e.g., 500 lbs, 20 cases"
                />
              </div>
              <div>
                <label className={labelCls}>Hold Reason <span className="text-red-500">*</span></label>
                <select
                  name="hold_reason"
                  value={formData.hold_reason}
                  onChange={handleChange}
                  className={inputCls}
                  required
                >
                  {HOLD_REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Status <span className="text-red-500">*</span></label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={inputCls}
                  required
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Hold Reason Detail</label>
                <textarea
                  name="hold_reason_detail"
                  value={formData.hold_reason_detail}
                  onChange={handleChange}
                  rows={2}
                  className={inputCls}
                  placeholder="Describe the specific concern in detail..."
                />
              </div>
              <div>
                <label className={labelCls}>Held By</label>
                <input
                  type="text"
                  name="held_by"
                  value={formData.held_by}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="Person who placed the hold"
                />
              </div>
              <div>
                <label className={labelCls}>Hold Location</label>
                <input
                  type="text"
                  name="hold_location"
                  value={formData.hold_location}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="e.g., Cooler #3, Quarantine Area"
                />
              </div>
            </div>
          </div>

          {/* --- Section 2: Investigation --- */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Investigation
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Investigation Date</label>
                <input
                  type="date"
                  name="investigation_date"
                  value={formData.investigation_date}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Investigation Notes</label>
                <textarea
                  name="investigation_notes"
                  value={formData.investigation_notes}
                  onChange={handleChange}
                  rows={3}
                  className={inputCls}
                  placeholder="Lab results, findings, root cause analysis..."
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Corrective Action</label>
                <textarea
                  name="corrective_action"
                  value={formData.corrective_action}
                  onChange={handleChange}
                  rows={2}
                  className={inputCls}
                  placeholder="Steps taken to prevent recurrence..."
                />
              </div>
            </div>
          </div>

          {/* --- Section 3: Disposition --- */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Disposition
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Disposition</label>
                <select
                  name="disposition"
                  value={formData.disposition}
                  onChange={handleChange}
                  className={inputCls}
                >
                  {DISPOSITION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Disposition Date</label>
                <input
                  type="date"
                  name="disposition_date"
                  value={formData.disposition_date}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Released By</label>
                <input
                  type="text"
                  name="released_by"
                  value={formData.released_by}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="Person authorizing release/disposition"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Disposition Notes</label>
                <textarea
                  name="disposition_notes"
                  value={formData.disposition_notes}
                  onChange={handleChange}
                  rows={2}
                  className={inputCls}
                  placeholder="Details about the final disposition decision..."
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>General Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={2}
                  className={inputCls}
                  placeholder="Any additional notes or comments..."
                />
              </div>
            </div>
          </div>

          {/* Save error */}
          {saveError && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {saveError}
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Hold'}
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

export default function ProductHolds() {
  const [holds, setHolds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterStatus, setFilterStatus] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingHold, setEditingHold] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Summary stats
  const [activeCount, setActiveCount] = useState(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchHolds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const res = await primusGFSAPI.getProductHolds(params);
      setHolds(res.data?.results || res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load product holds.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  const fetchActiveCount = useCallback(async () => {
    try {
      const res = await primusGFSAPI.activeHolds();
      const data = res.data?.results || res.data || [];
      setActiveCount(Array.isArray(data) ? data.length : (res.data?.count ?? null));
    } catch (_) {
      // Non-critical — swallow silently
    }
  }, []);

  useEffect(() => {
    fetchHolds();
  }, [fetchHolds]);

  useEffect(() => {
    fetchActiveCount();
  }, [fetchActiveCount]);

  // ---------------------------------------------------------------------------
  // Derived summary values (computed from full unfiltered list when possible)
  // ---------------------------------------------------------------------------

  const allHolds = holds; // holds already filtered by status dropdown; for summary we use raw numbers

  const summaryActiveCount =
    activeCount !== null
      ? activeCount
      : allHolds.filter((h) => h.status === 'on_hold').length;

  const summaryUnderInvestigation = allHolds.filter(
    (h) => h.status === 'under_investigation'
  ).length;

  const summaryReleasedThisMonth = (() => {
    const now = new Date();
    return allHolds.filter((h) => {
      if (h.status !== 'released' || !h.disposition_date) return false;
      const d = new Date(h.disposition_date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  })();

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleSave = async (formData, id) => {
    if (id) {
      await primusGFSAPI.updateProductHold(id, formData);
    } else {
      await primusGFSAPI.createProductHold(formData);
    }
    setModalOpen(false);
    setEditingHold(null);
    fetchHolds();
    fetchActiveCount();
  };

  const openCreate = () => {
    setEditingHold(null);
    setModalOpen(true);
  };

  const openEdit = (hold) => {
    setEditingHold(hold);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingHold(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await primusGFSAPI.deleteProductHold(deleteTarget.id);
      setDeleteTarget(null);
      fetchHolds();
      fetchActiveCount();
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Failed to delete hold.');
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (loading && holds.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading product holds...</span>
      </div>
    );
  }

  if (error && holds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-red-600 dark:text-red-400">
        <AlertTriangle className="w-10 h-10 mb-3" />
        <p className="mb-4 text-center max-w-sm">{error}</p>
        <button
          onClick={fetchHolds}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <PackageX className="w-6 h-6 text-red-500" />
            Product Hold &amp; Release Log
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            CAC Manual Docs 11–12 — track holds, investigations, and dispositions.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Hold
        </button>
      </div>

      {/* ---- Summary cards ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Holds */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <PackageX className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {summaryActiveCount !== null ? summaryActiveCount : '-'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active Holds</p>
          </div>
        </div>

        {/* Under Investigation */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{summaryUnderInvestigation}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Under Investigation</p>
          </div>
        </div>

        {/* Released This Month */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{summaryReleasedThisMonth}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Released This Month</p>
          </div>
        </div>
      </div>

      {/* ---- Filters ---- */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
        >
          {FILTER_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={fetchHolds}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ---- Inline error banner ---- */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* ---- Table / empty state ---- */}
      {holds.length === 0 ? (
        <div className="text-center py-20 text-gray-500 dark:text-gray-400">
          <PackageX className="w-12 h-12 mx-auto mb-3 opacity-25" />
          <p className="font-medium">No product holds found.</p>
          <p className="text-sm mt-1">
            {filterStatus
              ? 'Try clearing the status filter.'
              : 'Create a new hold to get started.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-4 py-3">Hold #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Lot</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {holds.map((hold) => {
                  const reasonOpt = HOLD_REASON_OPTIONS.find((o) => o.value === hold.hold_reason);
                  return (
                    <tr
                      key={hold.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition"
                    >
                      <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {hold.hold_number || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(hold.hold_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-800 dark:text-gray-200 max-w-[200px]">
                        <span title={hold.product_description}>
                          {hold.product_description
                            ? hold.product_description.length > 40
                              ? hold.product_description.substring(0, 40) + '…'
                              : hold.product_description
                            : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {hold.lot_number || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {reasonOpt ? reasonOpt.label : (hold.hold_reason || '-')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={hold.status} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEdit(hold)}
                            title="Edit"
                            className="p-1.5 text-gray-400 hover:text-green-600 dark:hover:text-green-400 rounded transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setDeleteTarget(hold); setDeleteError(null); }}
                            title="Delete"
                            className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition"
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

      {/* ---- Add / Edit modal ---- */}
      {modalOpen && (
        <HoldModal
          hold={editingHold}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      {/* ---- Delete confirmation modal ---- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Delete Hold</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
              Are you sure you want to delete hold{' '}
              <span className="font-mono font-semibold">{deleteTarget.hold_number || `#${deleteTarget.id}`}</span>?
            </p>
            {deleteTarget.product_description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {deleteTarget.product_description}
              </p>
            )}
            {deleteError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
