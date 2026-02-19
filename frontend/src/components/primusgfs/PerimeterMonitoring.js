import React, { useState, useEffect, useCallback } from 'react';
import {
  Eye,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
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

const todayStr = () => new Date().toISOString().split('T')[0];

const INITIAL_FORM = {
  farm: '',
  log_date: todayStr(),
  inspected_by: '',
  fencing_intact: false,
  gates_secured: false,
  signage_visible: false,
  animal_intrusion_signs: false,
  unauthorized_access_signs: false,
  trash_debris_present: false,
  adjacent_land_concerns: false,
  corrective_action_needed: false,
  corrective_action_description: '',
  notes: '',
};

/**
 * A log passes if there are no hazard signs and the physical barriers are intact.
 * Pass = fencing intact AND gates secured AND no animal intrusion AND
 *        no unauthorized access AND no trash/debris.
 */
const isPass = (log) =>
  !!log.fencing_intact &&
  !!log.gates_secured &&
  !log.animal_intrusion_signs &&
  !log.unauthorized_access_signs &&
  !log.trash_debris_present;

const PassBadge = ({ log }) => {
  const pass = isPass(log);
  return pass ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <CheckCircle className="w-3 h-3" /> Pass
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <XCircle className="w-3 h-3" /> Fail
    </span>
  );
};

/* ─── 52-Week Compliance Grid ─── */
const ComplianceGrid = ({ grid }) => {
  if (!grid || !Array.isArray(grid) || grid.length === 0) return null;

  const cellColor = (week) => {
    if (!week.has_log) return 'bg-gray-100 dark:bg-gray-700';
    return week.passed
      ? 'bg-green-400 dark:bg-green-600'
      : 'bg-red-400 dark:bg-red-600';
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4" /> 52-Week Compliance
      </h3>
      <div className="flex flex-wrap gap-1">
        {grid.map((week) => (
          <div
            key={week.week_number}
            title={`Week ${week.week_number}${week.log_date ? ` — ${formatDate(week.log_date)}` : ' — No log'}`}
            className={`w-5 h-5 rounded-sm ${cellColor(week)} cursor-default`}
          />
        ))}
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-600 inline-block" /> Pass</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-600 inline-block" /> Fail</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-700 inline-block border border-gray-300 dark:border-gray-600" /> No log</span>
      </div>
    </div>
  );
};

/* ─── Add/Edit Modal ─── */
const PerimeterModal = ({ log, onClose, onSave }) => {
  const [formData, setFormData] = useState(() => {
    if (log) {
      return {
        farm: log.farm || '',
        log_date: log.log_date || todayStr(),
        inspected_by: log.inspected_by || '',
        fencing_intact: !!log.fencing_intact,
        gates_secured: !!log.gates_secured,
        signage_visible: !!log.signage_visible,
        animal_intrusion_signs: !!log.animal_intrusion_signs,
        unauthorized_access_signs: !!log.unauthorized_access_signs,
        trash_debris_present: !!log.trash_debris_present,
        adjacent_land_concerns: !!log.adjacent_land_concerns,
        corrective_action_needed: !!log.corrective_action_needed,
        corrective_action_description: log.corrective_action_description || '',
        notes: log.notes || '',
      };
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
      const payload = { ...formData };
      if (!payload.corrective_action_needed) {
        payload.corrective_action_description = '';
      }
      await onSave(payload, log?.id);
      onClose();
    } catch (error) {
      setSaveError(error.response?.data?.detail || 'Failed to save log. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
  const checkboxCls =
    'rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500';
  const checkLabelCls = 'flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer';

  const willPass =
    formData.fencing_intact &&
    formData.gates_secured &&
    !formData.animal_intrusion_signs &&
    !formData.unauthorized_access_signs &&
    !formData.trash_debris_present;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {log ? 'Edit Perimeter Log' : 'New Perimeter Log'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">
              {saveError}
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Date *</label>
              <input
                type="date"
                name="log_date"
                required
                value={formData.log_date}
                onChange={handleChange}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Farm ID *</label>
              <input
                type="number"
                name="farm"
                required
                value={formData.farm}
                onChange={handleChange}
                placeholder="Farm ID"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Inspected By *</label>
              <input
                type="text"
                name="inspected_by"
                required
                value={formData.inspected_by}
                onChange={handleChange}
                placeholder="Inspector name"
                className={inputCls}
              />
            </div>
          </div>

          {/* Physical Barriers */}
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">
              Physical Barriers
            </legend>
            <div className="grid grid-cols-1 gap-2 mt-1">
              <label className={checkLabelCls}>
                <input
                  type="checkbox"
                  name="fencing_intact"
                  checked={formData.fencing_intact}
                  onChange={handleChange}
                  className={checkboxCls}
                />
                Fencing intact and in good repair
              </label>
              <label className={checkLabelCls}>
                <input
                  type="checkbox"
                  name="gates_secured"
                  checked={formData.gates_secured}
                  onChange={handleChange}
                  className={checkboxCls}
                />
                Gates secured (locked or properly latched)
              </label>
              <label className={checkLabelCls}>
                <input
                  type="checkbox"
                  name="signage_visible"
                  checked={formData.signage_visible}
                  onChange={handleChange}
                  className={checkboxCls}
                />
                Warning / no-trespassing signage visible
              </label>
            </div>
          </fieldset>

          {/* Hazard Observations */}
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-1">
              Hazard Observations
            </legend>
            <div className="grid grid-cols-1 gap-2 mt-1">
              <label className={checkLabelCls}>
                <input
                  type="checkbox"
                  name="animal_intrusion_signs"
                  checked={formData.animal_intrusion_signs}
                  onChange={handleChange}
                  className={checkboxCls}
                />
                Signs of animal intrusion detected
              </label>
              <label className={checkLabelCls}>
                <input
                  type="checkbox"
                  name="unauthorized_access_signs"
                  checked={formData.unauthorized_access_signs}
                  onChange={handleChange}
                  className={checkboxCls}
                />
                Signs of unauthorized human access detected
              </label>
              <label className={checkLabelCls}>
                <input
                  type="checkbox"
                  name="trash_debris_present"
                  checked={formData.trash_debris_present}
                  onChange={handleChange}
                  className={checkboxCls}
                />
                Trash or debris present on perimeter
              </label>
              <label className={checkLabelCls}>
                <input
                  type="checkbox"
                  name="adjacent_land_concerns"
                  checked={formData.adjacent_land_concerns}
                  onChange={handleChange}
                  className={checkboxCls}
                />
                Adjacent land use concerns (e.g., livestock, chemical drift)
              </label>
            </div>
          </fieldset>

          {/* Corrective Action */}
          <div className="space-y-2">
            <label className={checkLabelCls}>
              <input
                type="checkbox"
                name="corrective_action_needed"
                checked={formData.corrective_action_needed}
                onChange={handleChange}
                className={checkboxCls}
              />
              <span className="font-medium">Corrective action needed</span>
            </label>
            {formData.corrective_action_needed && (
              <div>
                <label className={labelCls}>Corrective Action Description *</label>
                <textarea
                  name="corrective_action_description"
                  required
                  value={formData.corrective_action_description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Describe the corrective action required or taken..."
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              placeholder="Additional observations..."
              className={inputCls}
            />
          </div>

          {/* Preview status */}
          <div className="text-sm font-medium">
            {willPass ? (
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Will be recorded as Pass
              </span>
            ) : (
              <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                <XCircle className="w-4 h-4" /> Will be recorded as Fail
              </span>
            )}
          </div>

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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : log ? 'Update Log' : 'Create Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Main Component ─── */
export default function PerimeterMonitoring() {
  const [logs, setLogs] = useState([]);
  const [complianceGrid, setComplianceGrid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [logsRes, gridRes] = await Promise.all([
        primusGFSAPI.getPerimeterLogs({ ordering: '-log_date' }),
        primusGFSAPI.perimeterWeeklyCompliance().catch(() => ({ data: null })),
      ]);
      const rawLogs = logsRes.data.results || logsRes.data || [];
      // Ensure sorted newest-first
      const sorted = [...rawLogs].sort((a, b) =>
        new Date(b.log_date) - new Date(a.log_date)
      );
      setLogs(sorted);
      setComplianceGrid(gridRes.data);
    } catch (err) {
      console.error('Failed to fetch perimeter logs:', err);
      setError('Failed to load perimeter monitoring data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSave = async (formData, id) => {
    if (id) {
      await primusGFSAPI.updatePerimeterLog(id, formData);
    } else {
      await primusGFSAPI.createPerimeterLog(formData);
    }
    fetchAll();
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await primusGFSAPI.deletePerimeterLog(deleteConfirmId);
      setDeleteConfirmId(null);
      fetchAll();
    } catch (err) {
      console.error('Failed to delete perimeter log:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (log) => {
    setEditingLog(log);
    setShowModal(true);
  };

  // Derived stats
  const totalLogs = logs.length;
  const passCount = logs.filter(isPass).length;
  const failCount = totalLogs - passCount;
  const passRate = totalLogs > 0 ? Math.round((passCount / totalLogs) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Eye className="w-6 h-6" /> Perimeter Monitoring Log
        </h2>
        <button
          onClick={() => { setEditingLog(null); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Log
        </button>
      </div>

      {/* Summary Stats */}
      {!loading && !error && totalLogs > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-4 gap-4 mb-3">
            {[
              ['Total Logs', totalLogs],
              ['Pass', passCount],
              ['Fail', failCount],
              ['Pass Rate', `${passRate}%`],
            ].map(([label, val]) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{val}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              </div>
            ))}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${passRate}%` }}
            />
          </div>
        </div>
      )}

      {/* 52-Week Compliance Grid */}
      {!loading && !error && complianceGrid && (
        <ComplianceGrid grid={complianceGrid} />
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchAll}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && logs.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <Eye className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">No perimeter logs found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create your first perimeter inspection log to begin tracking compliance.
          </p>
          <button
            onClick={() => { setEditingLog(null); setShowModal(true); }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Log
          </button>
        </div>
      )}

      {/* Log Table */}
      {!loading && !error && logs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  {[
                    'Date',
                    'Wk',
                    'Farm',
                    'Inspector',
                    'Fencing',
                    'Gates',
                    'Intrusion',
                    'Unauth. Access',
                    'Trash',
                    'CA Needed',
                    'Status',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className={`${
                        h === '' ? 'text-right' : 'text-left'
                      } px-3 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(log.log_date)}
                    </td>
                    <td className="px-3 py-3 text-gray-500 dark:text-gray-400">
                      {log.week_number ?? '-'}
                    </td>
                    <td className="px-3 py-3 text-gray-900 dark:text-white">
                      {log.farm_name || log.farm || '-'}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {log.inspected_by || '-'}
                    </td>
                    <td className="px-3 py-3">
                      {log.fencing_intact ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {log.gates_secured ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {log.animal_intrusion_signs ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {log.unauthorized_access_signs ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {log.trash_debris_present ? (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {log.corrective_action_needed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          Yes
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-xs">No</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <PassBadge log={log} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(log)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(log.id)}
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

      {/* Add/Edit Modal */}
      {showModal && (
        <PerimeterModal
          log={editingLog}
          onClose={() => { setShowModal(false); setEditingLog(null); }}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Delete Perimeter Log
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete this perimeter monitoring log? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
