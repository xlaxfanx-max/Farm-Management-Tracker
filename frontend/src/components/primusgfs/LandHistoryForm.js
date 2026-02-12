import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Map,
  Shield,
  X,
} from 'lucide-react';
import { primusGFSAPI, farmsAPI } from '../../services/api';

const formatDate = (str) => {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const RISK_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'high', label: 'High', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'unknown', label: 'Unknown', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
];

const LAND_USE_OPTIONS = [
  'Agriculture', 'Livestock', 'Industrial', 'Commercial',
  'Residential', 'Vacant', 'Landfill', 'Mining', 'Other',
];

const RISK_FACTOR_FIELDS = [
  { key: 'previous_pesticide_use', label: 'Previous Pesticide Use' },
  { key: 'previous_chemical_storage', label: 'Previous Chemical Storage' },
  { key: 'previous_waste_disposal', label: 'Previous Waste Disposal' },
  { key: 'previous_mining', label: 'Previous Mining Activity' },
  { key: 'flood_zone', label: 'Flood Zone' },
  { key: 'adjacent_contamination_risk', label: 'Adjacent Contamination Risk' },
];

const RiskBadge = ({ level }) => {
  const config = RISK_LEVELS.find((r) => r.value === level) || RISK_LEVELS[3];
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

const EMPTY_FORM = {
  field: '',
  assessment_date: '',
  land_use_history: [],
  previous_pesticide_use: false,
  previous_chemical_storage: false,
  previous_waste_disposal: false,
  previous_mining: false,
  flood_zone: false,
  adjacent_contamination_risk: false,
  soil_testing_conducted: false,
  soil_test_date: '',
  soil_test_passed: false,
  contamination_risk: 'unknown',
  risk_justification: '',
  mitigation_measures: '',
};

const EMPTY_HISTORY_ENTRY = {
  year_start: '',
  year_end: '',
  land_use: 'Agriculture',
  details: '',
};

export default function LandHistoryForm() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState('');
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedFarm) params.farm_id = selectedFarm;
      const res = await primusGFSAPI.getLandAssessments(params);
      setAssessments(res.data?.results || res.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load land assessments.');
    } finally {
      setLoading(false);
    }
  }, [selectedFarm]);

  const fetchFarms = useCallback(async () => {
    try {
      const res = await farmsAPI.getAll();
      setFarms(res.data?.results || res.data || []);
    } catch {
      // Farms list is supplementary; swallow error
    }
  }, []);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  useEffect(() => {
    fetchFarms();
  }, [fetchFarms]);

  const handleApprove = async (id) => {
    try {
      await primusGFSAPI.approveLandAssessment(id);
      fetchAssessments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to approve assessment.');
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggleRiskFactor = (field) => {
    setFormData((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // Land use history helpers
  const addHistoryEntry = () => {
    setFormData((prev) => ({
      ...prev,
      land_use_history: [...prev.land_use_history, { ...EMPTY_HISTORY_ENTRY }],
    }));
  };

  const updateHistoryEntry = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.land_use_history];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, land_use_history: updated };
    });
  };

  const removeHistoryEntry = (index) => {
    setFormData((prev) => ({
      ...prev,
      land_use_history: prev.land_use_history.filter((_, i) => i !== index),
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await primusGFSAPI.createLandAssessment(formData);
      setShowCreateModal(false);
      setFormData({ ...EMPTY_FORM });
      fetchAssessments();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Render ---

  if (loading && assessments.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading land assessments...</span>
      </div>
    );
  }

  if (error && assessments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-red-600 dark:text-red-400">
        <AlertTriangle className="w-10 h-10 mb-2" />
        <p className="mb-4">{error}</p>
        <button
          onClick={fetchAssessments}
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
            <Map className="w-6 h-6 text-green-600 dark:text-green-400" />
            Land History Assessment
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Assess and document prior land use for PrimusGFS compliance.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Assessment
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <select
          value={selectedFarm}
          onChange={(e) => setSelectedFarm(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
        >
          <option value="">All Farms</option>
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>{farm.name || `Farm #${farm.id}`}</option>
          ))}
        </select>
      </div>

      {/* Error banner (inline) */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Assessment Cards */}
      {assessments.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Map className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No land assessments found.</p>
          <p className="text-sm mt-1">Create a new assessment to document land history.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assessments.map((a) => (
            <div
              key={a.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{a.field_name || `Field #${a.field}`}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{a.farm_name || '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {a.approved ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircle2 className="w-3 h-3" /> Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 dark:text-gray-400">Assessed:</span>
                <span className="text-gray-900 dark:text-gray-100">{formatDate(a.assessment_date)}</span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 dark:text-gray-400">Risk:</span>
                <RiskBadge level={a.contamination_risk} />
              </div>

              {a.risk_factor_count != null && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Risk Factors:</span>
                  <span className={`font-medium ${a.risk_factor_count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {a.risk_factor_count}
                  </span>
                </div>
              )}

              {!a.approved && (
                <button
                  onClick={() => handleApprove(a.id)}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve Assessment
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Land History Assessment</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-5">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Field ID</label>
                  <input
                    type="text"
                    value={formData.field}
                    onChange={(e) => handleChange('field', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                    placeholder="Field ID"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assessment Date</label>
                  <input
                    type="date"
                    value={formData.assessment_date}
                    onChange={(e) => handleChange('assessment_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                    required
                  />
                </div>
              </div>

              {/* Land Use History */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Land Use History</label>
                  <button
                    type="button"
                    onClick={addHistoryEntry}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Add Entry
                  </button>
                </div>
                {formData.land_use_history.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">No land use history entries. Click "Add Entry" to begin.</p>
                )}
                <div className="space-y-3">
                  {formData.land_use_history.map((entry, idx) => (
                    <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-gray-900/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Entry {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeHistoryEntry(idx)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          placeholder="Year Start"
                          value={entry.year_start}
                          onChange={(e) => updateHistoryEntry(idx, 'year_start', e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                        />
                        <input
                          type="number"
                          placeholder="Year End"
                          value={entry.year_end}
                          onChange={(e) => updateHistoryEntry(idx, 'year_end', e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                        />
                        <select
                          value={entry.land_use}
                          onChange={(e) => updateHistoryEntry(idx, 'land_use', e.target.value)}
                          className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                        >
                          {LAND_USE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="text"
                        placeholder="Details (optional)"
                        value={entry.details}
                        onChange={(e) => updateHistoryEntry(idx, 'details', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk Factors */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Risk Factors</label>
                <div className="grid grid-cols-2 gap-2">
                  {RISK_FACTOR_FIELDS.map((rf) => (
                    <label
                      key={rf.key}
                      className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={formData[rf.key]}
                        onChange={() => handleToggleRiskFactor(rf.key)}
                        className="rounded border-gray-300 text-blue-600 dark:border-gray-600 dark:bg-gray-900"
                      />
                      <span className="text-gray-700 dark:text-gray-300 text-xs">{rf.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Soil Testing */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.soil_testing_conducted}
                    onChange={() => handleChange('soil_testing_conducted', !formData.soil_testing_conducted)}
                    className="rounded border-gray-300 text-blue-600 dark:border-gray-600 dark:bg-gray-900"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Soil Testing Conducted</span>
                </label>
                {formData.soil_testing_conducted && (
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Test Date</label>
                      <input
                        type="date"
                        value={formData.soil_test_date}
                        onChange={(e) => handleChange('soil_test_date', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer pb-1">
                        <input
                          type="checkbox"
                          checked={formData.soil_test_passed}
                          onChange={() => handleChange('soil_test_passed', !formData.soil_test_passed)}
                          className="rounded border-gray-300 text-green-600 dark:border-gray-600 dark:bg-gray-900"
                        />
                        <span className="text-xs text-gray-700 dark:text-gray-300">Test Passed</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Risk Assessment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contamination Risk</label>
                <select
                  value={formData.contamination_risk}
                  onChange={(e) => handleChange('contamination_risk', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                >
                  {RISK_LEVELS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Risk Justification</label>
                <textarea
                  value={formData.risk_justification}
                  onChange={(e) => handleChange('risk_justification', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="Justify the assigned contamination risk level..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mitigation Measures</label>
                <textarea
                  value={formData.mitigation_measures}
                  onChange={(e) => handleChange('mitigation_measures', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                  placeholder="Describe mitigation measures taken or planned..."
                />
              </div>

              {/* Actions */}
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
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
