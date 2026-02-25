import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Calendar,
  CheckSquare,
  Square,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
  Trash2,
  Eye,
} from 'lucide-react';
import { fsmaAPI } from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';

/**
 * AuditBinderGenerator Component
 *
 * Generates comprehensive FSMA audit binders with:
 * - Date range selection
 * - Section selection (visitor logs, cleaning, meetings, etc.)
 * - PDF generation status tracking
 * - Download and management of generated binders
 */
const AuditBinderGenerator = () => {
  const confirm = useConfirm();
  const toast = useToast();
  const [binders, setBinders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Generate form state
  const [formData, setFormData] = useState({
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
  });

  const sections = [
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

  const fetchBinders = async () => {
    try {
      setLoading(true);
      const response = await fsmaAPI.getAuditBinders();
      setBinders(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching binders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBinders();
  }, []);

  // Poll for status updates on generating binders
  useEffect(() => {
    const generatingBinders = binders.filter((b) => b.status === 'generating');
    if (generatingBinders.length === 0) return;

    const interval = setInterval(fetchBinders, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [binders]);

  const handleSectionToggle = (key) => {
    setFormData((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    try {
      setGenerating(true);
      await fsmaAPI.generateAuditBinder(formData);
      setShowGenerateModal(false);
      resetForm();
      fetchBinders();
    } catch (error) {
      console.error('Error generating binder:', error);
      toast.error('Failed to start binder generation');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (binderId) => {
    try {
      const response = await fsmaAPI.downloadAuditBinder(binderId);
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-binder-${binderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading binder:', error);
      toast.error('Failed to download binder');
    }
  };

  const handleDelete = async (binderId) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this audit binder?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    try {
      await fsmaAPI.deleteAuditBinder(binderId);
      fetchBinders();
    } catch (error) {
      console.error('Error deleting binder:', error);
    }
  };

  const resetForm = () => {
    setFormData({
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
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return CheckCircle;
      case 'failed':
        return XCircle;
      case 'generating':
        return Loader;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-primary dark:text-green-400';
      case 'failed':
        return 'text-red-600 dark:text-red-400';
      case 'generating':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Ready';
      case 'failed':
        return 'Failed';
      case 'generating':
        return 'Generating...';
      default:
        return 'Pending';
    }
  };

  const getSectionsIncluded = (binder) => {
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

  // Set default date range (last 30 days) when opening modal
  const openGenerateModal = () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    setFormData({
      ...formData,
      title: `Audit Binder - ${today.toLocaleDateString()}`,
      date_range_start: thirtyDaysAgo.toISOString().split('T')[0],
      date_range_end: today.toISOString().split('T')[0],
    });
    setShowGenerateModal(true);
  };

  const selectedSectionCount = sections.filter((s) => formData[s.key]).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-6 h-6" />
          Audit Binders
        </h2>
        <button
          onClick={openGenerateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Generate Binder
        </button>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
              FSMA Audit Preparation
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Generate comprehensive audit binders containing all required FSMA compliance
              documentation. Binders are compiled as PDF files ready for regulatory inspection.
            </p>
          </div>
        </div>
      </div>

      {/* Binders List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : binders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No audit binders generated yet</p>
          <button
            onClick={openGenerateModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FileText className="w-4 h-4" />
            Generate First Binder
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {binders.map((binder) => {
            const StatusIcon = getStatusIcon(binder.status);
            const sectionsIncluded = getSectionsIncluded(binder);

            return (
              <div
                key={binder.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        binder.status === 'completed'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : binder.status === 'failed'
                          ? 'bg-red-100 dark:bg-red-900/30'
                          : 'bg-blue-100 dark:bg-blue-900/30'
                      }`}
                    >
                      <StatusIcon
                        className={`w-5 h-5 ${getStatusColor(binder.status)} ${
                          binder.status === 'generating' ? 'animate-spin' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {binder.title || `Audit Binder #${binder.id}`}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(binder.date_range_start).toLocaleDateString()} -{' '}
                          {new Date(binder.date_range_end).toLocaleDateString()}
                        </span>
                        <span className={getStatusColor(binder.status)}>
                          {getStatusLabel(binder.status)}
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
                        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                          Error: {binder.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {binder.status === 'completed' && (
                      <button
                        onClick={() => handleDownload(binder.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900/30 text-primary dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    )}
                    {binder.status === 'generating' && (
                      <button
                        onClick={fetchBinders}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(binder.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
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

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Generate Audit Binder
              </h3>
              <button
                onClick={() => {
                  setShowGenerateModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleGenerate} className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Binder Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Q1 2024 Audit Binder"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date Range *
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.date_range_start}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, date_range_start: e.target.value }))
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={formData.date_range_end}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, date_range_end: e.target.value }))
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Date Presets */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(start.getDate() - 30);
                    setFormData((prev) => ({
                      ...prev,
                      date_range_start: start.toISOString().split('T')[0],
                      date_range_end: end.toISOString().split('T')[0],
                    }));
                  }}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Last 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setMonth(start.getMonth() - 3);
                    setFormData((prev) => ({
                      ...prev,
                      date_range_start: start.toISOString().split('T')[0],
                      date_range_end: end.toISOString().split('T')[0],
                    }));
                  }}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Last Quarter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const end = new Date();
                    const start = new Date(end.getFullYear(), 0, 1);
                    setFormData((prev) => ({
                      ...prev,
                      date_range_start: start.toISOString().split('T')[0],
                      date_range_end: end.toISOString().split('T')[0],
                    }));
                  }}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Year to Date
                </button>
              </div>

              {/* Sections to Include */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sections to Include
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedSectionCount} of {sections.length} selected
                  </span>
                </div>

                {/* FSMA Sections */}
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5">
                  Food Safety (FSMA)
                </p>
                <div className="space-y-2 mb-4">
                  {sections.filter((s) => s.group === 'fsma').map((section) => (
                    <label
                      key={section.key}
                      className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <button type="button" onClick={() => handleSectionToggle(section.key)} className="mt-0.5">
                        {formData[section.key] ? (
                          <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{section.label}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{section.description}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {/* Primus GFS Sections */}
                <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1.5">
                  Primus GFS Certification
                </p>
                <div className="space-y-2">
                  {sections.filter((s) => s.group === 'primusgfs').map((section) => (
                    <label
                      key={section.key}
                      className="flex items-start gap-3 p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg cursor-pointer hover:bg-teal-100 dark:hover:bg-teal-900/30 border border-teal-100 dark:border-teal-800"
                    >
                      <button type="button" onClick={() => handleSectionToggle(section.key)} className="mt-0.5">
                        {formData[section.key] ? (
                          <CheckSquare className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{section.label}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{section.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  placeholder="Any additional notes for this audit binder..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowGenerateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    generating ||
                    !formData.date_range_start ||
                    !formData.date_range_end ||
                    selectedSectionCount === 0
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generating ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Starting...
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
      )}
    </div>
  );
};

export default AuditBinderGenerator;
