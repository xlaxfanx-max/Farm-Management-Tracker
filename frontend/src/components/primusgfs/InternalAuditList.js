import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck,
  Plus,
  Filter,
  X,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Calendar,
  Eye,
  Upload,
  Paperclip,
  Download,
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
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const AUDIT_TYPE_OPTIONS = [
  { value: 'internal', label: 'Internal' },
  { value: 'gap_prep', label: 'GAP Prep' },
  { value: 'management_review', label: 'Management Review' },
  { value: 'mock_audit', label: 'Mock Audit' },
  { value: 'follow_up', label: 'Follow-Up' },
];

const statusBadgeStyles = {
  planned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
};

const statusLabels = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeStyles[status] || statusBadgeStyles.planned}`}>
    {statusLabels[status] || status}
  </span>
);

const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  return [
    { value: '', label: 'All Years' },
    { value: String(currentYear), label: String(currentYear) },
    { value: String(currentYear - 1), label: String(currentYear - 1) },
    { value: String(currentYear - 2), label: String(currentYear - 2) },
  ];
};

const INITIAL_FORM = {
  audit_number: '',
  title: '',
  audit_type: 'internal',
  planned_date: '',
  scope_description: '',
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.xls,.xlsx';

const AuditModal = ({ onClose, onSave, editAudit }) => {
  const [formData, setFormData] = useState(() => {
    if (editAudit) {
      return {
        audit_number: editAudit.audit_number || '',
        title: editAudit.title || '',
        audit_type: editAudit.audit_type || 'internal',
        planned_date: editAudit.planned_date || '',
        scope_description: editAudit.scope_description || '',
      };
    }
    return { ...INITIAL_FORM };
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      let payload;
      if (selectedFile) {
        payload = new FormData();
        payload.append('report_file', selectedFile);
        Object.entries(formData).forEach(([key, value]) => {
          if (value === null || value === undefined) return;
          if (typeof value === 'boolean') {
            payload.append(key, value ? 'true' : 'false');
          } else if (Array.isArray(value)) {
            payload.append(key, JSON.stringify(value));
          } else {
            payload.append(key, value);
          }
        });
      } else {
        payload = formData;
      }
      await onSave(payload, editAudit?.id);
      onClose();
    } catch (error) {
      console.error('Failed to save audit:', error);
      setSaveError(error.response?.data?.detail || 'Failed to save audit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isEditing = !!editAudit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Audit' : 'Schedule Audit'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {saveError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Audit Number</label>
              <input
                type="text"
                name="audit_number"
                value={formData.audit_number}
                onChange={handleChange}
                placeholder="Auto-generated (e.g., IA-2026-001)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Leave blank to auto-generate</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Audit Type *</label>
              <select
                name="audit_type"
                required
                value={formData.audit_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {AUDIT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
            <input
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              placeholder="Audit title"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Planned Date *</label>
            <input
              type="date"
              name="planned_date"
              required
              value={formData.planned_date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scope Description</label>
            <textarea
              name="scope_description"
              value={formData.scope_description}
              onChange={handleChange}
              rows={3}
              placeholder="Describe the audit scope, areas to cover, objectives..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Audit Report File</label>
            {isEditing && editAudit.report_file_name && !selectedFile && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg mb-2">
                <Paperclip className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{editAudit.report_file_name}</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex-shrink-0">
                  Current file
                </span>
              </div>
            )}
            {selectedFile ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <Paperclip className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span className="text-sm text-green-700 dark:text-green-300 truncate">{selectedFile.name}</span>
                <span className="text-xs text-green-600 dark:text-green-400 flex-shrink-0">
                  ({formatFileSize(selectedFile.size)})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="ml-auto p-0.5 text-green-600 hover:text-red-600 dark:text-green-400 dark:hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <input
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-6 h-6 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Drop a file here or <span className="text-blue-600 dark:text-blue-400 font-medium">browse</span>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  PDF, Word, or Excel files accepted
                </p>
              </div>
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? (isEditing ? 'Saving...' : 'Scheduling...') : (isEditing ? 'Save Changes' : 'Schedule Audit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function InternalAuditList() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAudit, setEditingAudit] = useState(null);
  const [expandedAuditId, setExpandedAuditId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterYear, setFilterYear] = useState('');

  const yearOptions = getYearOptions();

  const fetchAudits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterYear) params.year = filterYear;
      const response = await primusGFSAPI.getAudits(params);
      setAudits(response.data.results || response.data || []);
    } catch (err) {
      console.error('Failed to fetch audits:', err);
      setError('Failed to load audits. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterYear]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  const handleSave = async (payload, auditId) => {
    if (auditId) {
      await primusGFSAPI.updateAudit(auditId, payload);
    } else {
      await primusGFSAPI.createAudit(payload);
    }
    fetchAudits();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this audit?')) return;
    try {
      await primusGFSAPI.deleteAudit(id);
      fetchAudits();
    } catch (err) {
      console.error('Failed to delete audit:', err);
    }
  };

  const handleComplete = async (id) => {
    try {
      await primusGFSAPI.completeAudit(id);
      fetchAudits();
    } catch (err) {
      console.error('Failed to complete audit:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6" />
          Internal Audits
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Schedule Audit
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {yearOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={fetchAudits}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && audits.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">No audits found</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Schedule your first internal audit to start tracking compliance.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Schedule Audit
          </button>
        </div>
      )}

      {/* Audit Table */}
      {!loading && !error && audits.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Audit #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Planned Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Findings</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {audits.map((audit) => (
                  <React.Fragment key={audit.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {audit.audit_number}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-1.5">
                        {audit.title}
                        {audit.has_report && (
                          <Paperclip className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" title="Report attached" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {audit.audit_type_display || audit.audit_type}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {formatDate(audit.planned_date)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={audit.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 dark:text-gray-400">
                          {audit.total_findings ?? 0} total
                        </span>
                        {(audit.open_findings ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            {audit.open_findings} open
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setExpandedAuditId(expandedAuditId === audit.id ? null : audit.id)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingAudit(audit)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {audit.status === 'in_progress' && (
                          <button
                            onClick={() => handleComplete(audit.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                            title="Complete Audit"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(audit.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedAuditId === audit.id && (
                    <tr className="bg-gray-50/50 dark:bg-gray-700/20">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="space-y-2 text-sm">
                          {audit.scope_description && (
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Scope: </span>
                              <span className="text-gray-600 dark:text-gray-400">{audit.scope_description}</span>
                            </div>
                          )}
                          {audit.completion_date && (
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Completed: </span>
                              <span className="text-gray-600 dark:text-gray-400">{formatDate(audit.completion_date)}</span>
                            </div>
                          )}
                          {audit.report_file_url ? (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-700 dark:text-gray-300">Report File:</span>
                              <Paperclip className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              <span className="text-gray-600 dark:text-gray-400">{audit.report_file_name}</span>
                              <a
                                href={audit.report_file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors"
                              >
                                <Download className="w-3 h-3" />
                                View / Download
                              </a>
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium text-gray-700 dark:text-gray-300">Report File: </span>
                              <span className="text-gray-400 dark:text-gray-500 italic">No file attached</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <AuditModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleSave}
        />
      )}

      {/* Edit Modal */}
      {editingAudit && (
        <AuditModal
          editAudit={editingAudit}
          onClose={() => setEditingAudit(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
