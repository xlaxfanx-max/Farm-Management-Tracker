import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Search,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Calendar,
  MapPin,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
  Leaf,
  XCircle,
} from 'lucide-react';
import { fsmaAPI } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

/**
 * PHIComplianceChecker Component
 *
 * Pre-Harvest Interval (PHI) compliance verification with:
 * - Pre-harvest checks for proposed harvest dates
 * - Status overview for all fields
 * - Application history affecting PHI
 * - Override capability for documented exceptions
 */
const PHIComplianceChecker = () => {
  const toast = useToast();
  const [phiChecks, setPHIChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPreCheckModal, setShowPreCheckModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Pre-check form state
  const [preCheckFormData, setPreCheckFormData] = useState({
    field: '',
    proposed_harvest_date: '',
  });
  const [preCheckResult, setPreCheckResult] = useState(null);
  const [preCheckLoading, setPreCheckLoading] = useState(false);

  // Related data
  const [fields, setFields] = useState([]);
  const [farms, setFarms] = useState([]);

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'compliant', label: 'Compliant' },
    { value: 'non_compliant', label: 'Non-Compliant' },
    { value: 'warning', label: 'Warning' },
    { value: 'pending', label: 'Pending' },
  ];

  const fetchPHIChecks = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;

      const response = await fsmaAPI.getPHIChecks(params);
      setPHIChecks(response.data.results || response.data || []);
    } catch (error) {
      console.error('Error fetching PHI checks:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  const fetchRelatedData = async () => {
    try {
      const [fieldsRes, farmsRes] = await Promise.all([
        fsmaAPI.getFields(),
        fsmaAPI.getFarms(),
      ]);
      setFields(fieldsRes.data.results || fieldsRes.data || []);
      setFarms(farmsRes.data.results || farmsRes.data || []);
    } catch (error) {
      console.error('Error fetching related data:', error);
    }
  };

  useEffect(() => {
    fetchPHIChecks();
    fetchRelatedData();
  }, [fetchPHIChecks]);

  const runPreCheck = async () => {
    if (!preCheckFormData.field || !preCheckFormData.proposed_harvest_date) return;

    try {
      setPreCheckLoading(true);
      const response = await fsmaAPI.runPHIPreCheck(preCheckFormData);
      setPreCheckResult(response.data);
    } catch (error) {
      console.error('Error running pre-check:', error);
      toast.error('Failed to run PHI pre-check');
    } finally {
      setPreCheckLoading(false);
    }
  };

  const refreshCheck = async (checkId) => {
    try {
      await fsmaAPI.verifyPHICheck(checkId);
      fetchPHIChecks();
    } catch (error) {
      console.error('Error refreshing check:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'compliant':
        return CheckCircle;
      case 'non_compliant':
        return XCircle;
      case 'warning':
        return AlertTriangle;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'compliant':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'non_compliant':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'compliant':
        return 'Compliant';
      case 'non_compliant':
        return 'Non-Compliant';
      case 'warning':
        return 'Warning';
      default:
        return 'Pending';
    }
  };

  const getFarmName = (fieldId) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return '';
    const farm = farms.find((f) => f.id === field.farm);
    return farm ? farm.name : '';
  };

  const getFieldName = (fieldId) => {
    const field = fields.find((f) => f.id === fieldId);
    return field ? field.name : '';
  };

  const resetPreCheck = () => {
    setPreCheckFormData({
      field: '',
      proposed_harvest_date: '',
    });
    setPreCheckResult(null);
  };

  const countByStatus = (status) => {
    return phiChecks.filter((c) => c.status === status).length;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="w-6 h-6" />
          PHI Compliance
        </h2>
        <button
          onClick={() => {
            resetPreCheck();
            setShowPreCheckModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Calendar className="w-4 h-4" />
          Pre-Harvest Check
        </button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm text-green-700 dark:text-green-300">Compliant</span>
          </div>
          <p className="text-2xl font-bold text-green-800 dark:text-green-200">
            {countByStatus('compliant')}
          </p>
        </div>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <span className="text-sm text-red-700 dark:text-red-300">Non-Compliant</span>
          </div>
          <p className="text-2xl font-bold text-red-800 dark:text-red-200">
            {countByStatus('non_compliant')}
          </p>
        </div>
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm text-yellow-700 dark:text-yellow-300">Warning</span>
          </div>
          <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
            {countByStatus('warning')}
          </p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Pending</span>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            {countByStatus('pending')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setSearchTerm('');
            setStatusFilter('');
          }}
          className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Clear Filters
        </button>
      </div>

      {/* PHI Checks List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : phiChecks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No PHI compliance checks found</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            PHI checks are automatically created when harvests are scheduled
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {phiChecks.map((check) => {
            const StatusIcon = getStatusIcon(check.status);
            const isExpanded = expandedId === check.id;

            return (
              <div
                key={check.id}
                className={`bg-white dark:bg-gray-800 border rounded-lg overflow-hidden ${
                  check.status === 'non_compliant'
                    ? 'border-red-300 dark:border-red-700'
                    : check.status === 'warning'
                    ? 'border-yellow-300 dark:border-yellow-700'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Main row */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  onClick={() => setExpandedId(isExpanded ? null : check.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${getStatusColor(check.status)}`}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {check.harvest?.field_name || 'Unknown Field'}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {check.harvest?.farm_name || 'Unknown Farm'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Harvest:{' '}
                          {check.harvest?.harvest_date
                            ? new Date(check.harvest.harvest_date).toLocaleDateString()
                            : 'Not set'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(
                        check.status
                      )}`}
                    >
                      {getStatusLabel(check.status)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        refreshCheck(check.id);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Refresh check"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
                    {/* Warnings */}
                    {check.warnings && check.warnings.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Warnings
                        </p>
                        {check.warnings.map((warning, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded"
                          >
                            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-yellow-800 dark:text-yellow-300">
                              {warning}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Applications Checked */}
                    {check.applications_checked && check.applications_checked.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Applications Checked ({check.applications_checked.length})
                        </p>
                        <div className="space-y-2">
                          {check.applications_checked.map((app, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg ${
                                app.compliant
                                  ? 'bg-green-50 dark:bg-green-900/20'
                                  : 'bg-red-50 dark:bg-red-900/20'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Leaf
                                    className={`w-4 h-4 ${
                                      app.compliant
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }`}
                                  />
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {app.product_name}
                                  </span>
                                </div>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    app.compliant
                                      ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                                      : 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                                  }`}
                                >
                                  {app.compliant ? 'OK' : 'VIOLATION'}
                                </span>
                              </div>
                              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div>
                                  <span className="text-gray-500">Applied:</span>{' '}
                                  {new Date(app.application_date).toLocaleDateString()}
                                </div>
                                <div>
                                  <span className="text-gray-500">PHI:</span> {app.phi_days} days
                                </div>
                                <div>
                                  <span className="text-gray-500">Days Since:</span>{' '}
                                  {app.days_since_application}
                                </div>
                                <div>
                                  <span className="text-gray-500">Safe After:</span>{' '}
                                  {new Date(app.safe_harvest_date).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Earliest Safe Harvest */}
                    {check.earliest_safe_harvest && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Earliest safe harvest date:{' '}
                          <span className="font-semibold">
                            {new Date(check.earliest_safe_harvest).toLocaleDateString()}
                          </span>
                        </p>
                      </div>
                    )}

                    {/* Last Checked */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        Last checked:{' '}
                        {check.checked_at
                          ? new Date(check.checked_at).toLocaleString()
                          : 'Never'}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedCheck(check);
                          setShowDetailsModal(true);
                        }}
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <FileText className="w-4 h-4" />
                        Full Report
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pre-Check Modal */}
      {showPreCheckModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Pre-Harvest PHI Check
              </h3>
              <button
                onClick={() => {
                  setShowPreCheckModal(false);
                  resetPreCheck();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Field Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Field *
                </label>
                <select
                  value={preCheckFormData.field}
                  onChange={(e) =>
                    setPreCheckFormData((prev) => ({ ...prev, field: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select field...</option>
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.name} ({getFarmName(field.id) || 'Unknown Farm'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Proposed Harvest Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Proposed Harvest Date *
                </label>
                <input
                  type="date"
                  value={preCheckFormData.proposed_harvest_date}
                  onChange={(e) =>
                    setPreCheckFormData((prev) => ({
                      ...prev,
                      proposed_harvest_date: e.target.value,
                    }))
                  }
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Run Check Button */}
              <button
                onClick={runPreCheck}
                disabled={
                  !preCheckFormData.field ||
                  !preCheckFormData.proposed_harvest_date ||
                  preCheckLoading
                }
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {preCheckLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Checking...
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    Run PHI Check
                  </>
                )}
              </button>

              {/* Results */}
              {preCheckResult && (
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {/* Status Banner */}
                  <div
                    className={`p-4 rounded-lg ${
                      preCheckResult.status === 'compliant'
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : preCheckResult.status === 'warning'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {preCheckResult.status === 'compliant' ? (
                        <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                      ) : preCheckResult.status === 'warning' ? (
                        <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                      ) : (
                        <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                      )}
                      <div>
                        <p
                          className={`font-semibold ${
                            preCheckResult.status === 'compliant'
                              ? 'text-green-800 dark:text-green-200'
                              : preCheckResult.status === 'warning'
                              ? 'text-yellow-800 dark:text-yellow-200'
                              : 'text-red-800 dark:text-red-200'
                          }`}
                        >
                          {preCheckResult.status === 'compliant'
                            ? 'Safe to Harvest'
                            : preCheckResult.status === 'warning'
                            ? 'Caution Advised'
                            : 'Do Not Harvest'}
                        </p>
                        <p
                          className={`text-sm ${
                            preCheckResult.status === 'compliant'
                              ? 'text-green-700 dark:text-green-300'
                              : preCheckResult.status === 'warning'
                              ? 'text-yellow-700 dark:text-yellow-300'
                              : 'text-red-700 dark:text-red-300'
                          }`}
                        >
                          {preCheckResult.message}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Earliest Safe Date */}
                  {preCheckResult.earliest_safe_harvest && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Earliest safe harvest:{' '}
                        <span className="font-semibold">
                          {new Date(preCheckResult.earliest_safe_harvest).toLocaleDateString()}
                        </span>
                      </p>
                    </div>
                  )}

                  {/* Applications Summary */}
                  {preCheckResult.applications && preCheckResult.applications.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Recent Applications
                      </p>
                      <div className="space-y-2">
                        {preCheckResult.applications.map((app, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded ${
                              app.compliant
                                ? 'bg-green-50 dark:bg-green-900/20'
                                : 'bg-red-50 dark:bg-red-900/20'
                            }`}
                          >
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {app.product_name}
                              </span>
                              <span
                                className={
                                  app.compliant
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                                }
                              >
                                {app.compliant ? 'OK' : `Wait ${app.days_remaining} days`}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowPreCheckModal(false);
                    resetPreCheck();
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PHIComplianceChecker;
