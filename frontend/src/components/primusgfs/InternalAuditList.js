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
  FileText,
  CheckSquare,
  Square,
  Clock,
  CheckCircle2,
  XCircle,
  Loader,
  AlertCircle,
} from 'lucide-react';
import { primusGFSAPI, fsmaAPI } from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

// ─── Shared helpers ───────────────────────────────────────────────────────────

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

// ─── Binder helpers ───────────────────────────────────────────────────────────

const BINDER_SECTIONS = [
  {
    key: 'include_visitor_logs',
    label: 'Visitor Logs',
    description: 'All visitor sign-in records for the period',
    group: 'fsma',
  },
  {
    key: 'include_cleaning_logs',
    label: 'Cleaning Logs',
    description: 'Facility cleaning records with checklists',
    group: 'fsma',
  },
  {
    key: 'include_safety_meetings',
    label: 'Safety Meetings',
    description: 'Meeting records with attendee sign-in sheets',
    group: 'fsma',
  },
  {
    key: 'include_inventory',
    label: 'Fertilizer Inventory',
    description: 'Inventory snapshots and transaction history',
    group: 'fsma',
  },
  {
    key: 'include_phi_checks',
    label: 'PHI Compliance',
    description: 'Pre-harvest interval verification reports',
    group: 'fsma',
  },
  {
    key: 'include_harvest_records',
    label: 'Harvest Records',
    description: 'Harvest data with traceability information',
    group: 'fsma',
  },
  {
    key: 'include_primus_audits',
    label: 'Primus GFS Internal Audits',
    description: 'Completed audit records, scores, and findings from Primus GFS certification audits',
    group: 'primusgfs',
  },
  {
    key: 'include_primus_findings',
    label: 'Primus GFS Open Findings',
    description: 'Active non-conformances and corrective actions from Primus GFS audits',
    group: 'primusgfs',
  },
];

const INITIAL_BINDER_FORM = {
  title: '',
  date_range_start: '',
  date_range_end: '',
  include_visitor_logs: true,
  include_cleaning_logs: true,
  include_safety_meetings: true,
  include_inventory: true,
  include_phi_checks: true,
  include_harvest_records: true,
  include_primus_audits: true,
  include_primus_findings: true,
  notes: '',
};

const getBinderStatusIcon = (status) => {
  switch (status) {
    case 'completed': return CheckCircle2;
    case 'failed': return XCircle;
    case 'generating': return Loader;
    default: return Clock;
  }
};

const getBinderStatusColor = (status) => {
  switch (status) {
    case 'completed': return 'text-green-600 dark:text-green-400';
    case 'failed': return 'text-red-600 dark:text-red-400';
    case 'generating': return 'text-blue-600 dark:text-blue-400';
    default: return 'text-gray-600 dark:text-gray-400';
  }
};

const getBinderStatusLabel = (status) => {
  switch (status) {
    case 'completed': return 'Ready';
    case 'failed': return 'Failed';
    case 'generating': return 'Generating...';
    default: return 'Pending';
  }
};

const getBinderSectionsIncluded = (binder) => {
  const included = [];
  if (binder.include_visitor_logs) included.push('Visitors');
  if (binder.include_cleaning_logs) included.push('Cleaning');
  if (binder.include_safety_meetings) included.push('Meetings');
  if (binder.include_inventory) included.push('Inventory');
  if (binder.include_phi_checks) included.push('PHI');
  if (binder.include_harvest_records) included.push('Harvests');
  if (binder.include_primus_audits) included.push('Primus Audits');
  if (binder.include_primus_findings) included.push('Primus Findings');
  return included;
};

// ─── Schedule-Audit Modal ─────────────────────────────────────────────────────

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

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragOver(false); };

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

          {/* File Upload */}
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

// ─── Generate Binder Modal ────────────────────────────────────────────────────

const GenerateBinderModal = ({ onClose, onGenerated }) => {
  const toast = useToast();
  const [formData, setFormData] = useState(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return {
      ...INITIAL_BINDER_FORM,
      title: `Audit Binder - ${today.toLocaleDateString()}`,
      date_range_start: thirtyDaysAgo.toISOString().split('T')[0],
      date_range_end: today.toISOString().split('T')[0],
    };
  });
  const [generating, setGenerating] = useState(false);

  const selectedSectionCount = BINDER_SECTIONS.filter((s) => formData[s.key]).length;

  const handleSectionToggle = (key) => {
    setFormData((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setPreset = (days) => {
    const end = new Date();
    const start = new Date();
    if (days === 'ytd') {
      start.setMonth(0, 1);
    } else if (days === 'quarter') {
      start.setMonth(start.getMonth() - 3);
    } else {
      start.setDate(start.getDate() - days);
    }
    setFormData((prev) => ({
      ...prev,
      date_range_start: start.toISOString().split('T')[0],
      date_range_end: end.toISOString().split('T')[0],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGenerating(true);
    try {
      await fsmaAPI.generateAuditBinder(formData);
      onGenerated();
      onClose();
    } catch {
      toast.error('Failed to start binder generation. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Generate Audit Binder PDF
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Binder Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Q1 2026 Audit Binder"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date Range *
            </label>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.date_range_start}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date_range_start: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.date_range_end}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date_range_end: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Last 30 days', value: 30 },
                { label: 'Last Quarter', value: 'quarter' },
                { label: 'Year to Date', value: 'ytd' },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setPreset(value)}
                  className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Sections to Include
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {selectedSectionCount} of {BINDER_SECTIONS.length} selected
              </span>
            </div>

            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5">
              Food Safety (FSMA)
            </p>
            <div className="space-y-1.5 mb-4">
              {BINDER_SECTIONS.filter((s) => s.group === 'fsma').map((section) => (
                <label
                  key={section.key}
                  className="flex items-start gap-3 p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <button type="button" onClick={() => handleSectionToggle(section.key)} className="mt-0.5 flex-shrink-0">
                    {formData[section.key] ? (
                      <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{section.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{section.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1.5">
              Primus GFS Certification
            </p>
            <div className="space-y-1.5">
              {BINDER_SECTIONS.filter((s) => s.group === 'primusgfs').map((section) => (
                <label
                  key={section.key}
                  className="flex items-start gap-3 p-2.5 bg-teal-50 dark:bg-teal-900/20 rounded-lg cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-900/30 border border-teal-100 dark:border-teal-800"
                >
                  <button type="button" onClick={() => handleSectionToggle(section.key)} className="mt-0.5 flex-shrink-0">
                    {formData[section.key] ? (
                      <CheckSquare className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{section.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{section.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
              placeholder="Any additional notes for this audit binder..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating || !formData.date_range_start || !formData.date_range_end || selectedSectionCount === 0}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Generate Binder
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InternalAuditList() {
  const confirm = useConfirm();
  const toast = useToast();

  // Shared UI state
  const [activeTab, setActiveTab] = useState('audits'); // 'audits' | 'binders'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // ── Audit Schedule state ──
  const [audits, setAudits] = useState([]);
  const [auditsLoading, setAuditsLoading] = useState(true);
  const [auditsError, setAuditsError] = useState(null);
  const [editingAudit, setEditingAudit] = useState(null);
  const [expandedAuditId, setExpandedAuditId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterYear, setFilterYear] = useState('');

  // ── Binder Documents state ──
  const [binders, setBinders] = useState([]);
  const [bindersLoading, setBindersLoading] = useState(true);

  const yearOptions = getYearOptions();

  // ── Fetch audits ──
  const fetchAudits = useCallback(async () => {
    try {
      setAuditsLoading(true);
      setAuditsError(null);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterYear) params.year = filterYear;
      const response = await primusGFSAPI.getAudits(params);
      setAudits(response.data.results || response.data || []);
    } catch (err) {
      console.error('Failed to fetch audits:', err);
      setAuditsError('Failed to load audits. Please try again.');
    } finally {
      setAuditsLoading(false);
    }
  }, [filterStatus, filterYear]);

  useEffect(() => { fetchAudits(); }, [fetchAudits]);

  // ── Fetch binders ──
  const fetchBinders = useCallback(async () => {
    try {
      setBindersLoading(true);
      const response = await fsmaAPI.getAuditBinders();
      setBinders(response.data.results || response.data || []);
    } catch {
      // silently fail
    } finally {
      setBindersLoading(false);
    }
  }, []);

  useEffect(() => { fetchBinders(); }, [fetchBinders]);

  // Poll while any binder is generating
  useEffect(() => {
    const isGenerating = binders.some((b) => b.status === 'generating');
    if (!isGenerating) return;
    const interval = setInterval(fetchBinders, 5000);
    return () => clearInterval(interval);
  }, [binders, fetchBinders]);

  // ── Audit handlers ──
  const handleSaveAudit = async (payload, auditId) => {
    if (auditId) {
      await primusGFSAPI.updateAudit(auditId, payload);
    } else {
      await primusGFSAPI.createAudit(payload);
    }
    fetchAudits();
  };

  const handleDeleteAudit = async (id) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Delete this audit?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await primusGFSAPI.deleteAudit(id);
      fetchAudits();
    } catch {
      /* ignore */
    }
  };

  const handleCompleteAudit = async (id) => {
    try {
      await primusGFSAPI.completeAudit(id);
      fetchAudits();
    } catch {
      /* ignore */
    }
  };

  // ── Binder handlers ──
  const handleDownloadBinder = async (binderId) => {
    try {
      const response = await fsmaAPI.downloadAuditBinder(binderId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-binder-${binderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download binder.');
    }
  };

  const handleDeleteBinder = async (binderId) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Delete this audit binder?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await fsmaAPI.deleteAuditBinder(binderId);
      fetchBinders();
    } catch {
      /* ignore */
    }
  };

  // ── Render ──
  return (
    <div className="space-y-4">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          Audit Binder
        </h2>
        <div className="flex items-center gap-2">
          {activeTab === 'audits' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Schedule Audit
            </button>
          )}
          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            Generate PDF Binder
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[
          { key: 'audits', label: 'Audit Schedule', count: audits.length },
          { key: 'binders', label: 'Generated Binders', count: binders.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-teal-600 text-teal-600 dark:text-teal-400 dark:border-teal-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeTab === tab.key
                  ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════ AUDIT SCHEDULE TAB ════════════════ */}
      {activeTab === 'audits' && (
        <>
          {/* Toolbar */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {yearOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Error */}
          {auditsError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-700 dark:text-red-400 mb-3">{auditsError}</p>
              <button
                onClick={fetchAudits}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
            </div>
          )}

          {/* Loading */}
          {auditsLoading && !auditsError && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          )}

          {/* Empty */}
          {!auditsLoading && !auditsError && audits.length === 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="font-medium text-gray-900 dark:text-white">No audits found</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Schedule your first internal audit to start tracking compliance.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" /> Schedule Audit
              </button>
            </div>
          )}

          {/* Audit Table */}
          {!auditsLoading && !auditsError && audits.length > 0 && (
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
                                <Paperclip className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" title="Report attached" />
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
                                className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingAudit(audit)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {audit.status === 'in_progress' && (
                                <button
                                  onClick={() => handleCompleteAudit(audit.id)}
                                  className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                  title="Complete Audit"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteAudit(audit.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
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
                                    <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                                    <span className="text-gray-600 dark:text-gray-400">{audit.report_file_name}</span>
                                    <a
                                      href={audit.report_file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 rounded"
                                    >
                                      <Download className="w-3 h-3" /> View / Download
                                    </a>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Report File: </span>
                                    <span className="text-gray-400 italic">No file attached</span>
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
        </>
      )}

      {/* ════════════════ GENERATED BINDERS TAB ════════════════ */}
      {activeTab === 'binders' && (
        <>
          {/* Info banner */}
          <div className="p-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-teal-800 dark:text-teal-200 font-medium">Comprehensive Audit Binders</p>
                <p className="text-sm text-teal-700 dark:text-teal-300 mt-0.5">
                  PDF binders combine FSMA records (visitors, cleaning, meetings, PHI) with Primus GFS audit data into a single document ready for regulatory inspection.
                </p>
              </div>
            </div>
          </div>

          {/* Loading */}
          {bindersLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
            </div>
          )}

          {/* Empty */}
          {!bindersLoading && binders.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="font-medium text-gray-900 dark:text-white">No binders generated yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Generate your first PDF binder to package your compliance records for inspection.
              </p>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                <FileText className="w-4 h-4" /> Generate First Binder
              </button>
            </div>
          )}

          {/* Binder list */}
          {!bindersLoading && binders.length > 0 && (
            <div className="space-y-3">
              {binders.map((binder) => {
                const StatusIcon = getBinderStatusIcon(binder.status);
                const sectionsIncluded = getBinderSectionsIncluded(binder);
                return (
                  <div
                    key={binder.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className={`flex-shrink-0 p-2 rounded-lg ${
                          binder.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                          binder.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30' :
                          'bg-blue-100 dark:bg-blue-900/30'
                        }`}>
                          <StatusIcon className={`w-5 h-5 ${getBinderStatusColor(binder.status)} ${
                            binder.status === 'generating' ? 'animate-spin' : ''
                          }`} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">
                            {binder.title || `Audit Binder #${binder.id}`}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(binder.date_range_start).toLocaleDateString()} –{' '}
                              {new Date(binder.date_range_end).toLocaleDateString()}
                            </span>
                            <span className={getBinderStatusColor(binder.status)}>
                              {getBinderStatusLabel(binder.status)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {sectionsIncluded.map((section) => (
                              <span
                                key={section}
                                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
                              >
                                {section}
                              </span>
                            ))}
                          </div>
                          {binder.error_message && (
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1.5">
                              Error: {binder.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {binder.status === 'completed' && (
                          <button
                            onClick={() => handleDownloadBinder(binder.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                          >
                            <Download className="w-4 h-4" /> Download
                          </button>
                        )}
                        {binder.status === 'generating' && (
                          <button
                            onClick={fetchBinders}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            <RefreshCw className="w-4 h-4" /> Refresh
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteBinder(binder.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                          title="Delete binder"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {showCreateModal && (
        <AuditModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleSaveAudit}
        />
      )}
      {editingAudit && (
        <AuditModal
          editAudit={editingAudit}
          onClose={() => setEditingAudit(null)}
          onSave={handleSaveAudit}
        />
      )}
      {showGenerateModal && (
        <GenerateBinderModal
          onClose={() => setShowGenerateModal(false)}
          onGenerated={() => {
            fetchBinders();
            setActiveTab('binders');
          }}
        />
      )}
    </div>
  );
}
