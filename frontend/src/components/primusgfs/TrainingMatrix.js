import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRAINING_TYPES = [
  { key: 'food_safety_training', label: 'Food Safety' },
  { key: 'gmp_training', label: 'GMP' },
  { key: 'hygiene_training', label: 'Hygiene' },
  { key: 'chemical_handling_training', label: 'Chemical Handling' },
  { key: 'emergency_procedures_training', label: 'Emergency Procedures' },
  { key: 'first_aid_training', label: 'First Aid' },
  { key: 'equipment_operation_training', label: 'Equipment Operation' },
  { key: 'supervisor_training', label: 'Supervisor' },
];

const POSITION_OPTIONS = [
  'Field Worker',
  'Supervisor',
  'Manager',
  'Quality Inspector',
  'Equipment Operator',
  'Packinghouse Worker',
  'Other',
];

const INITIAL_FORM = {
  employee_name: '',
  employee_id: '',
  position: '',
  hire_date: '',
  active: true,
  food_safety_training_date: '',
  food_safety_training_expiration: '',
  gmp_training_date: '',
  gmp_training_expiration: '',
  hygiene_training_date: '',
  hygiene_training_expiration: '',
  chemical_handling_training_date: '',
  chemical_handling_training_expiration: '',
  emergency_procedures_training_date: '',
  emergency_procedures_training_expiration: '',
  first_aid_training_date: '',
  first_aid_training_expiration: '',
  equipment_operation_training_date: '',
  equipment_operation_training_expiration: '',
  supervisor_training_date: '',
  supervisor_training_expiration: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
const formatDate = (str) => {
  if (!str) return null;
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatDateShort = (str) => {
  if (!str) return null;
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
};

/**
 * Returns one of: 'current' | 'expiring' | 'expired' | 'none'
 */
const getCellStatus = (dateStr, expirationStr, expiringSoonRecord) => {
  if (!dateStr) return 'none';
  if (!expirationStr) return 'current'; // trained but no expiry tracked
  const days = daysUntil(expirationStr);
  if (days === null) return 'current';
  if (days < 0) return 'expired';
  // match "expiring soon" logic — within 30 days considered expiring
  if (days <= 30) return 'expiring';
  return 'current';
};

const CELL_STYLES = {
  current: {
    dot: 'bg-green-500',
    text: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    label: 'Current',
  },
  expiring: {
    dot: 'bg-yellow-500',
    text: 'text-yellow-700 dark:text-yellow-500',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    label: 'Expiring',
  },
  expired: {
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    label: 'Expired',
  },
  none: {
    dot: 'bg-gray-300 dark:bg-gray-600',
    text: 'text-gray-400 dark:text-gray-500',
    bg: 'bg-gray-50 dark:bg-gray-700/30',
    label: 'Not Done',
  },
};

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

// ---------------------------------------------------------------------------
// Training Cell
// ---------------------------------------------------------------------------

const TrainingCell = ({ record, typeKey }) => {
  const dateKey = `${typeKey}_date`;
  const expKey = `${typeKey}_expiration`;
  const dateVal = record[dateKey];
  const expVal = record[expKey];
  const status = getCellStatus(dateVal, expVal);
  const style = CELL_STYLES[status];

  if (status === 'none') {
    return (
      <td className="px-2 py-2 text-center">
        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${style.dot}`} title="Not completed" />
      </td>
    );
  }

  const expDays = daysUntil(expVal);

  return (
    <td className={`px-2 py-2 text-center`}>
      <div className={`inline-flex flex-col items-center gap-0.5 px-1.5 py-1 rounded ${style.bg}`}>
        <span className={`text-xs font-medium ${style.text}`}>{formatDateShort(dateVal)}</span>
        {expVal && (
          <span className={`text-xs ${style.text} opacity-75`}>
            {expDays !== null && expDays < 0 ? `Exp ${Math.abs(expDays)}d ago` : expVal ? `Exp ${formatDateShort(expVal)}` : ''}
          </span>
        )}
      </div>
    </td>
  );
};

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

const TrainingModal = ({ record, onClose, onSave }) => {
  const [formData, setFormData] = useState(() => {
    if (record) {
      const f = {};
      Object.keys(INITIAL_FORM).forEach((k) => {
        f[k] = record[k] !== undefined && record[k] !== null ? record[k] : INITIAL_FORM[k];
      });
      return f;
    }
    return { ...INITIAL_FORM };
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(formData, record?.id);
      onClose();
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-green-600 dark:text-green-400" />
            {record ? 'Edit Training Record' : 'New Training Record'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
              {saveError}
            </div>
          )}

          {/* Employee Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Employee Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Employee Name *</label>
                <input
                  type="text"
                  name="employee_name"
                  required
                  value={formData.employee_name}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className={labelCls}>Employee ID</label>
                <input
                  type="text"
                  name="employee_id"
                  value={formData.employee_id}
                  onChange={handleChange}
                  className={inputCls}
                  placeholder="ID or badge number"
                />
              </div>
              <div>
                <label className={labelCls}>Position *</label>
                <select
                  name="position"
                  required
                  value={formData.position}
                  onChange={handleChange}
                  className={inputCls}
                >
                  <option value="">Select position...</option>
                  {POSITION_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Hire Date</label>
                <input
                  type="date"
                  name="hire_date"
                  value={formData.hire_date}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                  className="rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500"
                />
                Active Employee
              </label>
            </div>
          </div>

          {/* Training Date Pairs */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Training Records
            </h3>
            <div className="space-y-4">
              {TRAINING_TYPES.map(({ key, label }) => (
                <div
                  key={key}
                  className="grid grid-cols-2 gap-4 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="col-span-2">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
                  </div>
                  <div>
                    <label className={labelCls}>Training Date</label>
                    <input
                      type="date"
                      name={`${key}_date`}
                      value={formData[`${key}_date`]}
                      onChange={handleChange}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Expiration Date</label>
                    <input
                      type="date"
                      name={`${key}_expiration`}
                      value={formData[`${key}_expiration`]}
                      onChange={handleChange}
                      className={inputCls}
                    />
                  </div>
                </div>
              ))}
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
              className={inputCls}
              placeholder="Additional notes..."
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : record ? 'Update' : 'Create'}
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

export default function TrainingMatrix() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [filterActive, setFilterActive] = useState('true'); // 'true' | 'false' | ''
  const [summary, setSummary] = useState(null);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // id to confirm

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterActive !== '') params.active = filterActive;

      const [recordsRes, summaryRes, expiringRes] = await Promise.all([
        primusGFSAPI.getTrainingRecords(params),
        primusGFSAPI.trainingMatrixSummary(),
        primusGFSAPI.trainingExpiringSoon(),
      ]);

      setRecords(recordsRes.data?.results ?? recordsRes.data ?? []);
      setSummary(summaryRes.data ?? null);
      setExpiringSoon(expiringRes.data?.results ?? expiringRes.data ?? []);
    } catch (err) {
      console.error('Failed to fetch training matrix:', err);
      setError('Failed to load training records. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filterActive]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save (create or update)
  const handleSave = async (formData, id) => {
    if (id) {
      await primusGFSAPI.updateTrainingRecord(id, formData);
    } else {
      await primusGFSAPI.createTrainingRecord(formData);
    }
    fetchData();
  };

  // Delete flow
  const handleDeleteConfirm = async (id) => {
    try {
      await primusGFSAPI.deleteTrainingRecord(id);
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error('Failed to delete training record:', err);
    }
  };

  const openCreate = () => { setEditingRecord(null); setShowModal(true); };
  const openEdit = (rec) => { setEditingRecord(rec); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingRecord(null); };

  // Derived stats from local records (fallback if summary API unavailable)
  const totalEmployees = records.length;
  const totalCompliance = summary?.compliance_percentage
    ?? (records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + (r.compliance_percentage ?? 0), 0) / records.length)
      : 0);
  const expiringCount = expiringSoon.length;
  const activeCount = records.filter((r) => r.active).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-green-600 dark:text-green-400" />
          Employee Training Matrix
        </h2>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Employees',
            value: totalEmployees,
            icon: GraduationCap,
            color: 'text-blue-600 dark:text-blue-400',
          },
          {
            label: 'Active Employees',
            value: activeCount,
            icon: CheckCircle,
            color: 'text-green-600 dark:text-green-400',
          },
          {
            label: 'Overall Compliance',
            value: `${Math.round(totalCompliance)}%`,
            icon: CheckCircle,
            color: totalCompliance >= 80
              ? 'text-green-600 dark:text-green-400'
              : totalCompliance >= 60
              ? 'text-yellow-600 dark:text-yellow-500'
              : 'text-red-600 dark:text-red-400',
          },
          {
            label: 'Expiring Soon',
            value: expiringCount,
            icon: AlertTriangle,
            color: expiringCount > 0 ? 'text-yellow-600 dark:text-yellow-500' : 'text-gray-400 dark:text-gray-500',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex items-center gap-3"
          >
            <s.icon className={`w-8 h-8 flex-shrink-0 ${s.color}`} />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Expiring Soon Alert */}
      {expiringCount > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-800 dark:text-yellow-300">
              {expiringCount} training record{expiringCount > 1 ? 's' : ''} expiring within 30 days
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              {expiringSoon
                .slice(0, 5)
                .map((r) => r.employee_name)
                .filter(Boolean)
                .join(', ')}
              {expiringCount > 5 ? ` and ${expiringCount - 5} more` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Legend + Filter Toolbar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4">
          {Object.entries(CELL_STYLES).map(([status, style]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded-full ${style.dot}`} />
              <span className="text-xs text-gray-600 dark:text-gray-400">{style.label}</span>
            </div>
          ))}
        </div>
        {/* Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Show:</span>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
            <option value="">All Employees</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && records.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <GraduationCap className="w-14 h-14 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-medium text-gray-900 dark:text-white">No training records found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Add employees and their training dates to start tracking compliance.
          </p>
          <button
            onClick={openCreate}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      )}

      {/* Matrix Table */}
      {!loading && !error && records.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  {/* Employee columns */}
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap sticky left-0 bg-gray-50 dark:bg-gray-700/50 z-10 min-w-[160px]">
                    Employee
                  </th>
                  <th className="text-left px-3 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                    Position
                  </th>
                  <th className="text-center px-3 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[60px]">
                    Compl.
                  </th>
                  {/* Training type columns */}
                  {TRAINING_TYPES.map(({ key, label }) => (
                    <th
                      key={key}
                      className="text-center px-2 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap min-w-[110px]"
                    >
                      {label}
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {records.map((rec) => {
                  const compliance = rec.compliance_percentage ?? 0;
                  const complianceColor =
                    compliance >= 80
                      ? 'text-green-700 dark:text-green-400'
                      : compliance >= 60
                      ? 'text-yellow-700 dark:text-yellow-500'
                      : 'text-red-700 dark:text-red-400';

                  return (
                    <tr
                      key={rec.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      {/* Employee name + ID */}
                      <td className="px-4 py-3 sticky left-0 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30 z-10">
                        <div className="font-medium text-gray-900 dark:text-white">{rec.employee_name}</div>
                        {rec.employee_id && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{rec.employee_id}</div>
                        )}
                        {!rec.active && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Position */}
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {rec.position || '-'}
                      </td>

                      {/* Compliance % */}
                      <td className="px-3 py-3 text-center">
                        <span className={`font-semibold text-sm ${complianceColor}`}>
                          {Math.round(compliance)}%
                        </span>
                      </td>

                      {/* Training cells */}
                      {TRAINING_TYPES.map(({ key }) => (
                        <TrainingCell key={key} record={rec} typeKey={key} />
                      ))}

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(rec)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(rec.id)}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Record</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this training record? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConfirm(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <TrainingModal record={editingRecord} onClose={closeModal} onSave={handleSave} />
      )}
    </div>
  );
}
