import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Shield,
  X,
  ArrowRight,
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

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'implemented', label: 'Implemented' },
  { value: 'verified', label: 'Verified & Closed' },
  { value: 'overdue', label: 'Overdue' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'audit', label: 'Audit' },
  { value: 'mock_recall', label: 'Mock Recall' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'incident', label: 'Incident' },
];

const PIPELINE_STAGES = [
  { key: 'open', label: 'Open', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { key: 'implemented', label: 'Implemented', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { key: 'verified', label: 'Verified', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
];

const StatusBadge = ({ status, isOverdue }) => {
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse">
        <AlertTriangle className="w-3 h-3" /> Overdue
      </span>
    );
  }
  const styles = {
    open: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    implemented: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    verified: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };
  const labels = {
    open: 'Open',
    in_progress: 'In Progress',
    implemented: 'Implemented',
    verified: 'Verified & Closed',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
      {labels[status] || status}
    </span>
  );
};

const EMPTY_FORM = {
  ca_number: '',
  description: '',
  root_cause: '',
  corrective_steps: '',
  preventive_steps: '',
  assigned_to_name: '',
  due_date: '',
  source_type: 'audit',
};

export default function CorrectiveActionTracker() {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  const fetchActions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterSource) params.source_type = filterSource;
      const res = await primusGFSAPI.getCorrectiveActions(params);
      setActions(res.data?.results || res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load corrective actions.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterSource]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const pipelineCounts = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    count: actions.filter((a) => a.status === stage.key).length,
  }));

  const handleImplement = async (id) => {
    try {
      await primusGFSAPI.implementCA(id);
      fetchActions();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to implement corrective action.');
    }
  };

  const handleVerify = async (id) => {
    try {
      await primusGFSAPI.verifyCA(id);
      fetchActions();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to verify corrective action.');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await primusGFSAPI.createCorrectiveAction(formData);
      setShowCreateModal(false);
      setFormData({ ...EMPTY_FORM });
      fetchActions();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create corrective action.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // --- Render ---

  if (loading && actions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading corrective actions...</span>
      </div>
    );
  }

  if (error && actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-600 dark:text-red-400">
        <AlertTriangle className="w-10 h-10 mb-2" />
        <p className="mb-4">{error}</p>
        <button
          onClick={fetchActions}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Retry
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
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Corrective Action Tracker
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track and manage corrective actions from audits, inspections, and incidents.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Corrective Action
        </button>
      </div>

      {/* Pipeline View */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {pipelineCounts.map((stage, idx) => (
          <button
            key={stage.key}
            onClick={() => setFilterStatus(filterStatus === stage.key ? '' : stage.key)}
            className={`relative flex flex-col items-center p-4 rounded-xl border transition cursor-pointer ${
              filterStatus === stage.key
                ? 'ring-2 ring-blue-500 border-blue-300 dark:border-blue-600'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            } bg-white dark:bg-gray-800`}
          >
            <span className={`text-2xl font-bold ${stage.color.split(' ').slice(1).join(' ')}`}>{stage.count}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stage.label}</span>
            {idx < pipelineCounts.length - 1 && (
              <ArrowRight className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 dark:text-gray-600 z-10" />
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
        >
          {SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Error banner (inline) */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Actions List */}
      {actions.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No corrective actions found.</p>
          <p className="text-sm mt-1">Create a new corrective action to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                <th className="pb-3 pr-4 font-medium">CA #</th>
                <th className="pb-3 pr-4 font-medium">Description</th>
                <th className="pb-3 pr-4 font-medium">Source</th>
                <th className="pb-3 pr-4 font-medium">Due Date</th>
                <th className="pb-3 pr-4 font-medium">Assigned To</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr
                  key={action.id}
                  className={`border-b border-gray-100 dark:border-gray-800 ${
                    action.is_overdue ? 'bg-red-50 dark:bg-red-900/10' : ''
                  }`}
                >
                  <td className="py-3 pr-4 font-mono text-gray-900 dark:text-gray-100">{action.ca_number || '-'}</td>
                  <td className="py-3 pr-4 text-gray-700 dark:text-gray-300 max-w-xs">
                    {action.description
                      ? action.description.length > 80
                        ? action.description.substring(0, 80) + '...'
                        : action.description
                      : '-'}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-400 capitalize">
                    {action.source_type?.replace('_', ' ') || '-'}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`flex items-center gap-1 ${action.is_overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                      {action.is_overdue && <AlertTriangle className="w-3.5 h-3.5" />}
                      {formatDate(action.due_date)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">{action.assigned_to_name || '-'}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={action.status} isOverdue={action.is_overdue} />
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(action.status === 'open' || action.status === 'in_progress') && (
                        <button
                          onClick={() => handleImplement(action.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Implement
                        </button>
                      )}
                      {action.status === 'implemented' && (
                        <button
                          onClick={() => handleVerify(action.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md hover:bg-green-100 dark:hover:bg-green-900/50 transition"
                        >
                          <Shield className="w-3.5 h-3.5" /> Verify
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Corrective Action</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CA Number</label>
                <input
                  type="text"
                  value={formData.ca_number}
                  onChange={(e) => handleChange('ca_number', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="Auto-generated (e.g., CA-001)"
                />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Leave blank to auto-generate</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="Describe the non-conformance or finding..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Root Cause</label>
                <textarea
                  value={formData.root_cause}
                  onChange={(e) => handleChange('root_cause', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="Identified root cause..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Corrective Steps</label>
                <textarea
                  value={formData.corrective_steps}
                  onChange={(e) => handleChange('corrective_steps', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="Steps taken to correct the issue..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Preventive Steps</label>
                <textarea
                  value={formData.preventive_steps}
                  onChange={(e) => handleChange('preventive_steps', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="Steps to prevent recurrence..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned To</label>
                  <input
                    type="text"
                    value={formData.assigned_to_name}
                    onChange={(e) => handleChange('assigned_to_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="Person responsible"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => handleChange('due_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source Type</label>
                <select
                  value={formData.source_type}
                  onChange={(e) => handleChange('source_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="audit">Audit</option>
                  <option value="mock_recall">Mock Recall</option>
                  <option value="inspection">Inspection</option>
                  <option value="incident">Incident</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
