import React, { useState, useEffect, useCallback } from 'react';
import {
  UserX, Plus, X, Edit2, Trash2, Loader2, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';
import PrefillBanner from './PrefillBanner';

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const VIOLATION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'hygiene', label: 'Hygiene' },
  { value: 'gmp', label: 'GMP' },
  { value: 'safety', label: 'Safety' },
  { value: 'unauthorized_area', label: 'Unauthorized Area' },
  { value: 'food_handling', label: 'Food Handling' },
  { value: 'ppe', label: 'PPE' },
  { value: 'other', label: 'Other' },
];

const WARNING_LEVELS = [
  { value: 'verbal_warning', label: 'Verbal Warning' },
  { value: 'first_written', label: '1st Written' },
  { value: 'second_written', label: '2nd Written' },
  { value: 'final_written', label: 'Final Written' },
  { value: 'termination', label: 'Termination' },
];

const WARNING_BADGE_STYLES = {
  verbal_warning: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  first_written: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  second_written: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  final_written: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  termination: 'bg-red-900 text-red-100 dark:bg-red-950 dark:text-red-300',
};

const iCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary text-sm';
const lCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const WarningBadge = ({ level }) => {
  const found = WARNING_LEVELS.find((w) => w.value === level);
  const label = found ? found.label : level;
  const style = WARNING_BADGE_STYLES[level] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${style}`}>
      {label}
    </span>
  );
};

const EMPTY_FORM = {
  employee_name: '',
  employee_id: '',
  violation_date: new Date().toISOString().split('T')[0],
  violation_type: 'hygiene',
  description: '',
  location: '',
  warning_level: 'verbal_warning',
  corrective_action_taken: '',
  retraining_required: false,
  retraining_date: '',
  supervisor_name: '',
  employee_acknowledged: false,
  acknowledged_date: '',
  notes: '',
};

/* ─── Modal ─── */
const NonConformanceModal = ({ record, onClose, onSave }) => {
  const [form, setForm] = useState(() =>
    record
      ? {
          employee_name: record.employee_name || '',
          employee_id: record.employee_id || '',
          violation_date: record.violation_date || new Date().toISOString().split('T')[0],
          violation_type: record.violation_type || 'hygiene',
          description: record.description || '',
          location: record.location || '',
          warning_level: record.warning_level || 'verbal_warning',
          corrective_action_taken: record.corrective_action_taken || '',
          retraining_required: record.retraining_required || false,
          retraining_date: record.retraining_date || '',
          supervisor_name: record.supervisor_name || '',
          employee_acknowledged: record.employee_acknowledged || false,
          acknowledged_date: record.acknowledged_date || '',
          notes: record.notes || '',
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { ...form };
      if (!payload.retraining_required) payload.retraining_date = '';
      if (!payload.employee_acknowledged) payload.acknowledged_date = '';
      await onSave(payload, record?.id);
      onClose();
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to save record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <UserX className="w-5 h-5 text-primary dark:text-green-400" />
            {record ? 'Edit Non-Conformance' : 'New Non-Conformance'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {saveError}
            </div>
          )}

          {/* Employee Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lCls}>Employee Name *</label>
              <input
                type="text"
                required
                value={form.employee_name}
                onChange={(e) => set('employee_name', e.target.value)}
                placeholder="Full name"
                className={iCls}
              />
            </div>
            <div>
              <label className={lCls}>Employee ID</label>
              <input
                type="text"
                value={form.employee_id}
                onChange={(e) => set('employee_id', e.target.value)}
                placeholder="Badge / ID number"
                className={iCls}
              />
            </div>
          </div>

          {/* Violation Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={lCls}>Violation Date *</label>
              <input
                type="date"
                required
                value={form.violation_date}
                onChange={(e) => set('violation_date', e.target.value)}
                className={iCls}
              />
            </div>
            <div>
              <label className={lCls}>Violation Type *</label>
              <select
                required
                value={form.violation_type}
                onChange={(e) => set('violation_type', e.target.value)}
                className={iCls}
              >
                {VIOLATION_TYPES.filter((v) => v.value !== '').map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lCls}>Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Where it occurred"
                className={iCls}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={lCls}>Description *</label>
            <textarea
              required
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Describe the non-conformance in detail..."
              className={iCls}
            />
          </div>

          {/* Warning Level */}
          <div>
            <label className={lCls}>Warning Level *</label>
            <select
              required
              value={form.warning_level}
              onChange={(e) => set('warning_level', e.target.value)}
              className={iCls}
            >
              {WARNING_LEVELS.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>

          {/* Corrective Action Taken */}
          <div>
            <label className={lCls}>Corrective Action Taken</label>
            <textarea
              value={form.corrective_action_taken}
              onChange={(e) => set('corrective_action_taken', e.target.value)}
              rows={2}
              placeholder="Describe the corrective action taken..."
              className={iCls}
            />
          </div>

          {/* Retraining */}
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.retraining_required}
                onChange={(e) => set('retraining_required', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
              />
              Retraining Required
            </label>
            {form.retraining_required && (
              <div>
                <label className={lCls}>Retraining Date</label>
                <input
                  type="date"
                  value={form.retraining_date}
                  onChange={(e) => set('retraining_date', e.target.value)}
                  className={`${iCls} max-w-xs`}
                />
              </div>
            )}
          </div>

          {/* Supervisor */}
          <div>
            <label className={lCls}>Supervisor Name *</label>
            <input
              type="text"
              required
              value={form.supervisor_name}
              onChange={(e) => set('supervisor_name', e.target.value)}
              placeholder="Supervisor who issued the warning"
              className={iCls}
            />
          </div>

          {/* Employee Acknowledgment */}
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.employee_acknowledged}
                onChange={(e) => set('employee_acknowledged', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"
              />
              Employee Acknowledged
            </label>
            {form.employee_acknowledged && (
              <div>
                <label className={lCls}>Acknowledged Date</label>
                <input
                  type="date"
                  value={form.acknowledged_date}
                  onChange={(e) => set('acknowledged_date', e.target.value)}
                  className={`${iCls} max-w-xs`}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={lCls}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="Additional notes..."
              className={iCls}
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {record ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Main Component ─── */
export default function NonConformanceLog() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterType) params.violation_type = filterType;
      const res = await primusGFSAPI.getNonConformances(params);
      const data = res.data?.results || res.data || [];
      const sorted = [...data].sort((a, b) =>
        new Date(b.violation_date) - new Date(a.violation_date)
      );
      setRecords(sorted);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load non-conformance records.');
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSave = async (data, id) => {
    if (id) {
      await primusGFSAPI.updateNonConformance(id, data);
    } else {
      await primusGFSAPI.createNonConformance(data);
    }
    fetchRecords();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await primusGFSAPI.deleteNonConformance(deleteConfirmId);
      setDeleteConfirmId(null);
      fetchRecords();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete record.');
      setDeleteConfirmId(null);
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => {
    setEditingRecord(null);
    setShowModal(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecord(null);
  };

  // Stats
  const totalRecords = records.length;
  const requiresRetraining = records.filter((r) => r.retraining_required).length;
  const unacknowledged = records.filter((r) => !r.employee_acknowledged).length;
  const severeCount = records.filter(
    (r) => r.warning_level === 'final_written' || r.warning_level === 'termination'
  ).length;

  if (loading && records.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading non-conformance records...</span>
      </div>
    );
  }

  if (error && records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-600 dark:text-red-400">
        <AlertTriangle className="w-10 h-10 mb-2" />
        <p className="mb-4">{error}</p>
        <button
          onClick={fetchRecords}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UserX className="w-6 h-6 text-primary dark:text-green-400" />
            Employee Non-Conformance Log
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Doc 09A — Track employee violations and corrective actions.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Record
        </button>
      </div>

      {/* Prefill from Incident Reports */}
      <PrefillBanner
        module="non-conformance"
        sourceLabel="Incident Reports"
        onImport={async (items) => {
          let count = 0;
          for (const item of items) {
            try {
              await primusGFSAPI.createNonConformance({
                employee_name: item.affected_persons?.[0]?.name || 'Unknown',
                violation_date: item.incident_date ? item.incident_date.split('T')[0] : new Date().toISOString().split('T')[0],
                violation_type: item.incident_type === 'injury' ? 'safety' : 'hygiene',
                violation_description: `[From Incident #${item.incident_id}] ${item.title}: ${item.description}`,
                supervisor_name: '',
                warning_level: item.severity === 'critical' ? 3 : item.severity === 'serious' ? 2 : 1,
                notes: `Imported from incident report. Severity: ${item.severity}. Status: ${item.status}.`,
              });
              count++;
            } catch (err) {
              console.error('Failed to import non-conformance:', err);
            }
          }
          fetchRecords();
          return { count };
        }}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Records', value: totalRecords, color: 'text-gray-700 dark:text-gray-200' },
          { label: 'Retraining Required', value: requiresRetraining, color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Unacknowledged', value: unacknowledged, color: 'text-orange-600 dark:text-orange-400' },
          { label: 'Severe / Termination', value: severeCount, color: 'text-red-600 dark:text-red-400' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center"
          >
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Type:</label>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
        >
          {VIOLATION_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {filterType && (
          <button
            onClick={() => setFilterType('')}
            className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Inline error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Table / Empty */}
      {records.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-16 text-center">
          <UserX className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="font-medium text-gray-900 dark:text-white">No non-conformance records found.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {filterType ? 'Try clearing the filter.' : 'Create a new record to get started.'}
          </p>
          {!filterType && (
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> New Record
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Employee</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Warning Level</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Supervisor</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Retraining</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Acknowledged</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {records.map((record) => {
                  const typeLabel =
                    VIOLATION_TYPES.find((v) => v.value === record.violation_type)?.label ||
                    record.violation_type;
                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{record.employee_name || '-'}</p>
                        {record.employee_id && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">ID: {record.employee_id}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(record.violation_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 capitalize">
                        {typeLabel}
                      </td>
                      <td className="px-4 py-3">
                        <WarningBadge level={record.warning_level} />
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {record.supervisor_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {record.retraining_required ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                            {record.retraining_date ? formatDate(record.retraining_date) : 'Required'}
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {record.employee_acknowledged ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-primary dark:bg-green-900/30 dark:text-green-400">
                            {record.acknowledged_date ? formatDate(record.acknowledged_date) : 'Yes'}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(record)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(record.id)}
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

      {/* Add/Edit Modal */}
      {showModal && (
        <NonConformanceModal
          record={editingRecord}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Delete Record</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete this non-conformance record?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm font-medium"
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
