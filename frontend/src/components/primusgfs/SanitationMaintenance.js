import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Calendar,
} from 'lucide-react';
import { primusGFSAPI } from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';

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

const todayStr = () => new Date().toISOString().split('T')[0];

// A log "passes" when every required sanitation step was completed with no
// outstanding maintenance issues.
const isPass = (log) =>
  !!log.toilet_units_serviced &&
  !!log.toilet_units_clean &&
  !!log.handwash_stations_serviced &&
  !!log.soap_replenished &&
  !!log.paper_towels_replenished &&
  !!log.sanitizer_replenished &&
  !!log.potable_water_available &&
  !!log.waste_properly_disposed &&
  !log.maintenance_issues_found;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const PassBadge = ({ pass }) =>
  pass ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <CheckCircle className="w-3 h-3" /> Pass
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <XCircle className="w-3 h-3" /> Fail
    </span>
  );

// ---------------------------------------------------------------------------
// Initial form state
// ---------------------------------------------------------------------------

const INITIAL_FORM = {
  farm: '',
  log_date: todayStr(),
  serviced_by: '',
  // Toilet Units
  toilet_units_serviced: false,
  toilet_units_count: '',
  toilet_units_clean: false,
  // Handwash Stations
  handwash_stations_serviced: false,
  handwash_stations_count: '',
  // Supplies
  soap_replenished: false,
  paper_towels_replenished: false,
  sanitizer_replenished: false,
  // Waste / Water
  potable_water_available: false,
  waste_properly_disposed: false,
  // Maintenance
  maintenance_issues_found: false,
  maintenance_description: '',
  // Follow-up
  follow_up_required: false,
  follow_up_date: '',
  follow_up_notes: '',
  // General
  notes: '',
};

// ---------------------------------------------------------------------------
// CSS helpers shared by modal
// ---------------------------------------------------------------------------

const inputCls =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm';

const labelCls =
  'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

const checkboxCls =
  'rounded border-gray-300 dark:border-gray-600 text-green-600 focus:ring-green-500';

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

const SanitationMaintenanceModal = ({ log, onClose, onSave }) => {
  const [formData, setFormData] = useState(() => {
    if (log) {
      const f = {};
      Object.keys(INITIAL_FORM).forEach((k) => {
        f[k] = log[k] !== undefined && log[k] !== null ? log[k] : INITIAL_FORM[k];
      });
      return f;
    }
    return { ...INITIAL_FORM };
  });
  const [saving, setSaving] = useState(false);
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
      const payload = { ...formData };
      // Coerce numeric fields
      if (payload.toilet_units_count !== '') {
        payload.toilet_units_count = Number(payload.toilet_units_count);
      } else {
        delete payload.toilet_units_count;
      }
      if (payload.handwash_stations_count !== '') {
        payload.handwash_stations_count = Number(payload.handwash_stations_count);
      } else {
        delete payload.handwash_stations_count;
      }
      // Strip conditional fields when parent is unchecked
      if (!payload.maintenance_issues_found) {
        payload.maintenance_description = '';
      }
      if (!payload.follow_up_required) {
        payload.follow_up_date = '';
        payload.follow_up_notes = '';
      }
      // Remove empty optional dates to avoid backend validation errors
      if (!payload.follow_up_date) delete payload.follow_up_date;

      await onSave(payload, log?.id);
      onClose();
    } catch (error) {
      setSaveError(
        error.response?.data?.detail ||
          error.response?.data?.non_field_errors?.[0] ||
          'Failed to save record. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const sectionHeading = (label) => (
    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-1">
      {label}
    </h3>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-green-600 dark:text-green-400" />
            {log ? 'Edit Sanitation & Maintenance Log' : 'New Sanitation & Maintenance Log'}
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
              <label className={labelCls}>Serviced By *</label>
              <input
                type="text"
                name="serviced_by"
                required
                value={formData.serviced_by}
                onChange={handleChange}
                placeholder="Name or ID"
                className={inputCls}
              />
            </div>
          </div>

          {/* Toilet Units */}
          {sectionHeading('Toilet Units')}
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  name="toilet_units_serviced"
                  checked={formData.toilet_units_serviced}
                  onChange={handleChange}
                  className={checkboxCls}
                />
                Units Serviced
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  name="toilet_units_clean"
                  checked={formData.toilet_units_clean}
                  onChange={handleChange}
                  className={checkboxCls}
                />
                Units Clean
              </label>
            </div>
            <div className="w-40">
              <label className={labelCls}>Number of Units</label>
              <input
                type="number"
                name="toilet_units_count"
                min="0"
                value={formData.toilet_units_count}
                onChange={handleChange}
                placeholder="0"
                className={inputCls}
              />
            </div>
          </fieldset>

          {/* Handwash Stations */}
          {sectionHeading('Handwash Stations')}
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                name="handwash_stations_serviced"
                checked={formData.handwash_stations_serviced}
                onChange={handleChange}
                className={checkboxCls}
              />
              Stations Serviced
            </label>
            <div className="w-40">
              <label className={labelCls}>Number of Stations</label>
              <input
                type="number"
                name="handwash_stations_count"
                min="0"
                value={formData.handwash_stations_count}
                onChange={handleChange}
                placeholder="0"
                className={inputCls}
              />
            </div>
          </fieldset>

          {/* Supplies */}
          {sectionHeading('Supplies Replenished')}
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                ['soap_replenished', 'Soap'],
                ['paper_towels_replenished', 'Paper Towels'],
                ['sanitizer_replenished', 'Sanitizer'],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name={key}
                    checked={formData[key]}
                    onChange={handleChange}
                    className={checkboxCls}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Waste & Water */}
          {sectionHeading('Waste & Water')}
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex flex-wrap gap-6">
              {[
                ['potable_water_available', 'Potable Water Available'],
                ['waste_properly_disposed', 'Waste Properly Disposed'],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name={key}
                    checked={formData[key]}
                    onChange={handleChange}
                    className={checkboxCls}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Maintenance */}
          {sectionHeading('Maintenance')}
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                name="maintenance_issues_found"
                checked={formData.maintenance_issues_found}
                onChange={handleChange}
                className={checkboxCls}
              />
              Maintenance Issues Found
            </label>
            {formData.maintenance_issues_found && (
              <div>
                <label className={labelCls}>Issue Description</label>
                <textarea
                  name="maintenance_description"
                  value={formData.maintenance_description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Describe the maintenance issues found..."
                  className={inputCls}
                />
              </div>
            )}
          </fieldset>

          {/* Follow-up */}
          {sectionHeading('Follow-Up')}
          <fieldset className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                name="follow_up_required"
                checked={formData.follow_up_required}
                onChange={handleChange}
                className={checkboxCls}
              />
              Follow-Up Required
            </label>
            {formData.follow_up_required && (
              <div className="space-y-3">
                <div className="w-48">
                  <label className={labelCls}>Follow-Up Date</label>
                  <input
                    type="date"
                    name="follow_up_date"
                    value={formData.follow_up_date}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Follow-Up Notes</label>
                  <textarea
                    name="follow_up_notes"
                    value={formData.follow_up_notes}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Additional follow-up details..."
                    className={inputCls}
                  />
                </div>
              </div>
            )}
          </fieldset>

          {/* General Notes */}
          <div>
            <label className={labelCls}>General Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
              className={inputCls}
            />
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
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : log ? 'Update Log' : 'Create Log'}
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

export default function SanitationMaintenance() {
  const confirm = useConfirm();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingLog, setEditingLog] = useState(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await primusGFSAPI.getSanitationMaintenance({ ordering: '-log_date' });
      setLogs(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch sanitation maintenance logs:', err);
      setError('Failed to load sanitation & maintenance logs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ---------------------------------------------------------------------------
  // CRUD handlers
  // ---------------------------------------------------------------------------

  const handleSave = async (formData, id) => {
    if (id) {
      await primusGFSAPI.updateSanitationMaintenance(id, formData);
    } else {
      await primusGFSAPI.createSanitationMaintenance(formData);
    }
    fetchLogs();
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this log?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await primusGFSAPI.deleteSanitationMaintenance(id);
      fetchLogs();
    } catch (err) {
      console.error('Failed to delete sanitation maintenance log:', err);
    }
  };

  const openCreate = () => {
    setEditingLog(null);
    setShowModal(true);
  };

  const openEdit = (log) => {
    setEditingLog(log);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingLog(null);
  };

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------

  const passCount = logs.filter(isPass).length;
  const failCount = logs.length - passCount;
  const passRate = logs.length > 0 ? Math.round((passCount / logs.length) * 100) : 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Wrench className="w-6 h-6 text-green-600 dark:text-green-400" />
          Sanitation &amp; Maintenance Log
        </h2>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> New Log
        </button>
      </div>

      {/* Summary stats */}
      {logs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4 mb-3">
            {[
              { label: 'Total Logs', value: logs.length },
              { label: 'Pass', value: passCount },
              { label: 'Fail', value: failCount },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
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
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">{passRate}% pass rate</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchLogs}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && logs.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">
            No sanitation &amp; maintenance logs yet
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create your first log to start tracking facility sanitation and maintenance.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> New Log
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && logs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  {[
                    'Date',
                    'Farm',
                    'Serviced By',
                    'Toilets',
                    'Handwash',
                    'Supplies',
                    'Follow-Up',
                    'Result',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className={`${
                        h === 'Actions' ? 'text-right' : 'text-left'
                      } px-4 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => {
                  const pass = isPass(log);
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                          {formatDate(log.log_date)}
                        </span>
                      </td>

                      {/* Farm */}
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {log.farm_name || log.farm}
                      </td>

                      {/* Serviced By */}
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {log.serviced_by || '-'}
                      </td>

                      {/* Toilet Units summary */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {log.toilet_units_serviced ? (
                            <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                          )}
                          {log.toilet_units_count != null ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {log.toilet_units_count} unit{log.toilet_units_count !== 1 ? 's' : ''}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Handwash Stations summary */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {log.handwash_stations_serviced ? (
                            <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                          )}
                          {log.handwash_stations_count != null ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {log.handwash_stations_count}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Supplies indicator dots */}
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.soap_replenished
                                ? 'bg-green-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                            title="Soap"
                          />
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.paper_towels_replenished
                                ? 'bg-blue-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                            title="Paper Towels"
                          />
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.sanitizer_replenished
                                ? 'bg-purple-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                            title="Sanitizer"
                          />
                          <span
                            className={`w-2 h-2 rounded-full ${
                              log.potable_water_available
                                ? 'bg-cyan-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                            title="Potable Water"
                          />
                        </div>
                      </td>

                      {/* Follow-up */}
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {log.follow_up_required ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <Calendar className="w-3 h-3" />
                            {log.follow_up_date ? formatDate(log.follow_up_date) : 'Pending'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">None</span>
                        )}
                      </td>

                      {/* Pass / Fail */}
                      <td className="px-4 py-3">
                        <PassBadge pass={pass} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(log)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(log.id)}
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
        <SanitationMaintenanceModal
          log={editingLog}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
