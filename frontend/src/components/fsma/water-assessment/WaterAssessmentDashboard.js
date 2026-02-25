import React, { useState, useEffect } from 'react';
import {
  Droplets,
  Plus,
  Filter,
  Search,
  Download,
  Copy,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { fsmaAPI } from '../../../services/api';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useToast } from '../../../contexts/ToastContext';

/**
 * WaterAssessmentDashboard Component
 *
 * List view for FSMA Pre-Harvest Agricultural Water Assessments with:
 * - Filter by farm, year, status
 * - Quick actions (view, edit, duplicate, download)
 * - Status badges with risk indicators
 * - Summary statistics
 */
const WaterAssessmentDashboard = ({ onCreateNew, onViewAssessment, onEditAssessment }) => {
  const confirm = useConfirm();
  const toast = useToast();
  const [assessments, setAssessments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    farm: '',
    year: new Date().getFullYear(),
    status: '',
    search: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Available options
  const [farms, setFarms] = useState([]);

  useEffect(() => {
    loadData();
    loadFarms();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.farm) params.farm = filters.farm;
      if (filters.year) params.assessment_year = filters.year;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;

      const [assessmentsRes, summaryRes] = await Promise.all([
        fsmaAPI.getWaterAssessments(params),
        fsmaAPI.getWaterAssessmentSummary(),
      ]);

      setAssessments(assessmentsRes.data.results || assessmentsRes.data);
      setSummary(summaryRes.data);
      setError(null);
    } catch (err) {
      console.error('Error loading water assessments:', err);
      setError('Failed to load water assessments');
    } finally {
      setLoading(false);
    }
  };

  const loadFarms = async () => {
    try {
      const response = await fsmaAPI.getFarms();
      setFarms(response.data.results || response.data);
    } catch (err) {
      console.error('Error loading farms:', err);
    }
  };

  const handleDownloadPdf = async (assessmentId) => {
    try {
      const response = await fsmaAPI.downloadWaterAssessmentPdf(assessmentId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `water_assessment_${assessmentId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error downloading PDF:', err);
      toast.error('Failed to download PDF');
    }
  };

  const handleDuplicate = async (assessmentId) => {
    try {
      const newYear = window.prompt('Enter assessment year for the duplicate:', String(new Date().getFullYear() + 1));
      if (!newYear) return;

      await fsmaAPI.duplicateWaterAssessment(assessmentId, { assessment_year: parseInt(newYear, 10) });
      loadData();
    } catch (err) {
      console.error('Error duplicating assessment:', err);
      toast.error('Failed to duplicate assessment');
    }
  };

  const handleDelete = async (assessmentId) => {
    const ok = await confirm({ title: 'Are you sure?', message: 'Are you sure you want to delete this assessment? This cannot be undone.', confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;

    try {
      await fsmaAPI.deleteWaterAssessment(assessmentId);
      loadData();
    } catch (err) {
      console.error('Error deleting assessment:', err);
      toast.error('Failed to delete assessment');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
      submitted: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
      approved: 'bg-green-100 text-primary dark:bg-green-900/40 dark:text-green-400',
    };
    const labels = {
      draft: 'Draft',
      in_progress: 'In Progress',
      submitted: 'Pending Review',
      approved: 'Approved',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getRiskBadge = (riskLevel, riskScore) => {
    if (!riskLevel) return null;
    const styles = {
      low: 'bg-green-100 text-primary dark:bg-green-900/40 dark:text-green-400',
      medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
      high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
      critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[riskLevel] || styles.medium}`}>
        {riskLevel.toUpperCase()} {riskScore ? `(${riskScore})` : ''}
      </span>
    );
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  if (loading && assessments.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard
            title="Total Assessments"
            value={summary.total || 0}
            icon={FileText}
            color="blue"
          />
          <SummaryCard
            title="Approved"
            value={summary.approved || 0}
            icon={CheckCircle2}
            color="green"
          />
          <SummaryCard
            title="Pending Review"
            value={summary.submitted || 0}
            icon={Clock}
            color="yellow"
          />
          <SummaryCard
            title="High Risk"
            value={summary.high_risk || 0}
            icon={AlertTriangle}
            color="red"
          />
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Assessment
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters
                ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-5 h-5" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search assessments..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Farm
              </label>
              <select
                value={filters.farm}
                onChange={(e) => setFilters({ ...filters, farm: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All Farms</option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Year
              </label>
              <select
                value={filters.year}
                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All Years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="in_progress">In Progress</option>
                <option value="submitted">Pending Review</option>
                <option value="approved">Approved</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setFilters({ farm: '', year: currentYear, status: '', search: '' })}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
          <button
            onClick={loadData}
            className="mt-2 text-sm text-red-600 dark:text-red-400 underline inline-flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      )}

      {/* Assessments Table */}
      {assessments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <Droplets className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Water Assessments Found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Create your first FSMA Pre-Harvest Agricultural Water Assessment to get started.
          </p>
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Assessment
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Farm
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Risk Level
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    FDA Determination
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Assessor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {assessments.map((assessment) => (
                  <tr
                    key={assessment.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Droplets className="w-5 h-5 text-blue-500" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {assessment.farm_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {assessment.assessment_year}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getStatusBadge(assessment.status)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getRiskBadge(assessment.risk_level, assessment.overall_risk_score)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {assessment.fda_determination_display || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {assessment.assessor_name || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onViewAssessment?.(assessment.id)}
                          className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title="View"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        {assessment.status !== 'approved' && (
                          <button
                            onClick={() => onEditAssessment?.(assessment.id)}
                            className="p-1 text-gray-500 hover:text-primary dark:hover:text-green-400 transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                        )}
                        {assessment.status === 'approved' && assessment.pdf_file && (
                          <button
                            onClick={() => handleDownloadPdf(assessment.id)}
                            className="p-1 text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicate(assessment.id)}
                          className="p-1 text-gray-500 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors"
                          title="Duplicate for Next Year"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                        {assessment.status === 'draft' && (
                          <button
                            onClick={() => handleDelete(assessment.id)}
                            className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Summary Card Component
 */
const SummaryCard = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/40 text-primary dark:text-green-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400',
    red: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        </div>
      </div>
    </div>
  );
};

export default WaterAssessmentDashboard;
