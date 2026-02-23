import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MoreVertical,
  Edit2,
  Trash2,
  RefreshCw,
  Calendar,
  X,
  ChevronRight,
  FileCheck,
  Upload,
} from 'lucide-react';
import { complianceReportsAPI, COMPLIANCE_CONSTANTS } from '../../services/api';
import { useConfirm } from '../../contexts/ConfirmContext';

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// Report type badge
const ReportTypeBadge = ({ type }) => {
  const styles = {
    pur_monthly: 'bg-purple-100 text-purple-700',
    sgma_semi_annual: 'bg-blue-100 text-blue-700',
    ilrp_annual: 'bg-cyan-100 text-cyan-700',
    wps_annual: 'bg-green-100 text-green-700',
    custom: 'bg-gray-100 text-gray-700',
  };

  const labels = {
    pur_monthly: 'PUR Monthly',
    sgma_semi_annual: 'SGMA Semi-Annual',
    ilrp_annual: 'ILRP Annual',
    wps_annual: 'WPS Annual',
    custom: 'Custom',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[type] || styles.custom}`}>
      {labels[type] || type}
    </span>
  );
};

// Status badge component
const StatusBadge = ({ status }) => {
  const styles = {
    draft: 'bg-gray-100 text-gray-700',
    pending_review: 'bg-amber-100 text-amber-700',
    ready: 'bg-blue-100 text-blue-700',
    submitted: 'bg-green-100 text-green-700',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const labels = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    ready: 'Ready to Submit',
    submitted: 'Submitted',
    accepted: 'Accepted',
    rejected: 'Rejected',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
      {labels[status] || status}
    </span>
  );
};

// Report Card Component
const ReportCard = ({ report, onView, onDownload, onSubmit, onDelete }) => {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusIcon = () => {
    switch (report.status) {
      case 'accepted':
      case 'submitted':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'ready':
        return <FileCheck className="w-5 h-5 text-blue-600" />;
      case 'pending_review':
        return <Clock className="w-5 h-5 text-amber-600" />;
      case 'rejected':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center
            ${report.status === 'accepted' || report.status === 'submitted' ? 'bg-green-100' :
              report.status === 'ready' ? 'bg-blue-100' :
              report.status === 'pending_review' ? 'bg-amber-100' :
              report.status === 'rejected' ? 'bg-red-100' : 'bg-gray-100'}`}>
            {getStatusIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ReportTypeBadge type={report.report_type} />
              <StatusBadge status={report.status} />
            </div>
            <h3 className="font-medium text-gray-900">
              {report.report_type_display || report.report_type}
            </h3>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={() => { onView(report); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" /> View Details
                </button>
                {report.report_file && (
                  <button
                    onClick={() => { onDownload(report); setShowMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                )}
                {report.status === 'ready' && (
                  <button
                    onClick={() => { onSubmit(report); setShowMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" /> Submit
                  </button>
                )}
                {report.status === 'draft' && (
                  <button
                    onClick={() => { onDelete(report.id); setShowMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span>
            {formatDate(report.reporting_period_start)} - {formatDate(report.reporting_period_end)}
          </span>
        </div>

        {report.submitted_at && (
          <div className="flex items-center gap-2 text-gray-600">
            <Send className="w-4 h-4 text-gray-400" />
            <span>Submitted: {formatDate(report.submitted_at)}</span>
          </div>
        )}

        {report.submission_reference && (
          <div className="flex items-center gap-2 text-gray-600">
            <FileCheck className="w-4 h-4 text-gray-400" />
            <span>Ref: {report.submission_reference}</span>
          </div>
        )}
      </div>

      {/* Validation warnings/errors */}
      {(report.validation_errors?.length > 0 || report.validation_warnings?.length > 0) && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
          {report.validation_errors?.length > 0 && (
            <div className="flex items-center gap-1 text-red-600 text-xs">
              <AlertTriangle className="w-3 h-3" />
              <span>{report.validation_errors.length} error(s)</span>
            </div>
          )}
          {report.validation_warnings?.length > 0 && (
            <div className="flex items-center gap-1 text-amber-600 text-xs">
              <AlertTriangle className="w-3 h-3" />
              <span>{report.validation_warnings.length} warning(s)</span>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
        <button
          onClick={() => onView(report)}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          View
        </button>
        {report.status === 'ready' && (
          <button
            onClick={() => onSubmit(report)}
            className="flex-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Submit
          </button>
        )}
        {report.status === 'draft' && (
          <button
            onClick={() => onView(report)}
            className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
};

// Report Detail Modal
const ReportDetailModal = ({ report, onClose, onValidate, onSubmit }) => {
  const [validating, setValidating] = useState(false);

  const handleValidate = async () => {
    setValidating(true);
    try {
      await onValidate(report.id);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ReportTypeBadge type={report.report_type} />
              <StatusBadge status={report.status} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">
              {report.report_type_display || report.report_type}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Period */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Reporting Period</h3>
            <p className="text-gray-900">
              {formatDate(report.reporting_period_start)} - {formatDate(report.reporting_period_end)}
            </p>
          </div>

          {/* Submission Info */}
          {report.submitted_at && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Submission</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Submitted:</span>
                  <span className="text-gray-900">{formatDate(report.submitted_at)}</span>
                </div>
                {report.submitted_by_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">By:</span>
                    <span className="text-gray-900">{report.submitted_by_name}</span>
                  </div>
                )}
                {report.submission_reference && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Reference:</span>
                    <span className="text-gray-900">{report.submission_reference}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Validation Results */}
          {(report.validation_errors?.length > 0 || report.validation_warnings?.length > 0) && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Validation Results</h3>
              <div className="space-y-2">
                {report.validation_errors?.map((error, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                ))}
                {report.validation_warnings?.map((warning, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-amber-600 text-sm bg-amber-50 rounded-lg p-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report Data Summary */}
          {report.report_data && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Report Summary</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-xs text-gray-700 overflow-auto">
                  {JSON.stringify(report.report_data, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            {report.report_file && (
              <a
                href={report.report_file}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            )}
            {report.status === 'draft' && (
              <button
                onClick={handleValidate}
                disabled={validating}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <FileCheck className="w-4 h-4" />
                {validating ? 'Validating...' : 'Validate'}
              </button>
            )}
            {report.status === 'ready' && (
              <button
                onClick={() => onSubmit(report)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Submit Report
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Generate Report Modal
const GenerateReportModal = ({ onClose, onGenerate }) => {
  const [formData, setFormData] = useState({
    report_type: 'pur_monthly',
    reporting_period_start: '',
    reporting_period_end: '',
  });
  const [generating, setGenerating] = useState(false);

  // Auto-set period based on report type
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (formData.report_type === 'pur_monthly') {
      // Previous month
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      setFormData(prev => ({
        ...prev,
        reporting_period_start: start.toISOString().split('T')[0],
        reporting_period_end: end.toISOString().split('T')[0],
      }));
    } else if (formData.report_type === 'sgma_semi_annual') {
      // Current half-year
      if (month < 6) {
        setFormData(prev => ({
          ...prev,
          reporting_period_start: `${year}-01-01`,
          reporting_period_end: `${year}-06-30`,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          reporting_period_start: `${year}-07-01`,
          reporting_period_end: `${year}-12-31`,
        }));
      }
    } else if (formData.report_type.includes('annual')) {
      // Previous year
      setFormData(prev => ({
        ...prev,
        reporting_period_start: `${year - 1}-01-01`,
        reporting_period_end: `${year - 1}-12-31`,
      }));
    }
  }, [formData.report_type]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGenerating(true);
    try {
      await onGenerate(formData);
      onClose();
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Generate Report</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type *</label>
            <select
              required
              value={formData.report_type}
              onChange={(e) => setFormData({ ...formData, report_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {COMPLIANCE_CONSTANTS.REPORT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Start *</label>
              <input
                type="date"
                required
                value={formData.reporting_period_start}
                onChange={(e) => setFormData({ ...formData, reporting_period_start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period End *</label>
              <input
                type="date"
                required
                value={formData.reporting_period_end}
                onChange={(e) => setFormData({ ...formData, reporting_period_end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              The report will be generated based on pesticide application data within the selected period.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Component
export default function ComplianceReports({ onNavigate }) {
  const confirm = useConfirm();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  // Fetch reports
  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter !== 'all') {
        params.status = filter;
      }
      if (typeFilter !== 'all') {
        params.report_type = typeFilter;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      const response = await complianceReportsAPI.getAll(params);
      setReports(response.data.results || response.data || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, typeFilter, searchQuery]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Handle generate
  const handleGenerate = async (data) => {
    await complianceReportsAPI.generate(data);
    fetchReports();
  };

  // Handle validate
  const handleValidate = async (id) => {
    await complianceReportsAPI.validate(id);
    fetchReports();
    // Refresh selected report if viewing
    if (selectedReport?.id === id) {
      const response = await complianceReportsAPI.get(id);
      setSelectedReport(response.data);
    }
  };

  // Handle submit
  const handleSubmit = async (report) => {
    const ok = await confirm({ title: 'Are you sure?', message: `Are you sure you want to submit this ${report.report_type_display || report.report_type} report?`, confirmLabel: 'Submit', variant: 'warning' });
    if (!ok) return;
    await complianceReportsAPI.submit(report.id);
    fetchReports();
    setSelectedReport(null);
  };

  // Handle delete
  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this report?', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    await complianceReportsAPI.delete(id);
    fetchReports();
  };

  // Handle download
  const handleDownload = (report) => {
    if (report.report_file) {
      window.open(report.report_file, '_blank');
    }
  };

  // Stats
  const stats = {
    total: reports.length,
    draft: reports.filter(r => r.status === 'draft').length,
    ready: reports.filter(r => r.status === 'ready').length,
    submitted: reports.filter(r => r.status === 'submitted' || r.status === 'accepted').length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <button onClick={() => onNavigate?.('compliance')} className="hover:text-green-600">
              Compliance
            </button>
            <span>/</span>
            <span>Reports</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Reports</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchReports}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600" />
            <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">Total Reports</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-gray-600" />
            <span className="text-2xl font-bold text-gray-600">{stats.draft}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">Drafts</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-blue-600" />
            <span className="text-2xl font-bold text-blue-600">{stats.ready}</span>
          </div>
          <p className="text-sm text-blue-700 mt-1">Ready to Submit</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-2xl font-bold text-green-600">{stats.submitted}</span>
          </div>
          <p className="text-sm text-green-700 mt-1">Submitted</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border-0 bg-transparent text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="ready">Ready</option>
                <option value="submitted">Submitted</option>
                <option value="accepted">Accepted</option>
              </select>
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="all">All Types</option>
              {COMPLIANCE_CONSTANTS.REPORT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 w-64"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : reports.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              onView={setSelectedReport}
              onDownload={handleDownload}
              onSubmit={handleSubmit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium text-gray-900">No reports found</p>
          <p className="text-sm text-gray-500 mt-1">Generate your first compliance report</p>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Generate Report
          </button>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <GenerateReportModal
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerate}
        />
      )}

      {/* Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onValidate={handleValidate}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
